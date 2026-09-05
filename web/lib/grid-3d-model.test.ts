import {describe, expect, test} from "bun:test";
import {
  HOUSE_GRID_3D_SOURCE,
  parseGrid3DSource,
  resolveGrid3D,
  type Grid3DDefinition,
} from "./grid-3d-model";

describe("Grid3D source", () => {
  test("parses CSS-like scene tracks, gaps, spans, and items", () => {
    const definition = parseGrid3DSource(HOUSE_GRID_3D_SOURCE);

    expect(definition.columns).toEqual([4, 4, 4]);
    expect(definition.rows).toEqual([4, 4]);
    expect(definition.layers).toEqual([2.8, 2.8]);
    expect(definition.gaps).toEqual({column: 0.25, row: 0.25, layer: 0.4});
    expect(definition.items.find((item) => item.id === "living-room")?.column).toEqual({start: 1, span: 2});
    expect(definition.items.find((item) => item.id === "stairs")?.layer).toEqual({start: 1, span: 2});
  });

  test("accepts CSS grid end-line syntax as an alternative to span", () => {
    const source = `scene {
      grid-template-columns: 2 3 4;
      grid-template-rows: 5;
      grid-template-layers: 6;
    }

    .wide {
      grid-column: 1 / 3;
      grid-row: 1;
      grid-layer: 1;
    }`;

    expect(parseGrid3DSource(source).items[0].column).toEqual({start: 1, span: 2});
  });
});

describe("Grid3D resolution", () => {
  test("resolves spans through their internal gaps", () => {
    const definition: Grid3DDefinition = {
      columns: [2, 3, 4],
      rows: [5, 6],
      layers: [2.5, 3],
      gaps: {column: 0.5, row: 1, layer: 0.25},
      items: [
        {
          id: "room",
          column: {start: 2, span: 2},
          row: {start: 1, span: 2},
          layer: {start: 2, span: 1},
        },
      ],
    };

    const scene = resolveGrid3D(definition);

    expect(scene).toMatchObject({width: 10, depth: 12, height: 5.75});
    expect(scene.boxes[0]).toEqual({
      id: "room",
      x: 2.5,
      y: 2.75,
      z: 0,
      width: 7.5,
      height: 3,
      depth: 12,
    });
  });

  test("maps layers to vertical Y while rows remain floor-depth Z", () => {
    const scene = resolveGrid3D({
      columns: [4],
      rows: [5, 6],
      layers: [3, 2],
      gaps: {column: 0, row: 0.5, layer: 0.4},
      items: [
        {
          id: "upstairs",
          column: {start: 1, span: 1},
          row: {start: 2, span: 1},
          layer: {start: 2, span: 1},
        },
      ],
    });

    expect(scene.boxes[0]).toMatchObject({x: 0, y: 3.4, z: 5.5, width: 4, height: 2, depth: 6});
  });

  test("rejects items that exceed an axis instead of clipping them", () => {
    expect(() => resolveGrid3D({
      columns: [4, 4],
      rows: [4],
      layers: [3],
      gaps: {column: 0, row: 0, layer: 0},
      items: [
        {
          id: "overflow",
          column: {start: 2, span: 2},
          row: {start: 1, span: 1},
          layer: {start: 1, span: 1},
        },
      ],
    })).toThrow("overflow exceeds the column track bounds");
  });
});
