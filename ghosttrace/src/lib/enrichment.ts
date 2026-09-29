import { get, set } from 'idb-keyval';
import semver from 'semver';
import type {
  PackageEnrichment,
  VulnerabilityAdvisory,
  GraphNode,
  PackageHealthStatus,
  RiskScoreBreakdown,
} from '../types';

const ENRICHMENT_CACHE_PREFIX = 'ghosttrace_enrich_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours TTL

interface CachedEnrichment {
  enrichment: PackageEnrichment;
  cachedAt: number;
}

/**
 * Normalizes npm package names for the registry URL (handles @scoped/packages).
 */
export function getNpmRegistryUrl(packageName: string): string {
  if (packageName.startsWith('@')) {
    // Encodes @scope/pkg to @scope%2Fpkg
    return `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
  }
  return `https://registry.npmjs.org/${packageName}`;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 4000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Fetches npm metadata for a single package with exponential backoff.
 * Extracts latest version, deprecation status & message, and last publish date.
 */
export async function fetchNpmPackageMetadata(
  packageName: string,
  retries = 1
): Promise<Partial<PackageEnrichment>> {
  const url = getNpmRegistryUrl(packageName);
  let attempt = 0;
  let delay = 200;

  while (attempt <= retries) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          headers: {
            Accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*',
          },
        },
        3500
      );

      if (res.status === 404) {
        // Private or unpublished package
        return {};
      }

      if (!res.ok) {
        throw new Error(`npm registry returned status ${res.status}`);
      }

      const data = await res.json();
      const distTags = data['dist-tags'] || {};
      const latestVersion = distTags.latest as string | undefined;

      // Deprecation check: check latest version object or top-level versions
      let isDeprecated = false;
      let deprecationMessage: string | undefined;

      if (latestVersion && data.versions?.[latestVersion]?.deprecated) {
        isDeprecated = true;
        deprecationMessage = data.versions[latestVersion].deprecated;
      } else if (data.deprecated) {
        isDeprecated = true;
        deprecationMessage = typeof data.deprecated === 'string' ? data.deprecated : 'Package is deprecated';
      }

      // Check publish time
      let lastPublished: string | undefined;
      let daysSinceLastPublish: number | undefined;

      if (data.time) {
        const timeKey = latestVersion ? latestVersion : 'modified';
        lastPublished = data.time[timeKey] || data.time.modified;
        if (lastPublished) {
          const publishedDate = new Date(lastPublished);
          if (!isNaN(publishedDate.getTime())) {
            daysSinceLastPublish = Math.max(
              0,
              Math.floor((Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24))
            );
          }
        }
      }

      return {
        latestVersion,
        isDeprecated,
        deprecationMessage,
        lastPublished,
        daysSinceLastPublish,
      };
    } catch (err) {
      attempt++;
      if (attempt > retries) {
        // Individual package failure should never break the whole scan
        return {};
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }

  return {};
}

/**
 * Queries the OSV.dev batch API (POST https://api.osv.dev/v1/querybatch)
 * Maps package name + version pairs to vulnerability advisories.
 */
