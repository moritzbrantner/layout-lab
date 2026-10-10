import {describe, expect, test} from "bun:test";
import {buildFlexEngineTree, buildGridEngineTree} from "./layout-engine-fixtures";
import {layoutBlockTree, layoutFlexTree, layoutGridTree, type LayoutBox} from "./layout-engine";
import {
  createIncrementalLayoutCache,
  recomputeIncrementalLayout,
  type IncrementalLayoutCache,
  type IncrementalLayoutResult,
} from "./incremental-layout";
import {buildLayoutInvalidationGraph, type LayoutMutation} from "./layout-invalidation";
import {buildBlockLayoutTree, buildFlexLayoutTree, updateLayoutNode, type LayoutNode} from "./layout-tree";

function geometry(boxes: readonly LayoutBox[]) {
  return boxes.map((box) => ({id: box.id, ...box.rect}));
}

describe("incremental layout execution", () => {
  test("recomputes only the changed block and later flow after a height mutation", () => {
    const before = buildBlockLayoutTree();
    const cache = createIncrementalLayoutCache(before);
    const next = updateLayoutNode(before, "content", (node) => ({
      ...node,
      style: {...node.style, height: 180},
    }));

    const incremental = recomputeIncrementalLayout(cache, next, {
      kind: "style",
      nodeId: "content",
      field: "height",
    });
    const clean = layoutBlockTree(next);

    expect(geometry(incremental.cache.boxes)).toEqual(geometry(clean.boxes));
    expect(incremental.recomputedNodeIds).toEqual(["block-root", "content", "footer"]);
    expect(incremental.reusedNodeIds).toEqual(["header"]);
    expect(incremental.work.visitedNodes).toBe(4);
    expect(incremental.work.reusedNodes).toBe(1);
    expect(incremental.work.solverPasses).toBe(0);
    expect(incremental.work.boundaryNodeVisits).toBeGreaterThan(0);
    expect(incremental.work.provenanceComparisons).toBeGreaterThan(0);
    expect(incremental.work.invalidationPhaseVisits).toBe(incremental.plan.dirtyPhaseIds.length);
    expect(incremental.work.invalidationEdgeTraversals).toBeGreaterThan(0);
    expect(incremental.work.graphRebuilds).toBe(0);
    expect(cache.boxes.find((box) => box.id === "content")?.rect.height).toBe(132);
  });

  test("keeps block recomputation to one node even though flow traversal reads cached siblings", () => {
    const before = buildBlockLayoutTree();
    const cache = createIncrementalLayoutCache(before);
    const next = updateLayoutNode(before, "content", (node) => ({
      ...node,
      style: {...node.style, width: 300},
    }));

    const incremental = recomputeIncrementalLayout(cache, next, {
      kind: "style",
      nodeId: "content",
      field: "width",
    });
    const clean = layoutBlockTree(next);

    expect(geometry(incremental.cache.boxes)).toEqual(geometry(clean.boxes));
    expect(incremental.recomputedNodeIds).toEqual(["content"]);
    expect(incremental.reusedNodeIds).toEqual(["block-root", "header", "footer"]);
    expect(incremental.work.visitedNodes).toBe(4);
    expect(incremental.work.graphRebuilds).toBe(1);
  });

  test("reruns Flex line resolution for a grow mutation while reusing cross sizes", () => {
    const before = buildFlexEngineTree();
    const cache = createIncrementalLayoutCache(before);
    const next = updateLayoutNode(before, "item-b", (node) => ({
      ...node,
      style: {...node.style, flexItem: {...node.style.flexItem!, grow: 3}},
    }));

    const incremental = recomputeIncrementalLayout(cache, next, {
      kind: "style",
      nodeId: "item-b",
      field: "flexItem.grow",
    });
    const clean = layoutFlexTree(next);

    expect(geometry(incremental.cache.boxes)).toEqual(geometry(clean.boxes));
    expect(incremental.work.solverPasses).toBeGreaterThan(0);
    expect(incremental.work.visitedNodes).toBe(4);
    expect(incremental.plan.dirtyPhaseIds).not.toContain("item-a:block-size");
    expect(incremental.plan.dirtyPhaseIds).not.toContain("root:block-size");
    expect(incremental.cache.flexResolution).toEqual(clean.resolution);
  });

  test("updates a Flex cross size without rerunning the main-axis solver", () => {
    const before = buildFlexLayoutTree();
    const cache = createIncrementalLayoutCache(before);
    const next = updateLayoutNode(before, "item-b", (node) => ({
      ...node,
      style: {...node.style, height: 104},
    }));

    const incremental = recomputeIncrementalLayout(cache, next, {
      kind: "style",
      nodeId: "item-b",
      field: "height",
    });
    const clean = layoutFlexTree(next);

    expect(geometry(incremental.cache.boxes)).toEqual(geometry(clean.boxes));
    expect(incremental.recomputedNodeIds).toEqual(["root", "item-b"]);
    expect(incremental.work.visitedNodes).toBe(4);
    expect(incremental.work.solverPasses).toBe(0);
    expect(incremental.plan.dirtyPhaseIds).not.toContain("root:flex-line");
  });

  test("does zero layout work for a property ignored by the current Flex subset", () => {
    const before = buildFlexEngineTree();
    const cache = createIncrementalLayoutCache(before);
    const next = updateLayoutNode(before, "item-b", (node) => ({
      ...node,
      style: {...node.style, width: 999},
    }));

    const incremental = recomputeIncrementalLayout(cache, next, {
      kind: "style",
      nodeId: "item-b",
      field: "width",
    });
    const clean = layoutFlexTree(next);

    expect(geometry(incremental.cache.boxes)).toEqual(geometry(clean.boxes));
    expect(incremental.plan.dirtyPhaseIds).toEqual([]);
    expect(incremental.work.visitedNodes).toBe(0);
    expect(incremental.work.solverPasses).toBe(0);
    expect(incremental.work.invalidationPhaseVisits).toBe(0);
    expect(incremental.work.invalidationEdgeTraversals).toBe(0);
    expect(incremental.work.graphRebuilds).toBe(0);
    expect(incremental.cache.root).toBe(cache.root);
  });

  test("reruns Grid track sizing when a spanning contribution changes", () => {
    const before = buildGridEngineTree();
    const cache = createIncrementalLayoutCache(before);
    const next = updateLayoutNode(before, "span-ab", (node) => ({
      ...node,
      style: {
        ...node.style,
        gridItem: {...node.style.gridItem!, minContribution: 340},
      },
    }));

    const incremental = recomputeIncrementalLayout(cache, next, {
      kind: "style",
      nodeId: "span-ab",
      field: "gridItem.minContribution",
    });
    const clean = layoutGridTree(next);

    expect(geometry(incremental.cache.boxes)).toEqual(geometry(clean.boxes));
    expect(incremental.work.visitedNodes).toBe(3);
    expect(incremental.work.solverPasses).toBe(1);
    expect(incremental.work.graphRebuilds).toBe(0);
    expect(incremental.cache.gridResolution).toEqual(clean.resolution);
    expect(incremental.cache.gridTrackStarts).toEqual(clean.trackStarts);
  });

  test("accepts a declared Grid track-list mutation as one semantic field", () => {
    const before = buildGridEngineTree();
    const cache = createIncrementalLayoutCache(before);
    const columns = before.style.gridContainer!.columns.map((track, index) => (
      index === 0 ? {...track, minSize: track.minSize + 12} : track
    ));
    const next: LayoutNode = {
      ...before,
      style: {
        ...before.style,
        gridContainer: {...before.style.gridContainer!, columns},
      },
    };

    const incremental = recomputeIncrementalLayout(cache, next, {
      kind: "style",
      nodeId: "root",
      field: "gridContainer.columns",
    });
    const clean = layoutGridTree(next);

    expect(geometry(incremental.cache.boxes)).toEqual(geometry(clean.boxes));
    expect(incremental.work.solverPasses).toBe(1);
  });

  test("moves one Grid item from cached tracks without rerunning track sizing", () => {
    const before = buildGridEngineTree();
    const cache = createIncrementalLayoutCache(before);
    const next = updateLayoutNode(before, "item-c", (node) => ({
      ...node,
      style: {
        ...node.style,
        gridItem: {...node.style.gridItem!, columnStart: 1},
      },
    }));

    const incremental = recomputeIncrementalLayout(cache, next, {
      kind: "style",
      nodeId: "item-c",
      field: "gridItem.columnStart",
    });
    const clean = layoutGridTree(next);

    expect(geometry(incremental.cache.boxes)).toEqual(geometry(clean.boxes));
    expect(incremental.recomputedNodeIds).toEqual(["item-c"]);
    expect(incremental.reusedNodeIds).toEqual(["root", "span-ab"]);
    expect(incremental.work.visitedNodes).toBe(3);
    expect(incremental.work.solverPasses).toBe(0);
    expect(incremental.cache.gridResolution).toBe(cache.gridResolution);
  });

  test("refreshes cached dependencies after auto block sizing becomes explicit", () => {
    const before: LayoutNode = {
      id: "root",
      label: "Root",
      style: {display: "block", width: 320},
      children: [
        {
          id: "child",
          label: "Child",
          style: {display: "block", height: 20},
          children: [],
        },
      ],
    };
    const cache = createIncrementalLayoutCache(before);
    const fixedRoot = {...before, style: {...before.style, height: 100}};
    const first = recomputeIncrementalLayout(cache, fixedRoot, {
      kind: "style",
      nodeId: "root",
      field: "height",
    });
    const resizedChild = updateLayoutNode(fixedRoot, "child", (node) => ({
      ...node,
      style: {...node.style, height: 40},
    }));

    const second = recomputeIncrementalLayout(first.cache, resizedChild, {
      kind: "style",
      nodeId: "child",
      field: "height",
    });
    const clean = layoutBlockTree(resizedChild);

    expect(geometry(second.cache.boxes)).toEqual(geometry(clean.boxes));
    expect(first.work.graphRebuilds).toBe(1);
    expect(second.work.graphRebuilds).toBe(0);
    expect(second.plan.dirtyPhaseIds).not.toContain("root:block-size");
    expect(second.cache.root.rect.height).toBe(100);
  });

  test("fails closed for an invalid style on a structurally shared mutation path", () => {
    const before = buildBlockLayoutTree();
    const cache = createIncrementalLayoutCache(before);
    const next = updateLayoutNode(before, "content", (node) => ({
      ...node,
      style: {...node.style, marginBlockBefore: -1},
    }));

    expect(() => recomputeIncrementalLayout(cache, next, {
      kind: "style",
      nodeId: "content",
      field: "marginBlockBefore",
    })).toThrow("marginBlockBefore must be finite and non-negative");
  });

  test("fails closed when the declared mutation does not match the tree diff", () => {
    const before = buildFlexEngineTree();
    const cache = createIncrementalLayoutCache(before);
    const next = updateLayoutNode(before, "item-b", (node) => ({
      ...node,
      style: {...node.style, flexItem: {...node.style.flexItem!, grow: 3}},
    }));

    expect(() => recomputeIncrementalLayout(cache, next, {
      kind: "style",
      nodeId: "item-b",
      field: "height",
    })).toThrow("declared style mutation item-b.height does not match layout-tree change: item-b.flexItem.grow");
  });

  test("fails closed when a style mutation is paired with a structural change", () => {
    const before = buildFlexEngineTree();
    const cache = createIncrementalLayoutCache(before);
    const next = {...before, children: [...before.children].reverse()};

    expect(() => recomputeIncrementalLayout(cache, next, {
      kind: "style",
      nodeId: "item-b",
      field: "height",
    })).toThrow("unchanged layout-tree shape");
  });

  test("fails closed for structural changes until the graph is rebuilt", () => {
    const before = buildFlexEngineTree();
    const cache = createIncrementalLayoutCache(before);
    const next = {...before, children: [...before.children].reverse()};

    expect(() => recomputeIncrementalLayout(cache, next, {
      kind: "children",
      parentId: "root",
      operation: "reorder",
    })).toThrow("structural mutations require rebuilding the invalidation graph");
  });
});

