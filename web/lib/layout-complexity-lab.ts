import {
  CassowarySolver,
  ConstraintStrength,
  ConstraintVariable,
  LinearConstraint,
  expression,
} from "./cassowary";
import {createIncrementalLayoutCache, recomputeIncrementalLayout} from "./incremental-layout";
import {
  resolveFlexLine,
  resolveMinMaxFractionTracks,
  type FlexItemInput,
  type GridSpanContribution,
  type GridTrackInput,
} from "./layout-analysis";
import {layoutBlockTree, type LayoutBox} from "./layout-engine";
import type {LayoutNode} from "./layout-tree";

export const COMPLEXITY_LAB_VERSION = "layout-complexity-v1";

export type ComplexitySuite = "flex" | "grid" | "constraints" | "incremental";

export type ComplexityValue = {
  key: string;
  label: string;
  value: number;
};

export type ComplexitySample = {
  id: string;
  suite: ComplexitySuite;
  title: string;
  dimensions: readonly ComplexityValue[];
  counters: readonly ComplexityValue[];
};

export type ComplexityPathology = {
  id: "flex-freeze-ladder" | "grid-freeze-ladder";
  title: string;
  summary: string;
  scale: number;
  passes: number;
  evaluations: number;
  freezeSequence: readonly (readonly string[])[];
};

export type ComplexityLabResult = {
  version: typeof COMPLEXITY_LAB_VERSION;
  methodology: readonly string[];
  samples: readonly ComplexitySample[];
  pathologies: readonly ComplexityPathology[];
};

function counter(key: string, label: string, value: number): ComplexityValue {
  return {key, label, value};
}

function flexScalingSample(itemCount: number): ComplexitySample {
  const items: FlexItemInput[] = Array.from({length: itemCount}, (_, index) => ({
    label: `item-${index + 1}`,
    basis: 100,
    grow: 1 + (index % 4),
    shrink: 1,
    minSize: 40,
    maxSize: index % 5 === 0 ? 110 : Number.POSITIVE_INFINITY,
  }));
  const result = resolveFlexLine({
    innerSize: itemCount * 160,
    gapSize: 4,
    items,
  });
  return {
    id: `flex-${itemCount}`,
    suite: "flex",
    title: `${itemCount} flex items`,
    dimensions: [counter("items", "items", itemCount)],
    counters: [
      counter("passes", "resolution passes", result.iterations.length),
      counter("freezes", "frozen items", result.frozenCount),
      counter("evaluations", "item evaluations", result.iterations.reduce((sum, iteration) => sum + iteration.items.length, 0)),
    ],
  };
}

function gridScalingSample(trackCount: number): ComplexitySample {
  const tracks: GridTrackInput[] = Array.from({length: trackCount}, (_, index) => ({
    label: `track-${index + 1}`,
    minSize: 40 + (index % 4) * 10,
    fr: 1 + (index % 3),
  }));
  const contributionCount = Math.max(1, Math.floor(trackCount / 4));
  const contributions: GridSpanContribution[] = Array.from({length: contributionCount}, (_, index) => {
    const span = Math.min(trackCount, 2 + (index % 2));
    const maxStart = Math.max(0, trackCount - span);
    const start = maxStart === 0 ? 0 : (index * 3) % (maxStart + 1);
    const currentMinimum = tracks.slice(start, start + span).reduce((sum, track) => sum + track.minSize, 0);
    return {
      label: `span-${index + 1}`,
      start,
      span,
      minSize: currentMinimum + Math.max(0, span - 1) * 4 + 24,
    };
  });
  const minimumTotal = tracks.reduce((sum, track) => sum + track.minSize, 0);
  const result = resolveMinMaxFractionTracks({
    innerSize: minimumTotal + trackCount * 80,
    gapSize: 4,
    tracks,
    contributions,
  });
  return {
    id: `grid-${trackCount}`,
    suite: "grid",
    title: `${trackCount} grid tracks`,
    dimensions: [
      counter("tracks", "tracks", trackCount),
      counter("spans", "spans", contributions.length),
    ],
    counters: [
      counter("contribution-steps", "contribution steps", result.contributionSteps.length),
      counter("span-visits", "spanned-track visits", result.contributionSteps.reduce((sum, step) => sum + step.span, 0)),
      counter("passes", "flex-track passes", result.flexIterations.length),
      counter("evaluations", "active-track evaluations", result.flexIterations.reduce((sum, iteration) => sum + iteration.activeTracks.length, 0)),
      counter("freezes", "frozen tracks", result.tracks.filter((track) => track.frozen).length),
    ],
  };
}

