import type {LayoutBox} from "./layout-engine";

export const DEFAULT_GEOMETRY_TOLERANCE = 0.5;

export type BrowserLayoutGeometry = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GeometryField = "x" | "y" | "width" | "height";

export type GeometryDelta = {
  field: GeometryField;
  engine: number;
  browser: number;
  delta: number;
  matches: boolean;
};

export type GeometryComparison = {
  id: string;
  engine: BrowserLayoutGeometry | null;
  browser: BrowserLayoutGeometry | null;
  fields: readonly GeometryDelta[];
  matches: boolean;
  maximumDelta: number;
};

function toGeometry(box: LayoutBox): BrowserLayoutGeometry {
  return {
    id: box.id,
    x: box.rect.x,
    y: box.rect.y,
    width: box.rect.width,
    height: box.rect.height,
  };
}

function browserGeometryFor(element: HTMLElement, origin: DOMRect): BrowserLayoutGeometry {
  const rect = element.getBoundingClientRect();
  return {
    id: element.dataset.layoutEngineNode ?? "",
    x: rect.left - origin.left,
    y: rect.top - origin.top,
    width: rect.width,
    height: rect.height,
  };
}

export function measureBrowserLayout(root: HTMLElement): BrowserLayoutGeometry[] {
  const rootId = root.dataset.layoutEngineNode;
  if (!rootId) throw new Error("browser layout root requires data-layout-engine-node");
  const rootRect = root.getBoundingClientRect();
  const geometry = [browserGeometryFor(root, rootRect)];

  root.querySelectorAll<HTMLElement>("[data-layout-engine-node]").forEach((element) => {
    const id = element.dataset.layoutEngineNode;
    if (!id) return;
    geometry.push(browserGeometryFor(element, rootRect));
  });

  return geometry;
}

export function compareLayoutGeometry(
  engineBoxes: readonly LayoutBox[],
  browserGeometry: readonly BrowserLayoutGeometry[],
  tolerance = DEFAULT_GEOMETRY_TOLERANCE,
): GeometryComparison[] {
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new Error("geometry tolerance must be finite and non-negative");
  }

  const engineById = new Map(engineBoxes.map((box) => [box.id, toGeometry(box)]));
  const browserById = new Map(browserGeometry.map((geometry) => [geometry.id, geometry]));
  const ids = [...new Set([...engineById.keys(), ...browserById.keys()])].sort();

  return ids.map((id): GeometryComparison => {
    const engine = engineById.get(id) ?? null;
    const browser = browserById.get(id) ?? null;
    if (!engine || !browser) {
      return {
        id,
        engine,
        browser,
        fields: [],
        matches: false,
        maximumDelta: Number.POSITIVE_INFINITY,
      };
    }

    const fields: GeometryField[] = ["x", "y", "width", "height"];
    const deltas = fields.map((field): GeometryDelta => {
      const delta = Math.abs(engine[field] - browser[field]);
      return {
        field,
        engine: engine[field],
        browser: browser[field],
        delta,
        matches: delta <= tolerance,
      };
    });

    return {
      id,
      engine,
      browser,
      fields: deltas,
      matches: deltas.every((delta) => delta.matches),
      maximumDelta: Math.max(...deltas.map((delta) => delta.delta)),
    };
  });
}
