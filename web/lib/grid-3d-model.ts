export type Grid3DPlacement = {
  start: number;
  span: number;
};

export type Grid3DGaps = {
  column: number;
  row: number;
  layer: number;
};

export type Grid3DItem = {
  id: string;
  column: Grid3DPlacement;
  row: Grid3DPlacement;
  layer: Grid3DPlacement;
};

export type Grid3DDefinition = {
  columns: number[];
  rows: number[];
  layers: number[];
  gaps: Grid3DGaps;
  items: Grid3DItem[];
};

export type ResolvedGrid3DBox = {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
};

export type ResolvedGrid3DScene = {
  width: number;
  height: number;
  depth: number;
  boxes: ResolvedGrid3DBox[];
};

export const HOUSE_GRID_3D_SOURCE = `scene {
  display: grid-3d;
  grid-template-columns: 4 4 4;
  grid-template-rows: 4 4;
  grid-template-layers: 2.8 2.8;
  gap: 0.25 0.25 0.4;
}

.living-room {
  grid-column: 1 / span 2;
  grid-row: 1;
  grid-layer: 1;
}

.kitchen {
  grid-column: 3;
  grid-row: 1;
  grid-layer: 1;
}

.garage {
  grid-column: 1;
  grid-row: 2;
  grid-layer: 1;
}

.stairs {
  grid-column: 2;
  grid-row: 2;
  grid-layer: 1 / span 2;
}

.bedroom {
  grid-column: 1;
  grid-row: 1 / span 2;
  grid-layer: 2;
}

.studio {
  grid-column: 3;
  grid-row: 1 / span 2;
  grid-layer: 2;
}`;

type DeclarationMap = Map<string, string>;

type AxisResolution = {
  offset: number;
  size: number;
};

function parseDeclarations(body: string): DeclarationMap {
  const declarations = new Map<string, string>();

  for (const chunk of body.split(";")) {
    const declaration = chunk.trim();
    if (!declaration) {
      continue;
    }

    const separator = declaration.indexOf(":");
    if (separator < 1) {
      throw new Error(`Invalid declaration: ${declaration}`);
    }

    const property = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();
    if (!value) {
      throw new Error(`Missing value for ${property}.`);
    }

    declarations.set(property, value);
  }

  return declarations;
}

function requiredDeclaration(declarations: DeclarationMap, property: string): string {
  const value = declarations.get(property);
  if (!value) {
    throw new Error(`Missing required ${property}.`);
  }
  return value;
}

function parseNumber(value: string, label: string, allowZero: boolean): number {
  const parsed = Number(value);
  const valid = Number.isFinite(parsed) && (allowZero ? parsed >= 0 : parsed > 0);
  if (!valid) {
    throw new Error(`${label} must be ${allowZero ? "zero or a positive number" : "a positive number"}.`);
  }
  return parsed;
}

function parseTrackList(value: string, property: string): number[] {
  const tracks = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((entry) => parseNumber(entry, property, false));

  if (tracks.length === 0) {
    throw new Error(`${property} requires at least one track.`);
  }

  return tracks;
}

function parseGapList(value: string): Grid3DGaps {
  const values = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((entry) => parseNumber(entry, "gap", true));

  if (values.length === 1) {
    return {column: values[0], row: values[0], layer: values[0]};
  }
  if (values.length === 3) {
    return {column: values[0], row: values[1], layer: values[2]};
  }

  throw new Error("gap accepts one value or three values: column row layer.");
}

function parsePlacement(value: string, property: string): Grid3DPlacement {
  const single = value.match(/^(\d+)$/);
  if (single) {
    return {start: Number(single[1]), span: 1};
  }

  const span = value.match(/^(\d+)\s*\/\s*span\s+(\d+)$/i);
  if (span) {
    return {start: Number(span[1]), span: Number(span[2])};
  }

  const endLine = value.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (endLine) {
    const start = Number(endLine[1]);
    const end = Number(endLine[2]);
    if (end <= start) {
      throw new Error(`${property} end line must be after its start line.`);
    }
    return {start, span: end - start};
  }

  throw new Error(`${property} must look like "2", "2 / 4", or "2 / span 2".`);
}

