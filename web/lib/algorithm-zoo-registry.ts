import {
  algorithmDefinitions as baseDefinitions,
  type AlgorithmDefinition,
  type AlgorithmExecution,
  type AlgorithmExperimentInput,
  type AlgorithmGeometry,
  type AlgorithmTraceStep,
  type AlgorithmWorkCounter,
  type AlgorithmZooId,
} from "./algorithm-zoo";
import {buildForceDirectedFixture, layoutForceDirected, type ForceDirectedInput} from "./force-directed";
import {buildSugiyamaFixture, layoutSugiyama, type SugiyamaInput} from "./sugiyama";

export type AlgorithmRegistryId = AlgorithmZooId | "dag-sugiyama" | "graph-force";
export type AlgorithmRegistryFamily = AlgorithmDefinition["family"] | "dag" | "graph";
export type AlgorithmRegistryInputKind = AlgorithmDefinition["inputKind"] | "dag" | "graph";

export type DagAlgorithmInput = {
  kind: "dag";
  fixtureId: string;
  dag: SugiyamaInput;
};

export type GraphAlgorithmInput = {
  kind: "graph";
  fixtureId: string;
  graph: ForceDirectedInput;
};

export type AlgorithmRegistryInput = AlgorithmExperimentInput | DagAlgorithmInput | GraphAlgorithmInput;

export type AlgorithmRegistryExecution = {
  algorithmId: AlgorithmRegistryId;
  input: AlgorithmRegistryInput;
  geometry: readonly AlgorithmGeometry[];
  trace: readonly AlgorithmTraceStep[];
  work: readonly AlgorithmWorkCounter[];
  diagnostics: readonly string[];
};

export type AlgorithmRegistryDefinition = {
  id: AlgorithmRegistryId;
  family: AlgorithmRegistryFamily;
  title: string;
  summary: string;
  inputKind: AlgorithmRegistryInputKind;
  createInput: () => AlgorithmRegistryInput;
  run: (input: AlgorithmRegistryInput) => AlgorithmRegistryExecution;
};

function adaptBaseDefinition(definition: AlgorithmDefinition): AlgorithmRegistryDefinition {
  return {
    ...definition,
    createInput: () => definition.createInput(),
    run: (input) => {
      if (input.kind === "dag" || input.kind === "graph") {
        throw new Error(`${definition.id}: expected ${definition.inputKind} input, received ${input.kind}`);
      }
      return definition.run(input);
    },
  };
}

const sugiyamaDefinition: AlgorithmRegistryDefinition = {
  id: "dag-sugiyama",
  family: "dag",
  title: "Layered DAG",
  summary: "Sugiyama-style layered DAG drawing with longest-path ranking, dummy vertices, barycenter crossing reduction, and deterministic coordinate assignment.",
  inputKind: "dag",
  createInput: () => ({kind: "dag", fixtureId: "crossing-dag", dag: buildSugiyamaFixture()}),
  run: (input) => {
    if (input.kind !== "dag") throw new Error(`dag-sugiyama: expected dag input, received ${input.kind}`);
    const result = layoutSugiyama(input.dag);
    const rankGroups = new Map<number, string[]>();
    result.ranks.forEach(({nodeId, rank}) => {
      const nodes = rankGroups.get(rank) ?? [];
      nodes.push(nodeId);
      rankGroups.set(rank, nodes);
    });
    const rankingSummary = [...rankGroups.entries()]
      .sort(([left], [right]) => left - right)
      .map(([rank, nodes]) => `rank ${rank}: ${nodes.join(", ")}`)
      .join(" · ");

    return {
      algorithmId: "dag-sugiyama",
      input,
      geometry: result.geometry,
      trace: [
        {id: "ranking", label: "1. Ranking", summary: rankingSummary},
        {id: "dummy", label: "2. Long-edge normalization", summary: `${result.dummyCount} dummy vertices produce ${result.segmentCount} adjacent-rank segments`},
        ...result.sweeps.map((sweep, index) => ({
          id: `cross-${index + 1}`,
          label: `3. Crossing reduction · ${sweep.direction} ${sweep.iteration}`,
          summary: `${sweep.crossingsBefore} → ${sweep.crossingsAfter} crossings; ${sweep.changedLayers} layers reordered`,
        })),
        {id: "coordinates", label: "4. Coordinate assignment", summary: `${result.drawingWidth}px × ${result.drawingHeight}px centered layered drawing`},
      ],
      work: [
        {key: "nodes", label: "real nodes", value: input.dag.nodes.length},
        {key: "dummies", label: "dummy vertices", value: result.dummyCount},
        {key: "initial-crossings", label: "initial crossings", value: result.initialCrossings},
        {key: "final-crossings", label: "final crossings", value: result.finalCrossings},
        {key: "crossing-comparisons", label: "crossing comparisons", value: result.crossingComparisons},
      ],
      diagnostics: [
        `final layers: ${result.layerOrders.map((layer) => `[${layer.join(", ")}]`).join(" → ")}`,
        "input is required to be acyclic; cycle removal is intentionally outside this DAG-only slice",
      ],
    };
  },
};

const forceDefinition: AlgorithmRegistryDefinition = {
  id: "graph-force",
  family: "graph",
  title: "Seeded force-directed graph",
  summary: "Fruchterman–Reingold-style graph layout with seeded initialization, pairwise repulsion, edge attraction, bounded displacement, deterministic cooling, and sampled convergence evidence.",
  inputKind: "graph",
  createInput: () => ({kind: "graph", fixtureId: "two-cluster-bridge", graph: buildForceDirectedFixture()}),
  run: (input) => {
    if (input.kind !== "graph") throw new Error(`graph-force: expected graph input, received ${input.kind}`);
    const result = layoutForceDirected(input.graph);
    return {
      algorithmId: "graph-force",
      input,
      geometry: result.geometry,
      trace: result.samples.map((sample) => ({
        id: `iteration-${sample.iteration}`,
        label: `iteration ${sample.iteration}`,
        summary: `temperature ${sample.temperature}; max move ${sample.maxDisplacement}px; total move ${sample.totalDisplacement}px; mean edge ${sample.meanEdgeLength}px`,
      })),
      work: [
        {key: "nodes", label: "graph nodes", value: input.graph.nodes.length},
        {key: "edges", label: "graph edges", value: input.graph.edges.length},
        {key: "iterations", label: "fixed iterations", value: result.iterations},
        {key: "repulsions", label: "pairwise repulsion evaluations", value: result.repulsionPairs},
        {key: "attractions", label: "edge attraction evaluations", value: result.attractionEvaluations},
      ],
      diagnostics: [
        `seed: ${input.graph.seed}`,
        `characteristic length: ${result.characteristicLength}px`,
        "convergence evidence is sampled from a fixed replayable iteration budget; no wall-clock stopping criterion is used",
      ],
    };
  },
};

export const algorithmRegistryDefinitions: readonly AlgorithmRegistryDefinition[] = [
  ...baseDefinitions.map(adaptBaseDefinition),
  sugiyamaDefinition,
  forceDefinition,
] as const;

export function getAlgorithmRegistryDefinition(id: AlgorithmRegistryId): AlgorithmRegistryDefinition {
  const definition = algorithmRegistryDefinitions.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`unknown layout algorithm: ${id}`);
  return definition;
}

export function runRegistryAlgorithm(id: AlgorithmRegistryId): AlgorithmRegistryExecution {
  const definition = getAlgorithmRegistryDefinition(id);
  return definition.run(definition.createInput());
}

export function validateRegistryExecution(execution: AlgorithmRegistryExecution): string[] {
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
