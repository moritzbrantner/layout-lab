import {buildFlexEngineTree, buildGridEngineTree} from "./layout-engine-fixtures";
import {createIncrementalLayoutCache, recomputeIncrementalLayout, type IncrementalLayoutCache} from "./incremental-layout";
import {buildLayoutInvalidationGraph, planLayoutInvalidation, type LayoutMutation} from "./layout-invalidation";
import {buildBlockLayoutTree, flattenLayoutTree, type LayoutNode} from "./layout-tree";

export type MutationWorkloadId = "block-structure" | "flex-solver" | "grid-solver";
export type MutationWorkloadCategory = "resize" | "content" | "insert" | "remove" | "reorder" | "placement";
export type MutationExecutionMode = "incremental" | "graph-rebuild";

type MutationWorkloadStepDefinition = {
  id: string;
  label: string;
  category: MutationWorkloadCategory;
  mutation: LayoutMutation;
  apply: (tree: LayoutNode) => LayoutNode;
};

export type MutationWorkloadDefinition = {
  id: MutationWorkloadId;
  title: string;
  summary: string;
  createTree: () => LayoutNode;
  steps: readonly MutationWorkloadStepDefinition[];
};

export type MutationWorkloadStepEvidence = {
  id: string;
  label: string;
  category: MutationWorkloadCategory;
  mode: MutationExecutionMode;
  dirtyPhaseCount: number;
  recomputedNodeIds: readonly string[];
  reusedNodeIds: readonly string[];
  visitedNodes: number;
  cleanVisitedNodes: number;
  algorithmIterations: number;
  cleanAlgorithmIterations: number;
  graphRebuilds: number;
  geometryMatchesClean: boolean;
};

export type MutationWorkloadResult = {
  definition: MutationWorkloadDefinition;
  steps: readonly MutationWorkloadStepEvidence[];
  totalVisitedNodes: number;
  totalCleanVisitedNodes: number;
  totalAlgorithmIterations: number;
  totalCleanAlgorithmIterations: number;
  totalGraphRebuilds: number;
  finalGeometry: readonly {id: string; x: number; y: number; width: number; height: number}[];
};

function updateNode(root: LayoutNode, nodeId: string, update: (node: LayoutNode) => LayoutNode): LayoutNode {
  if (root.id === nodeId) return update(root);
  return {
    ...root,
    children: root.children.map((child) => updateNode(child, nodeId, update)),
  };
}

function blockAside(): LayoutNode {
  return {
    id: "aside",
    label: "Aside",
    style: {display: "block", height: 36, marginBlockBefore: 8, marginBlockAfter: 12},
    children: [],
  };
}

const blockSteps: readonly MutationWorkloadStepDefinition[] = [
  {
    id: "resize",
    label: "Resize containing block",
    category: "resize",
    mutation: {kind: "style", nodeId: "block-root", field: "width"},
    apply: (tree) => ({...tree, style: {...tree.style, width: 480}}),
  },
  {
    id: "content",
    label: "Content measurement changes",
    category: "content",
    mutation: {kind: "style", nodeId: "content", field: "height"},
    apply: (tree) => updateNode(tree, "content", (node) => ({...node, style: {...node.style, height: 168}})),
  },
  {
    id: "insert",
    label: "Insert an Aside block",
    category: "insert",
    mutation: {kind: "children", parentId: "block-root", operation: "insert"},
    apply: (tree) => ({
      ...tree,
      children: [tree.children[0]!, tree.children[1]!, blockAside(), tree.children[2]!],
    }),
  },
  {
    id: "reorder",
    label: "Reorder Content and Aside",
    category: "reorder",
    mutation: {kind: "children", parentId: "block-root", operation: "reorder"},
    apply: (tree) => {
      const header = tree.children.find((child) => child.id === "header")!;
      const content = tree.children.find((child) => child.id === "content")!;
      const aside = tree.children.find((child) => child.id === "aside")!;
      const footer = tree.children.find((child) => child.id === "footer")!;
      return {...tree, children: [header, aside, content, footer]};
    },
  },
  {
    id: "remove",
    label: "Remove the Aside block",
    category: "remove",
    mutation: {kind: "children", parentId: "block-root", operation: "remove"},
    apply: (tree) => ({...tree, children: tree.children.filter((child) => child.id !== "aside")}),
  },
] as const;

const flexSteps: readonly MutationWorkloadStepDefinition[] = [
  {
    id: "resize",
    label: "Resize Flex container",
    category: "resize",
    mutation: {kind: "style", nodeId: "root", field: "width"},
    apply: (tree) => ({...tree, style: {...tree.style, width: 620}}),
  },
  {
    id: "content",
    label: "Change item B cross-size",
    category: "content",
    mutation: {kind: "style", nodeId: "item-b", field: "height"},
    apply: (tree) => updateNode(tree, "item-b", (node) => ({...node, style: {...node.style, height: 116}})),
  },
] as const;

