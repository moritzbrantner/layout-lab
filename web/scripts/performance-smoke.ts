import {spawnSync} from "node:child_process";

type JsonRecord = Record<string, unknown>;

const scenarios = [
  "incremental-orchestration-benchmark.ts",
  "sugiyama-benchmark.ts",
  "line-breaking-benchmark.ts",
] as const;

function parseJsonOutput(stdout: string): JsonRecord {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error(`benchmark did not emit JSON:\n${stdout}`);
  return JSON.parse(stdout.slice(start, end + 1)) as JsonRecord;
}

function runScenario(script: string): JsonRecord {
  const result = spawnSync("bun", ["run", `scripts/${script}`], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {...process.env, NO_COLOR: "1"},
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${script} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return parseJsonOutput(result.stdout);
}

function deterministicEvidence(sample: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(sample).filter(([key]) =>
      key !== "elapsedMs"
      && !key.toLowerCase().includes("persecond")
    ),
  );
}

const evidence = scenarios.map((script) => deterministicEvidence(runScenario(script)));
const workloadIds = evidence.map((sample) => sample.workload);
const expected = [
  "incremental-layout-orchestration",
  "sugiyama-layered-dag",
  "knuth-plass-box-glue",
];

if (JSON.stringify(workloadIds) !== JSON.stringify(expected)) {
  throw new Error(`unexpected performance smoke workloads: ${JSON.stringify(workloadIds)}`);
}

console.log(JSON.stringify({
  schema: "layout-lab-performance-smoke/v1",
  evidence,
}, null, 2));
