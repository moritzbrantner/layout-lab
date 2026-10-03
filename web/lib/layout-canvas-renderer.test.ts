import {describe, expect, test} from "bun:test";
import {createLayoutCanvasScene} from "./layout-canvas-renderer";
import type {LayoutBox} from "./layout-geometry";

const fixture: LayoutBox = {
  id: "root",
  label: "Root",
  rect: {x: 10, y: 20, width: 200, height: 100},
  children: [
    {
      id: "child",
      label: "Child",
      rect: {x: 60, y: 40, width: 80, height: 40},
      children: [],
    },
  ],
};

describe("createLayoutCanvasScene", () => {
  test("projects resolved boxes without changing their relative geometry", () => {
    const scene = createLayoutCanvasScene(fixture, {width: 500, height: 300, padding: 20});
    const root = scene.commands[0]!;
    const child = scene.commands[1]!;

    expect(scene.contentBounds).toEqual({x: 10, y: 20, width: 200, height: 100});
    expect(scene.scale).toBe(2.3);
    expect(root.depth).toBe(0);
    expect(child.depth).toBe(1);
    expect(child.rect.x - root.rect.x).toBeCloseTo((60 - 10) * scene.scale);
    expect(child.rect.y - root.rect.y).toBeCloseTo((40 - 20) * scene.scale);
    expect(child.rect.width / root.rect.width).toBeCloseTo(80 / 200);
    expect(child.rect.height / root.rect.height).toBeCloseTo(40 / 100);
  });

  test("includes overflowing descendants in the scene bounds", () => {
    const overflowing: LayoutBox = {
      ...fixture,
      children: [{
        id: "overflow",
        label: "Overflow",
        rect: {x: 180, y: 70, width: 80, height: 70},
        children: [],
      }],
    };

    const scene = createLayoutCanvasScene(overflowing, {width: 520, height: 300, padding: 20});
    expect(scene.contentBounds).toEqual({x: 10, y: 20, width: 250, height: 120});
    expect(scene.commands).toHaveLength(2);
  });

  test("fails closed on invalid renderer geometry", () => {
    const invalid: LayoutBox = {
      ...fixture,
      rect: {x: 0, y: 0, width: Number.NaN, height: 10},
    };

    expect(() => createLayoutCanvasScene(invalid, {width: 500, height: 300, padding: 20}))
      .toThrow("canvas renderer requires finite, non-negative geometry");
  });
});
