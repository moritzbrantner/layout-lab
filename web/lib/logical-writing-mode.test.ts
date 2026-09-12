import {describe, expect, test} from "bun:test";
import {resolveLogicalAxes, resolveLogicalPosition, resolveLogicalSize} from "./logical-writing-mode";

describe("logical writing-mode helpers", () => {
  test("maps horizontal inline direction and top-to-bottom block flow", () => {
    expect(resolveLogicalAxes({writingMode: "horizontal-tb", direction: "ltr"})).toEqual({
      inlineAxis: "horizontal",
      blockAxis: "vertical",
      inlineStart: "left",
      inlineEnd: "right",
      blockStart: "top",
      blockEnd: "bottom",
    });
    expect(resolveLogicalAxes({writingMode: "horizontal-tb", direction: "rtl"}).inlineStart).toBe("right");
  });

  test("maps vertical block flow independently from inline direction", () => {
    expect(resolveLogicalAxes({writingMode: "vertical-rl", direction: "ltr"})).toMatchObject({
      inlineStart: "top",
      blockStart: "right",
      blockEnd: "left",
    });
    expect(resolveLogicalAxes({writingMode: "vertical-lr", direction: "rtl"})).toMatchObject({
      inlineStart: "bottom",
      blockStart: "left",
      blockEnd: "right",
    });
  });

  test("swaps physical width and height for vertical writing modes", () => {
    expect(resolveLogicalSize({inlineSize: 210, blockSize: 120, writingMode: "horizontal-tb"})).toEqual({width: 210, height: 120});
    expect(resolveLogicalSize({inlineSize: 210, blockSize: 120, writingMode: "vertical-rl"})).toEqual({width: 120, height: 210});
  });

  test("resolves logical start insets to physical geometry", () => {
    expect(resolveLogicalPosition({
      containerWidth: 360,
      containerHeight: 260,
      inlineSize: 90,
      blockSize: 56,
      inlineStart: 20,
      blockStart: 28,
      writingMode: "horizontal-tb",
      direction: "rtl",
    })).toMatchObject({left: 250, top: 28, width: 90, height: 56});

    expect(resolveLogicalPosition({
      containerWidth: 360,
      containerHeight: 260,
      inlineSize: 90,
      blockSize: 56,
      inlineStart: 20,
      blockStart: 28,
      writingMode: "vertical-rl",
      direction: "ltr",
    })).toMatchObject({left: 276, top: 20, width: 56, height: 90});

    expect(resolveLogicalPosition({
      containerWidth: 360,
      containerHeight: 260,
      inlineSize: 90,
      blockSize: 56,
      inlineStart: 20,
      blockStart: 28,
      writingMode: "vertical-lr",
      direction: "rtl",
    })).toMatchObject({left: 28, top: 150, width: 56, height: 90});
  });
});
