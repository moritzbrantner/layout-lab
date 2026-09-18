import {
  resolveFlexLine,
  resolveMinMaxFractionTracks,
  type FlexLineResolution,
  type MinMaxGridResolution,
} from "./layout-analysis";
import {
  flattenLayoutBoxes,
  maxChildBlockSize,
  resolveBlockSiblingGap,
  resolveFlexItemRect,
  resolveGridItemRect,
  resolveGridTrackStarts,
  resolveLayoutHeight,
  resolveLayoutWidth,
  type LayoutBox,
} from "./layout-geometry";
import {adaptFlexTree, adaptGridTree, validateLayoutTree, type LayoutNode} from "./layout-tree";

export {
  flattenLayoutBoxes,
  resolveLayoutHeight,
  resolveLayoutWidth,
} from "./layout-geometry";
export type {LayoutBox, LayoutRect} from "./layout-geometry";

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

export type FlexLayoutResult = {
  root: LayoutBox;
  boxes: readonly LayoutBox[];
  visitedNodes: number;
  resolution: FlexLineResolution;
};

export type GridLayoutResult = {
  root: LayoutBox;
  boxes: readonly LayoutBox[];
  visitedNodes: number;
  resolution: MinMaxGridResolution;
  trackStarts: readonly number[];
};

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
    const width = resolveLayoutWidth(node, containingWidth);
    const children: LayoutBox[] = [];
    let cursor = 0;
    let previousAfter = 0;
    let previousChildId: string | null = null;

    node.children.forEach((child, index) => {
      const before = child.style.marginBlockBefore ?? 0;
      let gap = before;

      if (index > 0 && previousChildId !== null) {
        gap = resolveBlockSiblingGap(previousAfter, before);
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
    const height = resolveLayoutHeight(node, contentHeight);

    return {
      id: node.id,
      label: node.label,
      rect: {x: originX, y: originY, width, height},
      children,
    };
  };

  const rootBox = visit(root, root.style.width, 0, 0);
  const boxes = flattenLayoutBoxes(rootBox);

  return {
    root: rootBox,
    boxes,
    visitedNodes: boxes.length,
    marginCollapses,
  };
}

export function layoutFlexTree(root: LayoutNode): FlexLayoutResult {
  // The adapter owns validation for Flex inputs, so do not walk the tree twice.
  const input = adaptFlexTree(root);

  root.children.forEach((child) => {
    if (child.style.display !== "block") {
      throw new Error(`${child.id}: flex baseline supports block leaf items only`);
    }
    if (child.children.length > 0) {
      throw new Error(`${child.id}: flex baseline does not yet lay out nested item contents`);
    }
  });

  const resolution = resolveFlexLine(input);
  let cursor = 0;
  const children = root.children.map((child, index): LayoutBox => {
    const item = resolution.items[index]!;
    const box: LayoutBox = {
      id: child.id,
      label: child.label,
      rect: resolveFlexItemRect(child, cursor, item.targetSize),
      children: [],
    };
    cursor += item.targetSize + input.gapSize;
    return box;
  });

  const rootHeight = resolveLayoutHeight(root, maxChildBlockSize(children));
  const rootBox: LayoutBox = {
    id: root.id,
    label: root.label,
    rect: {
      x: 0,
      y: 0,
      width: input.innerSize,
      height: rootHeight,
    },
    children,
  };
  const boxes = flattenLayoutBoxes(rootBox);

  return {
    root: rootBox,
    boxes,
    visitedNodes: boxes.length,
    resolution,
  };
}

export function layoutGridTree(root: LayoutNode): GridLayoutResult {
  // The adapter owns validation for Grid inputs, so do not walk the tree twice.
  const input = adaptGridTree(root);

  root.children.forEach((child) => {
    if (child.style.display !== "block") {
      throw new Error(`${child.id}: grid baseline supports block leaf items only`);
    }
    if (child.children.length > 0) {
      throw new Error(`${child.id}: grid baseline does not yet lay out nested item contents`);
    }
    if (!child.style.gridItem) {
      throw new Error(`${child.id}: grid baseline requires explicit column placement`);
    }
    const end = child.style.gridItem.columnStart + child.style.gridItem.columnSpan;
    if (end > input.tracks.length) {
      throw new Error(`${child.id}: grid placement exceeds the explicit column set`);
    }
  });

  const resolution = resolveMinMaxFractionTracks(input);
  const trackStarts = resolveGridTrackStarts(resolution, input.gapSize);

  const children = root.children.map((child): LayoutBox => {
    return {
      id: child.id,
      label: child.label,
      rect: resolveGridItemRect(child, resolution, trackStarts, input.gapSize),
      children: [],
    };
  });

  const rootHeight = resolveLayoutHeight(root, maxChildBlockSize(children));
  const rootBox: LayoutBox = {
    id: root.id,
    label: root.label,
    rect: {
      x: 0,
      y: 0,
      width: input.innerSize,
      height: rootHeight,
    },
    children,
  };
  const boxes = flattenLayoutBoxes(rootBox);

  return {
    root: rootBox,
    boxes,
    visitedNodes: boxes.length,
    resolution,
    trackStarts,
  };
}
