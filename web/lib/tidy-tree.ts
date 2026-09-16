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

type Contour = {
  zeroPrefix: number;
  values: readonly number[];
};

type RelativeChild = {
  subtree: RelativeSubtree;
  offset: number;
};

type RelativeSubtree = {
  rootId: string;
  children: readonly RelativeChild[];
  leftContour: Contour;
  rightContour: Contour;
  shift: TidyTreeShiftEvidence | null;
  contourComparisons: number;
};

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

function contourLength(contour: Contour) {
  return contour.zeroPrefix + contour.values.length;
}

function contourAt(contour: Contour, depth: number) {
  if (depth < 0 || depth >= contourLength(contour)) return undefined;
  if (depth < contour.zeroPrefix) return 0;
  return contour.values[depth - contour.zeroPrefix];
}

function prependZero(contour: Contour): Contour {
  return {zeroPrefix: contour.zeroPrefix + 1, values: contour.values};
}

function mergedContour(
  left: Contour,
  leftOffset: number,
  right: Contour,
  rightOffset: number,
  pick: (leftValue: number, rightValue: number) => number,
): Contour {
  const depthCount = Math.max(contourLength(left), contourLength(right));
  const values: number[] = [];

  for (let depth = 0; depth < depthCount; depth += 1) {
    const leftValue = contourAt(left, depth);
    const rightValue = contourAt(right, depth);
    if (leftValue === undefined) values.push(rightValue! + rightOffset);
    else if (rightValue === undefined) values.push(leftValue + leftOffset);
    else values.push(pick(leftValue + leftOffset, rightValue + rightOffset));
  }

  // The current subtree root is always centered at zero. Keeping runs of unary
  // ancestors as an implicit zero prefix avoids copying an entire contour at
  // every level of a deep chain.
  return {zeroPrefix: 1, values};
}

function layoutRelative(node: TidyTreeNode, minimumSeparation: number): RelativeSubtree {
  if (node.children.length === 0) {
    const rootContour: Contour = {zeroPrefix: 1, values: []};
    return {
      rootId: node.id,
      children: [],
      leftContour: rootContour,
      rightContour: rootContour,
      shift: null,
      contourComparisons: 0,
    };
  }

  if (node.children.length === 1) {
    const child = layoutRelative(node.children[0]!, minimumSeparation);
    return {
      rootId: node.id,
      children: [{subtree: child, offset: 0}],
      leftContour: prependZero(child.leftContour),
      rightContour: prependZero(child.rightContour),
      shift: null,
      contourComparisons: child.contourComparisons,
    };
  }

  const left = layoutRelative(node.children[0]!, minimumSeparation);
  const right = layoutRelative(node.children[1]!, minimumSeparation);
  const comparedDepths = Math.min(contourLength(left.rightContour), contourLength(right.leftContour));
  let separation = minimumSeparation;

  for (let depth = 0; depth < comparedDepths; depth += 1) {
    const required = contourAt(left.rightContour, depth)!
      - contourAt(right.leftContour, depth)!
      + minimumSeparation;
    separation = Math.max(separation, required);
  }
  separation = round(separation);

  const leftOffset = -separation / 2;
  const rightOffset = separation / 2;
  return {
    rootId: node.id,
    children: [
      {subtree: left, offset: leftOffset},
      {subtree: right, offset: rightOffset},
    ],
    leftContour: mergedContour(left.leftContour, leftOffset, right.leftContour, rightOffset, Math.min),
    rightContour: mergedContour(left.rightContour, leftOffset, right.rightContour, rightOffset, Math.max),
    shift: {
      nodeId: node.id,
      leftChildId: left.rootId,
      rightChildId: right.rootId,
      separation,
      comparedDepths,
    },
    contourComparisons: left.contourComparisons + right.contourComparisons + comparedDepths,
  };
}

function materializeRelative(
  subtree: RelativeSubtree,
  parentId: string | null,
  depth: number,
  centerX: number,
  placements: RelativePlacement[],
  shifts: TidyTreeShiftEvidence[],
) {
  placements.push({id: subtree.rootId, parentId, depth, centerX});
  for (const child of subtree.children) {
    materializeRelative(
      child.subtree,
      subtree.rootId,
      depth + 1,
      centerX + child.offset,
      placements,
      shifts,
    );
  }
  if (subtree.shift) shifts.push(subtree.shift);
}

export function layoutTidyTree(input: TidyTreeInput): TidyTreeResult {
  validateInput(input);
  const minimumSeparation = input.nodeWidth + input.horizontalGap;
  const relative = layoutRelative(input.root, minimumSeparation);
  const relativePlacements: RelativePlacement[] = [];
  const shifts: TidyTreeShiftEvidence[] = [];
  materializeRelative(relative, null, 0, 0, relativePlacements, shifts);

  let minimumLeftEdge = Number.POSITIVE_INFINITY;
  let maximumRightEdge = Number.NEGATIVE_INFINITY;
  let maxDepth = 0;
  for (const placement of relativePlacements) {
    minimumLeftEdge = Math.min(minimumLeftEdge, placement.centerX - input.nodeWidth / 2);
    maximumRightEdge = Math.max(maximumRightEdge, placement.centerX + input.nodeWidth / 2);
    maxDepth = Math.max(maxDepth, placement.depth);
  }

  const normalization = -minimumLeftEdge;
  const placements: TidyTreePlacement[] = [];
  const geometry: {id: string; x: number; y: number; width: number; height: number}[] = [];
  for (const placement of relativePlacements) {
    const centerX = round(placement.centerX + normalization);
    const x = round(centerX - input.nodeWidth / 2);
    const y = round(placement.depth * (input.nodeHeight + input.levelGap));
    placements.push({
      id: placement.id,
      parentId: placement.parentId,
      depth: placement.depth,
      centerX,
      x,
      y,
      width: input.nodeWidth,
      height: input.nodeHeight,
    });
    geometry.push({id: placement.id, x, y, width: input.nodeWidth, height: input.nodeHeight});
  }

  return {
    placements,
    geometry,
    shifts,
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
