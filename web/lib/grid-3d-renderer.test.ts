import {describe, expect, test} from "bun:test";
import {
  DEFAULT_GRID3D_VIEW,
  GRID3D_THREE_VERSION,
  grid3DThreeLoaderPath,
  normalizeGrid3DView,
} from "./grid-3d-renderer";

describe("Grid3D renderer contract", () => {
  test("pins the Three.js browser renderer", () => {
    expect(GRID3D_THREE_VERSION).toBe("0.185.1");
  });

  test("resolves the static loader under root and GitHub Pages base paths", () => {
    expect(grid3DThreeLoaderPath("/grid-3d/")).toBe("/grid3d-three-loader.js");
    expect(grid3DThreeLoaderPath("/layout-lab/grid-3d/")).toBe("/layout-lab/grid3d-three-loader.js");
  });

  test("keeps camera state inside usable orbit and zoom bounds", () => {
    expect(normalizeGrid3DView({yaw: 260, pitch: -20, zoom: 999})).toEqual({
      yaw: 180,
      pitch: 5,
      zoom: 180,
    });
    expect(normalizeGrid3DView(DEFAULT_GRID3D_VIEW)).toEqual(DEFAULT_GRID3D_VIEW);
  });
});
