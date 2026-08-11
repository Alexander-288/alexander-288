# Handoff — GitHub Profile Dashboard

**For:** a cloud agent picking this up cold. The local machine has an unreliable
connection, so this document is written to be self-sufficient: everything needed
to finish the work is either here or in the two documents it points to.

---

## The one-paragraph version

Build a TypeScript renderer that runs in GitHub Actions and emits four static
SVG cards into `out/`, committed to the repo `alexander-288/alexander-288`.
`README.md` is a thin HTML table of `<picture>` embeds pointing at those files.
Nothing under `src/` is ever served to a viewer — it is a build step that
reprints images. The visual target is `lowlighter/metrics` output rendered in
GitHub's Primer design language, light and dark.

## Start here

| Document | What it holds |
|---|---|
| `docs/superpowers/specs/2026-08-10-github-profile-dashboard-design.md` | The approved design: architecture, all four cards panel by panel, error handling, testing strategy |
| `docs/superpowers/plans/2026-08-11-github-profile-dashboard-plan.md` | 19 TDD tasks with complete code in every step. **Execute this.** |

Work the plan top to bottom. Each task is test-first: write the failing test,
run it, implement, run it green, commit. Do not batch commits across tasks.

## Owner and target

- GitHub handle: **`alexander-288`**
- Target repo: **`alexander-288/alexander-288`** (must match the username
  exactly and be public, or GitHub will not render the README on the profile)
- Current work happens in `C:\Users\Olek\downloads\rshit\gh-about`, which is a
  fresh git repo containing only these documents. The code is written here and
  moved to the profile repo when it works.

## The layout, settled

Mirrored from the first draft — card 4 anchors the **right** column:

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

Assembly is an **HTML table of four separate SVGs**, not one composite image.
This was chosen deliberately: cards stay independently regenerable and one
broken card cannot take the layout down.

## Decisions already made — do not relitigate these

| Decision | Rationale |
|---|---|
| Self-generated SVGs, not a third-party service | No rate limits, no other party's uptime, and the custom panels have no off-the-shelf equivalent |
| Cards are pure functions `(data, theme) → string` | Makes the whole dashboard testable and developable with zero network access |
| Spotify is **hand-authored**, not API-integrated | User chose this over a developer app + refresh-token setup |
| Sponsors and packages are **hand-authored** | Sponsors is not "likes" (GitHub has no likes); the packages API is barely exposed |
| GitHub-native Primer look, no animation | User's explicit visual choice |
| Refresh: daily + push + manual + `repository_dispatch` | Actions cannot see pushes to other repos; a snippet ships for wiring those up |
| Line counts: all-time, cached in `cache/stats.json` | Accurate lifetime numbers without re-walking history every run |
| No co-author trailers in commit messages | User's standing preference |

## Things that will bite you

1. **`GITHUB_TOKEN` is not enough.** It authenticates as an app installation, so
   `viewer`-scoped GraphQL does not resolve to the user's profile. A classic PAT
   with `read:user` + `public_repo` must be stored as the secret
   `PROFILE_TOKEN`. This is a user action — flag it, do not try to work around it.

2. **`stats/contributors` returns HTTP 202** while GitHub computes statistics on
   a repo it has not analysed recently. Task 13 retries with backoff and then
   returns zeroes with `pending: true` rather than throwing. Never let this fail
   a run.

3. **`out/` and `cache/` must NOT be gitignored.** They are the build product the
   README depends on. Only `node_modules/` is ignored.

4. **Card isolation is a requirement, not a nicety.** `renderAll` catches per
   card; a card that throws is omitted from the write set, leaving its previously
   committed SVG in place. A stale card beats a blank profile.

5. **`npm run render:fixtures`** renders all eight SVGs from the committed
   fixture with no token and no network. Use it for every piece of layout work —
   there is no reason to burn API calls on visual iteration.

## Known deviation from the spec

The spec says card 3's language bar measures share of *commits* while card 4
measures share of *bytes*. The plan approximates the commit share from byte
share (Task 15), because true per-commit language attribution needs each
commit's diff — thousands of extra API calls per run. This is flagged in the
plan's self-review and should be raised with the user rather than silently
"fixed" in either direction.

## Definition of done

- [ ] `npm test` green, `npm run typecheck` clean
- [ ] `npm run render:fixtures` writes 8 SVGs to `out/`
- [ ] All four cards render correctly in both light and dark
- [ ] Workflow runs green in Actions and produces a refresh commit
- [ ] `github.com/alexander-288` shows the mirrored four-card grid
- [ ] `docs/SETUP.md` accurately describes the token steps the user must do

## What needs the user, and cannot be done for them

1. Creating the `alexander-288/alexander-288` repo.
2. Generating the PAT and saving it as the `PROFILE_TOKEN` secret.
3. Filling in `data/profile.yml` with their real sponsors count, pages, tracks,
   and learned/learning technology lists — the committed version ships with
   plausible placeholders that should be replaced.
