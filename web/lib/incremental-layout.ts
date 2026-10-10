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
  assertValidLayoutMutation,
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
  /** Layout-box entries written into the next cache's retained box tree. */
  retainedEntryWrites: number;
  /** Node ids visited to produce recompute/reuse reporting. */
  reportingNodeVisits: number;
};

export type IncrementalLayoutResult = {
  cache: IncrementalLayoutCache;
  plan: LayoutInvalidationPlan;
  recomputedNodeIds: readonly string[];
  /**
   * Reused complement, derived on first read in O(total nodes). It is a
   * reporting view for inspectors, not executor work; hot paths that only need
   * the count read `work.reusedNodes`.
   */
  reusedNodeIds: readonly string[];
  work: IncrementalLayoutWork;
};

type IncrementalCacheIndexes = {
  graph: LayoutInvalidationGraph;
  nodeIds: readonly string[];
  /** Position of each layout node id in `nodeIds` (graph order). */
  nodeOrderById: ReadonlyMap<string, number>;
  layoutNodeIdByPhaseId: ReadonlyMap<string, string>;
  /**
   * Child-index path from the root box to each layout box. Incremental style
   * execution keeps the tree shape, so paths stay valid across the chain and
   * unchanged boxes are reached through the structurally shared box tree
   * instead of a flat array that would be rebuilt after every step.
   */
  boxPathById: ReadonlyMap<string, readonly number[]>;
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

function indexBoxPaths(root: LayoutBox) {
  const pathById = new Map<string, readonly number[]>();
  const visit = (box: LayoutBox, path: readonly number[]) => {
    pathById.set(box.id, path);
    box.children.forEach((child, index) => visit(child, [...path, index]));
  };
  visit(root, []);
  return pathById;
}

function indexNodeOrder(nodeIds: readonly string[]) {
  return new Map(nodeIds.map((id, index) => [id, index]));
}

/**
 * Cache whose flat `boxes` view is derived lazily from the retained box tree.
 * Reading `boxes` costs O(total boxes) once per changed root; the executor
 * itself never rebuilds it.
 */
function nextRetainedCache(
  previous: IncrementalLayoutCache,
  fields: Omit<IncrementalLayoutCache, "boxes">,
): IncrementalLayoutCache {
  const cache = {...fields} as IncrementalLayoutCache;
  // An unchanged root shares the previous flat view (eager or lazy) without reading it.
  const shared = fields.root === previous.root
    ? Object.getOwnPropertyDescriptor(previous, "boxes")
    : undefined;
  if (shared) {
    Object.defineProperty(cache, "boxes", shared);
    return cache;
  }
  let boxes: readonly LayoutBox[] | undefined;
  Object.defineProperty(cache, "boxes", {
    enumerable: true,
    get: () => (boxes ??= flattenLayoutBoxes(fields.root)),
  });
  return cache;
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

  indexes = buildCacheIndexes(cache.tree, cache.root);
  cacheIndexes.set(cache, indexes);
  return indexes;
}

function buildCacheIndexes(tree: LayoutNode, root: LayoutBox): IncrementalCacheIndexes {
  const graph = buildLayoutInvalidationGraph(tree);
  const nodeIds = graphNodeIds(graph);
  return {
    graph,
    nodeIds,
    nodeOrderById: indexNodeOrder(nodeIds),
    layoutNodeIdByPhaseId: indexLayoutNodesByPhase(graph),
    boxPathById: indexBoxPaths(root),
  };
}

function cachedBox(
  root: LayoutBox,
  boxPathById: ReadonlyMap<string, readonly number[]>,
  id: string,
) {
  const path = boxPathById.get(id);
  if (path === undefined) throw new Error(`${id}: missing cached layout-box path`);
  let box: LayoutBox | undefined = root;
  for (const index of path) box = box?.children[index];
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

/**
 * Recomputed ids are ordered by graph position from the dirty set alone, so
 * reporting visits only dirty nodes. The reused complement is derived lazily
 * on first read; that O(total nodes) cost belongs to the consumer.
 */
function nodeSets(
  nodeIds: readonly string[],
  nodeOrderById: ReadonlyMap<string, number>,
  recomputed: ReadonlySet<string>,
) {
  const order = (id: string) => {
    const position = nodeOrderById.get(id);
    if (position === undefined) throw new Error(`${id}: dirty node is missing from the invalidation graph order`);
    return position;
  };
  const recomputedNodeIds = [...recomputed].sort((left, right) => order(left) - order(right));
  let reusedNodeIds: readonly string[] | undefined;
  return {
    recomputedNodeIds,
    reusedNodes: nodeIds.length - recomputed.size,
    reportingNodeVisits: recomputed.size,
    reusedNodeIds: () => (reusedNodeIds ??= nodeIds.filter((id) => !recomputed.has(id))),
  };
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
  graph: LayoutInvalidationGraph,
  mutation: Extract<LayoutMutation, {kind: "style"}>,
  changedNode: ChangedLayoutNode | null,
) {
  if (!changedNode) return false;
  const previousStyle = changedNode.previous.style;
  const nextStyle = changedNode.next.style;

  if (mutation.field === "width") {
    const parentId = graph.parentByNodeId[changedNode.next.id];
    const parentDisplay = parentId === null || parentId === undefined
      ? undefined
      : graph.displayByNodeId[parentId];
    return parentDisplay === "block"
      && (previousStyle.width === undefined) !== (nextStyle.width === undefined);
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

function unchangedStylePlan(
  graph: LayoutInvalidationGraph,
  mutation: Extract<LayoutMutation, {kind: "style"}>,
): LayoutInvalidationPlan {
  assertValidLayoutMutation(graph, mutation);
  return {
    mutation,
    seedPhaseIds: [],
    dirtyPhaseIds: [],
    requiresGraphRebuild: false,
    work: {phaseVisits: 0, edgeTraversals: 0},
  };
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

  cacheIndexes.set(cache, buildCacheIndexes(tree, cache.root));
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
  boxPathById: ReadonlyMap<string, readonly number[]>,
) {
  if (dirtyPhaseIds.size === 0) {
    return {root: cache.root, solverPasses: 0, visitedNodes: 0, retainedEntryWrites: 0};
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
  let retainedEntryWrites = 0;

  const visit = (
    node: LayoutNode,
    containingWidth: number,
    proposedX: number,
    proposedY: number,
  ): LayoutBox => {
    visitedNodes += 1;
    const old = cachedBox(cache.root, boxPathById, node.id);
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
      const oldChild = cachedBox(cache.root, boxPathById, child.id);
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

    retainedEntryWrites += 1;
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
  const oldRoot = cachedBox(cache.root, boxPathById, nextTree.id);
  const root = visit(nextTree, nextTree.style.width, oldRoot.rect.x, oldRoot.rect.y);
  return {
    root,
    solverPasses: 0,
    visitedNodes,
    retainedEntryWrites,
  };
}

function recomputeFlex(
  cache: IncrementalLayoutCache,
  nextTree: LayoutNode,
  dirtyPhaseIds: ReadonlySet<string>,
  boxPathById: ReadonlyMap<string, readonly number[]>,
) {
  if (dirtyPhaseIds.size === 0) {
    if (!cache.flexResolution) throw new Error("missing cached Flex resolution");
    return {
      root: cache.root,
      resolution: cache.flexResolution,
      solverPasses: 0,
      visitedNodes: 0,
      retainedEntryWrites: 0,
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
  let retainedEntryWrites = 1;
  const children = nextTree.children.map((child, index): LayoutBox => {
    const old = cachedBox(cache.root, boxPathById, child.id);
    const item = resolution.items[index];
    if (!item) throw new Error(`${child.id}: missing Flex line item resolution`);
    const desired = resolveFlexItemRect(child, cursor, item.targetSize);
    const width = dirty(dirtyPhaseIds, child.id, "inline-size") ? desired.width : old.rect.width;
    const x = dirty(dirtyPhaseIds, child.id, "position") ? desired.x : old.rect.x;
    const height = dirty(dirtyPhaseIds, child.id, "block-size") ? desired.height : old.rect.height;
    const geometryDirty = dirty(dirtyPhaseIds, child.id, "geometry");
    if (geometryDirty) retainedEntryWrites += 1;
    const box = geometryDirty
      ? {id: child.id, label: child.label, rect: {x, y: 0, width, height}, children: [] as const}
      : old;
    cursor += width + gap;
    return box;
  });

  const oldRoot = cachedBox(cache.root, boxPathById, nextTree.id);
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
    resolution,
    solverPasses: lineDirty ? resolution.iterations.length : 0,
    visitedNodes: 1 + nextTree.children.length,
    retainedEntryWrites,
  };
}

function recomputeGrid(
  cache: IncrementalLayoutCache,
  nextTree: LayoutNode,
  dirtyPhaseIds: ReadonlySet<string>,
  boxPathById: ReadonlyMap<string, readonly number[]>,
) {
  if (dirtyPhaseIds.size === 0) {
    if (!cache.gridResolution || !cache.gridTrackStarts) throw new Error("missing cached Grid evidence");
    return {
      root: cache.root,
      resolution: cache.gridResolution,
      trackStarts: cache.gridTrackStarts,
      solverPasses: 0,
      visitedNodes: 0,
      retainedEntryWrites: 0,
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

  let retainedEntryWrites = 1;
  const children = nextTree.children.map((child): LayoutBox => {
    const old = cachedBox(cache.root, boxPathById, child.id);
    const item = child.style.gridItem;
    if (!item) throw new Error(`${child.id}: Grid incremental execution requires explicit placement`);
    const desired = resolveGridItemRect(child, resolution, trackStarts, gap);
    const width = dirty(dirtyPhaseIds, child.id, "inline-size") ? desired.width : old.rect.width;
    const x = dirty(dirtyPhaseIds, child.id, "position") ? desired.x : old.rect.x;
    const height = dirty(dirtyPhaseIds, child.id, "block-size") ? desired.height : old.rect.height;

    if (!dirty(dirtyPhaseIds, child.id, "geometry")) return old;
    retainedEntryWrites += 1;
    return {id: child.id, label: child.label, rect: {x, y: 0, width, height}, children: []};
  });

  const oldRoot = cachedBox(cache.root, boxPathById, nextTree.id);
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
    resolution,
    trackStarts,
    solverPasses: tracksDirty ? 1 : 0,
    visitedNodes: 1 + nextTree.children.length,
    retainedEntryWrites,
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
  // A declared style mutation whose snapshot carries no semantic change (for
  // example a repeated identical value) dirties nothing, so it skips planning.
  const plan = mutation.kind === "style" && boundary.changedNode === null
    ? unchangedStylePlan(graph, mutation)
    : planLayoutInvalidation(graph, mutation);
  if (plan.requiresGraphRebuild) {
    throw new Error("structural mutations require rebuilding the invalidation graph before incremental execution");
  }

  const dirtyPhaseIds = new Set(plan.dirtyPhaseIds);
  const dirtyNodes = dirtyLayoutNodeIds(indexes.layoutNodeIdByPhaseId, plan.dirtyPhaseIds);
  const sets = nodeSets(indexes.nodeIds, indexes.nodeOrderById, dirtyNodes);
  let nextCache: IncrementalLayoutCache;
  let solverPasses: number;
  let visitedNodes: number;
  let retainedEntryWrites: number;

  if (cache.context === "block") {
    const partial = recomputeBlock(cache, nextTree, graph, dirtyPhaseIds, dirtyNodes, indexes.boxPathById);
    nextCache = nextRetainedCache(cache, {context: "block", tree: nextTree, root: partial.root});
    solverPasses = partial.solverPasses;
    visitedNodes = partial.visitedNodes;
    retainedEntryWrites = partial.retainedEntryWrites;
  } else if (cache.context === "flex") {
    const partial = recomputeFlex(cache, nextTree, dirtyPhaseIds, indexes.boxPathById);
    nextCache = nextRetainedCache(cache, {
      context: "flex",
      tree: nextTree,
      root: partial.root,
      flexResolution: partial.resolution,
    });
    solverPasses = partial.solverPasses;
    visitedNodes = partial.visitedNodes;
    retainedEntryWrites = partial.retainedEntryWrites;
  } else {
    const partial = recomputeGrid(cache, nextTree, dirtyPhaseIds, indexes.boxPathById);
    nextCache = nextRetainedCache(cache, {
      context: "grid",
      tree: nextTree,
      root: partial.root,
      gridResolution: partial.resolution,
      gridTrackStarts: partial.trackStarts,
    });
    solverPasses = partial.solverPasses;
    visitedNodes = partial.visitedNodes;
    retainedEntryWrites = partial.retainedEntryWrites;
  }

  const nextGraph = mutation.kind === "style"
    && invalidationGraphNeedsRefresh(graph, mutation, boundary.changedNode)
    ? buildLayoutInvalidationGraph(nextTree)
    : graph;
  const graphRebuilds = nextGraph === graph ? 0 : 1;
  cacheIndexes.set(nextCache, {
    graph: nextGraph,
    nodeIds: indexes.nodeIds,
    nodeOrderById: indexes.nodeOrderById,
    layoutNodeIdByPhaseId: nextGraph === graph
      ? indexes.layoutNodeIdByPhaseId
      : indexLayoutNodesByPhase(nextGraph),
    boxPathById: indexes.boxPathById,
  });

  const result = {
    cache: nextCache,
    plan,
    recomputedNodeIds: sets.recomputedNodeIds,
    reusedNodeIds: [] as readonly string[],
    work: {
      recomputedPhaseCount: plan.dirtyPhaseIds.length,
      reusedPhaseCount: graph.nodes.length - plan.dirtyPhaseIds.length,
      visitedNodes,
      reusedNodes: sets.reusedNodes,
      solverPasses,
      boundaryNodeVisits: boundary.work.nodeVisits,
      provenanceComparisons: boundary.work.provenanceComparisons,
      invalidationPhaseVisits: plan.work.phaseVisits,
      invalidationEdgeTraversals: plan.work.edgeTraversals,
      graphRebuilds,
      retainedEntryWrites,
      reportingNodeVisits: sets.reportingNodeVisits,
    },
  };
  Object.defineProperty(result, "reusedNodeIds", {enumerable: true, get: sets.reusedNodeIds});
  return result;
}
