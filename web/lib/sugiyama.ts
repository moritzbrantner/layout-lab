export type DagNode = {
  id: string;
};

export type DagEdge = {
  id: string;
  from: string;
  to: string;
};

export type SugiyamaInput = {
  nodes: readonly DagNode[];
  edges: readonly DagEdge[];
  nodeWidth: number;
  nodeHeight: number;
  nodeGap: number;
  rankGap: number;
  sweeps: number;
};

export type SugiyamaSweep = {
  iteration: number;
  direction: "down" | "up";
  crossingsBefore: number;
  crossingsAfter: number;
  changedLayers: number;
};

export type SugiyamaRankEvidence = {
  nodeId: string;
  rank: number;
};

export type SugiyamaResult = {
  geometry: readonly {id: string; x: number; y: number; width: number; height: number}[];
  ranks: readonly SugiyamaRankEvidence[];
  layerOrders: readonly (readonly string[])[];
  sweeps: readonly SugiyamaSweep[];
  initialCrossings: number;
  finalCrossings: number;
  dummyCount: number;
  segmentCount: number;
  crossingComparisons: number;
  drawingWidth: number;
  drawingHeight: number;
};

type LayerNode = {
  id: string;
  rank: number;
  dummy: boolean;
};

type Segment = {
  id: string;
  from: string;
  to: string;
  rank: number;
};

type CrossingCount = {
  crossings: number;
  comparisons: number;
};

function round(value: number) {
  const rounded = Math.round(value * 10_000) / 10_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function validateInput(input: SugiyamaInput) {
  if (input.nodes.length === 0) throw new Error("Sugiyama layout requires at least one node");
  for (const [name, value] of [
    ["nodeWidth", input.nodeWidth],
    ["nodeHeight", input.nodeHeight],
    ["nodeGap", input.nodeGap],
    ["rankGap", input.rankGap],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || ((name === "nodeWidth" || name === "nodeHeight") && value <= 0)) {
      throw new Error(`${name} must be finite and ${name === "nodeWidth" || name === "nodeHeight" ? "positive" : "non-negative"}`);
    }
  }
  if (!Number.isInteger(input.sweeps) || input.sweeps < 1 || input.sweeps > 20) {
    throw new Error("sweeps must be an integer between 1 and 20");
  }

  const nodeIds = new Set<string>();
  input.nodes.forEach((node) => {
    if (!node.id.trim()) throw new Error("DAG node ids must be non-empty");
    if (nodeIds.has(node.id)) throw new Error(`duplicate DAG node id: ${node.id}`);
    nodeIds.add(node.id);
  });

  const edgeIds = new Set<string>();
  const pairs = new Set<string>();
  input.edges.forEach((edge) => {
    if (!edge.id.trim()) throw new Error("DAG edge ids must be non-empty");
    if (edgeIds.has(edge.id)) throw new Error(`duplicate DAG edge id: ${edge.id}`);
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) throw new Error(`${edge.id}: edge endpoints must reference known nodes`);
    if (edge.from === edge.to) throw new Error(`${edge.id}: self edges are not supported`);
    const pair = `${edge.from}->${edge.to}`;
    if (pairs.has(pair)) throw new Error(`${edge.id}: parallel edges are not supported in this bounded fixture`);
    pairs.add(pair);
  });
}

