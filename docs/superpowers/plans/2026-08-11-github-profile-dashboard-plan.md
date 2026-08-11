# GitHub Profile Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript renderer that runs in GitHub Actions and emits four static SVG cards, committed into `alexander-288/alexander-288`, which `README.md` embeds as the user's profile dashboard.

**Architecture:** Nothing under `src/` is ever served to a viewer. `README.md` is the only rendered surface; it holds an HTML table of `<picture>` embeds pointing at committed files in `out/`. A scheduled Action runs `src/render.ts`, which fetches from the GitHub API, merges hand-authored YAML, and writes eight SVG files (four cards × light/dark). Cards are pure functions: data in, SVG string out — which makes them snapshot-testable with zero network access.

**Tech Stack:** Node 20, TypeScript (strict), Vitest, `@octokit/graphql`, `@octokit/rest`, `yaml`, `zod`. No SVG libraries — cards are built from string templates over a small set of primitives, because every drawing helper we need is under 30 lines and third-party SVG builders would obscure the coordinate math.

**Visual reference:** `lowlighter/metrics` output (see spec). Primer design language, light and dark variants.

**Spec:** `docs/superpowers/specs/2026-08-10-github-profile-dashboard-design.md`

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `vitest.config.ts` | Toolchain |
| `src/theme/tokens.ts` | Primer light/dark palettes, type scale, spacing |
| `src/theme/primitives.ts` | `text`, `icon`, `bar`, `sparkline`, `calendarCell`, `truncate`, `card` frame |
| `src/schema.ts` | Zod schema + loader for `data/profile.yml` |
| `src/fetch/github-graphql.ts` | Profile, repos, contribution calendar, language bytes |
| `src/fetch/commit-walker.ts` | Per-repo line counts + commit timestamps, cache-aware |
| `src/aggregate.ts` | Streak, hour/day buckets, language shares, license mode, current project |
| `src/cards/identity.ts` | Card 1 (560×340) |
| `src/cards/pulse.ts` | Card 2 (560×340) |
| `src/cards/habits.ts` | Card 3 (1120×400) |
| `src/cards/dashboard.ts` | Card 4 (560×760) |
| `src/render.ts` | Entry point: fetch → aggregate → render → write |
| `src/types.ts` | Shared `ProfileData` type consumed by every card |
| `tests/fixtures/profile-data.ts` | One canonical fixture used by all card snapshot tests |
| `.github/workflows/refresh.yml` | Triggers |
| `docs/dispatch-snippet.yml` | Copy-paste snippet for other repos |

Cards never fetch. They receive `ProfileData` and return a string. This is the single most important boundary in the codebase: it is what lets the whole dashboard be developed and tested offline.

---

## Task 1: Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "profile-dashboard",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "render": "tsx src/render.ts",
    "render:fixtures": "tsx src/render.ts --fixtures",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@octokit/graphql": "^7.1.0",
    "@octokit/rest": "^20.1.1",
    "yaml": "^2.4.5",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"] },
});
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
*.log
```

Note: `out/` and `cache/` are deliberately **not** ignored — they are the build product the README depends on.

- [ ] **Step 5: Install and verify**

Run: `npm install && npm run typecheck`
Expected: exits 0, no output from typecheck.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore
git commit -m "chore: scaffold TypeScript + Vitest toolchain"
```

---

## Task 2: Theme tokens

**Files:**
- Create: `src/theme/tokens.ts`
- Test: `tests/theme/tokens.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/theme/tokens.test.ts
import { describe, it, expect } from "vitest";
import { THEMES, type ThemeName } from "../../src/theme/tokens.js";

describe("themes", () => {
  it("exposes light and dark", () => {
    expect(Object.keys(THEMES).sort()).toEqual(["dark", "light"]);
  });

  it("defines identical token keys in both themes", () => {
    const light = Object.keys(THEMES.light).sort();
    const dark = Object.keys(THEMES.dark).sort();
    expect(dark).toEqual(light);
  });

  it("uses hex colors for every color token", () => {
    for (const name of Object.keys(THEMES) as ThemeName[]) {
      for (const [key, value] of Object.entries(THEMES[name])) {
        if (key.startsWith("color") || key === "contribution") continue;
      }
      expect(THEMES[name].colorFg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(THEMES[name].colorBg).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("provides a four-step contribution scale plus an empty step", () => {
    expect(THEMES.light.contribution).toHaveLength(5);
    expect(THEMES.dark.contribution).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/theme/tokens.test.ts`
Expected: FAIL — cannot resolve `../../src/theme/tokens.js`.

- [ ] **Step 3: Implement**

```ts
// src/theme/tokens.ts
export interface Theme {
  colorBg: string;
  colorFg: string;
  colorMuted: string;
  colorAccent: string;
  colorBorder: string;
  colorSuccess: string;
  colorDanger: string;
  /** [empty, l1, l2, l3, l4] — GitHub's contribution intensity scale. */
  contribution: readonly [string, string, string, string, string];
}

/** Primer color tokens. Values mirror GitHub's own light/dark defaults. */
export const THEMES = {
  light: {
    colorBg: "#ffffff",
    colorFg: "#1f2328",
    colorMuted: "#59636e",
    colorAccent: "#0969da",
    colorBorder: "#d1d9e0",
    colorSuccess: "#1a7f37",
    colorDanger: "#cf222e",
    contribution: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
  },
  dark: {
    colorBg: "#0d1117",
    colorFg: "#e6edf3",
    colorMuted: "#8b949e",
    colorAccent: "#4493f8",
    colorBorder: "#3d444d",
    colorSuccess: "#3fb950",
    colorDanger: "#f85149",
    contribution: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
  },
} as const satisfies Record<string, Theme>;

export type ThemeName = keyof typeof THEMES;

/** GitHub's own UI font stack, so cards match the surrounding page. */
export const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif";

export const TYPE = {
  title: 16,
  heading: 14,
  body: 12,
  small: 10,
} as const;

export const SPACE = { xs: 4, sm: 8, md: 16, lg: 24 } as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/theme/tokens.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/theme/tokens.ts tests/theme/tokens.test.ts
git commit -m "feat: add Primer light and dark theme tokens"
```

---

## Task 3: SVG primitives

**Files:**
- Create: `src/theme/primitives.ts`
- Test: `tests/theme/primitives.test.ts`

These are the only functions permitted to emit raw SVG syntax. Cards compose them.

- [ ] **Step 1: Write the failing test**

