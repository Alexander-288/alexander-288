import type { CalendarDay, LanguageShare } from "./types.js";

const DAY_MS = 86_400_000;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Consecutive days with at least one contribution, walking backwards from
 * `today`. An empty *today* is forgiven — the workflow may run at 04:00 UTC
 * before the user has committed — but an empty yesterday ends the streak.
 */
export function currentStreak(days: readonly CalendarDay[], today: string): number {
  const counts = new Map(days.map((d) => [d.date, d.count]));
  let cursor = new Date(`${today}T00:00:00Z`);

  if ((counts.get(today) ?? 0) === 0) {
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  let streak = 0;
  while ((counts.get(isoDay(cursor)) ?? 0) > 0) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

export function bucketByHour(timestamps: readonly string[]): number[] {
  const out = new Array(24).fill(0);
  for (const t of timestamps) out[new Date(t).getUTCHours()]!++;
  return out;
}

export function bucketByWeekday(timestamps: readonly string[]): number[] {
  const out = new Array(7).fill(0);
  for (const t of timestamps) out[new Date(t).getUTCDay()]!++;
  return out;
}

export function languageShares(
  totals: Record<string, number>,
  colors: Record<string, string>
): LanguageShare[] {
  const sum = Object.values(totals).reduce((a, b) => a + b, 0);
  if (sum === 0) return [];
  return Object.entries(totals)
    .map(([name, v]) => ({ name, share: v / sum, color: colors[name] ?? "#8b949e" }))
    .sort((a, b) => b.share - a.share);
}

export function preferredLicense(licenses: readonly string[]): string {
  if (licenses.length === 0) return "None";
  const tally = new Map<string, number>();
  for (const l of licenses) tally.set(l, (tally.get(l) ?? 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

/** Most commits within the trailing window — not the most recently pushed. */
export function pickCurrentProject(
  commits: readonly { repo: string; at: string }[],
  today: string,
  windowDays: number
): string | null {
  const cutoff = new Date(`${today}T00:00:00Z`).getTime() - windowDays * DAY_MS;
  const tally = new Map<string, number>();
  for (const c of commits) {
    if (new Date(c.at).getTime() < cutoff) continue;
    tally.set(c.repo, (tally.get(c.repo) ?? 0) + 1);
  }
  if (tally.size === 0) return null;
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

export function averageCommitsPerDay(days: readonly CalendarDay[]): number {
  if (days.length === 0) return 0;
  const total = days.reduce((a, d) => a + d.count, 0);
  return Math.round((total / days.length) * 100) / 100;
}
