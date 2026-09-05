import {describe, expect, test} from "bun:test";
import {
  addGrid3DItem,
  removeGrid3DItem,
  serializeGrid3DDefinition,
  updateGrid3DGap,
  updateGrid3DItemPlacement,
  updateGrid3DTrack,
} from "./grid-3d-controls";
import {
  HOUSE_GRID_3D_SOURCE,
  parseGrid3DSource,
  resolveGrid3D,
} from "./grid-3d-model";

describe("Grid3D live controls", () => {
  test("serializes structured control changes back into equivalent source", () => {
    const definition = parseGrid3DSource(HOUSE_GRID_3D_SOURCE);
    const changed = updateGrid3DGap(
      updateGrid3DTrack(definition, "column", 1, 5.5),
      "layer",
      0.75,
    );

    const roundTripped = parseGrid3DSource(serializeGrid3DDefinition(changed));

    expect(roundTripped).toEqual(changed);
    expect(resolveGrid3D(roundTripped).width).toBe(14);
  });

  test("moves a box while keeping an existing span inside the new start", () => {
    const definition = parseGrid3DSource(HOUSE_GRID_3D_SOURCE);
    const changed = updateGrid3DItemPlacement(definition, "living-room", "column", {start: 3});
    const item = changed.items.find((candidate) => candidate.id === "living-room");

    expect(item?.column).toEqual({start: 3, span: 1});
    expect(resolveGrid3D(changed).boxes.find((box) => box.id === "living-room")).toMatchObject({x: 8.5, width: 4});
  });

  test("changes spans explicitly and rejects spans beyond the remaining tracks", () => {
    const definition = parseGrid3DSource(HOUSE_GRID_3D_SOURCE);
    const changed = updateGrid3DItemPlacement(definition, "kitchen", "row", {span: 2});

    expect(changed.items.find((item) => item.id === "kitchen")?.row).toEqual({start: 1, span: 2});
    expect(() => updateGrid3DItemPlacement(changed, "kitchen", "row", {start: 2, span: 2}))
      .toThrow("row span must fit inside the available tracks");
  });

  test("adds a box into the first free grid cell and removes it deterministically", () => {
    const definition = parseGrid3DSource(HOUSE_GRID_3D_SOURCE);
    const added = addGrid3DItem(definition);
    const item = added.items.at(-1);

    expect(item?.id).toBe("box-1");
    expect(item).toMatchObject({
      column: {start: 3, span: 1},
      row: {start: 2, span: 1},
      layer: {start: 1, span: 1},
    });
    expect(removeGrid3DItem(added, "box-1")).toEqual(definition);
  });
});
