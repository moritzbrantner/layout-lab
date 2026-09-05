import type {
  Grid3DDefinition,
  Grid3DItem,
  Grid3DPlacement,
} from "./grid-3d-model";

export type Grid3DAxis = "column" | "row" | "layer";

type PlacementPatch = Partial<Grid3DPlacement>;

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error("Grid3D values must be finite numbers.");
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function placementSource(placement: Grid3DPlacement): string {
  return placement.span === 1
    ? String(placement.start)
    : `${placement.start} / span ${placement.span}`;
}

function tracksFor(definition: Grid3DDefinition, axis: Grid3DAxis): number[] {
  if (axis === "column") return definition.columns;
  if (axis === "row") return definition.rows;
  return definition.layers;
}

function placementFor(item: Grid3DItem, axis: Grid3DAxis): Grid3DPlacement {
  return item[axis];
}

function assertTrackValue(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Grid3D tracks must be positive finite numbers.");
  }
}

function assertGapValue(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Grid3D gaps must be zero or positive finite numbers.");
  }
}

function assertInteger(value: number, label: string) {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }
}

export function serializeGrid3DDefinition(definition: Grid3DDefinition): string {
  const scene = [
    "scene {",
    "  display: grid-3d;",
    `  grid-template-columns: ${definition.columns.map(formatNumber).join(" ")};`,
    `  grid-template-rows: ${definition.rows.map(formatNumber).join(" ")};`,
    `  grid-template-layers: ${definition.layers.map(formatNumber).join(" ")};`,
    `  gap: ${formatNumber(definition.gaps.column)} ${formatNumber(definition.gaps.row)} ${formatNumber(definition.gaps.layer)};`,
    "}",
  ].join("\n");

  const items = definition.items.map((item) => [
    `.${item.id} {`,
    `  grid-column: ${placementSource(item.column)};`,
    `  grid-row: ${placementSource(item.row)};`,
    `  grid-layer: ${placementSource(item.layer)};`,
    "}",
  ].join("\n"));

  return [scene, ...items].join("\n\n");
}

export function updateGrid3DTrack(
  definition: Grid3DDefinition,
  axis: Grid3DAxis,
  index: number,
  value: number,
): Grid3DDefinition {
  assertTrackValue(value);
  const tracks = [...tracksFor(definition, axis)];
  if (!Number.isInteger(index) || index < 0 || index >= tracks.length) {
    throw new Error(`Invalid ${axis} track index.`);
  }
  tracks[index] = value;

  if (axis === "column") return {...definition, columns: tracks};
  if (axis === "row") return {...definition, rows: tracks};
  return {...definition, layers: tracks};
}

export function updateGrid3DGap(
  definition: Grid3DDefinition,
  axis: Grid3DAxis,
  value: number,
): Grid3DDefinition {
  assertGapValue(value);
  return {
    ...definition,
    gaps: {...definition.gaps, [axis]: value},
  };
}

export function updateGrid3DItemPlacement(
  definition: Grid3DDefinition,
  itemId: string,
  axis: Grid3DAxis,
  patch: PlacementPatch,
): Grid3DDefinition {
  const trackCount = tracksFor(definition, axis).length;
  const item = definition.items.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error(`Unknown Grid3D item: ${itemId}`);
  }

  const current = placementFor(item, axis);
  const start = patch.start ?? current.start;
  assertInteger(start, `${axis} start`);
  if (start < 1 || start > trackCount) {
    throw new Error(`${axis} start must fit inside the available tracks.`);
  }

  const maximumSpan = trackCount - start + 1;
  let span = patch.span ?? current.span;
  if (patch.start !== undefined && patch.span === undefined) {
    span = Math.min(span, maximumSpan);
  }
  assertInteger(span, `${axis} span`);
  if (span < 1 || span > maximumSpan) {
    throw new Error(`${axis} span must fit inside the available tracks.`);
  }

  return {
    ...definition,
    items: definition.items.map((candidate) => candidate.id === itemId
      ? {...candidate, [axis]: {start, span}}
      : candidate),
  };
}

function cellOccupied(
  item: Grid3DItem,
  column: number,
  row: number,
  layer: number,
): boolean {
  const within = (placement: Grid3DPlacement, line: number) => (
    line >= placement.start && line < placement.start + placement.span
  );
  return within(item.column, column) && within(item.row, row) && within(item.layer, layer);
}

function nextItemId(definition: Grid3DDefinition): string {
  const ids = new Set(definition.items.map((item) => item.id));
  let suffix = 1;
  while (ids.has(`box-${suffix}`)) suffix += 1;
  return `box-${suffix}`;
}

export function addGrid3DItem(definition: Grid3DDefinition): Grid3DDefinition {
  let placement = {column: 1, row: 1, layer: 1};
  let found = false;

  for (let layer = 1; layer <= definition.layers.length && !found; layer += 1) {
    for (let row = 1; row <= definition.rows.length && !found; row += 1) {
      for (let column = 1; column <= definition.columns.length; column += 1) {
        const occupied = definition.items.some((item) => cellOccupied(item, column, row, layer));
        if (!occupied) {
          placement = {column, row, layer};
          found = true;
          break;
        }
      }
    }
  }

  return {
    ...definition,
    items: [
      ...definition.items,
      {
        id: nextItemId(definition),
        column: {start: placement.column, span: 1},
        row: {start: placement.row, span: 1},
        layer: {start: placement.layer, span: 1},
      },
    ],
  };
}

export function removeGrid3DItem(
  definition: Grid3DDefinition,
  itemId: string,
): Grid3DDefinition {
  if (!definition.items.some((item) => item.id === itemId)) {
    throw new Error(`Unknown Grid3D item: ${itemId}`);
  }
  return {
    ...definition,
    items: definition.items.filter((item) => item.id !== itemId),
  };
}
