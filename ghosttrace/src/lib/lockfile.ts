import type { RawPackageJson, RawPackageLockJson, LockfilePackageEntry } from '../types';

export interface ParsedLockfileResult {
  hasLockfile: boolean;
  lockfileVersion?: number;
  warning?: string;
  // Map of normalized path/package key to entry:
  // e.g. "lodash" -> { version: "4.17.21", dependencies: {...}, dev: false }
  packages: Map<string, {
    name: string;
    version: string;
    isDev: boolean;
    dependencies: Record<string, string>;
  }>;
}

/**
 * Parses package.json content.
 * Throws a descriptive error if parsing fails or structure is invalid.
 */
export function parsePackageJson(content: string): RawPackageJson {
  if (!content || !content.trim()) {
    throw new Error('package.json content is empty');
  }

  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error('Failed to parse package.json: invalid JSON format');
  }

  if (typeof data !== 'object' || data === null) {
    throw new Error('package.json root must be a valid JSON object');
  }

  return data as RawPackageJson;
}

/**
 * Extracts dependency name from a package-lock v2/v3 packages map key.
 * Examples:
 * - "node_modules/react" -> "react"
 * - "node_modules/@types/node" -> "@types/node"
 * - "node_modules/foo/node_modules/bar" -> "bar"
 * - "node_modules/foo/node_modules/@scope/bar" -> "@scope/bar"
 */
export function extractPackageNameFromKey(key: string): string | null {
  if (!key || key === '') return null; // root project

  // Find the last occurrence of node_modules/
  const lastIndex = key.lastIndexOf('node_modules/');
  if (lastIndex === -1) {
    // Might just be the package name itself
    return key;
  }

  const sub = key.slice(lastIndex + 'node_modules/'.length);
  return sub.trim() || null;
}

/**
 * Parses package-lock.json content.
 * Handles lockfile v2/v3 ("packages" map).
 * If lockfile is missing, v1 without packages map, or invalid, returns fallback with warning.
 */
export function parsePackageLock(
  lockContent: string | null,
  packageJson: RawPackageJson
): ParsedLockfileResult {
  const result: ParsedLockfileResult = {
    hasLockfile: false,
    packages: new Map(),
  };

  if (!lockContent || !lockContent.trim()) {
    result.warning = 'No lockfile found, so transitive dependencies are unavailable.';
    populateFallbackFromPackageJson(result.packages, packageJson);
    return result;
  }

  let lockData: RawPackageLockJson;
  try {
    lockData = JSON.parse(lockContent);
  } catch {
    result.warning = 'Lockfile could not be parsed as valid JSON. Transitive dependencies are unavailable.';
    populateFallbackFromPackageJson(result.packages, packageJson);
    return result;
  }

  const version = lockData.lockfileVersion || 1;
  result.lockfileVersion = version;

  // Check for v2 or v3 packages map
  if ((version === 2 || version === 3 || version >= 2) && lockData.packages && typeof lockData.packages === 'object') {
    result.hasLockfile = true;
    const packagesMap = lockData.packages;

    for (const [key, entry] of Object.entries(packagesMap)) {
      if (key === '') continue; // Skip root project descriptor

      const pkgName = extractPackageNameFromKey(key);
      if (!pkgName) continue;

      const pkgVersion = entry.version || '0.0.0';
      const isDev = Boolean(entry.dev);
      const dependencies = (entry.dependencies as Record<string, string>) || {};

      // In npm v2/v3 lockfile, multiple versions can exist at different paths
      // e.g. "node_modules/glob" and "node_modules/rimraf/node_modules/glob"
      // We key them uniquely by their lock path or name@version
      const uniqueKey = key;

      result.packages.set(uniqueKey, {
        name: pkgName,
        version: pkgVersion,
        isDev,
        dependencies,
      });
    }

    if (result.packages.size === 0) {
      result.warning = 'Lockfile packages map was empty. Fallback to package.json direct dependencies.';
      populateFallbackFromPackageJson(result.packages, packageJson);
    }

    return result;
  }

  // If lockfile is v1 without `packages` map
  result.warning = 'Legacy lockfile (v1) or unsupported format found. Transitive dependencies are unavailable.';
  populateFallbackFromPackageJson(result.packages, packageJson);
  return result;
}

/**
 * Populates fallback packages map directly from package.json dependencies and devDependencies
 */
function populateFallbackFromPackageJson(
  packagesMap: Map<string, { name: string; version: string; isDev: boolean; dependencies: Record<string, string> }>,
  packageJson: RawPackageJson
) {
  const directDeps = packageJson.dependencies || {};
  const devDeps = packageJson.devDependencies || {};

  for (const [name, versionSpec] of Object.entries(directDeps)) {
    // Strip ^, ~, >= etc for fallback installed version approximation
    const cleanVer = versionSpec.replace(/^[^0-9]*/, '') || '0.0.0';
    packagesMap.set(`node_modules/${name}`, {
      name,
      version: cleanVer,
      isDev: false,
      dependencies: {},
    });
  }

  for (const [name, versionSpec] of Object.entries(devDeps)) {
    if (packagesMap.has(`node_modules/${name}`)) continue;
    const cleanVer = versionSpec.replace(/^[^0-9]*/, '') || '0.0.0';
    packagesMap.set(`node_modules/${name}`, {
      name,
      version: cleanVer,
      isDev: true,
      dependencies: {},
    });
  }
}