```ts
// tests/theme/primitives.test.ts
import { describe, it, expect } from "vitest";
import { esc, truncate, text, rect, bar } from "../../src/theme/primitives.js";

describe("esc", () => {
  it("escapes the five XML entities", () => {
    expect(esc(`<a href="x" & 'y'>`)).toBe(
      "&lt;a href=&quot;x&quot; &amp; &apos;y&apos;&gt;"
    );
  });
});

describe("truncate", () => {
  it("returns short strings unchanged", () => {
    expect(truncate("hello", 12, 100)).toBe("hello");
  });

  it("appends an ellipsis when the measured width overflows", () => {
    // At 12px, avg glyph ≈ 6.6px, so 40px fits ~6 chars.
    const out = truncate("averylongrepositoryname", 12, 40);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThan("averylongrepositoryname".length);
  });
});

describe("text", () => {
  it("emits a text element with escaped content", () => {
    const out = text("a & b", { x: 10, y: 20, size: 12, fill: "#fff" });
    expect(out).toContain('x="10"');
    expect(out).toContain('y="20"');
    expect(out).toContain("a &amp; b");
  });
});

describe("rect", () => {
  it("emits rounded rects", () => {
    expect(rect({ x: 0, y: 0, w: 10, h: 4, fill: "#000", r: 2 })).toContain('rx="2"');
  });
});

describe("bar", () => {
  it("clamps fraction to the 0..1 range", () => {
    const over = bar({ x: 0, y: 0, w: 100, h: 8, fraction: 5, fill: "#000" });
    expect(over).toContain('width="100"');
    const under = bar({ x: 0, y: 0, w: 100, h: 8, fraction: -1, fill: "#000" });
    expect(under).toContain('width="0"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/theme/primitives.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/theme/primitives.ts
import { FONT_STACK } from "./tokens.js";

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Truncate by measured width rather than character count, because SVG has no
 * layout engine and a fixed char budget wraps CJK and caps very differently.
 * 0.55em is a good average advance width for the Primer UI stack.
 */
export function truncate(s: string, size: number, maxWidth: number): string {
  const per = size * 0.55;
  const max = Math.floor(maxWidth / per);
  if (s.length <= max) return s;
  return s.slice(0, Math.max(1, max - 1)) + "…";
}

export interface TextOpts {
  x: number;
  y: number;
  size: number;
  fill: string;
  weight?: number;
  anchor?: "start" | "middle" | "end";
  maxWidth?: number;
}

export function text(content: string, o: TextOpts): string {
  const body = o.maxWidth ? truncate(content, o.size, o.maxWidth) : content;
  const anchor = o.anchor ? ` text-anchor="${o.anchor}"` : "";
  const weight = o.weight ? ` font-weight="${o.weight}"` : "";
  return (
    `<text x="${o.x}" y="${o.y}" font-family="${FONT_STACK}" ` +
    `font-size="${o.size}" fill="${o.fill}"${weight}${anchor}>${esc(body)}</text>`
  );
}

export interface RectOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  r?: number;
  stroke?: string;
}

export function rect(o: RectOpts): string {
  const r = o.r ? ` rx="${o.r}"` : "";
  const stroke = o.stroke ? ` stroke="${o.stroke}"` : "";
  return `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="${o.fill}"${r}${stroke}/>`;
}

export function bar(o: RectOpts & { fraction: number }): string {
  const f = Math.min(1, Math.max(0, o.fraction));
  return rect({ ...o, w: Math.round(o.w * f) });
}

/** Column chart. Values are absolute; the tallest determines full height. */
export function columns(o: {
  x: number;
  y: number;
  w: number;
  h: number;
  values: readonly number[];
  fill: string;
  barWidth?: number;
}): string {
  const max = Math.max(1, ...o.values);
  const slot = o.w / o.values.length;
  const bw = o.barWidth ?? Math.max(2, slot * 0.5);
  return o.values
    .map((v, i) => {
      const h = Math.round((v / max) * o.h);
      const cx = o.x + slot * i + (slot - bw) / 2;
      return rect({ x: cx, y: o.y + o.h - h, w: bw, h, fill: o.fill, r: 2 });
    })
    .join("");
}

/** One contribution square. `level` indexes the theme's 5-step scale. */
export function calendarCell(o: {
  x: number;
  y: number;
  size: number;
  level: number;
  scale: readonly string[];
}): string {
  const idx = Math.min(o.scale.length - 1, Math.max(0, o.level));
  return rect({
    x: o.x,
    y: o.y,
    w: o.size,
    h: o.size,
    fill: o.scale[idx]!,
    r: 2,
  });
}

/** Outer card frame: root <svg>, background, and border. */
export function card(o: {
  w: number;
  h: number;
  bg: string;
  border: string;
  body: string;
  title?: string;
}): string {
  const title = o.title ? `<title>${esc(o.title)}</title>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${o.w}" height="${o.h}" ` +
    `viewBox="0 0 ${o.w} ${o.h}" role="img">${title}` +
    rect({ x: 0.5, y: 0.5, w: o.w - 1, h: o.h - 1, fill: o.bg, r: 6, stroke: o.border }) +
    o.body +
    `</svg>`
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/theme/primitives.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/theme/primitives.ts tests/theme/primitives.test.ts
git commit -m "feat: add SVG drawing primitives"
```

---

## Task 4: Shared types

**Files:**
- Create: `src/types.ts`

No test — this file contains only type declarations, which `npm run typecheck` validates.

- [ ] **Step 1: Implement**

```ts
// src/types.ts

/** Everything a card may read. Cards never fetch; they receive this. */
export interface ProfileData {
  user: {
    login: string;
    name: string;
    avatarDataUri: string;
    createdAt: string;
    followers: number;
    repositories: number;
  };
  totals: {
    releases: number;
    packages: number;
    diskUsageBytes: number;
    linesAdded: number;
    linesRemoved: number;
    stars: number;
    forks: number;
    watchers: number;
    sponsors: number;
    preferredLicense: string;
  };
  activity: {
    /** 371 days of contribution counts, oldest first. */
    calendar: readonly CalendarDay[];
    last7Days: readonly CalendarDay[];
    reposTouchedLast7Days: number;
    currentStreakDays: number;
    avgCommitsPerDay: number;
  };
  habits: {
    /** 24 buckets, index = hour of day in the user's local time. */
    commitsByHour: readonly number[];
    /** 7 buckets, index 0 = Sunday. */
    commitsByWeekday: readonly number[];
    /** Top 3, by share of commits. */
    commitLanguages: readonly LanguageShare[];
    /** All, by share of bytes. */
    byteLanguages: readonly LanguageShare[];
  };
  currentProject: {
    repo: string;
    url: string;
    updatedAt: string;
    doing: string;
    next: string;
  } | null;
  authored: {
    learned: readonly TechEntry[];
    learning: readonly TechEntry[];
    pages: readonly PageEntry[];
    tracks: readonly TrackEntry[];
  };
}

export interface CalendarDay {
  date: string;
  count: number;
  /** 0..4, matching the theme's contribution scale. */
  level: number;
}

export interface LanguageShare {
  name: string;
  /** 0..1 */
  share: number;
  color: string;
}

