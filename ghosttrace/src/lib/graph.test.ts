import { describe, it, expect } from 'vitest';
import { buildDependencyGraph } from './graph';
import type { ParsedLockfileResult } from './lockfile';

describe('Dependency Graph Builder', () => {
  const mockPackageJson = {
    name: 'test-app',
    dependencies: {
      react: '^18.2.0',
      zustand: '^4.4.0',
    },
    devDependencies: {
      typescript: '^5.0.0',
    },
  };

  it('builds nodes, edges, and correctly detects direct and dev dependencies', () => {
    const packagesMap: ParsedLockfileResult['packages'] = new Map([
      [
        'node_modules/react',
        {
          name: 'react',
          version: '18.2.0',
          isDev: false,
          dependencies: { 'loose-envify': '^1.1.0' } as Record<string, string>,
        },
      ],
      [
        'node_modules/zustand',
        {
          name: 'zustand',
          version: '4.4.1',
          isDev: false,
          dependencies: {} as Record<string, string>,
        },
      ],
      [
        'node_modules/typescript',
        {
          name: 'typescript',
          version: '5.2.2',
          isDev: true,
          dependencies: {} as Record<string, string>,
        },
      ],
      [
        'node_modules/loose-envify',
        {
          name: 'loose-envify',
          version: '1.4.0',
          isDev: false,
          dependencies: { 'js-tokens': '^4.0.0' } as Record<string, string>,
        },
      ],
      [
        'node_modules/js-tokens',
        {
          name: 'js-tokens',
          version: '4.0.0',
          isDev: false,
          dependencies: {} as Record<string, string>,
        },
      ],
    ]);

    const mockParsedLock: ParsedLockfileResult = {
      hasLockfile: true,
      lockfileVersion: 3,
      packages: packagesMap,
    };

    const graph = buildDependencyGraph(mockPackageJson, mockParsedLock);

    expect(graph.truncated).toBe(false);
    expect(graph.nodes.size).toBe(5);
    expect(graph.directDepsCount).toBe(3); // react, zustand, typescript
    expect(graph.transitiveDepsCount).toBe(2); // loose-envify, js-tokens

    const reactNode = graph.nodes.get('react@18.2.0');
    expect(reactNode).toBeDefined();
    expect(reactNode?.isDirect).toBe(true);
    expect(reactNode?.isDev).toBe(false);
    expect(reactNode?.depth).toBe(1);

    const tsNode = graph.nodes.get('typescript@5.2.2');
    expect(tsNode?.isDev).toBe(true);
    expect(tsNode?.depth).toBe(1);

    const looseNode = graph.nodes.get('loose-envify@1.4.0');
    expect(looseNode?.isDirect).toBe(false);
    expect(looseNode?.depth).toBe(2);

    const jsTokensNode = graph.nodes.get('js-tokens@4.0.0');
    expect(jsTokensNode?.isDirect).toBe(false);
    expect(jsTokensNode?.depth).toBe(3);

    // Verify blast radius calculation
    // js-tokens is depended on by loose-envify which is depended on by react -> blast radius >= 2
    expect(jsTokensNode?.blastRadius).toBeGreaterThanOrEqual(2);
  });

  it('deduplicates identical package versions at different paths', () => {
    const packagesMap: ParsedLockfileResult['packages'] = new Map([
      [
        'node_modules/a',
        { name: 'a', version: '1.0.0', isDev: false, dependencies: { b: '1.0.0' } as Record<string, string> },
      ],
      [
        'node_modules/a/node_modules/b',
        { name: 'b', version: '1.0.0', isDev: false, dependencies: {} as Record<string, string> },
      ],
      [
        'node_modules/b',
        { name: 'b', version: '1.0.0', isDev: false, dependencies: {} as Record<string, string> },
      ],
    ]);

    const mockParsedLock: ParsedLockfileResult = {
      hasLockfile: true,
      lockfileVersion: 3,
      packages: packagesMap,
    };

    const graph = buildDependencyGraph({ dependencies: { a: '1.0.0' } }, mockParsedLock);
    expect(graph.nodes.size).toBe(2);
    expect(graph.nodes.has('a@1.0.0')).toBe(true);
    expect(graph.nodes.has('b@1.0.0')).toBe(true);
  });

  it('caps nodes when exceeding maxNodes, preserving direct deps', () => {
    // Generate 10 packages where 2 are direct and 8 are deep transitive
    const pkgs: ParsedLockfileResult['packages'] = new Map();
    for (let i = 1; i <= 10; i++) {
      pkgs.set(`node_modules/pkg-${i}`, {
        name: `pkg-${i}`,
        version: '1.0.0',
        isDev: false,
        dependencies: (i < 10 ? { [`pkg-${i + 1}`]: '1.0.0' } : {}) as Record<string, string>,
      });
    }

    const mockParsedLock: ParsedLockfileResult = {
      hasLockfile: true,
      packages: pkgs,
    };

    const graph = buildDependencyGraph(
      { dependencies: { 'pkg-1': '1.0.0' } },
      mockParsedLock,
      { maxNodes: 4 }
    );

    expect(graph.truncated).toBe(true);
    expect(graph.nodes.size).toBe(4);
    expect(graph.nodes.has('pkg-1@1.0.0')).toBe(true);
  });
});
