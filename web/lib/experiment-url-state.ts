import type {Experiment} from "./experiments";

type SelectUrlControl = {
  key: string;
  label: string;
  kind: "select";
  defaultValue: string;
  options: readonly string[];
};

type NumberUrlControl = {
  key: string;
  label: string;
  kind: "number";
  defaultValue: string;
  min: number;
  max: number;
  step: number;
};

type BooleanUrlControl = {
  key: string;
  label: string;
  kind: "boolean";
  defaultValue: "0" | "1";
};

export type ExperimentUrlControl = SelectUrlControl | NumberUrlControl | BooleanUrlControl;
export type ExperimentUrlSchema = readonly ExperimentUrlControl[];

const flexSchema: ExperimentUrlSchema = [
  {key: "direction", label: "direction", kind: "select", defaultValue: "row", options: ["row", "row-reverse", "column", "column-reverse"]},
  {key: "justify", label: "justify-content", kind: "select", defaultValue: "space-between", options: ["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"]},
  {key: "align", label: "align-items", kind: "select", defaultValue: "center", options: ["stretch", "flex-start", "center", "flex-end"]},
  {key: "gap", label: "gap", kind: "number", defaultValue: "16", min: 0, max: 40, step: 1},
  {key: "grow", label: "enable B/C flex-grow", kind: "boolean", defaultValue: "0"},
];

const gridSchema: ExperimentUrlSchema = [
  {key: "columns", label: "columns", kind: "number", defaultValue: "3", min: 2, max: 5, step: 1},
  {key: "gap", label: "gap", kind: "number", defaultValue: "14", min: 0, max: 32, step: 1},
  {key: "dense", label: "dense auto-placement", kind: "boolean", defaultValue: "0"},
];

const intrinsicSizingSchema: ExperimentUrlSchema = [
  {key: "width", label: "containing block", kind: "number", defaultValue: "460", min: 220, max: 620, step: 10},
  {key: "wrap", label: "overflow-wrap", kind: "select", defaultValue: "normal", options: ["normal", "anywhere"]},
];

const positioningSchema: ExperimentUrlSchema = [
  {key: "x", label: "left", kind: "number", defaultValue: "84", min: 0, max: 220, step: 1},
  {key: "y", label: "top", kind: "number", defaultValue: "62", min: 0, max: 130, step: 1},
  {key: "rotate", label: "rotate", kind: "number", defaultValue: "12", min: -45, max: 45, step: 1},
  {key: "scale", label: "scale", kind: "number", defaultValue: "1", min: 0.5, max: 1.5, step: 0.05},
];

const transforms3dSchema: ExperimentUrlSchema = [
  {key: "perspective", label: "perspective", kind: "number", defaultValue: "700", min: 300, max: 1400, step: 20},
  {key: "rotateX", label: "rotateX", kind: "number", defaultValue: "-18", min: -60, max: 60, step: 1},
  {key: "rotateY", label: "rotateY", kind: "number", defaultValue: "28", min: -60, max: 60, step: 1},
  {key: "depth", label: "Z separation", kind: "number", defaultValue: "70", min: 20, max: 140, step: 1},
];

const algorithmPipelineSchema: ExperimentUrlSchema = [
  {key: "width", label: "Container size", kind: "number", defaultValue: "520", min: 360, max: 760, step: 10},
  {key: "gap", label: "Gap", kind: "number", defaultValue: "16", min: 0, max: 40, step: 2},
  {
    key: "algorithm",
    label: "algorithm",
    kind: "select",
    defaultValue: "block-flow",
    options: [
      "block-flow",
      "flex-row",
      "grid-row",
      "constraint-cassowary",
      "line-greedy",
      "line-knuth-plass",
      "packing-shortest-column",
      "packing-first-fit",
      "tree-tidy",
      "dag-sugiyama",
      "graph-force",
    ],
  },
];

export const experimentUrlSchemas: Partial<Record<Experiment["id"], ExperimentUrlSchema>> = {
  flex: flexSchema,
  grid: gridSchema,
  "intrinsic-sizing": intrinsicSizingSchema,
  positioning: positioningSchema,
  "transforms-3d": transforms3dSchema,
  "algorithm-pipeline": algorithmPipelineSchema,
};

function parameterName(experimentId: Experiment["id"], control: ExperimentUrlControl): string {
  return `${experimentId}.${control.key}`;
}

function isStepAligned(value: number, min: number, step: number): boolean {
  const steps = (value - min) / step;
  return Math.abs(steps - Math.round(steps)) <= 1e-7;
}

export function normalizeExperimentUrlValue(
  control: ExperimentUrlControl,
  rawValue: string | null | undefined,
): string | undefined {
  if (rawValue === null || rawValue === undefined) return undefined;

  if (control.kind === "select") {
    return control.options.includes(rawValue) ? rawValue : undefined;
  }

  if (control.kind === "boolean") {
    if (rawValue === "1" || rawValue === "true") return "1";
    if (rawValue === "0" || rawValue === "false") return "0";
    return undefined;
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < control.min || value > control.max) return undefined;
  if (!isStepAligned(value, control.min, control.step)) return undefined;
  return String(value);
}

export function readExperimentUrlState(
  search: string,
  experimentId: Experiment["id"],
  schema: ExperimentUrlSchema,
): Record<string, string> {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return Object.fromEntries(schema.map((control) => {
    const value = normalizeExperimentUrlValue(control, params.get(parameterName(experimentId, control)));
    return [control.key, value ?? control.defaultValue];
  }));
}

export function writeExperimentUrlState(
  search: string,
  experimentId: Experiment["id"],
  schema: ExperimentUrlSchema,
  values: Readonly<Record<string, string>>,
): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  for (const control of schema) {
    const name = parameterName(experimentId, control);
    params.delete(name);
    const normalized = normalizeExperimentUrlValue(control, values[control.key]);
    const value = normalized ?? control.defaultValue;
    if (value !== control.defaultValue) params.append(name, value);
  }

  return params.toString();
}
