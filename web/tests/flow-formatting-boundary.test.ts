import {describe, expect, test} from "bun:test";
import {readFileSync} from "node:fs";
import {join} from "node:path";

describe("flow formatting explanatory boundary", () => {
  test("keeps the deterministic model scoped and browser line breaking authoritative", () => {
    const component = readFileSync(join(import.meta.dir, "../components/FlowFormattingExperiment.tsx"), "utf8");

    expect(component).toContain("two positive vertical sibling margins only");
    expect(component).toContain("getClientRects()");
    expect(component).toContain("line-box construction stay browser-owned");
    expect(component).not.toContain("measureText(");
  });
});
