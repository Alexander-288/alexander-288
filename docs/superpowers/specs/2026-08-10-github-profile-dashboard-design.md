# GitHub Profile Dashboard — Design

**Date:** 2026-08-10
**Owner:** `alexander-288`
**Target repo:** `alexander-288/alexander-288` (the special profile repo)

## Goal

A GitHub profile README that renders as a four-card dashboard of self-generated
SVGs. All imagery is produced by a TypeScript renderer running in GitHub
Actions and committed into the repo — no third-party rendering services, so the
cards cannot be rate-limited or taken offline by someone else's outage.

## Non-Goals

- No GitHub Pages site, no pinned-repo curation, no social preview images.
- No Spotify API integration. Tracks are hand-authored (see `data/profile.yml`).
- No animation. Cards are static SVG, GitHub-native in appearance.

## Architecture

Nothing under `src/` is ever served to a visitor. `README.md` is the only
rendered surface; it contains a table of `<picture>` embeds pointing at files in
`out/`. The TypeScript is a build step that reprints those files.

```
alexander-288/alexander-288/
├── README.md                    # thin shell: HTML table + 4 <picture> embeds
├── data/profile.yml             # hand-authored content (see below)
├── src/
│   ├── fetch/
│   │   ├── github-graphql.ts    # profile, repos, contributions, languages
│   │   └── commit-walker.ts     # per-repo line counts, commit timestamps
│   ├── cards/
│   │   ├── identity.ts          # card 1
│   │   ├── pulse.ts             # card 2
│   │   ├── habits.ts            # card 3
│   │   └── dashboard.ts         # card 4
│   ├── theme/
│   │   ├── tokens.ts            # Primer light + dark palettes
│   │   └── primitives.ts        # text, bar, sparkline, calendar-cell helpers
│   └── render.ts                # entry point
├── cache/stats.json             # incremental commit-walk cache (committed)
├── out/                         # generated SVGs (committed)
│   ├── identity-{light,dark}.svg
│   ├── pulse-{light,dark}.svg
│   ├── habits-{light,dark}.svg
│   └── dashboard-{light,dark}.svg
└── .github/workflows/refresh.yml
```

### Data flow

1. Action checks out the repo and installs Node.
2. `fetch/github-graphql.ts` queries the GraphQL v4 API for profile facts, repo
   list, contribution calendar, and language byte totals.
3. `fetch/commit-walker.ts` reads `cache/stats.json`, requests only commits
   newer than the cached watermark per repo, and merges results back. Line
   counts come from the REST `stats/contributors` endpoint; commit timestamps
   drive the hour-of-day and day-of-week charts.
4. `data/profile.yml` is parsed and merged over the API data.
5. Each card module returns an SVG string; `render.ts` writes a light and a dark
   variant per card into `out/`.
6. The workflow commits `out/` and `cache/` only if bytes changed.

### Authentication

A classic PAT with `read:user` and `public_repo`, stored as repo secret
`PROFILE_TOKEN`. The default `GITHUB_TOKEN` is insufficient: it authenticates as
an app installation, so `viewer`-scoped queries do not resolve to the user's own
profile data.

### Refresh triggers

`.github/workflows/refresh.yml` runs on:

- `schedule` — daily at 04:00 UTC
- `push` to the profile repo's default branch
- `workflow_dispatch` — manual
- `repository_dispatch` (type: `profile-refresh`)

Actions cannot observe pushes to *other* repositories. A 12-line snippet ships
in `docs/dispatch-snippet.yml` for dropping into active repos, firing a
`repository_dispatch` at the profile repo on push. Adding it to a handful of
active repos is optional; the daily run is the baseline guarantee.

### Theming

Every card renders twice against Primer's light and dark token sets. The README
selects via `<picture>` + `prefers-color-scheme`, so the dashboard matches
whichever theme the visitor's GitHub is in.

## Layout

Canvas coordinates below are per-card; the grid is assembled by an HTML table in
`README.md`, not by a composite SVG. Each card is independently regenerable, and
a failure in one card leaves the other three intact.

```
┌──────────────┬──────────────┬───────────────────────────┐
│   CARD 1     │   CARD 2     │                           │
│   identity   │   pulse      │        CARD 4             │
│   560×340    │   560×340    │        dashboard          │
├──────────────┴──────────────┤        560×760            │
│          CARD 3             │                           │
│          habits  1120×400   │                           │
└─────────────────────────────┴───────────────────────────┘
```

README structure:

