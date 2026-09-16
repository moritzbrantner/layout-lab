import {mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {performance} from "node:perf_hooks";
import {spawnSync} from "node:child_process";

const baselineDir = resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: node scripts/compare-benchmarks.mjs <baseline-web-dir>");

const RUNS = Number.parseInt(process.env.BENCHMARK_RUNS ?? "7", 10);
if (!Number.isInteger(RUNS) || RUNS < 3) throw new Error("BENCHMARK_RUNS must be an integer >= 3");

const benchmarks = [
  "cassowary-benchmark.ts",
  "incremental-layout-benchmark.ts",
  "sugiyama-benchmark.ts",
  "packing-benchmark.ts",
  "packing-shortest-benchmark.ts",
  "packing-first-fit-benchmark.ts",
  "line-breaking-benchmark.ts",
  "layout-analysis-benchmark.ts",
  "layout-engine-benchmark.ts",
  "tidy-tree-benchmark.ts",
  "tidy-tree-deep-benchmark.ts",
  "grid-contribution-benchmark.ts",
  "block-layout-benchmark.ts",
  "force-directed-benchmark.ts",
];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function parseJsonOutput(stdout) {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error(`benchmark did not emit JSON:\n${stdout}`);
  return JSON.parse(stdout.slice(start, end + 1));
}

const scratch = mkdtempSync(join(tmpdir(), "layout-lab-bench-"));
let runNumber = 0;

function execute(cwd, script) {
  const resourceFile = join(scratch, `resource-${runNumber++}.txt`);
  const started = performance.now();
  const result = spawnSync(
    "/usr/bin/time",
    ["-f", "%U\t%S\t%M", "-o", resourceFile, "bun", "run", `scripts/${script}`],
    {
      cwd,
      encoding: "utf8",
      env: {...process.env, NO_COLOR: "1"},
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  const wallMs = performance.now() - started;
  if (result.status !== 0) {
    throw new Error(`${script} failed in ${cwd}:\n${result.stdout}\n${result.stderr}`);
  }
  const [userSeconds, systemSeconds, maxRssKb] = readFileSync(resourceFile, "utf8")
    .trim()
    .split("\t")
    .map(Number);
  return {
    wallMs,
    userSeconds,
    systemSeconds,
    maxRssKb,
    sample: parseJsonOutput(result.stdout),
  };
}

function aggregate(runs) {
  const workloadTimes = runs
    .map((run) => run.sample.elapsedMs)
    .filter((value) => typeof value === "number" && Number.isFinite(value));
  return {
    wallMsMedian: median(runs.map((run) => run.wallMs)),
    userSecondsMedian: median(runs.map((run) => run.userSeconds)),
    systemSecondsMedian: median(runs.map((run) => run.systemSeconds)),
    maxRssKbMedian: median(runs.map((run) => run.maxRssKb)),
    workloadElapsedMsMedian: workloadTimes.length === runs.length ? median(workloadTimes) : null,
  };
}

function percentageDelta(baseline, optimized) {
  return baseline === 0 ? null : ((optimized - baseline) / baseline) * 100;
}

const currentDir = process.cwd();
const results = [];

try {
  for (const benchmark of benchmarks) {
    execute(baselineDir, benchmark);
    execute(currentDir, benchmark);

    const baselineRuns = [];
    const optimizedRuns = [];
    for (let iteration = 0; iteration < RUNS; iteration += 1) {
      const order = iteration % 2 === 0
        ? [[baselineDir, baselineRuns], [currentDir, optimizedRuns]]
        : [[currentDir, optimizedRuns], [baselineDir, baselineRuns]];
      for (const [cwd, target] of order) target.push(execute(cwd, benchmark));
    }

    const baseline = aggregate(baselineRuns);
    const optimized = aggregate(optimizedRuns);
    results.push({
      benchmark,
      runs: RUNS,
      baseline,
      optimized,
      comparison: {
        wallSpeedup: optimized.wallMsMedian === 0 ? null : baseline.wallMsMedian / optimized.wallMsMedian,
        wallDeltaPercent: percentageDelta(baseline.wallMsMedian, optimized.wallMsMedian),
        userCpuDeltaPercent: percentageDelta(baseline.userSecondsMedian, optimized.userSecondsMedian),
        maxRssDeltaPercent: percentageDelta(baseline.maxRssKbMedian, optimized.maxRssKbMedian),
        workloadSpeedup: baseline.workloadElapsedMsMedian !== null && optimized.workloadElapsedMsMedian
          ? baseline.workloadElapsedMsMedian / optimized.workloadElapsedMsMedian
          : null,
      },
      baselineRuns,
      optimizedRuns,
    });
  }
} finally {
  rmSync(scratch, {recursive: true, force: true});
}

const report = {
  schema: "layout-lab-benchmark-comparison/v1",
  baselineCommit: process.env.BASELINE_COMMIT ?? "59f968c9fe843ae1cf718e2ddd865abaa6212870",
  optimizedCommit: process.env.OPTIMIZED_COMMIT ?? process.env.GITHUB_SHA ?? "working-tree",
  runner: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    runsPerVersion: RUNS,
    ordering: "alternating baseline/optimized by repetition",
  },
  results,
};

writeFileSync("benchmark-comparison.json", `${JSON.stringify(report, null, 2)}\n`);

const markdown = [
  "# Layout Lab benchmark comparison",
  "",
  `Baseline: \`${report.baselineCommit.slice(0, 8)}\`  `,
  `Optimized: \`${report.optimizedCommit.slice(0, 8)}\`  `,
  `Measured runs per version: ${RUNS}`,
  "",
  "| Workload | Baseline wall median | Optimized wall median | Wall speedup | Baseline RSS | Optimized RSS |",
  "| --- | ---: | ---: | ---: | ---: | ---: |",
  ...results.map(({benchmark, baseline, optimized, comparison}) => {
    const speedup = comparison.wallSpeedup === null ? "—" : `${comparison.wallSpeedup.toFixed(2)}×`;
    return `| ${benchmark.replace("-benchmark.ts", "")} | ${baseline.wallMsMedian.toFixed(2)} ms | ${optimized.wallMsMedian.toFixed(2)} ms | ${speedup} | ${(baseline.maxRssKbMedian / 1024).toFixed(1)} MiB | ${(optimized.maxRssKbMedian / 1024).toFixed(1)} MiB |`;
  }),
  "",
  "Wall time includes Bun process startup; each benchmark's own workload timing remains in the JSON report when available. No wall-clock threshold is used as a correctness gate.",
  "",
].join("\n");

writeFileSync("benchmark-comparison.md", markdown);
process.stdout.write(markdown);