const gridSteps: readonly MutationWorkloadStepDefinition[] = [
  {
    id: "resize",
    label: "Resize Grid container",
    category: "resize",
    mutation: {kind: "style", nodeId: "root", field: "width"},
    apply: (tree) => ({...tree, style: {...tree.style, width: 640}}),
  },
  {
    id: "placement",
    label: "Move item C one track left",
    category: "placement",
    mutation: {kind: "style", nodeId: "item-c", field: "gridItem.columnStart"},
    apply: (tree) => updateNode(tree, "item-c", (node) => ({
      ...node,
      style: {...node.style, gridItem: {...node.style.gridItem!, columnStart: 1}},
    })),
  },
] as const;

export const mutationWorkloadDefinitions: readonly MutationWorkloadDefinition[] = [
  {
    id: "block-structure",
    title: "Block structural trace",
    summary: "Sequentially resize, change content evidence, insert, reorder, and remove a block while rebuilding the dependency graph only for tree-shape changes.",
    createTree: () => buildBlockLayoutTree(),
    steps: blockSteps,
  },
  {
    id: "flex-solver",
    title: "Flex solver trace",
    summary: "Resize the main axis, then change only cross-size evidence to show when Flex line iterations can be reused.",
    createTree: () => buildFlexEngineTree(),
    steps: flexSteps,
  },
  {
    id: "grid-solver",
    title: "Grid solver trace",
    summary: "Resize tracks, then move a non-contributing item using cached track evidence without rerunning track sizing.",
    createTree: () => buildGridEngineTree(),
    steps: gridSteps,
  },
] as const;

export function getMutationWorkloadDefinition(id: MutationWorkloadId) {
  const definition = mutationWorkloadDefinitions.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`unknown layout mutation workload: ${id}`);
  return definition;
}

function geometry(cache: IncrementalLayoutCache) {
  return cache.boxes.map((box) => ({id: box.id, ...box.rect}));
}

function geometrySignature(cache: IncrementalLayoutCache) {
  return JSON.stringify(geometry(cache));
}

function fullAlgorithmIterations(cache: IncrementalLayoutCache) {
  if (cache.context === "flex") return cache.flexResolution?.iterations.length ?? 0;
  if (cache.context === "grid") return (cache.gridResolution?.contributionSteps.length ?? 0) + 1;
  return 0;
}

function fullRecomputedNodeIds(tree: LayoutNode) {
  return flattenLayoutTree(tree).map((node) => node.id);
}

export function runMutationWorkload(id: MutationWorkloadId): MutationWorkloadResult {
  const definition = getMutationWorkloadDefinition(id);
  let cache = createIncrementalLayoutCache(definition.createTree());
  const evidence: MutationWorkloadStepEvidence[] = [];

  for (const step of definition.steps) {
    const nextTree = step.apply(cache.tree);
    const clean = createIncrementalLayoutCache(nextTree);

    if (step.mutation.kind === "children") {
      const graph = buildLayoutInvalidationGraph(cache.tree);
      const plan = planLayoutInvalidation(graph, step.mutation);
      if (!plan.requiresGraphRebuild) {
        throw new Error(`${definition.id}/${step.id}: structural mutation did not require a graph rebuild`);
      }
      const rebuilt = createIncrementalLayoutCache(nextTree);
      const recomputedNodeIds = fullRecomputedNodeIds(nextTree);
      evidence.push({
        id: step.id,
        label: step.label,
        category: step.category,
        mode: "graph-rebuild",
        dirtyPhaseCount: plan.dirtyPhaseIds.length,
        recomputedNodeIds,
        reusedNodeIds: [],
        visitedNodes: rebuilt.boxes.length,
        cleanVisitedNodes: clean.boxes.length,
        algorithmIterations: fullAlgorithmIterations(rebuilt),
        cleanAlgorithmIterations: fullAlgorithmIterations(clean),
        graphRebuilds: 1,
        geometryMatchesClean: geometrySignature(rebuilt) === geometrySignature(clean),
      });
      cache = rebuilt;
      continue;
    }

    const incremental = recomputeIncrementalLayout(cache, nextTree, step.mutation);
    evidence.push({
      id: step.id,
      label: step.label,
      category: step.category,
      mode: "incremental",
      dirtyPhaseCount: incremental.plan.dirtyPhaseIds.length,
      recomputedNodeIds: incremental.recomputedNodeIds,
      reusedNodeIds: incremental.reusedNodeIds,
      visitedNodes: incremental.work.visitedNodes,
      cleanVisitedNodes: clean.boxes.length,
      algorithmIterations: incremental.work.solverPasses,
      cleanAlgorithmIterations: fullAlgorithmIterations(clean),
      graphRebuilds: 0,
      geometryMatchesClean: geometrySignature(incremental.cache) === geometrySignature(clean),
    });
    cache = incremental.cache;
  }

  return {
    definition,
    steps: evidence,
    totalVisitedNodes: evidence.reduce((sum, step) => sum + step.visitedNodes, 0),
    totalCleanVisitedNodes: evidence.reduce((sum, step) => sum + step.cleanVisitedNodes, 0),
    totalAlgorithmIterations: evidence.reduce((sum, step) => sum + step.algorithmIterations, 0),
    totalCleanAlgorithmIterations: evidence.reduce((sum, step) => sum + step.cleanAlgorithmIterations, 0),
    totalGraphRebuilds: evidence.reduce((sum, step) => sum + step.graphRebuilds, 0),
    finalGeometry: geometry(cache),
  };
}
