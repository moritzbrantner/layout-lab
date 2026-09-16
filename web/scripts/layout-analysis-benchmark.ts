import {resolveFlexLine, resolveMinMaxFractionTracks} from "../lib/layout-analysis";

const SCALE = 192;
const RUNS = 20;

function flexInput(itemCount: number) {
  const basis = 100;
  const totalGrowth = itemCount * 1000;
  let remainingGrowth = totalGrowth;
  let active = itemCount;
  let previousDelta: number | null = null;
  const maxGrowth: number[] = [];

  for (let index = 0; index < itemCount - 1; index += 1) {
    const delta = remainingGrowth / active;
    const threshold = previousDelta === null ? delta - 100 : (previousDelta + delta) / 2;
    maxGrowth.push(threshold);
    remainingGrowth -= threshold;
    previousDelta = delta;
    active -= 1;
  }

  return {
    innerSize: itemCount * basis + totalGrowth,
    gapSize: 0,
    items: Array.from({length: itemCount}, (_, index) => ({
      label: `item-${index}`,
      basis,
      grow: 1,
      shrink: 1,
      maxSize: index < maxGrowth.length ? basis + maxGrowth[index]! : Number.POSITIVE_INFINITY,
    })),
  };
}

function gridInput(trackCount: number) {
  const available = trackCount * 1000;
  let remaining = available;
  let active = trackCount;
  let previousFraction: number | null = null;
  const minimums: number[] = [];

  for (let index = 0; index < trackCount - 1; index += 1) {
    const fraction = remaining / active;
    const minimum = previousFraction === null ? fraction + 100 : (previousFraction + fraction) / 2;
    minimums.push(minimum);
    remaining -= minimum;
    previousFraction = fraction;
    active -= 1;
  }
  minimums.push(0);

  return {
    innerSize: available,
    gapSize: 0,
    tracks: minimums.map((minSize, index) => ({label: `track-${index}`, minSize, fr: 1})),
  };
}

const flex = flexInput(SCALE);
const grid = gridInput(SCALE);
let expectedSignature: string | undefined;
let flexPasses = 0;
let gridPasses = 0;
const started = performance.now();

for (let run = 0; run < RUNS; run += 1) {
  const flexResult = resolveFlexLine(flex);
  const gridResult = resolveMinMaxFractionTracks(grid);
  const signature = JSON.stringify({
    flexPasses: flexResult.iterations.length,
    flexTargets: flexResult.items.map((item) => item.targetSize),
    gridPasses: gridResult.flexIterations.length,
    gridTargets: gridResult.tracks.map((track) => track.targetSize),
  });
  expectedSignature ??= signature;
  if (signature !== expectedSignature) throw new Error("layout-analysis benchmark became nondeterministic");
  flexPasses = flexResult.iterations.length;
  gridPasses = gridResult.flexIterations.length;
}

const elapsedMs = performance.now() - started;
console.log(JSON.stringify({
  workload: "flex-grid-freeze-ladders",
  scale: SCALE,
  runs: RUNS,
  flexPassesPerRun: flexPasses,
  gridPassesPerRun: gridPasses,
  elapsedMs: Number(elapsedMs.toFixed(2)),
  pairedResolutionsPerSecond: Number((RUNS / (elapsedMs / 1_000)).toFixed(2)),
}, null, 2));
