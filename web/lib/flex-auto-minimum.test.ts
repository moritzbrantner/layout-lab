import {describe, expect, test} from "bun:test";
import {resolveFlexMinimumFloor} from "./flex-auto-minimum";

describe("resolveFlexMinimumFloor", () => {
  test("uses browser-measured min-content for the scoped automatic minimum", () => {
    expect(resolveFlexMinimumFloor({mode: "auto", minContentSize: 184.5})).toEqual({
      mode: "auto",
      measuredMinContent: 184.5,
      minimum: 184.5,
      source: "browser min-content",
    });
  });

  test("explicit min-width zero removes the intrinsic floor", () => {
    expect(resolveFlexMinimumFloor({mode: "zero", minContentSize: 184.5})).toEqual({
      mode: "zero",
      measuredMinContent: 184.5,
      minimum: 0,
      source: "explicit zero",
    });
  });

  test("normalizes unusable browser evidence defensively", () => {
    expect(resolveFlexMinimumFloor({mode: "auto", minContentSize: Number.NaN}).minimum).toBe(0);
    expect(resolveFlexMinimumFloor({mode: "auto", minContentSize: -20}).minimum).toBe(0);
  });
});
