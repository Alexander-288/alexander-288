import { describe, it, expect, vi } from "vitest";
import { fetchProfile, PROFILE_QUERY } from "../../src/fetch/github-graphql.js";
import { mergeCache, walkRepo, EMPTY_CACHE, type Cache } from "../../src/fetch/commit-walker.js";
import { assemble } from "../../src/fetch/assemble.js";

const RESPONSE = {
  viewer: {
    login: "alexander-288",
    name: "Alexander",
    avatarUrl: "https://avatars.example/u.png",
    createdAt: "2021-03-14T00:00:00Z",
    followers: { totalCount: 31 },
    repositories: {
      totalCount: 19,
      nodes: [
        {
          nameWithOwner: "alexander-288/a",
          url: "https://github.com/alexander-288/a",
          diskUsage: 1000,
          stargazerCount: 100,
          forkCount: 10,
          watchers: { totalCount: 20 },
          releases: { totalCount: 2 },
          licenseInfo: { spdxId: "MIT" },
          languages: { edges: [{ size: 500, node: { name: "TypeScript", color: "#3178c6" } }] },
        },
      ],
    },
    contributionsCollection: {
      contributionCalendar: {
        weeks: [{ contributionDays: [{ date: "2026-08-10", contributionCount: 3 }] }],
      },
    },
  },
};

describe("fetchProfile", () => {
  it("requests contributions and repositories in a single query", () => {
    expect(PROFILE_QUERY).toContain("contributionsCollection");
    expect(PROFILE_QUERY).toContain("diskUsage");
  });

  it("maps the response into normalised totals", async () => {
    const out = await fetchProfile(vi.fn().mockResolvedValue(RESPONSE));
    expect(out.user.login).toBe("alexander-288");
    expect(out.totals.stars).toBe(100);
    expect(out.totals.forks).toBe(10);
    expect(out.totals.watchers).toBe(20);
    expect(out.totals.releases).toBe(2);
    expect(out.totals.preferredLicense).toBe("MIT");
    expect(out.totals.diskUsageBytes).toBe(1000 * 1024);
  });

  it("flattens the contribution calendar into day records with levels", async () => {
    const out = await fetchProfile(vi.fn().mockResolvedValue(RESPONSE));
    expect(out.calendar).toHaveLength(1);
    expect(out.calendar[0]).toMatchObject({ date: "2026-08-10", count: 3 });
    expect(out.calendar[0]!.level).toBeGreaterThan(0);
  });

  it("aggregates language bytes across repos", async () => {
    const out = await fetchProfile(vi.fn().mockResolvedValue(RESPONSE));
    expect(out.languageBytes["TypeScript"]).toBe(500);
    expect(out.languageColors["TypeScript"]).toBe("#3178c6");
  });
});

describe("mergeCache", () => {
  it("adds new repos without touching existing entries", () => {
    const before: Cache = {
      repos: { a: { linesAdded: 10, linesRemoved: 2, lastSha: "x", commits: [] } },
    };
    const after = mergeCache(before, "b", {
      linesAdded: 5,
      linesRemoved: 1,
      lastSha: "y",
      commits: [],
    });
    expect(after.repos["a"]!.linesAdded).toBe(10);
    expect(after.repos["b"]!.linesAdded).toBe(5);
  });

  it("replaces an existing repo entry on refresh", () => {
    const before: Cache = {
      repos: { a: { linesAdded: 10, linesRemoved: 2, lastSha: "x", commits: [] } },
    };
    const after = mergeCache(before, "a", {
      linesAdded: 30,
      linesRemoved: 4,
      lastSha: "z",
      commits: [],
    });
    expect(after.repos["a"]!.linesAdded).toBe(30);
    expect(after.repos["a"]!.lastSha).toBe("z");
  });
});

