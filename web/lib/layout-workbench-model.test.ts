import {describe, expect, test} from "bun:test";
import {
  addWorkbenchChild,
  addWorkbenchItem,
  applyWorkbenchPreset,
  createWorkbenchState,
  findWorkbenchItem,
  moveWorkbenchItem,
  moveWorkbenchNode,
  removeWorkbenchItem,
  updateWorkbenchItem,
  visibleWorkbenchItems,
} from "./layout-workbench-model";

describe("layout workbench model", () => {
  test("starts with equal visible flex growth", () => {
    const state = createWorkbenchState();

    expect(state.layout.mode).toBe("flex");
    expect(state.items.map((item) => item.grow)).toEqual([1, 1, 1, 1]);
    expect(state.items.every((item) => item.visible)).toBe(true);
    expect(state.items.every((item) => item.children.length === 0)).toBe(true);
  });

  test("dominant preset makes B consume substantially more free space", () => {
    const state = applyWorkbenchPreset("dominant-b");
    const itemB = findWorkbenchItem(state.items, "B");

    expect(itemB?.grow).toBe(5);
    expect(itemB?.basis).toBe(132);
    expect(state.items.filter((item) => item.id !== "B").every((item) => item.grow === 1)).toBe(true);
  });

  test("max-clamp preset demonstrates flex growth constrained by max-width", () => {
    const state = applyWorkbenchPreset("max-clamp", "3d");
    const itemB = findWorkbenchItem(state.items, "B");

    expect(state.view).toBe("3d");
    expect(itemB).toMatchObject({grow: 8, maxWidth: 184});
  });

  test("item updates preserve nested identity and sibling values", () => {
    const nested = addWorkbenchChild(createWorkbenchState(), "B");
    const next = updateWorkbenchItem(nested, "E", {grow: 4, depth: 96, visible: false});

    expect(findWorkbenchItem(next.items, "E")).toMatchObject({grow: 4, depth: 96, visible: false});
    expect(findWorkbenchItem(next.items, "B")?.grow).toBe(1);
    expect(findWorkbenchItem(next.items, "C")).toEqual(findWorkbenchItem(nested.items, "C"));
  });

  test("add child uses the selected parent and never reuses identity", () => {
    const state = addWorkbenchChild(createWorkbenchState(), "B");
    const itemB = findWorkbenchItem(state.items, "B");
    const withoutAdded = removeWorkbenchItem(state, "E");
    const next = addWorkbenchChild(withoutAdded, "B");

    expect(itemB?.children).toHaveLength(1);
    expect(itemB?.children[0]).toMatchObject({id: "E", name: "Object E", visible: true});
    expect(findWorkbenchItem(withoutAdded.items, "E")).toBeNull();
    expect(findWorkbenchItem(next.items, "F")?.name).toBe("Object F");
  });

  test("legacy root add remains a root-child compatibility path", () => {
    const state = addWorkbenchItem(createWorkbenchState());

    expect(state.items.map((item) => item.id)).toEqual(["A", "B", "C", "D", "E"]);
  });

  test("drag move can reorder siblings", () => {
    const state = createWorkbenchState();
    const moved = moveWorkbenchNode(state, "A", "layout", 3);

    expect(moved.items.map((item) => item.id)).toEqual(["B", "C", "A", "D"]);
  });

  test("drag move can reparent a node", () => {
    const state = addWorkbenchChild(createWorkbenchState(), "B");
    const moved = moveWorkbenchNode(state, "D", "B", 1);

    expect(moved.items.map((item) => item.id)).toEqual(["A", "B", "C"]);
    expect(findWorkbenchItem(moved.items, "B")?.children.map((item) => item.id)).toEqual(["E", "D"]);
  });

  test("drag move cannot move a parent inside its own descendant", () => {
    const withChild = addWorkbenchChild(createWorkbenchState(), "B");
    const invalid = moveWorkbenchNode(withChild, "B", "E", 0);

    expect(invalid).toBe(withChild);
  });

  test("legacy up/down movement still works for nested siblings", () => {
    const state = addWorkbenchChild(addWorkbenchChild(createWorkbenchState(), "B"), "B");
    const moved = moveWorkbenchItem(state, "F", "up");

    expect(findWorkbenchItem(moved.items, "B")?.children.map((item) => item.id)).toEqual(["F", "E"]);
  });

  test("hidden parents hide their subtree from the flattened visible geometry list", () => {
    const nested = addWorkbenchChild(createWorkbenchState(), "B");
    const hidden = updateWorkbenchItem(nested, "B", {visible: false});

    expect(visibleWorkbenchItems(hidden.items).map((item) => item.id)).toEqual(["A", "C", "D"]);
  });
});
