import {resolveAdjacentPositiveMargins} from "./flow-formatting";
import {validateLayoutTree, type LayoutNode} from "./layout-tree";

export type LayoutRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutBox = {
  id: string;
  label: string;
  rect: LayoutRect;
  children: readonly LayoutBox[];
};

export type MarginCollapseEvidence = {
  beforeId: string;
  afterId: string;
  beforeMargin: number;
  afterMargin: number;
  resolvedGap: number;
};

export type BlockLayoutResult = {
  root: LayoutBox;
  boxes: readonly LayoutBox[];
  visitedNodes: number;
  marginCollapses: readonly MarginCollapseEvidence[];
};

function clamp(value: number, minimum = 0, maximum = Number.POSITIVE_INFINITY) {
  return Math.min(Math.max(value, minimum), maximum);
}

function resolveWidth(node: LayoutNode, containingWidth: number) {
  const candidate = node.style.width ?? containingWidth;
  return clamp(candidate, node.style.minWidth ?? 0, node.style.maxWidth ?? Number.POSITIVE_INFINITY);
}

function resolveHeight(node: LayoutNode, contentHeight: number) {
  const candidate = node.style.height ?? contentHeight;
  return clamp(candidate, node.style.minHeight ?? 0, node.style.maxHeight ?? Number.POSITIVE_INFINITY);
}

function assertBlockOnly(node: LayoutNode) {
  if (node.style.display !== "block") {
    throw new Error(`${node.id}: block baseline supports block display only`);
  }
  node.children.forEach(assertBlockOnly);
}

export function layoutBlockTree(root: LayoutNode): BlockLayoutResult {
  const errors = validateLayoutTree(root);
  if (errors.length > 0) throw new Error(errors.join("; "));
  assertBlockOnly(root);
  if (root.style.width === undefined) {
    throw new Error(`${root.id}: block baseline requires an explicit root width`);
  }

  const marginCollapses: MarginCollapseEvidence[] = [];

  const visit = (
    node: LayoutNode,
    containingWidth: number,
    originX: number,
    originY: number,
  ): LayoutBox => {
    const width = resolveWidth(node, containingWidth);
    const children: LayoutBox[] = [];
    let cursor = 0;
    let previousAfter = 0;
    let previousChildId: string | null = null;

    node.children.forEach((child, index) => {
      const before = child.style.marginBlockBefore ?? 0;
      let gap = before;

      if (index > 0 && previousChildId !== null) {
        const collapsed = resolveAdjacentPositiveMargins({
          mode: "collapse",
          before: previousAfter,
          after: before,
        });
        gap = collapsed.gap;
        marginCollapses.push({
          beforeId: previousChildId,
          afterId: child.id,
          beforeMargin: previousAfter,
          afterMargin: before,
          resolvedGap: gap,
        });
      }

      const childY = cursor + gap;
      const childBox = visit(child, width, originX, originY + childY);
      children.push(childBox);
      cursor = childY + childBox.rect.height;
      previousAfter = child.style.marginBlockAfter ?? 0;
      previousChildId = child.id;
    });

    const contentHeight = node.children.length > 0 ? cursor + previousAfter : 0;
    const height = resolveHeight(node, contentHeight);

    return {
      id: node.id,
      label: node.label,
      rect: {x: originX, y: originY, width, height},
      children,
    };
  };

  const rootBox = visit(root, root.style.width, 0, 0);
  const boxes: LayoutBox[] = [];
  const flatten = (box: LayoutBox) => {
    boxes.push(box);
    box.children.forEach(flatten);
  };
  flatten(rootBox);

  return {
    root: rootBox,
    boxes,
    visitedNodes: boxes.length,
    marginCollapses,
  };
}
