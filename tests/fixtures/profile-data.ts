import type { ProfileData, CalendarDay } from "../../src/types.js";

function calendar(days: number): CalendarDay[] {
  const out: CalendarDay[] = [];
  const start = new Date("2025-08-11T00:00:00Z").getTime();
  for (let i = 0; i < days; i++) {
    const count = (i * 7) % 11;
    out.push({
      date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
      count,
      level: count === 0 ? 0 : Math.min(4, Math.ceil(count / 3)),
    });
  }
  return out;
}

const cal = calendar(371);

export const FIXTURE: ProfileData = {
  user: {
    login: "alexander-288",
    name: "Alexander",
    // 1x1 transparent PNG — keeps snapshots small and offline.
    avatarDataUri:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    createdAt: "2021-03-14T00:00:00Z",
    followers: 31,
    repositories: 19,
  },
  totals: {
    releases: 32,
    packages: 1,
    diskUsageBytes: 1_954_000_000,
    linesAdded: 1_520_000,
    linesRemoved: 379_000,
    stars: 147,
    forks: 16,
    watchers: 23,
    sponsors: 0,
    preferredLicense: "MIT",
  },
  activity: {
    calendar: cal,
    last7Days: cal.slice(-7),
    reposTouchedLast7Days: 5,
    currentStreakDays: 2,
    avgCommitsPerDay: 3.82,
  },
  habits: {
    commitsByHour: [4, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 14, 0, 0, 2, 0, 4, 10, 14, 6, 14],
    commitsByWeekday: [16, 52, 0, 0, 0, 0, 0],
    commitLanguages: [
      { name: "TypeScript", share: 0.62, color: "#3178c6" },
      { name: "Python", share: 0.27, color: "#3572a5" },
      { name: "Shell", share: 0.11, color: "#89e051" },
    ],
    byteLanguages: [
      { name: "TypeScript", share: 0.55, color: "#3178c6" },
      { name: "Python", share: 0.2, color: "#3572a5" },
      { name: "CSS", share: 0.15, color: "#663399" },
      { name: "Shell", share: 0.1, color: "#89e051" },
    ],
  },
  currentProject: {
    repo: "alexander-288/profile-dashboard",
    url: "https://github.com/alexander-288/profile-dashboard",
    updatedAt: "2026-08-11T09:30:00Z",
    doing: "Wiring up the renderer",
    next: "Add the vertical contribution calendar",
  },
  authored: {
    learned: [
      { name: "TypeScript", icon: "typescript" },
      { name: "Python", icon: "python" },
      { name: "Git", icon: "git" },
    ],
    learning: [
      { name: "Rust", icon: "rust" },
      { name: "WebGL", icon: "webgl" },
    ],
    pages: [{ title: "Portfolio", url: "https://example.com", rating: 4 }],
    tracks: [
      { title: "Mutter", artist: "Rammstein" },
      { title: "Bipolar Nightmare", artist: "Keigo Hoashi" },
    ],
  },
};
