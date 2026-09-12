import {describe, expect, test} from "bun:test";
import {solveConstraintLayout} from "./constraint-layout";

describe("constraint layout fixture", () => {
  test("uses required adjacency while stronger preferences win conflicting softer preferences", () => {
    const result = solveConstraintLayout(640, 16);

    expect(result.geometry).toEqual([
      {id: "constraint-root", x: 0, y: 0, width: 640, height: 140},
      {id: "panel-a", x: 0, y: 0, width: 249.6, height: 140},
      {id: "panel-b", x: 265.6, y: 0, width: 374.4, height: 140},
    ]);
    expect(result.diagnostics).toContain("medium B width preference: 62.4px residual");
    expect(result.diagnostics).toContain("weak divider position preference: 54.4px residual");
    expect(result.diagnostics.some((message) => message.startsWith("strong A width preference"))).toBe(false);
  });

  test("shows incremental reoptimization when a temporary required cap is removed", () => {
    const result = solveConstraintLayout(640, 16);
    const capped = result.snapshots.find((snapshot) => snapshot.operation === "temporary A width cap" && snapshot.kind === "add");
    const restored = result.snapshots.find((snapshot) => snapshot.operation === "temporary A width cap" && snapshot.kind === "remove");

    expect(capped).toMatchObject({panelAWidth: 225.6, panelBLeft: 241.6, panelBWidth: 398.4});
    expect(restored).toMatchObject({panelAWidth: 249.6, panelBLeft: 265.6, panelBWidth: 374.4});
    expect(result.operations).toHaveLength(10);
    expect(result.constraints).toBe(8);
    expect(result.pivots).toBeGreaterThan(0);
  });

  test("rejects fixture sizes that cannot satisfy the required panel minimums", () => {
    expect(() => solveConstraintLayout(400, 16)).toThrow("at least 420px");
    expect(() => solveConstraintLayout(640, 400)).toThrow("room for both panels");
  });
});
