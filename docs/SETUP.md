# Setup

The profile is rendered by [lowlighter/metrics](https://github.com/lowlighter/metrics) (MIT). There is no code in this repo. Everything lives in `.github/workflows/metrics.yml`: the Action fetches your data, renders `metrics.svg` and commits it back, and `README.md` embeds that one image.

## One-time

1. **Create the token.** GitHub, Settings, Developer settings, Personal access tokens, Tokens (classic). Scopes:
   - `read:user` (required)
   - `repo` (only to count private repositories)
   - `read:org` (only to count organization contributions)
2. **Add the secret.** This repo, Settings, Secrets and variables, Actions. Name it `METRICS_TOKEN`.
3. **Run it.** Actions tab, Metrics, Run workflow. It also runs daily and on every push to `main`.

## What appears

- `base: header`: name, avatar, join date, followers
- `base: activity`: 7-day squares, commits, PRs, issues
- `base: community`: organizations, following, starred
- `base: repositories`: repo count, license, releases, disk usage
- `plugin_lines`: lines added / removed
- `plugin_isocalendar`: contributions calendar, streak, average per day
- `plugin_languages`: most used languages
- `plugin_topics`: mastered technologies, taken from topics you star at `github.com/topics/<name>`

Turned off because they are broken upstream (no release since 2023):

- `plugin_habits`: crashes since GitHub removed commits from PushEvent payloads
- `plugin_music`: Spotify changed its embed page, so playlist scraping fails

## Notes

- Keep `config_display: regular`. `columns` draws two columns at a fixed height, and GitHub's narrow README column stacks them and cuts off the bottom.
- `config_timezone` is `Europe/Warsaw`.
- Lines added / removed showing 0 means GitHub hasn't computed contributor stats yet. Re-run later.
- If the run fails on the token, `METRICS_TOKEN` is missing or expired.
