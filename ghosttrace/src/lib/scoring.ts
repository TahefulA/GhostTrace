import semver from 'semver';
import type { GraphNode, RiskScoreBreakdown } from '../types';

/**
 * Deterministic Risk Formula (0 to 100):
 *
 * 1. Vulnerability Severity (max 35):
 *    - CRITICAL: 35
 *    - HIGH: 25
 *    - MODERATE: 15
 *    - LOW: 8
 *    - none: 0
 *
 * 2. Major Version Gap (max 25):
 *    - Gap = max(0, latestMajor - installedMajor)
 *    - min(25, gap * 8)
 *
 * 3. Deprecation (max 20):
 *    - true: 20
 *    - false: 0
 *
 * 4. Blast Radius (max 10):
 *    - min(10, blastRadius * 1.5)
 *
 * 5. Staleness / Days since last publish (max 10):
 *    - > 730 days (>2 yrs): 10
 *    - > 365 days (>1 yr): 5
 *    - <= 365 days: 0
 *
 * Clamped strictly between 0 and 100.
 */
export function calculateRiskScore(node: Partial<GraphNode>): {
  riskScore: number;
  riskBreakdown: RiskScoreBreakdown;
} {
  const enrichment = node.enrichment;

  // 1. Vulnerability Points (Max 35)
  let vulnerabilityScore = 0;
  if (enrichment?.vulnerabilities && enrichment.vulnerabilities.length > 0) {
    const severities = enrichment.vulnerabilities.map((v) => v.severity);
    if (severities.includes('CRITICAL')) {
      vulnerabilityScore = 35;
    } else if (severities.includes('HIGH')) {
      vulnerabilityScore = 25;
    } else if (severities.includes('MODERATE')) {
      vulnerabilityScore = 15;
    } else if (severities.includes('LOW')) {
      vulnerabilityScore = 8;
    }
  }

  // 2. Major Version Gap (Max 25)
  let versionGapScore = 0;
  if (node.installedVersion && enrichment?.latestVersion) {
    const cleanInstalled = semver.clean(node.installedVersion) || semver.coerce(node.installedVersion)?.version;
    const cleanLatest = semver.clean(enrichment.latestVersion) || semver.coerce(enrichment.latestVersion)?.version;

    if (cleanInstalled && cleanLatest) {
      const installedMajor = semver.major(cleanInstalled);
      const latestMajor = semver.major(cleanLatest);
      const gap = Math.max(0, latestMajor - installedMajor);
      versionGapScore = Math.min(25, gap * 8);
    }
  }

  // 3. Deprecation (Max 20)
  const deprecationScore = enrichment?.isDeprecated ? 20 : 0;

  // 4. Blast Radius (Max 10)
  const blastRadius = node.blastRadius || 0;
  const blastRadiusScore = Math.min(10, Math.round(blastRadius * 1.5));

  // 5. Staleness (Max 10)
  let stalenessScore = 0;
  const days = enrichment?.daysSinceLastPublish;
  if (days !== undefined) {
    if (days > 730) {
      stalenessScore = 10;
    } else if (days > 365) {
      stalenessScore = 5;
    }
  }

  const rawTotal =
    vulnerabilityScore + versionGapScore + deprecationScore + blastRadiusScore + stalenessScore;
  const riskScore = Math.min(100, Math.max(0, rawTotal));

  return {
    riskScore,
    riskBreakdown: {
      vulnerabilityScore,
      versionGapScore,
      deprecationScore,
      blastRadiusScore,
      stalenessScore,
    },
  };
}
