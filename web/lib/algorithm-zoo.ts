import {solveConstraintLayout} from "./constraint-layout";
import {buildFlexEngineTree, buildGridEngineTree} from "./layout-engine-fixtures";
import {layoutBlockTree, layoutFlexTree, layoutGridTree, type LayoutBox} from "./layout-engine";
import {buildBlockLayoutTree, type LayoutNode} from "./layout-tree";
import {breakLinesGreedy, breakLinesKnuthPlass, buildLineBreakingFixture, type LineBreakInput} from "./line-breaking";
import {buildPackingFixture, packFirstFit, packShortestColumn, type PackingInput} from "./packing";
import {buildTidyTreeFixture, layoutTidyTree, type TidyTreeInput} from "./tidy-tree";

export type AlgorithmZooId =
  | "block-flow"
  | "flex-row"
  | "grid-row"
  | "constraint-cassowary"
  | "line-greedy"
  | "line-knuth-plass"
  | "packing-shortest-column"
  | "packing-first-fit"
  | "tree-tidy";
export type AlgorithmFamily = "flow" | "flex" | "grid" | "constraint" | "line-breaking" | "packing" | "tree";
export type AlgorithmInputKind = "layout-tree" | "constraint-system" | "line-break" | "packing" | "tree";

export type LayoutTreeAlgorithmInput = {
  kind: "layout-tree";
  fixtureId: string;
  tree: LayoutNode;
};

export type ConstraintSystemAlgorithmInput = {
  kind: "constraint-system";
  fixtureId: string;
  containerWidth: number;
  gap: number;
};

export type LineBreakAlgorithmInput = {
  kind: "line-break";
  fixtureId: string;
  paragraph: LineBreakInput;
};

export type PackingAlgorithmInput = {
  kind: "packing";
  fixtureId: string;
  packing: PackingInput;
};

export type TreeAlgorithmInput = {
  kind: "tree";
  fixtureId: string;
  tree: TidyTreeInput;
};

export type AlgorithmExperimentInput =
  | LayoutTreeAlgorithmInput
  | ConstraintSystemAlgorithmInput
  | LineBreakAlgorithmInput
  | PackingAlgorithmInput
  | TreeAlgorithmInput;

export type AlgorithmGeometry = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AlgorithmTraceStep = {
  id: string;
  label: string;
  summary: string;
};

export type AlgorithmWorkCounter = {
  key: string;
  label: string;
  value: number;
  unit?: string;
};

export type AlgorithmExecution = {
  algorithmId: AlgorithmZooId;
  input: AlgorithmExperimentInput;
  geometry: readonly AlgorithmGeometry[];
  trace: readonly AlgorithmTraceStep[];
  work: readonly AlgorithmWorkCounter[];
  diagnostics: readonly string[];
};

export type AlgorithmDefinition = {
  id: AlgorithmZooId;
  family: AlgorithmFamily;
  title: string;
  summary: string;
  inputKind: AlgorithmInputKind;
  createInput: () => AlgorithmExperimentInput;
  run: (input: AlgorithmExperimentInput) => AlgorithmExecution;
};

function geometryFromBoxes(boxes: readonly LayoutBox[]): AlgorithmGeometry[] {
  return boxes.map((box) => ({id: box.id, ...box.rect}));
}

function requireLayoutTreeInput(input: AlgorithmExperimentInput): LayoutTreeAlgorithmInput {
  if (input.kind !== "layout-tree") throw new Error(`expected layout-tree input, received ${input.kind}`);
  return input;
}

function requireConstraintSystemInput(input: AlgorithmExperimentInput): ConstraintSystemAlgorithmInput {
  if (input.kind !== "constraint-system") throw new Error(`expected constraint-system input, received ${input.kind}`);
  return input;
}

function requireLineBreakInput(input: AlgorithmExperimentInput): LineBreakAlgorithmInput {
  if (input.kind !== "line-break") throw new Error(`expected line-break input, received ${input.kind}`);
  return input;
}

function requirePackingInput(input: AlgorithmExperimentInput): PackingAlgorithmInput {
  if (input.kind !== "packing") throw new Error(`expected packing input, received ${input.kind}`);
  return input;
}

function requireTreeInput(input: AlgorithmExperimentInput): TreeAlgorithmInput {
  if (input.kind !== "tree") throw new Error(`expected tree input, received ${input.kind}`);
  return input;
}

