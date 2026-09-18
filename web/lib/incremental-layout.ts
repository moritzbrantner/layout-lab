import {resolveFlexLine, resolveMinMaxFractionTracks, type FlexLineResolution, type MinMaxGridResolution} from "./layout-analysis";
import {
  flattenLayoutBoxes,
  layoutBlockTree,
  layoutFlexTree,
  layoutGridTree,
} from "./layout-engine";
import {
  maxChildBlockSize,
  resolveBlockSiblingGap,
  resolveFlexItemRect,
  resolveGridItemRect,
  resolveGridTrackStarts,
  resolveLayoutHeight,
  resolveLayoutWidth,
  type LayoutBox,
} from "./layout-geometry";
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
  boundaryNodeVisits: number;
  provenanceComparisons: number;
  invalidationPhaseVisits: number;
  invalidationEdgeTraversals: number;
  graphRebuilds: number;
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
  layoutNodeIdByPhaseId: ReadonlyMap<string, string>;
  boxIndexById: ReadonlyMap<string, number>;
};

const cacheIndexes = new WeakMap<IncrementalLayoutCache, IncrementalCacheIndexes>();

function contextForTree(root: LayoutNode): IncrementalLayoutContext {
  if (root.style.display === "block") return "block";
  if (root.style.display === "flex") return "flex";
  return "grid";
}

type IncrementalBoundaryWork = {
  nodeVisits: number;
  provenanceComparisons: number;
};

function sameTreeShape(
  left: LayoutNode,
  right: LayoutNode,
  work: IncrementalBoundaryWork,
  seen = new WeakSet<object>(),
): boolean {
  work.nodeVisits += 1;
  if (left === right) return true;
  if (seen.has(right)) return false;
  seen.add(right);
  if (left.id !== right.id || left.style.display !== right.style.display || left.children.length !== right.children.length) {
    return false;
  }
  for (let index = 0; index < left.children.length; index += 1) {
    if (!sameTreeShape(left.children[index]!, right.children[index]!, work, seen)) return false;
  }
  return true;
}

function validateChangedLayoutNodes(previous: LayoutNode, next: LayoutNode, work: IncrementalBoundaryWork) {
  const errors: string[] = [];
  const visit = (left: LayoutNode, right: LayoutNode) => {
    work.nodeVisits += 1;
    if (left === right) return;
    errors.push(...validateLayoutNodeShallow(right));
    for (let index = 0; index < left.children.length; index += 1) {
      visit(left.children[index]!, right.children[index]!);
    }
  };
  visit(previous, next);
  return errors;
}

function indexBoxPositions(boxes: readonly LayoutBox[]) {
  const indexById = new Map<string, number>();
  boxes.forEach((box, index) => indexById.set(box.id, index));
  return indexById;
}

function indexLayoutNodesByPhase(graph: LayoutInvalidationGraph) {
  return new Map(graph.nodes.map((node) => [node.id, node.layoutNodeId]));
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
    layoutNodeIdByPhaseId: indexLayoutNodesByPhase(graph),
    boxIndexById: indexBoxPositions(cache.boxes),
  };
  cacheIndexes.set(cache, indexes);
  return indexes;
}

function cachedBox(
  boxes: readonly LayoutBox[],
  boxIndexById: ReadonlyMap<string, number>,
  id: string,
) {
  const index = boxIndexById.get(id);
  if (index === undefined) throw new Error(`${id}: missing cached layout-box index`);
  const box = boxes[index];
  if (!box || box.id !== id) throw new Error(`${id}: cached layout-box order drifted from the validated tree shape`);
  return box;
}

function dirty(dirtyPhaseIds: ReadonlySet<string>, nodeId: string, phase: Parameters<typeof invalidationPhaseId>[1]) {
  return dirtyPhaseIds.has(invalidationPhaseId(nodeId, phase));
}

function dirtyLayoutNodeIds(
  layoutNodeIdByPhaseId: ReadonlyMap<string, string>,
  dirtyPhaseIds: readonly string[],
) {
  const dirtyNodeIds = new Set<string>();
  dirtyPhaseIds.forEach((phaseId) => {
    const nodeId = layoutNodeIdByPhaseId.get(phaseId);
    if (!nodeId) throw new Error(`unknown dirty invalidation phase: ${phaseId}`);
    dirtyNodeIds.add(nodeId);
  });
  return dirtyNodeIds;
}

function nodeSets(nodeIds: readonly string[], recomputed: ReadonlySet<string>) {
  const recomputedNodeIds: string[] = [];
  const reusedNodeIds: string[] = [];
  nodeIds.forEach((id) => {
    if (recomputed.has(id)) recomputedNodeIds.push(id);
    else reusedNodeIds.push(id);
  });
  return {recomputedNodeIds, reusedNodeIds};
}