type ChainStep = {
  mutation: Extract<LayoutMutation, {kind: "style"}>;
  apply: (tree: LayoutNode) => LayoutNode;
  /** A fresh style object with unchanged semantics: no retained work allowed. */
  noop?: boolean;
};

function restyle(nodeId: string, update: (style: LayoutNode["style"]) => LayoutNode["style"]) {
  return (tree: LayoutNode) => updateLayoutNode(tree, nodeId, (node) => ({...node, style: update(node.style)}));
}

function cleanLayout(tree: LayoutNode) {
  if (tree.style.display === "block") return layoutBlockTree(tree);
  if (tree.style.display === "flex") return layoutFlexTree(tree);
  return layoutGridTree(tree);
}

/** Reporting expected from first principles: graph node order partitioned by the dirty set. */
function expectedReporting(previousTree: LayoutNode, result: IncrementalLayoutResult) {
  const graph = buildLayoutInvalidationGraph(previousTree);
  const layoutNodeIdByPhase = new Map(graph.nodes.map((node) => [node.id, node.layoutNodeId]));
  const dirty = new Set(result.plan.dirtyPhaseIds.map((phaseId) => layoutNodeIdByPhase.get(phaseId)));
  const order = [...new Set(graph.nodes.map((node) => node.layoutNodeId))];
  return {
    recomputedNodeIds: order.filter((id) => dirty.has(id)),
    reusedNodeIds: order.filter((id) => !dirty.has(id)),
  };
}

