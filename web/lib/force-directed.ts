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

function distance(left: ForcePoint, right: ForcePoint) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function meanEdgeLength(points: ReadonlyMap<string, ForcePoint>, edges: readonly ForceGraphEdge[]) {
  if (edges.length === 0) return 0;
  return edges.reduce((sum, edge) => sum + distance(points.get(edge.from)!, points.get(edge.to)!), 0) / edges.length;
}

export function layoutForceDirected(input: ForceDirectedInput): ForceDirectedResult {
  validateInput(input);
  const random = makeRandom(input.seed);
  const margin = input.nodeSize / 2;
  const usableWidth = input.width - input.nodeSize;
  const usableHeight = input.height - input.nodeSize;
  const points = new Map<string, ForcePoint>();
  input.nodes.forEach((node) => {
    points.set(node.id, {
      id: node.id,
      x: margin + random() * usableWidth,
      y: margin + random() * usableHeight,
    });
  });
  const initialPositions = input.nodes.map((node) => ({...points.get(node.id)!}));
  const area = usableWidth * usableHeight;
  const k = Math.sqrt(area / input.nodes.length);
  const pairCount = input.nodes.length * (input.nodes.length - 1) / 2;
  let repulsionPairs = 0;
  let attractionEvaluations = 0;
  const samples: ForceConvergenceSample[] = [];

  for (let iteration = 1; iteration <= input.iterations; iteration += 1) {
    const displacement = new Map(input.nodes.map((node) => [node.id, {x: 0, y: 0}]));

    for (let first = 0; first < input.nodes.length; first += 1) {
      for (let second = first + 1; second < input.nodes.length; second += 1) {
        const left = points.get(input.nodes[first]!.id)!;
        const right = points.get(input.nodes[second]!.id)!;
        let dx = left.x - right.x;
        let dy = left.y - right.y;
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
        const leftDisp = displacement.get(left.id)!;
        const rightDisp = displacement.get(right.id)!;
        leftDisp.x += fx;
        leftDisp.y += fy;
        rightDisp.x -= fx;
        rightDisp.y -= fy;
        repulsionPairs += 1;
      }
    }

    input.edges.forEach((edge) => {
      const left = points.get(edge.from)!;
      const right = points.get(edge.to)!;
      const dx = left.x - right.x;
      const dy = left.y - right.y;
      const length = Math.max(1e-9, Math.hypot(dx, dy));
      const force = (length * length) / k;
      const fx = dx / length * force;
      const fy = dy / length * force;
      const leftDisp = displacement.get(left.id)!;
      const rightDisp = displacement.get(right.id)!;
      leftDisp.x -= fx;
      leftDisp.y -= fy;
      rightDisp.x += fx;
      rightDisp.y += fy;
      attractionEvaluations += 1;
    });

    const progress = iteration / input.iterations;
    const temperature = input.initialTemperature * Math.pow(1 - progress, 1.35);
    let maxDisplacement = 0;
    let totalDisplacement = 0;

    input.nodes.forEach((node) => {
      const point = points.get(node.id)!;
      const disp = displacement.get(node.id)!;
      const magnitude = Math.hypot(disp.x, disp.y);
      const move = Math.min(magnitude, temperature);
      if (magnitude > 1e-9 && move > 0) {
        point.x += disp.x / magnitude * move;
        point.y += disp.y / magnitude * move;
      }
      point.x = Math.max(margin, Math.min(input.width - margin, point.x));
      point.y = Math.max(margin, Math.min(input.height - margin, point.y));
      maxDisplacement = Math.max(maxDisplacement, move);
      totalDisplacement += move;
    });

    if (iteration === 1 || iteration % input.sampleEvery === 0 || iteration === input.iterations) {
      samples.push({
        iteration,
        temperature: round(temperature),
        maxDisplacement: round(maxDisplacement),
        totalDisplacement: round(totalDisplacement),
        meanEdgeLength: round(meanEdgeLength(points, input.edges)),
      });
    }
  }

  const finalPositions = input.nodes.map((node) => ({
    id: node.id,
    x: round(points.get(node.id)!.x),
    y: round(points.get(node.id)!.y),
  }));
  const finalById = new Map(finalPositions.map((point) => [point.id, point]));
  const geometry = input.nodes.map((node) => {
    const point = finalById.get(node.id)!;
    return {
      id: node.id,
      x: round(point.x - input.nodeSize / 2),
      y: round(point.y - input.nodeSize / 2),
      width: input.nodeSize,
      height: input.nodeSize,
    };
  });

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