const blockDefinition: AlgorithmDefinition = {
  id: "block-flow",
  family: "flow",
  title: "Block flow",
  summary: "Vertical block flow with width clamping, derived heights, and positive adjacent-margin collapse.",
  inputKind: "layout-tree",
  createInput: () => ({kind: "layout-tree", fixtureId: "block-baseline", tree: buildBlockLayoutTree()}),
  run: (input) => {
    const typedInput = requireLayoutTreeInput(input);
    const result = layoutBlockTree(typedInput.tree);
    return {
      algorithmId: "block-flow",
      input: typedInput,
      geometry: geometryFromBoxes(result.boxes),
      trace: result.marginCollapses.map((collapse, index) => ({
        id: `collapse-${index + 1}`,
        label: `${collapse.beforeId} → ${collapse.afterId}`,
        summary: `${collapse.beforeMargin}px vs ${collapse.afterMargin}px resolves to ${collapse.resolvedGap}px`,
      })),
      work: [
        {key: "visited", label: "visited nodes", value: result.visitedNodes},
        {key: "collapses", label: "margin collapses", value: result.marginCollapses.length},
      ],
      diagnostics: [],
    };
  },
};

const flexDefinition: AlgorithmDefinition = {
  id: "flex-row",
  family: "flex",
  title: "Flex row",
  summary: "Single-line row Flexbox using weighted free-space distribution, min/max clamping, and repeated freezing.",
  inputKind: "layout-tree",
  createInput: () => ({kind: "layout-tree", fixtureId: "flex-engine", tree: buildFlexEngineTree()}),
  run: (input) => {
    const typedInput = requireLayoutTreeInput(input);
    const result = layoutFlexTree(typedInput.tree);
    return {
      algorithmId: "flex-row",
      input: typedInput,
      geometry: geometryFromBoxes(result.boxes),
      trace: result.resolution.iterations.map((iteration) => ({
        id: `pass-${iteration.iteration}`,
        label: `pass ${iteration.iteration}`,
        summary: `${iteration.freeSpace}px free${iteration.newlyFrozen.length > 0 ? `; freeze ${iteration.newlyFrozen.join(", ")}` : "; accept remaining targets"}`,
      })),
      work: [
        {key: "visited", label: "visited nodes", value: result.visitedNodes},
        {key: "passes", label: "resolution passes", value: result.resolution.iterations.length},
        {key: "frozen", label: "frozen items", value: result.resolution.frozenCount},
      ],
      diagnostics: [],
    };
  },
};

const gridDefinition: AlgorithmDefinition = {
  id: "grid-row",
  family: "grid",
  title: "Grid row",
  summary: "Explicit single-row Grid using spanning minimum contributions, track base growth, flexible fractions, and freezing.",
  inputKind: "layout-tree",
  createInput: () => ({kind: "layout-tree", fixtureId: "grid-engine", tree: buildGridEngineTree()}),
  run: (input) => {
    const typedInput = requireLayoutTreeInput(input);
    const result = layoutGridTree(typedInput.tree);
    const contributionTrace = result.resolution.contributionSteps.map((step, index) => ({
      id: `contribution-${index + 1}`,
      label: step.label,
      summary: `${step.deficit}px deficit distributed across ${step.span} tracks`,
    }));
    const trackTrace = result.resolution.tracks.map((track) => ({
      id: `track-${track.label}`,
      label: `track ${track.label}`,
      summary: `${track.targetSize}px${track.frozen ? "; frozen at minimum" : "; flexible target accepted"}`,
    }));

    return {
      algorithmId: "grid-row",
      input: typedInput,
      geometry: geometryFromBoxes(result.boxes),
      trace: [...contributionTrace, ...trackTrace],
      work: [
        {key: "visited", label: "visited nodes", value: result.visitedNodes},
        {key: "contributions", label: "spanning contributions", value: result.resolution.contributionSteps.length},
        {key: "frozen", label: "frozen tracks", value: result.resolution.tracks.filter((track) => track.frozen).length},
      ],
      diagnostics: [],
    };
  },
};

const constraintDefinition: AlgorithmDefinition = {
  id: "constraint-cassowary",
  family: "constraint",
  title: "Incremental constraints",
  summary: "Cassowary-style incremental linear equalities and inequalities with required constraints, strength-ranked preferences, and add/remove re-optimization.",
  inputKind: "constraint-system",
  createInput: () => ({kind: "constraint-system", fixtureId: "constraint-panels", containerWidth: 640, gap: 16}),
  run: (input) => {
    const typedInput = requireConstraintSystemInput(input);
    const result = solveConstraintLayout(typedInput.containerWidth, typedInput.gap);
    return {
      algorithmId: "constraint-cassowary",
      input: typedInput,
      geometry: result.geometry,
      trace: result.snapshots.map((snapshot, index) => ({
        id: `operation-${index + 1}`,
        label: `${snapshot.kind} ${snapshot.operation}`,
        summary: `${snapshot.pivots} pivot${snapshot.pivots === 1 ? "" : "s"}; A ${snapshot.panelAWidth}px; B x ${snapshot.panelBLeft}px / ${snapshot.panelBWidth}px`,
      })),
      work: [
        {key: "pivots", label: "simplex pivots", value: result.pivots},
        {key: "operations", label: "incremental operations", value: result.operations.length},
        {key: "constraints", label: "active constraints", value: result.constraints},
        {key: "rows", label: "final tableau rows", value: result.rows},
      ],
      diagnostics: result.diagnostics,
    };
  },
};

