import { describe, it, expect, vi } from "vitest";
import { renderAll } from "../src/render.js";
import { FIXTURE } from "./fixtures/profile-data.js";

const DIMENSIONS: Record<string, [number, number]> = {
  identity: [560, 340],
  pulse: [560, 340],
  habits: [1120, 400],
  dashboard: [560, 760],
};

describe("renderAll", () => {
  it("produces eight files — four cards in two themes", () => {
    expect(Object.keys(renderAll(FIXTURE)).sort()).toEqual([
      "dashboard-dark.svg",
      "dashboard-light.svg",
      "habits-dark.svg",
      "habits-light.svg",
      "identity-dark.svg",
      "identity-light.svg",
      "pulse-dark.svg",
      "pulse-light.svg",
    ]);
  });

  it("emits well-formed SVG roots", () => {
    for (const svg of Object.values(renderAll(FIXTURE))) {
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
    }
  });

  it("skips a card that throws instead of failing the run", () => {
    const broken = {
      ...FIXTURE,
      habits: {
        ...FIXTURE.habits,
        get commitsByHour(): number[] {
          throw new Error("boom");
        },
      },
    } as never;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = renderAll(broken);

    expect(out["habits-dark.svg"]).toBeUndefined();
    expect(out["identity-dark.svg"]).toBeDefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("generated SVG", () => {
  const files = renderAll(FIXTURE);

  it("balances every element it opens", () => {
    for (const [name, svg] of Object.entries(files)) {
      const opens = (svg.match(/<(?!\/)(?!\?)[a-zA-Z]+/g) ?? []).length;
      const selfClosing = (svg.match(/\/>/g) ?? []).length;
      const closes = (svg.match(/<\/[a-zA-Z]+>/g) ?? []).length;
      expect(opens, `${name} has unbalanced tags`).toBe(selfClosing + closes);
    }
  });

  it("matches the dimensions declared in the spec", () => {
    for (const [file, svg] of Object.entries(files)) {
      const cardName = file.split("-")[0]!;
      const [w, h] = DIMENSIONS[cardName]!;
      expect(svg).toContain(`width="${w}"`);
      expect(svg).toContain(`height="${h}"`);
      expect(svg).toContain(`viewBox="0 0 ${w} ${h}"`);
    }
  });

  it("contains no unescaped ampersands outside entities", () => {
    for (const [name, svg] of Object.entries(files)) {
      const bad = svg.match(/&(?!amp;|lt;|gt;|quot;|apos;|#)/g) ?? [];
      expect(bad, `${name} has raw ampersands`).toHaveLength(0);
    }
  });
});
