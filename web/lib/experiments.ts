export type ExperimentArea = "2D" | "3D";

export type Experiment = {
  id: "flex" | "grid" | "intrinsic-sizing" | "positioning" | "transforms-3d";
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
] as const;
