import { fetchRepoMetadata, fetchRawFile } from '../github';
import { parsePackageJson, parsePackageLock } from '../lockfile';
import { buildDependencyGraph, compute3DGraphLayout } from '../graph';
import { saveScanToHistory } from '../storage';
import {
  fetchNpmPackageMetadata,
  fetchOSVVulnerabilitiesBatch,
  classifyPackageStatus,
  getCachedEnrichment,
  setCachedEnrichment,
} from '../enrichment';
import { calculateRiskScore } from '../scoring';
import type {
  RepoIdentifier,
  ScanResult,
  ScanProgress,
  GitHubRateLimit,
  GraphNode,
  PackageEnrichment,
} from '../../types';

export interface PipelineOptions {
  repo: RepoIdentifier;
  token?: string;
  onProgress?: (progress: Partial<ScanProgress>) => void;
  signal?: AbortSignal;
}

/**
 * Runs the core repository scan pipeline (Phase 1 Foundation).
 */
export async function runScanPipeline(options: PipelineOptions): Promise<ScanResult> {
  const { repo, token, onProgress, signal } = options;

  if (signal?.aborted) {
    throw new Error('Scan was cancelled');
  }

  // 1. Fetch metadata
  onProgress?.({
    step: 'fetching_metadata',
    percent: 15,
    message: `Connecting to GitHub API for ${repo.owner}/${repo.repo}...`,
  });

  const { meta, rateLimit } = await fetchRepoMetadata(repo.owner, repo.repo, token);

  if (signal?.aborted) {
    throw new Error('Scan was cancelled');
  }

  // 2. Fetch package.json and package-lock.json
  const basePath = repo.subpath ? `${repo.subpath.replace(/\/+$/, '')}/` : '';
  const pkgPath = `${basePath}package.json`;
  const lockPath = `${basePath}package-lock.json`;

  onProgress?.({
    step: 'fetching_files',
    percent: 35,
    message: `Fetching ${pkgPath} and ${lockPath} at commit ${meta.commitSha.slice(0, 7)}...`,
  });

  let [pkgResult, lockResult] = await Promise.all([
    fetchRawFile(repo.owner, repo.repo, meta.commitSha, pkgPath, token),
    fetchRawFile(repo.owner, repo.repo, meta.commitSha, lockPath, token),
  ]);

  if (signal?.aborted) {
    throw new Error('Scan was cancelled');
  }

  // If package.json was not found at the commit SHA, try standard branch names as fallback
  if (pkgResult.status === 404 && meta.commitSha !== 'main' && meta.commitSha !== 'master') {
    for (const fallbackRef of ['main', 'master']) {
      const probePkg = await fetchRawFile(repo.owner, repo.repo, fallbackRef, pkgPath, token);
      if (probePkg.status === 200 && probePkg.content.trim()) {
        pkgResult = probePkg;
        const probeLock = await fetchRawFile(repo.owner, repo.repo, fallbackRef, lockPath, token);
        if (probeLock.status === 200) {
          lockResult = probeLock;
        }
        break;
      }
    }
  }

  if (pkgResult.status === 404 || !pkgResult.content.trim()) {
    const isRoot = !repo.subpath;
    const msg = isRoot
      ? `No "package.json" was found in repository "${repo.owner}/${repo.repo}". GhostTrace is designed to trace JavaScript & TypeScript dependencies (npm, yarn, pnpm). This repository appears to be a documentation, curated list, or non-JavaScript repository.`
      : `No "package.json" found at subpath "${repo.subpath}" in "${repo.owner}/${repo.repo}". Please check that the subfolder path is correct.`;
    const err = new Error(msg);
    (err as any).isMissingManifest = true;
    (err as any).repoFullName = `${repo.owner}/${repo.repo}`;
    throw err;
  }

  // 3. Parse files
  onProgress?.({
    step: 'parsing_lockfile',
    percent: 55,
    message: 'Parsing package.json and package-lock.json structure...',
  });

  const packageJson = parsePackageJson(pkgResult.content);
  const parsedLock = parsePackageLock(
    lockResult.status === 200 ? lockResult.content : null,
    packageJson
  );

  // 4. Build graph
  onProgress?.({
    step: 'building_graph',
    percent: 65,
    message: 'Constructing dependency hierarchy and resolving versions...',
  });

  const graph = buildDependencyGraph(packageJson, parsedLock);
  const rawNodes = Array.from(graph.nodes.values());

  // 5. Enrich with npm metadata & OSV vulnerabilities
  onProgress?.({
    step: 'enriching_npm',
    percent: 75,
    message: `Checking npm registry and OSV advisories for ${rawNodes.length} packages...`,
  });

  // Query OSV in batches of 100
  const osvMap = await fetchOSVVulnerabilitiesBatch(
    rawNodes.map((n) => ({ name: n.name, version: n.installedVersion }))
  );

  // Concurrency-limited npm metadata fetch (up to 24 concurrent fetches with 24h IndexedDB caching)
  const CONCURRENCY = 24;
  const enrichedNodes: GraphNode[] = [];

  for (let i = 0; i < rawNodes.length; i += CONCURRENCY) {
    if (signal?.aborted) throw new Error('Scan was cancelled');

    const slice = rawNodes.slice(i, i + CONCURRENCY);
    const enrichedSlice = await Promise.all(
      slice.map(async (node) => {
        // Check cache first
        const cacheKey = `${node.name}@${node.installedVersion}`;
        let cached = await getCachedEnrichment(cacheKey);

        let npmMeta = cached;
        if (!npmMeta) {
          npmMeta = await fetchNpmPackageMetadata(node.name) as PackageEnrichment;
          if (npmMeta && (npmMeta.latestVersion || npmMeta.isDeprecated)) {
            await setCachedEnrichment(cacheKey, npmMeta);
          }
        }

        const vulns = osvMap.get(cacheKey) || [];
        const fullEnrichment: PackageEnrichment = {
          ...npmMeta,
          vulnerabilities: vulns,
        };

        const status = classifyPackageStatus(node.installedVersion, fullEnrichment);
        const { riskScore, riskBreakdown } = calculateRiskScore({
          ...node,
          enrichment: fullEnrichment,
        });

        return {
          ...node,
          status,
          riskScore,
          riskBreakdown,
          enrichment: fullEnrichment,
        };
      })
    );

    enrichedNodes.push(...enrichedSlice);

    const percent = Math.min(92, 75 + Math.floor((i / rawNodes.length) * 17));
    onProgress?.({
      step: 'enriching_npm',
      percent,
      message: `Enriched ${enrichedNodes.length} of ${rawNodes.length} packages...`,
    });
  }

  // Calculate 3D layout coordinates for all enriched nodes
  const layout = compute3DGraphLayout(enrichedNodes, graph.edges, 80);

  // Calculate aggregated stats
  let upToDate = 0;
  let patchBehind = 0;
  let minorBehind = 0;
  let majorBehind = 0;
  let deprecated = 0;
  let vulnerable = 0;
  let totalRisk = 0;

  for (const n of layout.nodes) {
    totalRisk += n.riskScore;
    switch (n.status) {
      case 'up-to-date':
        upToDate++;
        break;
      case 'patch-behind':
        patchBehind++;
        break;
      case 'minor-behind':
        minorBehind++;
        break;
      case 'major-behind':
        majorBehind++;
        break;
      case 'deprecated':
        deprecated++;
        break;
      case 'vulnerable':
        vulnerable++;
        break;
    }
  }

  const overallRiskScore =
    enrichedNodes.length > 0 ? Math.round(totalRisk / enrichedNodes.length) : 0;

  const debugInfo = {
    packageJsonUrl: pkgResult.url,
    packageJsonStatus: pkgResult.status,
    packageJsonError: pkgResult.error,
    packageLockUrl: lockResult.url,
    packageLockStatus: lockResult.status,
    packageLockError: lockResult.error,
    lockfileVersion: parsedLock.lockfileVersion,
    nodeCount: enrichedNodes.length,
    edgeCount: graph.edges.length,
    finitePositionCount: layout.finitePositionCount,
    repairedPositionCount: layout.repairedPositionCount,
  };

  console.log('[GhostTrace Scan Debug]', debugInfo);

  const scanId = `${repo.owner}_${repo.repo}_${Date.now()}`;
  const scanResult: ScanResult = {
    id: scanId,
    timestamp: Date.now(),
    repo,
    meta,
    graph: {
      nodes: layout.nodes,
      edges: graph.edges,
      truncated: graph.truncated,
      totalNodeCount: graph.totalNodeCount,
      hasLockfile: graph.hasLockfile,
      lockfileWarning: graph.lockfileWarning,
      directDepsCount: graph.directDepsCount,
      transitiveDepsCount: graph.transitiveDepsCount,
    },
    stats: {
      total: layout.nodes.length,
      upToDate,
      patchBehind,
      minorBehind,
      majorBehind,
      deprecated,
      vulnerable,
      overallRiskScore,
    },
    debugInfo,
  };

  // Save to IndexedDB history
  await saveScanToHistory(scanResult);

  onProgress?.({
    step: 'completed',
    percent: 100,
    message: 'Scan completed',
  });

  return scanResult;
}
