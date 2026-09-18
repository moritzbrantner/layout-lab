import {resolveAdjacentPositiveMargins} from "./flow-formatting";
import type {MinMaxGridResolution} from "./layout-analysis";
import type {LayoutNode} from "./layout-tree";

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

function clamp(value: number, minimum = 0, maximum = Number.POSITIVE_INFINITY) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function resolveLayoutWidth(node: LayoutNode, containingWidth: number) {
  const candidate = node.style.width ?? containingWidth;
  return clamp(candidate, node.style.minWidth ?? 0, node.style.maxWidth ?? Number.POSITIVE_INFINITY);
}

export function resolveLayoutHeight(node: LayoutNode, contentHeight: number) {
  const candidate = node.style.height ?? contentHeight;
  return clamp(candidate, node.style.minHeight ?? 0, node.style.maxHeight ?? Number.POSITIVE_INFINITY);
}

export function flattenLayoutBoxes(root: LayoutBox) {
  const boxes: LayoutBox[] = [];
  const visit = (box: LayoutBox) => {
    boxes.push(box);
    box.children.forEach(visit);
  };
  visit(root);
  return boxes;
}

export function maxChildBlockSize(children: readonly LayoutBox[]) {
  return children.reduce((maximum, child) => Math.max(maximum, child.rect.height), 0);
}

export function resolveBlockSiblingGap(previousAfter: number, before: number) {
  return resolveAdjacentPositiveMargins({
    mode: "collapse",
    before: previousAfter,
    after: before,
  }).gap;
}

export function resolveFlexItemRect(node: LayoutNode, x: number, width: number): LayoutRect {
  return {
    x,
    y: 0,
    width,
    height: resolveLayoutHeight(node, 0),
  };
}

export function resolveGridTrackStarts(resolution: MinMaxGridResolution, gap: number) {
  const starts: number[] = [];
  let cursor = 0;
  resolution.tracks.forEach((track) => {
    starts.push(cursor);
    cursor += track.targetSize + gap;
  });
  return starts;
}

export function resolveGridItemRect(
  node: LayoutNode,
  resolution: MinMaxGridResolution,
  trackStarts: readonly number[],
  gap: number,
): LayoutRect {
  const item = node.style.gridItem;
  if (!item) throw new Error(`${node.id}: grid item geometry requires explicit placement`);

  const end = item.columnStart + item.columnSpan;
  if (end > resolution.tracks.length) {
    throw new Error(`${node.id}: grid placement exceeds the explicit column set`);
  }

  const x = trackStarts[item.columnStart];
  if (x === undefined) {
    throw new Error(`${node.id}: grid placement has no resolved track start`);
  }

  let width = Math.max(0, item.columnSpan - 1) * gap;
  for (let index = item.columnStart; index < end; index += 1) {
    width += resolution.tracks[index]!.targetSize;
  }

  return {
    x,
    y: 0,
    width,
    height: resolveLayoutHeight(node, 0),
  };
}
