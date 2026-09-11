import {describe, expect, test} from "bun:test";
import {readFileSync} from "node:fs";
import {join} from "node:path";

describe("flow formatting inline authority", () => {
  test("does not introduce a deterministic inline-layout solver", () => {
    const library = readFileSync(join(import.meta.dir, "../lib/flow-formatting.ts"), "utf8");

    expect(library).toContain("resolveAdjacentPositiveMargins");
    expect(library).not.toContain("resolveInline");
    expect(library).not.toContain("glyph");
  });
});
