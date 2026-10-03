import {createIncrementalLayoutCache, recomputeIncrementalLayout} from "../lib/incremental-layout";
import {layoutBlockTree} from "../lib/layout-engine";
import {updateLayoutNode, type LayoutNode} from "../lib/layout-tree";

const GROUP_COUNT = 24;
const LEAVES_PER_GROUP = 16;
const LOCAL_MUTATIONS = 1_000;

function buildTree(): LayoutNode {
  return {
    id: "orchestration-root",
    label: "Orchestration root",
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

function geometrySignature(tree: LayoutNode) {
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
let boundaryNodeVisits = 0;
let provenanceComparisons = 0;
let invalidationPhaseVisits = 0;
let invalidationEdgeTraversals = 0;
let graphRebuilds = 0;
let executorVisits = 0;
let recomputedNodes = 0;
let mutations = 0;

function applyMutation(
  nextTree: LayoutNode,
  nodeId: string,
  field: "marginBlockBefore" | "width",
) {
  const result = recomputeIncrementalLayout(cache, nextTree, {kind: "style", nodeId, field});
  boundaryNodeVisits += result.work.boundaryNodeVisits;
  provenanceComparisons += result.work.provenanceComparisons;
  invalidationPhaseVisits += result.work.invalidationPhaseVisits;
  invalidationEdgeTraversals += result.work.invalidationEdgeTraversals;
  graphRebuilds += result.work.graphRebuilds;
  executorVisits += result.work.visitedNodes;
  recomputedNodes += result.recomputedNodeIds.length;
  cache = result.cache;
  tree = nextTree;
  mutations += 1;
}

for (let mutationIndex = 0; mutationIndex < LOCAL_MUTATIONS; mutationIndex += 1) {
  const groupIndex = mutationIndex % GROUP_COUNT;
  const leafIndex = Math.floor(mutationIndex / GROUP_COUNT) % LEAVES_PER_GROUP;
  const nodeId = `leaf-${groupIndex}-${leafIndex}`;
  const marginBlockBefore = mutationIndex % 2 === 0 ? 1 : 2;
  applyMutation(
    updateLayoutNode(tree, nodeId, (node) => ({
      ...node,
      style: {...node.style, marginBlockBefore},
    })),
    nodeId,
    "marginBlockBefore",
  );
}

const topologyNodeId = "leaf-0-0";
applyMutation(
  updateLayoutNode(tree, topologyNodeId, (node) => ({
    ...node,
    style: {...node.style, width: undefined},
  })),
  topologyNodeId,
  "width",
);
applyMutation(
  updateLayoutNode(tree, topologyNodeId, (node) => ({
    ...node,
    style: {...node.style, width: 180},
  })),
  topologyNodeId,
  "width",
);

const incrementalSignature = JSON.stringify(cache.boxes.map((box) => ({id: box.id, ...box.rect})));
const cleanSignature = geometrySignature(tree);
if (incrementalSignature !== cleanSignature) {
  throw new Error("incremental orchestration benchmark diverged from clean block layout");
}

console.log(JSON.stringify({
  workload: "incremental-layout-orchestration",
  nodes: 1 + GROUP_COUNT + GROUP_COUNT * LEAVES_PER_GROUP,
  mutations,
  boundaryNodeVisits,
  provenanceComparisons,
  invalidationPhaseVisits,
  invalidationEdgeTraversals,
  graphRebuilds,
  executorVisits,
  recomputedNodes,
  resultSignature: geometryChecksum(cache.boxes),
}, null, 2));
