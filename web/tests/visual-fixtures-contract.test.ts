import {describe, expect, test} from "bun:test";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {visualFixtures} from "../lib/visual-fixtures";

const css = readFileSync(join(import.meta.dir, "../app/visual-fixtures.css"), "utf8");

describe("visual fixture CSS contract", () => {
  test("keeps the capture canvas dimensions aligned with the manifest", () => {
    const dimensions = new Set(visualFixtures.map((fixture) => `${fixture.width}x${fixture.height}`));
    expect(dimensions).toEqual(new Set(["360x180"]));
    expect(css).toContain("width: 360px;");
    expect(css).toContain("height: 180px;");
  });

  test("keeps nondeterministic presentation out of fixture canvases", () => {
    expect(css).not.toMatch(/animation\s*:/);
    expect(css).not.toMatch(/transition\s*:/);
    expect(css).not.toMatch(/\b(vw|vh|dvw|dvh|svw|svh|lvw|lvh)\b/);
  });
});
