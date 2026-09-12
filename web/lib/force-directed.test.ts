import {describe, expect, test} from "bun:test";
import {buildForceDirectedFixture, layoutForceDirected} from "./force-directed";

describe("seeded force-directed graph layout", () => {
  test("replays identical geometry and convergence evidence for the same seed", () => {
    const input = buildForceDirectedFixture();
    const first = layoutForceDirected(input);
    const second = layoutForceDirected(input);

    expect(second.initialPositions).toEqual(first.initialPositions);
    expect(second.finalPositions).toEqual(first.finalPositions);
    expect(second.geometry).toEqual(first.geometry);
    expect(second.samples).toEqual(first.samples);
  });

  test("changes the deterministic trajectory when the explicit seed changes", () => {
    const first = layoutForceDirected(buildForceDirectedFixture(20260912));
    const second = layoutForceDirected(buildForceDirectedFixture(20260913));

    expect(second.initialPositions).not.toEqual(first.initialPositions);
    expect(second.finalPositions).not.toEqual(first.finalPositions);
  });

  test("records bounded cooling and convergence samples", () => {
    const result = layoutForceDirected(buildForceDirectedFixture());

    expect(result.samples.map((sample) => sample.iteration)).toEqual([1, 20, 40, 60, 80, 100, 120, 140, 160]);
    for (let index = 1; index < result.samples.length; index += 1) {
      expect(result.samples[index]!.temperature).toBeLessThan(result.samples[index - 1]!.temperature);
    }
    result.samples.forEach((sample) => {
      expect(sample.maxDisplacement).toBeLessThanOrEqual(sample.temperature + 1e-4);
      expect(sample.totalDisplacement).toBeGreaterThanOrEqual(sample.maxDisplacement);
      expect(sample.meanEdgeLength).toBeGreaterThan(0);
    });
    expect(result.samples.at(-1)).toMatchObject({iteration: 160, temperature: 0, maxDisplacement: 0, totalDisplacement: 0});
  });

  test("accounts for every pairwise repulsion and edge attraction evaluation", () => {
    const input = buildForceDirectedFixture();
    const result = layoutForceDirected(input);

    expect(result.repulsionPairs).toBe(28 * 160);
    expect(result.attractionEvaluations).toBe(input.edges.length * 160);
    expect(result.iterations).toBe(160);
    expect(result.characteristicLength).toBeGreaterThan(0);
  });

  test("keeps final node boxes within the declared layout bounds", () => {
    const input = buildForceDirectedFixture();
    const result = layoutForceDirected(input);

    result.geometry.forEach((box) => {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(input.width + 1e-4);
      expect(box.y + box.height).toBeLessThanOrEqual(input.height + 1e-4);
    });
  });

  test("fails closed for invalid graph boundaries", () => {
    const input = buildForceDirectedFixture();
    expect(() => layoutForceDirected({...input, seed: -1})).toThrow("uint32");
    expect(() => layoutForceDirected({...input, edges: [{id: "bad", from: "A", to: "missing"}]})).toThrow("known nodes");
    expect(() => layoutForceDirected({...input, sampleEvery: 0})).toThrow("sampleEvery");
  });
});
