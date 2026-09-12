import {buildFlexLayoutTree, type LayoutNode} from "./layout-tree";

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
