import type { ProfileData } from "../types.js";
import type { Theme } from "../theme/tokens.js";
import { TYPE } from "../theme/tokens.js";
import { card, text, rect, calendarCell } from "../theme/primitives.js";

const W = 560;
const H = 760;
const WEEKS = 52;
const DAYS = 7;
const CELL = 8;
const GAP = 3;

/** The calendar is only 7 cells wide, so everything else shares its right side. */
const CAL_X = 28;
const CAL_TOP = 156;
const COL_X = 140;
const COL_W = W - COL_X - 28;

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

  // ── Current project (full width, above the split) ──────────────────
  if (d.currentProject) {
    const p = d.currentProject;
    body +=
      text("Current project", {
        x: 28,
        y: 32,
        size: TYPE.heading,
        fill: t.colorAccent,
        weight: 600,
      }) +
      text(p.repo, { x: 28, y: 56, size: TYPE.body, fill: t.colorFg, maxWidth: W - 56 }) +
      text(`Updated ${relativeTime(p.updatedAt, now)}`, {
        x: 28,
        y: 76,
        size: TYPE.small,
        fill: t.colorMuted,
        maxWidth: W - 56,
      }) +
      text(`Doing: ${p.doing}`, {
        x: 28,
        y: 100,
        size: TYPE.body,
        fill: t.colorFg,
        maxWidth: W - 56,
      }) +
      text(`What's next: ${p.next}`, {
        x: 28,
        y: 120,
        size: TYPE.body,
        fill: t.colorMuted,
        maxWidth: W - 56,
      });
  }

  // ── Left: vertical contribution calendar ───────────────────────────
  body += text("Contributions calendar", {
    x: CAL_X,
    y: CAL_TOP - 12,
    size: TYPE.heading,
    fill: t.colorAccent,
    weight: 600,
  });

  // Trailing 364 days, so the grid is exactly 52 full weeks.
  const recent = d.activity.calendar.slice(-(WEEKS * DAYS));
  for (let w = 0; w < WEEKS; w++) {
    for (let day = 0; day < DAYS; day++) {
      const entry = recent[w * DAYS + day];
      body +=
        `<g data-cal="${w}-${day}">` +
        calendarCell({
          x: CAL_X + day * (CELL + GAP),
          y: CAL_TOP + w * (CELL + GAP),
          size: CELL,
          level: entry?.level ?? 0,
          scale: t.contribution,
        }) +
        `</g>`;
    }
  }

  // ── Right column: everything else, stacked on a running cursor ─────
  let y = CAL_TOP + 16;

  body +=
    text(`Current streak ${d.activity.currentStreakDays} days`, {
      x: COL_X,
      y,
      size: TYPE.body,
      fill: t.colorFg,
      maxWidth: COL_W,
    }) +
    text(`~${d.activity.avgCommitsPerDay} commits per day`, {
      x: COL_X,
      y: y + 22,
      size: TYPE.body,
      fill: t.colorMuted,
      maxWidth: COL_W,
    });
  y += 66;

  // Most used languages — one stacked bar plus a two-per-row legend.
  body += text("Most used languages", {
    x: COL_X,
    y,
    size: TYPE.heading,
    fill: t.colorAccent,
    weight: 600,
  });

  let offset = COL_X;
  for (const l of d.habits.byteLanguages) {
    const seg = Math.round(COL_W * l.share);
    body += rect({ x: offset, y: y + 12, w: seg, h: 10, fill: l.color });
    offset += seg;
  }
  d.habits.byteLanguages.forEach((l, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    body +=
      rect({ x: COL_X + col * 196, y: y + 36 + row * 20, w: 8, h: 8, fill: l.color, r: 4 }) +
      text(`${l.name} ${Math.round(l.share * 100)}%`, {
        x: COL_X + 14 + col * 196,
        y: y + 44 + row * 20,
        size: TYPE.small,
        fill: t.colorMuted,
        maxWidth: 176,
      });
  });
  y += 44 + Math.ceil(d.habits.byteLanguages.length / 2) * 20 + 28;

  if (d.authored.pages.length > 0) {
    body += text("Pages published", {
      x: COL_X,
      y,
      size: TYPE.heading,
      fill: t.colorAccent,
      weight: 600,
    });
    d.authored.pages.forEach((p, i) => {
      body +=
        text(p.title, {
          x: COL_X,
          y: y + 24 + i * 22,
          size: TYPE.body,
          fill: t.colorFg,
          maxWidth: COL_W - 80,
        }) +
        text(stars(p.rating), {
          x: W - 28,
          y: y + 24 + i * 22,
          size: TYPE.body,
          fill: t.colorMuted,
          anchor: "end",
        });
    });
    y += 24 + d.authored.pages.length * 22 + 28;
  }

  if (d.authored.tracks.length > 0) {
    body += text("Suggested tracks", {
      x: COL_X,
      y,
      size: TYPE.heading,
      fill: t.colorAccent,
      weight: 600,
    });
    d.authored.tracks.slice(0, 3).forEach((track, i) => {
      body +=
        text(track.title, {
          x: COL_X,
          y: y + 26 + i * 34,
          size: TYPE.body,
          fill: t.colorFg,
          maxWidth: COL_W,
        }) +
        text(track.artist, {
          x: COL_X,
          y: y + 42 + i * 34,
          size: TYPE.small,
          fill: t.colorMuted,
          maxWidth: COL_W,
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
