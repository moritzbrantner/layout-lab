import {describe, expect, test} from "bun:test";
import {buildFlexEngineTree} from "./layout-engine-fixtures";
import {layoutFlexTree} from "./layout-engine";
import type {LayoutNode} from "./layout-tree";

describe("flex layout engine", () => {
  test("places a single row from the existing freeze and redistribution resolver", () => {
    const result = layoutFlexTree(buildFlexEngineTree());

    expect(result.visitedNodes).toBe(4);
    expect(result.resolution.iterations).toHaveLength(2);
    expect(result.resolution.items.find((item) => item.label === "B")?.clamp).toBe("max");
    expect(result.boxes.map((box) => [box.id, box.rect])).toEqual([
      ["root", {x: 0, y: 0, width: 520, height: 120}],
      ["item-a", {x: 0, y: 0, width: 144, height: 72}],
      ["item-b", {x: 160, y: 0, width: 184, height: 104}],
      ["item-c", {x: 360, y: 0, width: 160, height: 88}],
    ]);
  });

  test("derives cross size from the tallest explicit leaf when the root height is auto", () => {
    const source = buildFlexEngineTree();
    const tree: LayoutNode = {
      ...source,
      style: {...source.style, height: undefined},
    };

    expect(layoutFlexTree(tree).root.rect.height).toBe(104);
  });

  test("fails closed for nested flex item contents", () => {
    const source = buildFlexEngineTree();
    const nested: LayoutNode = {
      ...source,
      children: source.children.map((child, index) => index === 0
        ? {
            ...child,
            children: [
              {id: "nested", label: "Nested", style: {display: "block", height: 20}, children: []},
            ],
          }
        : child),
    };

    expect(() => layoutFlexTree(nested)).toThrow("item-a: flex baseline does not yet lay out nested item contents");
  });
});
