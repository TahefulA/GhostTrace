import React, { useState } from 'react';
import {
  ListOrdered,
  ArrowRight,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Copy,
  Check,
  Terminal,
  ExternalLink,
} from 'lucide-react';
import { generateUpgradePlan } from '../lib/upgradePlan';
import type { GraphNode, UpgradePlanItem } from '../types';

interface UpgradePlanViewProps {
  nodes: GraphNode[];
  onSelectNode: (nodeId: string) => void;
}

export const UpgradePlanView: React.FC<UpgradePlanViewProps> = ({ nodes, onSelectNode }) => {
  const planItems = React.useMemo(() => generateUpgradePlan(nodes), [nodes]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const copySingleCommand = (cmd: string, index: number) => {
    navigator.clipboard.writeText(cmd);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAllCommands = () => {
    const script = planItems.map((item) => item.command).join(' && \\\n');
    navigator.clipboard.writeText(script);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  if (planItems.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-8 text-center min-h-[300px] flex flex-col items-center justify-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-3" />
        <h3 className="text-base font-semibold text-neutral-200">No Action Required</h3>
        <p className="text-xs text-neutral-400 max-w-sm mt-1">
          All dependencies are current and zero security vulnerabilities were detected in this snapshot.
        </p>
      </div>
    );
  }

  const highRiskCount = planItems.filter((p) => p.breakingChangeRisk === 'HIGH').length;

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-cyan-400" />
            <span>Deterministic Upgrade Sequence ({planItems.length} steps)</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Ordered via reverse topological sort (leaf dependencies first) to avoid upstream version collision.
            {highRiskCount > 0 && (
              <span className="text-amber-400 ml-1 font-medium">
                ({highRiskCount} step{highRiskCount > 1 ? 's' : ''} carry high breaking change risk).
              </span>
            )}
          </p>
        </div>

        <button
          onClick={copyAllCommands}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-cyan-800 bg-cyan-950/60 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-900/80 transition-colors shrink-0"
        >
          {copiedAll ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Terminal className="h-3.5 w-3.5" />}
          <span>{copiedAll ? 'Copied Batch Script' : 'Copy Full Command Sequence'}</span>
        </button>
      </div>

      {/* Step Sequence List */}
      <div className="space-y-3">
        {planItems.map((item, idx) => {
          const isCopied = copiedIndex === idx;

          return (
            <div
              key={item.packageId}
              className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4 hover:border-neutral-700/80 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  {/* Step Number Badge */}
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-800 border border-neutral-700 text-xs font-mono font-bold text-neutral-200">
                    {item.step}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => onSelectNode(item.packageId)}
                        className="font-mono text-sm font-bold text-neutral-100 hover:text-cyan-300 transition-colors"
                      >
                        {item.packageName}
                      </button>

                      <div className="flex items-center gap-1 font-mono text-xs text-neutral-400">
                        <span>v{item.currentVersion}</span>
                        <ArrowRight className="h-3 w-3 text-neutral-500" />
                        <span className="text-emerald-400 font-semibold">v{item.targetVersion}</span>
                      </div>

                      {item.isDirect ? (
                        <span className="rounded bg-cyan-950 px-1.5 py-0.2 text-[10px] text-cyan-300 border border-cyan-800/40">
                          direct
                        </span>
                      ) : (
                        <span className="rounded bg-neutral-800 px-1.5 py-0.2 text-[10px] text-neutral-400">
                          transitive
                        </span>
                      )}

                      {/* Risk Badge */}
                      <span
                        className={`rounded px-1.5 py-0.2 text-[10px] font-semibold uppercase tracking-wider ${
                          item.breakingChangeRisk === 'HIGH'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                            : item.breakingChangeRisk === 'MEDIUM'
                            ? 'bg-yellow-950 text-yellow-300 border border-yellow-800/60'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                        }`}
                      >
                        {item.breakingChangeRisk} RISK
                      </span>
                    </div>

                    <p className="mt-1.5 text-xs text-neutral-300 leading-normal">
                      {item.rationale}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-400 font-mono">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-neutral-500" />
                        <span>Effort: ~{item.estimatedEffort}</span>
                      </div>
                      <div>Upstream Dependents: {item.dependentsCount}</div>
                      <div>Risk Score: {item.riskScore}</div>
                    </div>
                  </div>
                </div>

                {/* Command & Quick Copy */}
                <div className="flex md:flex-col items-end justify-between md:justify-center gap-2 pl-9 md:pl-0">
                  <button
                    onClick={() => copySingleCommand(item.command, idx)}
                    className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-mono text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors shrink-0"
                    title="Copy npm command"
                  >
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-neutral-400" />
                    )}
                    <span>{isCopied ? 'Copied' : item.command}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
