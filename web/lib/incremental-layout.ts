import {resolveAdjacentPositiveMargins} from "./flow-formatting";
import {resolveFlexLine, resolveMinMaxFractionTracks, type FlexLineResolution, type MinMaxGridResolution} from "./layout-analysis";
import {
  flattenLayoutBoxes,
  layoutBlockTree,
  layoutFlexTree,
  layoutGridTree,
  resolveLayoutHeight,
  resolveLayoutWidth,
  type LayoutBox,
} from "./layout-engine";
import {
  buildLayoutInvalidationGraph,
  invalidationPhaseId,
  planLayoutInvalidation,
  type LayoutInvalidationPlan,
  type LayoutMutation,
} from "./layout-invalidation";
import {adaptFlexTree, adaptGridTree, validateLayoutTree, type LayoutNode} from "./layout-tree";

export type IncrementalLayoutContext = "block" | "flex" | "grid";

export type IncrementalLayoutCache = {
  context: IncrementalLayoutContext;
  tree: LayoutNode;
  root: LayoutBox;
  boxes: readonly LayoutBox[];
  flexResolution?: FlexLineResolution;
  gridResolution?: MinMaxGridResolution;
  gridTrackStarts?: readonly number[];
};

export type IncrementalLayoutWork = {
  recomputedPhaseCount: number;
  reusedPhaseCount: number;
  visitedNodes: number;
  reusedNodes: number;
  solverPasses: number;
};

export type IncrementalLayoutResult = {
  cache: IncrementalLayoutCache;
  plan: LayoutInvalidationPlan;
  recomputedNodeIds: readonly string[];
  reusedNodeIds: readonly string[];
  work: IncrementalLayoutWork;
};

function contextForTree(root: LayoutNode): IncrementalLayoutContext {
  if (root.style.display === "block") return "block";
  if (root.style.display === "flex") return "flex";
  return "grid";
}

function treeShape(node: LayoutNode): string {
  return `${node.id}:${node.style.display}[${node.children.map(treeShape).join(",")}]`;
}

function indexBoxes(boxes: readonly LayoutBox[]) {
  return new Map(boxes.map((box) => [box.id, box]));
}

function dirty(plan: LayoutInvalidationPlan, nodeId: string, phase: Parameters<typeof invalidationPhaseId>[1]) {
  return plan.dirtyPhaseIds.includes(invalidationPhaseId(nodeId, phase));
}

function computeTrackStarts(resolution: MinMaxGridResolution, gap: number) {
  const starts: number[] = [];
  let cursor = 0;
  resolution.tracks.forEach((track) => {
    starts.push(cursor);
    cursor += track.targetSize + gap;
  });
  return starts;
}

function nodeSets(root: LayoutNode, plan: LayoutInvalidationPlan) {
  const all: string[] = [];
  const visit = (node: LayoutNode) => {
    all.push(node.id);
    node.children.forEach(visit);
  };
  visit(root);

  const recomputed = new Set(plan.dirtyPhaseIds.map((phase) => phase.slice(0, phase.lastIndexOf(":"))));
  return {
    recomputedNodeIds: all.filter((id) => recomputed.has(id)),
    reusedNodeIds: all.filter((id) => !recomputed.has(id)),
  };
}

export function createIncrementalLayoutCache(tree: LayoutNode): IncrementalLayoutCache {
  const context = contextForTree(tree);
  if (context === "block") {
    const result = layoutBlockTree(tree);
    return {context, tree, root: result.root, boxes: result.boxes};
  }
  if (context === "flex") {
    const result = layoutFlexTree(tree);
    return {
      context,
      tree,
      root: result.root,
      boxes: result.boxes,
      flexResolution: result.resolution,
    };
  }

  const result = layoutGridTree(tree);
  return {
    context,
    tree,
    root: result.root,
    boxes: result.boxes,
    gridResolution: result.resolution,
    gridTrackStarts: result.trackStarts,
  };
}

function assertIncrementalBoundary(cache: IncrementalLayoutCache, nextTree: LayoutNode, mutation: LayoutMutation) {
  const errors = validateLayoutTree(nextTree);
  if (errors.length > 0) throw new Error(errors.join("; "));
  if (contextForTree(nextTree) !== cache.context) {
    throw new Error("incremental layout cannot change the root formatting context");
  }
  if (treeShape(nextTree) !== treeShape(cache.tree)) {
    throw new Error("incremental style execution requires an unchanged layout-tree shape");
  }
  if (mutation.kind === "children") {
    throw new Error("structural mutations require rebuilding the invalidation graph before incremental execution");
  }
}

