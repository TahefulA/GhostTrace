import type { RepoMetadata, GitHubRateLimit } from '../types';

export interface GitHubFetchError {
  isRateLimit: boolean;
  isNotFound: boolean;
  message: string;
  rateLimit?: GitHubRateLimit;
}

function parseRateLimit(headers: Headers): GitHubRateLimit {
  const remaining = headers.get('x-ratelimit-remaining');
  const limit = headers.get('x-ratelimit-limit');
  const reset = headers.get('x-ratelimit-reset');

  return {
    remaining: remaining !== null ? parseInt(remaining, 10) : 60,
    limit: limit !== null ? parseInt(limit, 10) : 60,
    reset: reset !== null ? parseInt(reset, 10) : Math.floor(Date.now() / 1000) + 3600,
  };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 7000
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
 * Fetches repository metadata and latest commit SHA from GitHub REST API.
 * Uses 1 API request.
 */
export async function fetchRepoMetadata(
  owner: string,
  repo: string,
  token?: string
): Promise<{ meta: RepoMetadata; rateLimit: GitHubRateLimit }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'GhostTrace-App',
  };

  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  let repoRes: Response | null = null;
  try {
    repoRes = await fetchWithTimeout(`https://api.github.com/repos/${owner}/${repo}`, { headers }, 6000);
  } catch {
    // Network failure or timeout contacting GitHub REST API
  }

  // Handle case where GitHub REST API responded
  if (repoRes) {
    const rateLimit = parseRateLimit(repoRes.headers);

    if (repoRes.status === 404) {
      throw {
        isNotFound: true,
        isRateLimit: false,
        message: `Repository "${owner}/${repo}" was not found or is private. GhostTrace works with public repositories.`,
        rateLimit,
      };
    }

    if (repoRes.status === 403) {
      // Check if we can fall back to raw content inspection directly (bypassing REST API rate limit)
      const testBranches = ['main', 'master'];
      for (const br of testBranches) {
        try {
          const probe = await fetchWithTimeout(
            `https://raw.githubusercontent.com/${owner}/${repo}/${br}/package.json`,
            {},
            3000
          );
          if (probe.ok) {
            return {
              meta: {
                owner,
                repo,
                fullName: `${owner}/${repo}`,
                defaultBranch: br,
                commitSha: br,
                description: 'Public repository (scanned via direct raw stream)',
                stars: 0,
                isFork: false,
                rateLimit,
              },
              rateLimit,
            };
          }
        } catch {
          // ignore probe error
        }
      }

      const isRateLimited = rateLimit.remaining === 0;
      const resetDate = new Date(rateLimit.reset * 1000).toLocaleTimeString();
      throw {
        isNotFound: false,
        isRateLimit: isRateLimited,
        message: isRateLimited
          ? `GitHub API rate limit reached (60 req/hr). Resets at ${resetDate}. You can add a GitHub PAT in the top bar to continue scanning without limits.`
          : 'Access forbidden by GitHub. If this is a restricted repo, please provide a GitHub Personal Access Token.',
        rateLimit,
      };
    }

    if (!repoRes.ok) {
      throw {
        isNotFound: false,
        isRateLimit: false,
        message: `Failed to fetch repository metadata (HTTP ${repoRes.status}: ${repoRes.statusText})`,
        rateLimit,
      };
    }

    const repoData = await repoRes.json();

    // Get commit SHA for default branch
    let commitSha = '';
    try {
      const commitRes = await fetchWithTimeout(
        `https://api.github.com/repos/${owner}/${repo}/commits/${repoData.default_branch}`,
        { headers },
        4000
      );
      if (commitRes.ok) {
        const commitData = await commitRes.json();
        commitSha = commitData.sha;
      }
    } catch {
      // If commit endpoint fails, fallback to default_branch as the ref
      commitSha = repoData.default_branch;
    }

    if (!commitSha) {
      commitSha = repoData.default_branch || 'main';
    }

    const meta: RepoMetadata = {
      owner: repoData.owner?.login || owner,
      repo: repoData.name || repo,
      fullName: repoData.full_name || `${owner}/${repo}`,
      defaultBranch: repoData.default_branch || 'main',
      commitSha,
      description: repoData.description || null,
      stars: repoData.stargazers_count || 0,
      isFork: Boolean(repoData.fork),
      rateLimit,
    };

    return { meta, rateLimit };
  }

  // If REST API completely timed out or failed, probe raw directly
  for (const br of ['main', 'master']) {
    try {
      const probe = await fetchWithTimeout(
        `https://raw.githubusercontent.com/${owner}/${repo}/${br}/package.json`,
        {},
        4000
      );
      if (probe.ok) {
        return {
          meta: {
            owner,
            repo,
            fullName: `${owner}/${repo}`,
            defaultBranch: br,
            commitSha: br,
            description: 'Public repository (scanned via raw lockfile stream)',
            stars: 0,
            isFork: false,
            rateLimit: { remaining: 60, limit: 60, reset: Math.floor(Date.now() / 1000) + 3600 },
          },
          rateLimit: { remaining: 60, limit: 60, reset: Math.floor(Date.now() / 1000) + 3600 },
        };
      }
    } catch {
      // ignore
    }
  }

  throw {
    isNotFound: false,
    isRateLimit: false,
    message: `Unable to connect to GitHub for ${owner}/${repo}. Please check your network connection or repository URL.`,
  };
}

export interface RawFileResult {
  content: string;
  status: number;
  url: string;
  error?: string;
}

/**
 * Fetches raw file content directly from raw.githubusercontent.com
 * Does NOT count against the GitHub REST API 60 req/hr rate limit.
 */
export async function fetchRawFile(
  owner: string,
  repo: string,
  ref: string,
  filePath: string,
  token?: string
): Promise<RawFileResult> {
  // Normalize filePath
  const cleanPath = filePath.replace(/^\/+/, '');
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${cleanPath}`;

  const headers: Record<string, string> = {};
  if (token && token.trim()) {
    headers.Authorization = `token ${token.trim()}`;
  }

  try {
    const response = await fetchWithTimeout(url, { headers }, 7000);
    if (!response.ok) {
      const errorMsg =
        response.status === 404
          ? `File not found at ${url}`
          : `HTTP ${response.status}: ${response.statusText || 'Fetch failed'}`;
      return { content: '', status: response.status, url, error: errorMsg };
    }
    const content = await response.text();
    return { content, status: 200, url };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[GhostTrace GitHub Fetch Error] ${url}:`, message);
    return { content: '', status: 0, url, error: message };
  }
}
