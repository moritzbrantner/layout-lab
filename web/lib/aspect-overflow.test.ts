import {describe, expect, test} from "bun:test";
import {clampScrollOffset, resolveAspectHeight, resolveOverflowExtent} from "./aspect-overflow";

describe("aspect and overflow helpers", () => {
  test("resolves the opposite axis from an explicit aspect ratio", () => {
    expect(resolveAspectHeight({width: 320, ratio: {width: 16, height: 9}})).toBe(180);
    expect(resolveAspectHeight({width: 300, ratio: {width: 4, height: 3}})).toBe(225);
  });

  test("normalizes unusable aspect inputs defensively", () => {
    expect(resolveAspectHeight({width: -10, ratio: {width: 16, height: 9}})).toBe(0);
    expect(resolveAspectHeight({width: 100, ratio: {width: 0, height: 9}})).toBe(0);
  });

  test("computes overflow extent from browser geometry", () => {
    expect(resolveOverflowExtent({clientSize: 320, scrollSize: 560})).toBe(240);
    expect(resolveOverflowExtent({clientSize: 560, scrollSize: 320})).toBe(0);
  });

  test("clamps requested scrolling to the measured extent", () => {
    expect(clampScrollOffset({requested: 120, maximum: 240})).toBe(120);
    expect(clampScrollOffset({requested: 400, maximum: 240})).toBe(240);
  });
});
