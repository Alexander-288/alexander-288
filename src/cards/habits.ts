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
      x: 28,
      y: 32,
      size: TYPE.body,
      fill: t.colorAccent,
      weight: 600,
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
      x: 28,
      y: 190,
      size: TYPE.body,
      fill: t.colorAccent,
      weight: 600,
    }) +
    columns({
      x: 28,
      y: 202,
      w: 500,
      h: 120,
      values: d.habits.commitsByWeekday,
      fill: t.colorSuccess,
    }) +
    WEEKDAYS.map((w, i) =>
      text(w, {
        x: 28 + (500 / 7) * i + 500 / 14,
        y: 338,
        size: TYPE.small,
        fill: t.colorMuted,
        anchor: "middle",
      })
    ).join("");

  // Sits in the top-right quadrant, opposite the hour chart, so the card
  // reads as two balanced rows rather than one dense column.
  const langX = 620;
  const langChart =
    text("Language activity", {
      x: langX,
      y: 32,
      size: TYPE.body,
      fill: t.colorAccent,
      weight: 600,
    }) +
    d.habits.commitLanguages
      .slice(0, 3)
      .map((l, i) => {
        const y = 56 + i * 34;
        return (
          text(l.name, { x: langX, y: y + 9, size: TYPE.small, fill: t.colorMuted, maxWidth: 90 }) +
          rect({ x: langX + 100, y, w: 270, h: 12, fill: t.colorBorder, r: 6 }) +
          bar({ x: langX + 100, y, w: 270, h: 12, fraction: l.share, fill: l.color, r: 6 }) +
          // Anchored past the end of the track so a 100% bar cannot collide.
          text(`${Math.round(l.share * 100)}%`, {
            x: langX + 380,
            y: y + 10,
            size: TYPE.small,
            fill: t.colorMuted,
          })
        );
      })
      .join("");

  // Both tech rows live in the right column beneath the language chart, which
  // leaves the left column entirely to the two commit charts.
  const learned =
    text("Mastered technologies and topics", {
      x: langX,
      y: 200,
      size: TYPE.body,
      fill: t.colorAccent,
      weight: 600,
    }) + techChips(d.authored.learned, langX, 212, t);

  const learning =
    d.authored.learning.length > 0
      ? text("Still learning", {
          x: langX,
          y: 290,
          size: TYPE.body,
          fill: t.colorAccent,
          weight: 600,
        }) + techChips(d.authored.learning, langX, 302, t)
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
