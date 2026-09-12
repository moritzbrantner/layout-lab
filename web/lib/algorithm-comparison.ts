import {
  getAlgorithmRegistryDefinition,
  runRegistryAlgorithm,
  type AlgorithmRegistryExecution,
  type AlgorithmRegistryId,
} from "./algorithm-zoo-registry";

export type AlgorithmComparisonId = "line-breaking" | "packing";

type GeometryField = "x" | "y" | "width" | "height";

export type AlgorithmComparisonDefinition = {
  id: AlgorithmComparisonId;
  title: string;
  summary: string;
  algorithmIds: readonly [AlgorithmRegistryId, AlgorithmRegistryId];
  primaryMeasure: {
    label: string;
    geometryId: string;
    field: GeometryField;
    unit: "px";
  };
};

export type AlgorithmComparisonGeometryRow = {
  id: string;
  values: readonly ({x: number; y: number; width: number; height: number} | null)[];
};

export type AlgorithmComparisonResult = {
  definition: AlgorithmComparisonDefinition;
  executions: readonly [AlgorithmRegistryExecution, AlgorithmRegistryExecution];
  fixtureId: string;
  inputKind: string;
  exactInputMatch: boolean;
  primaryValues: readonly [number, number];
  geometryRows: readonly AlgorithmComparisonGeometryRow[];
};

export const algorithmComparisonDefinitions: readonly AlgorithmComparisonDefinition[] = [
  {
    id: "line-breaking",
    title: "Line breaking",
    summary: "Greedy wrapping and global Knuth–Plass optimization consume the same pre-measured word boxes and glue limits.",
    algorithmIds: ["line-greedy", "line-knuth-plass"],
    primaryMeasure: {
      label: "paragraph height",
      geometryId: "paragraph",
      field: "height",
      unit: "px",
    },
  },
  {
    id: "packing",
    title: "Packing",
    summary: "Shortest-column masonry and deterministic first-fit consume the same ordered column-aligned rectangle fixture.",
    algorithmIds: ["packing-shortest-column", "packing-first-fit"],
    primaryMeasure: {
      label: "packed height",
      geometryId: "packing-root",
      field: "height",
      unit: "px",
    },
  },
] as const;

export function getAlgorithmComparisonDefinition(id: AlgorithmComparisonId) {
  const definition = algorithmComparisonDefinitions.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`unknown algorithm comparison: ${id}`);
  return definition;
}

function stableInputSignature(execution: AlgorithmRegistryExecution) {
  return JSON.stringify(execution.input);
}

function primaryValue(execution: AlgorithmRegistryExecution, definition: AlgorithmComparisonDefinition) {
  const geometry = execution.geometry.find((box) => box.id === definition.primaryMeasure.geometryId);
  if (!geometry) {
    throw new Error(`${execution.algorithmId}: missing comparison geometry ${definition.primaryMeasure.geometryId}`);
  }
  return geometry[definition.primaryMeasure.field];
}

function geometryRows(executions: readonly AlgorithmRegistryExecution[]): AlgorithmComparisonGeometryRow[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  executions.forEach((execution) => {
    execution.geometry.forEach((geometry) => {
      if (seen.has(geometry.id)) return;
      seen.add(geometry.id);
      ids.push(geometry.id);
    });
  });

  return ids.map((id) => ({
    id,
    values: executions.map((execution) => {
      const geometry = execution.geometry.find((box) => box.id === id);
      return geometry
        ? {x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height}
        : null;
    }),
  }));
}

export function runAlgorithmComparison(id: AlgorithmComparisonId): AlgorithmComparisonResult {
  const definition = getAlgorithmComparisonDefinition(id);
  const first = runRegistryAlgorithm(definition.algorithmIds[0]);
  const second = runRegistryAlgorithm(definition.algorithmIds[1]);
  const executions = [first, second] as const;
  const exactInputMatch = stableInputSignature(first) === stableInputSignature(second);

  if (!exactInputMatch) {
    throw new Error(`${id}: comparison algorithms no longer consume identical fixture input`);
  }
  if (first.input.fixtureId !== second.input.fixtureId || first.input.kind !== second.input.kind) {
    throw new Error(`${id}: fixture identity drifted despite matching serialized input`);
  }

  return {
    definition,
    executions,
    fixtureId: first.input.fixtureId,
    inputKind: first.input.kind,
    exactInputMatch,
    primaryValues: [primaryValue(first, definition), primaryValue(second, definition)],
    geometryRows: geometryRows(executions),
  };
}

export function algorithmComparisonTitles(id: AlgorithmComparisonId): readonly [string, string] {
  const comparison = runAlgorithmComparison(id);
  return [
    getAlgorithmRegistryDefinition(comparison.executions[0].algorithmId).title,
    getAlgorithmRegistryDefinition(comparison.executions[1].algorithmId).title,
  ];
}
