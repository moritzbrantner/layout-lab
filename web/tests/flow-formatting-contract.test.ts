import {describe, expect, test} from "bun:test";
import {readFileSync} from "node:fs";
import {join} from "node:path";

describe("flow formatting presentation contract", () => {
  test("keeps the dedicated stylesheet and route selector in place", () => {
    const layout = readFileSync(join(import.meta.dir, "../app/layout.tsx"), "utf8");
    const editorPages = readFileSync(join(import.meta.dir, "../app/editor-pages.css"), "utf8");

    expect(layout).toContain('import "./flow-formatting.css";');
    expect(editorPages).toContain('[data-editor="flow-formatting"] #flow-formatting');
  });
});
