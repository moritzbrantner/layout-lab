import {layoutTidyTree, type TidyTreeInput, type TidyTreeNode} from "../lib/tidy-tree";

const DEPTH = 512;
const RUNS = 12;

function buildChain(depth: number): TidyTreeNode {
  let node: TidyTreeNode = {id: `node-${depth}`, children: []};
  for (let level = depth - 1; level >= 0; level -= 1) {
    node = {id: `node-${level}`, children: [node]};
  }
  return node;
}

const input: TidyTreeInput = {
  nodeWidth: 48,
  nodeHeight: 32,
  horizontalGap: 24,
  levelGap: 44,
  root: buildChain(DEPTH),
};

let expectedSignature: string | undefined;
let nodes = 0;
const started = performance.now();

for (let run = 0; run < RUNS; run += 1) {
  const result = layoutTidyTree(input);
  const signature = [
    result.placements.length,
    result.shifts.length,
    result.contourComparisons,
    result.drawingWidth,
    result.drawingHeight,
    result.maxDepth,
  ].join(":");
  expectedSignature ??= signature;
  if (signature !== expectedSignature) throw new Error("deep tidy-tree benchmark became nondeterministic");
  nodes = result.placements.length;
}

const elapsedMs = performance.now() - started;
console.log(JSON.stringify({
  workload: "tidy-tree-deep-unary",
  depth: DEPTH,
  nodes,
  runs: RUNS,
  elapsedMs: Number(elapsedMs.toFixed(2)),
  layoutsPerSecond: Number((RUNS / (elapsedMs / 1_000)).toFixed(2)),
}, null, 2));
