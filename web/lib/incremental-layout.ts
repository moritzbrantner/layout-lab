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
  type LayoutInvalidationGraph,
  type LayoutInvalidationPlan,
  type LayoutMutation,
} from "./layout-invalidation";
import {
  adaptFlexTree,
  adaptGridTree,
  validateLayoutNodeShallow,
  validateLayoutTree,
  type LayoutNode,
} from "./layout-tree";

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

type IncrementalCacheIndexes = {
  graph: LayoutInvalidationGraph;
  nodeIds: readonly string[];
  boxesById: ReadonlyMap<string, LayoutBox>;
};

const cacheIndexes = new WeakMap<IncrementalLayoutCache, IncrementalCacheIndexes>();

function contextForTree(root: LayoutNode): IncrementalLayoutContext {
  if (root.style.display === "block") return "block";
  if (root.style.display === "flex") return "flex";
  return "grid";
}

function sameTreeShape(left: LayoutNode, right: LayoutNode, seen = new WeakSet<object>()): boolean {
  if (left === right) return true;
  if (seen.has(right)) return false;
  seen.add(right);
  if (left.id !== right.id || left.style.display !== right.style.display || left.children.length !== right.children.length) {
    return false;
  }
  for (let index = 0; index < left.children.length; index += 1) {
    if (!sameTreeShape(left.children[index]!, right.children[index]!, seen)) return false;
  }
  return true;
}

function validateChangedLayoutNodes(previous: LayoutNode, next: LayoutNode) {
  const errors: string[] = [];
  const visit = (left: LayoutNode, right: LayoutNode) => {
    if (left === right) return;
    errors.push(...validateLayoutNodeShallow(right));
    for (let index = 0; index < left.children.length; index += 1) {
      visit(left.children[index]!, right.children[index]!);
    }
  };
  visit(previous, next);
  return errors;
}

function indexBoxes(boxes: readonly LayoutBox[]) {
  return new Map(boxes.map((box) => [box.id, box]));
}

function graphNodeIds(graph: LayoutInvalidationGraph) {
  const ids: string[] = [];
  const seen = new Set<string>();
  graph.nodes.forEach((node) => {
    if (seen.has(node.layoutNodeId)) return;
    seen.add(node.layoutNodeId);
    ids.push(node.layoutNodeId);
  });
  return ids;
}

function indexesForCache(cache: IncrementalLayoutCache): IncrementalCacheIndexes {
  let indexes = cacheIndexes.get(cache);
  if (indexes) return indexes;

  const graph = buildLayoutInvalidationGraph(cache.tree);
  indexes = {
    graph,
    nodeIds: graphNodeIds(graph),
    boxesById: indexBoxes(cache.boxes),
  };
  cacheIndexes.set(cache, indexes);
  return indexes;
}

