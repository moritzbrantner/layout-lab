import {describe, expect, test} from "bun:test";
import blockGeometryFixture from "../../contracts/fixtures/block-baseline.geometry.json";
import blockLayoutFixture from "../../contracts/fixtures/block-baseline.layout.json";
import flexGeometryFixture from "../../contracts/fixtures/flex-baseline.geometry.json";
import flexLayoutFixture from "../../contracts/fixtures/flex-baseline.layout.json";
import gridGeometryFixture from "../../contracts/fixtures/grid-baseline.geometry.json";
import gridLayoutFixture from "../../contracts/fixtures/grid-baseline.layout.json";
import {buildFlexEngineTree, buildGridEngineTree} from "./layout-engine-fixtures";
import {layoutBlockTree, layoutFlexTree, layoutGridTree} from "./layout-engine";
import {
  exportPortableLayoutGeometry,
  exportPortableLayoutTree,
  serializePortableLayoutDocument,
} from "./portable-layout-contract";
import {buildBlockLayoutTree, type LayoutNode} from "./layout-tree";

function expectPortableFixture(document: ReturnType<typeof exportPortableLayoutTree> | ReturnType<typeof exportPortableLayoutGeometry>, fixture: unknown) {
  expect(JSON.parse(serializePortableLayoutDocument(document))).toEqual(fixture);
}

describe("portable layout contract", () => {
  test("exports block, flex, and grid H5 trees to the shared language-neutral fixtures", () => {
    expectPortableFixture(exportPortableLayoutTree(buildBlockLayoutTree()), blockLayoutFixture);
    expectPortableFixture(exportPortableLayoutTree(buildFlexEngineTree()), flexLayoutFixture);
    expectPortableFixture(exportPortableLayoutTree(buildGridEngineTree()), gridLayoutFixture);
  });

  test("exports block, flex, and grid resolved geometry to the shared fixtures", () => {
    expectPortableFixture(
      exportPortableLayoutGeometry(layoutBlockTree(buildBlockLayoutTree()).root),
      blockGeometryFixture,
    );
    expectPortableFixture(
      exportPortableLayoutGeometry(layoutFlexTree(buildFlexEngineTree()).root),
      flexGeometryFixture,
    );
    expectPortableFixture(
      exportPortableLayoutGeometry(layoutGridTree(buildGridEngineTree()).root),
      gridGeometryFixture,
    );
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

  test("rejects flex directions the v1 contract does not advertise", () => {
    const source = buildFlexEngineTree();
    const column: LayoutNode = {
      ...source,
      style: {...source.style, flexContainer: {...source.style.flexContainer!, direction: "column"}},
    };

    expect(() => exportPortableLayoutTree(column))
      .toThrow("portable layout v1 supports row flex direction only, got column");
  });

  test("fails closed on empty geometry identity fields", () => {
    const result = layoutFlexTree(buildFlexEngineTree());
    const invalid = {
      ...result.root,
      children: [{...result.root.children[0]!, label: ""}, ...result.root.children.slice(1)],
    };

    expect(() => exportPortableLayoutGeometry(invalid))
      .toThrow("portable documents require non-empty id and label");
  });

  test("omits absent optional fields instead of serializing implementation-only undefined values", () => {
    const document = exportPortableLayoutTree(buildFlexEngineTree());
    const serialized = serializePortableLayoutDocument(document);

    expect(serialized).not.toContain("undefined");
    expect(serialized.endsWith("\n")).toBe(true);
  });
});
