import {describe, expect, test} from "bun:test";
import {layoutBlockTree} from "./layout-engine";
import {buildBlockLayoutTree, type LayoutNode} from "./layout-tree";

describe("block layout engine", () => {
  test("stacks block children with width clamping and collapsed sibling margins", () => {
    const result = layoutBlockTree(buildBlockLayoutTree(420));

    expect(result.visitedNodes).toBe(4);
    expect(result.boxes.map((box) => [box.id, box.rect])).toEqual([
      ["block-root", {x: 0, y: 0, width: 420, height: 276}],
      ["header", {x: 0, y: 0, width: 420, height: 56}],
      ["content", {x: 0, y: 76, width: 360, height: 132}],
      ["footer", {x: 0, y: 232, width: 280, height: 44}],
    ]);
    expect(result.marginCollapses).toEqual([
      {beforeId: "header", afterId: "content", beforeMargin: 20, afterMargin: 12, resolvedGap: 20},
      {beforeId: "content", afterId: "footer", beforeMargin: 18, afterMargin: 24, resolvedGap: 24},
    ]);
  });

  test("derives nested block height from child flow", () => {
    const tree: LayoutNode = {
      id: "root",
      label: "Root",
      style: {display: "block", width: 300},
      children: [
        {
          id: "group",
          label: "Group",
          style: {display: "block", marginBlockBefore: 10, marginBlockAfter: 8},
          children: [
            {id: "a", label: "A", style: {display: "block", height: 20, marginBlockAfter: 6}, children: []},
            {id: "b", label: "B", style: {display: "block", height: 30, marginBlockBefore: 4}, children: []},
          ],
        },
      ],
    };

    const result = layoutBlockTree(tree);
    expect(result.boxes.map((box) => [box.id, box.rect.y, box.rect.height])).toEqual([
      ["root", 0, 74],
      ["group", 10, 56],
      ["a", 10, 20],
      ["b", 36, 30],
    ]);
  });

  test("fails closed when a non-block formatting context appears", () => {
    const tree: LayoutNode = {
      id: "root",
      label: "Root",
      style: {display: "block", width: 300},
      children: [
        {
          id: "flex",
          label: "Flex",
          style: {display: "flex", flexContainer: {gap: 0, direction: "row"}},
          children: [],
        },
      ],
    };

    expect(() => layoutBlockTree(tree)).toThrow("flex: block baseline supports block display only");
  });
});
