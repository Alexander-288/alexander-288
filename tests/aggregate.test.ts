import { describe, it, expect } from "vitest";
import {
  currentStreak,
  bucketByHour,
  bucketByWeekday,
  languageShares,
  preferredLicense,
  pickCurrentProject,
  averageCommitsPerDay,
} from "../src/aggregate.js";

const day = (date: string, count: number) => ({ date, count, level: 0 });

describe("currentStreak", () => {
  it("counts consecutive days ending today", () => {
    const days = [day("2026-08-09", 1), day("2026-08-10", 3), day("2026-08-11", 2)];
    expect(currentStreak(days, "2026-08-11")).toBe(3);
  });

  it("tolerates an empty today and counts through yesterday", () => {
    const days = [day("2026-08-09", 1), day("2026-08-10", 3), day("2026-08-11", 0)];
    expect(currentStreak(days, "2026-08-11")).toBe(2);
  });

  it("returns 0 when yesterday and today are both empty", () => {
    const days = [day("2026-08-09", 1), day("2026-08-10", 0), day("2026-08-11", 0)];
    expect(currentStreak(days, "2026-08-11")).toBe(0);
  });

  it("stops at the first gap", () => {
    const days = [
      day("2026-08-08", 5),
      day("2026-08-09", 0),
      day("2026-08-10", 1),
      day("2026-08-11", 1),
    ];
    expect(currentStreak(days, "2026-08-11")).toBe(2);
  });
});

describe("bucketByHour", () => {
  it("returns 24 buckets and counts each timestamp once", () => {
    const out = bucketByHour([
      "2026-08-11T03:15:00Z",
      "2026-08-11T03:59:00Z",
      "2026-08-11T22:00:00Z",
    ]);
    expect(out).toHaveLength(24);
    expect(out[3]).toBe(2);
    expect(out[22]).toBe(1);
    expect(out.reduce((a, b) => a + b, 0)).toBe(3);
  });
});

describe("bucketByWeekday", () => {
  it("indexes Sunday at 0", () => {
    // 2026-08-09 is a Sunday.
    const out = bucketByWeekday(["2026-08-09T12:00:00Z"]);
    expect(out[0]).toBe(1);
    expect(out).toHaveLength(7);
  });
});

describe("languageShares", () => {
  it("normalises to fractions summing to 1", () => {
    const out = languageShares(
      { TypeScript: 75, CSS: 25 },
      { TypeScript: "#3178c6", CSS: "#663399" }
    );
    expect(out[0]!.name).toBe("TypeScript");
    expect(out[0]!.share).toBeCloseTo(0.75);
    expect(out.reduce((a, l) => a + l.share, 0)).toBeCloseTo(1);
  });

  it("returns an empty array for no data rather than dividing by zero", () => {
    expect(languageShares({}, {})).toEqual([]);
  });
});

describe("preferredLicense", () => {
  it("returns the most common license", () => {
    expect(preferredLicense(["MIT", "MIT", "Apache-2.0"])).toBe("MIT");
  });

  it("returns 'None' when no repo declares one", () => {
    expect(preferredLicense([])).toBe("None");
  });
});

describe("pickCurrentProject", () => {
  it("chooses the repo with the most commits in the window, not the newest push", () => {
    const commits = [
      { repo: "a", at: "2026-08-10T00:00:00Z" },
      { repo: "a", at: "2026-08-09T00:00:00Z" },
      { repo: "b", at: "2026-08-11T00:00:00Z" },
    ];
    expect(pickCurrentProject(commits, "2026-08-11", 14)).toBe("a");
  });

  it("ignores commits older than the window", () => {
    const commits = [
      { repo: "old", at: "2026-01-01T00:00:00Z" },
      { repo: "old", at: "2026-01-02T00:00:00Z" },
      { repo: "new", at: "2026-08-11T00:00:00Z" },
    ];
    expect(pickCurrentProject(commits, "2026-08-11", 14)).toBe("new");
  });

  it("returns null when nothing falls in the window", () => {
    expect(pickCurrentProject([], "2026-08-11", 14)).toBeNull();
  });
});

describe("averageCommitsPerDay", () => {
  it("rounds to two decimals", () => {
    expect(averageCommitsPerDay([day("a", 1), day("b", 2)])).toBe(1.5);
  });

  it("returns 0 for an empty calendar", () => {
    expect(averageCommitsPerDay([])).toBe(0);
  });
});
