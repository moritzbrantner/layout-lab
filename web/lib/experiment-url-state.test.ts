import {describe, expect, test} from "bun:test";
import {
  experimentUrlSchemas,
  normalizeExperimentUrlValue,
  readExperimentUrlState,
  writeExperimentUrlState,
} from "./experiment-url-state";

describe("experiment URL state", () => {
  test("reads valid values and falls back for invalid or out-of-range values", () => {
    const schema = experimentUrlSchemas.flex!;
    const state = readExperimentUrlState(
      "?flex.direction=column&flex.gap=24&flex.grow=1&flex.align=invalid",
      "flex",
      schema,
    );

    expect(state).toEqual({
      direction: "column",
      justify: "space-between",
      align: "center",
      gap: "24",
      grow: "1",
    });
  });

  test("writes only non-default values while preserving unrelated query state", () => {
    const schema = experimentUrlSchemas.grid!;
    const search = writeExperimentUrlState(
      "?utm=docs&flex.gap=20&grid.columns=5&grid.gap=22",
      "grid",
      schema,
      {columns: "4", gap: "14", dense: "1"},
    );

    const params = new URLSearchParams(search);
    expect(params.get("utm")).toBe("docs");
    expect(params.get("flex.gap")).toBe("20");
    expect(params.get("grid.columns")).toBe("4");
    expect(params.has("grid.gap")).toBe(false);
    expect(params.get("grid.dense")).toBe("1");
  });

  test("normalizes boolean aliases and rejects values outside the declared slider step", () => {
    const flex = experimentUrlSchemas.flex!;
    const grow = flex.find((control) => control.key === "grow")!;
    const gap = flex.find((control) => control.key === "gap")!;

    expect(normalizeExperimentUrlValue(grow, "true")).toBe("1");
    expect(normalizeExperimentUrlValue(grow, "false")).toBe("0");
    expect(normalizeExperimentUrlValue(gap, "12.5")).toBeUndefined();
    expect(normalizeExperimentUrlValue(gap, "41")).toBeUndefined();
  });

  test("accepts fractional controls on their exact declared step", () => {
    const schema = experimentUrlSchemas.positioning!;
    const scale = schema.find((control) => control.key === "scale")!;

    expect(normalizeExperimentUrlValue(scale, "1.15")).toBe("1.15");
    expect(normalizeExperimentUrlValue(scale, "1.17")).toBeUndefined();
  });

  test("persists the algorithm zoo selector and shared explorer dimensions", () => {
    const schema = experimentUrlSchemas["algorithm-pipeline"]!;
    const search = writeExperimentUrlState(
      "?utm=lab",
      "algorithm-pipeline",
      schema,
      {width: "640", gap: "20", algorithm: "graph-force"},
    );
    const state = readExperimentUrlState(search, "algorithm-pipeline", schema);

    expect(state).toEqual({width: "640", gap: "20", algorithm: "graph-force"});
    expect(new URLSearchParams(search).get("utm")).toBe("lab");
  });

  test("accepts all currently registered non-default algorithm families", () => {
    const schema = experimentUrlSchemas["algorithm-pipeline"]!;
    const algorithm = schema.find((control) => control.key === "algorithm")!;

    expect(normalizeExperimentUrlValue(algorithm, "constraint-cassowary")).toBe("constraint-cassowary");
    expect(normalizeExperimentUrlValue(algorithm, "line-greedy")).toBe("line-greedy");
    expect(normalizeExperimentUrlValue(algorithm, "line-knuth-plass")).toBe("line-knuth-plass");
    expect(normalizeExperimentUrlValue(algorithm, "packing-shortest-column")).toBe("packing-shortest-column");
    expect(normalizeExperimentUrlValue(algorithm, "packing-first-fit")).toBe("packing-first-fit");
    expect(normalizeExperimentUrlValue(algorithm, "tree-tidy")).toBe("tree-tidy");
    expect(normalizeExperimentUrlValue(algorithm, "dag-sugiyama")).toBe("dag-sugiyama");
    expect(normalizeExperimentUrlValue(algorithm, "graph-force")).toBe("graph-force");
  });

  test("rejects unknown algorithm zoo ids from URL state", () => {
    const schema = experimentUrlSchemas["algorithm-pipeline"]!;
    const state = readExperimentUrlState(
      "?algorithm-pipeline.algorithm=not-real",
      "algorithm-pipeline",
      schema,
    );

    expect(state.algorithm).toBe("block-flow");
  });
});
