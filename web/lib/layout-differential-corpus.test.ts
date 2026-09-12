import {describe, expect, test} from "bun:test";
import {
  compareLayoutDifferentialFixture,
  createLayoutDifferentialCorpus,
  engineGeometryForDifferentialFixture,
  getLayoutDifferentialFixture,
  validateLayoutDifferentialFixture,
} from "./layout-differential-corpus";

describe("layout differential corpus", () => {
  test("publishes stable Block, Flex, and Grid fixtures with one explicit policy", () => {
    const corpus = createLayoutDifferentialCorpus();

    expect(corpus.map((fixture) => [fixture.id, fixture.kind])).toEqual([
      ["block-baseline", "block"],
      ["flex-engine", "flex"],
      ["grid-engine", "grid"],
    ]);
    for (const fixture of corpus) {
      expect(validateLayoutDifferentialFixture(fixture)).toEqual([]);
      expect(fixture.policy.version).toBe("layout-geometry-v1");
      expect(fixture.policy.roundingDecimals).toBe(4);
      expect(fixture.policy.tolerance).toEqual({x: 0.5, y: 0.5, width: 0.5, height: 0.5});
    }
  });

  test("replays exact engine geometry through the same differential comparison contract", () => {
    for (const fixture of createLayoutDifferentialCorpus()) {
      const comparisons = compareLayoutDifferentialFixture(
        fixture,
        engineGeometryForDifferentialFixture(fixture),
      );
      expect(comparisons.every((comparison) => comparison.matches)).toBe(true);
      expect(comparisons.every((comparison) => comparison.maximumDelta === 0)).toBe(true);
    }
  });

  test("keeps dynamic Flex and Grid inputs inside the reusable fixture definition", () => {
    const corpus = createLayoutDifferentialCorpus({
      flexInnerSize: 640,
      flexGapSize: 20,
      gridInnerSize: 620,
      gridGapSize: 12,
    });
    const flex = corpus.find((fixture) => fixture.id === "flex-engine")!;
    const grid = corpus.find((fixture) => fixture.id === "grid-engine")!;

    expect(flex.input).toEqual({innerSize: 640, gapSize: 20});
    expect(flex.browserTree.style).toMatchObject({width: 640, gap: 20});
    expect(flex.engineBoxes.find((box) => box.id === "root")?.rect.width).toBe(640);

    expect(grid.input).toEqual({innerSize: 620, gapSize: 12});
    expect(grid.browserTree.style).toMatchObject({width: 620, gap: 12});
    expect(grid.engineBoxes.find((box) => box.id === "root")?.rect.width).toBe(620);
  });

  test("keeps the explicit teaching span contribution outside Grid CSS conformance", () => {
    const grid = createLayoutDifferentialCorpus({gridInnerSize: 360, gridGapSize: 0})
      .find((fixture) => fixture.id === "grid-engine")!;
    const span = grid.browserTree.children.find((node) => node.id === "span-ab")!;
    const itemC = grid.engineBoxes.find((box) => box.id === "item-c")!;
    const spanBox = grid.engineBoxes.find((box) => box.id === "span-ab")!;

    expect(span.style).not.toHaveProperty("minWidth");
    expect(itemC.rect).toEqual({x: 260, y: 0, width: 100, height: 96});
    expect(spanBox.rect).toEqual({x: 0, y: 0, width: 260, height: 80});
    expect(grid.summary).toContain("teaching-only explicit spanning contribution is deliberately outside");
  });

  test("surfaces a deterministic field-level mismatch record", () => {
    const fixture = getLayoutDifferentialFixture("block-baseline");
    const browser = engineGeometryForDifferentialFixture(fixture).map((geometry) =>
      geometry.id === "content" ? {...geometry, width: geometry.width + 0.75} : geometry,
    );
    const content = compareLayoutDifferentialFixture(fixture, browser)
      .find((comparison) => comparison.id === "content")!;

    expect(content.matches).toBe(false);
    expect(content.maximumDelta).toBe(0.75);
    expect(content.fields.find((field) => field.field === "width")).toEqual({
      field: "width",
      engine: 360,
      browser: 360.75,
      delta: 0.75,
      matches: false,
    });
  });

  test("rejects unknown fixture ids", () => {
    expect(() => getLayoutDifferentialFixture("missing" as never)).toThrow("unknown layout differential fixture: missing");
  });
});
