import contractJson from "../../contracts/layout-core-v1.json";
import {layoutBlockTree, layoutFlexTree, layoutGridTree, type LayoutBox} from "./layout-engine";
import type {LayoutNode} from "./layout-tree";

export const PORTABLE_LAYOUT_CONTRACT_VERSION = "layout-core-v1" as const;

export type PortableDisplay = "block" | "flex" | "grid";
export type PortableFixtureKind = "block" | "flex" | "grid";

export type PortableLayoutStyle = {
  display: PortableDisplay;
  width?: number;
  min_width?: number;
  max_width?: number;
  height?: number;
  min_height?: number;
  max_height?: number;
  margin_block_before?: number;
  margin_block_after?: number;
  flex_container?: {gap: number; direction: "row" | "column"};
  flex_item?: {basis: number; grow: number; shrink: number};
  grid_container?: {
    gap: number;
    columns: readonly {label: string; min_size: number; fr: number}[];
  };
  grid_item?: {
    column_start: number;
    column_span: number;
    min_contribution?: number;
  };
};

export type PortableLayoutNode = {
  id: string;
  label: string;
  style: PortableLayoutStyle;
  children: readonly PortableLayoutNode[];
};

export type PortableGeometry = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PortableLayoutFixture = {
  id: string;
  kind: PortableFixtureKind;
  tree: PortableLayoutNode;
  expected_geometry: readonly PortableGeometry[];
};

export type PortableLayoutContract = {
  version: typeof PORTABLE_LAYOUT_CONTRACT_VERSION;
  numeric_tolerance: number;
  fixtures: readonly PortableLayoutFixture[];
};

function asContract(value: unknown): PortableLayoutContract {
  const contract = value as Partial<PortableLayoutContract>;
  if (contract.version !== PORTABLE_LAYOUT_CONTRACT_VERSION) {
    throw new Error(`unsupported portable layout contract version: ${String(contract.version)}`);
  }
  if (!Number.isFinite(contract.numeric_tolerance) || (contract.numeric_tolerance ?? -1) < 0) {
    throw new Error("portable layout contract requires a finite non-negative numeric_tolerance");
  }
  if (!Array.isArray(contract.fixtures) || contract.fixtures.length === 0) {
    throw new Error("portable layout contract requires fixtures");
  }
  return contract as PortableLayoutContract;
}

export const portableLayoutContract = asContract(contractJson);

export function portableNodeToLayoutNode(node: PortableLayoutNode): LayoutNode {
  const style = node.style;
  return {
    id: node.id,
    label: node.label,
    style: {
      display: style.display,
      width: style.width,
      minWidth: style.min_width,
      maxWidth: style.max_width,
      height: style.height,
      minHeight: style.min_height,
      maxHeight: style.max_height,
      marginBlockBefore: style.margin_block_before,
      marginBlockAfter: style.margin_block_after,
      flexContainer: style.flex_container
        ? {gap: style.flex_container.gap, direction: style.flex_container.direction}
        : undefined,
      flexItem: style.flex_item
        ? {basis: style.flex_item.basis, grow: style.flex_item.grow, shrink: style.flex_item.shrink}
        : undefined,
      gridContainer: style.grid_container
        ? {
            gap: style.grid_container.gap,
            columns: style.grid_container.columns.map((track) => ({
              label: track.label,
              minSize: track.min_size,
              fr: track.fr,
            })),
          }
        : undefined,
      gridItem: style.grid_item
        ? {
            columnStart: style.grid_item.column_start,
            columnSpan: style.grid_item.column_span,
            minContribution: style.grid_item.min_contribution,
          }
        : undefined,
    },
    children: node.children.map(portableNodeToLayoutNode),
  };
}

function geometryFromBoxes(boxes: readonly LayoutBox[]): PortableGeometry[] {
  return boxes.map((box) => ({id: box.id, ...box.rect}));
}

export function runPortableFixtureInTypeScript(fixture: PortableLayoutFixture): PortableGeometry[] {
  const tree = portableNodeToLayoutNode(fixture.tree);
  if (fixture.kind === "block") return geometryFromBoxes(layoutBlockTree(tree).boxes);
  if (fixture.kind === "flex") return geometryFromBoxes(layoutFlexTree(tree).boxes);
  return geometryFromBoxes(layoutGridTree(tree).boxes);
}

export function comparePortableGeometry(
  actual: readonly PortableGeometry[],
  expected: readonly PortableGeometry[],
  tolerance = portableLayoutContract.numeric_tolerance,
): string[] {
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error("portable geometry tolerance must be finite and non-negative");
  const actualById = new Map(actual.map((geometry) => [geometry.id, geometry]));
  const expectedById = new Map(expected.map((geometry) => [geometry.id, geometry]));
  const errors: string[] = [];
  const ids = [...new Set([...actualById.keys(), ...expectedById.keys()])].sort();
  for (const id of ids) {
    const actualGeometry = actualById.get(id);
    const expectedGeometry = expectedById.get(id);
    if (!actualGeometry || !expectedGeometry) {
      errors.push(`${id}: geometry missing from ${actualGeometry ? "expected" : "actual"} output`);
      continue;
    }
    for (const field of ["x", "y", "width", "height"] as const) {
      const delta = Math.abs(actualGeometry[field] - expectedGeometry[field]);
      if (delta > tolerance) errors.push(`${id}.${field}: delta ${delta} exceeds ${tolerance}`);
    }
  }
  return errors;
}
