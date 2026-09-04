import {describe, expect, test} from "bun:test";
import {resolveEqualFractionTracks, resolveFitContentSize, resolveFlexLine} from "./layout-analysis";

describe("resolveFlexLine", () => {
  test("distributes positive free space by grow factor", () => {
    const result = resolveFlexLine({
      innerSize: 360,
      gapSize: 10,
      items: [
        {label: "A", basis: 100, grow: 1, shrink: 1},
        {label: "B", basis: 100, grow: 2, shrink: 1},
      ],
    });

    expect(result.mode).toBe("grow");
    expect(result.freeSpace).toBe(150);
    expect(result.items[0]?.targetSize).toBeCloseTo(150);
    expect(result.items[1]?.targetSize).toBeCloseTo(200);
  });

  test("distributes negative free space by scaled shrink factor", () => {
    const result = resolveFlexLine({
      innerSize: 150,
      gapSize: 10,
      items: [
        {label: "A", basis: 100, grow: 0, shrink: 1},
        {label: "B", basis: 100, grow: 0, shrink: 1},
      ],
    });

    expect(result.mode).toBe("shrink");
    expect(result.freeSpace).toBe(-60);
    expect(result.items[0]?.targetSize).toBeCloseTo(70);
    expect(result.items[1]?.targetSize).toBeCloseTo(70);
  });

  test("leaves positive free space for alignment when no item can grow", () => {
    const result = resolveFlexLine({
      innerSize: 300,
      gapSize: 20,
      items: [
        {label: "A", basis: 80, grow: 0, shrink: 1},
        {label: "B", basis: 80, grow: 0, shrink: 1},
      ],
    });

    expect(result.mode).toBe("none");
    expect(result.freeSpace).toBe(120);
    expect(result.items.map((item) => item.targetSize)).toEqual([80, 80]);
  });
});

describe("resolveEqualFractionTracks", () => {
  test("subtracts gaps before dividing equal fraction tracks", () => {
    const result = resolveEqualFractionTracks({innerSize: 500, count: 3, gapSize: 20});

    expect(result.totalGap).toBe(40);
    expect(result.distributableSize).toBe(460);
    expect(result.trackSize).toBeCloseTo(153.333333, 5);
  });
});

describe("resolveFitContentSize", () => {
  test("clamps the available size between intrinsic bounds", () => {
    expect(resolveFitContentSize({minContent: 80, maxContent: 320, available: 40})).toBe(80);
    expect(resolveFitContentSize({minContent: 80, maxContent: 320, available: 200})).toBe(200);
    expect(resolveFitContentSize({minContent: 80, maxContent: 320, available: 400})).toBe(320);
  });
});
