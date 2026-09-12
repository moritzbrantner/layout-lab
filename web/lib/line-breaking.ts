export type LineBreakWord = {
  id: string;
  width: number;
  penaltyAfter?: number;
};

export type LineBreakInput = {
  words: readonly LineBreakWord[];
  lineWidth: number;
  lineHeight: number;
  spaceWidth: number;
  spaceStretch: number;
  spaceShrink: number;
};

export type LineBreakGeometry = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LineBreakLine = {
  index: number;
  start: number;
  end: number;
  wordIds: readonly string[];
  naturalWidth: number;
  adjustedSpaceWidth: number;
  adjustmentRatio: number;
  badness: number;
  demerits: number;
};

export type LineBreakResult = {
  lines: readonly LineBreakLine[];
  geometry: readonly LineBreakGeometry[];
  candidateEvaluations: number;
  dynamicStates: number;
  totalDemerits: number;
};

type CandidateLine = Omit<LineBreakLine, "index">;
type DynamicState = {
  demerits: number;
  previousBreak: number;
  previousFitness: number;
  line: CandidateLine;
};

const LINE_PENALTY = 10;
const FITNESS_DEMERITS = 10_000;
const EPSILON = 1e-9;

function round(value: number) {
  const rounded = Math.round(value * 10_000) / 10_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function validateInput(input: LineBreakInput) {
  if (input.words.length === 0) throw new Error("line breaking requires at least one word box");
  if (!Number.isFinite(input.lineWidth) || input.lineWidth <= 0) throw new Error("lineWidth must be finite and positive");
  if (!Number.isFinite(input.lineHeight) || input.lineHeight <= 0) throw new Error("lineHeight must be finite and positive");
  for (const [name, value] of [
    ["spaceWidth", input.spaceWidth],
    ["spaceStretch", input.spaceStretch],
    ["spaceShrink", input.spaceShrink],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be finite and non-negative`);
  }
  input.words.forEach((word) => {
    if (!word.id.trim()) throw new Error("line-break word ids must be non-empty");
    if (!Number.isFinite(word.width) || word.width <= 0) throw new Error(`${word.id}: width must be finite and positive`);
    if (word.width > input.lineWidth) throw new Error(`${word.id}: word box exceeds line width without a discretionary break`);
    if (word.penaltyAfter !== undefined && (!Number.isFinite(word.penaltyAfter) || Math.abs(word.penaltyAfter) >= 10_000)) {
      throw new Error(`${word.id}: penaltyAfter must be finite and between -9999 and 9999`);
    }
  });
  if (new Set(input.words.map((word) => word.id)).size !== input.words.length) {
    throw new Error("line-break word ids must be unique");
  }
}

function naturalWidth(input: LineBreakInput, start: number, end: number) {
  const words = input.words.slice(start, end);
  return words.reduce((sum, word) => sum + word.width, 0) + Math.max(0, words.length - 1) * input.spaceWidth;
}

function penaltyDemerits(penalty: number) {
  return penalty >= 0 ? penalty * penalty : -(penalty * penalty);
}

function fitnessClass(ratio: number) {
  if (ratio < -0.5) return 0;
  if (ratio <= 0.5) return 1;
  if (ratio <= 1) return 2;
  return 3;
}

function evaluateOptimizedLine(input: LineBreakInput, start: number, end: number): CandidateLine | null {
  const count = end - start;
  const finalLine = end === input.words.length;
  const natural = naturalWidth(input, start, end);
  const delta = input.lineWidth - natural;
  let ratio = 0;
  let adjustedSpaceWidth = input.spaceWidth;

  if (delta >= -EPSILON) {
    if (!finalLine && delta > EPSILON) {
      if (count <= 1 || input.spaceStretch <= 0) return null;
      const stretch = (count - 1) * input.spaceStretch;
      ratio = delta / stretch;
      if (ratio > 1 + EPSILON) return null;
      adjustedSpaceWidth = input.spaceWidth + ratio * input.spaceStretch;
    }
  } else {
    if (count <= 1 || input.spaceShrink <= 0) return null;
    const shrink = (count - 1) * input.spaceShrink;
    ratio = delta / shrink;
    if (ratio < -1 - EPSILON) return null;
    adjustedSpaceWidth = input.spaceWidth + ratio * input.spaceShrink;
  }

  const badness = finalLine && delta >= -EPSILON ? 0 : 100 * Math.pow(Math.abs(ratio), 3);
  const penalty = finalLine ? 0 : (input.words[end - 1]?.penaltyAfter ?? 0);
  const demerits = Math.pow(LINE_PENALTY + badness, 2) + penaltyDemerits(penalty);

  return {
    start,
    end,
    wordIds: input.words.slice(start, end).map((word) => word.id),
    naturalWidth: round(natural),
    adjustedSpaceWidth: round(adjustedSpaceWidth),
    adjustmentRatio: round(ratio),
    badness: round(badness),
    demerits: round(demerits),
  };
}

function geometryFromLines(input: LineBreakInput, lines: readonly LineBreakLine[]): LineBreakGeometry[] {
  const geometry: LineBreakGeometry[] = [{
    id: "paragraph",
    x: 0,
    y: 0,
    width: input.lineWidth,
    height: lines.length * input.lineHeight,
  }];

  lines.forEach((line) => {
    let x = 0;
    for (let index = line.start; index < line.end; index += 1) {
      const word = input.words[index]!;
      geometry.push({id: word.id, x: round(x), y: line.index * input.lineHeight, width: word.width, height: input.lineHeight});
      x += word.width;
      if (index < line.end - 1) x += line.adjustedSpaceWidth;
    }
  });

  return geometry;
}

export function breakLinesGreedy(input: LineBreakInput): LineBreakResult {
  validateInput(input);
  const lines: LineBreakLine[] = [];
  let start = 0;
  let candidateEvaluations = 0;

  while (start < input.words.length) {
    let end = start + 1;
    while (end < input.words.length) {
      candidateEvaluations += 1;
      if (naturalWidth(input, start, end + 1) > input.lineWidth + EPSILON) break;
      end += 1;
    }

    const natural = naturalWidth(input, start, end);
    lines.push({
      index: lines.length,
      start,
      end,
      wordIds: input.words.slice(start, end).map((word) => word.id),
      naturalWidth: round(natural),
      adjustedSpaceWidth: input.spaceWidth,
      adjustmentRatio: 0,
      badness: 0,
      demerits: 0,
    });
    start = end;
  }

  return {lines, geometry: geometryFromLines(input, lines), candidateEvaluations, dynamicStates: 0, totalDemerits: 0};
}

export function breakLinesKnuthPlass(input: LineBreakInput): LineBreakResult {
  validateInput(input);
  const count = input.words.length;
  const states: Map<number, DynamicState>[] = Array.from({length: count + 1}, () => new Map());
  states[0]!.set(-1, {
    demerits: 0,
    previousBreak: -1,
    previousFitness: -1,
    line: {start: 0, end: 0, wordIds: [], naturalWidth: 0, adjustedSpaceWidth: input.spaceWidth, adjustmentRatio: 0, badness: 0, demerits: 0},
  });

  let candidateEvaluations = 0;
  let dynamicStates = 1;

  for (let start = 0; start < count; start += 1) {
    const previousStates = states[start]!;
    if (previousStates.size === 0) continue;
    for (const [previousFitness, previousState] of previousStates) {
      for (let end = start + 1; end <= count; end += 1) {
        candidateEvaluations += 1;
        const line = evaluateOptimizedLine(input, start, end);
        if (!line) continue;
        const fitness = fitnessClass(line.adjustmentRatio);
        const fitnessPenalty = previousFitness >= 0 && Math.abs(previousFitness - fitness) > 1 ? FITNESS_DEMERITS : 0;
        const total = previousState.demerits + line.demerits + fitnessPenalty;
        const existing = states[end]!.get(fitness);
        if (!existing || total < existing.demerits - EPSILON) {
          if (!existing) dynamicStates += 1;
          states[end]!.set(fitness, {demerits: total, previousBreak: start, previousFitness, line});
        }
      }
    }
  }

  let bestFitness = -1;
  let bestState: DynamicState | undefined;
  for (const [fitness, state] of states[count]!) {
    if (!bestState || state.demerits < bestState.demerits - EPSILON) {
      bestFitness = fitness;
      bestState = state;
    }
  }
  if (!bestState) throw new Error("no feasible Knuth-Plass line-break sequence for the supplied boxes and glue");

  const reversed: CandidateLine[] = [];
  let cursor = count;
  let fitness = bestFitness;
  while (cursor > 0) {
    const state = states[cursor]!.get(fitness);
    if (!state) throw new Error("broken line-break predecessor chain");
    reversed.push(state.line);
    cursor = state.previousBreak;
    fitness = state.previousFitness;
  }

  const lines = reversed.reverse().map((line, index): LineBreakLine => ({...line, index}));
  return {lines, geometry: geometryFromLines(input, lines), candidateEvaluations, dynamicStates, totalDemerits: round(bestState.demerits)};
}

export function buildLineBreakingFixture(): LineBreakInput {
  return {
    lineWidth: 260,
    lineHeight: 32,
    spaceWidth: 10,
    spaceStretch: 20,
    spaceShrink: 8,
    words: [
      {id: "layout", width: 100},
      {id: "engines", width: 80},
      {id: "balance", width: 70},
      {id: "global", width: 100},
      {id: "spacing", width: 80},
      {id: "choices", width: 70},
    ],
  };
}