export async function fetchOSVVulnerabilitiesBatch(
  packages: { name: string; version: string }[],
  chunkSize = 100
): Promise<Map<string, VulnerabilityAdvisory[]>> {
  const resultMap = new Map<string, VulnerabilityAdvisory[]>();

  // OSV accepts queries: [{ package: { name, ecosystem: 'npm' }, version }]
  for (let i = 0; i < packages.length; i += chunkSize) {
    const chunk = packages.slice(i, i + chunkSize);
    const queries = chunk.map((pkg) => ({
      package: {
        name: pkg.name,
        ecosystem: 'npm',
      },
      version: semver.clean(pkg.version) || pkg.version,
    }));

    try {
      const response = await fetchWithTimeout(
        'https://api.osv.dev/v1/querybatch',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ queries }),
        },
        5000
      );

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const results = data.results || [];

      for (let j = 0; j < chunk.length; j++) {
        const pkg = chunk[j];
        const queryRes = results[j];
        const vulns = queryRes?.vulns || [];

        if (vulns.length > 0) {
          const mappedVulns: VulnerabilityAdvisory[] = vulns.map((v: any) => {
            let severity: VulnerabilityAdvisory['severity'] = 'MODERATE';
            let cvssScore: number | undefined;

            // Check database_specific severity or cvss
            const rawSev = (v.database_specific?.severity || '').toUpperCase();
            if (rawSev.includes('CRITICAL')) severity = 'CRITICAL';
            else if (rawSev.includes('HIGH')) severity = 'HIGH';
            else if (rawSev.includes('MOD') || rawSev.includes('MED')) severity = 'MODERATE';
            else if (rawSev.includes('LOW')) severity = 'LOW';

            // Also check severity array if present
            if (Array.isArray(v.severity)) {
              for (const s of v.severity) {
                if (s.score) {
                  const scoreMatch = String(s.score).match(/(\d+(\.\d+)?)/);
                  if (scoreMatch) {
                    cvssScore = parseFloat(scoreMatch[1]);
                    if (cvssScore >= 9.0) severity = 'CRITICAL';
                    else if (cvssScore >= 7.0) severity = 'HIGH';
                    else if (cvssScore >= 4.0) severity = 'MODERATE';
                    else severity = 'LOW';
                  }
                }
              }
            }

            const fixedIn: string[] = [];
            if (Array.isArray(v.affected)) {
              for (const aff of v.affected) {
                if (Array.isArray(aff.ranges)) {
                  for (const r of aff.ranges) {
                    if (Array.isArray(r.events)) {
                      for (const e of r.events) {
                        if (e.fixed) fixedIn.push(e.fixed);
                      }
                    }
                  }
                }
              }
            }

            const refUrl = v.references?.[0]?.url || `https://osv.dev/vulnerability/${v.id}`;

            return {
              id: v.id,
              summary: v.summary || v.details?.slice(0, 140) || 'Security vulnerability',
              details: v.details,
              severity,
              cvssScore,
              fixedIn: fixedIn.length > 0 ? fixedIn : undefined,
              referenceUrl: refUrl,
            };
          });

          resultMap.set(`${pkg.name}@${pkg.version}`, mappedVulns);
        }
      }
    } catch (err) {
      console.warn('OSV.dev batch query error:', err);
    }
  }

  return resultMap;
}

/**
 * Classifies health status for a package.
 * Precedence: vulnerable > deprecated > major-behind > minor-behind > patch-behind > up-to-date
 */
export function classifyPackageStatus(
  installedVersion: string,
  enrichment?: PackageEnrichment
): PackageHealthStatus {
  if (!enrichment) return 'up-to-date';

  if (enrichment.vulnerabilities && enrichment.vulnerabilities.length > 0) {
    return 'vulnerable';
  }

  if (enrichment.isDeprecated) {
    return 'deprecated';
  }

  const latest = enrichment.latestVersion;
  if (!latest) return 'up-to-date';

  const cleanInstalled = semver.clean(installedVersion) || semver.coerce(installedVersion)?.version;
  const cleanLatest = semver.clean(latest) || semver.coerce(latest)?.version;

  if (!cleanInstalled || !cleanLatest) {
    return 'up-to-date';
  }

  if (semver.gte(cleanInstalled, cleanLatest)) {
    return 'up-to-date';
  }

  const diff = semver.diff(cleanInstalled, cleanLatest);
  if (diff === 'major' || diff === 'premajor') {
    return 'major-behind';
  }
  if (diff === 'minor' || diff === 'preminor') {
    return 'minor-behind';
  }
  if (diff === 'patch' || diff === 'prepatch' || diff === 'prerelease') {
    return 'patch-behind';
  }

  return 'up-to-date';
}

/**
 * Retrieves cached enrichment from IndexedDB if not expired (< 24h)
 */
export async function getCachedEnrichment(packageKey: string): Promise<PackageEnrichment | null> {
  try {
    const cached = await get<CachedEnrichment>(`${ENRICHMENT_CACHE_PREFIX}${packageKey}`);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.enrichment;
    }
  } catch {
    // Cache miss or read error
  }
  return null;
}

/**
 * Stores enrichment in IndexedDB with timestamp
 */
export async function setCachedEnrichment(
  packageKey: string,
  enrichment: PackageEnrichment
): Promise<void> {
  try {
    await set(`${ENRICHMENT_CACHE_PREFIX}${packageKey}`, {
      enrichment,
      cachedAt: Date.now(),
    });
  } catch {
    // Cache write error ignore
  }
}
