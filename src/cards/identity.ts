import type { ProfileData } from "../types.js";
import type { Theme } from "../theme/tokens.js";
import { TYPE } from "../theme/tokens.js";
import { card, text, esc } from "../theme/primitives.js";

const W = 560;
const H = 340;

export function abbreviate(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function yearsSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / (365.25 * 86_400_000));
}

export function renderIdentity(d: ProfileData, t: Theme, now = new Date()): string {
  const joinYear = new Date(d.user.createdAt).getUTCFullYear();
  const gb = (d.totals.diskUsageBytes / 1_000_000_000).toFixed(2);

  const facts: string[] = [
    `Joined GitHub ${joinYear} · ${yearsSince(d.user.createdAt, now)} years ago`,
    `Followed by ${d.user.followers} users`,
    `${d.user.repositories} repositories`,
    `Prefers ${d.totals.preferredLicense} license`,
    `${d.totals.releases} releases · ${d.totals.packages} packages`,
    `${gb} GB used`,
    `${abbreviate(d.totals.linesAdded)} added, ${abbreviate(d.totals.linesRemoved)} removed`,
  ];

  const avatar =
    `<clipPath id="avatarClip"><circle cx="86" cy="110" r="58"/></clipPath>` +
    `<image href="${esc(d.user.avatarDataUri)}" x="28" y="52" width="116" height="116" ` +
    `clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice"/>`;

  const heading =
    text(d.user.name, {
      x: 176,
      y: 56,
      size: TYPE.title,
      fill: t.colorAccent,
      weight: 600,
      maxWidth: 360,
    }) +
    text(`@${d.user.login}`, {
      x: 176,
      y: 76,
      size: TYPE.body,
      fill: t.colorMuted,
      maxWidth: 360,
    });

  const rows = facts
    .map((line, i) =>
      text(line, { x: 176, y: 108 + i * 26, size: TYPE.body, fill: t.colorFg, maxWidth: 360 })
    )
    .join("");

  return card({
    w: W,
    h: H,
    bg: t.colorBg,
    border: t.colorBorder,
    title: `${d.user.name} — GitHub identity`,
    body: avatar + heading + rows,
  });
}
