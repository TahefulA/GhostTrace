import React from 'react';
import { Shield, Database, GitGraph, AlertTriangle, CheckCircle2, Cpu, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AboutPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-cyan-400 transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Home</span>
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-100">
          How GhostTrace Works
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Architecture, risk scoring mathematical formula, data sources, and system boundaries.
        </p>
      </div>

      <div className="space-y-10 text-neutral-300 text-sm leading-relaxed">
        {/* Unofficial disclaimer banner */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300">Disclaimer &amp; Advisory Notice</p>
              <p className="mt-1 text-amber-200/90 leading-normal">
                GhostTrace is an independent open diagnostic tool. Upgrade effort hours, breaking change risk scores, and prioritization guidance are automated approximations intended to assist development teams, not guaranteed guarantees of software compatibility. Always test upgrades in staging or CI before production deployment.
              </p>
            </div>
          </div>
        </div>

        {/* Section 1: Real-Time Direct Data Pipeline */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-base font-semibold text-neutral-100">
            <Database className="h-4 w-4 text-cyan-400" />
            <h2>Live Data Sources (Direct from Browser)</h2>
          </div>
          <p className="text-neutral-400 text-xs sm:text-sm">
            GhostTrace operates entirely client-side without caching private repository source code. Data is queried in real time across three authoritative sources:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
              <h3 className="text-xs font-mono font-bold text-cyan-300">GitHub REST &amp; Raw</h3>
              <p className="mt-1 text-xs text-neutral-400">
                1 API call retrieves repository metadata and default branch commit SHA. Lockfiles and manifests are retrieved from raw content URLs without consuming REST rate limit quota.
              </p>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
              <h3 className="text-xs font-mono font-bold text-emerald-300">npm Registry</h3>
              <p className="mt-1 text-xs text-neutral-400">
                Direct queries to registry.npmjs.org determine the latest published semver release, official deprecation notices, and package publish timestamps.
              </p>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
              <h3 className="text-xs font-mono font-bold text-indigo-300">OSV.dev Batch API</h3>
              <p className="mt-1 text-xs text-neutral-400">
                Queries the Open Source Vulnerabilities database using batch requests to cross-reference package names and versions against public CVE and GHSA advisories.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Deterministic Risk Formula */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-base font-semibold text-neutral-100">
            <Shield className="h-4 w-4 text-cyan-400" />
            <h2>Deterministic Risk Formula (0 – 100)</h2>
          </div>
          <p className="text-neutral-400 text-xs sm:text-sm">
            The risk score is calculated deterministically on every node using five explicit factors:
          </p>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 font-mono text-xs space-y-2 text-neutral-300">
            <div className="flex justify-between border-b border-neutral-800 pb-1.5 text-neutral-400">
              <span>Factor</span>
              <span>Maximum Weight</span>
            </div>
            <div className="flex justify-between">
              <span>1. Vulnerability Severity (Critical: 35, High: 25, Mod: 15, Low: 8)</span>
              <span className="text-cyan-400 font-bold">35 pts</span>
            </div>
            <div className="flex justify-between">
              <span>2. Major Version Gap (Number of major releases behind, e.g. v4 to v6)</span>
              <span className="text-cyan-400 font-bold">25 pts</span>
            </div>
            <div className="flex justify-between">
              <span>3. Package Deprecation (Active deprecation notice from maintainer)</span>
              <span className="text-cyan-400 font-bold">20 pts</span>
            </div>
            <div className="flex justify-between">
              <span>4. Blast Radius (Count of dependents that rely on this package)</span>
              <span className="text-cyan-400 font-bold">10 pts</span>
            </div>
            <div className="flex justify-between">
              <span>5. Staleness (Days since last release: &gt;2 yrs: 10, &gt;1 yr: 5)</span>
              <span className="text-cyan-400 font-bold">10 pts</span>
            </div>
            <div className="flex justify-between border-t border-neutral-800 pt-1.5 font-bold text-neutral-100">
              <span>Total Score (Clamped)</span>
              <span className="text-emerald-400">0 – 100</span>
            </div>
          </div>
        </section>

        {/* Section 3: Topological Upgrade Ordering */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-base font-semibold text-neutral-100">
            <GitGraph className="h-4 w-4 text-cyan-400" />
            <h2>Topological Upgrade Ordering</h2>
          </div>
          <p className="text-neutral-400 text-xs sm:text-sm">
            Upgrading high-level dependencies before lower-level shared dependencies can trigger version conflicts and runtime breakage. GhostTrace traverses the dependency DAG using reverse Kahn's topological sort with Tarjan cycle protection to guarantee leaf dependencies are scheduled for upgrades before upstream consumer packages.
          </p>
        </section>

        {/* Section 4: Known Boundaries & Limitations */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-base font-semibold text-neutral-100">
            <Cpu className="h-4 w-4 text-cyan-400" />
            <h2>Known System Boundaries</h2>
          </div>
          <ul className="list-disc list-inside space-y-1.5 text-xs text-neutral-400">
            <li><strong className="text-neutral-300">JavaScript/TypeScript only:</strong> Manifests must be standard npm <code className="text-cyan-300 font-mono">package.json</code> and <code className="text-cyan-300 font-mono">package-lock.json</code> files.</li>
            <li><strong className="text-neutral-300">Public repositories:</strong> Private repos without authenticated tokens cannot be accessed. Users can supply an in-memory PAT to bypass access or unauthenticated 60 req/hr rate limits.</li>
            <li><strong className="text-neutral-300">Lockfile v2/v3 support:</strong> Full transitive dependency resolution requires modern npm lockfiles (v2 or v3). v1 lockfiles fall back to direct dependencies with a notification banner.</li>
            <li><strong className="text-neutral-300">Graph node capping:</strong> Extremely large repositories with &gt;600 dependencies are truncated to direct and shallow depth dependencies to preserve 60fps in the 3D viewport.</li>
          </ul>
        </section>
      </div>
    </div>
  );
};
