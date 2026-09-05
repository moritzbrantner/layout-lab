"use client";

import {useEffect, useRef, useState} from "react";
import type {Grid3DDefinition, ResolvedGrid3DScene} from "@/lib/grid-3d-model";
import {
  grid3DThreeLoaderPath,
  normalizeGrid3DView,
  type Grid3DView,
} from "@/lib/grid-3d-renderer";

type ThreeNamespace = Record<string, any>;

declare global {
  interface Window {
    __LAYOUT_LAB_THREE__?: ThreeNamespace;
    __LAYOUT_LAB_THREE_ERROR__?: string;
  }
}

type Runtime = {
  THREE: ThreeNamespace;
  scene: any;
  camera: any;
  renderer: any;
  world: any;
  boxMeshes: any[];
  resizeObserver: ResizeObserver;
  render: () => void;
};

type DragState = {
  pointerId: number;
  x: number;
  y: number;
  yaw: number;
  pitch: number;
  moved: boolean;
};

const READY_EVENT = "layout-lab:grid3d-three-ready";
const LOADER_ID = "layout-lab-grid3d-three-loader";
const SERIES_VARS = ["--series-a", "--series-b", "--series-c", "--series-d", "--series-e"];

function axisEdges(tracks: number[], gap: number): number[] {
  const edges = new Set<number>([0]);
  let cursor = 0;
  tracks.forEach((track, index) => {
    edges.add(cursor);
    cursor += track;
    edges.add(cursor);
    if (index < tracks.length - 1) {
      cursor += gap;
      edges.add(cursor);
    }
  });
  return [...edges].sort((a, b) => a - b);
}

function readThemeColor(element: HTMLElement, variable: string, fallback: string): string {
  const value = getComputedStyle(element).getPropertyValue(variable).trim();
  return value || fallback;
}

function ensureThree(): Promise<ThreeNamespace> {
  if (window.__LAYOUT_LAB_THREE__) {
    return Promise.resolve(window.__LAYOUT_LAB_THREE__);
  }
  if (window.__LAYOUT_LAB_THREE_ERROR__) {
    return Promise.reject(new Error(window.__LAYOUT_LAB_THREE_ERROR__));
  }

  return new Promise((resolve, reject) => {
    const handleReady = () => {
      window.removeEventListener(READY_EVENT, handleReady);
      if (window.__LAYOUT_LAB_THREE__) {
        resolve(window.__LAYOUT_LAB_THREE__);
      } else {
        reject(new Error(window.__LAYOUT_LAB_THREE_ERROR__ ?? "Three.js could not be loaded."));
      }
    };

    window.addEventListener(READY_EVENT, handleReady);
    if (!document.getElementById(LOADER_ID)) {
      const script = document.createElement("script");
      script.id = LOADER_ID;
      script.type = "module";
      script.src = grid3DThreeLoaderPath(window.location.pathname);
      script.addEventListener("error", () => {
        window.__LAYOUT_LAB_THREE_ERROR__ = "The pinned Three.js loader could not be loaded.";
        window.dispatchEvent(new Event(READY_EVENT));
      }, {once: true});
      document.head.appendChild(script);
    }
  });
}

