# Setup

The profile is rendered by [lowlighter/metrics](https://github.com/lowlighter/metrics)
(MIT). There is no code in this repo — everything lives in
`.github/workflows/metrics.yml`. The Action fetches your data, renders a single
`metrics.svg`, and commits it back. `README.md` embeds that one image.

A single image is deliberate: GitHub's markdown CSS draws borders on tables and
strips `style` attributes, so any multi-image table layout shows seams that
cannot be removed.

## One-time

1. **Create the token.** GitHub → Settings → Developer settings → Personal
   access tokens → Tokens (classic) → Generate new token.

   Scopes to tick:
   - `read:user` — required, reads your profile
   - `repo` — only if you want private repositories counted in the totals
   - `read:org` — only if you want organization contributions counted

2. **Add the secret.** This repo → Settings → Secrets and variables → Actions →
   New repository secret. Name it exactly `METRICS_TOKEN`.

3. **Run it.** Actions tab → Metrics → Run workflow. It also runs daily at
   04:00 UTC and on every push to `main`.

## Tuning what appears

All of it is in `.github/workflows/metrics.yml`.

| Panel | Controlled by |
|---|---|
| Name, avatar, joined date, followers | `base: header` |
| 7-day squares, "contributed to N repositories" | `base: activity` |
| Sponsors, stars, forks, watchers | `base: community` |
| Repositories, license, releases, disk usage | `base: repositories` |
| Lines added / removed | `plugin_lines` |
| Commits by hour, by day, language activity | `plugin_habits` |
| Mastered technologies (icons) | `plugin_topics` |
| Contributions calendar, streak, avg/day | `plugin_isocalendar` |
| Most used languages | `plugin_languages` |
| Suggested tracks | `plugin_music` |

**Mastered technologies** are not configured in YAML. They come from topics you
have starred — go to `github.com/topics/<name>` (e.g. `github.com/topics/rust`)
and click Star. Starred topics show up as icons, sorted by `plugin_topics_sort`.

**Suggested tracks** use `playlist` mode, which needs no Spotify credentials —
just a public playlist embed URL. Replace `plugin_music_playlist` with your own.

**Timezone** is set to `Europe/Warsaw`; change `config_timezone` if that's wrong,
since it shifts the commits-by-hour chart.

## Known gaps versus the original spec

Three things from the earlier design have no metrics equivalent and are not
currently rendered:

- **Pages published with your personal ratings.** The closest plugin is
  `plugin_pagespeed`, which reports Google PageSpeed scores for one site — not
  your own 1–5 ratings.
- **"Still learning" technologies.** `plugin_topics` has a single list; there is
  no learned-versus-learning split.
- **Current project with "doing" / "what's next".** `plugin_projects` exists but
  reads GitHub Projects boards, not hand-written status lines.

Adding these means writing custom metrics plugins or rendering a second image.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Workflow fails on the token | `METRICS_TOKEN` missing or expired. |
| Lines added/removed are 0 | GitHub computes contributor stats lazily; re-run later. |
| Commits-by-hour looks shifted | Wrong `config_timezone`. |
| No technology icons | You have not starred any topics, or they have no icon. |
| Image does not update | The Action commits `metrics.svg`; check the run log and that it pushed. |
| Private work missing | Add the `repo` scope to the token. |
