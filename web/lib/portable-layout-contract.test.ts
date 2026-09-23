import {describe, expect, test} from "bun:test";
import flexGeometryFixture from "../../contracts/fixtures/flex-baseline.geometry.json";
import flexLayoutFixture from "../../contracts/fixtures/flex-baseline.layout.json";
import {buildFlexEngineTree} from "./layout-engine-fixtures";
import {layoutFlexTree} from "./layout-engine";
import {
  exportPortableLayoutGeometry,
  exportPortableLayoutTree,
  serializePortableLayoutDocument,
} from "./portable-layout-contract";
import type {LayoutNode} from "./layout-tree";

describe("portable layout contract", () => {
  test("exports the H5 input tree to the shared language-neutral fixture", () => {
    const document = exportPortableLayoutTree(buildFlexEngineTree());

    expect(JSON.parse(serializePortableLayoutDocument(document))).toEqual(flexLayoutFixture);
  });

  test("exports resolved engine geometry to the shared fixture", () => {
    const result = layoutFlexTree(buildFlexEngineTree());
    const document = exportPortableLayoutGeometry(result.root);

    expect(JSON.parse(serializePortableLayoutDocument(document))).toEqual(flexGeometryFixture);
  });

  test("validates the authoritative TypeScript tree before crossing the wire boundary", () => {
    const source = buildFlexEngineTree();
    const invalid: LayoutNode = {
      ...source,
      children: [
        source.children[0]!,
        {...source.children[1]!, id: source.children[0]!.id},
      ],
    };

    expect(() => exportPortableLayoutTree(invalid))
      .toThrow("cannot export invalid layout tree: duplicate layout node id: item-a");
  });

  test("fails closed before JSON can turn non-finite geometry into null", () => {
    const result = layoutFlexTree(buildFlexEngineTree());
    const invalid = {
      ...result.root,
      rect: {...result.root.rect, width: Number.NaN},
    };

    expect(() => exportPortableLayoutGeometry(invalid))
      .toThrow("root: portable geometry requires finite coordinates and non-negative sizes");
  });

  test("omits absent optional fields instead of serializing implementation-only undefined values", () => {
    const document = exportPortableLayoutTree(buildFlexEngineTree());
    const serialized = serializePortableLayoutDocument(document);

    expect(serialized).not.toContain("undefined");
    expect(serialized.endsWith("\n")).toBe(true);
  });
});
