import {describe, expect, test} from "bun:test";
import {
  adaptFlexTree,
  adaptGridTree,
  buildFlexLayoutTree,
  buildGridLayoutTree,
  flattenLayoutTree,
  validateLayoutTree,
  type LayoutNode,
} from "./layout-tree";

describe("typed layout tree", () => {
  test("validates and flattens the flex fixture deterministically", () => {
    const tree = buildFlexLayoutTree();

    expect(validateLayoutTree(tree)).toEqual([]);
    expect(flattenLayoutTree(tree)).toEqual([
      {id: "root", label: "Flex container", depth: 0, display: "flex", childCount: 3},
      {id: "item-a", label: "A", depth: 1, display: "block", childCount: 0},
      {id: "item-b", label: "B", depth: 1, display: "block", childCount: 0},
      {id: "item-c", label: "C", depth: 1, display: "block", childCount: 0},
    ]);
  });

  test("adapts the flex tree into the existing resolver contract", () => {
    expect(adaptFlexTree(buildFlexLayoutTree(520, 16))).toEqual({
      innerSize: 520,
      gapSize: 16,
      items: [
        {label: "A", basis: 120, grow: 1, shrink: 1, minSize: 80, maxSize: 220},
        {label: "B", basis: 132, grow: 8, shrink: 1, minSize: 96, maxSize: 184},
        {label: "C", basis: 112, grow: 2, shrink: 1, minSize: 72, maxSize: 240},
      ],
    });
  });

  test("adapts the grid tree into tracks and spanning contributions", () => {
    expect(adaptGridTree(buildGridLayoutTree(560, 16))).toEqual({
      innerSize: 560,
      gapSize: 16,
      tracks: [
        {label: "A", minSize: 96, fr: 1},
        {label: "B", minSize: 164, fr: 1},
        {label: "C", minSize: 88, fr: 2},
      ],
      contributions: [
        {label: "span A+B", start: 0, span: 2, minSize: 300},
      ],
    });
  });

  test("fails closed for unsupported resolver boundaries", () => {
    const tree = buildFlexLayoutTree();
    const columnTree: LayoutNode = {
      ...tree,
      style: {
        ...tree.style,
        flexContainer: {gap: 16, direction: "column"},
      },
    };

    expect(() => adaptFlexTree(columnTree)).toThrow("supports row direction only");
  });

  test("rejects duplicate ids and invalid numeric constraints", () => {
    const invalid: LayoutNode = {
      id: "root",
      label: "Root",
      style: {display: "block", minWidth: 100, maxWidth: 50},
      children: [
        {id: "root", label: "Duplicate", style: {display: "block", width: -1}, children: []},
      ],
    };

    expect(validateLayoutTree(invalid)).toEqual([
      "root: maxWidth must be greater than or equal to minWidth",
      "duplicate layout node id: root",
      "root: width must be finite and non-negative",
    ]);
  });
});
