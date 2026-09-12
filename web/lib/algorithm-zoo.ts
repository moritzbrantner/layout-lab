import {solveConstraintLayout} from "./constraint-layout";
import {buildFlexEngineTree, buildGridEngineTree} from "./layout-engine-fixtures";
import {layoutBlockTree, layoutFlexTree, layoutGridTree, type LayoutBox} from "./layout-engine";
import {buildBlockLayoutTree, type LayoutNode} from "./layout-tree";

export type AlgorithmZooId = "block-flow" | "flex-row" | "grid-row" | "constraint-cassowary";
export type AlgorithmFamily = "flow" | "flex" | "grid" | "constraint";
export type AlgorithmInputKind = "layout-tree" | "constraint-system";

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

export type AlgorithmExperimentInput = LayoutTreeAlgorithmInput | ConstraintSystemAlgorithmInput;

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

export const algorithmDefinitions: readonly AlgorithmDefinition[] = [
  blockDefinition,
  flexDefinition,
  gridDefinition,
  constraintDefinition,
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
