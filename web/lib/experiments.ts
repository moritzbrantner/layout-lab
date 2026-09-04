export type ExperimentArea = "2D" | "3D";

export type Experiment = {
  id:
    | "flex"
    | "grid"
    | "intrinsic-sizing"
    | "positioning"
    | "transforms-3d"
    | "flex-freezing"
    | "grid-track-sizing"
    | "grid-intrinsic"
    | "grid-auto-repeat";
  title: string;
  area: ExperimentArea;
  summary: string;
  properties: readonly string[];
};

export const experiments: readonly Experiment[] = [
  {
    id: "flex",
    title: "Flexbox",
    area: "2D",
    summary: "Resolve a one-dimensional layout across main and cross axes, then inspect how free space is distributed.",
    properties: ["display", "flex-basis", "flex-grow", "flex-shrink", "justify-content", "align-items", "gap"],
  },
  {
    id: "grid",
    title: "Grid",
    area: "2D",
    summary: "Place items into explicit fractional tracks and expose the track-size arithmetic behind the final boxes.",
    properties: ["display", "grid-template-columns", "grid-auto-flow", "grid-column", "gap", "fr"],
  },
  {
    id: "intrinsic-sizing",
    title: "Intrinsic sizing",
    area: "2D",
    summary: "Compare min-content, max-content, and fit-content while the available inline size changes.",
    properties: ["width", "min-content", "max-content", "fit-content", "overflow-wrap"],
  },
  {
    id: "positioning",
    title: "2D positioning",
    area: "2D",
    summary: "Move an absolutely positioned box inside its containing block, then transform it.",
    properties: ["position", "left", "top", "rotate", "scale"],
  },
  {
    id: "transforms-3d",
    title: "3D transforms",
    area: "3D",
    summary: "Inspect perspective and Z separation inside a preserved 3D transform context.",
    properties: ["perspective", "transform-style", "rotateX", "rotateY", "translateZ"],
  },
  {
    id: "flex-freezing",
    title: "Flex freezing",
    area: "2D",
    summary: "Step through repeated min/max clamping, freezing, and free-space redistribution on a single flex line.",
    properties: ["flex-basis", "flex-grow", "flex-shrink", "min-width", "max-width"],
  },
  {
    id: "grid-track-sizing",
    title: "Grid track sizing",
    area: "2D",
    summary: "Follow minmax track bases through a spanning minimum contribution and into flexible track resolution.",
    properties: ["minmax", "fr", "grid-column", "min-width", "gap"],
  },
  {
    id: "grid-intrinsic",
    title: "Intrinsic Grid tracks",
    area: "2D",
    summary: "Use a browser-measured min-content contribution as the base for an intrinsic minmax track, then explain the flexible phase.",
    properties: ["min-content", "minmax", "fr", "overflow-wrap", "grid-template-columns"],
  },
  {
    id: "grid-auto-repeat",
    title: "Grid auto-repeat",
    area: "2D",
    summary: "Compare auto-fit and auto-fill by making explicit capacity, empty tracks, collapse, and redistributed free space visible.",
    properties: ["repeat", "auto-fit", "auto-fill", "minmax", "fr", "gap"],
  },
] as const;