function dirty(dirtyPhaseIds: ReadonlySet<string>, nodeId: string, phase: Parameters<typeof invalidationPhaseId>[1]) {
  return dirtyPhaseIds.has(invalidationPhaseId(nodeId, phase));
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

function dirtyLayoutNodeIds(graph: LayoutInvalidationGraph, dirtyPhaseIds: ReadonlySet<string>) {
  const dirtyNodeIds = new Set<string>();
  graph.nodes.forEach((node) => {
    if (dirtyPhaseIds.has(node.id)) dirtyNodeIds.add(node.layoutNodeId);
  });
  return dirtyNodeIds;
}

function nodeSets(nodeIds: readonly string[], recomputed: ReadonlySet<string>) {
  return {
    recomputedNodeIds: nodeIds.filter((id) => recomputed.has(id)),
    reusedNodeIds: nodeIds.filter((id) => !recomputed.has(id)),
  };
}

function mutationCanChangeInvalidationGraph(mutation: LayoutMutation) {
  return mutation.kind === "children"
    || mutation.field === "width"
    || mutation.field === "height"
    || mutation.field === "gridItem.minContribution";
}

export function createIncrementalLayoutCache(tree: LayoutNode): IncrementalLayoutCache {
  const context = contextForTree(tree);
  let cache: IncrementalLayoutCache;

  if (context === "block") {
    const result = layoutBlockTree(tree);
    cache = {context, tree, root: result.root, boxes: result.boxes};
  } else if (context === "flex") {
    const result = layoutFlexTree(tree);
    cache = {
      context,
      tree,
      root: result.root,
      boxes: result.boxes,
      flexResolution: result.resolution,
    };
  } else {
    const result = layoutGridTree(tree);
    cache = {
      context,
      tree,
      root: result.root,
      boxes: result.boxes,
      gridResolution: result.resolution,
      gridTrackStarts: result.trackStarts,
    };
  }

  const graph = buildLayoutInvalidationGraph(tree);
  cacheIndexes.set(cache, {
    graph,
    nodeIds: graphNodeIds(graph),
    boxesById: indexBoxes(cache.boxes),
  });
  return cache;
}

function assertIncrementalBoundary(cache: IncrementalLayoutCache, nextTree: LayoutNode, mutation: LayoutMutation) {
  const shapeMatches = sameTreeShape(cache.tree, nextTree);
  const errors = shapeMatches
    ? validateChangedLayoutNodes(cache.tree, nextTree)
    : validateLayoutTree(nextTree);
  if (errors.length > 0) throw new Error(errors.join("; "));
  if (mutation.kind === "children") {
    throw new Error("structural mutations require rebuilding the invalidation graph before incremental execution");
  }
  if (contextForTree(nextTree) !== cache.context) {
    throw new Error("incremental layout cannot change the root formatting context");
  }
  if (!shapeMatches) {
    throw new Error("incremental style execution requires an unchanged layout-tree shape");
  }
}

function recomputeBlock(
  cache: IncrementalLayoutCache,
  nextTree: LayoutNode,
  graph: LayoutInvalidationGraph,
  dirtyPhaseIds: ReadonlySet<string>,
  dirtyNodes: ReadonlySet<string>,
  oldBoxes: ReadonlyMap<string, LayoutBox>,
) {
  if (dirtyPhaseIds.size === 0) {
    return {root: cache.root, boxes: cache.boxes, solverPasses: 0, visitedNodes: 0};
  }

  const dirtySubtree = new Set(dirtyNodes);
  dirtyNodes.forEach((nodeId) => {
    let parentId = graph.parentByNodeId[nodeId];
    while (parentId) {
      dirtySubtree.add(parentId);
      parentId = graph.parentByNodeId[parentId];
    }
  });
  let visitedNodes = 0;

  const visit = (
    node: LayoutNode,
    containingWidth: number,
    proposedX: number,
    proposedY: number,
  ): LayoutBox => {
    visitedNodes += 1;
    const old = oldBoxes.get(node.id);
    if (!old) throw new Error(`${node.id}: missing cached block geometry`);
    if (!dirtySubtree.has(node.id)) return old;

    const width = dirty(dirtyPhaseIds, node.id, "inline-size")
      ? resolveLayoutWidth(node, containingWidth)
      : old.rect.width;
    const x = dirty(dirtyPhaseIds, node.id, "position") ? proposedX : old.rect.x;
    const y = dirty(dirtyPhaseIds, node.id, "position") ? proposedY : old.rect.y;

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
      const childX = dirty(dirtyPhaseIds, child.id, "position") ? x : oldChild.rect.x;
      const childOriginY = dirty(dirtyPhaseIds, child.id, "position") ? y + childY : oldChild.rect.y;
      const childBox = visit(child, width, childX, childOriginY);
      children.push(childBox);
      cursor = childBox.rect.y - y + childBox.rect.height;
      previousAfter = child.style.marginBlockAfter ?? 0;
    });

    const contentHeight = node.children.length > 0 ? cursor + previousAfter : 0;
    const height = dirty(dirtyPhaseIds, node.id, "block-size")
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
    visitedNodes,
  };
}

function recomputeFlex(
  cache: IncrementalLayoutCache,
  nextTree: LayoutNode,
  dirtyPhaseIds: ReadonlySet<string>,
  oldBoxes: ReadonlyMap<string, LayoutBox>,
) {
  if (dirtyPhaseIds.size === 0) {
    if (!cache.flexResolution) throw new Error("missing cached Flex resolution");
    return {
      root: cache.root,
      boxes: cache.boxes,
      resolution: cache.flexResolution,
      solverPasses: 0,
      visitedNodes: 0,
    };
  }

  const lineDirty = dirty(dirtyPhaseIds, nextTree.id, "flex-line");
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
    const width = dirty(dirtyPhaseIds, child.id, "inline-size") ? item.targetSize : old.rect.width;
    const x = dirty(dirtyPhaseIds, child.id, "position") ? cursor : old.rect.x;
    const height = dirty(dirtyPhaseIds, child.id, "block-size") ? resolveLayoutHeight(child, 0) : old.rect.height;
    const box = dirty(dirtyPhaseIds, child.id, "geometry")
      ? {id: child.id, label: child.label, rect: {x, y: 0, width, height}, children: [] as const}
      : old;
    cursor += width + gap;
    return box;
  });

  const oldRoot = oldBoxes.get(nextTree.id)!;
  const rootWidth = dirty(dirtyPhaseIds, nextTree.id, "inline-size")
    ? (input ?? adaptFlexTree(nextTree)).innerSize
    : oldRoot.rect.width;
  const derivedHeight = children.reduce((maximum, child) => Math.max(maximum, child.rect.height), 0);
  const rootHeight = dirty(dirtyPhaseIds, nextTree.id, "block-size")
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
    visitedNodes: 1 + nextTree.children.length,
  };
}