function constraintScalingSample(variableCount: number): ComplexitySample {
  const solver = new CassowarySolver();
  const variables = Array.from({length: variableCount}, (_, index) => new ConstraintVariable(`x${index}`));
  solver.addConstraint(new LinearConstraint("x0 = 0", expression(0, [variables[0]!, 1]), "=="));
  for (let index = 1; index < variables.length; index += 1) {
    solver.addConstraint(new LinearConstraint(
      `x${index} follows x${index - 1}`,
      expression(-10, [variables[index]!, 1], [variables[index - 1]!, -1]),
      "==",
    ));
  }
  variables.forEach((variable, index) => {
    solver.addConstraint(new LinearConstraint(
      `weak x${index} preference`,
      expression(-index * 12, [variable, 1]),
      "==",
      ConstraintStrength.weak,
    ));
  });
  solver.updateVariables();
  return {
    id: `constraints-${variableCount}`,
    suite: "constraints",
    title: `${variableCount} constrained variables`,
    dimensions: [
      counter("variables", "variables", variableCount),
      counter("constraints", "constraints", solver.constraintCount),
    ],
    counters: [
      counter("pivots", "simplex pivots", solver.pivotCount),
      counter("rows", "tableau rows", solver.rowCount),
      counter("operations", "incremental operations", solver.operations.length),
    ],
  };
}

function groupedBlockTree(groupCount: number, leavesPerGroup: number): LayoutNode {
  return {
    id: "scale-root",
    label: "Scale root",
    style: {display: "block", width: 1000},
    children: Array.from({length: groupCount}, (_, groupIndex) => ({
      id: `group-${groupIndex}`,
      label: `Group ${groupIndex}`,
      style: {display: "block", height: leavesPerGroup * 22, marginBlockAfter: 4},
      children: Array.from({length: leavesPerGroup}, (_, leafIndex) => ({
        id: `leaf-${groupIndex}-${leafIndex}`,
        label: `Leaf ${groupIndex}/${leafIndex}`,
        style: {display: "block", height: 20, width: 180},
        children: [],
      })),
    })),
  };
}

function updateNode(root: LayoutNode, nodeId: string, update: (node: LayoutNode) => LayoutNode): LayoutNode {
  if (root.id === nodeId) return update(root);
  return {...root, children: root.children.map((child) => updateNode(child, nodeId, update))};
}

function geometrySignature(boxes: readonly LayoutBox[]) {
  return JSON.stringify(boxes.map((box) => ({id: box.id, ...box.rect})));
}

function incrementalScalingSample(groupCount: number, leavesPerGroup: number, mutationCount: number): ComplexitySample {
  let tree = groupedBlockTree(groupCount, leavesPerGroup);
  let cache = createIncrementalLayoutCache(tree);
  let incrementalVisited = 0;
  let fullVisited = 0;
  let recomputedNodes = 0;
  let reusedNodes = 0;

  for (let mutationIndex = 0; mutationIndex < mutationCount; mutationIndex += 1) {
    const groupIndex = mutationIndex % groupCount;
    const leafIndex = mutationIndex % leavesPerGroup;
    const nodeId = `leaf-${groupIndex}-${leafIndex}`;
    const nextTree = updateNode(tree, nodeId, (node) => ({
      ...node,
      style: {...node.style, width: 180 + (mutationIndex + 1) * 5},
    }));
    const incremental = recomputeIncrementalLayout(cache, nextTree, {kind: "style", nodeId, field: "width"});
    const clean = layoutBlockTree(nextTree);
    if (geometrySignature(incremental.cache.boxes) !== geometrySignature(clean.boxes)) {
      throw new Error(`${nodeId}: incremental complexity sample diverged from clean layout`);
    }
    incrementalVisited += incremental.work.visitedNodes;
    fullVisited += clean.visitedNodes;
    recomputedNodes += incremental.recomputedNodeIds.length;
    reusedNodes += incremental.reusedNodeIds.length;
    cache = incremental.cache;
    tree = nextTree;
  }

  const nodeCount = 1 + groupCount + groupCount * leavesPerGroup;
  return {
    id: `incremental-${groupCount}-${leavesPerGroup}-${mutationCount}`,
    suite: "incremental",
    title: `${nodeCount} nodes / ${mutationCount} mutations`,
    dimensions: [
      counter("nodes", "nodes", nodeCount),
      counter("mutations", "mutations", mutationCount),
    ],
    counters: [
      counter("incremental-visits", "incremental visited nodes", incrementalVisited),
      counter("full-visits", "full-layout visited nodes", fullVisited),
      counter("recomputed", "recomputed nodes", recomputedNodes),
      counter("reused", "reused node observations", reusedNodes),
    ],
  };
}

