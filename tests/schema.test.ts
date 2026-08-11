import { describe, it, expect } from "vitest";
import { parseProfileYaml } from "../src/schema.js";

const MINIMAL = `
sponsors: 0
packages: 1
current:
  doing: "Building the dashboard"
  next: "Ship the workflow"
`;

describe("parseProfileYaml", () => {
  it("accepts a minimal document and defaults optional lists to empty", () => {
    const out = parseProfileYaml(MINIMAL);
    expect(out.sponsors).toBe(0);
    expect(out.packages).toBe(1);
    expect(out.learned).toEqual([]);
    expect(out.pages).toEqual([]);
    expect(out.tracks).toEqual([]);
  });

  it("throws a readable error when a required field is missing", () => {
    expect(() => parseProfileYaml("packages: 1")).toThrow(/sponsors/);
  });

  it("rejects a page rating outside 1..5", () => {
    const bad =
      MINIMAL +
      `
pages:
  - title: "Site"
    url: "https://example.com"
    rating: 9
`;
    expect(() => parseProfileYaml(bad)).toThrow(/rating|less than or equal/i);
  });

  it("rejects malformed YAML rather than returning partial data", () => {
    expect(() => parseProfileYaml("sponsors: [unclosed")).toThrow();
  });
});