function semanticDiffPaths(
  left: unknown,
  right: unknown,
  work: IncrementalBoundaryWork,
  path = "",
): string[] {
  work.provenanceComparisons += 1;
  if (Object.is(left, right)) return [];

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return [path];
    for (let index = 0; index < left.length; index += 1) {
      if (semanticDiffPaths(left[index], right[index], work, path).length > 0) return [path];
    }
    return [];
  }

  if (left !== null && right !== null && typeof left === "object" && typeof right === "object") {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])].sort();
    const differences: string[] = [];

    keys.forEach((key) => {
      const leftValue = leftRecord[key];
      const rightValue = rightRecord[key];
      if (leftValue === undefined && rightValue === undefined) return;
      differences.push(...semanticDiffPaths(
        leftValue,
        rightValue,
        work,
        path ? `${path}.${key}` : key,
      ));
    });
    return differences;
  }

  return [path || "<root>"];
}

type ChangedLayoutNode = {
  previous: LayoutNode;
  next: LayoutNode;
};

function assertDeclaredStyleMutation(
  previous: LayoutNode,
  next: LayoutNode,
  mutation: Extract<LayoutMutation, {kind: "style"}>,
  work: IncrementalBoundaryWork,
): ChangedLayoutNode | null {
  const changes: Array<{nodeId: string; field: string}> = [];
  let changedNode: ChangedLayoutNode | null = null;

  const visit = (left: LayoutNode, right: LayoutNode) => {
    work.nodeVisits += 1;
    if (left === right) return;
    if (left.label !== right.label) {
      throw new Error(`${right.id}: incremental layout does not support undeclared label changes`);
    }
    const styleChanges = semanticDiffPaths(left.style, right.style, work);
    if (styleChanges.length > 0) changedNode = {previous: left, next: right};
    styleChanges.forEach((field) => {
      changes.push({nodeId: right.id, field});
    });
    for (let index = 0; index < left.children.length; index += 1) {
      visit(left.children[index]!, right.children[index]!);
    }
  };
  visit(previous, next);

  if (changes.length === 0) return null;
  if (changes.length === 1 && changes[0]!.nodeId === mutation.nodeId && changes[0]!.field === mutation.field) {
    return changedNode;
  }

  const actual = changes.map((change) => `${change.nodeId}.${change.field}`).join(", ");
  throw new Error(
    `declared style mutation ${mutation.nodeId}.${mutation.field} does not match layout-tree change: ${actual || "none"}`,
  );
}

function invalidationGraphNeedsRefresh(
  mutation: Extract<LayoutMutation, {kind: "style"}>,
  changedNode: ChangedLayoutNode | null,
) {
  if (!changedNode) return false;
  const previousStyle = changedNode.previous.style;
  const nextStyle = changedNode.next.style;

  if (mutation.field === "width") {
    return (previousStyle.width === undefined) !== (nextStyle.width === undefined);
  }
  if (mutation.field === "height") {
    return (previousStyle.height === undefined) !== (nextStyle.height === undefined);
  }
  if (mutation.field === "gridItem.minContribution") {
    return (previousStyle.gridItem?.minContribution === undefined)
      !== (nextStyle.gridItem?.minContribution === undefined);
  }
  return false;
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
    layoutNodeIdByPhaseId: indexLayoutNodesByPhase(graph),
    boxIndexById: indexBoxPositions(cache.boxes),
  });
  return cache;
}

function assertIncrementalBoundary(cache: IncrementalLayoutCache, nextTree: LayoutNode, mutation: LayoutMutation) {
  const work: IncrementalBoundaryWork = {nodeVisits: 0, provenanceComparisons: 0};
  const shapeMatches = sameTreeShape(cache.tree, nextTree, work);
  const errors = shapeMatches
    ? validateChangedLayoutNodes(cache.tree, nextTree, work)
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
  const changedNode = assertDeclaredStyleMutation(cache.tree, nextTree, mutation, work);
  return {work, changedNode};
}