function flexFreezeLadder(itemCount: number): ComplexityPathology {
  const basis = 100;
  const totalGrowth = itemCount * 1000;
  let remainingGrowth = totalGrowth;
  let active = itemCount;
  let previousDelta: number | null = null;
  const maxGrowth: number[] = [];

  for (let index = 0; index < itemCount - 1; index += 1) {
    const delta = remainingGrowth / active;
    const threshold = previousDelta === null ? delta - 100 : (previousDelta + delta) / 2;
    maxGrowth.push(threshold);
    remainingGrowth -= threshold;
    previousDelta = delta;
    active -= 1;
  }

  const result = resolveFlexLine({
    innerSize: itemCount * basis + totalGrowth,
    gapSize: 0,
    items: Array.from({length: itemCount}, (_, index) => ({
      label: `item-${index + 1}`,
      basis,
      grow: 1,
      shrink: 1,
      maxSize: index < maxGrowth.length ? basis + maxGrowth[index]! : Number.POSITIVE_INFINITY,
    })),
  });

  return {
    id: "flex-freeze-ladder",
    title: "Flex one-freeze-per-pass ladder",
    summary: "Increasing max-size thresholds force exactly one additional flex item to freeze on each redistribution pass.",
    scale: itemCount,
    passes: result.iterations.length,
    evaluations: result.iterations.reduce((sum, iteration) => sum + iteration.items.length, 0),
    freezeSequence: result.iterations.map((iteration) => iteration.newlyFrozen),
  };
}

function gridFreezeLadder(trackCount: number): ComplexityPathology {
  const available = trackCount * 1000;
  let remaining = available;
  let active = trackCount;
  let previousFraction: number | null = null;
  const minimums: number[] = [];

  for (let index = 0; index < trackCount - 1; index += 1) {
    const fraction = remaining / active;
    const minimum = previousFraction === null ? fraction + 100 : (previousFraction + fraction) / 2;
    minimums.push(minimum);
    remaining -= minimum;
    previousFraction = fraction;
    active -= 1;
  }
  minimums.push(0);

  const result = resolveMinMaxFractionTracks({
    innerSize: available,
    gapSize: 0,
    tracks: minimums.map((minSize, index) => ({label: `track-${index + 1}`, minSize, fr: 1})),
  });

  return {
    id: "grid-freeze-ladder",
    title: "Grid one-freeze-per-pass ladder",
    summary: "Descending minimum track sizes force one additional flexible track to freeze on each fraction-resolution pass.",
    scale: trackCount,
    passes: result.flexIterations.length,
    evaluations: result.flexIterations.reduce((sum, iteration) => sum + iteration.activeTracks.length, 0),
    freezeSequence: result.flexIterations.map((iteration) => iteration.newlyFrozen),
  };
}

export function runLayoutComplexityLab(): ComplexityLabResult {
  const samples: ComplexitySample[] = [];
  [4, 8, 16, 32, 64].forEach((scale) => samples.push(flexScalingSample(scale)));
  [4, 8, 16, 32, 64].forEach((scale) => samples.push(gridScalingSample(scale)));
  [4, 8, 16, 32].forEach((scale) => samples.push(constraintScalingSample(scale)));
  [
    [4, 4, 1],
    [8, 8, 4],
    [16, 16, 8],
  ].forEach(([groups, leaves, mutations]) => samples.push(incrementalScalingSample(groups!, leaves!, mutations!)));

  return {
    version: COMPLEXITY_LAB_VERSION,
    methodology: [
      "Pure deterministic algorithm work only: no DOM measurement, rendering, timers, or wall-clock claims.",
      "Flex counts resolver passes, frozen items, and item evaluations across passes.",
      "Grid counts spanning-contribution work plus flexible-track passes, freezes, and active-track evaluations.",
      "Constraints count Cassowary pivots, tableau rows, and incremental add operations.",
      "Incremental layout replays the same mutation trace against cached and clean block layout and counts actual visited nodes.",
    ],
    samples,
    pathologies: [flexFreezeLadder(8), gridFreezeLadder(8)],
  };
}