function changedBoxCount(previous: IncrementalLayoutCache, next: IncrementalLayoutCache) {
  const before = new Map(previous.boxes.map((box) => [box.id, JSON.stringify(box.rect)]));
  return next.boxes.filter((box) => before.get(box.id) !== JSON.stringify(box.rect)).length;
}

function runEquivalenceChain(initial: LayoutNode, steps: readonly ChainStep[]) {
  let cache = createIncrementalLayoutCache(initial);
  const history: Array<{cache: IncrementalLayoutCache; boxes: readonly LayoutBox[]}> = [];
  steps.forEach((step, index) => {
    const label = `step ${index + 1} (${step.mutation.nodeId}.${step.mutation.field})`;
    const nextTree = step.apply(cache.tree);
    const result = recomputeIncrementalLayout(cache, nextTree, step.mutation);
    const clean = cleanLayout(nextTree);

    // Observable output is exactly the clean layout, in clean pre-order flatten order.
    expect(result.cache.boxes, label).toEqual(clean.boxes);
    expect(result.cache.root, label).toEqual(clean.root);
    expect(result.cache.boxes.map((box) => box.id), label).toEqual(clean.boxes.map((box) => box.id));

    // Reuse reporting keeps its contents and order.
    const expected = expectedReporting(cache.tree, result);
    expect([...result.recomputedNodeIds], label).toEqual(expected.recomputedNodeIds);
    expect([...result.reusedNodeIds], label).toEqual(expected.reusedNodeIds);
    expect(result.work.reusedNodes, label).toBe(expected.reusedNodeIds.length);

    // Retained-state work is reported as deterministic evidence.
    const {retainedEntryWrites, reportingNodeVisits} = result.work;
    expect(Number.isInteger(retainedEntryWrites) && retainedEntryWrites >= 0, `${label} retainedEntryWrites`).toBe(true);
    expect(Number.isInteger(reportingNodeVisits) && reportingNodeVisits >= 0, `${label} reportingNodeVisits`).toBe(true);
    if (step.noop) {
      expect(result.plan.dirtyPhaseIds, label).toEqual([]);
      expect(retainedEntryWrites, label).toBe(0);
      expect(reportingNodeVisits, label).toBe(0);
    } else {
      // Every box whose geometry changed must have been written to retained storage.
      expect(retainedEntryWrites, label).toBeGreaterThanOrEqual(changedBoxCount(cache, result.cache));
    }

    history.push({cache: result.cache, boxes: structuredClone(clean.boxes)});
    cache = result.cache;
  });

  // Retained storage shared between steps must not leak later writes into earlier caches.
  history.forEach(({cache: earlier, boxes}, index) => {
    expect(earlier.boxes, `cache of step ${index + 1} after the chain`).toEqual(boxes);
  });
}

