"use client";

import {useMemo, useState} from "react";
import {Grid3DThreeViewer} from "@/components/Grid3DThreeViewer";
import {
  HOUSE_GRID_3D_SOURCE,
  parseGrid3DSource,
  resolveGrid3D,
  type Grid3DDefinition,
  type ResolvedGrid3DBox,
  type ResolvedGrid3DScene,
} from "@/lib/grid-3d-model";
import {
  DEFAULT_GRID3D_VIEW,
  normalizeGrid3DView,
  type Grid3DRendererMode,
  type Grid3DView,
} from "@/lib/grid-3d-renderer";

type Point3D = {x: number; y: number; z: number};
type ProjectedPoint = {x: number; y: number; depth: number};
type ProjectedFace = {
  boxId: string;
  points: string;
  depth: number;
  fill: string;
};

type GridLine = {
  key: string;
  start: ProjectedPoint;
  end: ProjectedPoint;
};

const VIEWBOX_WIDTH = 900;
const VIEWBOX_HEIGHT = 560;
const BOX_FILLS = [
  "var(--series-a)",
  "var(--series-b)",
  "var(--series-c)",
  "var(--series-d)",
  "var(--series-e)",
];

const INITIAL_DEFINITION = parseGrid3DSource(HOUSE_GRID_3D_SOURCE);
const INITIAL_SCENE = resolveGrid3D(INITIAL_DEFINITION);

function sceneScale(scene: ResolvedGrid3DScene): number {
  const floorFootprint = Math.max(scene.width + scene.depth, 1);
  const verticalFootprint = Math.max(scene.height + floorFootprint * 0.35, 1);
  return Math.min(64, 610 / floorFootprint, 340 / verticalFootprint);
}

function projectPoint(
  point: Point3D,
  scene: ResolvedGrid3DScene,
  yaw: number,
  pitch: number,
  scale: number,
): ProjectedPoint {
  const x = point.x - scene.width / 2;
  const y = point.y - scene.height / 2;
  const z = point.z - scene.depth / 2;
  const yawRadians = yaw * Math.PI / 180;
  const pitchRadians = pitch * Math.PI / 180;
  const cosYaw = Math.cos(yawRadians);
  const sinYaw = Math.sin(yawRadians);
  const cosPitch = Math.cos(pitchRadians);
  const sinPitch = Math.sin(pitchRadians);

  const yawX = cosYaw * x + sinYaw * z;
  const yawZ = -sinYaw * x + cosYaw * z;
  const pitchY = cosPitch * y - sinPitch * yawZ;
  const pitchZ = sinPitch * y + cosPitch * yawZ;

  return {
    x: VIEWBOX_WIDTH / 2 + yawX * scale,
    y: VIEWBOX_HEIGHT / 2 - pitchY * scale,
    depth: pitchZ,
  };
}

function boxVertices(box: ResolvedGrid3DBox): Point3D[] {
  const x1 = box.x + box.width;
  const y1 = box.y + box.height;
  const z1 = box.z + box.depth;
  return [
    {x: box.x, y: box.y, z: box.z},
    {x: x1, y: box.y, z: box.z},
    {x: x1, y: y1, z: box.z},
    {x: box.x, y: y1, z: box.z},
    {x: box.x, y: box.y, z: z1},
    {x: x1, y: box.y, z: z1},
    {x: x1, y: y1, z: z1},
    {x: box.x, y: y1, z: z1},
  ];
}

const FACE_INDICES = [
  [0, 1, 2, 3],
  [5, 4, 7, 6],
  [4, 0, 3, 7],
  [1, 5, 6, 2],
  [4, 5, 1, 0],
  [3, 2, 6, 7],
] as const;

function projectedFaces(
  scene: ResolvedGrid3DScene,
  yaw: number,
  pitch: number,
  scale: number,
): ProjectedFace[] {
  return scene.boxes
    .flatMap((box, boxIndex) => {
      const projected = boxVertices(box).map((point) => projectPoint(point, scene, yaw, pitch, scale));
      return FACE_INDICES.map((indices) => {
        const points = indices.map((index) => projected[index]);
        return {
          boxId: box.id,
          points: points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" "),
          depth: points.reduce((sum, point) => sum + point.depth, 0) / points.length,
          fill: BOX_FILLS[boxIndex % BOX_FILLS.length],
        };
      });
    })
    .sort((a, b) => a.depth - b.depth);
}

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

