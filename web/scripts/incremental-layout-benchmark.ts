import {createIncrementalLayoutCache, recomputeIncrementalLayout} from "../lib/incremental-layout";
import {layoutBlockTree} from "../lib/layout-engine";
import type {LayoutNode} from "../lib/layout-tree";

const GROUP_COUNT = 24;
const LEAVES_PER_GROUP = 16;
const MUTATIONS = 1_000;

function buildTree(): LayoutNode {
  return {
    id: "benchmark-root",
    label: "Benchmark root",
    style: {display: "block", width: 1200},
    children: Array.from({length: GROUP_COUNT}, (_, groupIndex) => ({
      id: `group-${groupIndex}`,
      label: `Group ${groupIndex}`,
      style: {display: "block", height: LEAVES_PER_GROUP * 22, marginBlockAfter: 4},
      children: Array.from({length: LEAVES_PER_GROUP}, (_, leafIndex) => ({
        id: `leaf-${groupIndex}-${leafIndex}`,
        label: `Leaf ${groupIndex}/${leafIndex}`,
        style: {display: "block", width: 180, height: 20},
        children: [],
      })),
    })),
  };
}

// This benchmark is copied into older baseline worktrees by compare-benchmarks.mjs,
// so its input-mutation helper must depend only on the long-lived LayoutNode shape.
function updateBenchmarkNode(
  root: LayoutNode,
  nodeId: string,
  update: (node: LayoutNode) => LayoutNode,
): LayoutNode {
  if (root.id === nodeId) return update(root);
  let changed = false;
  const children = root.children.map((child) => {
    const next = updateBenchmarkNode(child, nodeId, update);
    changed ||= next !== child;
    return next;
  });
  return changed ? {...root, children} : root;
}

function signature(tree: LayoutNode) {
  return JSON.stringify(layoutBlockTree(tree).boxes.map((box) => ({id: box.id, ...box.rect})));
}

function geometryChecksum(boxes: ReturnType<typeof layoutBlockTree>["boxes"]) {
  let checksum = 0;
  boxes.forEach((box, index) => {
    checksum += (index + 1) * (
      box.rect.x * 3
      + box.rect.y * 5
      + box.rect.width * 7
      + box.rect.height * 11
    );
  });
  return `${boxes.length}:${checksum.toFixed(4)}`;
}

let tree = buildTree();
let cache = createIncrementalLayoutCache(tree);
let visitedNodes = 0;
let recomputedNodes = 0;
const started = performance.now();

for (let mutationIndex = 0; mutationIndex < MUTATIONS; mutationIndex += 1) {
  const groupIndex = mutationIndex % GROUP_COUNT;
  const leafIndex = Math.floor(mutationIndex / GROUP_COUNT) % LEAVES_PER_GROUP;
  const nodeId = `leaf-${groupIndex}-${leafIndex}`;
  const marginBlockBefore = mutationIndex % 2 === 0 ? 1 : 2;
  const nextTree = updateBenchmarkNode(tree, nodeId, (node) => ({
    ...node,
    style: {...node.style, marginBlockBefore},
  }));
  const result = recomputeIncrementalLayout(cache, nextTree, {
    kind: "style",
    nodeId,
    field: "marginBlockBefore",
  });
  visitedNodes += result.work.visitedNodes;
  recomputedNodes += result.recomputedNodeIds.length;
  cache = result.cache;
  tree = nextTree;
}

const elapsedMs = performance.now() - started;
const resultSignature = geometryChecksum(cache.boxes);
const incrementalSignature = JSON.stringify(cache.boxes.map((box) => ({id: box.id, ...box.rect})));
if (incrementalSignature !== signature(tree)) {
  throw new Error("incremental benchmark diverged from clean block layout");
}

console.log(JSON.stringify({
  workload: "incremental-layout-style-mutations",
  nodes: 1 + GROUP_COUNT + GROUP_COUNT * LEAVES_PER_GROUP,
  mutations: MUTATIONS,
  visitedNodes,
  recomputedNodes,
  resultSignature,
  elapsedMs: Number(elapsedMs.toFixed(2)),
  mutationsPerSecond: Math.round(MUTATIONS / (elapsedMs / 1_000)),
}, null, 2));