function disposeObject(object: any) {
  object.traverse?.((child: any) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((material: any) => material.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
}

function clearWorld(runtime: Runtime) {
  const children = [...runtime.world.children];
  children.forEach((child) => {
    runtime.world.remove(child);
    disposeObject(child);
  });
  runtime.boxMeshes = [];
}

function setCamera(runtime: Runtime, scene: ResolvedGrid3DScene, view: Grid3DView) {
  const normalized = normalizeGrid3DView(view);
  const radius = Math.max(scene.width, scene.height, scene.depth, 1);
  const distance = radius * 2.5 * 100 / normalized.zoom;
  const yaw = normalized.yaw * Math.PI / 180;
  const pitch = normalized.pitch * Math.PI / 180;
  const horizontal = Math.cos(pitch) * distance;
  const targetY = scene.height / 2;

  runtime.camera.position.set(
    Math.sin(yaw) * horizontal,
    targetY + Math.sin(pitch) * distance,
    Math.cos(yaw) * horizontal,
  );
  runtime.camera.near = Math.max(0.01, radius / 1000);
  runtime.camera.far = Math.max(1000, radius * 20);
  runtime.camera.updateProjectionMatrix();
  runtime.camera.lookAt(0, targetY, 0);
  runtime.render();
}

function buildWorld(
  runtime: Runtime,
  host: HTMLElement,
  definition: Grid3DDefinition,
  resolved: ResolvedGrid3DScene,
  selectedId: string,
) {
  clearWorld(runtime);
  const {THREE} = runtime;
  const centerX = resolved.width / 2;
  const centerZ = resolved.depth / 2;
  const muted = readThemeColor(host, "--muted", "#aab3c4");
  const accent = readThemeColor(host, "--accent", "#85a7ff");
  const floorMaterial = new THREE.LineBasicMaterial({color: muted, transparent: true, opacity: 0.34});
  const floorGeometry = new THREE.BufferGeometry();
  const floorPoints: any[] = [];

  axisEdges(definition.columns, definition.gaps.column).forEach((x) => {
    floorPoints.push(
      new THREE.Vector3(x - centerX, 0, -centerZ),
      new THREE.Vector3(x - centerX, 0, resolved.depth - centerZ),
    );
  });
  axisEdges(definition.rows, definition.gaps.row).forEach((z) => {
    floorPoints.push(
      new THREE.Vector3(-centerX, 0, z - centerZ),
      new THREE.Vector3(resolved.width - centerX, 0, z - centerZ),
    );
  });
  floorGeometry.setFromPoints(floorPoints);
  runtime.world.add(new THREE.LineSegments(floorGeometry, floorMaterial));

  resolved.boxes.forEach((box, index) => {
    const selected = box.id === selectedId;
    const color = readThemeColor(host, SERIES_VARS[index % SERIES_VARS.length], "#8eb9ff");
    const geometry = new THREE.BoxGeometry(box.width, box.height, box.depth);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0,
      transparent: true,
      opacity: selected ? 0.9 : 0.72,
      emissive: selected ? accent : "#000000",
      emissiveIntensity: selected ? 0.18 : 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      box.x + box.width / 2 - centerX,
      box.y + box.height / 2,
      box.z + box.depth / 2 - centerZ,
    );
    mesh.userData.boxId = box.id;

    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: selected ? accent : muted,
      transparent: true,
      opacity: selected ? 1 : 0.72,
    });
    mesh.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));
    runtime.world.add(mesh);
    runtime.boxMeshes.push(mesh);
  });

  runtime.render();
}

