import {
  resolveFlexLine,
  resolveMinMaxFractionTracks,
  type FlexItemInput,
  type GridSpanContribution,
  type GridTrackInput,
} from "./layout-analysis";

export type AlgorithmScenario = "flex" | "grid";
export type AlgorithmNodeKind = "input" | "constraint" | "iteration" | "output";
export type AlgorithmEdgeKind = "dependency" | "feedback";
export type AlgorithmPhaseId = "inputs" | "constraints" | "resolution" | "output";

export type AlgorithmPhase = {
  id: AlgorithmPhaseId;
  label: string;
  summary: string;
};

export type AlgorithmNode = {
  id: string;
  label: string;
  detail: string;
  kind: AlgorithmNodeKind;
  phase: AlgorithmPhaseId;
};

export type AlgorithmEdge = {
  from: string;
  to: string;
  kind: AlgorithmEdgeKind;
  label: string;
};

export type AlgorithmPipeline = {
  scenario: AlgorithmScenario;
  title: string;
  summary: string;
  phases: readonly AlgorithmPhase[];
  nodes: readonly AlgorithmNode[];
  edges: readonly AlgorithmEdge[];
  finalGeometry: readonly string[];
};

export const algorithmPhases: readonly AlgorithmPhase[] = [
  {
    id: "inputs",
    label: "Declared inputs",
    summary: "Sizes, gaps, factors, track definitions, and contributions enter the deterministic model.",
  },
  {
    id: "constraints",
    label: "Derived constraints",
    summary: "The resolver turns declared values into free-space, minimum, and base-size constraints.",
  },
  {
    id: "resolution",
    label: "Iterative resolution",
    summary: "Flexible values are distributed, violating items or tracks freeze, and remaining space is recomputed.",
  },
  {
    id: "output",
    label: "Resolved geometry",
    summary: "The final main sizes or track sizes become geometry that can be compared with browser evidence.",
  },
] as const;

const defaultFlexItems: readonly FlexItemInput[] = [
  {label: "A", basis: 120, grow: 1, shrink: 1, minSize: 80, maxSize: 220},
  {label: "B", basis: 132, grow: 8, shrink: 1, minSize: 96, maxSize: 184},
  {label: "C", basis: 112, grow: 2, shrink: 1, minSize: 72, maxSize: 240},
];

const defaultGridTracks: readonly GridTrackInput[] = [
  {label: "A", minSize: 96, fr: 1},
  {label: "B", minSize: 164, fr: 1},
  {label: "C", minSize: 88, fr: 2},
];

const defaultGridContributions: readonly GridSpanContribution[] = [
  {label: "span A+B", start: 0, span: 2, minSize: 300},
];

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function px(value: number) {
  return `${round(value)}px`;
}

function joinValues(values: readonly string[]) {
  return values.length > 0 ? values.join(" · ") : "none";
}

