import {validateLayoutTree, type LayoutNode} from "./layout-tree";

export type InvalidationPhase =
  | "inline-size"
  | "block-size"
  | "position"
  | "geometry"
  | "flow"
  | "flex-line"
  | "grid-tracks";

export type InvalidationNode = {
  id: string;
  layoutNodeId: string;
  phase: InvalidationPhase;
  label: string;
};

export type InvalidationEdge = {
  from: string;
  to: string;
  reason: string;
};

export type LayoutInvalidationGraph = {
  rootId: string;
  nodes: readonly InvalidationNode[];
  edges: readonly InvalidationEdge[];
  parentByNodeId: Readonly<Record<string, string | null>>;
  childIdsByNodeId: Readonly<Record<string, readonly string[]>>;
  displayByNodeId: Readonly<Record<string, LayoutNode["style"]["display"]>>;
  autoBlockSizeByNodeId: Readonly<Record<string, boolean>>;
  gridContributionByNodeId: Readonly<Record<string, boolean>>;
};

export type LayoutMutationField =
  | "width"
  | "minWidth"
  | "maxWidth"
  | "height"
  | "minHeight"
  | "maxHeight"
  | "marginBlockBefore"
  | "marginBlockAfter"
  | "flexContainer.gap"
  | "flexItem.basis"
  | "flexItem.grow"
  | "flexItem.shrink"
  | "gridContainer.gap"
  | "gridContainer.columns"
  | "gridItem.columnStart"
  | "gridItem.columnSpan"
  | "gridItem.minContribution";

export type LayoutMutation =
  | {kind: "style"; nodeId: string; field: LayoutMutationField}
  | {kind: "children"; parentId: string; operation: "insert" | "remove" | "reorder"};

export type LayoutInvalidationPlan = {
  mutation: LayoutMutation;
  seedPhaseIds: readonly string[];
  dirtyPhaseIds: readonly string[];
  requiresGraphRebuild: boolean;
};

type InvalidationTraversalIndex = {
  phaseIds: ReadonlySet<string>;
  outgoingByPhaseId: ReadonlyMap<string, readonly string[]>;
};

const traversalIndexes = new WeakMap<LayoutInvalidationGraph, InvalidationTraversalIndex>();

export function invalidationPhaseId(nodeId: string, phase: InvalidationPhase) {
  return `${nodeId}:${phase}`;
}

function addUnique<T>(values: T[], seen: Set<T>, value: T) {
  if (seen.has(value)) return;
  seen.add(value);
  values.push(value);
}

function traversalIndex(graph: LayoutInvalidationGraph): InvalidationTraversalIndex {
  const cached = traversalIndexes.get(graph);
  if (cached) return cached;

  const outgoingByPhaseId = new Map<string, string[]>();
  graph.edges.forEach((edge) => {
    const targets = outgoingByPhaseId.get(edge.from);
    if (targets) targets.push(edge.to);
    else outgoingByPhaseId.set(edge.from, [edge.to]);
  });
  const index = {
    phaseIds: new Set(graph.nodes.map((node) => node.id)),
    outgoingByPhaseId,
  };
  traversalIndexes.set(graph, index);
  return index;
}

