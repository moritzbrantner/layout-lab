import {describe, expect, test} from "bun:test";
import {createPaintOrderFixture, resolvePaintOrder, topToBottomPaintIds} from "./paint-order";

describe("scoped paint-order model", () => {
  test("orders the supported paint phases from back to front", () => {
    expect(resolvePaintOrder(createPaintOrderFixture()).map((item) => item.id)).toEqual([
      "root",
      "negative-a",
      "negative-b",
      "block",
      "inline",
      "positioned",
      "positive-a",
      "positive-b",
    ]);
  });

  test("sorts negative and positive positioned contexts by z-index within their phase", () => {
    expect(resolvePaintOrder(createPaintOrderFixture({negativeA: -1, negativeB: -4, positiveA: 5, positiveB: 2})).map((item) => item.id)).toEqual([
      "root",
      "negative-b",
      "negative-a",
      "block",
      "inline",
      "positioned",
      "positive-b",
      "positive-a",
    ]);
  });

  test("preserves DOM order as the tie-breaker inside a paint phase", () => {
    expect(resolvePaintOrder(createPaintOrderFixture({negativeA: -2, negativeB: -2, positiveA: 2, positiveB: 2})).map((item) => item.id)).toEqual([
      "root",
      "negative-a",
      "negative-b",
      "block",
      "inline",
      "positioned",
      "positive-a",
      "positive-b",
    ]);
  });

  test("exposes the reverse order expected from elementsFromPoint", () => {
    expect(topToBottomPaintIds(createPaintOrderFixture()).slice(0, 3)).toEqual([
      "positive-b",
      "positive-a",
      "positioned",
    ]);
  });
});
