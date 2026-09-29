import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  X,
  Sparkles,
  ArrowRight,
  Info,
  KeyRound,
  FileQuestion,
} from 'lucide-react';
import { useScanStore } from '../store/scanStore';
import type { ScanStepName } from '../types';

interface StepDef {
  key: ScanStepName;
  label: string;
}

const STEPS: StepDef[] = [
  { key: 'fetching_metadata', label: 'Repository metadata & commit SHA' },
  { key: 'fetching_files', label: 'Fetching package.json & lockfile' },
  { key: 'building_graph', label: 'Building dependency graph & hierarchy' },
  { key: 'checking_npm', label: 'Checking npm registry (versions & deprecations)' },
  { key: 'checking_vulnerabilities', label: 'Querying OSV.dev vulnerabilities' },
  { key: 'scoring_risk', label: 'Deterministic risk scoring & layout' },
];

const SUGGESTED_REPOS = [
  { name: 'pmndrs/zustand', desc: 'Fast, minimal state management' },
  { name: 'colinhacks/zod', desc: 'TypeScript-first schema validation' },
  { name: 'expressjs/express', desc: 'Fast Node.js web framework' },
];

interface ScanProgressModalProps {
  onSelectExample?: (repoFullName: string, subpath?: string) => void;
}

export const ScanProgressModal: React.FC<ScanProgressModalProps> = ({ onSelectExample }) => {
  const navigate = useNavigate();
  const { isScanning, progress, cancelScan, scanError, clearScanError } = useScanStore();

  if (!isScanning && !scanError) return null;

  // Determine active step index
  const stepIndexMap: Record<ScanStepName, number> = {
    idle: -1,
    fetching_metadata: 0,
    fetching_files: 1,
    parsing_lockfile: 1,
    building_graph: 2,
    enriching_npm: 3,
    checking_npm: 3,
    checking_vulnerabilities: 4,
    scoring_risk: 5,
    generating_plan: 5,
    completed: 6,
    error: -1,
  };

  const currentIndex = stepIndexMap[progress.step] ?? 0;
  const isMissingPackageJson =
    Boolean(scanError) &&
    (scanError!.toLowerCase().includes('package.json') ||
      scanError!.toLowerCase().includes('manifest') ||
      scanError!.toLowerCase().includes('non-javascript'));
  const isRateLimit =
    Boolean(scanError) &&
    (scanError!.toLowerCase().includes('rate limit') ||
      scanError!.toLowerCase().includes('60 requests') ||
      scanError!.toLowerCase().includes('403'));

  return (
    <div
      id="scan-progress-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        // Allow clicking backdrop to dismiss error state
        if (scanError && !isScanning && e.target === e.currentTarget) {
          clearScanError();
        }
      }}
    >
      <div
        id="scan-progress-modal"
        className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900/95 p-6 shadow-2xl backdrop-blur-xl transition-all"
      >
        {/* Error State View */}
        {scanError ? (
          <div className="space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-950/40 text-rose-400">
                  {isMissingPackageJson ? (
                    <FileQuestion className="h-5 w-5" />
                  ) : isRateLimit ? (
                    <KeyRound className="h-5 w-5" />
                  ) : (
                    <AlertCircle className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-neutral-100">
                    {isMissingPackageJson
                      ? 'No package.json Detected'
                      : isRateLimit
                      ? 'GitHub Rate Limit Reached'
                      : 'Scan Could Not Complete'}
                  </h2>
                  <p className="text-xs text-neutral-400">
                    {isMissingPackageJson
                      ? 'Repository is not a JavaScript/Node.js project'
                      : isRateLimit
                      ? 'GitHub API 60 req/hr threshold'
                      : 'Inspection failed'}
                  </p>
                </div>
              </div>
              <button
                id="close-error-modal-btn"
                onClick={clearScanError}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
                title="Dismiss"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error Message Box */}
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-xs text-rose-200 leading-relaxed space-y-2">
              <p className="font-medium text-rose-300">{scanError}</p>
            </div>

            {/* Contextual guidance */}
            {isMissingPackageJson && (
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 text-xs text-cyan-200 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-cyan-300">
                  <Info className="h-4 w-4 shrink-0 text-cyan-400" />
                  <span>Why did this occur?</span>
                </div>
                <p className="text-neutral-300 text-[11.5px] leading-relaxed">
                  GhostTrace inspects and visualizes <strong>JavaScript &amp; TypeScript dependency graphs</strong> using package manifests (<code className="rounded bg-neutral-800 px-1 py-0.5 text-cyan-300">package.json</code> and <code className="rounded bg-neutral-800 px-1 py-0.5 text-cyan-300">package-lock.json</code>).
                </p>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  Repositories such as curated link collections (e.g. awesome-lists) or markdown documentation do not have Node.js package dependencies to trace.
                </p>
              </div>
            )}

            {/* Suggested repositories to try */}
            {isMissingPackageJson && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                  Try one of these JavaScript projects instead:
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {SUGGESTED_REPOS.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => {
                        clearScanError();
                        onSelectExample?.(item.name);
                      }}
                      className="flex flex-col items-start rounded-lg border border-neutral-800 bg-neutral-800/40 p-2.5 text-left transition-all hover:border-cyan-500/50 hover:bg-neutral-800 hover:text-cyan-300 active:scale-[0.98]"
                    >
                      <span className="font-mono text-xs font-semibold text-neutral-200">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-neutral-400 mt-0.5 truncate w-full">
                        {item.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-neutral-800">
              <button
                type="button"
                id="modal-explore-demo-btn"
                onClick={() => {
                  clearScanError();
                  navigate('/demo');
                }}
                className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-cyan-300 transition-colors w-full sm:w-auto justify-center py-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                <span>Explore Offline Demo Snapshot</span>
              </button>

              <button
                type="button"
                id="modal-try-another-btn"
                onClick={clearScanError}
                className="flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-neutral-950 transition-all hover:bg-cyan-400 active:scale-[0.98] w-full sm:w-auto shadow-md shadow-cyan-500/20"
              >
                <span>Try Another Repository</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Active Scanning View */
          <>
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                  Scanning Repository
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Live inspection directly from browser to GitHub, npm, &amp; OSV
                </p>
              </div>
              <button
                id="cancel-scan-btn"
                onClick={cancelScan}
                className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-rose-300 transition-colors"
              >
                Cancel Scan
              </button>
            </div>

            {/* Progress Bar */}
            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-cyan-400 font-medium truncate pr-2">
                  {progress.message || 'Processing...'}
                </span>
                <span className="text-neutral-400 shrink-0">{Math.round(progress.percent)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-950 border border-neutral-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(5, progress.percent)}%` }}
                />
              </div>
              {progress.detail && (
                <p className="text-[11px] font-mono text-neutral-500 truncate">{progress.detail}</p>
              )}
            </div>

            {/* Step List */}
            <div className="mt-6 space-y-2.5">
              {STEPS.map((step, idx) => {
                const isCompleted = currentIndex > idx;
                const isCurrent = currentIndex === idx;

                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs transition-colors ${
                      isCurrent
                        ? 'border-cyan-500/40 bg-cyan-950/20 text-cyan-200'
                        : isCompleted
                        ? 'border-neutral-800/80 bg-neutral-950/40 text-neutral-300'
                        : 'border-transparent text-neutral-500'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : isCurrent ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cyan-400" />
                    ) : (
                      <div className="h-4 w-4 shrink-0 rounded-full border border-neutral-700" />
                    )}
                    <span className="font-medium">{step.label}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
