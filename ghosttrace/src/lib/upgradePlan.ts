import type { GraphNode, UpgradePlanItem } from '../types';

/**
 * Produces a topological upgrade order using reverse Kahn's algorithm
 * with Tarjan-style cycle handling.
 *
 * Rule: Leaf dependencies (packages that do not depend on other outdated packages)
 * MUST be upgraded BEFORE packages that depend on them.
 */
export function generateUpgradePlan(nodes: GraphNode[]): UpgradePlanItem[] {
  // Only plan packages that actually need updates, are deprecated, or vulnerable
  const actionableNodes = nodes.filter(
    (n) => n.status !== 'up-to-date' || n.riskScore > 10
  );

  if (actionableNodes.length === 0) {
    return [];
  }

  const nodeMap = new Map<string, GraphNode>();
  for (const node of actionableNodes) {
    nodeMap.set(node.id, node);
  }

  // Build in-degree map based on dependencies between actionable nodes
  // Edge: A depends on B -> B must be upgraded before A
  // So in order to upgrade A, B must already be done.
  // In Kahn's algorithm for prerequisite ordering:
  // Precedence: B -> A. B has in-degree 0 (nothing blocking B), A has in-degree > 0.
  const inDegree = new Map<string, number>();
  const graphAdj = new Map<string, string[]>(); // B -> list of packages that depend on B

  for (const node of actionableNodes) {
    inDegree.set(node.id, 0);
    graphAdj.set(node.id, []);
  }

  for (const node of actionableNodes) {
    // node depends on node.dependencies
    for (const depId of node.dependencies) {
      if (nodeMap.has(depId)) {
        // depId must be upgraded before node
        // graphAdj[depId].push(node.id)
        graphAdj.get(depId)?.push(node.id);
        inDegree.set(node.id, (inDegree.get(node.id) || 0) + 1);
      }
    }
  }

  // Queue of nodes with in-degree 0 (leaves / independent dependencies)
  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  // Sort initial queue by highest riskScore first so important leaves come first
  queue.sort((a, b) => (nodeMap.get(b)?.riskScore || 0) - (nodeMap.get(a)?.riskScore || 0));

  const orderedIds: string[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currId = queue.shift()!;
    if (visited.has(currId)) continue;
    visited.add(currId);
    orderedIds.push(currId);

    const dependents = graphAdj.get(currId) || [];
    for (const depId of dependents) {
      const currentDeg = (inDegree.get(depId) || 1) - 1;
      inDegree.set(depId, currentDeg);
      if (currentDeg === 0 && !visited.has(depId)) {
        queue.push(depId);
      }
    }

    // Keep queue sorted by risk score
    queue.sort((a, b) => (nodeMap.get(b)?.riskScore || 0) - (nodeMap.get(a)?.riskScore || 0));
  }

  // Handle circular references: add any unvisited nodes sorted by risk score
  if (orderedIds.length < actionableNodes.length) {
    const remaining = actionableNodes
      .filter((n) => !visited.has(n.id))
      .sort((a, b) => b.riskScore - a.riskScore);
    for (const rem of remaining) {
      orderedIds.push(rem.id);
      visited.add(rem.id);
    }
  }

  // Group into upgrade phases/steps
  const planItems: UpgradePlanItem[] = orderedIds.map((id, index) => {
    const node = nodeMap.get(id)!;
    const targetVersion = node.enrichment?.latestVersion || node.installedVersion;

    let rationale = `Update to ${targetVersion}.`;
    let estimatedEffort = '30m';
    let breakingChangeRisk: UpgradePlanItem['breakingChangeRisk'] = 'LOW';

    if (node.status === 'vulnerable') {
      const hasMajorGap = (node.enrichment?.majorGap || 0) > 0;
      rationale = `Fixes known security advisories (${node.enrichment?.vulnerabilities?.length || 1} CVEs). Upstream blast radius: ${node.blastRadius}.`;
      breakingChangeRisk = hasMajorGap ? 'HIGH' : 'LOW';
      estimatedEffort = hasMajorGap ? '2-4h' : '45m';
    } else if (node.status === 'deprecated') {
      rationale = `Package is deprecated by author: "${node.enrichment?.deprecationMessage || 'No longer maintained'}". Migration needed.`;
      breakingChangeRisk = 'HIGH';
      estimatedEffort = '3-6h';
    } else if (node.status === 'major-behind') {
      rationale = `Major version upgrade across breaking API boundaries. Review changelog before upgrading.`;
      breakingChangeRisk = 'HIGH';
      estimatedEffort = '2-5h';
    } else if (node.status === 'minor-behind') {
      rationale = `Feature release update; backward-compatible API additions.`;
      breakingChangeRisk = 'MEDIUM';
      estimatedEffort = '30m';
    } else {
      rationale = `Routine patch maintenance update; non-breaking bug fixes.`;
      breakingChangeRisk = 'LOW';
      estimatedEffort = '15m';
    }

    // Direct npm command suggestion
    const command = node.isDev
      ? `npm install -D ${node.name}@${targetVersion}`
      : `npm install ${node.name}@${targetVersion}`;

    return {
      step: index + 1,
      packageId: node.id,
      packageName: node.name,
      currentVersion: node.installedVersion,
      targetVersion,
      riskScore: node.riskScore,
      breakingChangeRisk,
      estimatedEffort,
      rationale,
      command,
      isDirect: node.isDirect,
      dependentsCount: node.dependents.length,
    };
  });

  return planItems;
}
