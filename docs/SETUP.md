# Setup

## One-time

1. **Create the profile repo.** It must be named exactly `alexander-288` —
   GitHub only renders the README of a repo matching your username. Make it
   public. Copy everything in this directory into it.

2. **Create a token.** GitHub → Settings → Developer settings → Personal access
   tokens → Tokens (classic). Scopes: `read:user`, `public_repo`. Copy it.

   The default `GITHUB_TOKEN` will not work: it authenticates as an app
   installation, so `viewer`-scoped GraphQL does not resolve to your profile.

3. **Add the secret.** Repo → Settings → Secrets and variables → Actions → New
   repository secret. Name: `PROFILE_TOKEN`. Value: the token.

4. **Push.** The workflow runs on push, daily at 04:00 UTC, and on demand.

## Refreshing when you push to *other* repos

Actions cannot see pushes to other repositories. To make a push anywhere else
refresh the dashboard immediately, copy `docs/dispatch-snippet.yml` into that
repo's `.github/workflows/` and add a `PROFILE_DISPATCH_TOKEN` secret there.
Wiring up your 3–4 most active repos gets nearly all the benefit; the daily run
is the baseline either way.

## Editing your content

Everything hand-authored lives in `data/profile.yml`: sponsors, packages, the
current-project blurb, learned/learning tech, pages with ratings, and tracks.
Edit it and push — the next run picks it up. The file is schema-validated, so a
typo fails the run loudly instead of rendering a half-drawn card.

## Working on the cards offline

```bash
npm run render:fixtures
```

Renders all eight SVGs from `tests/fixtures/profile-data.ts` with no token and
no network. Use this for any layout work.

To see them laid out as they will appear on the profile:

```bash
npx http-server -p 8901 -c-1
# then open http://127.0.0.1:8901/preview.html
```

## Commands

| Command | What it does |
|---|---|
| `npm test` | Full suite (74 tests) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run render` | Live render; needs `PROFILE_TOKEN` |
| `npm run render:fixtures` | Offline render from the fixture |

## Troubleshooting

| Symptom | Cause |
|---|---|
| Line counts show 0 | GitHub returns 202 while computing stats on a cold repo. Re-run tomorrow. |
| A card is stale while others update | That card threw; check the run log for `failed to render, keeping previous`. |
| Workflow fails on `data/profile.yml is invalid` | The error names the offending field. |
| Cards do not appear on the profile | The repo name must match your username exactly, and be public. |
| Avatar is blank | Only in fixture renders — the fixture ships a 1×1 transparent PNG. |