function recomputeBlock(
  cache: IncrementalLayoutCache,
  nextTree: LayoutNode,
  plan: LayoutInvalidationPlan,
) {
  const oldBoxes = indexBoxes(cache.boxes);
  const graph = buildLayoutInvalidationGraph(cache.tree);
  const dirtyNodes = new Set(plan.dirtyPhaseIds.map((phase) => phase.slice(0, phase.lastIndexOf(":"))));
  const dirtySubtree = new Set(dirtyNodes);
  dirtyNodes.forEach((nodeId) => {
    let parentId = graph.parentByNodeId[nodeId];
    while (parentId) {
      dirtySubtree.add(parentId);
      parentId = graph.parentByNodeId[parentId];
    }
  });

  const visit = (
    node: LayoutNode,
    containingWidth: number,
    proposedX: number,
    proposedY: number,
  ): LayoutBox => {
    const old = oldBoxes.get(node.id);
    if (!old) throw new Error(`${node.id}: missing cached block geometry`);
    if (!dirtySubtree.has(node.id)) return old;

    const width = dirty(plan, node.id, "inline-size")
      ? resolveLayoutWidth(node, containingWidth)
      : old.rect.width;
    const x = dirty(plan, node.id, "position") ? proposedX : old.rect.x;
    const y = dirty(plan, node.id, "position") ? proposedY : old.rect.y;

    const children: LayoutBox[] = [];
    let cursor = 0;
    let previousAfter = 0;

    node.children.forEach((child, index) => {
      const before = child.style.marginBlockBefore ?? 0;
      const gap = index === 0
        ? before
        : resolveAdjacentPositiveMargins({mode: "collapse", before: previousAfter, after: before}).gap;
      const childY = cursor + gap;
      const oldChild = oldBoxes.get(child.id);
      if (!oldChild) throw new Error(`${child.id}: missing cached block geometry`);
      const childX = dirty(plan, child.id, "position") ? x : oldChild.rect.x;
      const childOriginY = dirty(plan, child.id, "position") ? y + childY : oldChild.rect.y;
      const childBox = visit(child, width, childX, childOriginY);
      children.push(childBox);
      cursor = childBox.rect.y - y + childBox.rect.height;
      previousAfter = child.style.marginBlockAfter ?? 0;
    });

    const contentHeight = node.children.length > 0 ? cursor + previousAfter : 0;
    const height = dirty(plan, node.id, "block-size")
      ? resolveLayoutHeight(node, contentHeight)
      : old.rect.height;

    return {
      id: node.id,
      label: node.label,
      rect: {x, y, width, height},
      children,
    };
  };

  if (nextTree.style.width === undefined) {
    throw new Error(`${nextTree.id}: block baseline requires an explicit root width`);
  }
  const oldRoot = oldBoxes.get(nextTree.id)!;
  const root = visit(nextTree, nextTree.style.width, oldRoot.rect.x, oldRoot.rect.y);
  return {
    root,
    boxes: flattenLayoutBoxes(root),
    solverPasses: 0,
  };
}

function recomputeFlex(
  cache: IncrementalLayoutCache,
  nextTree: LayoutNode,
  plan: LayoutInvalidationPlan,
) {
  const oldBoxes = indexBoxes(cache.boxes);
  const lineDirty = dirty(plan, nextTree.id, "flex-line");
  const input = lineDirty ? adaptFlexTree(nextTree) : undefined;
  const resolution = lineDirty
    ? resolveFlexLine(input!)
    : cache.flexResolution;
  if (!resolution) throw new Error("missing cached Flex resolution");
  const gap = lineDirty ? input!.gapSize : nextTree.style.flexContainer!.gap;

  let cursor = 0;
  const children = nextTree.children.map((child, index): LayoutBox => {
    const old = oldBoxes.get(child.id);
    if (!old) throw new Error(`${child.id}: missing cached Flex geometry`);
    const item = resolution.items[index];
    if (!item) throw new Error(`${child.id}: missing Flex line item resolution`);
    const width = dirty(plan, child.id, "inline-size") ? item.targetSize : old.rect.width;
    const x = dirty(plan, child.id, "position") ? cursor : old.rect.x;
    const height = dirty(plan, child.id, "block-size") ? resolveLayoutHeight(child, 0) : old.rect.height;
    const box = dirty(plan, child.id, "geometry")
      ? {id: child.id, label: child.label, rect: {x, y: 0, width, height}, children: [] as const}
      : old;
    cursor += width + gap;
    return box;
  });

  const oldRoot = oldBoxes.get(nextTree.id)!;
  const rootWidth = dirty(plan, nextTree.id, "inline-size")
    ? (input ?? adaptFlexTree(nextTree)).innerSize
    : oldRoot.rect.width;
  const derivedHeight = children.reduce((maximum, child) => Math.max(maximum, child.rect.height), 0);
  const rootHeight = dirty(plan, nextTree.id, "block-size")
    ? resolveLayoutHeight(nextTree, derivedHeight)
    : oldRoot.rect.height;
  const root: LayoutBox = {
    id: nextTree.id,
    label: nextTree.label,
    rect: {x: oldRoot.rect.x, y: oldRoot.rect.y, width: rootWidth, height: rootHeight},
    children,
  };

  return {
    root,
    boxes: flattenLayoutBoxes(root),
    resolution,
    solverPasses: lineDirty ? resolution.iterations.length : 0,
  };
}

