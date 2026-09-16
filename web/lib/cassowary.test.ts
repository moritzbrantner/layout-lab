import {describe, expect, test} from "bun:test";
import {
  CassowarySolver,
  ConstraintStrength,
  ConstraintVariable,
  LinearConstraint,
  constraintViolation,
  expression,
} from "./cassowary";

function approximately(value: number, expected: number) {
  expect(Math.abs(value - expected)).toBeLessThan(1e-6);
}

describe("CassowarySolver", () => {
  test("solves required equalities and inequalities with a strong preference", () => {
    const solver = new CassowarySolver();
    const x = new ConstraintVariable("x");
    const y = new ConstraintVariable("y");

    const constraints = [
      new LinearConstraint("x >= 0", expression(0, [x, 1]), ">="),
      new LinearConstraint("y = x + 10", expression(-10, [y, 1], [x, -1]), "=="),
      new LinearConstraint("y <= 100", expression(-100, [y, 1]), "<="),
      new LinearConstraint("prefer x = 40", expression(-40, [x, 1]), "==", ConstraintStrength.strong),
    ];

    constraints.forEach((constraint) => solver.addConstraint(constraint));
    solver.updateVariables();

    approximately(x.value, 40);
    approximately(y.value, 50);
    expect(constraints.every((constraint) => constraintViolation(constraint) < 1e-6)).toBe(true);
    expect(solver.constraintCount).toBe(4);
  });

  test("keeps stronger preferences ahead of weaker conflicting preferences", () => {
    const solver = new CassowarySolver();
    const x = new ConstraintVariable("x");
    const lower = new LinearConstraint("x >= 0", expression(0, [x, 1]), ">=");
    const upper = new LinearConstraint("x <= 100", expression(-100, [x, 1]), "<=");
    const strong = new LinearConstraint("strong x = 40", expression(-40, [x, 1]), "==", ConstraintStrength.strong);
    const medium = new LinearConstraint("medium x = 70", expression(-70, [x, 1]), "==", ConstraintStrength.medium);

    [lower, upper, strong, medium].forEach((constraint) => solver.addConstraint(constraint));
    solver.updateVariables();

    approximately(x.value, 40);
    approximately(constraintViolation(strong), 0);
    approximately(constraintViolation(medium), 30);
  });

  test("reoptimizes incrementally when a required cap is added and removed", () => {
    const solver = new CassowarySolver();
    const x = new ConstraintVariable("x");
    const lower = new LinearConstraint("x >= 0", expression(0, [x, 1]), ">=");
    const preferred = new LinearConstraint("prefer x = 40", expression(-40, [x, 1]), "==", ConstraintStrength.strong);
    const cap = new LinearConstraint("temporary x <= 30", expression(-30, [x, 1]), "<=");

    solver.addConstraint(lower);
    solver.addConstraint(preferred);
    solver.updateVariables();
    approximately(x.value, 40);

    solver.addConstraint(cap);
    solver.updateVariables();
    approximately(x.value, 30);

    solver.removeConstraint(cap);
    solver.updateVariables();
    approximately(x.value, 40);

    expect(solver.operations.map((operation) => [operation.kind, operation.constraint])).toEqual([
      ["add", "x >= 0"],
      ["add", "prefer x = 40"],
      ["add", "temporary x <= 30"],
      ["remove", "temporary x <= 30"],
    ]);
  });

  test("fails closed for incompatible required equalities", () => {
    const solver = new CassowarySolver();
    const x = new ConstraintVariable("x");
    solver.addConstraint(new LinearConstraint("x = 10", expression(-10, [x, 1]), "=="));

    expect(() => solver.addConstraint(
      new LinearConstraint("x = 20", expression(-20, [x, 1]), "=="),
    )).toThrow("unsatisfiable required constraint");
  });

  test("restores exact observable state after a failed required insertion", () => {
    const solver = new CassowarySolver();
    const x = new ConstraintVariable("x");
    const y = new ConstraintVariable("y");
    const lower = new LinearConstraint("x >= 10", expression(-10, [x, 1]), ">=");
    const offset = new LinearConstraint("y = x + 5", expression(-5, [y, 1], [x, -1]), "==");
    const impossibleUpper = new LinearConstraint("y <= 12", expression(-12, [y, 1]), "<=");

    solver.addConstraint(lower);
    solver.addConstraint(offset);
    solver.updateVariables();

    const before = {
      constraints: solver.constraintCount,
      rows: solver.rowCount,
      pivots: solver.pivotCount,
      operations: solver.operations.map((operation) => ({...operation})),
      x: x.value,
      y: y.value,
    };

    expect(() => solver.addConstraint(impossibleUpper)).toThrow("unsatisfiable required constraint");
    solver.updateVariables();

    expect(solver.constraintCount).toBe(before.constraints);
    expect(solver.rowCount).toBe(before.rows);
    expect(solver.pivotCount).toBe(before.pivots);
    expect(solver.operations).toEqual(before.operations);
    approximately(x.value, before.x);
    approximately(y.value, before.y);
  });

  test("remains usable after a failed required inequality insertion", () => {
    const solver = new CassowarySolver();
    const x = new ConstraintVariable("x");
    const lower = new LinearConstraint("x >= 10", expression(-10, [x, 1]), ">=");
    const impossibleUpper = new LinearConstraint("x <= 5", expression(-5, [x, 1]), "<=");
    const preferred = new LinearConstraint("prefer x = 12", expression(-12, [x, 1]), "==", ConstraintStrength.strong);

    solver.addConstraint(lower);
    expect(() => solver.addConstraint(impossibleUpper)).toThrow("unsatisfiable required constraint");
    solver.addConstraint(preferred);
    solver.updateVariables();

    approximately(x.value, 12);
    expect(solver.constraintCount).toBe(2);
  });
});