export function buildFlexAlgorithmPipeline({
  innerSize = 520,
  gapSize = 16,
  items = defaultFlexItems,
}: {
  innerSize?: number;
  gapSize?: number;
  items?: readonly FlexItemInput[];
} = {}): AlgorithmPipeline {
  const resolution = resolveFlexLine({innerSize, gapSize, items});
  const frozenLabels = resolution.items.filter((item) => item.frozen).map((item) => item.label);
  const iterationLabels = resolution.iterations.map((iteration) => {
    const frozen = iteration.newlyFrozen.length > 0 ? `; freeze ${iteration.newlyFrozen.join(", ")}` : "";
    return `pass ${iteration.iteration}: ${px(iteration.freeSpace)} free${frozen}`;
  });

  const nodes: AlgorithmNode[] = [
    {
      id: "container-size",
      label: "Container main size",
      detail: px(resolution.innerSize),
      kind: "input",
      phase: "inputs",
    },
    {
      id: "gap",
      label: "Inter-item gaps",
      detail: `${Math.max(0, items.length - 1)} gaps = ${px(resolution.totalGap)}`,
      kind: "input",
      phase: "inputs",
    },
    {
      id: "flex-bases",
      label: "Flex bases",
      detail: joinValues(resolution.items.map((item) => `${item.label} ${px(item.basis)}`)),
      kind: "input",
      phase: "inputs",
    },
    {
      id: "flex-factors",
      label: "Flex factors",
      detail: joinValues(resolution.items.map((item) => `${item.label} grow ${item.grow} / shrink ${item.shrink}`)),
      kind: "input",
      phase: "inputs",
    },
    {
      id: "min-max-bounds",
      label: "Min/max bounds",
      detail: joinValues(
        resolution.items.map((item) => `${item.label} ${px(item.minSize)}…${Number.isFinite(item.maxSize) ? px(item.maxSize) : "∞"}`),
      ),
      kind: "constraint",
      phase: "constraints",
    },
    {
      id: "free-space",
      label: "Free space",
      detail: `${px(resolution.freeSpace)} → ${resolution.mode}`,
      kind: "constraint",
      phase: "constraints",
    },
    {
      id: "weighted-distribution",
      label: "Weighted distribution",
      detail: resolution.mode === "none"
        ? "No flexible distribution is required."
        : `${resolution.mode} factor sum ${round(resolution.factorSum)}`,
      kind: "iteration",
      phase: "resolution",
    },
    {
      id: "freeze-loop",
      label: "Clamp / freeze loop",
      detail: iterationLabels.length > 0
        ? joinValues(iterationLabels)
        : `single clamp pass; frozen ${joinValues(frozenLabels)}`,
      kind: "iteration",
      phase: "resolution",
    },
    {
      id: "final-sizes",
      label: "Final item sizes",
      detail: joinValues(resolution.items.map((item) => `${item.label} ${px(item.targetSize)}`)),
      kind: "output",
      phase: "output",
    },
  ];

  const edges: AlgorithmEdge[] = [
    {from: "container-size", to: "free-space", kind: "dependency", label: "available size"},
    {from: "gap", to: "free-space", kind: "dependency", label: "subtract gaps"},
    {from: "flex-bases", to: "free-space", kind: "dependency", label: "subtract bases"},
    {from: "free-space", to: "weighted-distribution", kind: "dependency", label: "space to distribute"},
    {from: "flex-factors", to: "weighted-distribution", kind: "dependency", label: "weights"},
    {from: "weighted-distribution", to: "freeze-loop", kind: "dependency", label: "candidate targets"},
    {from: "min-max-bounds", to: "freeze-loop", kind: "dependency", label: "clamp candidates"},
    {from: "freeze-loop", to: "final-sizes", kind: "dependency", label: "accepted targets"},
  ];

  if (resolution.iterations.length > 1 || resolution.frozenCount > 0) {
    edges.push({
      from: "freeze-loop",
      to: "weighted-distribution",
      kind: "feedback",
      label: "recompute remaining free space after freezing",
    });
  }

  return {
    scenario: "flex",
    title: "Flexbox free-space resolution",
    summary: "Trace basis, free-space, weighted distribution, min/max clamping, and repeated freezing into final item sizes.",
    phases: algorithmPhases,
    nodes,
    edges,
    finalGeometry: resolution.items.map((item) => `${item.label}: ${px(item.targetSize)}`),
  };
}

