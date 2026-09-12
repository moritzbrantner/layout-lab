import {buildFlexAlgorithmPipeline, buildGridAlgorithmPipeline, type AlgorithmScenario} from "./algorithm-pipeline";

export type AlgorithmCorpusCase = {
  id: string;
  scenario: AlgorithmScenario;
  title: string;
  purpose: string;
  expectedGeometry: readonly string[];
  actualGeometry: readonly string[];
  passes: boolean;
};

function geometryMatches(actual: readonly string[], expected: readonly string[]) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function flexCase(
  definition: Omit<AlgorithmCorpusCase, "actualGeometry" | "passes"> & {
    innerSize: number;
    gapSize: number;
    items: Parameters<typeof buildFlexAlgorithmPipeline>[0] extends infer Options
      ? Options extends {items?: infer Items}
        ? Items
        : never
      : never;
  },
): AlgorithmCorpusCase {
  const {innerSize, gapSize, items, ...metadata} = definition;
  const actualGeometry = buildFlexAlgorithmPipeline({innerSize, gapSize, items}).finalGeometry;
  return {
    ...metadata,
    actualGeometry,
    passes: geometryMatches(actualGeometry, metadata.expectedGeometry),
  };
}

function gridCase(
  definition: Omit<AlgorithmCorpusCase, "actualGeometry" | "passes"> & {
    innerSize: number;
    gapSize: number;
    tracks: Parameters<typeof buildGridAlgorithmPipeline>[0] extends infer Options
      ? Options extends {tracks?: infer Tracks}
        ? Tracks
        : never
      : never;
    contributions?: Parameters<typeof buildGridAlgorithmPipeline>[0] extends infer Options
      ? Options extends {contributions?: infer Contributions}
        ? Contributions
        : never
      : never;
  },
): AlgorithmCorpusCase {
  const {innerSize, gapSize, tracks, contributions = [], ...metadata} = definition;
  const actualGeometry = buildGridAlgorithmPipeline({innerSize, gapSize, tracks, contributions}).finalGeometry;
  return {
    ...metadata,
    actualGeometry,
    passes: geometryMatches(actualGeometry, metadata.expectedGeometry),
  };
}

export const algorithmCorpusCases: readonly AlgorithmCorpusCase[] = [
  flexCase({
    id: "flex-grow-evenly",
    scenario: "flex",
    title: "Positive free-space distribution",
    purpose: "Two equal grow factors split the remaining main-axis space after the gap.",
    innerSize: 360,
    gapSize: 10,
    items: [
      {label: "A", basis: 100, grow: 1, shrink: 1, minSize: 0, maxSize: 300},
      {label: "B", basis: 100, grow: 1, shrink: 1, minSize: 0, maxSize: 300},
    ],
    expectedGeometry: ["A: 175px", "B: 175px"],
  }),
  flexCase({
    id: "flex-shrink-min-clamp",
    scenario: "flex",
    title: "Shrink with a frozen minimum",
    purpose: "A hits its minimum first, freezes, and the remaining deficit is redistributed to B.",
    innerSize: 250,
    gapSize: 10,
    items: [
      {label: "A", basis: 160, grow: 0, shrink: 1, minSize: 150, maxSize: 300},
      {label: "B", basis: 160, grow: 0, shrink: 1, minSize: 80, maxSize: 300},
    ],
    expectedGeometry: ["A: 150px", "B: 90px"],
  }),
  gridCase({
    id: "grid-minimum-freeze",
    scenario: "grid",
    title: "Track minimum beats the common fraction",
    purpose: "A cannot shrink to the initial 1fr size, so it freezes at its minimum before B is recalculated.",
    innerSize: 300,
    gapSize: 10,
    tracks: [
      {label: "A", minSize: 180, fr: 1},
      {label: "B", minSize: 50, fr: 1},
    ],
    expectedGeometry: ["A: 180px", "B: 110px"],
  }),
  gridCase({
    id: "grid-spanning-minimum",
    scenario: "grid",
    title: "Spanning minimum grows both bases",
    purpose: "A two-track minimum contribution grows both bases before the flexible fraction is resolved.",
    innerSize: 300,
    gapSize: 10,
    tracks: [
      {label: "A", minSize: 80, fr: 1},
      {label: "B", minSize: 80, fr: 1},
    ],
    contributions: [
      {label: "span A+B", start: 0, span: 2, minSize: 300},
    ],
    expectedGeometry: ["A: 145px", "B: 145px"],
  }),
];
