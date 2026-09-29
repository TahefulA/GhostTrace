import type {
  RawPackageJson,
  GraphNode,
  GraphEdge,
  DependencyGraph,
} from '../types';
import type { ParsedLockfileResult } from './lockfile';
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force-3d';

export interface BuildGraphOptions {
  maxNodes?: number; // default 600
}

/**
 * Builds a deduplicated dependency graph from parsed package.json and lockfile.
 * Handles node capping at 600 nodes with priority for direct deps and shallow depths.
 */
export function buildDependencyGraph(
  packageJson: RawPackageJson,
  parsedLock: ParsedLockfileResult,
  options: BuildGraphOptions = {}
): DependencyGraph {
  const maxNodes = options.maxNodes ?? 600;

  const directProd = new Set(Object.keys(packageJson.dependencies || {}));
  const directDev = new Set(Object.keys(packageJson.devDependencies || {}));
  const allDirect = new Set([...directProd, ...directDev]);

  // First pass: collect all unique nodes by name@version
  // Temporary map: name@version -> intermediate node
  interface IntermediateNode {
    id: string;
    name: string;
    version: string;
    isDirect: boolean;
    isDev: boolean;
    depth: number;
    declaredDependencies: Record<string, string>;
    lockPaths: string[];
  }

  const intermediateMap = new Map<string, IntermediateNode>();
  // Map to find nodes by package name for resolution
  const nameToVersions = new Map<string, Set<string>>();

  // Also map each lockPath (e.g. "node_modules/foo") to its id (foo@1.0.0)
  const pathToId = new Map<string, string>();

  // Process all lock packages
  for (const [pathKey, entry] of parsedLock.packages.entries()) {
    const isDirect = allDirect.has(entry.name);
    const isDev = entry.isDev || (!isDirect && false) || (isDirect && directDev.has(entry.name) && !directProd.has(entry.name));
    const id = `${entry.name}@${entry.version}`;

    pathToId.set(pathKey, id);

    let versions = nameToVersions.get(entry.name);
    if (!versions) {
      versions = new Set();
      nameToVersions.set(entry.name, versions);
    }
    versions.add(entry.version);

    const existing = intermediateMap.get(id);
    if (existing) {
      if (isDirect) existing.isDirect = true;
      if (!isDev) existing.isDev = false; // if used in prod anywhere, mark as not dev-only
      existing.lockPaths.push(pathKey);
      // Merge declared dependencies
      Object.assign(existing.declaredDependencies, entry.dependencies);
    } else {
      intermediateMap.set(id, {
        id,
        name: entry.name,
        version: entry.version,
        isDirect,
        isDev,
        depth: isDirect ? 1 : 9999, // to be computed via BFS
        declaredDependencies: { ...entry.dependencies },
        lockPaths: [pathKey],
      });
    }
  }

  // Ensure all direct dependencies from package.json exist as nodes even if lockfile was missing
  for (const name of allDirect) {
    const isDev = directDev.has(name) && !directProd.has(name);
    const versionSpec = (packageJson.dependencies?.[name] || packageJson.devDependencies?.[name] || '0.0.0')
      .replace(/^[^0-9]*/, '') || '0.0.0';
    const id = `${name}@${versionSpec}`;

    if (!nameToVersions.has(name) || nameToVersions.get(name)!.size === 0) {
      intermediateMap.set(id, {
        id,
        name,
        version: versionSpec,
        isDirect: true,
        isDev,
        depth: 1,
        declaredDependencies: {},
        lockPaths: [`node_modules/${name}`],
      });
      nameToVersions.set(name, new Set([versionSpec]));
    }
  }

  // Build edges
  const edgeKeySet = new Set<string>();
  const rawEdges: { source: string; target: string; isDev?: boolean }[] = [];

  // Helper to find target node id for a dependency
  function resolveDependencyNodeId(parentLockPath: string, depName: string): string | null {
    // 1. Try nested node_modules in lockfile: e.g. "node_modules/parent/node_modules/depName"
    const nestedPath = `${parentLockPath}/node_modules/${depName}`;
    if (pathToId.has(nestedPath)) {
      return pathToId.get(nestedPath)!;
    }

    // 2. Try top-level node_modules: "node_modules/depName"
    const topPath = `node_modules/${depName}`;
    if (pathToId.has(topPath)) {
      return pathToId.get(topPath)!;
    }

    // 3. Match any version of this package from nameToVersions
    const versions = nameToVersions.get(depName);
    if (versions && versions.size > 0) {
      const firstVersion = Array.from(versions)[0];
      return `${depName}@${firstVersion}`;
    }

    return null;
  }

  // Construct edges from intermediate nodes
  for (const node of intermediateMap.values()) {
    const primaryPath = node.lockPaths[0] || `node_modules/${node.name}`;

    for (const depName of Object.keys(node.declaredDependencies)) {
      const targetId = resolveDependencyNodeId(primaryPath, depName);
      if (targetId && targetId !== node.id) {
        const edgeKey = `${node.id}->${targetId}`;
        if (!edgeKeySet.has(edgeKey)) {
          edgeKeySet.add(edgeKey);
          rawEdges.push({
            source: node.id,
            target: targetId,
            isDev: node.isDev,
          });
        }
      }
    }
  }

  // Compute depths using BFS starting from direct dependencies (depth = 1)
  const adjacency = new Map<string, string[]>();
  for (const edge of rawEdges) {
    let neighbors = adjacency.get(edge.source);
    if (!neighbors) {
      neighbors = [];
      adjacency.set(edge.source, neighbors);
    }
    neighbors.push(edge.target);
  }

  // Queue for BFS
  const queue: { id: string; depth: number }[] = [];
  const visited = new Set<string>();

  for (const node of intermediateMap.values()) {
    if (node.isDirect) {
      node.depth = 1;
      queue.push({ id: node.id, depth: 1 });
      visited.add(node.id);
    }
  }

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    const neighbors = adjacency.get(id) || [];
    for (const targetId of neighbors) {
      const targetNode = intermediateMap.get(targetId);
      if (targetNode) {
        if (targetNode.depth > depth + 1) {
          targetNode.depth = depth + 1;
        }
        if (!visited.has(targetId)) {
          visited.add(targetId);
          queue.push({ id: targetId, depth: depth + 1 });
        }
      }
    }
  }

  // For any remaining disconnected packages, assign depth 2
  for (const node of intermediateMap.values()) {
    if (node.depth === 9999) {
      node.depth = 2;
    }
  }

  const totalNodeCount = intermediateMap.size;
  let truncated = false;
  let finalIntermediateNodes = Array.from(intermediateMap.values());

  // Cap at 600 nodes if larger
  if (totalNodeCount > maxNodes) {
    truncated = true;
    // Keep direct deps plus depth <= 2
    const priorityNodes = finalIntermediateNodes.filter(n => n.isDirect || n.depth <= 2);

    if (priorityNodes.length <= maxNodes) {
      // If priority nodes fit, fill remaining slots by sorting remaining by depth
      const remainingNodes = finalIntermediateNodes
        .filter(n => !n.isDirect && n.depth > 2)
        .sort((a, b) => a.depth - b.depth);

      finalIntermediateNodes = [
        ...priorityNodes,
        ...remainingNodes.slice(0, maxNodes - priorityNodes.length),
      ];
    } else {
      // If even depth <= 2 exceeds maxNodes, prioritize direct deps, then lowest depth
      priorityNodes.sort((a, b) => {
        if (a.isDirect && !b.isDirect) return -1;
        if (!a.isDirect && b.isDirect) return 1;
        return a.depth - b.depth;
      });
      finalIntermediateNodes = priorityNodes.slice(0, maxNodes);
    }
  }

  const keptNodeIds = new Set(finalIntermediateNodes.map(n => n.id));

  // Build filtered edges
  const finalEdges: GraphEdge[] = [];
  const incomingMap = new Map<string, Set<string>>(); // target -> Set<source> (dependents)
  const outgoingMap = new Map<string, Set<string>>(); // source -> Set<target> (dependencies)

  for (const edge of rawEdges) {
    if (keptNodeIds.has(edge.source) && keptNodeIds.has(edge.target)) {
      finalEdges.push({
        id: `${edge.source}->${edge.target}`,
        source: edge.source,
        target: edge.target,
        isDev: edge.isDev,
      });

      // Track incoming
      let inSet = incomingMap.get(edge.target);
      if (!inSet) {
        inSet = new Set();
        incomingMap.set(edge.target, inSet);
      }
      inSet.add(edge.source);

      // Track outgoing
      let outSet = outgoingMap.get(edge.source);
      if (!outSet) {
        outSet = new Set();
        outgoingMap.set(edge.source, outSet);
      }
      outSet.add(edge.target);
    }
  }

  // Calculate transitive blast radius (how many packages depend on this node directly or transitively)
  // We can compute this via reverse BFS for each node
  const blastRadiusMap = new Map<string, number>();
  for (const nodeId of keptNodeIds) {
    const dependentsVisited = new Set<string>();
    const bQueue = [nodeId];

    while (bQueue.length > 0) {
      const curr = bQueue.shift()!;
      const parents = incomingMap.get(curr) || [];
      for (const parent of parents) {
        if (!dependentsVisited.has(parent) && parent !== nodeId) {
          dependentsVisited.add(parent);
          bQueue.push(parent);
        }
      }
    }

    blastRadiusMap.set(nodeId, dependentsVisited.size);
  }

  // Create final GraphNode objects
  const finalNodes = new Map<string, GraphNode>();
  let directCount = 0;
  let transitiveCount = 0;

  for (const inter of finalIntermediateNodes) {
    if (inter.isDirect) {
      directCount++;
    } else {
      transitiveCount++;
    }

    const directDependents = Array.from(incomingMap.get(inter.id) || []);
    const directDependencies = Array.from(outgoingMap.get(inter.id) || []);
    const blastRadius = blastRadiusMap.get(inter.id) || 0;

    const node: GraphNode = {
      id: inter.id,
      name: inter.name,
      installedVersion: inter.version,
      depth: inter.depth,
      isDirect: inter.isDirect,
      isDev: inter.isDev,
      status: 'up-to-date',
      riskScore: 0,
      blastRadius,
      dependents: directDependents,
      dependencies: directDependencies,
    };

    finalNodes.set(node.id, node);
  }

  return {
    nodes: finalNodes,
    edges: finalEdges,
    truncated,
    totalNodeCount,
    hasLockfile: parsedLock.hasLockfile,
    lockfileWarning: parsedLock.warning,
    directDepsCount: directCount,
    transitiveDepsCount: transitiveCount,
  };
}