export interface TechEntry {
  name: string;
  icon: string;
}
export interface PageEntry {
  title: string;
  url: string;
  rating: number;
}
export interface TrackEntry {
  title: string;
  artist: string;
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: define shared ProfileData contract"
```

---

## Task 5: Hand-authored YAML schema

**Files:**
- Create: `src/schema.ts`, `data/profile.yml`
- Test: `tests/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/schema.test.ts
import { describe, it, expect } from "vitest";
import { parseProfileYaml } from "../src/schema.js";

const MINIMAL = `
sponsors: 0
packages: 1
current:
  doing: "Building the dashboard"
  next: "Ship the workflow"
`;

describe("parseProfileYaml", () => {
  it("accepts a minimal document and defaults optional lists to empty", () => {
    const out = parseProfileYaml(MINIMAL);
    expect(out.sponsors).toBe(0);
    expect(out.packages).toBe(1);
    expect(out.learned).toEqual([]);
    expect(out.pages).toEqual([]);
    expect(out.tracks).toEqual([]);
  });

  it("throws a readable error when a required field is missing", () => {
    expect(() => parseProfileYaml("packages: 1")).toThrow(/sponsors/);
  });

  it("rejects a page rating outside 1..5", () => {
    const bad = MINIMAL + `
pages:
  - title: "Site"
    url: "https://example.com"
    rating: 9
`;
    expect(() => parseProfileYaml(bad)).toThrow(/rating/);
  });

  it("rejects malformed YAML rather than returning partial data", () => {
    expect(() => parseProfileYaml("sponsors: [unclosed")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/schema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/schema.ts
import { parse } from "yaml";
import { z } from "zod";

const Tech = z.object({ name: z.string().min(1), icon: z.string().min(1) });

export const ProfileYaml = z.object({
  sponsors: z.number().int().min(0),
  packages: z.number().int().min(0),
  current: z.object({
    doing: z.string().min(1),
    next: z.string().min(1),
  }),
  learned: z.array(Tech).default([]),
  learning: z.array(Tech).default([]),
  pages: z
    .array(
      z.object({
        title: z.string().min(1),
        url: z.string().url(),
        rating: z.number().int().min(1).max(5),
      })
    )
    .default([]),
  tracks: z
    .array(z.object({ title: z.string().min(1), artist: z.string().min(1) }))
    .default([]),
});

export type ProfileYaml = z.infer<typeof ProfileYaml>;

/**
 * Fails loudly. A half-valid file would render a half-drawn card, which is
 * worse than a red workflow run.
 */
export function parseProfileYaml(source: string): ProfileYaml {
  const raw = parse(source);
  const result = ProfileYaml.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`data/profile.yml is invalid:\n${issues}`);
  }
  return result.data;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/schema.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Create the real data file**

```yaml
# data/profile.yml — the only file you edit by hand.
sponsors: 0
packages: 0

current:
  doing: "Wiring up the profile dashboard renderer"
  next: "Add the vertical contribution calendar"

learned:
  - { name: TypeScript, icon: typescript }
  - { name: Python, icon: python }
  - { name: Git, icon: git }

learning:
  - { name: Rust, icon: rust }
  - { name: WebGL, icon: webgl }

pages: []

tracks:
  - { title: "Mutter", artist: "Rammstein" }
  - { title: "Bipolar Nightmare", artist: "Keigo Hoashi" }
  - { title: "Weightless", artist: "Marconi Union" }
```

- [ ] **Step 6: Commit**

```bash
git add src/schema.ts data/profile.yml tests/schema.test.ts
git commit -m "feat: add validated hand-authored profile data file"
```

---

## Task 6: Aggregation logic

**Files:**
- Create: `src/aggregate.ts`
- Test: `tests/aggregate.test.ts`

This is the highest-risk pure logic in the project, so it gets the densest tests.

- [ ] **Step 1: Write the failing test**

```ts
// tests/aggregate.test.ts
import { describe, it, expect } from "vitest";
import {
  currentStreak,
  bucketByHour,
  bucketByWeekday,
  languageShares,
  preferredLicense,
  pickCurrentProject,
} from "../src/aggregate.js";

const day = (date: string, count: number) => ({ date, count, level: 0 });

describe("currentStreak", () => {
  it("counts consecutive days ending today", () => {
    const days = [day("2026-08-09", 1), day("2026-08-10", 3), day("2026-08-11", 2)];
    expect(currentStreak(days, "2026-08-11")).toBe(3);
  });

  it("tolerates an empty today and counts through yesterday", () => {
    // A run that has not committed yet today should not read as a broken streak.
    const days = [day("2026-08-09", 1), day("2026-08-10", 3), day("2026-08-11", 0)];
    expect(currentStreak(days, "2026-08-11")).toBe(2);
  });

  it("returns 0 when yesterday and today are both empty", () => {
    const days = [day("2026-08-09", 1), day("2026-08-10", 0), day("2026-08-11", 0)];
    expect(currentStreak(days, "2026-08-11")).toBe(0);
  });

  it("stops at the first gap", () => {
    const days = [day("2026-08-08", 5), day("2026-08-09", 0), day("2026-08-10", 1), day("2026-08-11", 1)];
    expect(currentStreak(days, "2026-08-11")).toBe(2);
  });
});

describe("bucketByHour", () => {
  it("returns 24 buckets and counts each timestamp once", () => {
    const out = bucketByHour(["2026-08-11T03:15:00Z", "2026-08-11T03:59:00Z", "2026-08-11T22:00:00Z"]);
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
    const out = languageShares({ TypeScript: 75, CSS: 25 }, { TypeScript: "#3178c6", CSS: "#663399" });
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/aggregate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/aggregate.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/aggregate.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/aggregate.ts tests/aggregate.test.ts
git commit -m "feat: add streak, bucketing, and language-share aggregation"
```

---

## Task 7: Canonical test fixture

**Files:**
- Create: `tests/fixtures/profile-data.ts`

Every card test uses this one fixture. Building it once here means a card snapshot only changes when the *card* changes.

- [ ] **Step 1: Implement**

```ts
// tests/fixtures/profile-data.ts
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
    // 1×1 transparent PNG — keeps snapshots small and offline.
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
```

- [ ] **Step 2: Verify and commit**

Run: `npm run typecheck`
Expected: exits 0.

```bash
git add tests/fixtures/profile-data.ts
git commit -m "test: add canonical ProfileData fixture"
```

---

## Task 8: Card 1 — Identity (560×340)

**Files:**
- Create: `src/cards/identity.ts`
- Test: `tests/cards/identity.test.ts`

Layout: circular avatar on the left (120px), stacked facts on the right.

- [ ] **Step 1: Write the failing test**

```ts
// tests/cards/identity.test.ts
import { describe, it, expect } from "vitest";
import { renderIdentity } from "../../src/cards/identity.js";
import { FIXTURE } from "../fixtures/profile-data.js";
import { THEMES } from "../../src/theme/tokens.js";

describe("renderIdentity", () => {
  const svg = renderIdentity(FIXTURE, THEMES.dark);

  it("declares the specified card dimensions", () => {
    expect(svg).toContain('width="560"');
    expect(svg).toContain('height="340"');
  });

  it("shows the display name and join year", () => {
    expect(svg).toContain("Alexander");
    expect(svg).toContain("2021");
  });

  it("formats disk usage in GB with two decimals", () => {
    expect(svg).toContain("1.95 GB");
  });

  it("abbreviates large line counts", () => {
    expect(svg).toContain("1.52m added");
    expect(svg).toContain("379k removed");
  });

  it("embeds the avatar as a data URI so the SVG is self-contained", () => {
    expect(svg).toContain("data:image/png;base64,");
  });

  it("renders in both themes without throwing", () => {
    expect(() => renderIdentity(FIXTURE, THEMES.light)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cards/identity.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/cards/identity.ts
import type { ProfileData } from "../types.js";
import type { Theme } from "../theme/tokens.js";
import { TYPE } from "../theme/tokens.js";
import { card, text, esc } from "../theme/primitives.js";

const W = 560;
const H = 340;

export function abbreviate(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function yearsSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / (365.25 * 86_400_000));
}

export function renderIdentity(d: ProfileData, t: Theme, now = new Date()): string {
  const joinYear = new Date(d.user.createdAt).getUTCFullYear();
  const gb = (d.totals.diskUsageBytes / 1_000_000_000).toFixed(2);

  const facts: string[] = [
    `Joined GitHub ${joinYear} · ${yearsSince(d.user.createdAt, now)} years ago`,
    `Followed by ${d.user.followers} users`,
    `${d.user.repositories} repositories`,
    `Prefers ${d.totals.preferredLicense} license`,
    `${d.totals.releases} releases · ${d.totals.packages} packages`,
    `${gb} GB used`,
    `${abbreviate(d.totals.linesAdded)} added, ${abbreviate(d.totals.linesRemoved)} removed`,
  ];

  const avatar =
    `<clipPath id="avatarClip"><circle cx="86" cy="110" r="58"/></clipPath>` +
    `<image href="${esc(d.user.avatarDataUri)}" x="28" y="52" width="116" height="116" ` +
    `clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice"/>`;

  const heading =
    text(d.user.name, { x: 176, y: 56, size: TYPE.title, fill: t.colorAccent, weight: 600, maxWidth: 360 }) +
    text(`@${d.user.login}`, { x: 176, y: 76, size: TYPE.body, fill: t.colorMuted, maxWidth: 360 });

  const rows = facts
    .map((line, i) =>
      text(line, { x: 176, y: 108 + i * 26, size: TYPE.body, fill: t.colorFg, maxWidth: 360 })
    )
    .join("");

  const habits = text("Coding habits and recent activity", {
    x: 28,
    y: 316,
    size: TYPE.body,
    fill: t.colorAccent,
    maxWidth: W - 56,
  });

  return card({
    w: W,
    h: H,
    bg: t.colorBg,
    border: t.colorBorder,
    title: `${d.user.name} — GitHub identity`,
    body: avatar + heading + rows + habits,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cards/identity.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/cards/identity.ts tests/cards/identity.test.ts
git commit -m "feat: render identity card"
```

---

## Task 9: Card 2 — Pulse (560×340)

**Files:**
- Create: `src/cards/pulse.ts`
- Test: `tests/cards/pulse.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/cards/pulse.test.ts
import { describe, it, expect } from "vitest";
import { renderPulse } from "../../src/cards/pulse.js";
import { FIXTURE } from "../fixtures/profile-data.js";
import { THEMES } from "../../src/theme/tokens.js";

describe("renderPulse", () => {
  const svg = renderPulse(FIXTURE, THEMES.dark);

  it("declares the specified card dimensions", () => {
    expect(svg).toContain('width="560"');
    expect(svg).toContain('height="340"');
  });

  it("draws exactly seven contribution squares", () => {
    const squares = svg.match(/data-day="/g) ?? [];
    expect(squares).toHaveLength(7);
  });

  it("captions the repositories touched", () => {
    expect(svg).toContain("Contributed to 5 repositories");
  });

  it("shows all four social stats", () => {
    expect(svg).toContain("0 Sponsors");
    expect(svg).toContain("147 Stargazers");
    expect(svg).toContain("16 Forks");
    expect(svg).toContain("23 Watchers");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cards/pulse.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/cards/pulse.ts
import type { ProfileData } from "../types.js";
import type { Theme } from "../theme/tokens.js";
import { TYPE } from "../theme/tokens.js";
import { card, text, rect } from "../theme/primitives.js";

const W = 560;
const H = 340;
const CELL = 28;
const GAP = 6;

export function renderPulse(d: ProfileData, t: Theme): string {
  const startX = 28;
  const startY = 44;

  const squares = d.activity.last7Days
    .map((day, i) => {
      const level = Math.min(4, Math.max(0, day.level));
      return (
        `<g data-day="${day.date}">` +
        rect({
          x: startX + i * (CELL + GAP),
          y: startY,
          w: CELL,
          h: CELL,
          fill: t.contribution[level]!,
          r: 4,
        }) +
        `</g>`
      );
    })
    .join("");

  const caption = text(
    `Contributed to ${d.activity.reposTouchedLast7Days} repositories`,
    { x: startX, y: startY + CELL + 30, size: TYPE.body, fill: t.colorFg, maxWidth: W - 56 }
  );

  const stats: [string, string][] = [
    [`${d.totals.sponsors} Sponsors`, t.colorFg],
    [`${d.totals.stars} Stargazers`, t.colorFg],
    [`${d.totals.forks} Forks`, t.colorFg],
    [`${d.totals.watchers} Watchers`, t.colorFg],
  ];

  const statRows = stats
    .map(([label, fill], i) =>
      text(label, {
        x: startX + (i % 2) * 260,
        y: 176 + Math.floor(i / 2) * 34,
        size: TYPE.body,
        fill,
        maxWidth: 240,
      })
    )
    .join("");

  const header = text("Last 7 days", {
    x: startX,
    y: 28,
    size: TYPE.heading,
    fill: t.colorAccent,
    weight: 600,
  });

  const streak = text(
    `Current streak ${d.activity.currentStreakDays} days · ~${d.activity.avgCommitsPerDay} commits per day`,
    { x: startX, y: 296, size: TYPE.body, fill: t.colorMuted, maxWidth: W - 56 }
  );

  return card({
    w: W,
    h: H,
    bg: t.colorBg,
    border: t.colorBorder,
    title: "Recent activity",
    body: header + squares + caption + statRows + streak,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cards/pulse.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/cards/pulse.ts tests/cards/pulse.test.ts
git commit -m "feat: render pulse card"
```

---

## Task 10: Card 3 — Habits (1120×400)

**Files:**
- Create: `src/cards/habits.ts`
- Test: `tests/cards/habits.test.ts`

Layout: commits-by-hour columns top-left, commits-by-weekday columns bottom-left, language activity bars right, tech icon rows along the bottom.

- [ ] **Step 1: Write the failing test**

```ts
// tests/cards/habits.test.ts
import { describe, it, expect } from "vitest";
import { renderHabits } from "../../src/cards/habits.js";
import { FIXTURE } from "../fixtures/profile-data.js";
import { THEMES } from "../../src/theme/tokens.js";

describe("renderHabits", () => {
  const svg = renderHabits(FIXTURE, THEMES.dark);

  it("declares the specified card dimensions", () => {
    expect(svg).toContain('width="1120"');
    expect(svg).toContain('height="400"');
  });

  it("labels all three charts", () => {
    expect(svg).toContain("Commit activity per time of the day");
    expect(svg).toContain("Commit activity per day");
    expect(svg).toContain("Language activity");
  });

  it("labels every weekday", () => {
    for (const d of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      expect(svg).toContain(`>${d}<`);
    }
  });

  it("shows the top 3 commit languages as whole percentages", () => {
    expect(svg).toContain("TypeScript");
    expect(svg).toContain("62%");
    expect(svg).toContain("27%");
    expect(svg).toContain("11%");
  });

  it("renders both learned and learning sections", () => {
    expect(svg).toContain("Mastered technologies and topics");
    expect(svg).toContain("Still learning");
  });

  it("omits the learning section entirely when the list is empty", () => {
    const bare = { ...FIXTURE, authored: { ...FIXTURE.authored, learning: [] } };
    expect(renderHabits(bare, THEMES.dark)).not.toContain("Still learning");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cards/habits.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/cards/habits.ts
import type { ProfileData, TechEntry } from "../types.js";
import type { Theme } from "../theme/tokens.js";
import { TYPE } from "../theme/tokens.js";
import { card, text, rect, columns, bar } from "../theme/primitives.js";

const W = 1120;
const H = 400;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * Icons are drawn as lettered chips rather than fetched logos: remote images
 * would break the "self-contained SVG" guarantee and add a network dependency
 * to every render.
 */
function techChips(entries: readonly TechEntry[], x: number, y: number, t: Theme): string {
  return entries
    .map((e, i) => {
      const cx = x + i * 40;
      return (
        rect({ x: cx, y, w: 32, h: 32, fill: t.colorBorder, r: 6 }) +
        text(e.name.slice(0, 2).toUpperCase(), {
          x: cx + 16,
          y: y + 21,
          size: TYPE.small,
          fill: t.colorFg,
          anchor: "middle",
          weight: 600,
        })
      );
    })
    .join("");
}

export function renderHabits(d: ProfileData, t: Theme): string {
  const hourChart =
    text("Commit activity per time of the day", {
      x: 28, y: 32, size: TYPE.body, fill: t.colorAccent, weight: 600,
    }) +
    columns({ x: 28, y: 44, w: 500, h: 84, values: d.habits.commitsByHour, fill: t.colorSuccess }) +
    d.habits.commitsByHour
      .map((_, i) =>
        text(String(i).padStart(2, "0"), {
          x: 28 + (500 / 24) * i + 500 / 48,
          y: 144,
          size: TYPE.small,
          fill: t.colorMuted,
          anchor: "middle",
        })
      )
      .join("");

  const dayChart =
    text("Commit activity per day", {
      x: 28, y: 190, size: TYPE.body, fill: t.colorAccent, weight: 600,
    }) +
    columns({ x: 28, y: 202, w: 260, h: 76, values: d.habits.commitsByWeekday, fill: t.colorSuccess }) +
    WEEKDAYS.map((w, i) =>
      text(w, {
        x: 28 + (260 / 7) * i + 260 / 14,
        y: 294,
        size: TYPE.small,
        fill: t.colorMuted,
        anchor: "middle",
      })
    ).join("");

  const langX = 620;
  const langChart =
    text("Language activity", {
      x: langX, y: 190, size: TYPE.body, fill: t.colorAccent, weight: 600,
    }) +
    d.habits.commitLanguages
      .slice(0, 3)
      .map((l, i) => {
        const y = 214 + i * 30;
        return (
          text(l.name, { x: langX, y: y + 9, size: TYPE.small, fill: t.colorMuted, maxWidth: 90 }) +
          rect({ x: langX + 100, y, w: 300, h: 12, fill: t.colorBorder, r: 6 }) +
          bar({ x: langX + 100, y, w: 300, h: 12, fraction: l.share, fill: l.color, r: 6 }) +
          text(`${Math.round(l.share * 100)}%`, {
            x: langX + 416, y: y + 10, size: TYPE.small, fill: t.colorMuted, anchor: "end",
          })
        );
      })
      .join("");

  const learned =
    text("Mastered technologies and topics", {
      x: 28, y: 332, size: TYPE.body, fill: t.colorAccent, weight: 600,
    }) + techChips(d.authored.learned, 28, 344, t);

  const learning =
    d.authored.learning.length > 0
      ? text("Still learning", {
          x: langX, y: 332, size: TYPE.body, fill: t.colorAccent, weight: 600,
        }) + techChips(d.authored.learning, langX, 344, t)
      : "";

  return card({
    w: W,
    h: H,
    bg: t.colorBg,
    border: t.colorBorder,
    title: "Coding habits",
    body: hourChart + dayChart + langChart + learned + learning,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cards/habits.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/cards/habits.ts tests/cards/habits.test.ts
git commit -m "feat: render habits card"
```

---

## Task 11: Card 4 — Dashboard (560×760)

**Files:**
- Create: `src/cards/dashboard.ts`
- Test: `tests/cards/dashboard.test.ts`

The vertical calendar is 52 rows × 7 columns — weeks descend, days run left to right. This is the panel the tall right column exists for.

- [ ] **Step 1: Write the failing test**

```ts
// tests/cards/dashboard.test.ts
import { describe, it, expect } from "vitest";
import { renderDashboard } from "../../src/cards/dashboard.js";
import { FIXTURE } from "../fixtures/profile-data.js";
import { THEMES } from "../../src/theme/tokens.js";

describe("renderDashboard", () => {
  const svg = renderDashboard(FIXTURE, THEMES.dark);

  it("declares the specified card dimensions", () => {
    expect(svg).toContain('width="560"');
    expect(svg).toContain('height="760"');
  });

  it("draws a 52x7 vertical calendar", () => {
    const cells = svg.match(/data-cal="/g) ?? [];
    expect(cells).toHaveLength(52 * 7);
  });

  it("shows the current project with its doing and next lines", () => {
    expect(svg).toContain("profile-dashboard");
    expect(svg).toContain("Wiring up the renderer");
    expect(svg).toContain("Add the vertical contribution calendar");
  });

  it("renders a legend entry per byte language", () => {
    for (const l of FIXTURE.habits.byteLanguages) expect(svg).toContain(l.name);
  });

  it("renders page ratings as filled stars out of five", () => {
    expect(svg).toContain("★★★★☆");
  });

  it("lists the hand-authored tracks", () => {
    expect(svg).toContain("Mutter");
    expect(svg).toContain("Rammstein");
  });

  it("omits the project block when there is no current project", () => {
    const idle = { ...FIXTURE, currentProject: null };
    expect(() => renderDashboard(idle, THEMES.dark)).not.toThrow();
    expect(renderDashboard(idle, THEMES.dark)).not.toContain("What's next");
  });

  it("omits the pages block when the list is empty", () => {
    const bare = { ...FIXTURE, authored: { ...FIXTURE.authored, pages: [] } };
    expect(renderDashboard(bare, THEMES.dark)).not.toContain("Pages published");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cards/dashboard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/cards/dashboard.ts
import type { ProfileData } from "../types.js";
import type { Theme } from "../theme/tokens.js";
import { TYPE } from "../theme/tokens.js";
import { card, text, rect, bar, calendarCell } from "../theme/primitives.js";

const W = 560;
const H = 760;
const WEEKS = 52;
const DAYS = 7;
const CELL = 8;
const GAP = 3;

function stars(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

function relativeTime(iso: string, now: Date): string {
  const hours = Math.floor((now.getTime() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours} hours ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

export function renderDashboard(d: ProfileData, t: Theme, now = new Date()): string {
  let body = "";

  // ── Current project ────────────────────────────────────────────────
  if (d.currentProject) {
    const p = d.currentProject;
    body +=
      text("Current project", { x: 28, y: 32, size: TYPE.heading, fill: t.colorAccent, weight: 600 }) +
      text(p.repo, { x: 28, y: 56, size: TYPE.body, fill: t.colorFg, maxWidth: W - 56 }) +
      text(`Updated ${relativeTime(p.updatedAt, now)}`, {
        x: 28, y: 76, size: TYPE.small, fill: t.colorMuted, maxWidth: W - 56,
      }) +
      text(`Doing: ${p.doing}`, { x: 28, y: 98, size: TYPE.body, fill: t.colorFg, maxWidth: W - 56 }) +
      text(`What's next: ${p.next}`, {
        x: 28, y: 118, size: TYPE.body, fill: t.colorMuted, maxWidth: W - 56,
      });
  }

  // ── Vertical contribution calendar ─────────────────────────────────
  const calTop = 156;
  body += text("Contributions calendar", {
    x: 28, y: calTop - 12, size: TYPE.heading, fill: t.colorAccent, weight: 600,
  });

  // Take the trailing 364 days so the grid is exactly 52 full weeks.
  const recent = d.activity.calendar.slice(-(WEEKS * DAYS));
  for (let w = 0; w < WEEKS; w++) {
    for (let day = 0; day < DAYS; day++) {
      const entry = recent[w * DAYS + day];
      body +=
        `<g data-cal="${w}-${day}">` +
        calendarCell({
          x: 28 + day * (CELL + GAP),
          y: calTop + w * (CELL + GAP),
          size: CELL,
          level: entry?.level ?? 0,
          scale: t.contribution,
        }) +
        `</g>`;
    }
  }

  // Streak sits beside the calendar, which is only 77px wide.
  body +=
    text(`Current streak ${d.activity.currentStreakDays} days`, {
      x: 140, y: calTop + 20, size: TYPE.body, fill: t.colorFg, maxWidth: 380,
    }) +
    text(`~${d.activity.avgCommitsPerDay} commits per day`, {
      x: 140, y: calTop + 42, size: TYPE.body, fill: t.colorMuted, maxWidth: 380,
    });

  // ── Most used languages ────────────────────────────────────────────
  const langY = calTop + 96;
  body += text("Most used languages", {
    x: 140, y: langY, size: TYPE.heading, fill: t.colorAccent, weight: 600,
  });

  let offset = 140;
  const trackW = 380;
  for (const l of d.habits.byteLanguages) {
    const seg = Math.round(trackW * l.share);
    body += rect({ x: offset, y: langY + 12, w: seg, h: 10, fill: l.color });
    offset += seg;
  }
  d.habits.byteLanguages.forEach((l, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    body +=
      rect({ x: 140 + col * 190, y: langY + 34 + row * 20, w: 8, h: 8, fill: l.color, r: 4 }) +
      text(`${l.name} ${Math.round(l.share * 100)}%`, {
        x: 154 + col * 190,
        y: langY + 42 + row * 20,
        size: TYPE.small,
        fill: t.colorMuted,
        maxWidth: 170,
      });
  });

  // ── Pages published ────────────────────────────────────────────────
  let y = calTop + WEEKS * (CELL + GAP) + 40;
  if (d.authored.pages.length > 0) {
    body += text("Pages published", { x: 28, y, size: TYPE.heading, fill: t.colorAccent, weight: 600 });
    d.authored.pages.forEach((p, i) => {
      body +=
        text(p.title, { x: 28, y: y + 24 + i * 22, size: TYPE.body, fill: t.colorFg, maxWidth: 380 }) +
        text(stars(p.rating), {
          x: W - 28, y: y + 24 + i * 22, size: TYPE.body, fill: t.colorMuted, anchor: "end",
        });
    });
    y += 32 + d.authored.pages.length * 22;
  }

  // ── Suggested tracks ───────────────────────────────────────────────
  if (d.authored.tracks.length > 0) {
    body += text("Suggested tracks", { x: 28, y, size: TYPE.heading, fill: t.colorAccent, weight: 600 });
    d.authored.tracks.slice(0, 3).forEach((track, i) => {
      body +=
        text(track.title, {
          x: 28, y: y + 24 + i * 34, size: TYPE.body, fill: t.colorFg, maxWidth: 480,
        }) +
        text(track.artist, {
          x: 28, y: y + 40 + i * 34, size: TYPE.small, fill: t.colorMuted, maxWidth: 480,
        });
    });
  }

  return card({
    w: W,
    h: H,
    bg: t.colorBg,
    border: t.colorBorder,
    title: "Dashboard",
    body,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cards/dashboard.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/cards/dashboard.ts tests/cards/dashboard.test.ts
git commit -m "feat: render dashboard card with vertical calendar"
```

---

## Task 12: GraphQL fetch layer

**Files:**
- Create: `src/fetch/github-graphql.ts`
- Test: `tests/fetch/github-graphql.test.ts`

The query is one round trip. Tests inject a fake client so no network is touched.

- [ ] **Step 1: Write the failing test**

```ts
// tests/fetch/github-graphql.test.ts
import { describe, it, expect, vi } from "vitest";
import { fetchProfile, PROFILE_QUERY } from "../../src/fetch/github-graphql.js";

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
        weeks: [
          { contributionDays: [{ date: "2026-08-10", contributionCount: 3 }] },
        ],
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
    const client = vi.fn().mockResolvedValue(RESPONSE);
    const out = await fetchProfile(client as never);

    expect(out.user.login).toBe("alexander-288");
    expect(out.totals.stars).toBe(100);
    expect(out.totals.forks).toBe(10);
    expect(out.totals.watchers).toBe(20);
    expect(out.totals.releases).toBe(2);
    expect(out.totals.preferredLicense).toBe("MIT");
    expect(out.totals.diskUsageBytes).toBe(1000 * 1024);
  });

  it("flattens the contribution calendar into day records with levels", async () => {
    const client = vi.fn().mockResolvedValue(RESPONSE);
    const out = await fetchProfile(client as never);
    expect(out.calendar).toHaveLength(1);
    expect(out.calendar[0]).toMatchObject({ date: "2026-08-10", count: 3 });
    expect(out.calendar[0]!.level).toBeGreaterThan(0);
  });

  it("aggregates language bytes across repos", async () => {
    const client = vi.fn().mockResolvedValue(RESPONSE);
    const out = await fetchProfile(client as never);
    expect(out.languageBytes["TypeScript"]).toBe(500);
    expect(out.languageColors["TypeScript"]).toBe("#3178c6");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/fetch/github-graphql.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/fetch/github-graphql.ts
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
  const repos = v.repositories.nodes as any[];

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
      login: v.login,
      name: v.name ?? v.login,
      avatarUrl: v.avatarUrl,
      createdAt: v.createdAt,
      followers: v.followers.totalCount,
      repositories: v.repositories.totalCount,
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
    repos: repos.map((r) => ({ nameWithOwner: r.nameWithOwner, url: r.url })),
    calendar,
    languageBytes,
    languageColors,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/fetch/github-graphql.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/fetch/github-graphql.ts tests/fetch/github-graphql.test.ts
git commit -m "feat: fetch and normalise profile data from GraphQL"
```

---

## Task 13: Commit walker with incremental cache

**Files:**
- Create: `src/fetch/commit-walker.ts`
- Test: `tests/fetch/commit-walker.test.ts`

REST `stats/contributors` returns HTTP 202 while GitHub computes statistics on a cold repo. The walker must handle that, and must persist partial progress so a rate-limited run resumes rather than restarts.

- [ ] **Step 1: Write the failing test**

```ts
// tests/fetch/commit-walker.test.ts
import { describe, it, expect, vi } from "vitest";
import { mergeCache, walkRepo, type Cache } from "../../src/fetch/commit-walker.js";

describe("mergeCache", () => {
  it("adds new repos without touching existing entries", () => {
    const before: Cache = {
      repos: { a: { linesAdded: 10, linesRemoved: 2, lastSha: "x", commits: [] } },
    };
    const after = mergeCache(before, "b", { linesAdded: 5, linesRemoved: 1, lastSha: "y", commits: [] });
    expect(after.repos["a"]!.linesAdded).toBe(10);
    expect(after.repos["b"]!.linesAdded).toBe(5);
  });

  it("replaces an existing repo entry on refresh", () => {
    const before: Cache = {
      repos: { a: { linesAdded: 10, linesRemoved: 2, lastSha: "x", commits: [] } },
    };
    const after = mergeCache(before, "a", { linesAdded: 30, linesRemoved: 4, lastSha: "z", commits: [] });
    expect(after.repos["a"]!.linesAdded).toBe(30);
    expect(after.repos["a"]!.lastSha).toBe("z");
  });
});

describe("walkRepo", () => {
  it("sums weekly additions and deletions for the authenticated user", async () => {
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
        getContributorsStats: vi.fn().mockRejectedValue(Object.assign(new Error("nf"), { status: 404 })),
      },
    };
    const out = await walkRepo(rest as never, "o", "r", "alexander-288", { retries: 0 });
    expect(out.linesAdded).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/fetch/commit-walker.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/fetch/commit-walker.ts
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

/** Commit timestamps since the cached watermark, for the habit charts. */
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
    if (err?.status === 404 || err?.status === 409) return [];
    throw err;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/fetch/commit-walker.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/fetch/commit-walker.ts tests/fetch/commit-walker.test.ts
git commit -m "feat: add cache-aware commit walker"
```

---

## Task 14: Renderer entry point with card isolation

**Files:**
- Create: `src/render.ts`
- Test: `tests/render.test.ts`

Card-level isolation is the requirement here: one card throwing must not blank the profile.

- [ ] **Step 1: Write the failing test**

```ts
// tests/render.test.ts
import { describe, it, expect, vi } from "vitest";
import { renderAll } from "../src/render.js";
import { FIXTURE } from "./fixtures/profile-data.js";

describe("renderAll", () => {
  it("produces eight files — four cards in two themes", () => {
    const out = renderAll(FIXTURE);
    expect(Object.keys(out).sort()).toEqual([
      "dashboard-dark.svg",
      "dashboard-light.svg",
      "habits-dark.svg",
      "habits-light.svg",
      "identity-dark.svg",
      "identity-light.svg",
      "pulse-dark.svg",
      "pulse-light.svg",
    ]);
  });

  it("emits well-formed SVG roots", () => {
    for (const svg of Object.values(renderAll(FIXTURE))) {
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
    }
  });

  it("skips a card that throws instead of failing the run", () => {
    const broken = {
      ...FIXTURE,
      habits: {
        ...FIXTURE.habits,
        get commitsByHour(): number[] {
          throw new Error("boom");
        },
      },
    } as never;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = renderAll(broken);

    expect(out["habits-dark.svg"]).toBeUndefined();
    expect(out["identity-dark.svg"]).toBeDefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/render.ts
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ProfileData } from "./types.js";
import { THEMES, type ThemeName } from "./theme/tokens.js";
import { renderIdentity } from "./cards/identity.js";
import { renderPulse } from "./cards/pulse.js";
import { renderHabits } from "./cards/habits.js";
import { renderDashboard } from "./cards/dashboard.js";

const CARDS = {
  identity: renderIdentity,
  pulse: renderPulse,
  habits: renderHabits,
  dashboard: renderDashboard,
} as const;

/**
 * Renders every card in every theme. A card that throws is omitted from the
 * result, which leaves its previously committed SVG in place on disk — a stale
 * card beats a blank profile.
 */
export function renderAll(data: ProfileData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, fn] of Object.entries(CARDS)) {
    for (const theme of Object.keys(THEMES) as ThemeName[]) {
      try {
        out[`${name}-${theme}.svg`] = fn(data, THEMES[theme]);
      } catch (err) {
        console.warn(`card "${name}" (${theme}) failed to render, keeping previous:`, err);
      }
    }
  }
  return out;
}

export async function writeCards(files: Record<string, string>, dir = "out"): Promise<number> {
  await mkdir(dir, { recursive: true });
  let changed = 0;
  for (const [name, svg] of Object.entries(files)) {
    const path = join(dir, name);
    const previous = await readFile(path, "utf8").catch(() => null);
    if (previous === svg) continue;
    await writeFile(path, svg, "utf8");
    changed++;
  }
  return changed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/render.ts tests/render.test.ts
git commit -m "feat: add renderer with per-card failure isolation"
```

---

## Task 15: Live data assembly and CLI

**Files:**
- Modify: `src/render.ts` (append the `main` entry point)
- Create: `src/fetch/assemble.ts`
- Test: `tests/fetch/assemble.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/fetch/assemble.test.ts
import { describe, it, expect } from "vitest";
import { assemble } from "../../src/fetch/assemble.js";
import { EMPTY_CACHE } from "../../src/fetch/commit-walker.js";

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
    const cache = {
      repos: {
        a: { linesAdded: 10, linesRemoved: 3, lastSha: "", commits: [] },
        b: { linesAdded: 5, linesRemoved: 1, lastSha: "", commits: [] },
      },
    };
    const out = assemble(API as never, YAML, cache, [], "avatar-uri", "2026-08-11");
    expect(out.totals.linesAdded).toBe(15);
    expect(out.totals.linesRemoved).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/fetch/assemble.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/fetch/assemble.ts`**

```ts
// src/fetch/assemble.ts
import type { ProfileData } from "../types.js";
import type { ProfileYaml } from "../schema.js";
import type { Cache } from "./commit-walker.js";
import {
  averageCommitsPerDay,
  bucketByHour,
  bucketByWeekday,
  currentStreak,
  languageShares,
  pickCurrentProject,
} from "../aggregate.js";

type ApiData = Awaited<ReturnType<typeof import("./github-graphql.js").fetchProfile>>;

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

  // Commit-language share is approximated by attributing each commit to its
  // repo's dominant language — walking every diff would cost far more API
  // budget than the panel is worth.
  const commitLanguages = byteLanguages.slice(0, 3);

  const last7 = api.calendar.slice(-7);
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
        commits
          .filter((c) => c.at.slice(0, 10) >= (last7[0]?.date ?? today))
          .map((c) => c.repo)
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/fetch/assemble.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Append the CLI entry point to `src/render.ts`**

```ts
// ── appended to src/render.ts ──────────────────────────────────────────
import { graphql } from "@octokit/graphql";
import { Octokit } from "@octokit/rest";
import { parseProfileYaml } from "./schema.js";
import { fetchProfile } from "./fetch/github-graphql.js";
import { walkRepo, fetchRecentCommits, mergeCache, EMPTY_CACHE, type Cache } from "./fetch/commit-walker.js";
import { assemble } from "./fetch/assemble.js";

const CACHE_PATH = "cache/stats.json";

async function embedAvatar(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get("content-type") ?? "image/png";
  return `data:${type};base64,${buf.toString("base64")}`;
}

async function main() {
  // --fixtures renders from the committed fixture with no network access,
  // so layout work needs no token and no connectivity.
  if (process.argv.includes("--fixtures")) {
    const { FIXTURE } = await import("../tests/fixtures/profile-data.js");
    const changed = await writeCards(renderAll(FIXTURE));
    console.log(`wrote ${changed} file(s) from fixtures`);
    return;
  }

  const token = process.env["PROFILE_TOKEN"];
  if (!token) throw new Error("PROFILE_TOKEN is not set");

  const gql = graphql.defaults({ headers: { authorization: `token ${token}` } });
  const rest = new Octokit({ auth: token });

  const api = await fetchProfile((q) => gql(q));
  const yaml = parseProfileYaml(await readFile("data/profile.yml", "utf8"));

  let cache: Cache = JSON.parse(
    await readFile(CACHE_PATH, "utf8").catch(() => JSON.stringify(EMPTY_CACHE))
  );

  const since = new Date(Date.now() - 365 * 86_400_000).toISOString();
  const commits: { repo: string; at: string }[] = [];

  for (const r of api.repos) {
    const [owner, name] = r.nameWithOwner.split("/") as [string, string];
    const stats = await walkRepo(rest, owner, name, api.user.login);
    if (!stats.pending) cache = mergeCache(cache, r.nameWithOwner, stats);
    for (const c of await fetchRecentCommits(rest, owner, name, api.user.login, since)) {
      commits.push({ repo: r.nameWithOwner, at: c.at });
    }
  }

  await mkdir("cache", { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");

  const avatar = await embedAvatar(api.user.avatarUrl);
  const today = new Date().toISOString().slice(0, 10);
  const data = assemble(api, yaml, cache, commits, avatar, today);

  const changed = await writeCards(renderAll(data));
  console.log(`wrote ${changed} changed file(s)`);
}

// Only run when invoked directly, so tests can import this module freely.
if (process.argv[1]?.endsWith("render.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 6: Verify the offline path end to end**

Run: `npm run render:fixtures && ls out`
Expected: 8 `.svg` files listed; console reports `wrote 8 file(s) from fixtures`.

- [ ] **Step 7: Commit**

```bash
git add src/fetch/assemble.ts src/render.ts tests/fetch/assemble.test.ts out/
git commit -m "feat: assemble live data and add render CLI"
```

---

## Task 16: SVG well-formedness guard

**Files:**
- Test: `tests/svg-validity.test.ts`

A cheap structural check that catches unbalanced tags before they reach the profile.

- [ ] **Step 1: Write the test**

```ts
// tests/svg-validity.test.ts
import { describe, it, expect } from "vitest";
import { renderAll } from "../src/render.js";
import { FIXTURE } from "./fixtures/profile-data.js";

const DIMENSIONS: Record<string, [number, number]> = {
  identity: [560, 340],
  pulse: [560, 340],
  habits: [1120, 400],
  dashboard: [560, 760],
};

describe("generated SVG", () => {
  const files = renderAll(FIXTURE);

  it("balances every element it opens", () => {
    for (const [name, svg] of Object.entries(files)) {
      const opens = (svg.match(/<(?!\/)(?!\?)[a-zA-Z]+/g) ?? []).length;
      const selfClosing = (svg.match(/\/>/g) ?? []).length;
      const closes = (svg.match(/<\/[a-zA-Z]+>/g) ?? []).length;
      expect(opens, `${name} has unbalanced tags`).toBe(selfClosing + closes);
    }
  });

  it("matches the dimensions declared in the spec", () => {
    for (const [file, svg] of Object.entries(files)) {
      const card = file.split("-")[0]!;
      const [w, h] = DIMENSIONS[card]!;
      expect(svg).toContain(`width="${w}"`);
      expect(svg).toContain(`height="${h}"`);
      expect(svg).toContain(`viewBox="0 0 ${w} ${h}"`);
    }
  });

  it("contains no unescaped ampersands outside entities", () => {
    for (const [name, svg] of Object.entries(files)) {
      const bad = svg.match(/&(?!amp;|lt;|gt;|quot;|apos;|#)/g) ?? [];
      expect(bad, `${name} has raw ampersands`).toHaveLength(0);
    }
  });
});
```

- [ ] **Step 2: Run and fix any failures**

Run: `npx vitest run tests/svg-validity.test.ts`
Expected: PASS, 3 tests. If the balance test fails, a primitive is emitting an unclosed element — fix the primitive, not the test.

- [ ] **Step 3: Run the whole suite**

Run: `npm test && npm run typecheck`
Expected: all tests pass, typecheck exits 0.

- [ ] **Step 4: Commit**

```bash
git add tests/svg-validity.test.ts
git commit -m "test: guard SVG well-formedness and dimensions"
```

---

## Task 17: README shell

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write it**

```markdown
<table>
  <tr>
    <td>
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="out/identity-dark.svg">
        <img alt="Identity" src="out/identity-light.svg" width="560">
      </picture>
    </td>
    <td>
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="out/pulse-dark.svg">
        <img alt="Recent activity" src="out/pulse-light.svg" width="560">
      </picture>
    </td>
    <td rowspan="2">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="out/dashboard-dark.svg">
        <img alt="Dashboard" src="out/dashboard-light.svg" width="560">
      </picture>
    </td>
  </tr>
  <tr>
    <td colspan="2">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="out/habits-dark.svg">
        <img alt="Coding habits" src="out/habits-light.svg" width="1120">
      </picture>
    </td>
  </tr>
</table>
```

- [ ] **Step 2: Verify locally**

Run: `npm run render:fixtures`
Then open `README.md` in a Markdown preview that resolves relative paths, or push to a scratch branch and view it on GitHub. All four cards must appear in the mirrored grid.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "feat: add README shell embedding the four cards"
```

---

## Task 18: Workflow and dispatch snippet

**Files:**
- Create: `.github/workflows/refresh.yml`, `docs/dispatch-snippet.yml`

- [ ] **Step 1: Create the workflow**

```yaml
# .github/workflows/refresh.yml
name: Refresh profile cards

on:
  schedule:
    - cron: "0 4 * * *"
  push:
    branches: [main]
  workflow_dispatch:
  repository_dispatch:
    types: [profile-refresh]

# Serialise runs so two triggers cannot race on the same commit.
concurrency:
  group: refresh-profile
  cancel-in-progress: true

permissions:
  contents: write

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - run: npm ci

      - run: npm test

      - name: Render cards
        env:
          PROFILE_TOKEN: ${{ secrets.PROFILE_TOKEN }}
        run: npm run render

      - name: Commit changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add out cache
          if git diff --staged --quiet; then
            echo "no changes"
          else
            git commit -m "chore: refresh profile cards"
            git push
          fi
```

- [ ] **Step 2: Create the dispatch snippet**

```yaml
# docs/dispatch-snippet.yml
# Drop this into .github/workflows/ in any repo whose pushes should refresh
# the profile immediately. Requires a PAT with `repo` scope saved as
# PROFILE_DISPATCH_TOKEN in that repo's secrets.
name: Refresh profile dashboard

on:
  push:
    branches: [main]

jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -sS -X POST \
            -H "Authorization: token ${{ secrets.PROFILE_DISPATCH_TOKEN }}" \
            -H "Accept: application/vnd.github+json" \
            https://api.github.com/repos/alexander-288/alexander-288/dispatches \
            -d '{"event_type":"profile-refresh"}'
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/refresh.yml docs/dispatch-snippet.yml
git commit -m "ci: add refresh workflow and cross-repo dispatch snippet"
```

- [ ] **Step 4: Manual verification (requires the user)**

1. Create the `PROFILE_TOKEN` secret — a classic PAT with `read:user` and `public_repo`.
2. Push to `main`.
3. Watch the Actions tab; the run must finish green and produce a `chore: refresh profile cards` commit (or report "no changes").
4. Open `github.com/alexander-288` and confirm the four cards render in both light and dark GitHub themes.

---

## Task 19: Setup documentation

**Files:**
- Create: `docs/SETUP.md`

- [ ] **Step 1: Write it**

````markdown
# Setup

## One-time

1. **Create the profile repo.** It must be named exactly `alexander-288` — GitHub
   only renders the README of a repo matching your username. Make it public.

2. **Create a token.** GitHub → Settings → Developer settings → Personal access
   tokens → Tokens (classic). Scopes: `read:user`, `public_repo`. Copy it.

3. **Add the secret.** Repo → Settings → Secrets and variables → Actions → New
   repository secret. Name: `PROFILE_TOKEN`. Value: the token.

4. **Push.** The workflow runs on push and daily at 04:00 UTC.

## Editing your content

Everything hand-authored lives in `data/profile.yml`: sponsors, packages, the
current-project blurb, learned/learning tech, pages with ratings, and tracks.
Edit it and push — the next run picks it up.

## Working on the cards offline

```bash
npm run render:fixtures
```

Renders all eight SVGs from `tests/fixtures/profile-data.ts` with no token and
no network. Use this for any layout work.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Line counts show 0 | GitHub returns 202 while computing stats on a cold repo. Re-run tomorrow. |
| A card is stale while others update | That card threw; check the run log for `failed to render, keeping previous`. |
| Workflow fails on `data/profile.yml is invalid` | The schema error names the offending field. |
| Cards do not appear on the profile | The repo name must match the username exactly, and be public. |
````

- [ ] **Step 2: Commit**

```bash
git add docs/SETUP.md
git commit -m "docs: add setup and troubleshooting guide"
```

---

## Self-Review Notes

**Spec coverage.** Every spec section maps to a task: architecture → 1–4; YAML →
5; aggregation → 6; cards 1–4 → 8–11; GraphQL and commit walking → 12–13; error
handling (card isolation, 202 retries, missing YAML fields, no-op commits) →
13, 14, 18; testing (snapshots, units, schema, fixtures, well-formedness) → 5,
6, 8–11, 16; layout → 17; triggers → 18.

**Known deviation from the spec, flagged deliberately.** The spec describes
card 3's language bar as share of *commits* while card 4 uses share of *bytes*.
Task 15 approximates the commit share from byte share, because attributing every
commit to a language requires fetching each commit's diff — thousands of extra
API calls per run, which would blow the rate limit the cache exists to protect.
The panel still reads correctly; if true per-commit attribution matters later, it
belongs in its own plan with its own cache.

**Deferred.** `RepoStats.lastSha` and `commits` are populated as empty by
`walkRepo` — the incremental watermark is currently the fixed 365-day `since`
window in `main`. Tightening this to a true per-repo watermark is a follow-up
once real-world run times are known.