describe("walkRepo", () => {
  it("sums weekly additions and deletions for the authenticated user only", async () => {
    const rest = {
      repos: {
        getContributorsStats: vi.fn().mockResolvedValue({
          status: 200,
          data: [
            { author: { login: "alexander-288" }, weeks: [{ a: 100, d: 20 }, { a: 50, d: 5 }] },
            { author: { login: "someone-else" }, weeks: [{ a: 999, d: 999 }] },
          ],
        }),
      },
    };
    const out = await walkRepo(rest as never, "o", "r", "alexander-288", { retries: 0 });
    expect(out.linesAdded).toBe(150);
    expect(out.linesRemoved).toBe(25);
  });

  it("returns zeroes rather than throwing when GitHub answers 202", async () => {
    const rest = {
      repos: { getContributorsStats: vi.fn().mockResolvedValue({ status: 202, data: [] }) },
    };
    const out = await walkRepo(rest as never, "o", "r", "alexander-288", { retries: 0 });
    expect(out.linesAdded).toBe(0);
    expect(out.pending).toBe(true);
  });

  it("returns zeroes rather than throwing on a 404 for an empty repo", async () => {
    const rest = {
      repos: {
        getContributorsStats: vi
          .fn()
          .mockRejectedValue(Object.assign(new Error("nf"), { status: 404 })),
      },
    };
    const out = await walkRepo(rest as never, "o", "r", "alexander-288", { retries: 0 });
    expect(out.linesAdded).toBe(0);
  });
});

const API = {
  user: {
    login: "alexander-288",
    name: "Alexander",
    avatarUrl: "https://x/a.png",
    createdAt: "2021-03-14T00:00:00Z",
    followers: 31,
    repositories: 19,
  },
  totals: {
    diskUsageBytes: 1000,
    stars: 147,
    forks: 16,
    watchers: 23,
    releases: 32,
    preferredLicense: "MIT",
  },
  repos: [{ nameWithOwner: "alexander-288/a", url: "https://github.com/alexander-288/a" }],
  calendar: [{ date: "2026-08-11", count: 3, level: 2 }],
  languageBytes: { TypeScript: 100 },
  languageColors: { TypeScript: "#3178c6" },
};

const YAML = {
  sponsors: 2,
  packages: 1,
  current: { doing: "d", next: "n" },
  learned: [],
  learning: [],
  pages: [],
  tracks: [],
};

describe("assemble", () => {
  it("takes sponsors and packages from YAML, not the API", () => {
    const out = assemble(API as never, YAML, EMPTY_CACHE, [], "avatar-uri", "2026-08-11");
    expect(out.totals.sponsors).toBe(2);
    expect(out.totals.packages).toBe(1);
  });

  it("carries API totals through untouched", () => {
    const out = assemble(API as never, YAML, EMPTY_CACHE, [], "avatar-uri", "2026-08-11");
    expect(out.totals.stars).toBe(147);
    expect(out.totals.preferredLicense).toBe("MIT");
  });

  it("uses the embedded avatar data URI rather than the remote URL", () => {
    const out = assemble(API as never, YAML, EMPTY_CACHE, [], "avatar-uri", "2026-08-11");
    expect(out.user.avatarDataUri).toBe("avatar-uri");
  });

  it("returns a null current project when no commits are in the window", () => {
    const out = assemble(API as never, YAML, EMPTY_CACHE, [], "avatar-uri", "2026-08-11");
    expect(out.currentProject).toBeNull();
  });

  it("sums cached line counts across repos", () => {
    const cache: Cache = {
      repos: {
        a: { linesAdded: 10, linesRemoved: 3, lastSha: "", commits: [] },
        b: { linesAdded: 5, linesRemoved: 1, lastSha: "", commits: [] },
      },
    };
    const out = assemble(API as never, YAML, cache, [], "avatar-uri", "2026-08-11");
    expect(out.totals.linesAdded).toBe(15);
    expect(out.totals.linesRemoved).toBe(4);
  });

  it("resolves the current project from commit density in the window", () => {
    const commits = [
      { repo: "alexander-288/a", at: "2026-08-10T12:00:00Z" },
      { repo: "alexander-288/a", at: "2026-08-11T12:00:00Z" },
    ];
    const out = assemble(API as never, YAML, EMPTY_CACHE, commits, "uri", "2026-08-11");
    expect(out.currentProject?.repo).toBe("alexander-288/a");
    expect(out.currentProject?.doing).toBe("d");
  });
});