export function buildGridAlgorithmPipeline({
  innerSize = 560,
  gapSize = 16,
  tracks = defaultGridTracks,
  contributions = defaultGridContributions,
}: {
  innerSize?: number;
  gapSize?: number;
  tracks?: readonly GridTrackInput[];
  contributions?: readonly GridSpanContribution[];
} = {}): AlgorithmPipeline {
  const resolution = resolveMinMaxFractionTracks({innerSize, gapSize, tracks, contributions});
  const flexibleFrozen = resolution.tracks.filter((track) => track.fr > 0 && track.frozen).map((track) => track.label);
  const contributionDetail = resolution.contributionSteps.length > 0
    ? joinValues(
        resolution.contributionSteps.map((step) => `${step.label}: +${px(step.deficit)} across ${step.span} tracks`),
      )
    : "No spanning minimum contribution grows a base track.";

  const nodes: AlgorithmNode[] = [
    {
      id: "container-size",
      label: "Grid inline size",
      detail: px(resolution.innerSize),
      kind: "input",
      phase: "inputs",
    },
    {
      id: "gap",
      label: "Track gaps",
      detail: px(resolution.totalGap),
      kind: "input",
      phase: "inputs",
    },
    {
      id: "track-definitions",
      label: "Track definitions",
      detail: joinValues(tracks.map((track) => `${track.label} min ${px(track.minSize)} / ${track.fr}fr`)),
      kind: "input",
      phase: "inputs",
    },
    {
      id: "span-contributions",
      label: "Spanning contributions",
      detail: contributions.length > 0
        ? joinValues(contributions.map((contribution) => `${contribution.label} ≥ ${px(contribution.minSize)}`))
        : "none",
      kind: "input",
      phase: "inputs",
    },
    {
      id: "base-growth",
      label: "Base-size growth",
      detail: contributionDetail,
      kind: "constraint",
      phase: "constraints",
    },
    {
      id: "available-track-space",
      label: "Available track space",
      detail: `${px(resolution.availableForTracks)} after gaps`,
      kind: "constraint",
      phase: "constraints",
    },
    {
      id: "flex-fraction",
      label: "Flexible fraction",
      detail: `1fr = ${px(resolution.flexFraction)}`,
      kind: "iteration",
      phase: "resolution",
    },
    {
      id: "freeze-tracks",
      label: "Minimum / freeze loop",
      detail: flexibleFrozen.length > 0
        ? `minimum wins for ${flexibleFrozen.join(", ")}; recalculate the remaining fraction`
        : "all flexible tracks accept the common fraction",
      kind: "iteration",
      phase: "resolution",
    },
    {
      id: "final-tracks",
      label: "Final track sizes",
      detail: joinValues(resolution.tracks.map((track) => `${track.label} ${px(track.targetSize)}`)),
      kind: "output",
      phase: "output",
    },
  ];

  const edges: AlgorithmEdge[] = [
    {from: "track-definitions", to: "base-growth", kind: "dependency", label: "initial minimums"},
    {from: "span-contributions", to: "base-growth", kind: "dependency", label: "minimum contributions"},
    {from: "container-size", to: "available-track-space", kind: "dependency", label: "available inline size"},
    {from: "gap", to: "available-track-space", kind: "dependency", label: "subtract gaps"},
    {from: "base-growth", to: "flex-fraction", kind: "dependency", label: "grown bases"},
    {from: "available-track-space", to: "flex-fraction", kind: "dependency", label: "space for tracks"},
    {from: "flex-fraction", to: "freeze-tracks", kind: "dependency", label: "candidate flexible sizes"},
    {from: "base-growth", to: "freeze-tracks", kind: "dependency", label: "minimum floors"},
    {from: "freeze-tracks", to: "final-tracks", kind: "dependency", label: "accepted track sizes"},
  ];

  if (flexibleFrozen.length > 0) {
    edges.push({
      from: "freeze-tracks",
      to: "flex-fraction",
      kind: "feedback",
      label: "remove frozen tracks and recompute 1fr",
    });
  }

  return {
    scenario: "grid",
    title: "Grid track resolution",
    summary: "Trace track minimums and spanning contributions into base growth, flexible-fraction resolution, freezing, and final tracks.",
    phases: algorithmPhases,
    nodes,
    edges,
    finalGeometry: resolution.tracks.map((track) => `${track.label}: ${px(track.targetSize)}`),
  };
}

export function validateAlgorithmPipeline(pipeline: AlgorithmPipeline): string[] {
  const errors: string[] = [];
  const phaseIds = new Set(pipeline.phases.map((phase) => phase.id));
  const nodeIds = new Set<string>();

  for (const node of pipeline.nodes) {
    if (nodeIds.has(node.id)) errors.push(`duplicate node id: ${node.id}`);
    nodeIds.add(node.id);
    if (!phaseIds.has(node.phase)) errors.push(`unknown phase for ${node.id}: ${node.phase}`);
  }

  for (const edge of pipeline.edges) {
    if (!nodeIds.has(edge.from)) errors.push(`missing edge source: ${edge.from}`);
    if (!nodeIds.has(edge.to)) errors.push(`missing edge target: ${edge.to}`);
  }

  if (!pipeline.nodes.some((node) => node.kind === "output")) errors.push("pipeline has no output node");
  return errors;
}