describe("retained box storage and reuse reporting stay equivalent to clean layout", () => {
  test("block mutation chain", () => {
    runEquivalenceChain(buildBlockLayoutTree(), [
      {mutation: {kind: "style", nodeId: "content", field: "height"}, apply: restyle("content", (style) => ({...style, height: 180}))},
      {mutation: {kind: "style", nodeId: "content", field: "width"}, apply: restyle("content", (style) => ({...style, width: 300}))},
      {mutation: {kind: "style", nodeId: "footer", field: "marginBlockBefore"}, apply: restyle("footer", (style) => ({...style, marginBlockBefore: 8}))},
      {mutation: {kind: "style", nodeId: "header", field: "height"}, apply: restyle("header", (style) => ({...style})), noop: true},
      {mutation: {kind: "style", nodeId: "block-root", field: "width"}, apply: restyle("block-root", (style) => ({...style, width: 400}))},
      {mutation: {kind: "style", nodeId: "header", field: "height"}, apply: restyle("header", (style) => ({...style, height: 30}))},
      {mutation: {kind: "style", nodeId: "content", field: "height"}, apply: restyle("content", (style) => ({...style, height: 132}))},
    ]);
  });

  test("flex mutation chain", () => {
    runEquivalenceChain(buildFlexEngineTree(), [
      {
        mutation: {kind: "style", nodeId: "item-b", field: "flexItem.grow"},
        apply: restyle("item-b", (style) => ({...style, flexItem: {...style.flexItem!, grow: 3}})),
      },
      {mutation: {kind: "style", nodeId: "item-b", field: "height"}, apply: restyle("item-b", (style) => ({...style, height: 90}))},
      {mutation: {kind: "style", nodeId: "item-a", field: "height"}, apply: restyle("item-a", (style) => ({...style})), noop: true},
      {mutation: {kind: "style", nodeId: "item-a", field: "height"}, apply: restyle("item-a", (style) => ({...style, height: 60}))},
      {
        mutation: {kind: "style", nodeId: "item-b", field: "flexItem.grow"},
        apply: restyle("item-b", (style) => ({...style, flexItem: {...style.flexItem!, grow: 1}})),
      },
    ]);
  });

  test("grid mutation chain", () => {
    runEquivalenceChain(buildGridEngineTree(), [
      {
        mutation: {kind: "style", nodeId: "span-ab", field: "gridItem.minContribution"},
        apply: restyle("span-ab", (style) => ({...style, gridItem: {...style.gridItem!, minContribution: 340}})),
      },
      {
        mutation: {kind: "style", nodeId: "item-c", field: "gridItem.columnStart"},
        apply: restyle("item-c", (style) => ({...style, gridItem: {...style.gridItem!, columnStart: 1}})),
      },
      {mutation: {kind: "style", nodeId: "item-c", field: "height"}, apply: restyle("item-c", (style) => ({...style})), noop: true},
      {mutation: {kind: "style", nodeId: "item-c", field: "height"}, apply: restyle("item-c", (style) => ({...style, height: 50}))},
      {
        mutation: {kind: "style", nodeId: "root", field: "gridContainer.columns"},
        apply: restyle("root", (style) => ({
          ...style,
          gridContainer: {
            ...style.gridContainer!,
            columns: style.gridContainer!.columns.map((track, index) => (
              index === 0 ? {...track, minSize: track.minSize + 12} : track
            )),
          },
        })),
      },
    ]);
  });
});
