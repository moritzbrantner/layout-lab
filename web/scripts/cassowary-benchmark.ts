import {
  CassowarySolver,
  ConstraintStrength,
  ConstraintVariable,
  LinearConstraint,
  expression,
} from "../lib/cassowary";

const VARIABLE_COUNT = 250;
const ITERATIONS = 1_000;

function buildSolver() {
  const solver = new CassowarySolver();
  const variables = Array.from(
    {length: VARIABLE_COUNT},
    (_, index) => new ConstraintVariable(`x${index}`),
  );

  solver.addConstraint(new LinearConstraint(
    "x0 = 0",
    expression(0, [variables[0]!, 1]),
    "==",
  ));

  for (let index = 1; index < variables.length; index += 1) {
    solver.addConstraint(new LinearConstraint(
      `x${index} = x${index - 1} + 1`,
      expression(-1, [variables[index]!, 1], [variables[index - 1]!, -1]),
      "==",
    ));
  }

  return {solver, last: variables.at(-1)!};
}

function runIncrementalMutations() {
  const {solver, last} = buildSolver();
  const started = performance.now();

  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    const preference = new LinearConstraint(
      `prefer last = ${VARIABLE_COUNT + (iteration % 11)}`,
      expression(-(VARIABLE_COUNT + (iteration % 11)), [last, 1]),
      "==",
      ConstraintStrength.weak,
    );
    solver.addConstraint(preference);
    solver.removeConstraint(preference);
  }

  const elapsedMs = performance.now() - started;
  const mutations = ITERATIONS * 2;
  return {
    variables: VARIABLE_COUNT,
    mutations,
    elapsedMs,
    mutationsPerSecond: mutations / (elapsedMs / 1_000),
  };
}

const result = runIncrementalMutations();
console.log(JSON.stringify({
  workload: "cassowary-incremental-add-remove",
  ...result,
  elapsedMs: Number(result.elapsedMs.toFixed(2)),
  mutationsPerSecond: Math.round(result.mutationsPerSecond),
}, null, 2));
