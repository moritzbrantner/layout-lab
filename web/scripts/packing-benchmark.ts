import {packFirstFit, packShortestColumn, type PackingInput} from "../lib/packing";

const ITEM_COUNT = 160;
const RUNS = 20;

function buildInput(): PackingInput {
  return {
    containerWidth: 960,
    columns: 8,
    gap: 8,
    items: Array.from({length: ITEM_COUNT}, (_, index) => ({
      id: `item-${index}`,
      columnSpan: 1 + (index % 3),
      height: 36 + ((index * 37) % 120),
    })),
  };
}

const input = buildInput();
let expectedSignature: string | undefined;
let shortestCandidateEvaluations = 0;
let firstFitCandidateEvaluations = 0;
const started = performance.now();

for (let run = 0; run < RUNS; run += 1) {
  const shortest = packShortestColumn(input);
  const firstFit = packFirstFit(input);
  const signature = JSON.stringify({
    shortest: shortest.placements,
    firstFit: firstFit.placements,
  });
  expectedSignature ??= signature;
  if (signature !== expectedSignature) throw new Error("packing benchmark became nondeterministic");
  shortestCandidateEvaluations = shortest.candidateEvaluations;
  firstFitCandidateEvaluations = firstFit.candidateEvaluations;
}

const elapsedMs = performance.now() - started;
console.log(JSON.stringify({
  workload: "packing-mixed-spans",
  items: input.items.length,
  columns: input.columns,
  runs: RUNS,
  shortestCandidateEvaluations,
  firstFitCandidateEvaluations,
  elapsedMs: Number(elapsedMs.toFixed(2)),
  pairedLayoutsPerSecond: Number((RUNS / (elapsedMs / 1_000)).toFixed(2)),
}, null, 2));
