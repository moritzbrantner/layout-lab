import {describe, expect, test} from "bun:test";
import {
  resolveEqualFractionTracks,
  resolveFitContentSize,
  resolveFlexLine,
  resolveMinMaxFractionTracks,
} from "./layout-analysis";

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

  test("freezes a max-clamped grow item and redistributes the remainder", () => {
    const result = resolveFlexLine({
      innerSize: 500,
      gapSize: 0,
      items: [
        {label: "A", basis: 100, grow: 1, shrink: 1, maxSize: 120},
        {label: "B", basis: 100, grow: 1, shrink: 1},
      ],
    });

    expect(result.mode).toBe("grow");
    expect(result.iterations).toHaveLength(2);
    expect(result.iterations[0]?.newlyFrozen).toEqual(["A"]);
    expect(result.items[0]?.targetSize).toBe(120);
    expect(result.items[0]?.clamp).toBe("max");
    expect(result.items[0]?.frozen).toBe(true);
    expect(result.items[1]?.targetSize).toBe(380);
    expect(result.finalFreeSpace).toBeCloseTo(0);
  });

  test("freezes a min-clamped shrink item and redistributes the deficit", () => {
    const result = resolveFlexLine({
      innerSize: 180,
      gapSize: 0,
      items: [
        {label: "A", basis: 120, grow: 0, shrink: 1, minSize: 100},
        {label: "B", basis: 120, grow: 0, shrink: 1, minSize: 40},
      ],
    });

    expect(result.mode).toBe("shrink");
    expect(result.iterations).toHaveLength(2);
    expect(result.iterations[0]?.newlyFrozen).toEqual(["A"]);
    expect(result.items.map((item) => item.targetSize)).toEqual([100, 80]);
    expect(result.items[0]?.clamp).toBe("min");
    expect(result.finalFreeSpace).toBeCloseTo(0);
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

describe("resolveMinMaxFractionTracks", () => {
  test("uses a common flex fraction when all track minimums fit", () => {
    const result = resolveMinMaxFractionTracks({
      innerSize: 600,
      gapSize: 20,
      tracks: [
        {label: "1", minSize: 80, fr: 1},
        {label: "2", minSize: 140, fr: 1},
        {label: "3", minSize: 80, fr: 1},
      ],
    });

    expect(result.availableForTracks).toBe(560);
    expect(result.flexFraction).toBeCloseTo(186.666667, 5);
    expect(result.tracks.map((track) => track.targetSize)).toEqual([
      result.flexFraction,
      result.flexFraction,
      result.flexFraction,
    ]);
  });

  test("freezes a track whose minimum exceeds the candidate flex fraction", () => {
    const result = resolveMinMaxFractionTracks({
      innerSize: 400,
      gapSize: 10,
      tracks: [
        {label: "1", minSize: 80, fr: 1},
        {label: "2", minSize: 220, fr: 1},
        {label: "3", minSize: 80, fr: 1},
      ],
    });

    expect(result.availableForTracks).toBe(380);
    expect(result.tracks.map((track) => track.targetSize)).toEqual([80, 220, 80]);
    expect(result.tracks[1]?.frozen).toBe(true);
    expect(result.overflow).toBe(0);
  });

  test("distributes a spanning minimum contribution into track base sizes before flexing", () => {
    const result = resolveMinMaxFractionTracks({
      innerSize: 400,
      gapSize: 20,
      tracks: [
        {label: "1", minSize: 80, fr: 1},
        {label: "2", minSize: 80, fr: 1},
        {label: "3", minSize: 80, fr: 1},
      ],
      contributions: [{label: "span 1-2", start: 0, span: 2, minSize: 300}],
    });

    expect(result.contributionSteps[0]?.deficit).toBe(120);
    expect(result.contributionSteps[0]?.after).toEqual([140, 140]);
    expect(result.tracks.map((track) => track.targetSize)).toEqual([140, 140, 80]);
  });
});

describe("resolveFitContentSize", () => {
  test("clamps the available size between intrinsic bounds", () => {
    expect(resolveFitContentSize({minContent: 80, maxContent: 320, available: 40})).toBe(80);
    expect(resolveFitContentSize({minContent: 80, maxContent: 320, available: 200})).toBe(200);
    expect(resolveFitContentSize({minContent: 80, maxContent: 320, available: 400})).toBe(320);
  });
});
