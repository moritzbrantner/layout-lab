import {describe, expect, test} from "bun:test";
import {resolveAdjacentPositiveMargins} from "../lib/flow-formatting";

describe("flow formatting model boundary", () => {
  test("models only the positive sibling-margin subset", () => {
    expect(resolveAdjacentPositiveMargins({mode: "collapse", before: 24, after: 40}).gap).toBe(40);
    expect(resolveAdjacentPositiveMargins({mode: "separate", before: 24, after: 40}).gap).toBe(64);
  });
});
