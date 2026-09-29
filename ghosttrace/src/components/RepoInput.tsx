import React, { useState, useEffect, useRef } from 'react';
import { Search, FolderGit2, ArrowRight, CornerDownLeft, Sparkles, AlertCircle } from 'lucide-react';
import { parseGitHubRepoInput } from '../lib/validation';

interface RepoInputProps {
  onScan: (owner: string, repo: string, subpath: string) => void;
  isLoading?: boolean;
  onTryDemo?: () => void;
  initialValue?: string;
}

const EXAMPLE_REPOS = [
  { label: 'zustand', value: 'pmndrs/zustand', desc: 'Minimal state management' },
  { label: 'zod', value: 'colinhacks/zod', desc: 'TypeScript-first schema validation' },
  { label: 'express', value: 'expressjs/express', desc: 'Node.js web framework' },
  { label: 'trpc', value: 'trpc/trpc', subpath: 'packages/server', desc: 'End-to-end typesafe APIs' },
];

export const RepoInput: React.FC<RepoInputProps> = ({
  onScan,
  isLoading = false,
  onTryDemo,
  initialValue = '',
}) => {
  const [inputVal, setInputVal] = useState(initialValue);
  const [subpathVal, setSubpathVal] = useState('');
  const [showSubpath, setShowSubpath] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // "/" keyboard shortcut to focus input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is already typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const parseResult = parseGitHubRepoInput(inputVal, subpathVal);
    if (!parseResult.success || !parseResult.data) {
      setErrorMessage(parseResult.error || 'Please enter a valid GitHub repository');
      return;
    }

    onScan(parseResult.data.owner, parseResult.data.repo, parseResult.data.subpath);
  };

  const handleSelectExample = (value: string, subpath?: string) => {
    setInputVal(value);
    if (subpath) {
      setSubpathVal(subpath);
      setShowSubpath(true);
    } else {
      setSubpathVal('');
    }
    setErrorMessage(null);
    inputRef.current?.focus();
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative group">
          <div className="relative flex flex-col sm:flex-row items-stretch rounded-xl border border-neutral-800 bg-neutral-900/90 shadow-2xl backdrop-blur-xl transition-all duration-200 focus-within:border-cyan-500/80 focus-within:ring-2 focus-within:ring-cyan-500/20 group-hover:border-neutral-700">
            {/* Main Repo Input */}
            <div className="flex flex-1 items-center px-4 py-3 sm:py-3.5">
              <Search className="mr-3 h-5 w-5 shrink-0 text-neutral-400 group-focus-within:text-cyan-400" />
              <input
                ref={inputRef}
                id="repo-search-input"
                type="text"
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="github.com/owner/repo or owner/repo"
                disabled={isLoading}
                className="w-full bg-transparent font-mono text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none disabled:opacity-50"
                autoFocus
              />
              <kbd className="hidden sm:inline-flex items-center rounded border border-neutral-700 bg-neutral-800/80 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                /
              </kbd>
            </div>

            {/* Subpath Toggle / Input */}
            {showSubpath ? (
              <div className="flex items-center border-t sm:border-t-0 sm:border-l border-neutral-800 px-3 py-2 sm:py-0 bg-neutral-950/40">
                <FolderGit2 className="mr-2 h-4 w-4 text-neutral-400" />
                <input
                  id="subpath-input"
                  type="text"
                  value={subpathVal}
                  onChange={(e) => setSubpathVal(e.target.value)}
                  placeholder="subfolder (e.g. packages/core)"
                  disabled={isLoading}
                  className="w-44 bg-transparent font-mono text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none"
                />
              </div>
            ) : (
              <button
                type="button"
                id="toggle-subpath-btn"
                onClick={() => setShowSubpath(true)}
                className="flex items-center justify-center border-t sm:border-t-0 sm:border-l border-neutral-800/80 px-3 py-2 text-xs text-neutral-400 hover:text-cyan-400 transition-colors"
                title="Specify a monorepo subfolder"
              >
                <FolderGit2 className="mr-1.5 h-3.5 w-3.5" />
                <span className="text-[11px]">Monorepo?</span>
              </button>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 p-2 sm:p-2 border-t sm:border-t-0 sm:border-l border-neutral-800">
              <button
                type="submit"
                id="scan-submit-btn"
                disabled={isLoading || !inputVal.trim()}
                className="flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-xs font-semibold text-neutral-950 transition-all hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 shadow-md shadow-cyan-500/20 active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <span>Trace Graph</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div
            id="repo-input-error"
            className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300 animate-in fade-in duration-200"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Example chips & Demo button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 text-neutral-400">
            <span className="text-[11px] text-neutral-500">Quick examples:</span>
            {EXAMPLE_REPOS.map((ex) => (
              <button
                key={ex.value}
                id={`example-chip-${ex.label}`}
                type="button"
                onClick={() => handleSelectExample(ex.value, ex.subpath)}
                className="rounded-md border border-neutral-800 bg-neutral-900/60 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:border-cyan-500/40 hover:bg-neutral-800 hover:text-cyan-300"
              >
                {ex.value}
              </button>
            ))}
          </div>

          {onTryDemo && (
            <button
              type="button"
              id="try-demo-btn"
              onClick={onTryDemo}
              className="flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors py-1"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Explore Offline Demo Snapshot</span>
            </button>
          )}
        </div>

        <p className="text-[11px] text-neutral-500 text-center pt-1">
          Supports public repositories with a <code className="text-neutral-400 font-mono">package.json</code> manifest (npm, yarn, pnpm)
        </p>
      </form>
    </div>
  );
};
