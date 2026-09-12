import {describe, expect, test} from "bun:test";
import {buildSugiyamaFixture, layoutSugiyama} from "./sugiyama";

describe("Sugiyama-style layered DAG layout", () => {
  test("assigns deterministic longest-path ranks and inserts dummy vertices for long edges", () => {
    const result = layoutSugiyama(buildSugiyamaFixture());
    const rank = new Map(result.ranks.map((entry) => [entry.nodeId, entry.rank]));

    expect([...rank.entries()]).toEqual([
      ["A", 0], ["B", 0], ["C", 0],
      ["D", 1], ["E", 1], ["F", 1],
      ["G", 2], ["H", 2], ["I", 3],
    ]);
    expect(result.dummyCount).toBe(2);
    expect(result.segmentCount).toBe(11);
    expect(result.layerOrders[1]).toContain("__dummy:a-i:1");
    expect(result.layerOrders[2]).toContain("__dummy:a-i:2");
  });

  test("reduces the fixture from seven crossings to zero with the first barycenter sweep", () => {
    const result = layoutSugiyama(buildSugiyamaFixture());

    expect(result.initialCrossings).toBe(7);
    expect(result.finalCrossings).toBe(0);
    expect(result.sweeps[0]).toEqual({
      iteration: 1,
      direction: "down",
      crossingsBefore: 7,
      crossingsAfter: 0,
      changedLayers: 2,
    });
    expect(result.layerOrders).toEqual([
      ["A", "B", "C"],
      ["F", "__dummy:a-i:1", "E", "D"],
      ["G", "__dummy:a-i:2", "H"],
      ["I"],
    ]);
    expect(result.crossingComparisons).toBe(140);
  });

  test("assigns centered deterministic coordinates after crossing reduction", () => {
    const result = layoutSugiyama(buildSugiyamaFixture());
    const geometry = new Map(result.geometry.map((box) => [box.id, box]));

    expect(result.drawingWidth).toBe(276);
    expect(result.drawingHeight).toBe(284);
    expect(geometry.get("A")).toEqual({id: "A", x: 38, y: 0, width: 48, height: 32});
    expect(geometry.get("F")).toEqual({id: "F", x: 0, y: 84, width: 48, height: 32});
    expect(geometry.get("D")).toEqual({id: "D", x: 228, y: 84, width: 48, height: 32});
    expect(geometry.get("I")).toEqual({id: "I", x: 114, y: 252, width: 48, height: 32});
    expect(geometry.get("__dummy:a-i:1")).toEqual({id: "__dummy:a-i:1", x: 95, y: 95, width: 10, height: 10});
  });

  test("is deterministic across repeated runs", () => {
    const first = layoutSugiyama(buildSugiyamaFixture());
    const second = layoutSugiyama(buildSugiyamaFixture());

    expect(second.layerOrders).toEqual(first.layerOrders);
    expect(second.geometry).toEqual(first.geometry);
    expect(second.sweeps).toEqual(first.sweeps);
  });

  test("fails closed for cycles and unknown endpoints", () => {
    const fixture = buildSugiyamaFixture();
    expect(() => layoutSugiyama({
      ...fixture,
      nodes: [{id: "A"}, {id: "B"}],
      edges: [
        {id: "a-b", from: "A", to: "B"},
        {id: "b-a", from: "B", to: "A"},
      ],
    })).toThrow("acyclic graph");

    expect(() => layoutSugiyama({
      ...fixture,
      nodes: [{id: "A"}],
      edges: [{id: "missing", from: "A", to: "B"}],
    })).toThrow("known nodes");
  });
});
