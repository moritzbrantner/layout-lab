import {describe, expect, test} from "bun:test";
import {resolveAutoRepeat} from "./grid-auto-repeat";

describe("resolveAutoRepeat", () => {
  test("auto-fill keeps empty explicit tracks participating in sizing", () => {
    const result = resolveAutoRepeat({
      innerSize: 500,
      gapSize: 20,
      minTrackSize: 140,
      itemCount: 2,
      mode: "auto-fill",
    });

    expect(result.explicitTrackCount).toBe(3);
    expect(result.occupiedTrackCount).toBe(2);
    expect(result.sizingTrackCount).toBe(3);
    expect(result.emptyTrackCount).toBe(1);
    expect(result.collapsedTrackCount).toBe(0);
    expect(result.trackSize).toBeCloseTo(153.333333, 5);
  });

  test("auto-fit collapses empty tracks before distributing free space", () => {
    const result = resolveAutoRepeat({
      innerSize: 500,
      gapSize: 20,
      minTrackSize: 140,
      itemCount: 2,
      mode: "auto-fit",
    });

    expect(result.explicitTrackCount).toBe(3);
    expect(result.occupiedTrackCount).toBe(2);
    expect(result.sizingTrackCount).toBe(2);
    expect(result.collapsedTrackCount).toBe(1);
    expect(result.emptyTrackCount).toBe(0);
    expect(result.trackSize).toBe(240);
  });

  test("keeps one minimum-sized track when the container is narrower than the minimum", () => {
    const result = resolveAutoRepeat({
      innerSize: 100,
      gapSize: 16,
      minTrackSize: 140,
      itemCount: 1,
      mode: "auto-fit",
    });

    expect(result.explicitTrackCount).toBe(1);
    expect(result.trackSize).toBe(140);
    expect(result.overflow).toBe(40);
  });

  test("auto-fit collapses every explicit track when there are no items", () => {
    const result = resolveAutoRepeat({
      innerSize: 500,
      gapSize: 20,
      minTrackSize: 140,
      itemCount: 0,
      mode: "auto-fit",
    });

    expect(result.explicitTrackCount).toBe(3);
    expect(result.sizingTrackCount).toBe(0);
    expect(result.collapsedTrackCount).toBe(3);
    expect(result.trackSize).toBe(0);
  });
});