export interface LayoutResult {
  nodes: GraphNode[];
  finitePositionCount: number;
  repairedPositionCount: number;
}

/**
 * Computes 3D coordinates for nodes using d3-force-3d.
 * Ensures every node has finite x, y, z positions.
 * Repaired positions (NaN or undefined) are placed randomly within radius 50.
 */
export function compute3DGraphLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  ticks = 80
): LayoutResult {
  if (nodes.length === 0) {
    return { nodes: [], finitePositionCount: 0, repairedPositionCount: 0 };
  }

  // Create simulation node items with initial positions if present
  const simNodes = nodes.map((n, i) => ({
    id: n.id,
    index: i,
    x: Number.isFinite(n.x) ? n.x : undefined,
    y: Number.isFinite(n.y) ? n.y : undefined,
    z: Number.isFinite(n.z) ? n.z : undefined,
  }));

  const nodeIdSet = new Set(nodes.map((n) => n.id));
  const validEdges = edges.filter(
    (e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target)
  );

  const simLinks = validEdges.map((e) => ({
    source: e.source,
    target: e.target,
  }));

  try {
    const sim = forceSimulation(simNodes as any, 3)
      .force(
        'link',
        forceLink(simLinks)
          .id((d: any) => d.id)
          .distance(50)
          .strength(0.6)
      )
      .force('charge', forceManyBody().strength(-120).distanceMax(600))
      .force('center', forceCenter(0, 0, 0));

    sim.stop();
    for (let i = 0; i < ticks; i++) {
      sim.tick();
    }
  } catch (err) {
    console.warn('[GhostTrace Layout] d3-force-3d error during simulation:', err);
  }

  let finitePositionCount = 0;
  let repairedPositionCount = 0;

  // Copy positions back and sanitize
  nodes.forEach((node, i) => {
    const simNode = simNodes[i];
    const x = simNode?.x;
    const y = simNode?.y;
    const z = simNode?.z;

    const isFinite =
      x !== undefined &&
      y !== undefined &&
      z !== undefined &&
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      Number.isFinite(z);

    if (isFinite) {
      node.x = x;
      node.y = y;
      node.z = z;
      finitePositionCount++;
    } else {
      // Replace with random position within radius 50
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 10 + 40 * Math.cbrt(Math.random());
      node.x = r * Math.sin(phi) * Math.cos(theta);
      node.y = r * Math.sin(phi) * Math.sin(theta);
      node.z = r * Math.cos(phi);
      repairedPositionCount++;
    }
  });

  console.log(
    `[GhostTrace Layout] ${finitePositionCount}/${nodes.length} finite positions, ${repairedPositionCount} repaired.`
  );

  return {
    nodes,
    finitePositionCount,
    repairedPositionCount,
  };
}

