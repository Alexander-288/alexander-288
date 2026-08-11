import type { CalendarDay } from "../types.js";
import { preferredLicense } from "../aggregate.js";

export const PROFILE_QUERY = `
query {
  viewer {
    login
    name
    avatarUrl(size: 200)
    createdAt
    followers { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, orderBy: {field: PUSHED_AT, direction: DESC}) {
      totalCount
      nodes {
        nameWithOwner
        url
        diskUsage
        stargazerCount
        forkCount
        watchers { totalCount }
        releases { totalCount }
        licenseInfo { spdxId }
        languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
          edges { size node { name color } }
        }
      }
    }
    contributionsCollection {
      contributionCalendar {
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

export type GraphQLClient = (query: string) => Promise<any>;

/** GitHub's own calendar buckets: 0, then quartiles of a 10-contribution day. */
function levelFor(count: number): number {
  if (count === 0) return 0;
  if (count < 3) return 1;
  if (count < 6) return 2;
  if (count < 10) return 3;
  return 4;
}

export async function fetchProfile(client: GraphQLClient) {
  const data = await client(PROFILE_QUERY);
  const v = data.viewer;
  const repos = (v.repositories.nodes ?? []) as any[];

  const languageBytes: Record<string, number> = {};
  const languageColors: Record<string, string> = {};
  for (const r of repos) {
    for (const e of r.languages?.edges ?? []) {
      languageBytes[e.node.name] = (languageBytes[e.node.name] ?? 0) + e.size;
      languageColors[e.node.name] = e.node.color ?? "#8b949e";
    }
  }

  const calendar: CalendarDay[] = v.contributionsCollection.contributionCalendar.weeks
    .flatMap((w: any) => w.contributionDays)
    .map((d: any) => ({
      date: d.date,
      count: d.contributionCount,
      level: levelFor(d.contributionCount),
    }));

  const sum = (f: (r: any) => number) => repos.reduce((a, r) => a + f(r), 0);

  return {
    user: {
      login: v.login as string,
      name: (v.name ?? v.login) as string,
      avatarUrl: v.avatarUrl as string,
      createdAt: v.createdAt as string,
      followers: v.followers.totalCount as number,
      repositories: v.repositories.totalCount as number,
    },
    totals: {
      // diskUsage is reported in KB by the API.
      diskUsageBytes: sum((r) => r.diskUsage ?? 0) * 1024,
      stars: sum((r) => r.stargazerCount),
      forks: sum((r) => r.forkCount),
      watchers: sum((r) => r.watchers.totalCount),
      releases: sum((r) => r.releases.totalCount),
      preferredLicense: preferredLicense(
        repos.map((r) => r.licenseInfo?.spdxId).filter(Boolean)
      ),
    },
    repos: repos.map((r) => ({ nameWithOwner: r.nameWithOwner as string, url: r.url as string })),
    calendar,
    languageBytes,
    languageColors,
  };
}
