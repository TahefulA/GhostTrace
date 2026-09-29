import { describe, it, expect } from 'vitest';
import { parsePackageJson, parsePackageLock, extractPackageNameFromKey } from './lockfile';

describe('Lockfile and PackageJson Parser', () => {
  describe('extractPackageNameFromKey', () => {
    it('extracts simple package name', () => {
      expect(extractPackageNameFromKey('node_modules/lodash')).toBe('lodash');
    });

    it('extracts scoped package name', () => {
      expect(extractPackageNameFromKey('node_modules/@types/node')).toBe('@types/node');
    });

    it('extracts nested package name', () => {
      expect(extractPackageNameFromKey('node_modules/express/node_modules/debug')).toBe('debug');
    });

    it('extracts nested scoped package name', () => {
      expect(extractPackageNameFromKey('node_modules/foo/node_modules/@babel/core')).toBe('@babel/core');
    });

    it('returns null for root empty key', () => {
      expect(extractPackageNameFromKey('')).toBeNull();
    });
  });

  describe('parsePackageJson', () => {
    it('parses valid package.json with dependencies', () => {
      const json = JSON.stringify({
        name: 'test-app',
        dependencies: { react: '^18.2.0', lodash: '^4.17.21' },
        devDependencies: { typescript: '^5.0.0' },
      });
      const parsed = parsePackageJson(json);
      expect(parsed.name).toBe('test-app');
      expect(parsed.dependencies?.react).toBe('^18.2.0');
      expect(parsed.devDependencies?.typescript).toBe('^5.0.0');
    });

    it('throws on empty string', () => {
      expect(() => parsePackageJson('')).toThrow(/empty/i);
    });

    it('throws on invalid JSON syntax', () => {
      expect(() => parsePackageJson('{ broken json ')).toThrow(/invalid JSON/i);
    });
  });

  describe('parsePackageLock', () => {
    const pkgJson = {
      name: 'demo-app',
      dependencies: { lodash: '^4.17.21' },
      devDependencies: { typescript: '^5.0.0' },
    };

    it('parses npm lockfile v3 with packages map', () => {
      const lockfileV3 = JSON.stringify({
        name: 'demo-app',
        lockfileVersion: 3,
        packages: {
          '': {
            name: 'demo-app',
            dependencies: { lodash: '^4.17.21' },
          },
          'node_modules/lodash': {
            version: '4.17.21',
            resolved: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
            integrity: 'sha512-...',
          },
          'node_modules/typescript': {
            version: '5.2.2',
            dev: true,
          },
        },
      });

      const parsed = parsePackageLock(lockfileV3, pkgJson);
      expect(parsed.hasLockfile).toBe(true);
      expect(parsed.lockfileVersion).toBe(3);
      expect(parsed.packages.size).toBe(2);
      expect(parsed.packages.get('node_modules/lodash')?.version).toBe('4.17.21');
      expect(parsed.packages.get('node_modules/typescript')?.isDev).toBe(true);
    });

    it('falls back to package.json with warning when lockfile is missing or null', () => {
      const parsed = parsePackageLock(null, pkgJson);
      expect(parsed.hasLockfile).toBe(false);
      expect(parsed.warning).toMatch(/No lockfile found/i);
      expect(parsed.packages.has('node_modules/lodash')).toBe(true);
      expect(parsed.packages.has('node_modules/typescript')).toBe(true);
    });

    it('falls back to package.json with warning when lockfile is v1 without packages map', () => {
      const lockfileV1 = JSON.stringify({
        name: 'demo-app',
        lockfileVersion: 1,
        dependencies: {
          lodash: { version: '4.17.21' },
        },
      });

      const parsed = parsePackageLock(lockfileV1, pkgJson);
      expect(parsed.hasLockfile).toBe(false);
      expect(parsed.warning).toMatch(/Legacy lockfile/i);
      expect(parsed.packages.size).toBe(2);
    });
  });
});
