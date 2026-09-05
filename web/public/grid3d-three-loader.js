const READY_EVENT = "layout-lab:grid3d-three-ready";
const MODULE_URL = "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js";

try {
  const THREE = await import(MODULE_URL);
  window.__LAYOUT_LAB_THREE__ = THREE;
  window.__LAYOUT_LAB_THREE_ERROR__ = undefined;
  window.dispatchEvent(new CustomEvent(READY_EVENT, {detail: {ok: true, version: "0.185.1"}}));
} catch (error) {
  window.__LAYOUT_LAB_THREE_ERROR__ = error instanceof Error ? error.message : "Three.js could not be loaded.";
  window.dispatchEvent(new CustomEvent(READY_EVENT, {detail: {ok: false}}));
}
