import { FONT_STACK } from "./tokens.js";

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Truncate by measured width rather than character count, because SVG has no
 * layout engine and a fixed char budget wraps CJK and caps very differently.
 * 0.55em is a good average advance width for the Primer UI stack.
 */
export function truncate(s: string, size: number, maxWidth: number): string {
  const per = size * 0.55;
  const max = Math.floor(maxWidth / per);
  if (s.length <= max) return s;
  return s.slice(0, Math.max(1, max - 1)) + "…";
}

export interface TextOpts {
  x: number;
  y: number;
  size: number;
  fill: string;
  weight?: number;
  anchor?: "start" | "middle" | "end";
  maxWidth?: number;
}

export function text(content: string, o: TextOpts): string {
  const body = o.maxWidth ? truncate(content, o.size, o.maxWidth) : content;
  const anchor = o.anchor ? ` text-anchor="${o.anchor}"` : "";
  const weight = o.weight ? ` font-weight="${o.weight}"` : "";
  return (
    `<text x="${o.x}" y="${o.y}" font-family="${FONT_STACK}" ` +
    `font-size="${o.size}" fill="${o.fill}"${weight}${anchor}>${esc(body)}</text>`
  );
}

export interface RectOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  r?: number;
  stroke?: string;
}

export function rect(o: RectOpts): string {
  const r = o.r ? ` rx="${o.r}"` : "";
  const stroke = o.stroke ? ` stroke="${o.stroke}"` : "";
  return `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="${o.fill}"${r}${stroke}/>`;
}

export function bar(o: RectOpts & { fraction: number }): string {
  const f = Math.min(1, Math.max(0, o.fraction));
  return rect({ ...o, w: Math.round(o.w * f) });
}

/** Column chart. Values are absolute; the tallest determines full height. */
export function columns(o: {
  x: number;
  y: number;
  w: number;
  h: number;
  values: readonly number[];
  fill: string;
  barWidth?: number;
}): string {
  const max = Math.max(1, ...o.values);
  const slot = o.w / o.values.length;
  const bw = o.barWidth ?? Math.max(2, slot * 0.5);
  return o.values
    .map((v, i) => {
      const h = Math.round((v / max) * o.h);
      const cx = o.x + slot * i + (slot - bw) / 2;
      return rect({ x: cx, y: o.y + o.h - h, w: bw, h, fill: o.fill, r: 2 });
    })
    .join("");
}

/** One contribution square. `level` indexes the theme's 5-step scale. */
export function calendarCell(o: {
  x: number;
  y: number;
  size: number;
  level: number;
  scale: readonly string[];
}): string {
  const idx = Math.min(o.scale.length - 1, Math.max(0, o.level));
  return rect({
    x: o.x,
    y: o.y,
    w: o.size,
    h: o.size,
    fill: o.scale[idx]!,
    r: 2,
  });
}

/** Outer card frame: root <svg>, background, and border. */
export function card(o: {
  w: number;
  h: number;
  bg: string;
  border: string;
  body: string;
  title?: string;
}): string {
  const title = o.title ? `<title>${esc(o.title)}</title>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${o.w}" height="${o.h}" ` +
    `viewBox="0 0 ${o.w} ${o.h}" role="img">${title}` +
    rect({ x: 0.5, y: 0.5, w: o.w - 1, h: o.h - 1, fill: o.bg, r: 6, stroke: o.border }) +
    o.body +
    `</svg>`
  );
}
