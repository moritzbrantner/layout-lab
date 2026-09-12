import {describe, expect, test} from "bun:test";
import {buildFlexEngineTree, buildGridEngineTree} from "./layout-engine-fixtures";
import {buildBlockLayoutTree} from "./layout-tree";
import {
  buildLayoutInvalidationGraph,
  invalidationPhaseId,
  planLayoutInvalidation,
} from "./layout-invalidation";

function sorted(values: readonly string[]) {
  return [...values].sort();
}

describe("layout invalidation graph", () => {
  test("ties block dependencies to ordered sibling flow and containing inline size", () => {
    const graph = buildLayoutInvalidationGraph(buildBlockLayoutTree());

    expect(graph.rootId).toBe("block-root");
    expect(graph.nodes.some((node) => node.id === "block-root:flow")).toBe(true);
    expect(graph.nodes.some((node) => node.id === "content:flow")).toBe(true);
    expect(graph.edges).toContainEqual({
      from: "block-root:inline-size",
      to: "content:inline-size",
      reason: "auto block width uses the containing inline size",
    });
    expect(graph.edges.some((edge) => edge.from === "header:block-size" && edge.to === "content:position")).toBe(true);
    expect(graph.edges.some((edge) => edge.from === "block-root:geometry" && edge.to === "content:geometry")).toBe(false);
    expect(graph.edges.some((edge) => edge.from === "block-root:position" && edge.to === "content:position")).toBe(true);
  });

  test("keeps a block width mutation local when current numeric flow does not depend on width", () => {
    const graph = buildLayoutInvalidationGraph(buildBlockLayoutTree());
    const plan = planLayoutInvalidation(graph, {kind: "style", nodeId: "content", field: "width"});

    expect(plan.seedPhaseIds).toEqual(["content:inline-size"]);
    expect(sorted(plan.dirtyPhaseIds)).toEqual(sorted([
      "content:inline-size",
      "content:geometry",
    ]));
    expect(plan.requiresGraphRebuild).toBe(false);
  });

  test("propagates a block height mutation only to later siblings and auto-height ancestors", () => {
    const graph = buildLayoutInvalidationGraph(buildBlockLayoutTree());
    const plan = planLayoutInvalidation(graph, {kind: "style", nodeId: "content", field: "height"});

    expect(plan.seedPhaseIds).toEqual(["content:block-size"]);
    expect(sorted(plan.dirtyPhaseIds)).toEqual(sorted([
      "content:block-size",
      "content:geometry",
      "footer:position",
      "footer:geometry",
      "block-root:flow",
      "block-root:block-size",
      "block-root:geometry",
    ]));
    expect(plan.dirtyPhaseIds).not.toContain("header:geometry");
    expect(plan.dirtyPhaseIds).not.toContain("content:inline-size");
  });

  test("starts margin-after invalidation at the next block position", () => {
    const graph = buildLayoutInvalidationGraph(buildBlockLayoutTree());
    const plan = planLayoutInvalidation(graph, {kind: "style", nodeId: "content", field: "marginBlockAfter"});

    expect(plan.seedPhaseIds).toEqual(["footer:position"]);
    expect(plan.dirtyPhaseIds).not.toContain("content:geometry");
    expect(plan.dirtyPhaseIds).toContain("footer:geometry");
    expect(plan.dirtyPhaseIds).toContain("block-root:block-size");
  });

  test("maps flex grow changes to the whole line but not cross sizes", () => {
    const graph = buildLayoutInvalidationGraph(buildFlexEngineTree());
    const plan = planLayoutInvalidation(graph, {kind: "style", nodeId: "item-b", field: "flexItem.grow"});

    expect(plan.seedPhaseIds).toEqual(["root:flex-line"]);
    for (const id of ["item-a", "item-b", "item-c"]) {
      expect(plan.dirtyPhaseIds).toContain(invalidationPhaseId(id, "inline-size"));
      expect(plan.dirtyPhaseIds).toContain(invalidationPhaseId(id, "position"));
      expect(plan.dirtyPhaseIds).toContain(invalidationPhaseId(id, "geometry"));
      expect(plan.dirtyPhaseIds).not.toContain(invalidationPhaseId(id, "block-size"));
    }
    expect(plan.dirtyPhaseIds).not.toContain("root:block-size");
  });

  test("keeps flex item height changes out of main-axis resolution", () => {
    const graph = buildLayoutInvalidationGraph(buildFlexEngineTree());
    const plan = planLayoutInvalidation(graph, {kind: "style", nodeId: "item-b", field: "height"});

    expect(sorted(plan.dirtyPhaseIds)).toEqual(sorted([
      "item-b:block-size",
      "item-b:geometry",
      "root:block-size",
      "root:geometry",
    ]));
    expect(plan.dirtyPhaseIds).not.toContain("root:flex-line");
    expect(plan.dirtyPhaseIds).not.toContain("item-a:geometry");
  });

  test("records properties that the current flex and grid subsets deliberately ignore", () => {
    const flexGraph = buildLayoutInvalidationGraph(buildFlexEngineTree());
    const gridGraph = buildLayoutInvalidationGraph(buildGridEngineTree());

    expect(planLayoutInvalidation(flexGraph, {kind: "style", nodeId: "item-b", field: "width"}).dirtyPhaseIds).toEqual([]);
    expect(planLayoutInvalidation(gridGraph, {kind: "style", nodeId: "item-c", field: "maxWidth"}).dirtyPhaseIds).toEqual([]);
  });

  test("maps a Grid contribution change through track sizing and item geometry", () => {
    const graph = buildLayoutInvalidationGraph(buildGridEngineTree());
    const plan = planLayoutInvalidation(graph, {kind: "style", nodeId: "item-c", field: "gridItem.minContribution"});

    expect(plan.seedPhaseIds).toEqual(["root:grid-tracks"]);
    expect(plan.dirtyPhaseIds).toContain("item-a:inline-size");
    expect(plan.dirtyPhaseIds).toContain("item-b:position");
    expect(plan.dirtyPhaseIds).toContain("item-c:geometry");
    expect(plan.dirtyPhaseIds).not.toContain("root:block-size");
  });

  test("requires graph rebuild for child-list mutations and dirties the current formatting context", () => {
    const blockGraph = buildLayoutInvalidationGraph(buildBlockLayoutTree());
    const flexGraph = buildLayoutInvalidationGraph(buildFlexEngineTree());

    const blockPlan = planLayoutInvalidation(blockGraph, {kind: "children", parentId: "block-root", operation: "reorder"});
    expect(blockPlan.requiresGraphRebuild).toBe(true);
    expect(blockPlan.seedPhaseIds).toEqual([
      "block-root:flow",
      "header:position",
      "content:position",
      "footer:position",
    ]);
    expect(blockPlan.dirtyPhaseIds).toContain("block-root:block-size");
    expect(blockPlan.dirtyPhaseIds).toContain("footer:geometry");

    const flexPlan = planLayoutInvalidation(flexGraph, {kind: "children", parentId: "root", operation: "insert"});
    expect(flexPlan.requiresGraphRebuild).toBe(true);
    expect(flexPlan.seedPhaseIds).toEqual(["root:flex-line", "root:block-size"]);
    expect(flexPlan.dirtyPhaseIds).toContain("item-a:position");
  });

  test("fails closed when a mutation is incompatible with its formatting context", () => {
    const graph = buildLayoutInvalidationGraph(buildBlockLayoutTree());

    expect(() => planLayoutInvalidation(graph, {kind: "style", nodeId: "content", field: "flexItem.grow"}))
      .toThrow("flex-item parent context");
    expect(() => planLayoutInvalidation(graph, {kind: "style", nodeId: "missing", field: "height"}))
      .toThrow("unknown layout node: missing");
  });
});
