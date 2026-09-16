import type {FlexItemInput, GridSpanContribution, GridTrackInput} from "./layout-analysis";

export type LayoutDisplay = "block" | "flex" | "grid";

export type LayoutBoxStyle = {
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  height?: number;
  minHeight?: number;
  maxHeight?: number;
  marginBlockBefore?: number;
  marginBlockAfter?: number;
};

export type LayoutFlexContainerStyle = {
  gap: number;
  direction: "row" | "column";
};

export type LayoutFlexItemStyle = {
  basis: number;
  grow: number;
  shrink: number;
};

export type LayoutGridTrack = {
  label: string;
  minSize: number;
  fr: number;
};

export type LayoutGridContainerStyle = {
  gap: number;
  columns: readonly LayoutGridTrack[];
};

export type LayoutGridItemStyle = {
  columnStart: number;
  columnSpan: number;
  minContribution?: number;
};

export type LayoutStyle = LayoutBoxStyle & {
  display: LayoutDisplay;
  flexContainer?: LayoutFlexContainerStyle;
  flexItem?: LayoutFlexItemStyle;
  gridContainer?: LayoutGridContainerStyle;
  gridItem?: LayoutGridItemStyle;
};

export type LayoutNode = {
  id: string;
  label: string;
  style: LayoutStyle;
  children: readonly LayoutNode[];
};

export type LayoutTreeSnapshot = {
  id: string;
  label: string;
  depth: number;
  display: LayoutDisplay;
  childCount: number;
};

export type FlexTreeAdapterResult = {
  innerSize: number;
  gapSize: number;
  items: readonly FlexItemInput[];
};

export type GridTreeAdapterResult = {
  innerSize: number;
  gapSize: number;
  tracks: readonly GridTrackInput[];
  contributions: readonly GridSpanContribution[];
};

function finiteNonNegative(value: number | undefined) {
  return value === undefined || (Number.isFinite(value) && value >= 0);
}

function validateMinMax(
  nodeId: string,
  minimum: number | undefined,
  maximum: number | undefined,
  axis: "Width" | "Height",
  errors: string[],
) {
  if (minimum !== undefined && maximum !== undefined && maximum < minimum) {
    errors.push(`${nodeId}: max${axis} must be greater than or equal to min${axis}`);
  }
}

