import {
  CassowarySolver,
  ConstraintStrength,
  ConstraintVariable,
  LinearConstraint,
  constraintViolation,
  expression,
  type CassowaryOperation,
} from "./cassowary";
import type {AlgorithmGeometry} from "./algorithm-zoo";

export type ConstraintLayoutSnapshot = {
  operation: string;
  kind: "add" | "remove";
  pivots: number;
  panelAWidth: number;
  panelBLeft: number;
  panelBWidth: number;
};

export type ConstraintLayoutResult = {
  geometry: readonly AlgorithmGeometry[];
  snapshots: readonly ConstraintLayoutSnapshot[];
  diagnostics: readonly string[];
  operations: readonly CassowaryOperation[];
  pivots: number;
  rows: number;
  constraints: number;
};

function round(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function solveConstraintLayout(containerWidth = 640, gap = 16): ConstraintLayoutResult {
  if (!Number.isFinite(containerWidth) || containerWidth < 420) {
    throw new Error("constraint fixture requires a finite container width of at least 420px");
  }
  if (!Number.isFinite(gap) || gap < 0 || containerWidth - gap < 410) {
    throw new Error("constraint fixture requires a finite non-negative gap with room for both panels and the temporary cap");
  }

  const solver = new CassowarySolver();
  const panelALeft = new ConstraintVariable("panel-a.left");
  const panelAWidth = new ConstraintVariable("panel-a.width");
  const panelBLeft = new ConstraintVariable("panel-b.left");
  const panelBWidth = new ConstraintVariable("panel-b.width");
  const snapshots: ConstraintLayoutSnapshot[] = [];

  const required = [
    new LinearConstraint("A starts at container left", expression(0, [panelALeft, 1]), "=="),
    new LinearConstraint("A width >= 140", expression(-140, [panelAWidth, 1]), ">="),
    new LinearConstraint(
      `B follows A with ${gap}px gap`,
      expression(-gap, [panelBLeft, 1], [panelALeft, -1], [panelAWidth, -1]),
      "==",
    ),
    new LinearConstraint("B width >= 180", expression(-180, [panelBWidth, 1]), ">="),
    new LinearConstraint(
      "B ends at container right",
      expression(-containerWidth, [panelBLeft, 1], [panelBWidth, 1]),
      "==",
    ),
  ] as const;

  const availableWidth = containerWidth - gap;
  const strongA = new LinearConstraint(
    "strong A width preference",
    expression(-availableWidth * 0.4, [panelAWidth, 1]),
    "==",
    ConstraintStrength.strong,
  );
  const mediumB = new LinearConstraint(
    "medium B width preference",
    expression(-availableWidth * 0.7, [panelBWidth, 1]),
    "==",
    ConstraintStrength.medium,
  );
  const weakDivider = new LinearConstraint(
    "weak divider position preference",
    expression(-containerWidth * 0.5, [panelBLeft, 1]),
    "==",
    ConstraintStrength.weak,
  );
  const temporaryCap = new LinearConstraint(
    "temporary A width cap",
    expression(-(availableWidth * 0.4 - 24), [panelAWidth, 1]),
    "<=",
  );

  const record = (operation: string, kind: "add" | "remove") => {
    solver.updateVariables();
    const last = solver.operations.at(-1);
    snapshots.push({
      operation,
      kind,
      pivots: last?.pivots ?? 0,
      panelAWidth: round(panelAWidth.value),
      panelBLeft: round(panelBLeft.value),
      panelBWidth: round(panelBWidth.value),
    });
  };

  required.forEach((constraint) => {
    solver.addConstraint(constraint);
    record(constraint.label, "add");
  });
  solver.addConstraint(mediumB);
  record(mediumB.label, "add");
  solver.addConstraint(strongA);
  record(strongA.label, "add");
  solver.addConstraint(weakDivider);
  record(weakDivider.label, "add");

  solver.addConstraint(temporaryCap);
  record(temporaryCap.label, "add");
  solver.removeConstraint(temporaryCap);
  record(temporaryCap.label, "remove");
  solver.updateVariables();

  const preferenceDiagnostics = [strongA, mediumB, weakDivider]
    .map((constraint) => ({constraint, violation: constraintViolation(constraint)}))
    .filter(({violation}) => violation > 1e-6)
    .map(({constraint, violation}) => `${constraint.label}: ${round(violation)}px residual`);

  return {
    geometry: [
      {id: "constraint-root", x: 0, y: 0, width: containerWidth, height: 140},
      {id: "panel-a", x: round(panelALeft.value), y: 0, width: round(panelAWidth.value), height: 140},
      {id: "panel-b", x: round(panelBLeft.value), y: 0, width: round(panelBWidth.value), height: 140},
    ],
    snapshots,
    diagnostics: preferenceDiagnostics,
    operations: solver.operations,
    pivots: solver.pivotCount,
    rows: solver.rowCount,
    constraints: solver.constraintCount,
  };
}
