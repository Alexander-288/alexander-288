# Setup

The profile is rendered by [lowlighter/metrics](https://github.com/lowlighter/metrics) (MIT), run from a patched fork. There is no code in this repo. Everything lives in `.github/workflows/metrics.yml`: the Action fetches your data, renders `metrics.svg` and commits it back, and `README.md` embeds that one image.

## The fork

`Alexander-288/metrics`, branch `profile`. It adds three things to upstream (which has had no release since 2023):

- **Habits fix.** GitHub removed `commits` from PushEvent payloads, which crashes the upstream habits plugin. The fork looks the commits up instead.
- **`plugin_habits_charts_sections`.** Pick which habits charts show: `hours`, `days`, `languages`.
- **`plugin_music_mode: manual`.** Hardcoded tracks from `plugin_music_tracks`, one `Title - Artist` per line. Cover art comes from the public iTunes search, no account needed.

Pushing to the `profile` branch builds the image once and publishes it as `ghcr.io/alexander-288/metrics:profile`. The profile workflow pulls that image, so each run takes about a minute instead of rebuilding.

## One-time

1. **Create the token.** GitHub, Settings, Developer settings, Personal access tokens, Tokens (classic). Scopes:
   - `read:user` (required)
   - `repo` (only to count private repositories)
   - `read:org` (only to count organization contributions)
2. **Add the secret.** This repo, Settings, Secrets and variables, Actions. Name it `METRICS_TOKEN`.
3. **Run it.** Actions tab, Metrics, Run workflow. It also runs daily and on every push to `main`.

## Layout, top to bottom

`config_order` sets it:

- `base.header`, `base.activity+community`, `base.repositories`: the standard data, with lines added / removed from `plugin_lines`
- `habits`: commit activity per hour of day, from the last 30 days of pushes
- `music`: suggested tracks, edit `plugin_music_tracks` to change them
- `languages`: most used languages
- `topics`: mastered technologies, taken from topics you star at `github.com/topics/<name>`

## Notes

- Keep `config_display: regular`. `columns` draws two columns at a fixed height, and GitHub's narrow README column stacks them and cuts off the bottom.
- `config_timezone` is `Europe/Warsaw`; it shifts the hour-of-day chart.
- Lines added / removed showing 0 means GitHub hasn't computed contributor stats yet. Re-run later.
- If the run fails on the token, `METRICS_TOKEN` is missing or expired.