function validateNodeStyle(node: LayoutNode, errors: string[]) {
  const path = node.id || "<missing-id>";
  const {style} = node;

  if (!finiteNonNegative(style.width)) errors.push(`${path}: width must be finite and non-negative`);
  if (!finiteNonNegative(style.minWidth)) errors.push(`${path}: minWidth must be finite and non-negative`);
  if (!finiteNonNegative(style.maxWidth)) errors.push(`${path}: maxWidth must be finite and non-negative`);
  if (!finiteNonNegative(style.height)) errors.push(`${path}: height must be finite and non-negative`);
  if (!finiteNonNegative(style.minHeight)) errors.push(`${path}: minHeight must be finite and non-negative`);
  if (!finiteNonNegative(style.maxHeight)) errors.push(`${path}: maxHeight must be finite and non-negative`);
  if (!finiteNonNegative(style.marginBlockBefore)) errors.push(`${path}: marginBlockBefore must be finite and non-negative`);
  if (!finiteNonNegative(style.marginBlockAfter)) errors.push(`${path}: marginBlockAfter must be finite and non-negative`);
  validateMinMax(path, style.minWidth, style.maxWidth, "Width", errors);
  validateMinMax(path, style.minHeight, style.maxHeight, "Height", errors);

  if (style.display === "flex") {
    if (!style.flexContainer) errors.push(`${path}: flex containers require flexContainer settings`);
  } else if (style.flexContainer) {
    errors.push(`${path}: flexContainer settings require display:flex`);
  }

  if (style.flexContainer && !finiteNonNegative(style.flexContainer.gap)) {
    errors.push(`${path}: flex gap must be finite and non-negative`);
  }

  if (style.flexItem) {
    if (!finiteNonNegative(style.flexItem.basis)) errors.push(`${path}: flex basis must be finite and non-negative`);
    if (!finiteNonNegative(style.flexItem.grow)) errors.push(`${path}: flex grow must be finite and non-negative`);
    if (!finiteNonNegative(style.flexItem.shrink)) errors.push(`${path}: flex shrink must be finite and non-negative`);
  }

  if (style.display === "grid") {
    if (!style.gridContainer) errors.push(`${path}: grid containers require gridContainer settings`);
  } else if (style.gridContainer) {
    errors.push(`${path}: gridContainer settings require display:grid`);
  }

  if (style.gridContainer) {
    if (!finiteNonNegative(style.gridContainer.gap)) errors.push(`${path}: grid gap must be finite and non-negative`);
    if (style.gridContainer.columns.length === 0) errors.push(`${path}: grid containers require at least one column`);
    style.gridContainer.columns.forEach((track, index) => {
      if (!finiteNonNegative(track.minSize)) errors.push(`${path}: grid column ${index} minSize must be finite and non-negative`);
      if (!finiteNonNegative(track.fr)) errors.push(`${path}: grid column ${index} fr must be finite and non-negative`);
    });
  }

  if (style.gridItem) {
    if (!Number.isInteger(style.gridItem.columnStart) || style.gridItem.columnStart < 0) {
      errors.push(`${path}: grid columnStart must be a non-negative integer`);
    }
    if (!Number.isInteger(style.gridItem.columnSpan) || style.gridItem.columnSpan < 1) {
      errors.push(`${path}: grid columnSpan must be a positive integer`);
    }
    if (!finiteNonNegative(style.gridItem.minContribution)) {
      errors.push(`${path}: grid minContribution must be finite and non-negative`);
    }
  }
}

export function validateLayoutNodeShallow(node: LayoutNode): string[] {
  const errors: string[] = [];
  if (!node.id.trim()) errors.push("layout nodes require a non-empty id");
  if (!node.label.trim()) errors.push(`${node.id || "<missing-id>"}: layout nodes require a label`);
  validateNodeStyle(node, errors);
  return errors;
}

export function validateLayoutTree(root: LayoutNode): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const objects = new WeakSet<object>();

  const visit = (node: LayoutNode) => {
    if (objects.has(node)) {
      errors.push(`${node.id || "<missing-id>"}: layout tree contains a cycle or repeated node object`);
      return;
    }
    objects.add(node);

    if (!node.id.trim()) errors.push("layout nodes require a non-empty id");
    if (ids.has(node.id)) errors.push(`duplicate layout node id: ${node.id}`);
    ids.add(node.id);
    if (!node.label.trim()) errors.push(`${node.id || "<missing-id>"}: layout nodes require a label`);

    validateNodeStyle(node, errors);
    node.children.forEach(visit);
  };

  visit(root);
  return errors;
}

export function flattenLayoutTree(root: LayoutNode): LayoutTreeSnapshot[] {
  const snapshots: LayoutTreeSnapshot[] = [];
  const visit = (node: LayoutNode, depth: number) => {
    snapshots.push({
      id: node.id,
      label: node.label,
      depth,
      display: node.style.display,
      childCount: node.children.length,
    });
    node.children.forEach((child) => visit(child, depth + 1));
  };
  visit(root, 0);
  return snapshots;
}

function requireTreeWidth(root: LayoutNode) {
  if (root.style.width === undefined || !Number.isFinite(root.style.width) || root.style.width < 0) {
    throw new Error(`${root.id}: current numeric resolver adapter requires an explicit finite container width`);
  }
  return root.style.width;
}