function recomputeBlock(
  cache: IncrementalLayoutCache,
  nextTree: LayoutNode,
  graph: LayoutInvalidationGraph,
  dirtyPhaseIds: ReadonlySet<string>,
  dirtyNodes: ReadonlySet<string>,
  boxIndexById: ReadonlyMap<string, number>,
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
    const old = cachedBox(cache.boxes, boxIndexById, node.id);
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
        : resolveBlockSiblingGap(previousAfter, before);
      const childY = cursor + gap;
      const oldChild = cachedBox(cache.boxes, boxIndexById, child.id);
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
  const oldRoot = cachedBox(cache.boxes, boxIndexById, nextTree.id);
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
  boxIndexById: ReadonlyMap<string, number>,
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
    const old = cachedBox(cache.boxes, boxIndexById, child.id);
    const item = resolution.items[index];
    if (!item) throw new Error(`${child.id}: missing Flex line item resolution`);
    const desired = resolveFlexItemRect(child, cursor, item.targetSize);
    const width = dirty(dirtyPhaseIds, child.id, "inline-size") ? desired.width : old.rect.width;
    const x = dirty(dirtyPhaseIds, child.id, "position") ? desired.x : old.rect.x;
    const height = dirty(dirtyPhaseIds, child.id, "block-size") ? desired.height : old.rect.height;
    const box = dirty(dirtyPhaseIds, child.id, "geometry")
      ? {id: child.id, label: child.label, rect: {x, y: 0, width, height}, children: [] as const}
      : old;
    cursor += width + gap;
    return box;
  });

  const oldRoot = cachedBox(cache.boxes, boxIndexById, nextTree.id);
  const rootWidth = dirty(dirtyPhaseIds, nextTree.id, "inline-size")
    ? (input ?? adaptFlexTree(nextTree)).innerSize
    : oldRoot.rect.width;
  const rootHeight = dirty(dirtyPhaseIds, nextTree.id, "block-size")
    ? resolveLayoutHeight(nextTree, maxChildBlockSize(children))
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
  boxIndexById: ReadonlyMap<string, number>,
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
    ? resolveGridTrackStarts(resolution, gap)
    : cache.gridTrackStarts;
  if (!trackStarts) throw new Error("missing cached Grid track starts");

  const children = nextTree.children.map((child): LayoutBox => {
    const old = cachedBox(cache.boxes, boxIndexById, child.id);
    const item = child.style.gridItem;
    if (!item) throw new Error(`${child.id}: Grid incremental execution requires explicit placement`);
    const desired = resolveGridItemRect(child, resolution, trackStarts, gap);
    const width = dirty(dirtyPhaseIds, child.id, "inline-size") ? desired.width : old.rect.width;
    const x = dirty(dirtyPhaseIds, child.id, "position") ? desired.x : old.rect.x;
    const height = dirty(dirtyPhaseIds, child.id, "block-size") ? desired.height : old.rect.height;

    return dirty(dirtyPhaseIds, child.id, "geometry")
      ? {id: child.id, label: child.label, rect: {x, y: 0, width, height}, children: []}
      : old;
  });

  const oldRoot = cachedBox(cache.boxes, boxIndexById, nextTree.id);
  const rootWidth = dirty(dirtyPhaseIds, nextTree.id, "inline-size")
    ? (input ?? adaptGridTree(nextTree)).innerSize
    : oldRoot.rect.width;
  const rootHeight = dirty(dirtyPhaseIds, nextTree.id, "block-size")
    ? resolveLayoutHeight(nextTree, maxChildBlockSize(children))
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
  const boundary = assertIncrementalBoundary(cache, nextTree, mutation);
  const indexes = indexesForCache(cache);
  const graph = indexes.graph;
  const plan = planLayoutInvalidation(graph, mutation);
  if (plan.requiresGraphRebuild) {
    throw new Error("structural mutations require rebuilding the invalidation graph before incremental execution");
  }

  const dirtyPhaseIds = new Set(plan.dirtyPhaseIds);
  const dirtyNodes = dirtyLayoutNodeIds(indexes.layoutNodeIdByPhaseId, plan.dirtyPhaseIds);
  const sets = nodeSets(indexes.nodeIds, dirtyNodes);
  let nextCache: IncrementalLayoutCache;
  let solverPasses: number;
  let visitedNodes: number;

  if (cache.context === "block") {
    const partial = recomputeBlock(cache, nextTree, graph, dirtyPhaseIds, dirtyNodes, indexes.boxIndexById);
    nextCache = {
      context: "block",
      tree: nextTree,
      root: partial.root,
      boxes: partial.boxes,
    };
    solverPasses = partial.solverPasses;
    visitedNodes = partial.visitedNodes;
  } else if (cache.context === "flex") {
    const partial = recomputeFlex(cache, nextTree, dirtyPhaseIds, indexes.boxIndexById);
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
    const partial = recomputeGrid(cache, nextTree, dirtyPhaseIds, indexes.boxIndexById);
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

  const nextGraph = invalidationGraphNeedsRefresh(mutation, boundary.changedNode)
    ? buildLayoutInvalidationGraph(nextTree)
    : graph;
  const graphRebuilds = nextGraph === graph ? 0 : 1;
  cacheIndexes.set(nextCache, {
    graph: nextGraph,
    nodeIds: indexes.nodeIds,
    layoutNodeIdByPhaseId: nextGraph === graph
      ? indexes.layoutNodeIdByPhaseId
      : indexLayoutNodesByPhase(nextGraph),
    boxIndexById: indexes.boxIndexById,
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
      boundaryNodeVisits: boundary.work.nodeVisits,
      provenanceComparisons: boundary.work.provenanceComparisons,
      invalidationPhaseVisits: plan.work.phaseVisits,
      invalidationEdgeTraversals: plan.work.edgeTraversals,
      graphRebuilds,
    },
  };
}