export function Grid3DThreeViewer({
  definition,
  scene,
  selectedId,
  view,
  onSelect,
  onViewChange,
}: {
  definition: Grid3DDefinition;
  scene: ResolvedGrid3DScene;
  selectedId: string;
  view: Grid3DView;
  onSelect: (id: string) => void;
  onViewChange: (view: Grid3DView) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const viewRef = useRef(view);
  const sceneRef = useRef(scene);
  const onSelectRef = useRef(onSelect);
  const onViewChangeRef = useRef(onViewChange);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Loading pinned Three.js renderer…");

  viewRef.current = view;
  sceneRef.current = scene;
  onSelectRef.current = onSelect;
  onViewChangeRef.current = onViewChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    ensureThree().then((THREE) => {
      if (cancelled || !hostRef.current) return;
      const currentHost = hostRef.current;
      try {
        const threeScene = new THREE.Scene();
        const background = readThemeColor(currentHost, "--bg", "#0b0d12");
        threeScene.background = new THREE.Color(background);
        const camera = new THREE.PerspectiveCamera(44, 1, 0.01, 1000);
        const renderer = new THREE.WebGLRenderer({antialias: true, alpha: false});
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.domElement.tabIndex = 0;
        renderer.domElement.setAttribute("aria-label", "Three.js view of the resolved Grid3D layout");
        renderer.domElement.style.touchAction = "pan-y";
        currentHost.appendChild(renderer.domElement);

        threeScene.add(new THREE.HemisphereLight(0xffffff, 0x1a2030, 1.45));
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.55);
        keyLight.position.set(8, 12, 10);
        threeScene.add(keyLight);
        const world = new THREE.Group();
        threeScene.add(world);

        const runtime: Runtime = {
          THREE,
          scene: threeScene,
          camera,
          renderer,
          world,
          boxMeshes: [],
          resizeObserver: null as unknown as ResizeObserver,
          render: () => renderer.render(threeScene, camera),
        };
        runtimeRef.current = runtime;

        const resize = () => {
          const width = Math.max(currentHost.clientWidth, 1);
          const height = Math.max(currentHost.clientHeight, 360);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          runtime.render();
        };
        runtime.resizeObserver = new ResizeObserver(resize);
        runtime.resizeObserver.observe(currentHost);
        resize();

        const pointerDown = (event: PointerEvent) => {
          if (event.button !== 0) return;
          dragRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            yaw: viewRef.current.yaw,
            pitch: viewRef.current.pitch,
            moved: false,
          };
          renderer.domElement.setPointerCapture(event.pointerId);
        };
        const pointerMove = (event: PointerEvent) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          const dx = event.clientX - drag.x;
          const dy = event.clientY - drag.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
          if (!drag.moved) return;
          const next = normalizeGrid3DView({
            ...viewRef.current,
            yaw: drag.yaw - dx * 0.42,
            pitch: drag.pitch + dy * 0.32,
          });
          onViewChangeRef.current(next);
        };
        const pointerUp = (event: PointerEvent) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          if (!drag.moved) {
            const rect = renderer.domElement.getBoundingClientRect();
            const pointer = new THREE.Vector2(
              ((event.clientX - rect.left) / rect.width) * 2 - 1,
              -((event.clientY - rect.top) / rect.height) * 2 + 1,
            );
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(pointer, camera);
            const hit = raycaster.intersectObjects(runtime.boxMeshes, false)[0];
            const id = hit?.object?.userData?.boxId;
            if (typeof id === "string") onSelectRef.current(id);
          }
          dragRef.current = null;
          if (renderer.domElement.hasPointerCapture(event.pointerId)) {
            renderer.domElement.releasePointerCapture(event.pointerId);
          }
        };

        renderer.domElement.addEventListener("pointerdown", pointerDown);
        renderer.domElement.addEventListener("pointermove", pointerMove);
        renderer.domElement.addEventListener("pointerup", pointerUp);
        renderer.domElement.addEventListener("pointercancel", pointerUp);
        (runtime as Runtime & {cleanupPointers?: () => void}).cleanupPointers = () => {
          renderer.domElement.removeEventListener("pointerdown", pointerDown);
          renderer.domElement.removeEventListener("pointermove", pointerMove);
          renderer.domElement.removeEventListener("pointerup", pointerUp);
          renderer.domElement.removeEventListener("pointercancel", pointerUp);
        };

        setStatus("ready");
        setMessage("Drag to orbit. Select boxes by clicking or use the inspector control.");
      } catch (cause) {
        setStatus("error");
        setMessage(cause instanceof Error ? cause.message : "WebGL renderer initialization failed.");
      }
    }).catch((cause) => {
      if (cancelled) return;
      setStatus("error");
      setMessage(cause instanceof Error ? cause.message : "Three.js could not be loaded.");
    });

    return () => {
      cancelled = true;
      const runtime = runtimeRef.current as (Runtime & {cleanupPointers?: () => void}) | null;
      if (runtime) {
        runtime.cleanupPointers?.();
        runtime.resizeObserver.disconnect();
        clearWorld(runtime);
        runtime.renderer.dispose();
        runtime.renderer.domElement.remove();
        runtimeRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    const host = hostRef.current;
    if (!runtime || !host || status !== "ready") return;
    buildWorld(runtime, host, definition, scene, selectedId);
    setCamera(runtime, scene, viewRef.current);
  }, [definition, scene, selectedId, status]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || status !== "ready") return;
    setCamera(runtime, scene, view);
  }, [scene, status, view]);

  return (
    <div className="grid3d-three-shell">
      <div ref={hostRef} className="grid3d-three-host" data-status={status} />
      <div className={`grid3d-three-status is-${status}`} role={status === "error" ? "alert" : "status"}>
        {message}
      </div>
    </div>
  );
}