function lineBreakInput(): LineBreakAlgorithmInput {
  return {kind: "line-break", fixtureId: "premeasured-paragraph", paragraph: buildLineBreakingFixture()};
}

const greedyLineDefinition: AlgorithmDefinition = {
  id: "line-greedy",
  family: "line-breaking",
  title: "Greedy line breaking",
  summary: "Commits to the widest natural-width word prefix that fits each line, without revisiting earlier breaks.",
  inputKind: "line-break",
  createInput: lineBreakInput,
  run: (input) => {
    const typedInput = requireLineBreakInput(input);
    const result = breakLinesGreedy(typedInput.paragraph);
    return {
      algorithmId: "line-greedy",
      input: typedInput,
      geometry: result.geometry,
      trace: result.lines.map((line) => ({
        id: `line-${line.index + 1}`,
        label: `line ${line.index + 1}: ${line.wordIds.join(" ")}`,
        summary: `natural ${line.naturalWidth}px; ${typedInput.paragraph.lineWidth - line.naturalWidth}px unused`,
      })),
      work: [
        {key: "candidates", label: "candidate fits", value: result.candidateEvaluations},
        {key: "lines", label: "output lines", value: result.lines.length},
      ],
      diagnostics: ["word widths are pre-measured; glyph shaping and hyphenation remain outside this model"],
    };
  },
};

const knuthPlassDefinition: AlgorithmDefinition = {
  id: "line-knuth-plass",
  family: "line-breaking",
  title: "Knuth–Plass line breaking",
  summary: "Globally chooses breakpoints using dynamic-programming demerits over pre-measured word boxes and stretchable/shrinkable glue.",
  inputKind: "line-break",
  createInput: lineBreakInput,
  run: (input) => {
    const typedInput = requireLineBreakInput(input);
    const result = breakLinesKnuthPlass(typedInput.paragraph);
    return {
      algorithmId: "line-knuth-plass",
      input: typedInput,
      geometry: result.geometry,
      trace: result.lines.map((line) => ({
        id: `line-${line.index + 1}`,
        label: `line ${line.index + 1}: ${line.wordIds.join(" ")}`,
        summary: `natural ${line.naturalWidth}px; glue ${line.adjustedSpaceWidth}px; ratio ${line.adjustmentRatio}; badness ${line.badness}; demerits ${line.demerits}`,
      })),
      work: [
        {key: "candidates", label: "candidate lines", value: result.candidateEvaluations},
        {key: "states", label: "dynamic states", value: result.dynamicStates},
        {key: "lines", label: "output lines", value: result.lines.length},
      ],
      diagnostics: [
        `paragraph demerits: ${result.totalDemerits}`,
        "word widths are pre-measured; glyph shaping and hyphenation remain outside this model",
      ],
    };
  },
};

function packingInput(): PackingAlgorithmInput {
  return {kind: "packing", fixtureId: "skyline-hole", packing: buildPackingFixture()};
}

function packingTrace(result: ReturnType<typeof packShortestColumn>) {
  return result.placements.map((placement, index) => ({
    id: `place-${index + 1}`,
    label: `place ${placement.id}`,
    summary: `column ${placement.columnStart + 1}${placement.columnSpan > 1 ? ` span ${placement.columnSpan}` : ""}; x ${placement.x}px; y ${placement.y}px; height ${placement.height}px`,
  }));
}

const shortestColumnDefinition: AlgorithmDefinition = {
  id: "packing-shortest-column",
  family: "packing",
  title: "Shortest-column masonry",
  summary: "Places each item on the contiguous column window with the lowest current skyline, without searching holes below that skyline.",
  inputKind: "packing",
  createInput: packingInput,
  run: (input) => {
    const typedInput = requirePackingInput(input);
    const result = packShortestColumn(typedInput.packing);
    return {
      algorithmId: "packing-shortest-column",
      input: typedInput,
      geometry: result.geometry,
      trace: packingTrace(result),
      work: [
        {key: "candidates", label: "column-window candidates", value: result.candidateEvaluations},
        {key: "placements", label: "placed items", value: result.placements.length},
      ],
      diagnostics: [`packed height: ${result.containerHeight}px`],
    };
  },
};