export function buildLayoutInvalidationGraph(root: LayoutNode): LayoutInvalidationGraph {
  const errors = validateLayoutTree(root);
  if (errors.length > 0) throw new Error(errors.join("; "));

  const nodes: InvalidationNode[] = [];
  const nodeIds = new Set<string>();
  const edges: InvalidationEdge[] = [];
  const edgeIds = new Set<string>();
  const parentByNodeId: Record<string, string | null> = {};
  const childIdsByNodeId: Record<string, readonly string[]> = {};
  const displayByNodeId: Record<string, LayoutNode["style"]["display"]> = {};
  const autoBlockSizeByNodeId: Record<string, boolean> = {};
  const gridContributionByNodeId: Record<string, boolean> = {};
  const sourceById = new Map<string, LayoutNode>();

  const addPhase = (node: LayoutNode, phase: InvalidationPhase, label: string) => {
    const id = invalidationPhaseId(node.id, phase);
    if (nodeIds.has(id)) return;
    nodeIds.add(id);
    nodes.push({id, layoutNodeId: node.id, phase, label});
  };

  const addEdge = (from: string, to: string, reason: string) => {
    if (!nodeIds.has(from) || !nodeIds.has(to)) {
      throw new Error(`invalidation edge references a missing phase: ${from} -> ${to}`);
    }
    const id = `${from}->${to}`;
    if (edgeIds.has(id)) return;
    edgeIds.add(id);
    edges.push({from, to, reason});
  };

  const indexTree = (node: LayoutNode, parentId: string | null) => {
    sourceById.set(node.id, node);
    parentByNodeId[node.id] = parentId;
    childIdsByNodeId[node.id] = node.children.map((child) => child.id);
    displayByNodeId[node.id] = node.style.display;
    autoBlockSizeByNodeId[node.id] = node.style.height === undefined;
    gridContributionByNodeId[node.id] = node.style.gridItem?.minContribution !== undefined;

    addPhase(node, "inline-size", `${node.label} inline size`);
    addPhase(node, "block-size", `${node.label} block size`);
    addPhase(node, "position", `${node.label} position`);
    addPhase(node, "geometry", `${node.label} geometry`);
    if (node.style.display === "block") addPhase(node, "flow", `${node.label} block flow`);
    if (node.style.display === "flex") addPhase(node, "flex-line", `${node.label} flex line`);
    if (node.style.display === "grid") addPhase(node, "grid-tracks", `${node.label} grid tracks`);
    node.children.forEach((child) => indexTree(child, node.id));
  };
  indexTree(root, null);

  for (const node of sourceById.values()) {
    addEdge(invalidationPhaseId(node.id, "inline-size"), invalidationPhaseId(node.id, "geometry"), "inline size contributes to the final box");
    addEdge(invalidationPhaseId(node.id, "block-size"), invalidationPhaseId(node.id, "geometry"), "block size contributes to the final box");
    addEdge(invalidationPhaseId(node.id, "position"), invalidationPhaseId(node.id, "geometry"), "position contributes to the final box");

    const parentId = parentByNodeId[node.id];
    if (parentId !== null) {
      addEdge(
        invalidationPhaseId(parentId, "position"),
        invalidationPhaseId(node.id, "position"),
        "ancestor position moves descendant absolute geometry",
      );
    }

    if (node.style.display === "block") {
      const flow = invalidationPhaseId(node.id, "flow");
      if (node.style.height === undefined) {
        addEdge(flow, invalidationPhaseId(node.id, "block-size"), "auto block height derives from child flow");
      }

      node.children.forEach((child, index) => {
        if (child.style.width === undefined) {
          addEdge(
            invalidationPhaseId(node.id, "inline-size"),
            invalidationPhaseId(child.id, "inline-size"),
            "auto block width uses the containing inline size",
          );
        }
        addEdge(invalidationPhaseId(child.id, "position"), flow, "child position contributes to block flow extent");
        addEdge(invalidationPhaseId(child.id, "block-size"), flow, "child block size contributes to block flow extent");

        if (index > 0) {
          const previous = node.children[index - 1]!;
          addEdge(
            invalidationPhaseId(previous.id, "position"),
            invalidationPhaseId(child.id, "position"),
            "following block position depends on the previous sibling position",
          );
          addEdge(
            invalidationPhaseId(previous.id, "block-size"),
            invalidationPhaseId(child.id, "position"),
            "following block position depends on the previous sibling block size",
          );
        }
      });
    }

    if (node.style.display === "flex") {
      const line = invalidationPhaseId(node.id, "flex-line");
      addEdge(invalidationPhaseId(node.id, "inline-size"), line, "available main-axis size feeds flex resolution");
      node.children.forEach((child) => {
        addEdge(line, invalidationPhaseId(child.id, "inline-size"), "flex resolution assigns the item main size");
        addEdge(line, invalidationPhaseId(child.id, "position"), "flex resolution and item order assign the item main position");
        if (node.style.height === undefined) {
          addEdge(
            invalidationPhaseId(child.id, "block-size"),
            invalidationPhaseId(node.id, "block-size"),
            "auto flex cross size uses the tallest item",
          );
        }
      });
    }

    if (node.style.display === "grid") {
      const tracks = invalidationPhaseId(node.id, "grid-tracks");
      addEdge(invalidationPhaseId(node.id, "inline-size"), tracks, "available inline size feeds Grid track resolution");
      node.children.forEach((child) => {
        addEdge(tracks, invalidationPhaseId(child.id, "inline-size"), "resolved tracks determine Grid item width");
        addEdge(tracks, invalidationPhaseId(child.id, "position"), "resolved track starts determine Grid item position");
        if (node.style.height === undefined) {
          addEdge(
            invalidationPhaseId(child.id, "block-size"),
            invalidationPhaseId(node.id, "block-size"),
            "auto Grid row height uses the tallest item",
          );
        }
      });
    }
  }

  return {
    rootId: root.id,
    nodes,
    edges,
    parentByNodeId,
    childIdsByNodeId,
    displayByNodeId,
    autoBlockSizeByNodeId,
    gridContributionByNodeId,
  };
}

function requireNode(graph: LayoutInvalidationGraph, nodeId: string) {
  if (!(nodeId in graph.parentByNodeId)) throw new Error(`unknown layout node: ${nodeId}`);
}

function blockMarginSeeds(
  graph: LayoutInvalidationGraph,
  nodeId: string,
  field: "marginBlockBefore" | "marginBlockAfter",
) {
  const parentId = graph.parentByNodeId[nodeId];
  if (parentId === null || parentId === undefined || graph.displayByNodeId[parentId] !== "block") return [];
  const siblings = graph.childIdsByNodeId[parentId] ?? [];
  const index = siblings.indexOf(nodeId);
  if (index < 0) return [];

  if (field === "marginBlockBefore") {
    return [invalidationPhaseId(nodeId, "position")];
  }
  const nextId = siblings[index + 1];
  return nextId
    ? [invalidationPhaseId(nextId, "position")]
    : [invalidationPhaseId(parentId, "flow")];
}

