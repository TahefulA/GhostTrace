export type PackageHealthStatus =
  | 'up-to-date'
  | 'patch-behind'
  | 'minor-behind'
  | 'major-behind'
  | 'deprecated'
  | 'vulnerable';

export interface RepoIdentifier {
  owner: string;
  repo: string;
  subpath: string; // e.g. "" or "packages/app"
}

export interface GitHubRateLimit {
  remaining: number;
  limit: number;
  reset: number; // Unix timestamp in seconds
}

export interface RepoMetadata {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
  commitSha: string;
  description: string | null;
  stars: number;
  isFork: boolean;
  rateLimit: GitHubRateLimit;
}

export interface RawPackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface LockfilePackageEntry {
  version?: string;
  resolved?: string;
  integrity?: string;
  dev?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface RawPackageLockJson {
  name?: string;
  version?: string;
  lockfileVersion?: number;
  packages?: Record<string, LockfilePackageEntry>;
  dependencies?: Record<string, unknown>; // v1 structure
  [key: string]: unknown;
}

export interface VulnerabilityAdvisory {
  id: string; // e.g. GHSA-... or CVE-...
  summary: string;
  details?: string;
  severity?: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  cvssScore?: number;
  fixedIn?: string[];
  referenceUrl?: string;
}

export interface PackageEnrichment {
  latestVersion?: string;
  isDeprecated?: boolean;
  deprecationMessage?: string;
  lastPublished?: string; // ISO date
  daysSinceLastPublish?: number;
  majorGap?: number;
  minorGap?: number;
  patchGap?: number;
  vulnerabilities?: VulnerabilityAdvisory[];
  highestVulnerabilitySeverity?: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | null;
}

export interface RiskScoreBreakdown {
  versionGapScore: number;
  majorGapScore?: number;
  vulnerabilityScore: number;
  deprecationScore: number;
  deprecatedScore?: number;
  blastRadiusScore: number;
  stalenessScore: number;
  totalScore?: number;
}

export interface GraphNode {
  id: string; // e.g. "lodash@4.17.21"
  name: string;
  installedVersion: string;
  depth: number;
  isDirect: boolean;
  isDev: boolean;
  // 3D & 2D layout coordinates
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  // Enrichment fields (optional until enriched)
  status: PackageHealthStatus;
  enrichment?: PackageEnrichment;
  riskScore: number;
  riskBreakdown?: RiskScoreBreakdown;
  blastRadius: number; // count of packages that depend on this directly or transitively
  dependents: string[]; // ids of nodes that depend on this
  dependencies: string[]; // ids of nodes this depends on
}

export interface GraphEdge {
  id: string;
  source: string; // node id
  target: string; // node id
  isDev?: boolean;
}

export interface DependencyGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  truncated: boolean;
  totalNodeCount: number;
  hasLockfile: boolean;
  lockfileWarning?: string;
  directDepsCount: number;
  transitiveDepsCount: number;
}

export interface ScanDebugInfo {
  packageJsonUrl: string;
  packageJsonStatus: number;
  packageJsonError?: string;
  packageLockUrl: string;
  packageLockStatus: number;
  packageLockError?: string;
  lockfileVersion?: number;
  nodeCount: number;
  edgeCount: number;
  finitePositionCount: number;
  repairedPositionCount: number;
}

export interface UpgradeStep {
  stepNumber: number;
  title: string;
  packages: string[];
  commands: string[];
  breakingChangeNotes: string;
  effort: {
    size: 'S' | 'M' | 'L';
    hoursRange: string;
  };
  rationale: string;
  isAIGenerated: boolean;
}

export interface UpgradePlanItem {
  step: number;
  packageId: string;
  packageName: string;
  currentVersion: string;
  targetVersion: string;
  riskScore: number;
  breakingChangeRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedEffort: string;
  rationale: string;
  command: string;
  isDirect: boolean;
  dependentsCount: number;
}

export interface UpgradePlan {
  summary: string;
  steps: UpgradeStep[];
  isFallback: boolean;
  generatedAt: string;
}

export type ScanStepName =
  | 'idle'
  | 'fetching_metadata'
  | 'fetching_files'
  | 'parsing_lockfile'
  | 'building_graph'
  | 'enriching_npm'
  | 'checking_npm'
  | 'checking_vulnerabilities'
  | 'scoring_risk'
  | 'generating_plan'
  | 'completed'
  | 'error';

export interface ScanProgress {
  step: ScanStepName;
  percent: number;
  message: string;
  detail?: string;
  cancelRequested?: boolean;
}

export interface ScanResult {
  id: string;
  timestamp: number;
  repo: RepoIdentifier;
  meta: RepoMetadata;
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    truncated: boolean;
    totalNodeCount: number;
    hasLockfile: boolean;
    lockfileWarning?: string;
    directDepsCount: number;
    transitiveDepsCount: number;
  };
  stats: {
    total: number;
    upToDate: number;
    patchBehind: number;
    minorBehind: number;
    majorBehind: number;
    deprecated: number;
    vulnerable: number;
    overallRiskScore: number;
  };
  debugInfo?: ScanDebugInfo;
  plan?: UpgradePlan;
}
