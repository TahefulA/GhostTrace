import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch,
  Shield,
  Layers,
  ArrowUpRight,
  Clock,
  Trash2,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { RepoInput } from '../components/RepoInput';
import { ScanProgressModal } from '../components/ScanProgressModal';
import { useScanStore } from '../store/scanStore';
import { runScanPipeline } from '../lib/pipeline';
import { getRecentScans, deleteScanFromHistory } from '../lib/storage';
import type { ScanResult } from '../types';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    isScanning,
    startScanProgress,
    updateProgress,
    finishScan,
    failScan,
    setRateLimit,
    githubToken,
    setCurrentScan,
  } = useScanStore();

  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadScans();
  }, []);

  const loadScans = async () => {
    const scans = await getRecentScans();
    setRecentScans(scans);
  };

  const handleStartScan = async (owner: string, repo: string, subpath: string) => {
    setLoadError(null);
    const abortController = new AbortController();
    startScanProgress(abortController);

    try {
      const scanResult = await runScanPipeline({
        repo: { owner, repo, subpath },
        token: githubToken,
        signal: abortController.signal,
        onProgress: (prog) => updateProgress(prog),
      });

      // Update rate limit in store if present
      if (scanResult.meta.rateLimit) {
        setRateLimit(scanResult.meta.rateLimit);
      }

      finishScan(scanResult);
      navigate(`/scan/${scanResult.id}`);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'Scan was cancelled') {
        return;
      }
      const message = err.message || 'An unexpected error occurred during scan.';
      failScan(message);
      setLoadError(message);
    }
  };

  const handleSelectExampleAndScan = (repoFullName: string, subpath = '') => {
    const parts = repoFullName.split('/');
    if (parts.length >= 2) {
      handleStartScan(parts[0], parts[1], subpath);
    }
  };

  const handleDeleteRecent = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteScanFromHistory(id);
    await loadScans();
  };

  const handleSelectRecent = (scan: ScanResult) => {
    setCurrentScan(scan);
    navigate(`/scan/${scan.id}`);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8">
      {/* Scan Progress Modal */}
      <ScanProgressModal onSelectExample={handleSelectExampleAndScan} />

      <main className="mx-auto max-w-5xl w-full flex-1 flex flex-col items-center justify-center text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1 text-xs text-cyan-300 backdrop-blur-md mb-6 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
          <Terminal className="h-3.5 w-3.5" />
          <span>Real-time Public Dependency Analyzer</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-100 max-w-3xl leading-[1.15]">
          Inspect your JavaScript dependencies in <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">3D</span>.
        </h1>

        <p className="mt-4 text-base sm:text-lg text-neutral-400 max-w-2xl leading-relaxed">
          GhostTrace extracts lockfiles directly from GitHub, computes deterministic upgrade risk scores, maps transitive blast radius, and prepares a step-by-step upgrade plan.
        </p>

        {/* Main Input Component */}
        <div className="mt-8 w-full">
          <RepoInput
            onScan={handleStartScan}
            isLoading={isScanning}
            onTryDemo={() => navigate('/demo')}
          />
        </div>

        {/* Error Alert if pipeline failed */}
        {loadError && (
          <div className="mt-6 w-full max-w-3xl text-left rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-xs text-rose-200">
            <p className="font-semibold text-rose-300">Scan Failed</p>
            <p className="mt-1">{loadError}</p>
          </div>
        )}

        {/* Feature Pillars */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl text-left">
          <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-5 backdrop-blur-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-950/60 text-cyan-400 mb-3 border border-cyan-800/40">
              <GitBranch className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-200">Live Lockfile Extraction</h3>
            <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
              Reads package.json and npm lockfile v2/v3 without cloning repos. Deduplicates nodes and caps safely.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-5 backdrop-blur-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-950/60 text-emerald-400 mb-3 border border-emerald-800/40">
              <Shield className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-200">Deterministic Risk Scoring</h3>
            <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
              Synthesizes semver major gaps, OSV.dev CVEs, deprecation warnings, package staleness, and dependency blast radius.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-5 backdrop-blur-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-950/60 text-indigo-400 mb-3 border border-indigo-800/40">
              <Layers className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-200">3D Force Visualization</h3>
            <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
              Interactive 3D dependency universe powered by React Three Fiber with blast-radius node isolation and fallback tables.
            </p>
          </div>
        </div>

        {/* Recent Scans (IndexedDB) */}
        {recentScans.length > 0 && (
          <div className="mt-12 w-full max-w-4xl text-left">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                Recent Scans in Local Storage
              </h2>
              <span className="text-[11px] text-neutral-500">IndexedDB Persisted</span>
            </div>

            <div className="mt-3 divide-y divide-neutral-800/60 rounded-xl border border-neutral-800/80 bg-neutral-900/30 overflow-hidden">
              {recentScans.map((scan) => (
                <div
                  key={scan.id}
                  onClick={() => handleSelectRecent(scan)}
                  className="group flex items-center justify-between p-3.5 hover:bg-neutral-800/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-cyan-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-200 group-hover:text-cyan-300 transition-colors">
                          {scan.repo.owner}/{scan.repo.repo}
                        </span>
                        {scan.repo.subpath && (
                          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400">
                            {scan.repo.subpath}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-neutral-500 mt-0.5 font-mono">
                        <span>{scan.graph.nodes.length} packages</span>
                        <span>•</span>
                        <span>{new Date(scan.timestamp).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{scan.meta.commitSha.slice(0, 7)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleDeleteRecent(e, scan.id)}
                      className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 rounded transition-colors"
                      title="Remove from recent history"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <ChevronRight className="h-4 w-4 text-neutral-600 group-hover:text-neutral-300 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="mt-16 text-center text-xs text-neutral-600 border-t border-neutral-900 pt-6">
        <p>GhostTrace • Public JavaScript/TypeScript Dependency Risk Engine</p>
      </footer>
    </div>
  );
};