function projectedGridLines(
  definition: Grid3DDefinition,
  scene: ResolvedGrid3DScene,
  yaw: number,
  pitch: number,
  scale: number,
): GridLine[] {
  const columnEdges = axisEdges(definition.columns, definition.gaps.column);
  const rowEdges = axisEdges(definition.rows, definition.gaps.row);
  return [
    ...columnEdges.map((x) => ({
      key: `column-${x}`,
      start: projectPoint({x, y: 0, z: 0}, scene, yaw, pitch, scale),
      end: projectPoint({x, y: 0, z: scene.depth}, scene, yaw, pitch, scale),
    })),
    ...rowEdges.map((z) => ({
      key: `row-${z}`,
      start: projectPoint({x: 0, y: 0, z}, scene, yaw, pitch, scale),
      end: projectPoint({x: scene.width, y: 0, z}, scene, yaw, pitch, scale),
    })),
  ];
}

function boxLabelPoint(
  box: ResolvedGrid3DBox,
  scene: ResolvedGrid3DScene,
  yaw: number,
  pitch: number,
  scale: number,
): ProjectedPoint {
  return projectPoint(
    {
      x: box.x + box.width / 2,
      y: box.y + box.height,
      z: box.z + box.depth / 2,
    },
    scene,
    yaw,
    pitch,
    scale,
  );
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function Grid3DEditor() {
  const [source, setSource] = useState(HOUSE_GRID_3D_SOURCE);
  const [definition, setDefinition] = useState<Grid3DDefinition>(INITIAL_DEFINITION);
  const [scene, setScene] = useState<ResolvedGrid3DScene>(INITIAL_SCENE);
  const [selectedId, setSelectedId] = useState<string>(INITIAL_SCENE.boxes[0]?.id ?? "");
  const [rendererMode, setRendererMode] = useState<Grid3DRendererMode>("three");
  const [view, setView] = useState<Grid3DView>(DEFAULT_GRID3D_VIEW);
  const [error, setError] = useState<string | null>(null);
  const scale = sceneScale(scene) * view.zoom / 100;

  const faces = useMemo(
    () => projectedFaces(scene, view.yaw, view.pitch, scale),
    [scene, view.yaw, view.pitch, scale],
  );
  const gridLines = useMemo(
    () => projectedGridLines(definition, scene, view.yaw, view.pitch, scale),
    [definition, scene, view.yaw, view.pitch, scale],
  );
  const labels = useMemo(
    () => scene.boxes.map((box) => ({box, point: boxLabelPoint(box, scene, view.yaw, view.pitch, scale)})),
    [scene, view.yaw, view.pitch, scale],
  );
  const selected = scene.boxes.find((box) => box.id === selectedId) ?? null;

  function updateView(patch: Partial<Grid3DView>) {
    setView((current) => normalizeGrid3DView({...current, ...patch}));
  }

  function applySource() {
    try {
      const nextDefinition = parseGrid3DSource(source);
      const nextScene = resolveGrid3D(nextDefinition);
      setDefinition(nextDefinition);
      setScene(nextScene);
      setSelectedId((current) => nextScene.boxes.some((box) => box.id === current)
        ? current
        : (nextScene.boxes[0]?.id ?? ""));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The Grid3D source could not be parsed.");
    }
  }

  function restoreExample() {
    setSource(HOUSE_GRID_3D_SOURCE);
    setDefinition(INITIAL_DEFINITION);
    setScene(INITIAL_SCENE);
    setSelectedId(INITIAL_SCENE.boxes[0]?.id ?? "");
    setView(DEFAULT_GRID3D_VIEW);
    setError(null);
  }

  return (
    <section className="grid3d-editor" aria-label="3D grid layout editor">
      <div className="grid3d-source-panel">
        <div className="grid3d-panel-heading">
          <div>
            <div className="eyebrow">Layout source</div>
            <h2>CSS-like rules</h2>
          </div>
          <p>Columns run on X, rows run into Z, and layers stack upward on Y.</p>
        </div>

        <textarea
          className="grid3d-source"
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            setError(null);
          }}
          spellCheck={false}
          aria-label="Grid3D source"
        />

        {error ? <p className="grid3d-error" role="alert">{error}</p> : null}

        <div className="grid3d-source-actions">
          <button type="button" className="grid3d-primary-action" onClick={applySource}>Apply layout</button>
          <button type="button" className="grid3d-secondary-action" onClick={restoreExample}>Restore house example</button>
        </div>

        <p className="grid3d-source-note">
          Layout resolution remains renderer-independent. Three.js receives only the resolved boxes and track geometry;
          the built-in SVG projection remains available as a deterministic fallback.
        </p>
      </div>

      <div className="grid3d-viewer-panel">
        <div className="grid3d-viewer-toolbar">
          <div className="grid3d-renderer-switch" role="group" aria-label="3D renderer">
            <button
              type="button"
              aria-pressed={rendererMode === "three"}
              onClick={() => setRendererMode("three")}
            >
              Three.js
            </button>
            <button
              type="button"
              aria-pressed={rendererMode === "svg"}
              onClick={() => setRendererMode("svg")}
            >
              SVG
            </button>
          </div>
          <label>
            <span>Yaw</span>
            <input
              type="range"
              min="-180"
              max="180"
              value={view.yaw}
              onChange={(event) => updateView({yaw: Number(event.target.value)})}
            />
            <output>{Math.round(view.yaw)}°</output>
          </label>
          <label>
            <span>Pitch</span>
            <input
              type="range"
              min="5"
              max="85"
              value={view.pitch}
              onChange={(event) => updateView({pitch: Number(event.target.value)})}
            />
            <output>{Math.round(view.pitch)}°</output>
          </label>
          <label>
            <span>Zoom</span>
            <input
              type="range"
              min="45"
              max="180"
              value={view.zoom}
              onChange={(event) => updateView({zoom: Number(event.target.value)})}
            />
            <output>{Math.round(view.zoom)}%</output>
          </label>
          <label className="grid3d-object-select">
            <span>Inspect box</span>
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              {scene.boxes.map((box) => <option key={box.id} value={box.id}>{box.id}</option>)}
            </select>
          </label>
        </div>

        <div className="grid3d-viewport" data-renderer={rendererMode}>
          {rendererMode === "three" ? (
            <Grid3DThreeViewer
              definition={definition}
              scene={scene}
              selectedId={selectedId}
              view={view}
              onSelect={setSelectedId}
              onViewChange={setView}
            />
          ) : (
            <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} role="img" aria-label="Resolved three-dimensional grid layout">
              <g className="grid3d-floor-grid" aria-hidden="true">
                {gridLines.map((line) => (
                  <line
                    key={line.key}
                    x1={line.start.x}
                    y1={line.start.y}
                    x2={line.end.x}
                    y2={line.end.y}
                  />
                ))}
              </g>

              <g className="grid3d-box-faces">
                {faces.map((face, index) => (
                  <polygon
                    key={`${face.boxId}-${index}`}
                    points={face.points}
                    fill={face.fill}
                    className={face.boxId === selectedId ? "is-selected" : undefined}
                    onClick={() => setSelectedId(face.boxId)}
                  />
                ))}
              </g>

              <g className="grid3d-labels" aria-hidden="true">
                {labels.map(({box, point}) => (
                  <text key={box.id} x={point.x} y={point.y - 8}>{box.id}</text>
                ))}
              </g>
            </svg>
          )}
        </div>

        <div className="grid3d-resolved-readout" aria-live="polite">
          {selected ? (
            <>
              <strong>{selected.id}</strong>
              <span>position x {format(selected.x)} · y {format(selected.y)} · z {format(selected.z)}</span>
              <span>size {format(selected.width)} × {format(selected.height)} × {format(selected.depth)}</span>
              <span>renderer {rendererMode === "three" ? "Three.js / WebGL" : "SVG projection"}</span>
            </>
          ) : (
            <span>Add a box to the source to inspect resolved geometry.</span>
          )}
        </div>
      </div>
    </section>
  );
}
