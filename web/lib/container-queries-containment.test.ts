import {describe, expect, test} from "bun:test";
import {matchesMinInlineSize, resolveIntrinsicInlineContribution} from "./container-queries-containment";

describe("container queries and containment helpers", () => {
  test("evaluates a minimum inline-size threshold deterministically", () => {
    expect(matchesMinInlineSize({containerInlineSize: 319, minimumInlineSize: 320})).toBe(false);
    expect(matchesMinInlineSize({containerInlineSize: 320, minimumInlineSize: 320})).toBe(true);
    expect(matchesMinInlineSize({containerInlineSize: 420, minimumInlineSize: 320})).toBe(true);
  });

  test("uses content size when inline-size containment is absent", () => {
    expect(resolveIntrinsicInlineContribution({
      contentInlineSize: 360,
      containment: "none",
      fallbackInlineSize: 180,
    })).toBe(360);
  });

  test("uses the explicit intrinsic fallback under inline-size containment", () => {
    expect(resolveIntrinsicInlineContribution({
      contentInlineSize: 360,
      containment: "inline-size",
      fallbackInlineSize: 180,
    })).toBe(180);
  });

  test("normalizes invalid numeric evidence defensively", () => {
    expect(matchesMinInlineSize({containerInlineSize: Number.NaN, minimumInlineSize: 320})).toBe(false);
    expect(resolveIntrinsicInlineContribution({
      contentInlineSize: -10,
      containment: "inline-size",
      fallbackInlineSize: Number.NaN,
    })).toBe(0);
  });
});