```html
<table>
  <tr>
    <td><picture>…identity…</picture></td>
    <td><picture>…pulse…</picture></td>
    <td rowspan="2"><picture>…dashboard…</picture></td>
  </tr>
  <tr>
    <td colspan="2"><picture>…habits…</picture></td>
  </tr>
</table>
```

## Cards

### Card 1 — Identity (560×340)

Text-dense, minimal chrome.

| Field | Source |
|---|---|
| Avatar, display name, handle | GraphQL `viewer` |
| Joined GitHub (date) | `viewer.createdAt` |
| Followers (count) | `viewer.followers.totalCount` |
| Repositories (count) | `viewer.repositories.totalCount` |
| Preferred license | mode of `repository.licenseInfo` across owned repos |
| Releases (count) | sum of `repository.releases.totalCount` |
| Packages (count) | `data/profile.yml` — the API barely exposes this |
| Storage used (GB) | sum of `repository.diskUsage` |
| Lines added / removed | commit-walk cache, all-time |
| Coding habits | derived one-liner (peak hour, busiest weekday) |

### Card 2 — Pulse (560×340)

- Last 7 days rendered as GitHub contribution squares, using Primer's four-step
  contribution scale.
- Caption beneath: "committed to _n_ repositories" (distinct repos, last 7 days).
- Four-stat row: **sponsors** (hand-authored in `profile.yml`) · **stars** ·
  **forks** · **watchers**, the latter three summed across owned repos.

### Card 3 — Habits (1120×400)

- Line chart: commits by hour of day (24 buckets, all-time).
- Line chart: commits by day of week (7 buckets, all-time).
- Horizontal 3-band bar: top 3 languages by share of *commits* (not bytes), each
  labelled with its percentage of total commits.
- Two icon rows sourced from `profile.yml`: **learned sufficiently** and
  **still learning**, each an icon strip with labels.

### Card 4 — Dashboard (560×760)

Top to bottom:

1. **Current project** — the repo with the most commits in the trailing 14 days.
   Repo name and last-updated timestamp from the API; `doing` and `next` lines
   from `profile.yml`.
2. **Contribution calendar, vertical** — 52 rows × 7 columns, week-per-row,
   which is what motivates the tall column.
3. **Streak** — current consecutive-commit-day count, alongside average commits
   per day.
4. **Most-used languages** — bar chart by byte share, legend beneath.
5. **Pages published** — list from `profile.yml`, each with the personal rating
   you assign.
6. **Coding tracks** — three hand-picked tracks from `profile.yml`.

## Hand-authored data

`data/profile.yml` is the only file edited by hand:

```yaml
sponsors: 0
packages: 0
current:
  doing: "…"
  next: "…"
learned:   [{ name: TypeScript, icon: typescript }, …]
learning:  [{ name: Rust, icon: rust }, …]
pages:     [{ title: "…", url: "…", rating: 4 }, …]
tracks:    [{ title: "…", artist: "…" }, …]
```

The renderer validates this file against a schema and fails loudly on malformed
input rather than emitting a half-drawn card.

## Error handling

- **Card-level isolation.** Each card renders inside a try/catch. A card that
  throws keeps its previously committed SVG and logs a warning; the run still
  succeeds. This prevents a transient API failure from blanking the profile.
- **Rate limiting.** The commit walker checks remaining GraphQL points before
  each batch and stops early, persisting partial progress to `cache/stats.json`.
  The next run resumes from the watermark.
- **Missing YAML fields.** Optional sections (pages, tracks, learning) render as
  omitted blocks rather than empty frames; the card reflows.
- **No-op runs.** The workflow diffs `out/` and skips the commit when nothing
  changed, keeping the history clean.

## Testing

- **Snapshot tests** per card: fixture data in → SVG string out, compared to a
  committed golden file. Catches unintended visual drift.
- **Unit tests** for the aggregation logic (streak calculation, hour bucketing,
  language-share math, preferred-license mode) against hand-built fixtures.
- **Schema test** for `data/profile.yml` covering the malformed and
  missing-optional-field cases.
- **Fixture-driven local render**: `npm run render -- --fixtures` produces the
  full `out/` set with no network access, so layout work needs no API calls.
- **SVG well-formedness** check on every generated file (parse, assert root
  dimensions match the card spec).

## Open risks

- REST `stats/contributors` returns HTTP 202 while GitHub computes statistics.
  The walker must retry with backoff on first-ever runs for large repos.
- Very long repo or page titles can overflow fixed-width cards. Renderer
  truncates with an ellipsis at measured width rather than character count.