/**
 * Generates a built-in sample dependency graph of 15 hardcoded nodes
 * with complete edges, risk scores, health statuses, and 3D positions.
 */
export function generateSampleGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const sampleNodes: GraphNode[] = [
    {
      id: 'react@18.2.0',
      name: 'react',
      installedVersion: '18.2.0',
      depth: 1,
      isDirect: true,
      isDev: false,
      status: 'up-to-date',
      riskScore: 12,
      blastRadius: 4,
      dependents: [],
      dependencies: ['loose-envify@1.4.0', 'js-tokens@4.0.0'],
    },
    {
      id: 'react-dom@18.2.0',
      name: 'react-dom',
      installedVersion: '18.2.0',
      depth: 1,
      isDirect: true,
      isDev: false,
      status: 'up-to-date',
      riskScore: 14,
      blastRadius: 3,
      dependents: [],
      dependencies: ['react@18.2.0', 'scheduler@0.23.0'],
    },
    {
      id: 'scheduler@0.23.0',
      name: 'scheduler',
      installedVersion: '0.23.0',
      depth: 2,
      isDirect: false,
      isDev: false,
      status: 'up-to-date',
      riskScore: 8,
      blastRadius: 2,
      dependents: ['react-dom@18.2.0'],
      dependencies: ['loose-envify@1.4.0'],
    },
    {
      id: 'loose-envify@1.4.0',
      name: 'loose-envify',
      installedVersion: '1.4.0',
      depth: 2,
      isDirect: false,
      isDev: false,
      status: 'patch-behind',
      riskScore: 22,
      blastRadius: 3,
      dependents: ['react@18.2.0', 'scheduler@0.23.0'],
      dependencies: ['js-tokens@4.0.0'],
    },
    {
      id: 'js-tokens@4.0.0',
      name: 'js-tokens',
      installedVersion: '4.0.0',
      depth: 3,
      isDirect: false,
      isDev: false,
      status: 'up-to-date',
      riskScore: 5,
      blastRadius: 2,
      dependents: ['loose-envify@1.4.0'],
      dependencies: [],
    },
    {
      id: 'express@4.18.2',
      name: 'express',
      installedVersion: '4.18.2',
      depth: 1,
      isDirect: true,
      isDev: false,
      status: 'minor-behind',
      riskScore: 48,
      blastRadius: 5,
      dependents: [],
      dependencies: ['body-parser@1.20.1', 'debug@2.6.9', 'qs@6.11.0'],
    },
    {
      id: 'body-parser@1.20.1',
      name: 'body-parser',
      installedVersion: '1.20.1',
      depth: 2,
      isDirect: false,
      isDev: false,
      status: 'vulnerable',
      riskScore: 78,
      blastRadius: 3,
      dependents: ['express@4.18.2'],
      dependencies: ['bytes@3.1.2', 'debug@2.6.9'],
    },
    {
      id: 'bytes@3.1.2',
      name: 'bytes',
      installedVersion: '3.1.2',
      depth: 3,
      isDirect: false,
      isDev: false,
      status: 'up-to-date',
      riskScore: 5,
      blastRadius: 1,
      dependents: ['body-parser@1.20.1'],
      dependencies: [],
    },
    {
      id: 'debug@2.6.9',
      name: 'debug',
      installedVersion: '2.6.9',
      depth: 2,
      isDirect: false,
      isDev: false,
      status: 'deprecated',
      riskScore: 74,
      blastRadius: 4,
      dependents: ['express@4.18.2', 'body-parser@1.20.1', 'follow-redirects@1.14.0'],
      dependencies: ['ms@2.0.0'],
    },
    {
      id: 'ms@2.0.0',
      name: 'ms',
      installedVersion: '2.0.0',
      depth: 3,
      isDirect: false,
      isDev: false,
      status: 'minor-behind',
      riskScore: 28,
      blastRadius: 2,
      dependents: ['debug@2.6.9'],
      dependencies: [],
    },
    {
      id: 'qs@6.11.0',
      name: 'qs',
      installedVersion: '6.11.0',
      depth: 2,
      isDirect: false,
      isDev: false,
      status: 'up-to-date',
      riskScore: 10,
      blastRadius: 1,
      dependents: ['express@4.18.2'],
      dependencies: [],
    },
    {
      id: 'axios@0.21.1',
      name: 'axios',
      installedVersion: '0.21.1',
      depth: 1,
      isDirect: true,
      isDev: false,
      status: 'vulnerable',
      riskScore: 92,
      blastRadius: 2,
      dependents: [],
      dependencies: ['follow-redirects@1.14.0'],
    },
    {
      id: 'follow-redirects@1.14.0',
      name: 'follow-redirects',
      installedVersion: '1.14.0',
      depth: 2,
      isDirect: false,
      isDev: false,
      status: 'vulnerable',
      riskScore: 82,
      blastRadius: 1,
      dependents: ['axios@0.21.1'],
      dependencies: ['debug@2.6.9'],
    },
    {
      id: 'lodash@4.17.15',
      name: 'lodash',
      installedVersion: '4.17.15',
      depth: 1,
      isDirect: true,
      isDev: false,
      status: 'vulnerable',
      riskScore: 85,
      blastRadius: 0,
      dependents: [],
      dependencies: [],
    },
    {
      id: 'chalk@2.4.2',
      name: 'chalk',
      installedVersion: '2.4.2',
      depth: 1,
      isDirect: true,
      isDev: true,
      status: 'major-behind',
      riskScore: 56,
      blastRadius: 0,
      dependents: [],
      dependencies: [],
    },
  ];

  const sampleEdges: GraphEdge[] = [
    { id: 'e1', source: 'react@18.2.0', target: 'loose-envify@1.4.0' },
    { id: 'e2', source: 'react@18.2.0', target: 'js-tokens@4.0.0' },
    { id: 'e3', source: 'react-dom@18.2.0', target: 'react@18.2.0' },
    { id: 'e4', source: 'react-dom@18.2.0', target: 'scheduler@0.23.0' },
    { id: 'e5', source: 'scheduler@0.23.0', target: 'loose-envify@1.4.0' },
    { id: 'e6', source: 'loose-envify@1.4.0', target: 'js-tokens@4.0.0' },
    { id: 'e7', source: 'express@4.18.2', target: 'body-parser@1.20.1' },
    { id: 'e8', source: 'express@4.18.2', target: 'debug@2.6.9' },
    { id: 'e9', source: 'express@4.18.2', target: 'qs@6.11.0' },
    { id: 'e10', source: 'body-parser@1.20.1', target: 'bytes@3.1.2' },
    { id: 'e11', source: 'body-parser@1.20.1', target: 'debug@2.6.9' },
    { id: 'e12', source: 'debug@2.6.9', target: 'ms@2.0.0' },
    { id: 'e13', source: 'axios@0.21.1', target: 'follow-redirects@1.14.0' },
    { id: 'e14', source: 'follow-redirects@1.14.0', target: 'debug@2.6.9' },
  ];

  // Compute positions
  compute3DGraphLayout(sampleNodes, sampleEdges, 100);

  return { nodes: sampleNodes, edges: sampleEdges };
}
