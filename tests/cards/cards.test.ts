import { describe, it, expect } from "vitest";
import { renderIdentity } from "../../src/cards/identity.js";
import { renderPulse } from "../../src/cards/pulse.js";
import { renderHabits } from "../../src/cards/habits.js";
import { renderDashboard } from "../../src/cards/dashboard.js";
import { FIXTURE } from "../fixtures/profile-data.js";
import { THEMES } from "../../src/theme/tokens.js";

describe("renderIdentity", () => {
  const svg = renderIdentity(FIXTURE, THEMES.dark);

  it("declares the specified card dimensions", () => {
    expect(svg).toContain('width="560"');
    expect(svg).toContain('height="340"');
  });

  it("shows the display name and join year", () => {
    expect(svg).toContain("Alexander");
    expect(svg).toContain("2021");
  });

  it("formats disk usage in GB with two decimals", () => {
    expect(svg).toContain("1.95 GB");
  });

  it("abbreviates large line counts", () => {
    expect(svg).toContain("1.52m added");
    expect(svg).toContain("379k removed");
  });

  it("embeds the avatar as a data URI so the SVG is self-contained", () => {
    expect(svg).toContain("data:image/png;base64,");
  });

  it("renders in both themes without throwing", () => {
    expect(() => renderIdentity(FIXTURE, THEMES.light)).not.toThrow();
  });
});

describe("renderPulse", () => {
  const svg = renderPulse(FIXTURE, THEMES.dark);

  it("declares the specified card dimensions", () => {
    expect(svg).toContain('width="560"');
    expect(svg).toContain('height="340"');
  });

  it("draws exactly seven contribution squares", () => {
    expect(svg.match(/data-day="/g) ?? []).toHaveLength(7);
  });

  it("captions the repositories touched", () => {
    expect(svg).toContain("Contributed to 5 repositories");
  });

  it("shows all four social stats", () => {
    expect(svg).toContain("0 Sponsors");
    expect(svg).toContain("147 Stargazers");
    expect(svg).toContain("16 Forks");
    expect(svg).toContain("23 Watchers");
  });
});

describe("renderHabits", () => {
  const svg = renderHabits(FIXTURE, THEMES.dark);

  it("declares the specified card dimensions", () => {
    expect(svg).toContain('width="1120"');
    expect(svg).toContain('height="400"');
  });

  it("labels all three charts", () => {
    expect(svg).toContain("Commit activity per time of the day");
    expect(svg).toContain("Commit activity per day");
    expect(svg).toContain("Language activity");
  });

  it("labels every weekday", () => {
    for (const d of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      expect(svg).toContain(`>${d}<`);
    }
  });

  it("shows the top 3 commit languages as whole percentages", () => {
    expect(svg).toContain("TypeScript");
    expect(svg).toContain("62%");
    expect(svg).toContain("27%");
    expect(svg).toContain("11%");
  });

  it("renders both learned and learning sections", () => {
    expect(svg).toContain("Mastered technologies and topics");
    expect(svg).toContain("Still learning");
  });

  it("omits the learning section entirely when the list is empty", () => {
    const bare = { ...FIXTURE, authored: { ...FIXTURE.authored, learning: [] } };
    expect(renderHabits(bare, THEMES.dark)).not.toContain("Still learning");
  });
});

describe("renderDashboard", () => {
  const svg = renderDashboard(FIXTURE, THEMES.dark);

  it("declares the specified card dimensions", () => {
    expect(svg).toContain('width="560"');
    expect(svg).toContain('height="760"');
  });

  it("draws a 52x7 vertical calendar", () => {
    expect(svg.match(/data-cal="/g) ?? []).toHaveLength(52 * 7);
  });

  it("shows the current project with its doing and next lines", () => {
    expect(svg).toContain("profile-dashboard");
    expect(svg).toContain("Wiring up the renderer");
    expect(svg).toContain("Add the vertical contribution calendar");
  });

  it("renders a legend entry per byte language", () => {
    for (const l of FIXTURE.habits.byteLanguages) expect(svg).toContain(l.name);
  });

  it("renders page ratings as filled stars out of five", () => {
    expect(svg).toContain("★★★★☆");
  });

  it("lists the hand-authored tracks", () => {
    expect(svg).toContain("Mutter");
    expect(svg).toContain("Rammstein");
  });

  it("omits the project block when there is no current project", () => {
    const idle = { ...FIXTURE, currentProject: null };
    expect(() => renderDashboard(idle, THEMES.dark)).not.toThrow();
    expect(renderDashboard(idle, THEMES.dark)).not.toContain("What&apos;s next");
  });

  it("omits the pages block when the list is empty", () => {
    const bare = { ...FIXTURE, authored: { ...FIXTURE.authored, pages: [] } };
    expect(renderDashboard(bare, THEMES.dark)).not.toContain("Pages published");
  });
});