function recomputeGrid(
  cache: IncrementalLayoutCache,
  nextTree: LayoutNode,
  plan: LayoutInvalidationPlan,
) {
  const oldBoxes = indexBoxes(cache.boxes);
  const tracksDirty = dirty(plan, nextTree.id, "grid-tracks");
  const input = tracksDirty ? adaptGridTree(nextTree) : undefined;
  const resolution = tracksDirty
    ? resolveMinMaxFractionTracks(input!)
    : cache.gridResolution;
  if (!resolution) throw new Error("missing cached Grid resolution");
  const gap = tracksDirty ? input!.gapSize : nextTree.style.gridContainer!.gap;
  const trackStarts = tracksDirty
    ? computeTrackStarts(resolution, gap)
    : cache.gridTrackStarts;
  if (!trackStarts) throw new Error("missing cached Grid track starts");

  const children = nextTree.children.map((child): LayoutBox => {
    const old = oldBoxes.get(child.id);
    if (!old) throw new Error(`${child.id}: missing cached Grid geometry`);
    const item = child.style.gridItem;
    if (!item) throw new Error(`${child.id}: Grid incremental execution requires explicit placement`);
    const end = item.columnStart + item.columnSpan;
    if (end > resolution.tracks.length) throw new Error(`${child.id}: grid placement exceeds the explicit column set`);

    const trackSizes = resolution.tracks
      .slice(item.columnStart, end)
      .map((track) => track.targetSize);
    const resolvedWidth = trackSizes.reduce((sum, size) => sum + size, 0)
      + Math.max(0, item.columnSpan - 1) * gap;
    const width = dirty(plan, child.id, "inline-size") ? resolvedWidth : old.rect.width;
    const x = dirty(plan, child.id, "position") ? trackStarts[item.columnStart]! : old.rect.x;
    const height = dirty(plan, child.id, "block-size") ? resolveLayoutHeight(child, 0) : old.rect.height;

    return dirty(plan, child.id, "geometry")
      ? {id: child.id, label: child.label, rect: {x, y: 0, width, height}, children: []}
      : old;
  });

  const oldRoot = oldBoxes.get(nextTree.id)!;
  const rootWidth = dirty(plan, nextTree.id, "inline-size")
    ? (input ?? adaptGridTree(nextTree)).innerSize
    : oldRoot.rect.width;
  const derivedHeight = children.reduce((maximum, child) => Math.max(maximum, child.rect.height), 0);
  const rootHeight = dirty(plan, nextTree.id, "block-size")
    ? resolveLayoutHeight(nextTree, derivedHeight)
    : oldRoot.rect.height;
  const root: LayoutBox = {
    id: nextTree.id,
    label: nextTree.label,
    rect: {x: oldRoot.rect.x, y: oldRoot.rect.y, width: rootWidth, height: rootHeight},
    children,
  };

  return {
    root,
    boxes: flattenLayoutBoxes(root),
    resolution,
    trackStarts,
    solverPasses: tracksDirty ? 1 : 0,
  };
}

export function recomputeIncrementalLayout(
  cache: IncrementalLayoutCache,
  nextTree: LayoutNode,
  mutation: LayoutMutation,
): IncrementalLayoutResult {
  assertIncrementalBoundary(cache, nextTree, mutation);
  const graph = buildLayoutInvalidationGraph(cache.tree);
  const plan = planLayoutInvalidation(graph, mutation);
  if (plan.requiresGraphRebuild) {
    throw new Error("structural mutations require rebuilding the invalidation graph before incremental execution");
  }

  const partial = cache.context === "block"
    ? recomputeBlock(cache, nextTree, plan)
    : cache.context === "flex"
      ? recomputeFlex(cache, nextTree, plan)
      : recomputeGrid(cache, nextTree, plan);
  const sets = nodeSets(nextTree, plan);

  const nextCache: IncrementalLayoutCache = {
    context: cache.context,
    tree: nextTree,
    root: partial.root,
    boxes: partial.boxes,
    flexResolution: "resolution" in partial && cache.context === "flex" ? partial.resolution : cache.flexResolution,
    gridResolution: "resolution" in partial && cache.context === "grid" ? partial.resolution : cache.gridResolution,
    gridTrackStarts: "trackStarts" in partial ? partial.trackStarts : cache.gridTrackStarts,
  };

  return {
    cache: nextCache,
    plan,
    recomputedNodeIds: sets.recomputedNodeIds,
    reusedNodeIds: sets.reusedNodeIds,
    work: {
      recomputedPhaseCount: plan.dirtyPhaseIds.length,
      reusedPhaseCount: graph.nodes.length - plan.dirtyPhaseIds.length,
      visitedNodes: sets.recomputedNodeIds.length,
      reusedNodes: sets.reusedNodeIds.length,
      solverPasses: partial.solverPasses,
    },
  };
}
