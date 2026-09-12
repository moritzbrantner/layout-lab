export type TidyTreeNode = {
  id: string;
  children: readonly TidyTreeNode[];
};

export type TidyTreeInput = {
  root: TidyTreeNode;
  nodeWidth: number;
  nodeHeight: number;
  horizontalGap: number;
  levelGap: number;
};

export type TidyTreePlacement = {
  id: string;
  parentId: string | null;
  depth: number;
  centerX: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TidyTreeShiftEvidence = {
  nodeId: string;
  leftChildId: string;
  rightChildId: string;
  separation: number;
  comparedDepths: number;
};

export type TidyTreeResult = {
  placements: readonly TidyTreePlacement[];
  geometry: readonly {id: string; x: number; y: number; width: number; height: number}[];
  shifts: readonly TidyTreeShiftEvidence[];
  contourComparisons: number;
  drawingWidth: number;
  drawingHeight: number;
  maxDepth: number;
};

type RelativePlacement = {
  id: string;
  parentId: string | null;
  depth: number;
  centerX: number;
};

type RelativeSubtree = {
  rootId: string;
  placements: RelativePlacement[];
  leftContour: number[];
  rightContour: number[];
  shifts: TidyTreeShiftEvidence[];
  contourComparisons: number;
};

const EPSILON = 1e-9;

function round(value: number) {
  const rounded = Math.round(value * 10_000) / 10_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function validateInput(input: TidyTreeInput) {
  for (const [name, value] of [
    ["nodeWidth", input.nodeWidth],
    ["nodeHeight", input.nodeHeight],
    ["horizontalGap", input.horizontalGap],
    ["levelGap", input.levelGap],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || ((name === "nodeWidth" || name === "nodeHeight") && value <= 0)) {
      throw new Error(`${name} must be finite and ${name === "nodeWidth" || name === "nodeHeight" ? "positive" : "non-negative"}`);
    }
  }

  const ids = new Set<string>();
  const objects = new WeakSet<object>();
  const visit = (node: TidyTreeNode) => {
    if (objects.has(node)) throw new Error(`${node.id || "<missing-id>"}: tree contains a cycle or repeated node object`);
    objects.add(node);
    if (!node.id.trim()) throw new Error("tidy tree node ids must be non-empty");
    if (ids.has(node.id)) throw new Error(`duplicate tidy tree node id: ${node.id}`);
    ids.add(node.id);
    if (node.children.length > 2) throw new Error(`${node.id}: current Reingold-Tilford subset supports at most two ordered children`);
    node.children.forEach(visit);
  };
  visit(input.root);
}

function translated(values: readonly number[], offset: number) {
  return values.map((value) => value + offset);
}

function layoutRelative(node: TidyTreeNode, minimumSeparation: number): RelativeSubtree {
  if (node.children.length === 0) {
    return {
      rootId: node.id,
      placements: [{id: node.id, parentId: null, depth: 0, centerX: 0}],
      leftContour: [0],
      rightContour: [0],
      shifts: [],
      contourComparisons: 0,
    };
  }

  if (node.children.length === 1) {
    const child = layoutRelative(node.children[0]!, minimumSeparation);
    const childPlacements = child.placements.map((placement) => ({
      ...placement,
      parentId: placement.depth === 0 ? node.id : placement.parentId,
      depth: placement.depth + 1,
    }));
    return {
      rootId: node.id,
      placements: [{id: node.id, parentId: null, depth: 0, centerX: 0}, ...childPlacements],
      leftContour: [0, ...child.leftContour],
      rightContour: [0, ...child.rightContour],
      shifts: child.shifts,
      contourComparisons: child.contourComparisons,
    };
  }

  const leftChild = node.children[0]!;
  const rightChild = node.children[1]!;
  const left = layoutRelative(leftChild, minimumSeparation);
  const right = layoutRelative(rightChild, minimumSeparation);
  const comparedDepths = Math.min(left.rightContour.length, right.leftContour.length);
  let separation = minimumSeparation;

  for (let depth = 0; depth < comparedDepths; depth += 1) {
    const required = left.rightContour[depth]! - right.leftContour[depth]! + minimumSeparation;
    separation = Math.max(separation, required);
  }
  separation = round(separation);

  const leftOffset = -separation / 2;
  const rightOffset = separation / 2;
  const leftPlacements = left.placements.map((placement) => ({
    ...placement,
    parentId: placement.depth === 0 ? node.id : placement.parentId,
    depth: placement.depth + 1,
    centerX: placement.centerX + leftOffset,
  }));
  const rightPlacements = right.placements.map((placement) => ({
    ...placement,
    parentId: placement.depth === 0 ? node.id : placement.parentId,
    depth: placement.depth + 1,
    centerX: placement.centerX + rightOffset,
  }));

  const leftContourShifted = translated(left.leftContour, leftOffset);
  const rightContourShifted = translated(right.leftContour, rightOffset);
  const leftRightContourShifted = translated(left.rightContour, leftOffset);
  const rightRightContourShifted = translated(right.rightContour, rightOffset);
  const depthCount = Math.max(left.leftContour.length, right.leftContour.length);
  const leftContour = [0];
  const rightContour = [0];

  for (let depth = 0; depth < depthCount; depth += 1) {
    const leftValues = [leftContourShifted[depth], rightContourShifted[depth]].filter((value): value is number => value !== undefined);
    const rightValues = [leftRightContourShifted[depth], rightRightContourShifted[depth]].filter((value): value is number => value !== undefined);
    leftContour.push(Math.min(...leftValues));
    rightContour.push(Math.max(...rightValues));
  }

  return {
    rootId: node.id,
    placements: [{id: node.id, parentId: null, depth: 0, centerX: 0}, ...leftPlacements, ...rightPlacements],
    leftContour,
    rightContour,
    shifts: [
      ...left.shifts,
      ...right.shifts,
      {
        nodeId: node.id,
        leftChildId: left.rootId,
        rightChildId: right.rootId,
        separation,
        comparedDepths,
      },
    ],
    contourComparisons: left.contourComparisons + right.contourComparisons + comparedDepths,
  };
}

export function layoutTidyTree(input: TidyTreeInput): TidyTreeResult {
  validateInput(input);
  const minimumSeparation = input.nodeWidth + input.horizontalGap;
  const relative = layoutRelative(input.root, minimumSeparation);
  const minimumLeftEdge = relative.placements.reduce(
    (minimum, placement) => Math.min(minimum, placement.centerX - input.nodeWidth / 2),
    Number.POSITIVE_INFINITY,
  );
  const maximumRightEdge = relative.placements.reduce(
    (maximum, placement) => Math.max(maximum, placement.centerX + input.nodeWidth / 2),
    Number.NEGATIVE_INFINITY,
  );
  const normalization = -minimumLeftEdge;
  const maxDepth = relative.placements.reduce((maximum, placement) => Math.max(maximum, placement.depth), 0);

  const placements: TidyTreePlacement[] = relative.placements.map((placement) => {
    const centerX = round(placement.centerX + normalization);
    return {
      ...placement,
      centerX,
      x: round(centerX - input.nodeWidth / 2),
      y: round(placement.depth * (input.nodeHeight + input.levelGap)),
      width: input.nodeWidth,
      height: input.nodeHeight,
    };
  });

  return {
    placements,
    geometry: placements.map(({id, x, y, width, height}) => ({id, x, y, width, height})),
    shifts: relative.shifts,
    contourComparisons: relative.contourComparisons,
    drawingWidth: round(maximumRightEdge - minimumLeftEdge),
    drawingHeight: round(maxDepth * (input.nodeHeight + input.levelGap) + input.nodeHeight),
    maxDepth,
  };
}

export function buildTidyTreeFixture(): TidyTreeInput {
  return {
    nodeWidth: 48,
    nodeHeight: 32,
    horizontalGap: 24,
    levelGap: 44,
    root: {
      id: "root",
      children: [
        {
          id: "left",
          children: [
            {id: "left-a", children: []},
            {
              id: "left-b",
              children: [
                {id: "left-b-a", children: []},
                {id: "left-b-b", children: []},
              ],
            },
          ],
        },
        {
          id: "right",
          children: [
            {
              id: "right-a",
              children: [
                {id: "right-a-a", children: []},
              ],
            },
            {id: "right-b", children: []},
          ],
        },
      ],
    },
  };
}
