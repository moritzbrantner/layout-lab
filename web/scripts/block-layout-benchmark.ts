import {layoutBlockTree} from "../lib/layout-engine";
import type {LayoutNode} from "../lib/layout-tree";

const GROUPS = 32;
const LEAVES_PER_GROUP = 32;
const RUNS = 40;

function buildTree(): LayoutNode {
  return {
    id: "root",
    label: "Root",
    style: {display: "block", width: 1200},
    children: Array.from({length: GROUPS}, (_, groupIndex) => ({
      id: `group-${groupIndex}`,
      label: `Group ${groupIndex}`,
      style: {display: "block", marginBlockAfter: 4},
      children: Array.from({length: LEAVES_PER_GROUP}, (_, leafIndex) => ({
        id: `leaf-${groupIndex}-${leafIndex}`,
        label: `Leaf ${groupIndex}/${leafIndex}`,
        style: {
          display: "block",
          height: 20 + ((groupIndex + leafIndex) % 5),
          marginBlockAfter: (leafIndex % 3) * 2,
        },
        children: [],
      })),
    })),
  };
}

function geometrySignature(result: ReturnType<typeof layoutBlockTree>) {
  let checksum = 0;
  result.boxes.forEach((box, index) => {
    checksum += (index + 1) * (
      box.rect.x * 3
      + box.rect.y * 5
      + box.rect.width * 7
      + box.rect.height * 11
    );
  });
  return [
    result.boxes.length,
    result.visitedNodes,
    result.marginCollapses.length,
    result.root.rect.height.toFixed(4),
    checksum.toFixed(4),
  ].join(":");
}

const tree = buildTree();
let expectedSignature: string | undefined;
let boxes = 0;
let marginCollapses = 0;
const started = performance.now();

for (let run = 0; run < RUNS; run += 1) {
  const result = layoutBlockTree(tree);
  const signature = run === 0
    ? geometrySignature(result)
    : [
      result.boxes.length,
      result.visitedNodes,
      result.marginCollapses.length,
      result.root.rect.height.toFixed(4),
    ].join(":");
  if (run === 0) expectedSignature = signature;
  else if (!signature.startsWith(expectedSignature!.split(":").slice(0, 4).join(":"))) {
    throw new Error("block-layout benchmark became nondeterministic");
  }
  boxes = result.boxes.length;
  marginCollapses = result.marginCollapses.length;
}

const elapsedMs = performance.now() - started;
console.log(JSON.stringify({
  workload: "block-layout-large-tree",
  groups: GROUPS,
  leavesPerGroup: LEAVES_PER_GROUP,
  nodes: boxes,
  runs: RUNS,
  marginCollapses,
  resultSignature: expectedSignature,
  elapsedMs: Number(elapsedMs.toFixed(2)),
  layoutsPerSecond: Number((RUNS / (elapsedMs / 1_000)).toFixed(2)),
}, null, 2));