const firstFitDefinition: AlgorithmDefinition = {
  id: "packing-first-fit",
  family: "packing",
  title: "First-fit packing",
  summary: "Scans deterministic top-left candidate positions and takes the first non-overlapping placement, allowing it to fill holes below the skyline.",
  inputKind: "packing",
  createInput: packingInput,
  run: (input) => {
    const typedInput = requirePackingInput(input);
    const result = packFirstFit(typedInput.packing);
    return {
      algorithmId: "packing-first-fit",
      input: typedInput,
      geometry: result.geometry,
      trace: packingTrace(result),
      work: [
        {key: "candidates", label: "candidate positions", value: result.candidateEvaluations},
        {key: "placements", label: "placed items", value: result.placements.length},
      ],
      diagnostics: [`packed height: ${result.containerHeight}px`],
    };
  },
};

const tidyTreeDefinition: AlgorithmDefinition = {
  id: "tree-tidy",
  family: "tree",
  title: "Tidy tree",
  summary: "Reingold–Tilford-style ordered binary-tree layout that composes subtrees independently, separates contours rigidly, and centers each parent over its children.",
  inputKind: "tree",
  createInput: () => ({kind: "tree", fixtureId: "tidy-binary-tree", tree: buildTidyTreeFixture()}),
  run: (input) => {
    const typedInput = requireTreeInput(input);
    const result = layoutTidyTree(typedInput.tree);
    return {
      algorithmId: "tree-tidy",
      input: typedInput,
      geometry: result.geometry,
      trace: result.shifts.map((shift, index) => ({
        id: `shift-${index + 1}`,
        label: `${shift.nodeId}: separate ${shift.leftChildId} / ${shift.rightChildId}`,
        summary: `compare ${shift.comparedDepths} contour level${shift.comparedDepths === 1 ? "" : "s"}; child-root separation ${shift.separation}px`,
      })),
      work: [
        {key: "nodes", label: "tree nodes", value: result.placements.length},
        {key: "contours", label: "contour comparisons", value: result.contourComparisons},
        {key: "shifts", label: "rigid subtree shifts", value: result.shifts.length},
      ],
      diagnostics: [
        `drawing: ${result.drawingWidth}px × ${result.drawingHeight}px`,
        "current tidy-tree subset supports ordered binary nodes; subtrees are laid out independently before rigid contour separation",
      ],
    };
  },
};

export const algorithmDefinitions: readonly AlgorithmDefinition[] = [
  blockDefinition,
  flexDefinition,
  gridDefinition,
  constraintDefinition,
  greedyLineDefinition,
  knuthPlassDefinition,
  shortestColumnDefinition,
  firstFitDefinition,
  tidyTreeDefinition,
] as const;

export function getAlgorithmDefinition(id: AlgorithmZooId): AlgorithmDefinition {
  const definition = algorithmDefinitions.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`unknown layout algorithm: ${id}`);
  return definition;
}

export function runAlgorithm(id: AlgorithmZooId): AlgorithmExecution {
  const definition = getAlgorithmDefinition(id);
  return definition.run(definition.createInput());
}

export function validateAlgorithmExecution(execution: AlgorithmExecution): string[] {
  const errors: string[] = [];
  const geometryIds = new Set<string>();
  execution.geometry.forEach((geometry) => {
    if (!geometry.id) errors.push("geometry entries require an id");
    if (geometryIds.has(geometry.id)) errors.push(`duplicate geometry id: ${geometry.id}`);
    geometryIds.add(geometry.id);
    for (const [field, value] of Object.entries(geometry)) {
      if (field === "id") continue;
      if (!Number.isFinite(value)) errors.push(`${geometry.id}: ${field} must be finite`);
    }
    if (geometry.width < 0 || geometry.height < 0) errors.push(`${geometry.id}: geometry dimensions must be non-negative`);
  });

  const traceIds = new Set<string>();
  execution.trace.forEach((step) => {
    if (traceIds.has(step.id)) errors.push(`duplicate trace id: ${step.id}`);
    traceIds.add(step.id);
  });

  const workKeys = new Set<string>();
  execution.work.forEach((counter) => {
    if (workKeys.has(counter.key)) errors.push(`duplicate work counter: ${counter.key}`);
    workKeys.add(counter.key);
    if (!Number.isFinite(counter.value) || counter.value < 0) errors.push(`${counter.key}: work counter must be finite and non-negative`);
  });

  return errors;
}
