import {
  compareLayoutGeometryWithPolicy,
  DEFAULT_GEOMETRY_POLICY,
  type BrowserLayoutGeometry,
  type GeometryComparison,
  type GeometryComparisonPolicy,
} from "./browser-layout-adapter";
import {buildFlexEngineTree, buildGridEngineTree} from "./layout-engine-fixtures";
import {layoutBlockTree, layoutFlexTree, layoutGridTree, type LayoutBox} from "./layout-engine";
import {buildBlockLayoutTree} from "./layout-tree";

export type LayoutDifferentialFixtureId = "block-baseline" | "flex-engine" | "grid-engine";
export type LayoutDifferentialFixtureKind = "block" | "flex" | "grid";
export type BrowserFixtureStyleValue = string | number;

export type BrowserFixtureNode = {
  id: string;
  style: Readonly<Record<string, BrowserFixtureStyleValue>>;
  children: readonly BrowserFixtureNode[];
};

export type LayoutDifferentialFixture = {
  id: LayoutDifferentialFixtureId;
  kind: LayoutDifferentialFixtureKind;
  title: string;
  summary: string;
  policy: GeometryComparisonPolicy;
  engineBoxes: readonly LayoutBox[];
  browserTree: BrowserFixtureNode;
  input: Readonly<Record<string, number | string>>;
};

export type LayoutDifferentialCorpusOptions = {
  flexInnerSize?: number;
  flexGapSize?: number;
  gridInnerSize?: number;
  gridGapSize?: number;
};

function blockFixture(): LayoutDifferentialFixture {
  const engine = layoutBlockTree(buildBlockLayoutTree());
  return {
    id: "block-baseline",
    kind: "block",
    title: "Block baseline",
    summary: "Positive sibling-margin collapse, explicit child heights, containing width, and one max-width clamp.",
    policy: DEFAULT_GEOMETRY_POLICY,
    engineBoxes: engine.boxes,
    input: {width: 420},
    browserTree: {
      id: "block-root",
      style: {width: 420, boxSizing: "border-box"},
      children: [
        {
          id: "header",
          style: {height: 56, marginBlockEnd: 20, boxSizing: "border-box"},
          children: [],
        },
        {
          id: "content",
          style: {
            height: 132,
            minWidth: 240,
            maxWidth: 360,
            marginBlockStart: 12,
            marginBlockEnd: 18,
            boxSizing: "border-box",
          },
          children: [],
        },
        {
          id: "footer",
          style: {width: 280, height: 44, marginBlockStart: 24, boxSizing: "border-box"},
          children: [],
        },
      ],
    },
  };
}

function flexFixture(innerSize: number, gapSize: number): LayoutDifferentialFixture {
  const engine = layoutFlexTree(buildFlexEngineTree(innerSize, gapSize));
  return {
    id: "flex-engine",
    kind: "flex",
    title: "Flex engine fixture",
    summary: "Single-row flex resolution with basis, grow/shrink factors, explicit min/max bounds, fixed cross sizes, and gap.",
    policy: DEFAULT_GEOMETRY_POLICY,
    engineBoxes: engine.boxes,
    input: {innerSize, gapSize},
    browserTree: {
      id: "root",
      style: {
        display: "flex",
        width: innerSize,
        height: 120,
        gap: gapSize,
        alignItems: "flex-start",
        boxSizing: "border-box",
      },
      children: [
        {
          id: "item-a",
          style: {flex: "1 1 120px", height: 72, minWidth: 80, maxWidth: 220, boxSizing: "border-box"},
          children: [],
        },
        {
          id: "item-b",
          style: {flex: "8 1 132px", height: 104, minWidth: 96, maxWidth: 184, boxSizing: "border-box"},
          children: [],
        },
        {
          id: "item-c",
          style: {flex: "2 1 112px", height: 88, minWidth: 72, maxWidth: 240, boxSizing: "border-box"},
          children: [],
        },
      ],
    },
  };
}

