export type Grid3DRendererMode = "three" | "svg";

export type Grid3DView = {
  yaw: number;
  pitch: number;
  zoom: number;
};

export const GRID3D_THREE_VERSION = "0.185.1";
export const DEFAULT_GRID3D_VIEW: Grid3DView = {
  yaw: -38,
  pitch: 28,
  zoom: 100,
};

export function normalizeGrid3DView(view: Grid3DView): Grid3DView {
  return {
    yaw: Math.max(-180, Math.min(180, view.yaw)),
    pitch: Math.max(5, Math.min(85, view.pitch)),
    zoom: Math.max(45, Math.min(180, view.zoom)),
  };
}

export function grid3DThreeLoaderPath(pathname: string): string {
  const routeIndex = pathname.indexOf("/grid-3d");
  const basePath = routeIndex >= 0 ? pathname.slice(0, routeIndex) : "";
  return `${basePath}/grid3d-three-loader.js` || "/grid3d-three-loader.js";
}
