import {layoutFlexTree, layoutGridTree} from "../lib/layout-engine";
import type {LayoutNode} from "../lib/layout-tree";

const FLEX_ITEMS = 384;
const GRID_TRACKS = 96;
const GRID_ITEMS = 384;
const RUNS = 30;

function flexTree(): LayoutNode {
  return {
    id: "flex-root",
    label: "Flex root",
    style: {
      display: "flex",
      width: FLEX_ITEMS * 104,
      flexContainer: {gap: 4, direction: "row"},
    },
    children: Array.from({length: FLEX_ITEMS}, (_, index) => ({
      id: `flex-${index}`,
      label: `Flex ${index}`,
      style: {
        display: "block",
        height: 28 + (index % 5),
        minWidth: 32,
        flexItem: {basis: 80 + (index % 7), grow: 1 + (index % 3), shrink: 1},
      },
      children: [],
    })),
  };
}

function gridTree(): LayoutNode {
  return {
    id: "grid-root",
    label: "Grid root",
    style: {
      display: "grid",
      width: GRID_TRACKS * 120,
      gridContainer: {
        gap: 4,
        columns: Array.from({length: GRID_TRACKS}, (_, index) => ({
          label: `Track ${index}`,
          minSize: 48 + (index % 5) * 4,
          fr: 1 + (index % 3),
        })),
      },
    },
    children: Array.from({length: GRID_ITEMS}, (_, index) => {
      const columnSpan = 1 + (index % 4);
      const columnStart = (index * 7) % (GRID_TRACKS - columnSpan + 1);
      return {
        id: `grid-${index}`,
        label: `Grid ${index}`,
        style: {
          display: "block" as const,
          height: 24 + (index % 9),
          gridItem: {
            columnStart,
            columnSpan,
            minContribution: index % 12 === 0 ? columnSpan * 72 : undefined,
          },
        },
        children: [],
      };
    }),
  };
}

const flex = flexTree();
const grid = gridTree();
let expectedSignature: string | undefined;
const started = performance.now();

for (let run = 0; run < RUNS; run += 1) {
  const flexResult = layoutFlexTree(flex);
  const gridResult = layoutGridTree(grid);
  const signature = JSON.stringify({
    flexBoxes: flexResult.boxes.length,
    flexHeight: flexResult.root.rect.height,
    flexPasses: flexResult.resolution.iterations.length,
    gridBoxes: gridResult.boxes.length,
    gridHeight: gridResult.root.rect.height,
    gridPasses: gridResult.resolution.flexIterations.length,
    finalTrackStart: gridResult.trackStarts.at(-1),
  });
  expectedSignature ??= signature;
  if (signature !== expectedSignature) throw new Error("layout-engine benchmark became nondeterministic");
}

const elapsedMs = performance.now() - started;
console.log(JSON.stringify({
  workload: "full-flex-grid-layout",
  flexItems: FLEX_ITEMS,
  gridTracks: GRID_TRACKS,
  gridItems: GRID_ITEMS,
  runs: RUNS,
  elapsedMs: Number(elapsedMs.toFixed(2)),
  pairedLayoutsPerSecond: Number((RUNS / (elapsedMs / 1_000)).toFixed(2)),
}, null, 2));
