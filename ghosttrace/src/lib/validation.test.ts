import { describe, it, expect } from 'vitest';
import { parseGitHubRepoInput } from './validation';

describe('GitHub Repo Input Validation', () => {
  it('parses standard owner/repo format', () => {
    const result = parseGitHubRepoInput('facebook/react');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      owner: 'facebook',
      repo: 'react',
      subpath: '',
    });
  });

  it('parses full https github.com URL', () => {
    const result = parseGitHubRepoInput('https://github.com/vercel/next.js');
    expect(result.success).toBe(true);
    expect(result.data?.owner).toBe('vercel');
    expect(result.data?.repo).toBe('next.js');
    expect(result.data?.subpath).toBe('');
  });

  it('strips .git extension', () => {
    const result = parseGitHubRepoInput('https://github.com/tailwindlabs/tailwindcss.git');
    expect(result.success).toBe(true);
    expect(result.data?.repo).toBe('tailwindcss');
  });

  it('correctly parses user provided repository URL with .git', () => {
    const result = parseGitHubRepoInput('https://github.com/unicorn-mafia/awesome-hackathon-winners.git');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      owner: 'unicorn-mafia',
      repo: 'awesome-hackathon-winners',
      subpath: '',
    });
  });

  it('extracts monorepo subpath from tree URL', () => {
    const result = parseGitHubRepoInput('https://github.com/facebook/react/tree/main/packages/react-dom');
    expect(result.success).toBe(true);
    expect(result.data?.owner).toBe('facebook');
    expect(result.data?.repo).toBe('react');
    expect(result.data?.subpath).toBe('packages/react-dom');
  });

  it('accepts explicit subpath parameter', () => {
    const result = parseGitHubRepoInput('trpc/trpc', 'packages/server');
    expect(result.success).toBe(true);
    expect(result.data?.subpath).toBe('packages/server');
  });

  it('rejects empty input', () => {
    const result = parseGitHubRepoInput('   ');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cannot be empty/i);
  });

  it('rejects incomplete input without repo', () => {
    const result = parseGitHubRepoInput('facebook');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid format/i);
  });

  it('rejects invalid owner names with illegal characters', () => {
    const result = parseGitHubRepoInput('user;name/repo');
    expect(result.success).toBe(false);
  });
});
