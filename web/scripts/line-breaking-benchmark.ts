import {breakLinesKnuthPlass, type LineBreakInput} from "../lib/line-breaking";

const WORD_COUNT = 168;
const RUNS = 20;

function buildInput(): LineBreakInput {
  return {
    lineWidth: 400,
    lineHeight: 28,
    spaceWidth: 8,
    spaceStretch: 20,
    spaceShrink: 8,
    words: Array.from({length: WORD_COUNT}, (_, index) => ({
      id: `word-${index}`,
      width: 56,
      penaltyAfter: index % 17 === 16 ? -20 : (index % 11 === 10 ? 15 : 0),
    })),
  };
}

const input = buildInput();
let expectedSignature: string | undefined;
let candidateEvaluations = 0;
let dynamicStates = 0;
const started = performance.now();

for (let run = 0; run < RUNS; run += 1) {
  const result = breakLinesKnuthPlass(input);
  const signature = JSON.stringify({
    lines: result.lines.map((line) => [line.start, line.end, line.adjustmentRatio, line.demerits]),
    totalDemerits: result.totalDemerits,
    candidateEvaluations: result.candidateEvaluations,
    dynamicStates: result.dynamicStates,
  });
  expectedSignature ??= signature;
  if (signature !== expectedSignature) throw new Error("line-breaking benchmark became nondeterministic");
  candidateEvaluations = result.candidateEvaluations;
  dynamicStates = result.dynamicStates;
}

const elapsedMs = performance.now() - started;
console.log(JSON.stringify({
  workload: "knuth-plass-box-glue",
  words: input.words.length,
  runs: RUNS,
  candidateEvaluationsPerRun: candidateEvaluations,
  dynamicStatesPerRun: dynamicStates,
  elapsedMs: Number(elapsedMs.toFixed(2)),
  layoutsPerSecond: Number((RUNS / (elapsedMs / 1_000)).toFixed(2)),
}, null, 2));
