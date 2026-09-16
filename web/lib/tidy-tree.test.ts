import {describe, expect, test} from "bun:test";
import {buildTidyTreeFixture, layoutTidyTree, type TidyTreeNode} from "./tidy-tree";

function mirror(node: TidyTreeNode): TidyTreeNode {
  return {id: node.id, children: [...node.children].reverse().map(mirror)};
}

describe("Reingold-Tilford-style tidy tree", () => {
  test("positions the fixture compactly while centering each binary parent over its children", () => {
    const result = layoutTidyTree(buildTidyTreeFixture());
    const byId = new Map(result.placements.map((placement) => [placement.id, placement]));

    expect(result.drawingWidth).toBe(300);
    expect(result.drawingHeight).toBe(260);
    expect(result.maxDepth).toBe(3);
    expect(byId.get("root")).toMatchObject({centerX: 150, x: 126, y: 0});
    expect(byId.get("left")).toMatchObject({centerX: 60, x: 36, y: 76});
    expect(byId.get("right")).toMatchObject({centerX: 240, x: 216, y: 76});
    expect(byId.get("left-a")).toMatchObject({x: 0, y: 152});
    expect(byId.get("right-b")).toMatchObject({x: 252, y: 152});

    expect(byId.get("root")!.centerX).toBe((byId.get("left")!.centerX + byId.get("right")!.centerX) / 2);
    expect(byId.get("left")!.centerX).toBe((byId.get("left-a")!.centerX + byId.get("left-b")!.centerX) / 2);
    expect(byId.get("left-b")!.centerX).toBe((byId.get("left-b-a")!.centerX + byId.get("left-b-b")!.centerX) / 2);
  });

  test("exposes contour-based rigid subtree shifts", () => {
    const result = layoutTidyTree(buildTidyTreeFixture());

    expect(result.shifts.map((shift) => [shift.nodeId, shift.separation, shift.comparedDepths])).toEqual([
      ["left-b", 72, 1],
      ["left", 72, 1],
      ["right", 72, 1],
      ["root", 180, 3],
    ]);
    expect(result.contourComparisons).toBe(6);
  });

  test("preserves subtree-relative geometry when the subtree is laid out inside a larger tree", () => {
    const fixture = buildTidyTreeFixture();
    const full = layoutTidyTree(fixture);
    const leftOnly = layoutTidyTree({...fixture, root: fixture.root.children[0]!});
    const fullById = new Map(full.placements.map((placement) => [placement.id, placement.centerX]));
    const leftById = new Map(leftOnly.placements.map((placement) => [placement.id, placement.centerX]));

    const ids = ["left", "left-a", "left-b", "left-b-a", "left-b-b"];
    for (const id of ids) {
      expect(fullById.get(id)! - fullById.get("left")!).toBe(leftById.get(id)! - leftById.get("left")!);
    }
  });

  test("mirroring the ordered tree mirrors the final drawing", () => {
    const fixture = buildTidyTreeFixture();
    const normal = layoutTidyTree(fixture);
    const mirrored = layoutTidyTree({...fixture, root: mirror(fixture.root)});
    const mirroredById = new Map(mirrored.placements.map((placement) => [placement.id, placement.centerX]));

    expect(mirrored.drawingWidth).toBe(normal.drawingWidth);
    for (const placement of normal.placements) {
      expect(mirroredById.get(placement.id)).toBeCloseTo(normal.drawingWidth - placement.centerX, 8);
    }
  });

  test("keeps deep unary chains centered with exact parent and depth metadata", () => {
    const leaf: TidyTreeNode = {id: "d", children: []};
    const chain: TidyTreeNode = {
      id: "a",
      children: [{
        id: "b",
        children: [{id: "c", children: [leaf]}],
      }],
    };
    const fixture = buildTidyTreeFixture();
    const result = layoutTidyTree({...fixture, root: chain});

    expect(result.placements.map(({id, parentId, depth, centerX}) => ({id, parentId, depth, centerX}))).toEqual([
      {id: "a", parentId: null, depth: 0, centerX: 24},
      {id: "b", parentId: "a", depth: 1, centerX: 24},
      {id: "c", parentId: "b", depth: 2, centerX: 24},
      {id: "d", parentId: "c", depth: 3, centerX: 24},
    ]);
    expect(result.shifts).toEqual([]);
    expect(result.contourComparisons).toBe(0);
    expect(result.maxDepth).toBe(3);
    expect(result.drawingWidth).toBe(48);
  });

  test("fails closed for non-binary nodes and repeated node objects", () => {
    const fixture = buildTidyTreeFixture();
    expect(() => layoutTidyTree({
      ...fixture,
      root: {id: "root", children: [
        {id: "a", children: []},
        {id: "b", children: []},
        {id: "c", children: []},
      ]},
    })).toThrow("at most two ordered children");

    const shared: TidyTreeNode = {id: "shared", children: []};
    expect(() => layoutTidyTree({...fixture, root: {id: "root", children: [shared, shared]}}))
      .toThrow("cycle or repeated node object");
  });
});
