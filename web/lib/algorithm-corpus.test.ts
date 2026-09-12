import {describe, expect, test} from "bun:test";
import {algorithmCorpusCases} from "./algorithm-corpus";

describe("algorithm corpus", () => {
  test("keeps every expected geometry fixture green", () => {
    expect(algorithmCorpusCases.map((fixture) => [fixture.id, fixture.passes])).toEqual([
      ["flex-grow-evenly", true],
      ["flex-shrink-min-clamp", true],
      ["grid-minimum-freeze", true],
      ["grid-spanning-minimum", true],
    ]);
  });

  test("covers iterative flex and grid minimum behavior", () => {
    expect(algorithmCorpusCases.find((fixture) => fixture.id === "flex-shrink-min-clamp")?.actualGeometry)
      .toEqual(["A: 150px", "B: 90px"]);
    expect(algorithmCorpusCases.find((fixture) => fixture.id === "grid-minimum-freeze")?.actualGeometry)
      .toEqual(["A: 180px", "B: 110px"]);
  });

  test("uses stable unique fixture ids", () => {
    const ids = algorithmCorpusCases.map((fixture) => fixture.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
