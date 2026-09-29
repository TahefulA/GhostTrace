import React, { useState } from 'react';
import { Key, X, ShieldCheck, ExternalLink, AlertTriangle } from 'lucide-react';
import { useScanStore } from '../store/scanStore';

interface TokenModalProps {
  onClose: () => void;
}

export const TokenModal: React.FC<TokenModalProps> = ({ onClose }) => {
  const { githubToken, setGithubToken, rateLimit } = useScanStore();
  const [tokenInput, setTokenInput] = useState(githubToken);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setGithubToken(tokenInput.trim());
    setFeedback('Token saved to session memory.');
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleClear = () => {
    setTokenInput('');
    setGithubToken('');
    setFeedback('Token cleared from memory.');
  };

  return (
    <div
      id="token-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="token-modal"
        className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-950/60 text-cyan-400">
              <Key className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">
                GitHub Personal Access Token
              </h2>
              <p className="text-xs text-neutral-400">
                Optional: Bypass the 60 requests/hour limit
              </p>
            </div>
          </div>
          <button
            id="close-token-modal-btn"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="my-4 space-y-3 text-xs text-neutral-300">
          <div className="rounded-lg border border-cyan-900/40 bg-cyan-950/20 p-3 text-cyan-300">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
              <div>
                <p className="font-medium">Strictly In-Memory Storage</p>
                <p className="mt-0.5 text-cyan-200/80">
                  This token is stored purely in volatile React memory. It is never persisted in IndexedDB, localStorage, cookies, or sent to any telemetry server.
                </p>
              </div>
            </div>
          </div>

          {rateLimit && (
            <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-xs">
              <span className="text-neutral-400">Current Rate Limit Remaining:</span>
              <span className="font-mono font-semibold text-neutral-200">
                {rateLimit.remaining} / {rateLimit.limit}
              </span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-3 pt-1">
            <div>
              <label
                htmlFor="github-token-input"
                className="mb-1 block text-xs font-medium text-neutral-300"
              >
                Personal Access Token (classic or fine-grained with public_repo scope):
              </label>
              <input
                id="github-token-input"
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-xs text-neutral-100 placeholder-neutral-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {feedback && (
              <p className="text-xs text-emerald-400">{feedback}</p>
            )}

            <div className="flex items-center justify-between pt-2">
              {githubToken ? (
                <button
                  type="button"
                  id="clear-token-btn"
                  onClick={handleClear}
                  className="rounded-lg px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/30"
                >
                  Clear Token
                </button>
              ) : (
                <div />
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  id="cancel-token-btn"
                  onClick={onClose}
                  className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="save-token-btn"
                  className="rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-cyan-500"
                >
                  Apply Token
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
