import {layoutSugiyama, type SugiyamaInput} from "../lib/sugiyama";

const LAYERS = 16;
const NODES_PER_LAYER = 20;
const RUNS = 25;

function buildInput(): SugiyamaInput {
  const nodes = Array.from({length: LAYERS * NODES_PER_LAYER}, (_, index) => ({
    id: `n-${Math.floor(index / NODES_PER_LAYER)}-${index % NODES_PER_LAYER}`,
  }));
  const edges: {id: string; from: string; to: string}[] = [];

  for (let layer = 0; layer < LAYERS - 1; layer += 1) {
    for (let index = 0; index < NODES_PER_LAYER; index += 1) {
      const from = `n-${layer}-${index}`;
      const direct = `n-${layer + 1}-${index}`;
      const diagonal = `n-${layer + 1}-${(index + 7) % NODES_PER_LAYER}`;
      edges.push({id: `e-${layer}-${index}-direct`, from, to: direct});
      edges.push({id: `e-${layer}-${index}-diagonal`, from, to: diagonal});
    }
  }

  return {
    nodes,
    edges,
    nodeWidth: 40,
    nodeHeight: 24,
    nodeGap: 16,
    rankGap: 32,
    sweeps: 6,
  };
}

const input = buildInput();
let expectedSignature: string | undefined;
let crossingComparisons = 0;
const started = performance.now();

for (let run = 0; run < RUNS; run += 1) {
  const result = layoutSugiyama(input);
  const signature = JSON.stringify({
    ranks: result.ranks,
    layers: result.layerOrders,
    crossings: [result.initialCrossings, result.finalCrossings],
    comparisons: result.crossingComparisons,
  });
  expectedSignature ??= signature;
  if (signature !== expectedSignature) throw new Error("Sugiyama benchmark became nondeterministic");
  crossingComparisons = result.crossingComparisons;
}

const elapsedMs = performance.now() - started;
console.log(JSON.stringify({
  workload: "sugiyama-layered-dag",
  nodes: input.nodes.length,
  edges: input.edges.length,
  sweeps: input.sweeps,
  runs: RUNS,
  crossingComparisonsPerRun: crossingComparisons,
  elapsedMs: Number(elapsedMs.toFixed(2)),
  layoutsPerSecond: Number((RUNS / (elapsedMs / 1_000)).toFixed(2)),
}, null, 2));
