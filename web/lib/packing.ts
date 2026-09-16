export type PackingItem = {
  id: string;
  columnSpan: number;
  height: number;
};

export type PackingInput = {
  containerWidth: number;
  columns: number;
  gap: number;
  items: readonly PackingItem[];
};

export type PackingPlacement = {
  id: string;
  columnStart: number;
  columnSpan: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PackingResult = {
  placements: readonly PackingPlacement[];
  geometry: readonly {id: string; x: number; y: number; width: number; height: number}[];
  candidateEvaluations: number;
  containerHeight: number;
};

const EPSILON = 1e-9;

function round(value: number) {
  const rounded = Math.round(value * 10_000) / 10_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function validateInput(input: PackingInput) {
  if (!Number.isFinite(input.containerWidth) || input.containerWidth <= 0) {
    throw new Error("packing containerWidth must be finite and positive");
  }
  if (!Number.isInteger(input.columns) || input.columns < 1) {
    throw new Error("packing columns must be a positive integer");
  }
  if (!Number.isFinite(input.gap) || input.gap < 0) {
    throw new Error("packing gap must be finite and non-negative");
  }
  const usable = input.containerWidth - input.gap * (input.columns - 1);
  if (usable <= 0) throw new Error("packing gap leaves no usable column width");
  if (input.items.length === 0) throw new Error("packing requires at least one item");

  const ids = new Set<string>();
  input.items.forEach((item) => {
    if (!item.id.trim()) throw new Error("packing item ids must be non-empty");
    if (ids.has(item.id)) throw new Error(`duplicate packing item id: ${item.id}`);
    ids.add(item.id);
    if (!Number.isInteger(item.columnSpan) || item.columnSpan < 1 || item.columnSpan > input.columns) {
      throw new Error(`${item.id}: columnSpan must be between 1 and ${input.columns}`);
    }
    if (!Number.isFinite(item.height) || item.height <= 0) {
      throw new Error(`${item.id}: height must be finite and positive`);
    }
  });
}

function metrics(input: PackingInput) {
  const columnWidth = (input.containerWidth - input.gap * (input.columns - 1)) / input.columns;
  const xForColumn = (column: number) => column * (columnWidth + input.gap);
  const widthForSpan = (span: number) => columnWidth * span + input.gap * (span - 1);
  return {columnWidth, xForColumn, widthForSpan};
}

function finish(input: PackingInput, placements: readonly PackingPlacement[], candidateEvaluations: number): PackingResult {
  const containerHeight = placements.reduce((maximum, placement) => Math.max(maximum, placement.y + placement.height), 0);
  return {
    placements,
    geometry: [
      {id: "packing-root", x: 0, y: 0, width: input.containerWidth, height: round(containerHeight)},
      ...placements.map((placement) => ({
        id: placement.id,
        x: round(placement.x),
        y: round(placement.y),
        width: round(placement.width),
        height: round(placement.height),
      })),
    ],
    candidateEvaluations,
    containerHeight: round(containerHeight),
  };
}

function maximumBottom(bottoms: readonly number[], start: number, span: number) {
  let maximum = 0;
  for (let column = start; column < start + span; column += 1) {
    maximum = Math.max(maximum, bottoms[column]!);
  }
  return maximum;
}

export function packShortestColumn(input: PackingInput): PackingResult {
  validateInput(input);
  const {xForColumn, widthForSpan} = metrics(input);
  const bottoms = Array.from({length: input.columns}, () => 0);
  const placements: PackingPlacement[] = [];
  let candidateEvaluations = 0;

  input.items.forEach((item) => {
    let bestColumn = 0;
    let bestY = Number.POSITIVE_INFINITY;

    for (let start = 0; start <= input.columns - item.columnSpan; start += 1) {
      candidateEvaluations += 1;
      const bottom = maximumBottom(bottoms, start, item.columnSpan);
      const y = bottom > 0 ? bottom + input.gap : 0;
      if (y < bestY - EPSILON || (Math.abs(y - bestY) <= EPSILON && start < bestColumn)) {
        bestY = y;
        bestColumn = start;
      }
    }

    const placement: PackingPlacement = {
      id: item.id,
      columnStart: bestColumn,
      columnSpan: item.columnSpan,
      x: xForColumn(bestColumn),
      y: bestY,
      width: widthForSpan(item.columnSpan),
      height: item.height,
    };
    placements.push(placement);
    const nextBottom = bestY + item.height;
    for (let column = bestColumn; column < bestColumn + item.columnSpan; column += 1) {
      bottoms[column] = nextBottom;
    }
  });

  return finish(input, placements, candidateEvaluations);
}

export function packFirstFit(input: PackingInput): PackingResult {
  validateInput(input);
  const {xForColumn, widthForSpan} = metrics(input);
  const placements: PackingPlacement[] = [];
  const placementsByColumn: PackingPlacement[][] = Array.from({length: input.columns}, () => []);
  let candidateEvaluations = 0;

  input.items.forEach((item) => {
    // Native Set/sort is faster for this bounded search frontier than maintaining
    // a sorted JavaScript array incrementally, while preserving top-to-bottom order.
    const candidateYs = Array.from(new Set([
      0,
      ...placements.map((placement) => round(placement.y + placement.height + input.gap)),
    ])).sort((left, right) => left - right);

    let accepted: PackingPlacement | null = null;
    const width = widthForSpan(item.columnSpan);

    for (const y of candidateYs) {
      const candidateBottomWithGap = y + item.height + input.gap;
      for (let start = 0; start <= input.columns - item.columnSpan; start += 1) {
        candidateEvaluations += 1;
        let blocked = false;

        // Packing placements are column-aligned, so horizontal overlap is exactly
        // equivalent to sharing at least one column. Inspect only those placements
        // instead of rescanning every previously accepted item.
        for (let column = start; column < start + item.columnSpan && !blocked; column += 1) {
          for (const placed of placementsByColumn[column]!) {
            const vertical = y < placed.y + placed.height + input.gap - EPSILON
              && candidateBottomWithGap > placed.y + EPSILON;
            if (vertical) {
              blocked = true;
              break;
            }
          }
        }
        if (blocked) continue;

        accepted = {
          id: item.id,
          columnStart: start,
          columnSpan: item.columnSpan,
          x: xForColumn(start),
          y,
          width,
          height: item.height,
        };
        break;
      }
      if (accepted) break;
    }

    if (!accepted) throw new Error(`${item.id}: first-fit search found no placement`);
    placements.push(accepted);
    for (let column = accepted.columnStart; column < accepted.columnStart + accepted.columnSpan; column += 1) {
      placementsByColumn[column]!.push(accepted);
    }
  });

  return finish(input, placements, candidateEvaluations);
}

export function buildPackingFixture(): PackingInput {
  return {
    containerWidth: 320,
    columns: 3,
    gap: 10,
    items: [
      {id: "tall-left", columnSpan: 1, height: 200},
      {id: "short-middle", columnSpan: 1, height: 60},
      {id: "tall-right", columnSpan: 1, height: 220},
      {id: "bridge", columnSpan: 2, height: 60},
      {id: "filler", columnSpan: 1, height: 100},
    ],
  };
}
