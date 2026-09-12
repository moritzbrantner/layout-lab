import {buildFlexLayoutTree, buildGridLayoutTree, type LayoutNode} from "./layout-tree";

export function buildFlexEngineTree(width = 520, gap = 16): LayoutNode {
  const base = buildFlexLayoutTree(width, gap);
  const heights = [72, 104, 88] as const;

  return {
    ...base,
    label: "Flex engine root",
    style: {...base.style, height: 120},
    children: base.children.map((child, index) => ({
      ...child,
      style: {...child.style, height: heights[index] ?? 0},
    })),
  };
}

export function buildGridEngineTree(width = 560, gap = 16): LayoutNode {
  const base = buildGridLayoutTree(width, gap);
  const span = base.children[0]!;

  return {
    ...base,
    label: "Grid engine root",
    style: {...base.style, height: 120},
    children: [
      {
        ...span,
        label: "A+B panel",
        style: {...span.style, height: 80},
      },
      {
        id: "item-c",
        label: "C panel",
        style: {
          display: "block",
          height: 96,
          gridItem: {columnStart: 2, columnSpan: 1},
        },
        children: [],
      },
    ],
  };
}
