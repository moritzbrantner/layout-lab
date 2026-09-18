import contractJson from "../../contracts/layout-core-v1.json";
import {buildFlexEngineTree, buildGridEngineTree} from "./layout-engine-fixtures";
import {layoutBlockTree, layoutFlexTree, layoutGridTree, type LayoutBox} from "./layout-engine";
import {buildBlockLayoutTree, type LayoutNode} from "./layout-tree";

export const PORTABLE_LAYOUT_CONTRACT_VERSION = "layout-core-v1" as const;
export const PORTABLE_LAYOUT_NUMERIC_TOLERANCE = 1e-9;

export type PortableDisplay = "block" | "flex" | "grid";
export type PortableFixtureKind = "block" | "flex" | "grid";

export type PortableLayoutStyle = {
  readonly display: PortableDisplay;
  readonly width?: number;
  readonly min_width?: number;
  readonly max_width?: number;
  readonly height?: number;
  readonly min_height?: number;
  readonly max_height?: number;
  readonly margin_block_before?: number;
  readonly margin_block_after?: number;
  readonly flex_container?: {readonly gap: number; readonly direction: "row" | "column"};
  readonly flex_item?: {readonly basis: number; readonly grow: number; readonly shrink: number};
  readonly grid_container?: {
    readonly gap: number;
    readonly columns: readonly {readonly label: string; readonly min_size: number; readonly fr: number}[];
  };
  readonly grid_item?: {
    readonly column_start: number;
    readonly column_span: number;
    readonly min_contribution?: number;
  };
};

export type PortableLayoutNode = {
  readonly id: string;
  readonly label: string;
  readonly style: PortableLayoutStyle;
  readonly children: readonly PortableLayoutNode[];
};

export type PortableGeometry = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type PortableLayoutFixture = {
  readonly id: string;
  readonly kind: PortableFixtureKind;
  readonly tree: PortableLayoutNode;
  readonly expected_geometry: readonly PortableGeometry[];
};

export type PortableLayoutContract = {
  readonly version: typeof PORTABLE_LAYOUT_CONTRACT_VERSION;
  readonly authority: {
    readonly engine: "typescript-clean-layout";
    readonly fixture_source: "typed-h5-fixtures";
    readonly generator: "web/scripts/generate-portable-layout-contract.ts";
  };
  readonly numeric_tolerance: number;
  readonly fixtures: readonly PortableLayoutFixture[];
};

function asContract(value: unknown): PortableLayoutContract {
  const contract = value as Partial<PortableLayoutContract>;
  if (contract.version !== PORTABLE_LAYOUT_CONTRACT_VERSION) {
    throw new Error(`unsupported portable layout contract version: ${String(contract.version)}`);
  }
  if (contract.authority?.engine !== "typescript-clean-layout") {
    throw new Error("portable layout contract must declare the TypeScript clean engine as its source authority");
  }
  if (contract.authority?.fixture_source !== "typed-h5-fixtures") {
    throw new Error("portable layout contract must originate from the typed H5 fixtures");
  }
  if (contract.authority?.generator !== "web/scripts/generate-portable-layout-contract.ts") {
    throw new Error("portable layout contract must declare its canonical generator");
  }
  if (!Number.isFinite(contract.numeric_tolerance) || (contract.numeric_tolerance ?? -1) < 0) {
    throw new Error("portable layout contract requires a finite non-negative numeric_tolerance");
  }
  if (!Array.isArray(contract.fixtures) || contract.fixtures.length === 0) {
    throw new Error("portable layout contract requires fixtures");
  }
  return contract as PortableLayoutContract;
}

function portableStyle(node: LayoutNode): PortableLayoutStyle {
  const style = node.style;
  return {
    display: style.display,
    ...(style.width !== undefined ? {width: style.width} : {}),
    ...(style.minWidth !== undefined ? {min_width: style.minWidth} : {}),
    ...(style.maxWidth !== undefined ? {max_width: style.maxWidth} : {}),
    ...(style.height !== undefined ? {height: style.height} : {}),
    ...(style.minHeight !== undefined ? {min_height: style.minHeight} : {}),
    ...(style.maxHeight !== undefined ? {max_height: style.maxHeight} : {}),
    ...(style.marginBlockBefore !== undefined ? {margin_block_before: style.marginBlockBefore} : {}),
    ...(style.marginBlockAfter !== undefined ? {margin_block_after: style.marginBlockAfter} : {}),
    ...(style.flexContainer
      ? {flex_container: {gap: style.flexContainer.gap, direction: style.flexContainer.direction}}
      : {}),
    ...(style.flexItem
      ? {flex_item: {basis: style.flexItem.basis, grow: style.flexItem.grow, shrink: style.flexItem.shrink}}
      : {}),
    ...(style.gridContainer
      ? {
          grid_container: {
            gap: style.gridContainer.gap,
            columns: style.gridContainer.columns.map((track) => ({
              label: track.label,
              min_size: track.minSize,
              fr: track.fr,
            })),
          },
        }
      : {}),
    ...(style.gridItem
      ? {
          grid_item: {
            column_start: style.gridItem.columnStart,
            column_span: style.gridItem.columnSpan,
            ...(style.gridItem.minContribution !== undefined
              ? {min_contribution: style.gridItem.minContribution}
              : {}),
          },
        }
      : {}),
  };
}

export function layoutNodeToPortableNode(node: LayoutNode): PortableLayoutNode {
  return {
    id: node.id,
    label: node.label,
    style: portableStyle(node),
    children: node.children.map(layoutNodeToPortableNode),
  };
}

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

function runLayoutTree(kind: PortableFixtureKind, tree: LayoutNode): PortableGeometry[] {
  if (kind === "block") return geometryFromBoxes(layoutBlockTree(tree).boxes);
  if (kind === "flex") return geometryFromBoxes(layoutFlexTree(tree).boxes);
  return geometryFromBoxes(layoutGridTree(tree).boxes);
}

export function createPortableLayoutContract(): PortableLayoutContract {
  const fixtures: readonly {id: string; kind: PortableFixtureKind; tree: LayoutNode}[] = [
    {id: "block-baseline", kind: "block", tree: buildBlockLayoutTree()},
    {id: "flex-engine", kind: "flex", tree: buildFlexEngineTree()},
    {id: "grid-engine", kind: "grid", tree: buildGridEngineTree()},
  ];

  return {
    version: PORTABLE_LAYOUT_CONTRACT_VERSION,
    authority: {
      engine: "typescript-clean-layout",
      fixture_source: "typed-h5-fixtures",
      generator: "web/scripts/generate-portable-layout-contract.ts",
    },
    numeric_tolerance: PORTABLE_LAYOUT_NUMERIC_TOLERANCE,
    fixtures: fixtures.map((fixture) => ({
      id: fixture.id,
      kind: fixture.kind,
      tree: layoutNodeToPortableNode(fixture.tree),
      expected_geometry: runLayoutTree(fixture.kind, fixture.tree),
    })),
  };
}

export function serializePortableLayoutContract(contract = createPortableLayoutContract()) {
  return `${JSON.stringify(contract, null, 2)}\n`;
}

export const portableLayoutContract = asContract(contractJson);

export function runPortableFixtureInTypeScript(fixture: PortableLayoutFixture): PortableGeometry[] {
  return runLayoutTree(fixture.kind, portableNodeToLayoutNode(fixture.tree));
}

export function comparePortableGeometry(
  actual: readonly PortableGeometry[],
  expected: readonly PortableGeometry[],
  tolerance = portableLayoutContract.numeric_tolerance,
): string[] {
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new Error("portable geometry tolerance must be finite and non-negative");
  }

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
