import {layoutForceDirected, type ForceDirectedInput} from "../lib/force-directed";

const NODE_COUNT = 96;
const ITERATIONS = 120;
const RUNS = 8;

function buildInput(): ForceDirectedInput {
  const nodes = Array.from({length: NODE_COUNT}, (_, index) => ({id: `node-${index}`}));
  const edges = [
    ...Array.from({length: NODE_COUNT}, (_, index) => ({
      id: `ring-${index}`,
      from: `node-${index}`,
      to: `node-${(index + 1) % NODE_COUNT}`,
    })),
    ...Array.from({length: NODE_COUNT}, (_, index) => ({
      id: `chord-${index}`,
      from: `node-${index}`,
      to: `node-${(index + 7) % NODE_COUNT}`,
    })),
  ];
  return {
    nodes,
    edges,
    width: 1600,
    height: 1000,
    nodeSize: 20,
    iterations: ITERATIONS,
    initialTemperature: 120,
    seed: 20260916,
    sampleEvery: 30,
  };
}

function signature(result: ReturnType<typeof layoutForceDirected>) {
  let checksum = 0;
  result.finalPositions.forEach((point, index) => {
    checksum += (index + 1) * (point.x * 31 + point.y * 17);
  });
  return [
    result.finalPositions.length,
    result.samples.length,
    result.repulsionPairs,
    result.attractionEvaluations,
    checksum.toFixed(4),
  ].join(":");
}

const input = buildInput();
let expectedSignature: string | undefined;
let repulsionPairs = 0;
let attractionEvaluations = 0;
const started = performance.now();

for (let run = 0; run < RUNS; run += 1) {
  const result = layoutForceDirected(input);
  const current = signature(result);
  expectedSignature ??= current;
  if (current !== expectedSignature) throw new Error("force-directed benchmark became nondeterministic");
  repulsionPairs = result.repulsionPairs;
  attractionEvaluations = result.attractionEvaluations;
}

const elapsedMs = performance.now() - started;
console.log(JSON.stringify({
  workload: "force-directed-medium-graph",
  nodes: input.nodes.length,
  edges: input.edges.length,
  iterations: input.iterations,
  runs: RUNS,
  repulsionPairs,
  attractionEvaluations,
  resultSignature: expectedSignature,
  elapsedMs: Number(elapsedMs.toFixed(2)),
  layoutsPerSecond: Number((RUNS / (elapsedMs / 1_000)).toFixed(2)),
}, null, 2));
