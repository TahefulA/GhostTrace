import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, Key, Sparkles, HelpCircle, Activity } from 'lucide-react';
import { useScanStore } from '../store/scanStore';
import { TokenModal } from './TokenModal';

export const Header: React.FC = () => {
  const [showTokenModal, setShowTokenModal] = useState(false);
  const { rateLimit, githubToken } = useScanStore();
  const navigate = useNavigate();

  const remaining = rateLimit?.remaining;
  const isLimited = remaining !== undefined && remaining <= 5;
  const hasCustomToken = Boolean(githubToken);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link
            to="/"
            id="header-logo"
            className="group flex items-center gap-3 transition-opacity hover:opacity-90"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all group-hover:border-cyan-400/60 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-neutral-100">
                  Ghost<span className="text-cyan-400">Trace</span>
                </span>
                <span className="rounded border border-cyan-500/30 bg-cyan-950/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                  v1.0
                </span>
              </div>
              <p className="hidden text-[11px] text-neutral-400 sm:block">
                Dependency Risk &amp; 3D Graph
              </p>
            </div>
          </Link>

          {/* Actions & Links */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Rate limit status pill */}
            <button
              id="header-ratelimit-btn"
              onClick={() => setShowTokenModal(true)}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                isLimited
                  ? 'border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40'
                  : hasCustomToken
                  ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/40'
                  : 'border-neutral-800 bg-neutral-900/80 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800'
              }`}
              title="GitHub REST API Rate Limit (60 req/hr unauthenticated). Click to set in-memory PAT."
            >
              <Key className="h-3.5 w-3.5 opacity-70" />
              <span className="font-mono">
                {remaining !== undefined ? `${remaining}/60 API` : 'API: 60/hr'}
              </span>
              {hasCustomToken && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              )}
            </button>

            {/* Demo link */}
            <button
              id="header-demo-btn"
              onClick={() => navigate('/demo')}
              className="hidden items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-950/20 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:border-cyan-400 hover:bg-cyan-950/40 sm:flex"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Demo Snapshot</span>
            </button>

            {/* About link */}
            <Link
              to="/about"
              id="header-about-link"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-200"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">About &amp; Scoring</span>
            </Link>
          </div>
        </div>
      </header>

      {showTokenModal && (
        <TokenModal onClose={() => setShowTokenModal(false)} />
      )}
    </>
  );
};
