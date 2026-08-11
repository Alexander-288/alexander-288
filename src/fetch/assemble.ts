import type { ProfileData } from "../types.js";
import type { ProfileYaml } from "../schema.js";
import type { Cache } from "./commit-walker.js";
import type { fetchProfile } from "./github-graphql.js";
import {
  averageCommitsPerDay,
  bucketByHour,
  bucketByWeekday,
  currentStreak,
  languageShares,
  pickCurrentProject,
} from "../aggregate.js";

export type ApiData = Awaited<ReturnType<typeof fetchProfile>>;

export function assemble(
  api: ApiData,
  yaml: ProfileYaml,
  cache: Cache,
  commits: { repo: string; at: string }[],
  avatarDataUri: string,
  today: string
): ProfileData {
  const entries = Object.values(cache.repos);
  const linesAdded = entries.reduce((a, r) => a + r.linesAdded, 0);
  const linesRemoved = entries.reduce((a, r) => a + r.linesRemoved, 0);

  const byteLanguages = languageShares(api.languageBytes, api.languageColors);

  // Commit-language share is approximated by the byte share of the languages
  // the user commits in — walking every diff to attribute commits precisely
  // would cost far more API budget than the panel is worth.
  const commitLanguages = byteLanguages.slice(0, 3);

  const last7 = api.calendar.slice(-7);
  const windowStart = last7[0]?.date ?? today;
  const projectRepo = pickCurrentProject(commits, today, 14);
  const project = projectRepo
    ? api.repos.find((r) => r.nameWithOwner === projectRepo) ?? null
    : null;

  return {
    user: { ...api.user, avatarDataUri },
    totals: {
      ...api.totals,
      linesAdded,
      linesRemoved,
      sponsors: yaml.sponsors,
      packages: yaml.packages,
    },
    activity: {
      calendar: api.calendar,
      last7Days: last7,
      reposTouchedLast7Days: new Set(
        commits.filter((c) => c.at.slice(0, 10) >= windowStart).map((c) => c.repo)
      ).size,
      currentStreakDays: currentStreak(api.calendar, today),
      avgCommitsPerDay: averageCommitsPerDay(api.calendar),
    },
    habits: {
      commitsByHour: bucketByHour(commits.map((c) => c.at)),
      commitsByWeekday: bucketByWeekday(commits.map((c) => c.at)),
      commitLanguages,
      byteLanguages,
    },
    currentProject: project
      ? {
          repo: project.nameWithOwner,
          url: project.url,
          updatedAt: new Date().toISOString(),
          doing: yaml.current.doing,
          next: yaml.current.next,
        }
      : null,
    authored: {
      learned: yaml.learned,
      learning: yaml.learning,
      pages: yaml.pages,
      tracks: yaml.tracks,
    },
  };
}
