import {layoutTidyTree, type TidyTreeInput, type TidyTreeNode} from "../lib/tidy-tree";

const DEPTH = 8;
const RUNS = 25;

function buildTree(depth: number, id: string): TidyTreeNode {
  if (depth === 0) return {id, children: []};
  return {
    id,
    children: [
      buildTree(depth - 1, `${id}-l`),
      buildTree(depth - 1, `${id}-r`),
    ],
  };
}

const input: TidyTreeInput = {
  nodeWidth: 48,
  nodeHeight: 32,
  horizontalGap: 24,
  levelGap: 44,
  root: buildTree(DEPTH, "root"),
};

let expectedSignature: string | undefined;
let contourComparisons = 0;
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
  ].join(":");
  expectedSignature ??= signature;
  if (signature !== expectedSignature) throw new Error("tidy-tree benchmark became nondeterministic");
  contourComparisons = result.contourComparisons;
  nodes = result.placements.length;
}

const elapsedMs = performance.now() - started;
console.log(JSON.stringify({
  workload: "tidy-tree-balanced",
  depth: DEPTH,
  nodes,
  runs: RUNS,
  contourComparisons,
  elapsedMs: Number(elapsedMs.toFixed(2)),
  layoutsPerSecond: Number((RUNS / (elapsedMs / 1_000)).toFixed(2)),
}, null, 2));