function topologicalOrder(input: SugiyamaInput) {
  const indegree = new Map(input.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(input.nodes.map((node) => [node.id, [] as string[]]));
  input.edges.forEach((edge) => {
    indegree.set(edge.to, indegree.get(edge.to)! + 1);
    outgoing.get(edge.from)!.push(edge.to);
  });

  const nodeOrder = new Map(input.nodes.map((node, index) => [node.id, index]));
  const queue = input.nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  const order: string[] = [];

  while (queue.length > 0) {
    queue.sort((left, right) => nodeOrder.get(left)! - nodeOrder.get(right)!);
    const nodeId = queue.shift()!;
    order.push(nodeId);
    for (const target of outgoing.get(nodeId)!) {
      const next = indegree.get(target)! - 1;
      indegree.set(target, next);
      if (next === 0) queue.push(target);
    }
  }

  if (order.length !== input.nodes.length) throw new Error("Sugiyama DAG layout requires an acyclic graph");
  return order;
}

function assignRanks(input: SugiyamaInput, order: readonly string[]) {
  const rank = new Map(input.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(input.nodes.map((node) => [node.id, [] as string[]]));
  input.edges.forEach((edge) => outgoing.get(edge.from)!.push(edge.to));

  for (const nodeId of order) {
    const sourceRank = rank.get(nodeId)!;
    for (const target of outgoing.get(nodeId)!) {
      rank.set(target, Math.max(rank.get(target)!, sourceRank + 1));
    }
  }
  return rank;
}

function buildLayeredGraph(input: SugiyamaInput, ranks: ReadonlyMap<string, number>) {
  const maxRank = Math.max(...ranks.values());
  const layers: LayerNode[][] = Array.from({length: maxRank + 1}, () => []);
  input.nodes.forEach((node) => layers[ranks.get(node.id)!]!.push({id: node.id, rank: ranks.get(node.id)!, dummy: false}));

  const segments: Segment[] = [];
  let dummyCount = 0;
  input.edges.forEach((edge, edgeIndex) => {
    const sourceRank = ranks.get(edge.from)!;
    const targetRank = ranks.get(edge.to)!;
    let previousId = edge.from;

    for (let rank = sourceRank + 1; rank < targetRank; rank += 1) {
      const id = `__dummy:${edge.id}:${rank}`;
      dummyCount += 1;
      layers[rank]!.push({id, rank, dummy: true});
      segments.push({id: `${edge.id}:segment:${rank - sourceRank}`, from: previousId, to: id, rank: rank - 1});
      previousId = id;
    }
    segments.push({id: `${edge.id}:segment:last`, from: previousId, to: edge.to, rank: targetRank - 1});
  });

  return {layers, segments, dummyCount};
}

function positionsForLayer(layer: readonly LayerNode[]) {
  return new Map(layer.map((node, index) => [node.id, index]));
}

function countCrossings(layers: readonly (readonly LayerNode[])[], segments: readonly Segment[]): CrossingCount {
  let crossings = 0;
  let comparisons = 0;

  for (let rank = 0; rank < layers.length - 1; rank += 1) {
    const upper = positionsForLayer(layers[rank]!);
    const lower = positionsForLayer(layers[rank + 1]!);
    const between = segments.filter((segment) => segment.rank === rank);
    for (let first = 0; first < between.length; first += 1) {
      for (let second = first + 1; second < between.length; second += 1) {
        const a = between[first]!;
        const b = between[second]!;
        if (a.from === b.from || a.to === b.to) continue;
        comparisons += 1;
        const sourceDelta = upper.get(a.from)! - upper.get(b.from)!;
        const targetDelta = lower.get(a.to)! - lower.get(b.to)!;
        if (sourceDelta * targetDelta < 0) crossings += 1;
      }
    }
  }

  return {crossings, comparisons};
}

function cloneLayers(layers: readonly (readonly LayerNode[])[]) {
  return layers.map((layer) => [...layer]);
}

function reorderLayer(
  layers: LayerNode[][],
  segments: readonly Segment[],
  rank: number,
  direction: "down" | "up",
) {
  const layer = layers[rank]!;
  const oldIndex = positionsForLayer(layer);
  const neighborLayer = direction === "down" ? layers[rank - 1]! : layers[rank + 1]!;
  const neighborIndex = positionsForLayer(neighborLayer);

  const barycenters = new Map<string, number>();
  layer.forEach((node) => {
    const neighbors = direction === "down"
      ? segments.filter((segment) => segment.rank === rank - 1 && segment.to === node.id).map((segment) => segment.from)
      : segments.filter((segment) => segment.rank === rank && segment.from === node.id).map((segment) => segment.to);
    if (neighbors.length === 0) barycenters.set(node.id, oldIndex.get(node.id)!);
    else barycenters.set(node.id, neighbors.reduce((sum, id) => sum + neighborIndex.get(id)!, 0) / neighbors.length);
  });

  const before = layer.map((node) => node.id).join("|");
  layer.sort((left, right) => {
    const delta = barycenters.get(left.id)! - barycenters.get(right.id)!;
    if (Math.abs(delta) > 1e-9) return delta;
    const previous = oldIndex.get(left.id)! - oldIndex.get(right.id)!;
    if (previous !== 0) return previous;
    return left.id.localeCompare(right.id);
  });
  return before !== layer.map((node) => node.id).join("|");
}

function reduceCrossings(layers: LayerNode[][], segments: readonly Segment[], sweepCount: number) {
  const initial = countCrossings(layers, segments);
  let comparisonTotal = initial.comparisons;
  let bestLayers = cloneLayers(layers);
  let bestCrossings = initial.crossings;
  const evidence: SugiyamaSweep[] = [];

  for (let iteration = 1; iteration <= sweepCount; iteration += 1) {
    let before = countCrossings(layers, segments);
    comparisonTotal += before.comparisons;
    let changedLayers = 0;
    for (let rank = 1; rank < layers.length; rank += 1) {
      if (reorderLayer(layers, segments, rank, "down")) changedLayers += 1;
    }
    let after = countCrossings(layers, segments);
    comparisonTotal += after.comparisons;
    evidence.push({iteration, direction: "down", crossingsBefore: before.crossings, crossingsAfter: after.crossings, changedLayers});
    if (after.crossings < bestCrossings) {
      bestCrossings = after.crossings;
      bestLayers = cloneLayers(layers);
    }

    before = after;
    changedLayers = 0;
    for (let rank = layers.length - 2; rank >= 0; rank -= 1) {
      if (reorderLayer(layers, segments, rank, "up")) changedLayers += 1;
    }
    after = countCrossings(layers, segments);
    comparisonTotal += after.comparisons;
    evidence.push({iteration, direction: "up", crossingsBefore: before.crossings, crossingsAfter: after.crossings, changedLayers});
    if (after.crossings < bestCrossings) {
      bestCrossings = after.crossings;
      bestLayers = cloneLayers(layers);
    }
  }

  for (let rank = 0; rank < layers.length; rank += 1) layers[rank] = [...bestLayers[rank]!];
  const final = countCrossings(layers, segments);
  comparisonTotal += final.comparisons;
  return {initialCrossings: initial.crossings, finalCrossings: final.crossings, evidence, comparisonTotal};
}

export function layoutSugiyama(input: SugiyamaInput): SugiyamaResult {
  validateInput(input);
  const order = topologicalOrder(input);
  const ranks = assignRanks(input, order);
  const {layers, segments, dummyCount} = buildLayeredGraph(input, ranks);
  const crossing = reduceCrossings(layers, segments, input.sweeps);
  const maxLayerSize = Math.max(...layers.map((layer) => layer.length));
  const xStep = input.nodeWidth + input.nodeGap;
  const yStep = input.nodeHeight + input.rankGap;
  const drawingWidth = Math.max(input.nodeWidth, (maxLayerSize - 1) * xStep + input.nodeWidth);
  const drawingHeight = (layers.length - 1) * yStep + input.nodeHeight;
  const geometry: {id: string; x: number; y: number; width: number; height: number}[] = [];

  layers.forEach((layer, rank) => {
    const layerWidth = Math.max(input.nodeWidth, (layer.length - 1) * xStep + input.nodeWidth);
    const offset = (drawingWidth - layerWidth) / 2;
    layer.forEach((node, index) => {
      const dummySize = Math.min(10, input.nodeWidth, input.nodeHeight);
      const width = node.dummy ? dummySize : input.nodeWidth;
      const height = node.dummy ? dummySize : input.nodeHeight;
      const centerX = offset + index * xStep + input.nodeWidth / 2;
      const centerY = rank * yStep + input.nodeHeight / 2;
      geometry.push({
        id: node.id,
        x: round(centerX - width / 2),
        y: round(centerY - height / 2),
        width,
        height,
      });
    });
  });

  return {
    geometry,
    ranks: input.nodes.map((node) => ({nodeId: node.id, rank: ranks.get(node.id)!})),
    layerOrders: layers.map((layer) => layer.map((node) => node.id)),
    sweeps: crossing.evidence,
    initialCrossings: crossing.initialCrossings,
    finalCrossings: crossing.finalCrossings,
    dummyCount,
    segmentCount: segments.length,
    crossingComparisons: crossing.comparisonTotal,
    drawingWidth: round(drawingWidth),
    drawingHeight: round(drawingHeight),
  };
}

export function buildSugiyamaFixture(): SugiyamaInput {
  return {
    nodeWidth: 48,
    nodeHeight: 32,
    nodeGap: 28,
    rankGap: 52,
    sweeps: 4,
    nodes: [
      {id: "A"}, {id: "B"}, {id: "C"},
      {id: "D"}, {id: "E"}, {id: "F"},
      {id: "G"}, {id: "H"}, {id: "I"},
    ],
    edges: [
      {id: "a-f", from: "A", to: "F"},
      {id: "b-e", from: "B", to: "E"},
      {id: "c-d", from: "C", to: "D"},
      {id: "f-g", from: "F", to: "G"},
      {id: "e-h", from: "E", to: "H"},
      {id: "d-h", from: "D", to: "H"},
      {id: "g-i", from: "G", to: "I"},
      {id: "h-i", from: "H", to: "I"},
      {id: "a-i", from: "A", to: "I"},
    ],
  };
}
