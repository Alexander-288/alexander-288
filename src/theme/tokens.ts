export interface Theme {
  colorBg: string;
  colorFg: string;
  colorMuted: string;
  colorAccent: string;
  colorBorder: string;
  colorSuccess: string;
  colorDanger: string;
  /** [empty, l1, l2, l3, l4] — GitHub's contribution intensity scale. */
  contribution: readonly [string, string, string, string, string];
}

/** Primer color tokens. Values mirror GitHub's own light/dark defaults. */
export const THEMES = {
  light: {
    colorBg: "#ffffff",
    colorFg: "#1f2328",
    colorMuted: "#59636e",
    colorAccent: "#0969da",
    colorBorder: "#d1d9e0",
    colorSuccess: "#1a7f37",
    colorDanger: "#cf222e",
    contribution: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
  },
  dark: {
    colorBg: "#0d1117",
    colorFg: "#e6edf3",
    colorMuted: "#8b949e",
    colorAccent: "#4493f8",
    colorBorder: "#3d444d",
    colorSuccess: "#3fb950",
    colorDanger: "#f85149",
    contribution: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
  },
} as const satisfies Record<string, Theme>;

export type ThemeName = keyof typeof THEMES;

/** GitHub's own UI font stack, so cards match the surrounding page. */
export const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif";

export const TYPE = {
  title: 16,
  heading: 14,
  body: 12,
  small: 10,
} as const;

export const SPACE = { xs: 4, sm: 8, md: 16, lg: 24 } as const;
