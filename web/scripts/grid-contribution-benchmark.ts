import {resolveMinMaxFractionTracks, type GridSpanContribution, type GridTrackInput} from "../lib/layout-analysis";

const TRACKS = 128;
const CONTRIBUTIONS = 256;
const RUNS = 80;

const tracks: GridTrackInput[] = Array.from({length: TRACKS}, (_, index) => ({
  label: `track-${index}`,
  minSize: 24 + (index % 7) * 3,
  fr: 1 + (index % 4),
}));

const contributions: GridSpanContribution[] = Array.from({length: CONTRIBUTIONS}, (_, index) => {
  const span = 2 + (index % 7);
  const start = (index * 11) % (TRACKS - span + 1);
  const minSize = span * 52 + (index % 13) * 5;
  return {label: `span-${index}`, start, span, minSize};
});

let expectedSignature: string | undefined;
let spanVisits = 0;
let flexIterations = 0;
const started = performance.now();

for (let run = 0; run < RUNS; run += 1) {
  const result = resolveMinMaxFractionTracks({
    innerSize: TRACKS * 120,
    gapSize: 4,
    tracks,
    contributions,
  });
  const signature = [
    result.tracks.length,
    result.contributionSteps.length,
    result.flexIterations.length,
    result.baseTotal.toFixed(4),
    result.overflow.toFixed(4),
  ].join(":");
  expectedSignature ??= signature;
  if (signature !== expectedSignature) throw new Error("grid-contribution benchmark became nondeterministic");
  spanVisits = result.contributionSteps.reduce((sum, step) => sum + step.span, 0);
  flexIterations = result.flexIterations.length;
}

const elapsedMs = performance.now() - started;
console.log(JSON.stringify({
  workload: "grid-spanning-contributions",
  tracks: TRACKS,
  contributions: CONTRIBUTIONS,
  runs: RUNS,
  spanVisits,
  flexIterations,
  elapsedMs: Number(elapsedMs.toFixed(2)),
  layoutsPerSecond: Number((RUNS / (elapsedMs / 1_000)).toFixed(2)),
}, null, 2));
