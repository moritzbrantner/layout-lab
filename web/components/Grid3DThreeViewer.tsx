"use client";

import {useEffect, useRef, useState} from "react";
import type {Grid3DDefinition, ResolvedGrid3DBox, ResolvedGrid3DScene} from "@/lib/grid-3d-model";
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
  floor: any | null;
  boxMeshes: any[];
  resizeObserver: ResizeObserver;
  animationFrame: number | null;
  reduceMotion: boolean;
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

function removeWorldObject(runtime: Runtime, object: any) {
  runtime.world.remove(object);
  disposeObject(object);
}

function clearWorld(runtime: Runtime) {
  if (runtime.animationFrame !== null) {
    cancelAnimationFrame(runtime.animationFrame);
    runtime.animationFrame = null;
  }
  const children = [...runtime.world.children];
  children.forEach((child) => removeWorldObject(runtime, child));
  runtime.floor = null;
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

function replaceFloor(
  runtime: Runtime,
  host: HTMLElement,
  definition: Grid3DDefinition,
  resolved: ResolvedGrid3DScene,
) {
  const {THREE} = runtime;
  if (runtime.floor) {
    removeWorldObject(runtime, runtime.floor);
  }

  const centerX = resolved.width / 2;
  const centerZ = resolved.depth / 2;
  const muted = readThemeColor(host, "--muted", "#aab3c4");
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
  runtime.floor = new THREE.LineSegments(floorGeometry, floorMaterial);
  runtime.world.add(runtime.floor);
}

function createBoxMesh(runtime: Runtime, host: HTMLElement, box: ResolvedGrid3DBox, index: number) {
  const {THREE} = runtime;
  const muted = readThemeColor(host, "--muted", "#aab3c4");
  const color = readThemeColor(host, SERIES_VARS[index % SERIES_VARS.length], "#8eb9ff");
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    metalness: 0,
    transparent: true,
    opacity: 0.72,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.boxId = box.id;

  const edgeGeometry = new THREE.EdgesGeometry(geometry);
  const edgeMaterial = new THREE.LineBasicMaterial({color: muted, transparent: true, opacity: 0.72});
  const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  edges.userData.grid3dEdges = true;
  mesh.add(edges);
  runtime.world.add(mesh);
  return mesh;
}

function updateBoxAppearance(
  runtime: Runtime,
  host: HTMLElement,
  mesh: any,
  index: number,
  selected: boolean,
) {
  const color = readThemeColor(host, SERIES_VARS[index % SERIES_VARS.length], "#8eb9ff");
  const muted = readThemeColor(host, "--muted", "#aab3c4");
  const accent = readThemeColor(host, "--accent", "#85a7ff");
  mesh.material.color.set(color);
  mesh.material.opacity = selected ? 0.9 : 0.72;
  mesh.material.emissive.set(selected ? accent : "#000000");
  mesh.material.emissiveIntensity = selected ? 0.18 : 0;

  const edges = mesh.children.find((child: any) => child.userData?.grid3dEdges);
  if (edges?.material) {
    edges.material.color.set(selected ? accent : muted);
    edges.material.opacity = selected ? 1 : 0.72;
  }
}

function scheduleBoxAnimation(runtime: Runtime) {
  if (runtime.reduceMotion) {
    runtime.boxMeshes.forEach((mesh) => {
      mesh.position.copy(mesh.userData.targetPosition);
      mesh.scale.copy(mesh.userData.targetScale);
    });
    runtime.render();
    return;
  }
  if (runtime.animationFrame !== null) return;

  const tick = () => {
    let moving = false;
    runtime.boxMeshes.forEach((mesh) => {
      const targetPosition = mesh.userData.targetPosition;
      const targetScale = mesh.userData.targetScale;
      const positionDistance = mesh.position.distanceTo(targetPosition);
      const scaleDistance = mesh.scale.distanceTo(targetScale);

      if (positionDistance > 0.002) {
        mesh.position.lerp(targetPosition, 0.24);
        moving = true;
      } else {
        mesh.position.copy(targetPosition);
      }
      if (scaleDistance > 0.002) {
        mesh.scale.lerp(targetScale, 0.24);
        moving = true;
      } else {
        mesh.scale.copy(targetScale);
      }
    });

    runtime.render();
    runtime.animationFrame = moving ? requestAnimationFrame(tick) : null;
  };

  runtime.animationFrame = requestAnimationFrame(tick);
}

function buildWorld(
  runtime: Runtime,
  host: HTMLElement,
  definition: Grid3DDefinition,
  resolved: ResolvedGrid3DScene,
  selectedId: string,
) {
  replaceFloor(runtime, host, definition, resolved);
  const {THREE} = runtime;
  const centerX = resolved.width / 2;
  const centerZ = resolved.depth / 2;
  const existing = new Map(runtime.boxMeshes.map((mesh) => [mesh.userData.boxId, mesh]));
  const nextMeshes: any[] = [];

  resolved.boxes.forEach((box, index) => {
    let mesh = existing.get(box.id);
    const isNew = !mesh;
    if (!mesh) {
      mesh = createBoxMesh(runtime, host, box, index);
    }
    existing.delete(box.id);
    updateBoxAppearance(runtime, host, mesh, index, box.id === selectedId);

    const targetPosition = new THREE.Vector3(
      box.x + box.width / 2 - centerX,
      box.y + box.height / 2,
      box.z + box.depth / 2 - centerZ,
    );
    const targetScale = new THREE.Vector3(box.width, box.height, box.depth);
    mesh.userData.targetPosition = targetPosition;
    mesh.userData.targetScale = targetScale;
    if (isNew) {
      mesh.position.copy(targetPosition);
      mesh.scale.copy(targetScale);
    }
    nextMeshes.push(mesh);
  });

  existing.forEach((mesh) => removeWorldObject(runtime, mesh));
  runtime.boxMeshes = nextMeshes;
  scheduleBoxAnimation(runtime);
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
          floor: null,
          boxMeshes: [],
          resizeObserver: null as unknown as ResizeObserver,
          animationFrame: null,
          reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
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
        setMessage("Drag to orbit. Live layout controls animate resolved boxes into their new geometry.");
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
