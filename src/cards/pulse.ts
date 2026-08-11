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

  const caption = text(`Contributed to ${d.activity.reposTouchedLast7Days} repositories`, {
    x: startX,
    y: startY + CELL + 30,
    size: TYPE.body,
    fill: t.colorFg,
    maxWidth: W - 56,
  });

  const stats: string[] = [
    `${d.totals.sponsors} Sponsors`,
    `${d.totals.stars} Stargazers`,
    `${d.totals.forks} Forks`,
    `${d.totals.watchers} Watchers`,
  ];

  const statRows = stats
    .map((label, i) =>
      text(label, {
        x: startX + (i % 2) * 260,
        y: 176 + Math.floor(i / 2) * 34,
        size: TYPE.body,
        fill: t.colorFg,
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
