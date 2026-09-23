import type {LayoutBox, LayoutRect} from "./layout-geometry";
import {
  validateLayoutTree,
  type LayoutDisplay,
  type LayoutNode,
  type LayoutStyle,
} from "./layout-tree";

export const PORTABLE_LAYOUT_CONTRACT_VERSION = "layout-lab/portable-layout-v1" as const;
export const PORTABLE_LAYOUT_COORDINATE_SPACE = "css-px" as const;

export type PortableLayoutStyle = {
  display: LayoutDisplay;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  height?: number;
  minHeight?: number;
  maxHeight?: number;
  marginBlockBefore?: number;
  marginBlockAfter?: number;
  flexContainer?: {
    gap: number;
    direction: "row" | "column";
  };
  flexItem?: {
    basis: number;
    grow: number;
    shrink: number;
  };
  gridContainer?: {
    gap: number;
    columns: readonly {
      label: string;
      minSize: number;
      fr: number;
    }[];
  };
  gridItem?: {
    columnStart: number;
    columnSpan: number;
    minContribution?: number;
  };
};

export type PortableLayoutNode = {
  id: string;
  label: string;
  style: PortableLayoutStyle;
  children: readonly PortableLayoutNode[];
};

export type PortableLayoutBox = {
  id: string;
  label: string;
  rect: LayoutRect;
  children: readonly PortableLayoutBox[];
};

export type PortableLayoutTreeDocument = {
  contractVersion: typeof PORTABLE_LAYOUT_CONTRACT_VERSION;
  kind: "layout-tree";
  coordinateSpace: typeof PORTABLE_LAYOUT_COORDINATE_SPACE;
  root: PortableLayoutNode;
};

export type PortableLayoutGeometryDocument = {
  contractVersion: typeof PORTABLE_LAYOUT_CONTRACT_VERSION;
  kind: "geometry";
  coordinateSpace: typeof PORTABLE_LAYOUT_COORDINATE_SPACE;
  root: PortableLayoutBox;
};

export type PortableLayoutDocument =
  | PortableLayoutTreeDocument
  | PortableLayoutGeometryDocument;

function copyOptionalNumber(
  target: Record<string, unknown>,
  source: LayoutStyle,
  key:
    | "width"
    | "minWidth"
    | "maxWidth"
    | "height"
    | "minHeight"
    | "maxHeight"
    | "marginBlockBefore"
    | "marginBlockAfter",
) {
  const value = source[key];
  if (value !== undefined) target[key] = value;
}

function toPortableStyle(style: LayoutStyle): PortableLayoutStyle {
  const portable: Record<string, unknown> = {display: style.display};

  copyOptionalNumber(portable, style, "width");
  copyOptionalNumber(portable, style, "minWidth");
  copyOptionalNumber(portable, style, "maxWidth");
  copyOptionalNumber(portable, style, "height");
  copyOptionalNumber(portable, style, "minHeight");
  copyOptionalNumber(portable, style, "maxHeight");
  copyOptionalNumber(portable, style, "marginBlockBefore");
  copyOptionalNumber(portable, style, "marginBlockAfter");

  if (style.flexContainer) {
    portable.flexContainer = {
      gap: style.flexContainer.gap,
      direction: style.flexContainer.direction,
    };
  }

  if (style.flexItem) {
    portable.flexItem = {
      basis: style.flexItem.basis,
      grow: style.flexItem.grow,
      shrink: style.flexItem.shrink,
    };
  }

  if (style.gridContainer) {
    portable.gridContainer = {
      gap: style.gridContainer.gap,
      columns: style.gridContainer.columns.map((track) => ({
        label: track.label,
        minSize: track.minSize,
        fr: track.fr,
      })),
    };
  }

  if (style.gridItem) {
    portable.gridItem = {
      columnStart: style.gridItem.columnStart,
      columnSpan: style.gridItem.columnSpan,
      ...(style.gridItem.minContribution === undefined
        ? {}
        : {minContribution: style.gridItem.minContribution}),
    };
  }

  return portable as PortableLayoutStyle;
}

function toPortableNode(node: LayoutNode): PortableLayoutNode {
  return {
    id: node.id,
    label: node.label,
    style: toPortableStyle(node.style),
    children: node.children.map(toPortableNode),
  };
}

function assertPortableRect(id: string, rect: LayoutRect) {
  if (
    !Number.isFinite(rect.x)
    || !Number.isFinite(rect.y)
    || !Number.isFinite(rect.width)
    || !Number.isFinite(rect.height)
    || rect.width < 0
    || rect.height < 0
  ) {
    throw new Error(`${id}: portable geometry requires finite coordinates and non-negative sizes`);
  }
}

function toPortableBox(box: LayoutBox): PortableLayoutBox {
  assertPortableRect(box.id, box.rect);
  return {
    id: box.id,
    label: box.label,
    rect: {
      x: box.rect.x,
      y: box.rect.y,
      width: box.rect.width,
      height: box.rect.height,
    },
    children: box.children.map(toPortableBox),
  };
}

export function exportPortableLayoutTree(root: LayoutNode): PortableLayoutTreeDocument {
  const errors = validateLayoutTree(root);
  if (errors.length > 0) {
    throw new Error(`cannot export invalid layout tree: ${errors.join("; ")}`);
  }

  return {
    contractVersion: PORTABLE_LAYOUT_CONTRACT_VERSION,
    kind: "layout-tree",
    coordinateSpace: PORTABLE_LAYOUT_COORDINATE_SPACE,
    root: toPortableNode(root),
  };
}

export function exportPortableLayoutGeometry(root: LayoutBox): PortableLayoutGeometryDocument {
  return {
    contractVersion: PORTABLE_LAYOUT_CONTRACT_VERSION,
    kind: "geometry",
    coordinateSpace: PORTABLE_LAYOUT_COORDINATE_SPACE,
    root: toPortableBox(root),
  };
}

export function serializePortableLayoutDocument(document: PortableLayoutDocument) {
  return `${JSON.stringify(document, null, 2)}\n`;
}
