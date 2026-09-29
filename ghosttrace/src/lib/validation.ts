import { z } from 'zod';
import type { RepoIdentifier } from '../types';

// Valid GitHub username/org: alphanumeric and single hyphens, 1-39 chars, cannot start/end with hyphen
const GITHUB_OWNER_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
// Valid GitHub repo name: alphanumeric, hyphen, underscore, dot (max 100 chars)
const GITHUB_REPO_REGEX = /^[a-zA-Z0-9_.-]{1,100}$/;

export const repoInputSchema = z.string().trim().min(1, 'Please enter a GitHub repository or URL');

export interface ParseRepoResult {
  success: boolean;
  data?: RepoIdentifier;
  error?: string;
}

/**
 * Parses and strictly validates a GitHub repository input.
 * Supports:
 * - "owner/repo"
 * - "github.com/owner/repo"
 * - "https://github.com/owner/repo"
 * - "https://github.com/owner/repo.git"
 * - "https://github.com/owner/repo/tree/branch/subpath/to/folder"
 */
export function parseGitHubRepoInput(input: string, explicitSubpath?: string): ParseRepoResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { success: false, error: 'Repository input cannot be empty' };
  }

  let cleaned = trimmed;
  // Remove protocol
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  // Remove leading git@github.com:
  cleaned = cleaned.replace(/^git@github\.com:/i, '');
  // Remove github.com/ prefix
  cleaned = cleaned.replace(/^github\.com\//i, '');
  // Remove trailing .git
  cleaned = cleaned.replace(/\.git$/i, '');
  // Remove trailing slash
  cleaned = cleaned.replace(/\/+$/, '');

  const segments = cleaned.split('/').filter(Boolean);
  if (segments.length < 2) {
    return {
      success: false,
      error: 'Invalid format. Use "owner/repo" or "https://github.com/owner/repo"',
    };
  }

  const owner = segments[0];
  const repo = segments[1];

  if (!GITHUB_OWNER_REGEX.test(owner)) {
    return {
      success: false,
      error: `Invalid GitHub owner: "${owner}". Only alphanumeric characters and single hyphens are allowed.`,
    };
  }

  if (!GITHUB_REPO_REGEX.test(repo)) {
    return {
      success: false,
      error: `Invalid GitHub repository name: "${repo}".`,
    };
  }

  // Detect subpath from URL like owner/repo/tree/main/subpath/pkg
  let derivedSubpath = '';
  if (segments.length > 3 && segments[2] === 'tree') {
    // segments[3] is the branch (e.g. main), remainder is subpath
    derivedSubpath = segments.slice(4).join('/');
  }

  let finalSubpath = explicitSubpath !== undefined && explicitSubpath.trim() !== ''
    ? explicitSubpath.trim()
    : derivedSubpath;

  // Clean subpath
  finalSubpath = finalSubpath.replace(/^\/+/, '').replace(/\/+$/, '');

  return {
    success: true,
    data: {
      owner,
      repo,
      subpath: finalSubpath,
    },
  };
}

export const validatedRepoSchema = z.object({
  owner: z.string().regex(GITHUB_OWNER_REGEX, 'Invalid GitHub username/organization'),
  repo: z.string().regex(GITHUB_REPO_REGEX, 'Invalid GitHub repository name'),
  subpath: z.string().default(''),
});
