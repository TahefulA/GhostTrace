import React from 'react';
import {
  X,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  Clock,
  GitBranch,
  Layers,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import type { GraphNode } from '../types';

interface PackageDetailModalProps {
  node: GraphNode | null;
  allNodes: GraphNode[];
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
}

export const PackageDetailModal: React.FC<PackageDetailModalProps> = ({
  node,
  allNodes,
  onClose,
  onSelectNode,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!node) return null;

  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
  const targetVersion = node.enrichment?.latestVersion || node.installedVersion;
  const installCmd = node.isDev
    ? `npm install -D ${node.name}@${targetVersion}`
    : `npm install ${node.name}@${targetVersion}`;

  const copyCommand = () => {
    navigator.clipboard.writeText(installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl p-6 text-neutral-200 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-neutral-800 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold font-mono text-white">{node.name}</h2>
              <span className="font-mono text-xs text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded">
                v{node.installedVersion}
              </span>
              {node.isDirect && (
                <span className="text-[10px] font-medium bg-cyan-950 text-cyan-300 border border-cyan-800/60 px-2 py-0.5 rounded">
                  {node.isDev ? 'devDependency' : 'dependency'}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Depth {node.depth} in dependency tree • Upstream blast radius: {node.blastRadius}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 pt-4 text-xs">
          {/* Risk Score & Breakdown */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-neutral-300">Deterministic Risk Score</span>
              <span
                className={`font-mono font-bold text-lg ${
                  node.riskScore > 60
                    ? 'text-rose-400'
                    : node.riskScore > 30
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {node.riskScore} / 100
              </span>
            </div>

            {node.riskBreakdown && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-neutral-800 text-[11px] font-mono">
                <div>
                  <span className="text-neutral-500 block">Vulns</span>
                  <span className="font-semibold text-rose-400">+{node.riskBreakdown.vulnerabilityScore}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Version Gap</span>
                  <span className="font-semibold text-orange-400">+{node.riskBreakdown.versionGapScore}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Deprecated</span>
                  <span className="font-semibold text-amber-400">+{node.riskBreakdown.deprecationScore}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Blast Radius</span>
                  <span className="font-semibold text-yellow-400">+{node.riskBreakdown.blastRadiusScore}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Staleness</span>
                  <span className="font-semibold text-neutral-300">+{node.riskBreakdown.stalenessScore}</span>
                </div>
              </div>
            )}
          </div>

          {/* Deprecation Warning if any */}
          {node.enrichment?.isDeprecated && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 text-amber-300">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-200">Deprecated by Maintainer</h4>
                  <p className="mt-1 text-neutral-300 text-xs">
                    {node.enrichment.deprecationMessage || 'This package has been marked as deprecated on npm.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Known Security Vulnerabilities */}
          {node.enrichment?.vulnerabilities && node.enrichment.vulnerabilities.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-neutral-200 flex items-center gap-1.5 text-xs">
                <ShieldAlert className="h-4 w-4 text-rose-400" />
                <span>Security Advisories ({node.enrichment.vulnerabilities.length})</span>
              </h3>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {node.enrichment.vulnerabilities.map((vuln) => (
                  <div
                    key={vuln.id}
                    className="rounded-lg border border-rose-900/40 bg-rose-950/20 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-rose-400">{vuln.id}</span>
                        <span className="rounded bg-rose-900/60 px-1.5 py-0.5 text-[10px] font-bold text-rose-200">
                          {vuln.severity}
                        </span>
                      </div>
                      {vuln.referenceUrl && (
                        <a
                          href={vuln.referenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-neutral-400 hover:text-cyan-400 flex items-center gap-1"
                        >
                          <span>Advisory</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <p className="mt-1.5 text-neutral-300">{vuln.summary}</p>
                    {vuln.fixedIn && vuln.fixedIn.length > 0 && (
                      <p className="mt-1 text-[11px] text-emerald-400 font-mono">
                        Fixed in: {vuln.fixedIn.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata & Quick Links */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
              <span className="text-neutral-500 block mb-1">Installed vs Latest</span>
              <div className="font-mono">
                <span className="text-neutral-300">{node.installedVersion}</span>
                <span className="text-neutral-500 mx-2">&rarr;</span>
                <span className="text-cyan-400 font-semibold">{node.enrichment?.latestVersion || 'Unknown'}</span>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
              <span className="text-neutral-500 block mb-1">Last Published</span>
              <div className="text-neutral-300 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-neutral-500" />
                <span>
                  {node.enrichment?.daysSinceLastPublish !== undefined
                    ? `${node.enrichment.daysSinceLastPublish} days ago`
                    : 'Unknown'}
                </span>
              </div>
            </div>
          </div>

          {/* Dependents & Dependencies */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Dependents (Who uses this) */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
              <h4 className="font-semibold text-neutral-300 mb-2 flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-cyan-400" />
                <span>Used by ({node.dependents.length})</span>
              </h4>
              <div className="max-h-32 overflow-y-auto space-y-1 font-mono text-[11px]">
                {node.dependents.length === 0 ? (
                  <span className="text-neutral-500 italic">Root package / no dependents</span>
                ) : (
                  node.dependents.map((depId) => {
                    const depNode = nodeMap.get(depId);
                    return (
                      <button
                        key={depId}
                        onClick={() => onSelectNode(depId)}
                        className="block w-full text-left text-neutral-400 hover:text-cyan-300 truncate"
                      >
                        &larr; {depNode ? depNode.name : depId}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Direct Dependencies */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
              <h4 className="font-semibold text-neutral-300 mb-2 flex items-center gap-1">
                <GitBranch className="h-3.5 w-3.5 text-emerald-400" />
                <span>Requires ({node.dependencies.length})</span>
              </h4>
              <div className="max-h-32 overflow-y-auto space-y-1 font-mono text-[11px]">
                {node.dependencies.length === 0 ? (
                  <span className="text-neutral-500 italic">No dependencies</span>
                ) : (
                  node.dependencies.map((depId) => {
                    const depNode = nodeMap.get(depId);
                    return (
                      <button
                        key={depId}
                        onClick={() => onSelectNode(depId)}
                        className="block w-full text-left text-neutral-400 hover:text-emerald-300 truncate"
                      >
                        &rarr; {depNode ? depNode.name : depId}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Quick Upgrade Command */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-neutral-400 text-[11px]">Install / Upgrade Command:</span>
              <button
                onClick={copyCommand}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <code className="block font-mono text-neutral-200 text-xs bg-neutral-900 px-3 py-2 rounded-lg border border-neutral-800">
              {installCmd}
            </code>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-6 flex items-center justify-between border-t border-neutral-800 pt-4">
          <a
            href={`https://www.npmjs.com/package/${node.name}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-200 text-xs"
          >
            <span>View on npmjs.com</span>
            <ExternalLink className="h-3 w-3" />
          </a>

          <button
            onClick={onClose}
            className="rounded-lg bg-neutral-800 px-4 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
