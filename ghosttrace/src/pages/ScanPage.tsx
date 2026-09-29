import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  GitBranch,
  Shield,
  Layers,
  ArrowLeft,
  ExternalLink,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileCode2,
  Calendar,
  Sparkles,
  ListOrdered,
  Share2,
} from 'lucide-react';
import { useScanStore, ActiveTab } from '../store/scanStore';
import { getScanById, exportScanAsJson, importScanFromJson } from '../lib/storage';
import { PackagesTable } from '../components/PackagesTable';
import { PackageDetailModal } from '../components/PackageDetailModal';
import { UpgradePlanView } from '../components/UpgradePlanView';
import { GraphView } from '../components/GraphView';
import { compute3DGraphLayout, generateSampleGraph } from '../lib/graph';
import type { ScanResult, GraphNode } from '../types';

export const ScanPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentScan, setCurrentScan, activeTab, setActiveTab } = useScanStore();
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isLoading, setIsLoading] = useState(!currentScan);
  const [showDebugStrip, setShowDebugStrip] = useState(true);

  // If scan nodes lack finite positions, compute layout immediately
  useEffect(() => {
    if (currentScan && currentScan.graph.nodes.length > 0) {
      const needsLayout = currentScan.graph.nodes.some(
        (n) => !Number.isFinite(n.x) || !Number.isFinite(n.y) || !Number.isFinite(n.z)
      );
      if (needsLayout) {
        const layout = compute3DGraphLayout(
          currentScan.graph.nodes,
          currentScan.graph.edges,
          70
        );
        setCurrentScan({
          ...currentScan,
          graph: {
            ...currentScan.graph,
            nodes: layout.nodes,
          },
        });
      }
    }
  }, [currentScan?.id]);

  useEffect(() => {
    async function loadScan() {
      if (!currentScan || currentScan.id !== id) {
        if (id) {
          const loaded = await getScanById(id);
          if (loaded) {
            setCurrentScan(loaded);
          } else {
            // Not found in local DB
            navigate('/');
          }
        }
      }
      setIsLoading(false);
    }
    loadScan();
  }, [id, currentScan, navigate, setCurrentScan]);

  if (isLoading || !currentScan) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex items-center gap-3 text-neutral-400 font-mono text-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          <span>Loading scan data...</span>
        </div>
      </div>
    );
  }

  const { meta, repo, graph, stats } = currentScan;

  // Top 5 risk packages
  const topRisks = [...graph.nodes]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);

  const handleExport = () => {
    exportScanAsJson(currentScan);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const imported = importScanFromJson(text);
        setCurrentScan(imported);
        navigate(`/scan/${imported.id}`);
      } catch (err: any) {
        alert('Failed to import scan: ' + (err.message || 'Invalid format'));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-12">
      {/* Repo Header Bar */}
      <div className="border-b border-neutral-800/80 bg-neutral-900/40 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center gap-1 text-xs text-neutral-400 hover:text-cyan-400 transition-colors mr-2"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>
                <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2 font-mono">
                  <span>{repo.owner}/{repo.repo}</span>
                  {repo.subpath && (
                    <span className="text-xs font-normal text-neutral-400 rounded bg-neutral-800 px-2 py-0.5">
                      /{repo.subpath}
                    </span>
                  )}
                </h1>
                <a
                  href={`https://github.com/${repo.owner}/${repo.repo}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-neutral-500 hover:text-neutral-300"
                  title="View repository on GitHub"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400 font-mono">
                <div className="flex items-center gap-1">
                  <GitBranch className="h-3 w-3 text-cyan-400" />
                  <span>{meta.defaultBranch}</span>
                </div>
                <div>SHA: {meta.commitSha.slice(0, 7)}</div>
                <div>Stars: {meta.stars.toLocaleString()}</div>
                <div>{graph.nodes.length} Packages ({graph.directDepsCount} direct, {graph.transitiveDepsCount} transitive)</div>
              </div>
            </div>

            {/* Share / Export / Import Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
                title="Export scan snapshot as JSON"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export JSON</span>
              </button>

              <label className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                <span>Import JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Lockfile Warning if present */}
          {graph.lockfileWarning && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>{graph.lockfileWarning}</span>
            </div>
          )}

          {/* Truncated notice if > 600 nodes */}
          {graph.truncated && (
            <div className="mt-2 rounded-lg border border-cyan-500/30 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-cyan-400" />
              <span>
                Graph capped at 600 nodes (out of {graph.totalNodeCount} total). Preserved all direct dependencies and shallow transitive tiers.
              </span>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="mt-6 flex border-b border-neutral-800 gap-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${
                activeTab === 'overview'
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('graph')}
              className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === 'graph'
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>3D Graph</span>
            </button>
            <button
              onClick={() => setActiveTab('packages')}
              className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === 'packages'
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span>Packages ({graph.nodes.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('plan')}
              className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === 'plan'
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <ListOrdered className="h-3.5 w-3.5" />
              <span>Upgrade Plan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Temporary Debug Diagnostic Strip (can be hidden/shown) */}
            <div className="rounded-xl border border-cyan-800/40 bg-cyan-950/20 p-4 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-cyan-900/50">
                <div className="flex items-center gap-2 text-cyan-300 font-semibold">
                  <FileCode2 className="h-4 w-4" />
                  <span>DEBUG DIAGNOSTIC STRIP (Scanner & Graph Data Check)</span>
                </div>
                <button
                  onClick={() => setShowDebugStrip((prev) => !prev)}
                  className="rounded bg-neutral-900 border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-300 hover:text-white transition-colors"
                >
                  {showDebugStrip ? 'Hide Strip' : 'Show Strip'}
                </button>
              </div>

              {showDebugStrip && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-neutral-300">
                    <div className="rounded bg-neutral-900/70 p-2 border border-neutral-800">
                      <span className="text-neutral-500 block text-[10px]">TOTAL NODES</span>
                      <span className="font-bold text-sm text-cyan-300">
                        {graph.nodes.length}
                      </span>
                    </div>
                    <div className="rounded bg-neutral-900/70 p-2 border border-neutral-800">
                      <span className="text-neutral-500 block text-[10px]">TOTAL EDGES</span>
                      <span className="font-bold text-sm text-cyan-300">
                        {graph.edges.length}
                      </span>
                    </div>
                    <div className="rounded bg-neutral-900/70 p-2 border border-neutral-800">
                      <span className="text-neutral-500 block text-[10px]">FINITE 3D POSITIONS</span>
                      <span className="font-bold text-sm text-emerald-400">
                        {
                          graph.nodes.filter(
                            (n) =>
                              Number.isFinite(n.x) &&
                              Number.isFinite(n.y) &&
                              Number.isFinite(n.z)
                          ).length
                        }{' '}
                        / {graph.nodes.length}
                      </span>
                    </div>
                    <div className="rounded bg-neutral-900/70 p-2 border border-neutral-800">
                      <span className="text-neutral-500 block text-[10px]">LOCKFILE PARSED</span>
                      <span className="font-bold text-sm text-yellow-300">
                        {currentScan.debugInfo?.lockfileVersion
                          ? `v${currentScan.debugInfo.lockfileVersion}`
                          : graph.hasLockfile
                          ? 'v2/v3'
                          : 'None (yarn/pnpm)'}
                      </span>
                    </div>
                  </div>

                  <div className="rounded bg-neutral-900/60 p-2.5 border border-neutral-800 text-[11px] space-y-1.5 text-neutral-400">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="truncate">
                        <strong className="text-neutral-300">package.json:</strong>{' '}
                        {currentScan.debugInfo?.packageJsonUrl ||
                          `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${meta.commitSha}/package.json`}
                      </span>
                      <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/40 text-emerald-300 text-[10px]">
                        HTTP {currentScan.debugInfo?.packageJsonStatus || 200}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="truncate">
                        <strong className="text-neutral-300">package-lock.json:</strong>{' '}
                        {currentScan.debugInfo?.packageLockUrl ||
                          `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${meta.commitSha}/package-lock.json`}
                      </span>
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] border ${
                          (currentScan.debugInfo?.packageLockStatus ?? (graph.hasLockfile ? 200 : 404)) === 200
                            ? 'bg-emerald-950/80 border-emerald-800/40 text-emerald-300'
                            : 'bg-amber-950/80 border-amber-800/40 text-amber-300'
                        }`}
                      >
                        HTTP {currentScan.debugInfo?.packageLockStatus ?? (graph.hasLockfile ? 200 : 404)}
                        {currentScan.debugInfo?.packageLockError
                          ? ` (${currentScan.debugInfo.packageLockError})`
                          : ''}
                      </span>
                    </div>
                  </div>

                  {graph.edges.length === 0 && (
                    <div className="rounded bg-amber-950/30 border border-amber-800/40 p-2 text-amber-300 text-[11px] flex items-center justify-between">
                      <span>
                        Note: 0 edges parsed (lockfile absent or monorepo). Nodes are positioned cleanly in 3D orbit using force layout.
                      </span>
                      <button
                        onClick={() => {
                          const sample = generateSampleGraph();
                          setCurrentScan({
                            ...currentScan,
                            graph: {
                              ...currentScan.graph,
                              nodes: sample.nodes,
                              edges: sample.edges,
                              totalNodeCount: sample.nodes.length,
                              directDepsCount: sample.nodes.filter((n) => n.isDirect).length,
                              transitiveDepsCount: sample.nodes.filter((n) => !n.isDirect).length,
                            },
                          });
                          setActiveTab('graph');
                        }}
                        className="ml-2 underline hover:text-white"
                      >
                        Load sample graph &rarr;
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => setActiveTab('graph')}
                      className="rounded bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 font-sans text-xs font-medium transition-colors"
                    >
                      View 3D Graph &rarr;
                    </button>
                    <button
                      onClick={() => {
                        const sample = generateSampleGraph();
                        setCurrentScan({
                          ...currentScan,
                          graph: {
                            ...currentScan.graph,
                            nodes: sample.nodes,
                            edges: sample.edges,
                            totalNodeCount: sample.nodes.length,
                            directDepsCount: sample.nodes.filter((n) => n.isDirect).length,
                            transitiveDepsCount: sample.nodes.filter((n) => !n.isDirect).length,
                          },
                        });
                        setActiveTab('graph');
                      }}
                      className="rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-1 font-sans text-xs font-medium transition-colors"
                    >
                      Load Sample Graph (15 Nodes)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Health Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
                <span className="text-[11px] font-mono text-neutral-400 uppercase">Total Packages</span>
                <p className="text-2xl font-bold font-mono text-neutral-100 mt-1">{stats.total}</p>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
                <span className="text-[11px] font-mono text-emerald-400 uppercase">Up To Date</span>
                <p className="text-2xl font-bold font-mono text-emerald-300 mt-1">{stats.upToDate}</p>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
                <span className="text-[11px] font-mono text-yellow-400 uppercase">Minor / Patch</span>
                <p className="text-2xl font-bold font-mono text-yellow-300 mt-1">
                  {stats.patchBehind + stats.minorBehind}
                </p>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
                <span className="text-[11px] font-mono text-orange-400 uppercase">Major Behind</span>
                <p className="text-2xl font-bold font-mono text-orange-300 mt-1">{stats.majorBehind}</p>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
                <span className="text-[11px] font-mono text-amber-400 uppercase">Deprecated</span>
                <p className="text-2xl font-bold font-mono text-amber-300 mt-1">{stats.deprecated}</p>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
                <span className="text-[11px] font-mono text-rose-400 uppercase">Vulnerable</span>
                <p className="text-2xl font-bold font-mono text-rose-300 mt-1">{stats.vulnerable}</p>
              </div>
            </div>

            {/* Top Risk Packages List */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6">
              <h2 className="text-sm font-semibold text-neutral-200 mb-4 flex items-center gap-2">
                <Shield className="h-4 w-4 text-cyan-400" />
                Priority Packages Overview
              </h2>

              <div className="divide-y divide-neutral-800">
                {topRisks.map((node) => (
                  <div
                    key={node.id}
                    onClick={() => {
                      setSelectedNode(node);
                      setActiveTab('packages');
                    }}
                    className="flex items-center justify-between py-3 hover:bg-neutral-800/30 px-2 rounded cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-neutral-100">{node.name}</span>
                        <span className="font-mono text-xs text-neutral-400">{node.installedVersion}</span>
                        {node.isDirect && (
                          <span className="rounded bg-cyan-950/80 border border-cyan-800/40 px-1.5 py-0.5 text-[10px] text-cyan-300">
                            direct
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Depth: {node.depth} • Dependents: {node.dependents.length} • Blast Radius: {node.blastRadius}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-sm text-neutral-200">
                        Risk Score: {node.riskScore}
                      </div>
                      <span className="text-xs text-cyan-400">View in Packages &rarr;</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'graph' && (
          <GraphView
            nodes={graph.nodes}
            edges={graph.edges}
            selectedNodeId={selectedNode?.id}
            onOpenDetailModal={(id) => {
              const found = graph.nodes.find((n) => n.id === id);
              if (found) setSelectedNode(found);
            }}
            onLoadSampleGraph={(sample) => {
              setCurrentScan({
                ...currentScan,
                graph: {
                  ...currentScan.graph,
                  nodes: sample.nodes,
                  edges: sample.edges,
                  totalNodeCount: sample.nodes.length,
                  directDepsCount: sample.nodes.filter((n) => n.isDirect).length,
                  transitiveDepsCount: sample.nodes.filter((n) => !n.isDirect).length,
                },
                stats: {
                  ...currentScan.stats,
                  total: sample.nodes.length,
                  upToDate: sample.nodes.filter((n) => n.status === 'up-to-date').length,
                  vulnerable: sample.nodes.filter((n) => n.status === 'vulnerable').length,
                  deprecated: sample.nodes.filter((n) => n.status === 'deprecated').length,
                },
              });
            }}
          />
        )}

        {activeTab === 'packages' && (
          <PackagesTable
            nodes={graph.nodes}
            selectedNodeId={selectedNode?.id}
            onSelectNode={(id) => {
              const found = graph.nodes.find((n) => n.id === id);
              if (found) setSelectedNode(found);
            }}
          />
        )}

        {activeTab === 'plan' && (
          <UpgradePlanView
            nodes={graph.nodes}
            onSelectNode={(id) => {
              const found = graph.nodes.find((n) => n.id === id);
              if (found) {
                setSelectedNode(found);
                setActiveTab('packages');
              }
            }}
          />
        )}
      </div>

      {/* Package Detail Modal */}
      {selectedNode && (
        <PackageDetailModal
          node={selectedNode}
          allNodes={graph.nodes}
          onClose={() => setSelectedNode(null)}
          onSelectNode={(id) => {
            const found = graph.nodes.find((n) => n.id === id);
            if (found) setSelectedNode(found);
          }}
        />
      )}
    </div>
  );
};
