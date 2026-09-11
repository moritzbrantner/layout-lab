import {describe, expect, test} from "bun:test";
import {
  resolveAbsoluteReference,
  resolveFixedReference,
  resolveStickyTop,
} from "./positioning-boundaries";

describe("positioning boundaries", () => {
  test("selects the nearest positioned ancestor for the scoped absolute case", () => {
    expect(resolveAbsoluteReference(true)).toBe("inner positioned ancestor");
    expect(resolveAbsoluteReference(false)).toBe("outer positioned ancestor");
  });

  test("selects the nearest transformed ancestor for the scoped fixed case", () => {
    expect(resolveFixedReference(true)).toBe("inner transformed ancestor");
    expect(resolveFixedReference(false)).toBe("outer transformed ancestor");
  });

  test("clamps sticky motion to the declared top inset", () => {
    expect(resolveStickyTop({normalTop: 72, scrollTop: 20, insetTop: 12})).toBe(52);
    expect(resolveStickyTop({normalTop: 72, scrollTop: 80, insetTop: 12})).toBe(12);
  });

  test("normalizes unusable sticky inputs defensively", () => {
    expect(resolveStickyTop({normalTop: Number.NaN, scrollTop: -10, insetTop: -5})).toBe(0);
  });
});