function recomputeGrid(
  cache: IncrementalLayoutCache,
  nextTree: LayoutNode,
  dirtyPhaseIds: ReadonlySet<string>,
  oldBoxes: ReadonlyMap<string, LayoutBox>,
) {
  if (dirtyPhaseIds.size === 0) {
    if (!cache.gridResolution || !cache.gridTrackStarts) throw new Error("missing cached Grid evidence");
    return {
      root: cache.root,
      boxes: cache.boxes,
      resolution: cache.gridResolution,
      trackStarts: cache.gridTrackStarts,
      solverPasses: 0,
      visitedNodes: 0,
    };
  }

  const tracksDirty = dirty(dirtyPhaseIds, nextTree.id, "grid-tracks");
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

    let resolvedWidth = Math.max(0, item.columnSpan - 1) * gap;
    for (let index = item.columnStart; index < end; index += 1) {
      resolvedWidth += resolution.tracks[index]!.targetSize;
    }
    const width = dirty(dirtyPhaseIds, child.id, "inline-size") ? resolvedWidth : old.rect.width;
    const x = dirty(dirtyPhaseIds, child.id, "position") ? trackStarts[item.columnStart]! : old.rect.x;
    const height = dirty(dirtyPhaseIds, child.id, "block-size") ? resolveLayoutHeight(child, 0) : old.rect.height;

    return dirty(dirtyPhaseIds, child.id, "geometry")
      ? {id: child.id, label: child.label, rect: {x, y: 0, width, height}, children: []}
      : old;
  });

  const oldRoot = oldBoxes.get(nextTree.id)!;
  const rootWidth = dirty(dirtyPhaseIds, nextTree.id, "inline-size")
    ? (input ?? adaptGridTree(nextTree)).innerSize
    : oldRoot.rect.width;
  const derivedHeight = children.reduce((maximum, child) => Math.max(maximum, child.rect.height), 0);
  const rootHeight = dirty(dirtyPhaseIds, nextTree.id, "block-size")
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
    visitedNodes: 1 + nextTree.children.length,
  };
}

export function recomputeIncrementalLayout(
  cache: IncrementalLayoutCache,
  nextTree: LayoutNode,
  mutation: LayoutMutation,
): IncrementalLayoutResult {
  assertIncrementalBoundary(cache, nextTree, mutation);
  const indexes = indexesForCache(cache);
  const graph = indexes.graph;
  const plan = planLayoutInvalidation(graph, mutation);
  if (plan.requiresGraphRebuild) {
    throw new Error("structural mutations require rebuilding the invalidation graph before incremental execution");
  }

  const dirtyPhaseIds = new Set(plan.dirtyPhaseIds);
  const dirtyNodes = dirtyLayoutNodeIds(graph, dirtyPhaseIds);
  const sets = nodeSets(indexes.nodeIds, dirtyNodes);
  let nextCache: IncrementalLayoutCache;
  let solverPasses: number;
  let visitedNodes: number;

  if (cache.context === "block") {
    const partial = recomputeBlock(cache, nextTree, graph, dirtyPhaseIds, dirtyNodes, indexes.boxesById);
    nextCache = {
      context: "block",
      tree: nextTree,
      root: partial.root,
      boxes: partial.boxes,
    };
    solverPasses = partial.solverPasses;
    visitedNodes = partial.visitedNodes;
  } else if (cache.context === "flex") {
    const partial = recomputeFlex(cache, nextTree, dirtyPhaseIds, indexes.boxesById);
    nextCache = {
      context: "flex",
      tree: nextTree,
      root: partial.root,
      boxes: partial.boxes,
      flexResolution: partial.resolution,
    };
    solverPasses = partial.solverPasses;
    visitedNodes = partial.visitedNodes;
  } else {
    const partial = recomputeGrid(cache, nextTree, dirtyPhaseIds, indexes.boxesById);
    nextCache = {
      context: "grid",
      tree: nextTree,
      root: partial.root,
      boxes: partial.boxes,
      gridResolution: partial.resolution,
      gridTrackStarts: partial.trackStarts,
    };
    solverPasses = partial.solverPasses;
    visitedNodes = partial.visitedNodes;
  }

  const nextGraph = mutationCanChangeInvalidationGraph(mutation)
    ? buildLayoutInvalidationGraph(nextTree)
    : graph;
  cacheIndexes.set(nextCache, {
    graph: nextGraph,
    nodeIds: indexes.nodeIds,
    boxesById: nextCache.boxes === cache.boxes ? indexes.boxesById : indexBoxes(nextCache.boxes),
  });

  return {
    cache: nextCache,
    plan,
    recomputedNodeIds: sets.recomputedNodeIds,
    reusedNodeIds: sets.reusedNodeIds,
    work: {
      recomputedPhaseCount: plan.dirtyPhaseIds.length,
      reusedPhaseCount: graph.nodes.length - plan.dirtyPhaseIds.length,
      visitedNodes,
      reusedNodes: sets.reusedNodeIds.length,
      solverPasses,
    },
  };
}
