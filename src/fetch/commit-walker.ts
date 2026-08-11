import type { Octokit } from "@octokit/rest";

export interface RepoStats {
  linesAdded: number;
  linesRemoved: number;
  lastSha: string;
  /** Commit timestamps, used for the hour and weekday charts. */
  commits: { sha: string; at: string }[];
  /** True when GitHub was still computing statistics for this repo. */
  pending?: boolean;
}

export interface Cache {
  repos: Record<string, RepoStats>;
}

export const EMPTY_CACHE: Cache = { repos: {} };

export function mergeCache(cache: Cache, repo: string, stats: RepoStats): Cache {
  return { repos: { ...cache.repos, [repo]: stats } };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * `stats/contributors` answers 202 while GitHub computes a cold repo's stats.
 * We retry a few times, then give up for this run — the next scheduled run
 * will find the numbers cached on GitHub's side.
 */
export async function walkRepo(
  rest: Octokit,
  owner: string,
  repo: string,
  login: string,
  opts: { retries?: number; backoffMs?: number } = {}
): Promise<RepoStats> {
  const retries = opts.retries ?? 3;
  const backoff = opts.backoffMs ?? 2000;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await rest.repos.getContributorsStats({ owner, repo });
      if (res.status === 202) {
        if (attempt < retries) {
          await sleep(backoff * (attempt + 1));
          continue;
        }
        return { linesAdded: 0, linesRemoved: 0, lastSha: "", commits: [], pending: true };
      }

      const mine = (res.data as any[]).find((c) => c?.author?.login === login);
      if (!mine) return { linesAdded: 0, linesRemoved: 0, lastSha: "", commits: [] };

      let added = 0;
      let removed = 0;
      for (const w of mine.weeks ?? []) {
        added += w.a ?? 0;
        removed += w.d ?? 0;
      }
      return { linesAdded: added, linesRemoved: removed, lastSha: "", commits: [] };
    } catch (err: any) {
      // Empty or inaccessible repos are normal; do not fail the whole run.
      if (err?.status === 404 || err?.status === 403) {
        return { linesAdded: 0, linesRemoved: 0, lastSha: "", commits: [] };
      }
      if (attempt === retries) throw err;
      await sleep(backoff * (attempt + 1));
    }
  }
  return { linesAdded: 0, linesRemoved: 0, lastSha: "", commits: [] };
}

/** Commit timestamps since the given date, for the habit charts. */
export async function fetchRecentCommits(
  rest: Octokit,
  owner: string,
  repo: string,
  login: string,
  sinceIso: string
): Promise<{ sha: string; at: string }[]> {
  try {
    const res = await rest.repos.listCommits({
      owner,
      repo,
      author: login,
      since: sinceIso,
      per_page: 100,
    });
    return res.data.map((c) => ({
      sha: c.sha,
      at: c.commit.author?.date ?? new Date().toISOString(),
    }));
  } catch (err: any) {
    // 409 is an empty repository.
    if (err?.status === 404 || err?.status === 409) return [];
    throw err;
  }
}
