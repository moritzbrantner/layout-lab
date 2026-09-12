import {resolveAdjacentPositiveMargins} from "./flow-formatting";
import {
  resolveFlexLine,
  resolveMinMaxFractionTracks,
  type FlexLineResolution,
  type MinMaxGridResolution,
} from "./layout-analysis";
import {adaptFlexTree, adaptGridTree, validateLayoutTree, type LayoutNode} from "./layout-tree";

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

function flattenBoxes(root: LayoutBox) {
  const boxes: LayoutBox[] = [];
  const visit = (box: LayoutBox) => {
    boxes.push(box);
    box.children.forEach(visit);
  };
  visit(root);
  return boxes;
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
  const boxes = flattenBoxes(rootBox);

  return {
    root: rootBox,
    boxes,
    visitedNodes: boxes.length,
    marginCollapses,
  };
}

export function layoutFlexTree(root: LayoutNode): FlexLayoutResult {
  const errors = validateLayoutTree(root);
  if (errors.length > 0) throw new Error(errors.join("; "));
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
    const height = resolveHeight(child, 0);
    const box: LayoutBox = {
      id: child.id,
      label: child.label,
      rect: {
        x: cursor,
        y: 0,
        width: item.targetSize,
        height,
      },
      children: [],
    };
    cursor += item.targetSize + input.gapSize;
    return box;
  });

  const derivedHeight = children.reduce((maximum, child) => Math.max(maximum, child.rect.height), 0);
  const rootHeight = resolveHeight(root, derivedHeight);
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
  const boxes = flattenBoxes(rootBox);

  return {
    root: rootBox,
    boxes,
    visitedNodes: boxes.length,
    resolution,
  };
}

export function layoutGridTree(root: LayoutNode): GridLayoutResult {
  const errors = validateLayoutTree(root);
  if (errors.length > 0) throw new Error(errors.join("; "));
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
  const trackStarts: number[] = [];
  let cursor = 0;
  resolution.tracks.forEach((track) => {
    trackStarts.push(cursor);
    cursor += track.targetSize + input.gapSize;
  });

  const children = root.children.map((child): LayoutBox => {
    const item = child.style.gridItem!;
    const trackSizes = resolution.tracks
      .slice(item.columnStart, item.columnStart + item.columnSpan)
      .map((track) => track.targetSize);
    const width = trackSizes.reduce((sum, size) => sum + size, 0)
      + Math.max(0, item.columnSpan - 1) * input.gapSize;

    return {
      id: child.id,
      label: child.label,
      rect: {
        x: trackStarts[item.columnStart]!,
        y: 0,
        width,
        height: resolveHeight(child, 0),
      },
      children: [],
    };
  });

  const derivedHeight = children.reduce((maximum, child) => Math.max(maximum, child.rect.height), 0);
  const rootHeight = resolveHeight(root, derivedHeight);
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
  const boxes = flattenBoxes(rootBox);

  return {
    root: rootBox,
    boxes,
    visitedNodes: boxes.length,
    resolution,
    trackStarts,
  };
}