export function adaptFlexTree(root: LayoutNode): FlexTreeAdapterResult {
  const errors = validateLayoutTree(root);
  if (errors.length > 0) throw new Error(errors.join("; "));
  if (root.style.display !== "flex" || !root.style.flexContainer) {
    throw new Error(`${root.id}: flex adapter requires a flex container root`);
  }
  if (root.style.flexContainer.direction !== "row") {
    throw new Error(`${root.id}: current flex resolver adapter supports row direction only`);
  }

  return {
    innerSize: requireTreeWidth(root),
    gapSize: root.style.flexContainer.gap,
    items: root.children.map((child): FlexItemInput => {
      if (!child.style.flexItem) throw new Error(`${child.id}: flex children require flexItem settings`);
      return {
        label: child.label,
        basis: child.style.flexItem.basis,
        grow: child.style.flexItem.grow,
        shrink: child.style.flexItem.shrink,
        minSize: child.style.minWidth,
        maxSize: child.style.maxWidth,
      };
    }),
  };
}

export function adaptGridTree(root: LayoutNode): GridTreeAdapterResult {
  const errors = validateLayoutTree(root);
  if (errors.length > 0) throw new Error(errors.join("; "));
  if (root.style.display !== "grid" || !root.style.gridContainer) {
    throw new Error(`${root.id}: grid adapter requires a grid container root`);
  }

  const contributions: GridSpanContribution[] = [];
  root.children.forEach((child) => {
    const item = child.style.gridItem;
    if (!item || item.minContribution === undefined) return;
    contributions.push({
      label: child.label,
      start: item.columnStart,
      span: item.columnSpan,
      minSize: item.minContribution,
    });
  });

  return {
    innerSize: requireTreeWidth(root),
    gapSize: root.style.gridContainer.gap,
    tracks: root.style.gridContainer.columns,
    contributions,
  };
}

export function buildFlexLayoutTree(innerSize = 520, gapSize = 16): LayoutNode {
  return {
    id: "root",
    label: "Flex container",
    style: {
      display: "flex",
      width: innerSize,
      flexContainer: {gap: gapSize, direction: "row"},
    },
    children: [
      {
        id: "item-a",
        label: "A",
        style: {display: "block", minWidth: 80, maxWidth: 220, flexItem: {basis: 120, grow: 1, shrink: 1}},
        children: [],
      },
      {
        id: "item-b",
        label: "B",
        style: {display: "block", minWidth: 96, maxWidth: 184, flexItem: {basis: 132, grow: 8, shrink: 1}},
        children: [],
      },
      {
        id: "item-c",
        label: "C",
        style: {display: "block", minWidth: 72, maxWidth: 240, flexItem: {basis: 112, grow: 2, shrink: 1}},
        children: [],
      },
    ],
  };
}

export function buildGridLayoutTree(innerSize = 560, gapSize = 16): LayoutNode {
  return {
    id: "root",
    label: "Grid container",
    style: {
      display: "grid",
      width: innerSize,
      gridContainer: {
        gap: gapSize,
        columns: [
          {label: "A", minSize: 96, fr: 1},
          {label: "B", minSize: 164, fr: 1},
          {label: "C", minSize: 88, fr: 2},
        ],
      },
    },
    children: [
      {
        id: "span-ab",
        label: "span A+B",
        style: {display: "block", gridItem: {columnStart: 0, columnSpan: 2, minContribution: 300}},
        children: [],
      },
    ],
  };
}

export function buildBlockLayoutTree(width = 420): LayoutNode {
  return {
    id: "block-root",
    label: "Block root",
    style: {display: "block", width},
    children: [
      {
        id: "header",
        label: "Header",
        style: {display: "block", height: 56, marginBlockAfter: 20},
        children: [],
      },
      {
        id: "content",
        label: "Content",
        style: {display: "block", minWidth: 240, maxWidth: 360, height: 132, marginBlockBefore: 12, marginBlockAfter: 18},
        children: [],
      },
      {
        id: "footer",
        label: "Footer",
        style: {display: "block", width: 280, height: 44, marginBlockBefore: 24},
        children: [],
      },
    ],
  };
}
