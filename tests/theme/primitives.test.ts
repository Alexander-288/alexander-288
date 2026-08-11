import { describe, it, expect } from "vitest";
import { esc, truncate, text, rect, bar } from "../../src/theme/primitives.js";
import { THEMES, type ThemeName } from "../../src/theme/tokens.js";

describe("themes", () => {
  it("exposes light and dark", () => {
    expect(Object.keys(THEMES).sort()).toEqual(["dark", "light"]);
  });

  it("defines identical token keys in both themes", () => {
    expect(Object.keys(THEMES.dark).sort()).toEqual(Object.keys(THEMES.light).sort());
  });

  it("uses hex colors for the base tokens", () => {
    for (const name of Object.keys(THEMES) as ThemeName[]) {
      expect(THEMES[name].colorFg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(THEMES[name].colorBg).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("provides a four-step contribution scale plus an empty step", () => {
    expect(THEMES.light.contribution).toHaveLength(5);
    expect(THEMES.dark.contribution).toHaveLength(5);
  });
});

describe("esc", () => {
  it("escapes the five XML entities", () => {
    expect(esc(`<a href="x" & 'y'>`)).toBe(
      "&lt;a href=&quot;x&quot; &amp; &apos;y&apos;&gt;"
    );
  });
});

describe("truncate", () => {
  it("returns short strings unchanged", () => {
    expect(truncate("hello", 12, 100)).toBe("hello");
  });

  it("appends an ellipsis when the measured width overflows", () => {
    const out = truncate("averylongrepositoryname", 12, 40);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThan("averylongrepositoryname".length);
  });
});

describe("text", () => {
  it("emits a text element with escaped content", () => {
    const out = text("a & b", { x: 10, y: 20, size: 12, fill: "#fff" });
    expect(out).toContain('x="10"');
    expect(out).toContain('y="20"');
    expect(out).toContain("a &amp; b");
  });
});

describe("rect", () => {
  it("emits rounded rects", () => {
    expect(rect({ x: 0, y: 0, w: 10, h: 4, fill: "#000", r: 2 })).toContain('rx="2"');
  });
});

describe("bar", () => {
  it("clamps fraction to the 0..1 range", () => {
    expect(bar({ x: 0, y: 0, w: 100, h: 8, fraction: 5, fill: "#000" })).toContain('width="100"');
    expect(bar({ x: 0, y: 0, w: 100, h: 8, fraction: -1, fill: "#000" })).toContain('width="0"');
  });
});
