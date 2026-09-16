import {describe, expect, test} from "bun:test";
import {buildFlexEngineTree, buildGridEngineTree} from "./layout-engine-fixtures";
import {layoutBlockTree, layoutFlexTree, layoutGridTree, type LayoutBox} from "./layout-engine";
import {createIncrementalLayoutCache, recomputeIncrementalLayout} from "./incremental-layout";
import {buildBlockLayoutTree, buildFlexLayoutTree, type LayoutNode} from "./layout-tree";

function updateNode(root: LayoutNode, nodeId: string, update: (node: LayoutNode) => LayoutNode): LayoutNode {
  if (root.id === nodeId) return update(root);
  return {
    ...root,
    children: root.children.map((child) => updateNode(child, nodeId, update)),
  };
}

function geometry(boxes: readonly LayoutBox[]) {
  return boxes.map((box) => ({id: box.id, ...box.rect}));
}

describe("incremental layout execution", () => {
  test("recomputes only the changed block and later flow after a height mutation", () => {
    const before = buildBlockLayoutTree();
    const cache = createIncrementalLayoutCache(before);
    const next = updateNode(before, "content", (node) => ({
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
    expect(cache.boxes.find((box) => box.id === "content")?.rect.height).toBe(132);
  });

  test("keeps block recomputation to one node even though flow traversal reads cached siblings", () => {
    const before = buildBlockLayoutTree();
    const cache = createIncrementalLayoutCache(before);
    const next = updateNode(before, "content", (node) => ({
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
  });

  test("reruns Flex line resolution for a grow mutation while reusing cross sizes", () => {
    const before = buildFlexEngineTree();
    const cache = createIncrementalLayoutCache(before);
    const next = updateNode(before, "item-b", (node) => ({
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
    const next = updateNode(before, "item-b", (node) => ({
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
    const next = updateNode(before, "item-b", (node) => ({
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
    expect(incremental.cache.root).toBe(cache.root);
  });

  test("reruns Grid track sizing when a spanning contribution changes", () => {
    const before = buildGridEngineTree();
    const cache = createIncrementalLayoutCache(before);
    const next = updateNode(before, "span-ab", (node) => ({
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
    expect(incremental.cache.gridResolution).toEqual(clean.resolution);
    expect(incremental.cache.gridTrackStarts).toEqual(clean.trackStarts);
  });

  test("moves one Grid item from cached tracks without rerunning track sizing", () => {
    const before = buildGridEngineTree();
    const cache = createIncrementalLayoutCache(before);
    const next = updateNode(before, "item-c", (node) => ({
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
    const resizedChild = updateNode(fixedRoot, "child", (node) => ({
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
    expect(second.plan.dirtyPhaseIds).not.toContain("root:block-size");
    expect(second.cache.root.rect.height).toBe(100);
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