function parseScene(declarations: DeclarationMap): Omit<Grid3DDefinition, "items"> {
  const columns = parseTrackList(
    requiredDeclaration(declarations, "grid-template-columns"),
    "grid-template-columns",
  );
  const rows = parseTrackList(
    requiredDeclaration(declarations, "grid-template-rows"),
    "grid-template-rows",
  );
  const layers = parseTrackList(
    requiredDeclaration(declarations, "grid-template-layers"),
    "grid-template-layers",
  );

  let gaps: Grid3DGaps = {column: 0, row: 0, layer: 0};
  const gap = declarations.get("gap");
  if (gap) {
    gaps = parseGapList(gap);
  }
  if (declarations.has("column-gap")) {
    gaps.column = parseNumber(requiredDeclaration(declarations, "column-gap"), "column-gap", true);
  }
  if (declarations.has("row-gap")) {
    gaps.row = parseNumber(requiredDeclaration(declarations, "row-gap"), "row-gap", true);
  }
  if (declarations.has("layer-gap")) {
    gaps.layer = parseNumber(requiredDeclaration(declarations, "layer-gap"), "layer-gap", true);
  }

  return {columns, rows, layers, gaps};
}

function axisExtent(tracks: number[], gap: number): number {
  return tracks.reduce((sum, track) => sum + track, 0) + gap * Math.max(0, tracks.length - 1);
}

function resolveAxis(
  tracks: number[],
  gap: number,
  placement: Grid3DPlacement,
  axis: string,
  itemId: string,
): AxisResolution {
  const {start, span} = placement;
  if (!Number.isInteger(start) || start < 1 || !Number.isInteger(span) || span < 1) {
    throw new Error(`${itemId} has an invalid ${axis} placement.`);
  }

  const firstIndex = start - 1;
  const endExclusive = firstIndex + span;
  if (endExclusive > tracks.length) {
    throw new Error(`${itemId} exceeds the ${axis} track bounds.`);
  }

  const offset = tracks.slice(0, firstIndex).reduce((sum, track) => sum + track, 0) + gap * firstIndex;
  const size = tracks.slice(firstIndex, endExclusive).reduce((sum, track) => sum + track, 0) + gap * (span - 1);
  return {offset, size};
}

export function parseGrid3DSource(source: string): Grid3DDefinition {
  const normalized = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks: Array<{selector: string; declarations: DeclarationMap}> = [];
  const blockPattern = /([.#]?[A-Za-z][\w-]*)\s*\{([^}]*)\}/g;

  for (const match of normalized.matchAll(blockPattern)) {
    blocks.push({selector: match[1], declarations: parseDeclarations(match[2])});
  }

  const sceneBlocks = blocks.filter((block) => block.selector === "scene");
  if (sceneBlocks.length !== 1) {
    throw new Error("Grid3D source requires exactly one scene block.");
  }

  const scene = parseScene(sceneBlocks[0].declarations);
  const items = blocks
    .filter((block) => block.selector !== "scene")
    .map((block): Grid3DItem => {
      const id = block.selector.replace(/^[.#]/, "");
      if (!id) {
        throw new Error("Every Grid3D item needs a selector name.");
      }
      return {
        id,
        column: parsePlacement(requiredDeclaration(block.declarations, "grid-column"), "grid-column"),
        row: parsePlacement(requiredDeclaration(block.declarations, "grid-row"), "grid-row"),
        layer: parsePlacement(requiredDeclaration(block.declarations, "grid-layer"), "grid-layer"),
      };
    });

  return {...scene, items};
}

export function resolveGrid3D(definition: Grid3DDefinition): ResolvedGrid3DScene {
  const {columns, rows, layers, gaps, items} = definition;
  if (columns.length === 0 || rows.length === 0 || layers.length === 0) {
    throw new Error("Grid3D requires at least one column, row, and layer.");
  }

  for (const [axis, tracks] of [["column", columns], ["row", rows], ["layer", layers]] as const) {
    for (const track of tracks) {
      parseNumber(String(track), `${axis} track`, false);
    }
  }
  for (const [axis, gap] of [["column", gaps.column], ["row", gaps.row], ["layer", gaps.layer]] as const) {
    parseNumber(String(gap), `${axis} gap`, true);
  }

  const ids = new Set<string>();
  const boxes = items.map((item): ResolvedGrid3DBox => {
    if (ids.has(item.id)) {
      throw new Error(`Duplicate Grid3D item id: ${item.id}`);
    }
    ids.add(item.id);

    const column = resolveAxis(columns, gaps.column, item.column, "column", item.id);
    const row = resolveAxis(rows, gaps.row, item.row, "row", item.id);
    const layer = resolveAxis(layers, gaps.layer, item.layer, "layer", item.id);

    return {
      id: item.id,
      x: column.offset,
      y: layer.offset,
      z: row.offset,
      width: column.size,
      height: layer.size,
      depth: row.size,
    };
  });

  return {
    width: axisExtent(columns, gaps.column),
    height: axisExtent(layers, gaps.layer),
    depth: axisExtent(rows, gaps.row),
    boxes,
  };
}