function styleMutationSeeds(graph: LayoutInvalidationGraph, nodeId: string, field: LayoutMutationField) {
  requireNode(graph, nodeId);
  const parentId = graph.parentByNodeId[nodeId];
  const parentDisplay = parentId === null || parentId === undefined ? undefined : graph.displayByNodeId[parentId];
  const ownDisplay = graph.displayByNodeId[nodeId];

  if (field === "height" || field === "minHeight" || field === "maxHeight") {
    return [invalidationPhaseId(nodeId, "block-size")];
  }
  if (field === "marginBlockBefore" || field === "marginBlockAfter") {
    return blockMarginSeeds(graph, nodeId, field);
  }
  if (field === "flexContainer.gap") {
    if (ownDisplay !== "flex") throw new Error(`${nodeId}: flexContainer.gap requires a flex container`);
    return [invalidationPhaseId(nodeId, "flex-line")];
  }
  if (field === "gridContainer.gap" || field === "gridContainer.columns") {
    if (ownDisplay !== "grid") throw new Error(`${nodeId}: ${field} requires a grid container`);
    return [invalidationPhaseId(nodeId, "grid-tracks")];
  }
  if (field === "flexItem.basis" || field === "flexItem.grow" || field === "flexItem.shrink") {
    if (parentDisplay !== "flex") throw new Error(`${nodeId}: ${field} requires a flex-item parent context`);
    return [invalidationPhaseId(parentId!, "flex-line")];
  }
  if (field === "gridItem.minContribution") {
    if (parentDisplay !== "grid") throw new Error(`${nodeId}: ${field} requires a grid-item parent context`);
    return [invalidationPhaseId(parentId!, "grid-tracks")];
  }
  if (field === "gridItem.columnStart" || field === "gridItem.columnSpan") {
    if (parentDisplay !== "grid") throw new Error(`${nodeId}: ${field} requires a grid-item parent context`);
    if (graph.gridContributionByNodeId[nodeId]) {
      return [invalidationPhaseId(parentId!, "grid-tracks")];
    }
    return field === "gridItem.columnStart"
      ? [invalidationPhaseId(nodeId, "inline-size"), invalidationPhaseId(nodeId, "position")]
      : [invalidationPhaseId(nodeId, "inline-size")];
  }

  if (field === "width" || field === "minWidth" || field === "maxWidth") {
    if (parentDisplay === "flex") {
      if (field === "width") return [];
      return [invalidationPhaseId(parentId!, "flex-line")];
    }
    if (parentDisplay === "grid") {
      return [];
    }
    return [invalidationPhaseId(nodeId, "inline-size")];
  }

  return [];
}

function childMutationSeeds(graph: LayoutInvalidationGraph, parentId: string) {
  requireNode(graph, parentId);
  const display = graph.displayByNodeId[parentId];
  if (display === "flex") {
    const seeds = [invalidationPhaseId(parentId, "flex-line")];
    if (graph.autoBlockSizeByNodeId[parentId]) seeds.push(invalidationPhaseId(parentId, "block-size"));
    return seeds;
  }
  if (display === "grid") {
    const seeds = [invalidationPhaseId(parentId, "grid-tracks")];
    if (graph.autoBlockSizeByNodeId[parentId]) seeds.push(invalidationPhaseId(parentId, "block-size"));
    return seeds;
  }

  return [
    invalidationPhaseId(parentId, "flow"),
    ...(graph.childIdsByNodeId[parentId] ?? []).map((childId) => invalidationPhaseId(childId, "position")),
  ];
}

function downstream(graph: LayoutInvalidationGraph, seedIds: readonly string[]) {
  const {phaseIds, outgoingByPhaseId} = traversalIndex(graph);
  const dirty: string[] = [];
  const seen = new Set<string>();
  const queue = [...seedIds];

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]!;
    if (seen.has(current)) continue;
    if (!phaseIds.has(current)) throw new Error(`unknown invalidation phase: ${current}`);
    addUnique(dirty, seen, current);
    (outgoingByPhaseId.get(current) ?? []).forEach((target) => {
      if (!seen.has(target)) queue.push(target);
    });
  }
  return dirty;
}

export function planLayoutInvalidation(graph: LayoutInvalidationGraph, mutation: LayoutMutation): LayoutInvalidationPlan {
  const seedPhaseIds = mutation.kind === "style"
    ? styleMutationSeeds(graph, mutation.nodeId, mutation.field)
    : childMutationSeeds(graph, mutation.parentId);

  return {
    mutation,
    seedPhaseIds,
    dirtyPhaseIds: downstream(graph, seedPhaseIds),
    requiresGraphRebuild: mutation.kind === "children",
  };
}
