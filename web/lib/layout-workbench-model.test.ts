import {describe, expect, test} from "bun:test";
import {
  addWorkbenchItem,
  applyWorkbenchPreset,
  createWorkbenchState,
  moveWorkbenchItem,
  removeWorkbenchItem,
  updateWorkbenchItem,
} from "./layout-workbench-model";

describe("layout workbench model", () => {
  test("starts with equal visible flex growth", () => {
    const state = createWorkbenchState();

    expect(state.layout.mode).toBe("flex");
    expect(state.items.map((item) => item.grow)).toEqual([1, 1, 1, 1]);
    expect(state.items.every((item) => item.visible)).toBe(true);
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
    const next = updateWorkbenchItem(state, "C", {grow: 4, depth: 96, visible: false});

    expect(next.items.find((item) => item.id === "C")).toMatchObject({grow: 4, depth: 96, visible: false});
    expect(next.items.find((item) => item.id === "B")).toEqual(state.items.find((item) => item.id === "B"));
  });

  test("objects can be added and deleted without reusing identity", () => {
    const state = addWorkbenchItem(createWorkbenchState());
    const added = state.items.at(-1);
    const withoutAdded = removeWorkbenchItem(state, added!.id);
    const next = addWorkbenchItem(withoutAdded);

    expect(added).toMatchObject({id: "E", name: "Object E", visible: true});
    expect(withoutAdded.items.some((item) => item.id === "E")).toBe(false);
    expect(next.items.at(-1)?.id).toBe("F");
  });

  test("objects can move up and down deterministically", () => {
    const state = createWorkbenchState();
    const movedUp = moveWorkbenchItem(state, "C", "up");
    const movedBack = moveWorkbenchItem(movedUp, "C", "down");

    expect(movedUp.items.map((item) => item.id)).toEqual(["A", "C", "B", "D"]);
    expect(movedBack.items.map((item) => item.id)).toEqual(["A", "B", "C", "D"]);
    expect(moveWorkbenchItem(state, "A", "up")).toBe(state);
  });
});