function gridFixture(innerSize: number, gapSize: number): LayoutDifferentialFixture {
  const engine = layoutGridTree(buildGridEngineTree(innerSize, gapSize));
  return {
    id: "grid-engine",
    kind: "grid",
    title: "Grid engine fixture",
    summary: "Minmax tracks, spanning minimum contribution, explicit placement, fixed row height, and gap.",
    policy: DEFAULT_GEOMETRY_POLICY,
    engineBoxes: engine.boxes,
    input: {innerSize, gapSize},
    browserTree: {
      id: "root",
      style: {
        display: "grid",
        width: innerSize,
        height: 120,
        gridTemplateColumns: "minmax(96px, 1fr) minmax(164px, 1fr) minmax(88px, 2fr)",
        gridTemplateRows: "120px",
        gap: gapSize,
        alignItems: "start",
        boxSizing: "border-box",
      },
      children: [
        {
          id: "span-ab",
          style: {gridColumn: "1 / span 2", gridRow: 1, minWidth: 300, height: 80, boxSizing: "border-box"},
          children: [],
        },
        {
          id: "item-c",
          style: {gridColumn: 3, gridRow: 1, height: 96, boxSizing: "border-box"},
          children: [],
        },
      ],
    },
  };
}

function flattenBrowserNodes(root: BrowserFixtureNode) {
  const nodes: BrowserFixtureNode[] = [];
  const visit = (node: BrowserFixtureNode) => {
    nodes.push(node);
    node.children.forEach(visit);
  };
  visit(root);
  return nodes;
}

export function createLayoutDifferentialCorpus(
  options: LayoutDifferentialCorpusOptions = {},
): readonly LayoutDifferentialFixture[] {
  const flexInnerSize = options.flexInnerSize ?? 520;
  const flexGapSize = options.flexGapSize ?? 16;
  const gridInnerSize = options.gridInnerSize ?? 560;
  const gridGapSize = options.gridGapSize ?? 16;

  return [
    blockFixture(),
    flexFixture(flexInnerSize, flexGapSize),
    gridFixture(gridInnerSize, gridGapSize),
  ] as const;
}

export function getLayoutDifferentialFixture(
  id: LayoutDifferentialFixtureId,
  options: LayoutDifferentialCorpusOptions = {},
) {
  const fixture = createLayoutDifferentialCorpus(options).find((candidate) => candidate.id === id);
  if (!fixture) throw new Error(`unknown layout differential fixture: ${id}`);
  return fixture;
}

export function validateLayoutDifferentialFixture(fixture: LayoutDifferentialFixture): string[] {
  const errors: string[] = [];
  const browserNodes = flattenBrowserNodes(fixture.browserTree);
  const browserIds = browserNodes.map((node) => node.id);
  const engineIds = fixture.engineBoxes.map((box) => box.id);

  if (new Set(browserIds).size !== browserIds.length) errors.push(`${fixture.id}: browser fixture ids must be unique`);
  if (new Set(engineIds).size !== engineIds.length) errors.push(`${fixture.id}: engine box ids must be unique`);
  if (fixture.browserTree.id !== fixture.engineBoxes[0]?.id) {
    errors.push(`${fixture.id}: browser and engine roots must share the same id`);
  }

  const browserSet = new Set(browserIds);
  const engineSet = new Set(engineIds);
  for (const id of engineSet) {
    if (!browserSet.has(id)) errors.push(`${fixture.id}: browser fixture is missing ${id}`);
  }
  for (const id of browserSet) {
    if (!engineSet.has(id)) errors.push(`${fixture.id}: browser fixture has engine-unknown node ${id}`);
  }

  return errors;
}

export function compareLayoutDifferentialFixture(
  fixture: LayoutDifferentialFixture,
  browserGeometry: readonly BrowserLayoutGeometry[],
): GeometryComparison[] {
  const errors = validateLayoutDifferentialFixture(fixture);
  if (errors.length > 0) throw new Error(errors.join("; "));
  return compareLayoutGeometryWithPolicy(fixture.engineBoxes, browserGeometry, fixture.policy);
}

export function engineGeometryForDifferentialFixture(
  fixture: LayoutDifferentialFixture,
): BrowserLayoutGeometry[] {
  return fixture.engineBoxes.map((box) => ({id: box.id, ...box.rect}));
}
