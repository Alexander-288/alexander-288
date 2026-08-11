import { writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ProfileData } from "./types.js";
import type { Cache } from "./fetch/commit-walker.js";
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

// ── CLI ────────────────────────────────────────────────────────────────

const CACHE_PATH = "cache/stats.json";

async function embedAvatar(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get("content-type") ?? "image/png";
  return `data:${type};base64,${buf.toString("base64")}`;
}

async function main(): Promise<void> {
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

  const { graphql } = await import("@octokit/graphql");
  const { Octokit } = await import("@octokit/rest");
  const { parseProfileYaml } = await import("./schema.js");
  const { fetchProfile } = await import("./fetch/github-graphql.js");
  const walker = await import("./fetch/commit-walker.js");
  const { assemble } = await import("./fetch/assemble.js");

  const gql = graphql.defaults({ headers: { authorization: `token ${token}` } });
  const rest = new Octokit({ auth: token });

  const api = await fetchProfile((q) => gql(q));
  const yaml = parseProfileYaml(await readFile("data/profile.yml", "utf8"));

  let cache: Cache = JSON.parse(
    await readFile(CACHE_PATH, "utf8").catch(() => JSON.stringify(walker.EMPTY_CACHE))
  );

  const since = new Date(Date.now() - 365 * 86_400_000).toISOString();
  const commits: { repo: string; at: string }[] = [];

  for (const r of api.repos) {
    const [owner, name] = r.nameWithOwner.split("/") as [string, string];
    const stats = await walker.walkRepo(rest, owner, name, api.user.login);
    if (!stats.pending) cache = walker.mergeCache(cache, r.nameWithOwner, stats);
    for (const c of await walker.fetchRecentCommits(rest, owner, name, api.user.login, since)) {
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
if (process.argv[1]?.replace(/\\/g, "/").endsWith("src/render.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
