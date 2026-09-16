export type ForceGraphNode = {
  id: string;
};

export type ForceGraphEdge = {
  id: string;
  from: string;
  to: string;
};

export type ForceDirectedInput = {
  nodes: readonly ForceGraphNode[];
  edges: readonly ForceGraphEdge[];
  width: number;
  height: number;
  nodeSize: number;
  iterations: number;
  initialTemperature: number;
  seed: number;
  sampleEvery: number;
};

export type ForcePoint = {
  id: string;
  x: number;
  y: number;
};

export type ForceConvergenceSample = {
  iteration: number;
  temperature: number;
  maxDisplacement: number;
  totalDisplacement: number;
  meanEdgeLength: number;
};

export type ForceDirectedResult = {
  geometry: readonly {id: string; x: number; y: number; width: number; height: number}[];
  initialPositions: readonly ForcePoint[];
  finalPositions: readonly ForcePoint[];
  samples: readonly ForceConvergenceSample[];
  repulsionPairs: number;
  attractionEvaluations: number;
  iterations: number;
  characteristicLength: number;
};

function round(value: number) {
  const rounded = Math.round(value * 10_000) / 10_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function validateInput(input: ForceDirectedInput) {
  if (input.nodes.length < 2) throw new Error("force-directed layout requires at least two nodes");
  for (const [name, value] of [
    ["width", input.width],
    ["height", input.height],
    ["nodeSize", input.nodeSize],
    ["initialTemperature", input.initialTemperature],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be finite and positive`);
  }
  if (!Number.isInteger(input.iterations) || input.iterations < 1 || input.iterations > 2_000) {
    throw new Error("iterations must be an integer between 1 and 2000");
  }
  if (!Number.isInteger(input.sampleEvery) || input.sampleEvery < 1 || input.sampleEvery > input.iterations) {
    throw new Error("sampleEvery must be an integer between 1 and iterations");
  }
  if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffff_ffff) {
    throw new Error("seed must be a uint32 integer");
  }
  if (input.nodeSize >= input.width || input.nodeSize >= input.height) {
    throw new Error("nodeSize must leave positive layout space");
  }

  const nodeIds = new Set<string>();
  input.nodes.forEach((node) => {
    if (!node.id.trim()) throw new Error("force-directed node ids must be non-empty");
    if (nodeIds.has(node.id)) throw new Error(`duplicate force-directed node id: ${node.id}`);
    nodeIds.add(node.id);
  });

  const edgeIds = new Set<string>();
  const pairs = new Set<string>();
  input.edges.forEach((edge) => {
    if (!edge.id.trim()) throw new Error("force-directed edge ids must be non-empty");
    if (edgeIds.has(edge.id)) throw new Error(`duplicate force-directed edge id: ${edge.id}`);
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) throw new Error(`${edge.id}: edge endpoints must reference known nodes`);
    if (edge.from === edge.to) throw new Error(`${edge.id}: self edges are not supported`);
    const pair = [edge.from, edge.to].sort().join("--");
    if (pairs.has(pair)) throw new Error(`${edge.id}: parallel undirected edges are not supported`);
    pairs.add(pair);
  });
}

function meanEdgeLength(
  pointX: Float64Array,
  pointY: Float64Array,
  edgeFrom: Uint32Array,
  edgeTo: Uint32Array,
) {
  if (edgeFrom.length === 0) return 0;
  let sum = 0;
  for (let edgeIndex = 0; edgeIndex < edgeFrom.length; edgeIndex += 1) {
    const from = edgeFrom[edgeIndex]!;
    const to = edgeTo[edgeIndex]!;
    sum += Math.hypot(pointX[from]! - pointX[to]!, pointY[from]! - pointY[to]!);
  }
  return sum / edgeFrom.length;
}

export function layoutForceDirected(input: ForceDirectedInput): ForceDirectedResult {
  validateInput(input);
  const random = makeRandom(input.seed);
  const margin = input.nodeSize / 2;
  const usableWidth = input.width - input.nodeSize;
  const usableHeight = input.height - input.nodeSize;
  const nodeCount = input.nodes.length;

  const nodeIndex = new Map<string, number>();
  input.nodes.forEach((node, index) => nodeIndex.set(node.id, index));
  const edgeFrom = new Uint32Array(input.edges.length);
  const edgeTo = new Uint32Array(input.edges.length);
  input.edges.forEach((edge, index) => {
    edgeFrom[index] = nodeIndex.get(edge.from)!;
    edgeTo[index] = nodeIndex.get(edge.to)!;
  });

  // Keep the simulation state in node-order numeric buffers. The previous Map
  // representation performed keyed lookups for every O(n²) repulsion pair and
  // allocated a fresh Map plus displacement objects on every iteration.
  const pointX = new Float64Array(nodeCount);
  const pointY = new Float64Array(nodeCount);
  for (let index = 0; index < nodeCount; index += 1) {
    pointX[index] = margin + random() * usableWidth;
    pointY[index] = margin + random() * usableHeight;
  }
  const initialPositions = input.nodes.map((node, index) => ({
    id: node.id,
    x: pointX[index]!,
    y: pointY[index]!,
  }));

  const area = usableWidth * usableHeight;
  const k = Math.sqrt(area / nodeCount);
  const pairCount = nodeCount * (nodeCount - 1) / 2;
  let repulsionPairs = 0;
  let attractionEvaluations = 0;
  const samples: ForceConvergenceSample[] = [];
  const displacementX = new Float64Array(nodeCount);
  const displacementY = new Float64Array(nodeCount);

  for (let iteration = 1; iteration <= input.iterations; iteration += 1) {
    displacementX.fill(0);
    displacementY.fill(0);

    for (let first = 0; first < nodeCount; first += 1) {
      for (let second = first + 1; second < nodeCount; second += 1) {
        let dx = pointX[first]! - pointX[second]!;
        let dy = pointY[first]! - pointY[second]!;
        let length = Math.hypot(dx, dy);
        if (length < 1e-9) {
          const angle = random() * Math.PI * 2;
          dx = Math.cos(angle) * 1e-6;
          dy = Math.sin(angle) * 1e-6;
          length = 1e-6;
        }
        const force = (k * k) / length;
        const fx = dx / length * force;
        const fy = dy / length * force;
        displacementX[first] += fx;
        displacementY[first] += fy;
        displacementX[second] -= fx;
        displacementY[second] -= fy;
        repulsionPairs += 1;
      }
    }

    for (let edgeIndex = 0; edgeIndex < edgeFrom.length; edgeIndex += 1) {
      const left = edgeFrom[edgeIndex]!;
      const right = edgeTo[edgeIndex]!;
      const dx = pointX[left]! - pointX[right]!;
      const dy = pointY[left]! - pointY[right]!;
      const length = Math.max(1e-9, Math.hypot(dx, dy));
      const force = (length * length) / k;
      const fx = dx / length * force;
      const fy = dy / length * force;
      displacementX[left] -= fx;
      displacementY[left] -= fy;
      displacementX[right] += fx;
      displacementY[right] += fy;
      attractionEvaluations += 1;
    }

    const progress = iteration / input.iterations;
    const temperature = input.initialTemperature * Math.pow(1 - progress, 1.35);
    let maxDisplacement = 0;
    let totalDisplacement = 0;

    for (let index = 0; index < nodeCount; index += 1) {
      const dx = displacementX[index]!;
      const dy = displacementY[index]!;
      const magnitude = Math.hypot(dx, dy);
      const move = Math.min(magnitude, temperature);
      if (magnitude > 1e-9 && move > 0) {
        pointX[index] += dx / magnitude * move;
        pointY[index] += dy / magnitude * move;
      }
      pointX[index] = Math.max(margin, Math.min(input.width - margin, pointX[index]!));
      pointY[index] = Math.max(margin, Math.min(input.height - margin, pointY[index]!));
      maxDisplacement = Math.max(maxDisplacement, move);
      totalDisplacement += move;
    }

    if (iteration === 1 || iteration % input.sampleEvery === 0 || iteration === input.iterations) {
      samples.push({
        iteration,
        temperature: round(temperature),
        maxDisplacement: round(maxDisplacement),
        totalDisplacement: round(totalDisplacement),
        meanEdgeLength: round(meanEdgeLength(pointX, pointY, edgeFrom, edgeTo)),
      });
    }
  }

  const finalPositions = input.nodes.map((node, index) => ({
    id: node.id,
    x: round(pointX[index]!),
    y: round(pointY[index]!),
  }));
  const geometry = finalPositions.map((point) => ({
    id: point.id,
    x: round(point.x - input.nodeSize / 2),
    y: round(point.y - input.nodeSize / 2),
    width: input.nodeSize,
    height: input.nodeSize,
  }));

  if (repulsionPairs !== pairCount * input.iterations) {
    throw new Error("force-directed repulsion work accounting drifted from the deterministic pair contract");
  }

  return {
    geometry,
    initialPositions: initialPositions.map((point) => ({id: point.id, x: round(point.x), y: round(point.y)})),
    finalPositions,
    samples,
    repulsionPairs,
    attractionEvaluations,
    iterations: input.iterations,
    characteristicLength: round(k),
  };
}

export function buildForceDirectedFixture(seed = 20260912): ForceDirectedInput {
  return {
    seed,
    width: 520,
    height: 360,
    nodeSize: 28,
    iterations: 160,
    initialTemperature: 54,
    sampleEvery: 20,
    nodes: [
      {id: "A"}, {id: "B"}, {id: "C"}, {id: "D"},
      {id: "E"}, {id: "F"}, {id: "G"}, {id: "H"},
    ],
    edges: [
      {id: "a-b", from: "A", to: "B"},
      {id: "b-c", from: "B", to: "C"},
      {id: "c-d", from: "C", to: "D"},
      {id: "d-a", from: "D", to: "A"},
      {id: "a-c", from: "A", to: "C"},
      {id: "e-f", from: "E", to: "F"},
      {id: "f-g", from: "F", to: "G"},
      {id: "g-h", from: "G", to: "H"},
      {id: "h-e", from: "H", to: "E"},
      {id: "e-g", from: "E", to: "G"},
      {id: "d-e", from: "D", to: "E"},
    ],
  };
}
