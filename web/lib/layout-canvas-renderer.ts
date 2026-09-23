import type {LayoutBox, LayoutRect} from "./layout-geometry";

export type LayoutCanvasViewport = {
  width: number;
  height: number;
  padding: number;
};

export type LayoutCanvasCommand = {
  id: string;
  label: string;
  depth: number;
  rect: LayoutRect;
};

export type LayoutCanvasScene = {
  viewport: LayoutCanvasViewport;
  contentBounds: LayoutRect;
  scale: number;
  commands: readonly LayoutCanvasCommand[];
};

function assertFiniteRect(id: string, rect: LayoutRect) {
  const values = [rect.x, rect.y, rect.width, rect.height];
  if (!values.every(Number.isFinite) || rect.width < 0 || rect.height < 0) {
    throw new Error(`${id}: canvas renderer requires finite, non-negative geometry`);
  }
}

function flattenWithDepth(root: LayoutBox) {
  const entries: {box: LayoutBox; depth: number}[] = [];
  const visit = (box: LayoutBox, depth: number) => {
    assertFiniteRect(box.id, box.rect);
    entries.push({box, depth});
    box.children.forEach((child) => visit(child, depth + 1));
  };
  visit(root, 0);
  return entries;
}

export function createLayoutCanvasScene(
  root: LayoutBox,
  viewport: LayoutCanvasViewport,
): LayoutCanvasScene {
  if (
    !Number.isFinite(viewport.width)
    || !Number.isFinite(viewport.height)
    || !Number.isFinite(viewport.padding)
    || viewport.width <= 0
    || viewport.height <= 0
    || viewport.padding < 0
  ) {
    throw new Error("canvas viewport must have finite positive dimensions and non-negative padding");
  }

  const entries = flattenWithDepth(root);
  const minX = Math.min(...entries.map(({box}) => box.rect.x));
  const minY = Math.min(...entries.map(({box}) => box.rect.y));
  const maxX = Math.max(...entries.map(({box}) => box.rect.x + box.rect.width));
  const maxY = Math.max(...entries.map(({box}) => box.rect.y + box.rect.height));
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const availableWidth = Math.max(1, viewport.width - viewport.padding * 2);
  const availableHeight = Math.max(1, viewport.height - viewport.padding * 2);
  const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
  const renderedWidth = contentWidth * scale;
  const renderedHeight = contentHeight * scale;
  const originX = viewport.padding + (availableWidth - renderedWidth) / 2 - minX * scale;
  const originY = viewport.padding + (availableHeight - renderedHeight) / 2 - minY * scale;

  return {
    viewport,
    contentBounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
    scale,
    commands: entries.map(({box, depth}) => ({
      id: box.id,
      label: box.label,
      depth,
      rect: {
        x: originX + box.rect.x * scale,
        y: originY + box.rect.y * scale,
        width: box.rect.width * scale,
        height: box.rect.height * scale,
      },
    })),
  };
}
