import {describe, expect, test} from "bun:test";
import {readFileSync} from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dir, "../..");
const workflow = readFileSync(path.join(root, ".github/workflows/browser-conformance.yml"), "utf8");
const runner = readFileSync(path.join(root, "web/scripts/browser-conformance.mjs"), "utf8");

describe("browser conformance CI contract", () => {
  test("runs the same corpus in Chromium, Firefox, and WebKit with pinned tooling", () => {
    expect(workflow).toContain("browser: [chromium, firefox, webkit]");
    expect(workflow).toContain("playwright@1.63.0");
    expect(workflow).toContain('LAYOUT_CONFORMANCE_SEED: "12648430"');
    expect(workflow).toContain('LAYOUT_CONFORMANCE_CASES: "16"');
    expect(workflow).toContain("actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f");
  });

  test("captures real browser geometry and emits replay evidence only on mismatch", () => {
    expect(runner).toContain("getBoundingClientRect");
    expect(runner).toContain("createLayoutDifferentialCorpus");
    expect(runner).toContain("generateLayoutDifferentialCases");
    expect(runner).toContain("minimizeGeneratedLayoutMismatchAsync");
    expect(runner).toContain("createBrowserConformanceEvidence");
    expect(runner).toContain("summary-${browserName}.json");
    expect(runner).toContain("process.exitCode = 1");
  });
});
