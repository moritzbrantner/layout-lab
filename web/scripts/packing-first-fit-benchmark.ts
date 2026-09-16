import {packFirstFit, type PackingInput} from "../lib/packing";

const ITEM_COUNT = 160;
const RUNS = 40;

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
let candidateEvaluations = 0;
const started = performance.now();

for (let run = 0; run < RUNS; run += 1) {
  const result = packFirstFit(input);
  const signature = JSON.stringify(result.placements);
  expectedSignature ??= signature;
  if (signature !== expectedSignature) throw new Error("first-fit packing benchmark became nondeterministic");
  candidateEvaluations = result.candidateEvaluations;
}

const elapsedMs = performance.now() - started;
console.log(JSON.stringify({
  workload: "packing-first-fit-mixed-spans",
  items: input.items.length,
  columns: input.columns,
  runs: RUNS,
  candidateEvaluations,
  elapsedMs: Number(elapsedMs.toFixed(2)),
  layoutsPerSecond: Number((RUNS / (elapsedMs / 1_000)).toFixed(2)),
}, null, 2));
