import {describe, expect, test} from "bun:test";
import {
  applyWorkbenchPreset,
  createWorkbenchState,
  updateWorkbenchItem,
} from "./layout-workbench-model";

describe("layout workbench model", () => {
  test("starts with equal flex growth", () => {
    const state = createWorkbenchState();

    expect(state.layout.mode).toBe("flex");
    expect(state.items.map((item) => item.grow)).toEqual([1, 1, 1, 1]);
  });

  test("dominant preset makes B consume substantially more free space", () => {
    const state = applyWorkbenchPreset("dominant-b");
    const itemB = state.items.find((item) => item.id === "B");

    expect(itemB?.grow).toBe(5);
    expect(itemB?.basis).toBe(132);
    expect(state.items.filter((item) => item.id !== "B").every((item) => item.grow === 1)).toBe(true);
  });

  test("max-clamp preset demonstrates flex growth constrained by max-width", () => {
    const state = applyWorkbenchPreset("max-clamp", "3d");
    const itemB = state.items.find((item) => item.id === "B");

    expect(state.view).toBe("3d");
    expect(itemB).toMatchObject({grow: 8, maxWidth: 184});
  });

  test("item updates preserve all siblings", () => {
    const state = createWorkbenchState();
    const next = updateWorkbenchItem(state, "C", {grow: 4, depth: 96});

    expect(next.items.find((item) => item.id === "C")).toMatchObject({grow: 4, depth: 96});
    expect(next.items.find((item) => item.id === "B")).toEqual(state.items.find((item) => item.id === "B"));
  });
});
