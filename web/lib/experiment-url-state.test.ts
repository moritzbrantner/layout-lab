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
});
