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

export type GeometryComparisonPolicy = {
  version: string;
  tolerance: Readonly<Record<GeometryField, number>>;
  roundingDecimals: number;
};

export const DEFAULT_GEOMETRY_POLICY: GeometryComparisonPolicy = {
  version: "layout-geometry-v1",
  tolerance: {
    x: DEFAULT_GEOMETRY_TOLERANCE,
    y: DEFAULT_GEOMETRY_TOLERANCE,
    width: DEFAULT_GEOMETRY_TOLERANCE,
    height: DEFAULT_GEOMETRY_TOLERANCE,
  },
  roundingDecimals: 4,
};

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

function validatePolicy(policy: GeometryComparisonPolicy) {
  if (!policy.version.trim()) throw new Error("geometry comparison policy requires a version");
  if (!Number.isInteger(policy.roundingDecimals) || policy.roundingDecimals < 0 || policy.roundingDecimals > 12) {
    throw new Error("geometry roundingDecimals must be an integer between 0 and 12");
  }
  for (const field of ["x", "y", "width", "height"] as const) {
    const tolerance = policy.tolerance[field];
    if (!Number.isFinite(tolerance) || tolerance < 0) {
      throw new Error(`${field} geometry tolerance must be finite and non-negative`);
    }
  }
}

function normalizeNumber(value: number, decimals: number) {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function normalizeGeometry(
  geometry: BrowserLayoutGeometry,
  policy: GeometryComparisonPolicy,
): BrowserLayoutGeometry {
  return {
    id: geometry.id,
    x: normalizeNumber(geometry.x, policy.roundingDecimals),
    y: normalizeNumber(geometry.y, policy.roundingDecimals),
    width: normalizeNumber(geometry.width, policy.roundingDecimals),
    height: normalizeNumber(geometry.height, policy.roundingDecimals),
  };
}

export function compareLayoutGeometryWithPolicy(
  engineBoxes: readonly LayoutBox[],
  browserGeometry: readonly BrowserLayoutGeometry[],
  policy: GeometryComparisonPolicy = DEFAULT_GEOMETRY_POLICY,
): GeometryComparison[] {
  validatePolicy(policy);

  const engineById = new Map(engineBoxes.map((box) => [box.id, normalizeGeometry(toGeometry(box), policy)]));
  const browserById = new Map(browserGeometry.map((geometry) => [geometry.id, normalizeGeometry(geometry, policy)]));
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
      const delta = normalizeNumber(Math.abs(engine[field] - browser[field]), policy.roundingDecimals);
      return {
        field,
        engine: engine[field],
        browser: browser[field],
        delta,
        matches: delta <= policy.tolerance[field],
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

export function compareLayoutGeometry(
  engineBoxes: readonly LayoutBox[],
  browserGeometry: readonly BrowserLayoutGeometry[],
  tolerance = DEFAULT_GEOMETRY_TOLERANCE,
): GeometryComparison[] {
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new Error("geometry tolerance must be finite and non-negative");
  }
  return compareLayoutGeometryWithPolicy(engineBoxes, browserGeometry, {
    version: "legacy-uniform-tolerance",
    tolerance: {x: tolerance, y: tolerance, width: tolerance, height: tolerance},
    roundingDecimals: 12,
  });
}
