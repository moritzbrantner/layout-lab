import {runScalingContract, SCALING_POPULATIONS, type ScalingSample} from "../lib/layout-scaling-contracts";

const result = runScalingContract();
if (result.violations.length > 0) {
  throw new Error(`layout scaling contract violated:\n${result.violations.join("\n")}`);
}

function sample(operation: ScalingSample["operation"], population: number) {
  const found = result.samples.find((candidate) => candidate.operation === operation && candidate.population === population);
  if (!found) throw new Error(`missing ${operation} sample at population ${population}`);
  return found;
}

function totalWork(entry: ScalingSample) {
  const counters = entry.counters;
  return counters.boundaryNodeVisits
    + counters.provenanceComparisons
    + counters.invalidationPhaseVisits
    + counters.invalidationEdgeTraversals
    + counters.executorVisits
    + counters.recomputedNodes
    + counters.solverPasses;
}

const smallest = SCALING_POPULATIONS[0];
const largest = SCALING_POPULATIONS[SCALING_POPULATIONS.length - 1]!;
const localLarge = sample("local-style", largest);
const noopLarge = sample("repeated-noop", largest);
const topologyLarge = sample("dependency-topology", largest);

console.log(JSON.stringify({
  workload: "incremental-layout-scaling",
  smallestTotalNodes: sample("local-style", smallest).dimensions.totalNodes,
  largestTotalNodes: localLarge.dimensions.totalNodes,
  affectedNodes: localLarge.dimensions.affectedNodes,
  affectedDepth: localLarge.dimensions.affectedDepth,
  localMutations: localLarge.dimensions.mutations,
  topologyMutations: topologyLarge.dimensions.mutations,
  contractViolations: result.violations.length,
  localWorkGrowth: totalWork(localLarge) - totalWork(sample("local-style", smallest)),
  localWork: totalWork(localLarge),
  localGraphRebuilds: localLarge.counters.graphRebuilds,
  noopWorkGrowth: totalWork(noopLarge) - totalWork(sample("repeated-noop", smallest)),
  noopRecomputedNodes: noopLarge.counters.recomputedNodes,
  noopExecutorVisits: noopLarge.counters.executorVisits,
  topologyGraphRebuilds: topologyLarge.counters.graphRebuilds,
}, null, 2));
