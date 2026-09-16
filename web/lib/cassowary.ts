const EPSILON = 1e-8;

export const ConstraintStrength = {
  required: 1_001_001_000,
  strong: 1_000_000,
  medium: 1_000,
  weak: 1,
} as const;

export type ConstraintStrengthValue = number;
export type ConstraintOperator = "==" | "<=" | ">=";

export class ConstraintVariable {
  value = 0;

  constructor(public readonly name: string) {}
}

export type LinearTerm = {
  variable: ConstraintVariable;
  coefficient: number;
};

export class LinearExpression {
  constructor(
    public readonly constant = 0,
    public readonly terms: readonly LinearTerm[] = [],
  ) {}

  evaluate() {
    return this.terms.reduce(
      (value, term) => value + term.variable.value * term.coefficient,
      this.constant,
    );
  }
}

export class LinearConstraint {
  readonly strength: number;

  constructor(
    public readonly label: string,
    public readonly expression: LinearExpression,
    public readonly operator: ConstraintOperator,
    strength: ConstraintStrengthValue = ConstraintStrength.required,
  ) {
    this.strength = Math.min(Math.max(0, strength), ConstraintStrength.required);
  }
}

type SymbolType = "invalid" | "external" | "slack" | "error" | "dummy";

type SolverSymbol = {
  id: number;
  type: SymbolType;
};

type ConstraintTag = {
  marker: SolverSymbol;
  other: SolverSymbol;
};

export type CassowaryOperation = {
  kind: "add" | "remove";
  constraint: string;
  pivots: number;
  rows: number;
};

const INVALID_SYMBOL: SolverSymbol = {id: 0, type: "invalid"};

function nearZero(value: number) {
  return Math.abs(value) < EPSILON;
}

function symbolKey(symbol: SolverSymbol) {
  return `${symbol.type}:${symbol.id}`;
}

class Row {
  readonly cells = new Map<SolverSymbol, number>();

  constructor(public constant = 0) {}

  clone() {
    const row = new Row(this.constant);
    this.cells.forEach((coefficient, symbol) => row.cells.set(symbol, coefficient));
    return row;
  }

  insertSymbol(symbol: SolverSymbol, coefficient = 1) {
    const next = (this.cells.get(symbol) ?? 0) + coefficient;
    if (nearZero(next)) this.cells.delete(symbol);
    else this.cells.set(symbol, next);
  }

  insertRow(other: Row, coefficient = 1) {
    this.constant += other.constant * coefficient;
    other.cells.forEach((value, symbol) => this.insertSymbol(symbol, value * coefficient));
  }

  remove(symbol: SolverSymbol) {
    const coefficient = this.cells.get(symbol) ?? 0;
    this.cells.delete(symbol);
    return coefficient;
  }

  reverseSign() {
    this.constant = -this.constant;
    this.cells.forEach((coefficient, symbol) => this.cells.set(symbol, -coefficient));
  }

  solveFor(symbol: SolverSymbol) {
    const coefficient = this.remove(symbol);
    if (nearZero(coefficient)) throw new Error(`cannot solve row for ${symbolKey(symbol)}`);
    const reciprocal = -1 / coefficient;
    this.constant *= reciprocal;
    this.cells.forEach((value, cell) => this.cells.set(cell, value * reciprocal));
  }

  solveForSymbols(lhs: SolverSymbol, rhs: SolverSymbol) {
    this.insertSymbol(lhs, -1);
    this.solveFor(rhs);
  }

  coefficientFor(symbol: SolverSymbol) {
    return this.cells.get(symbol) ?? 0;
  }

  substitute(symbol: SolverSymbol, row: Row) {
    const coefficient = this.cells.get(symbol);
    if (coefficient === undefined) return;
    this.cells.delete(symbol);
    this.insertRow(row, coefficient);
  }
}

type SolverSnapshot = {
  constraints: Map<LinearConstraint, ConstraintTag>;
  rows: Map<SolverSymbol, Row>;
  variables: Map<ConstraintVariable, SolverSymbol>;
  objective: Row;
  artificial: Row | null;
  nextSymbolId: number;
  pivotCount: number;
  operationLogLength: number;
};

export class CassowarySolver {
  private constraints = new Map<LinearConstraint, ConstraintTag>();
  private rows = new Map<SolverSymbol, Row>();
  private variables = new Map<ConstraintVariable, SolverSymbol>();
  private objective = new Row();
  private artificial: Row | null = null;
  private nextSymbolId = 1;
  private pivotCountValue = 0;
  private readonly operationLog: CassowaryOperation[] = [];
  private transaction: SolverSnapshot | null = null;

  get pivotCount() {
    return this.pivotCountValue;
  }

  get rowCount() {
    return this.rows.size;
  }

  get constraintCount() {
    return this.constraints.size;
  }

  get operations(): readonly CassowaryOperation[] {
    return this.operationLog;
  }

  addConstraint(constraint: LinearConstraint) {
    if (this.constraints.has(constraint)) throw new Error(`duplicate constraint: ${constraint.label}`);
    const snapshot = this.snapshotState();
    const pivotStart = this.pivotCountValue;

    try {
      const tag: ConstraintTag = {marker: INVALID_SYMBOL, other: INVALID_SYMBOL};
      const row = this.createRow(constraint, tag);
      let subject = this.chooseSubject(row, tag);

      if (subject.type === "invalid" && this.allDummies(row)) {
        if (!nearZero(row.constant)) throw new Error(`unsatisfiable required constraint: ${constraint.label}`);
        subject = tag.marker;
      }

      if (subject.type === "invalid") {
        if (!this.addWithArtificialVariable(row)) {
          throw new Error(`unsatisfiable required constraint: ${constraint.label}`);
        }
      } else {
        row.solveFor(subject);
        this.substitute(subject, row);
        this.rows.set(subject, row);
      }

      this.constraints.set(constraint, tag);
      this.optimize(this.objective);
      this.recordOperation("add", constraint.label, pivotStart);
      this.commitState(snapshot);
    } catch (error) {
      this.restoreState(snapshot);
      throw error;
    }
  }

  removeConstraint(constraint: LinearConstraint) {
    const tag = this.constraints.get(constraint);
    if (!tag) throw new Error(`unknown constraint: ${constraint.label}`);
    const snapshot = this.snapshotState();
    const pivotStart = this.pivotCountValue;

    try {
      this.constraints.delete(constraint);
      this.removeConstraintEffects(constraint, tag);

      if (this.rows.has(tag.marker)) {
        this.rows.delete(tag.marker);
      } else {
        const leaving = this.getMarkerLeavingSymbol(tag.marker);
        if (leaving.type === "invalid") {
          throw new Error(`failed to find leaving row for ${constraint.label}`);
        }
        const row = this.writableRow(leaving)!;
        this.rows.delete(leaving);
        row.solveForSymbols(leaving, tag.marker);
        this.substitute(tag.marker, row);
      }

      this.optimize(this.objective);
      this.recordOperation("remove", constraint.label, pivotStart);
      this.commitState(snapshot);
    } catch (error) {
      this.restoreState(snapshot);
      throw error;
    }
  }

  updateVariables() {
    this.variables.forEach((symbol, variable) => {
      variable.value = this.rows.get(symbol)?.constant ?? 0;
    });
  }

  private snapshotState(): SolverSnapshot {
    if (this.transaction) throw new Error("nested Cassowary mutation");

    const snapshot: SolverSnapshot = {
      constraints: this.constraints,
      rows: this.rows,
      variables: this.variables,
      objective: this.objective,
      artificial: this.artificial,
      nextSymbolId: this.nextSymbolId,
      pivotCount: this.pivotCountValue,
      operationLogLength: this.operationLog.length,
    };

    // Keep an immutable rollback view while sharing existing tableau rows. Rows
    // are cloned lazily by writableRow only when the mutation actually touches
    // them, so successful incremental updates avoid cloning the entire solver.
    this.constraints = new Map(this.constraints);
    this.rows = new Map(this.rows);
    this.variables = new Map(this.variables);
    this.objective = this.objective.clone();
    this.artificial = this.artificial?.clone() ?? null;
    this.transaction = snapshot;
    return snapshot;
  }

  private commitState(snapshot: SolverSnapshot) {
    if (this.transaction !== snapshot) throw new Error("Cassowary transaction mismatch");
    this.transaction = null;
  }

  private restoreState(snapshot: SolverSnapshot) {
    this.constraints = snapshot.constraints;
    this.rows = snapshot.rows;
    this.variables = snapshot.variables;
    this.objective = snapshot.objective;
    this.artificial = snapshot.artificial;
    this.nextSymbolId = snapshot.nextSymbolId;
    this.pivotCountValue = snapshot.pivotCount;
    this.operationLog.length = snapshot.operationLogLength;
    this.transaction = null;
  }

  private writableRow(symbol: SolverSymbol) {
    const row = this.rows.get(symbol);
    if (!row) return undefined;

    const snapshotRow = this.transaction?.rows.get(symbol);
    if (snapshotRow !== row) return row;

    const writable = row.clone();
    this.rows.set(symbol, writable);
    return writable;
  }

  private recordOperation(kind: CassowaryOperation["kind"], constraint: string, pivotStart: number) {
    this.operationLog.push({
      kind,
      constraint,
      pivots: this.pivotCountValue - pivotStart,
      rows: this.rows.size,
    });
  }

  private makeSymbol(type: Exclude<SymbolType, "invalid">): SolverSymbol {
    return {id: this.nextSymbolId++, type};
  }

  private symbolForVariable(variable: ConstraintVariable) {
    let symbol = this.variables.get(variable);
    if (!symbol) {
      symbol = this.makeSymbol("external");
      this.variables.set(variable, symbol);
    }
    return symbol;
  }

  private createRow(constraint: LinearConstraint, tag: ConstraintTag) {
    const row = new Row(constraint.expression.constant);

    constraint.expression.terms.forEach((term) => {
      if (nearZero(term.coefficient)) return;
      const symbol = this.symbolForVariable(term.variable);
      const basic = this.rows.get(symbol);
      if (basic) row.insertRow(basic, term.coefficient);
      else row.insertSymbol(symbol, term.coefficient);
    });

    if (constraint.operator === "<=" || constraint.operator === ">=") {
      const coefficient = constraint.operator === "<=" ? 1 : -1;
      const slack = this.makeSymbol("slack");
      tag.marker = slack;
      row.insertSymbol(slack, coefficient);

      if (constraint.strength < ConstraintStrength.required) {
        const error = this.makeSymbol("error");
        tag.other = error;
        row.insertSymbol(error, -coefficient);
        this.objective.insertSymbol(error, constraint.strength);
      }
    } else if (constraint.strength < ConstraintStrength.required) {
      const errorPlus = this.makeSymbol("error");
      const errorMinus = this.makeSymbol("error");
      tag.marker = errorPlus;
      tag.other = errorMinus;
      row.insertSymbol(errorPlus, -1);
      row.insertSymbol(errorMinus, 1);
      this.objective.insertSymbol(errorPlus, constraint.strength);
      this.objective.insertSymbol(errorMinus, constraint.strength);
    } else {
      const dummy = this.makeSymbol("dummy");
      tag.marker = dummy;
      row.insertSymbol(dummy, 1);
    }

    if (row.constant < 0) row.reverseSign();
    return row;
  }

  private chooseSubject(row: Row, tag: ConstraintTag) {
    for (const symbol of row.cells.keys()) {
      if (symbol.type === "external") return symbol;
    }

    if (
      (tag.marker.type === "slack" || tag.marker.type === "error")
      && row.coefficientFor(tag.marker) < 0
    ) return tag.marker;

    if (
      (tag.other.type === "slack" || tag.other.type === "error")
      && row.coefficientFor(tag.other) < 0
    ) return tag.other;

    return INVALID_SYMBOL;
  }

  private allDummies(row: Row) {
    for (const symbol of row.cells.keys()) {
      if (symbol.type !== "dummy") return false;
    }
    return true;
  }

  private addWithArtificialVariable(row: Row) {
    const artificialSymbol = this.makeSymbol("slack");
    this.rows.set(artificialSymbol, row.clone());
    this.artificial = row.clone();
    this.optimize(this.artificial);
    const success = nearZero(this.artificial.constant);
    this.artificial = null;

    const basicRow = this.rows.get(artificialSymbol);
    if (basicRow) {
      this.rows.delete(artificialSymbol);
      if (basicRow.cells.size > 0) {
        const entering = this.anyPivotableSymbol(basicRow);
        if (entering.type === "invalid") return false;
        basicRow.solveForSymbols(artificialSymbol, entering);
        this.substitute(entering, basicRow);
        this.rows.set(entering, basicRow);
      }
    }

    for (const [symbol, candidate] of this.rows) {
      if (!candidate.cells.has(artificialSymbol)) continue;
      this.writableRow(symbol)!.remove(artificialSymbol);
    }
    this.objective.remove(artificialSymbol);
    return success;
  }

  private anyPivotableSymbol(row: Row) {
    for (const symbol of row.cells.keys()) {
      if (symbol.type === "slack" || symbol.type === "error") return symbol;
    }
    return INVALID_SYMBOL;
  }

  private substitute(symbol: SolverSymbol, row: Row) {
    for (const [candidateSymbol, candidate] of this.rows) {
      if (!candidate.cells.has(symbol)) continue;
      this.writableRow(candidateSymbol)!.substitute(symbol, row);
    }
    this.objective.substitute(symbol, row);
    this.artificial?.substitute(symbol, row);
  }

  private optimize(objective: Row) {
    while (true) {
      const entering = this.getEnteringSymbol(objective);
      if (entering.type === "invalid") return;
      const leaving = this.getLeavingSymbol(entering);
      if (leaving.type === "invalid") throw new Error("objective is unbounded");
      const row = this.writableRow(leaving)!;
      this.rows.delete(leaving);
      row.solveForSymbols(leaving, entering);
      this.substitute(entering, row);
      this.rows.set(entering, row);
      this.pivotCountValue += 1;
    }
  }

  private getEnteringSymbol(objective: Row) {
    for (const [symbol, coefficient] of objective.cells) {
      if (symbol.type !== "dummy" && coefficient < -EPSILON) return symbol;
    }
    return INVALID_SYMBOL;
  }

  private getLeavingSymbol(entering: SolverSymbol) {
    let ratio = Number.POSITIVE_INFINITY;
    let found = INVALID_SYMBOL;

    this.rows.forEach((row, symbol) => {
      if (symbol.type === "external") return;
      const coefficient = row.coefficientFor(entering);
      if (coefficient >= -EPSILON) return;
      const candidate = -row.constant / coefficient;
      if (
        candidate < ratio - EPSILON
        || (nearZero(candidate - ratio) && symbol.id < found.id)
      ) {
        ratio = candidate;
        found = symbol;
      }
    });

    return found;
  }

  private removeConstraintEffects(constraint: LinearConstraint, tag: ConstraintTag) {
    if (tag.marker.type === "error") this.removeMarkerEffect(tag.marker, constraint.strength);
    if (tag.other.type === "error") this.removeMarkerEffect(tag.other, constraint.strength);
  }

  private removeMarkerEffect(marker: SolverSymbol, strength: number) {
    const row = this.rows.get(marker);
    if (row) this.objective.insertRow(row, -strength);
    else this.objective.insertSymbol(marker, -strength);
  }

  private getMarkerLeavingSymbol(marker: SolverSymbol) {
    let first = INVALID_SYMBOL;
    let second = INVALID_SYMBOL;
    let third = INVALID_SYMBOL;
    let firstRatio = Number.POSITIVE_INFINITY;
    let secondRatio = Number.POSITIVE_INFINITY;

    this.rows.forEach((row, symbol) => {
      const coefficient = row.coefficientFor(marker);
      if (nearZero(coefficient)) return;

      if (symbol.type === "external") {
        if (third.type === "invalid" || symbol.id < third.id) third = symbol;
      } else if (coefficient < 0) {
        const ratio = -row.constant / coefficient;
        if (ratio < firstRatio - EPSILON || (nearZero(ratio - firstRatio) && symbol.id < first.id)) {
          firstRatio = ratio;
          first = symbol;
        }
      } else {
        const ratio = row.constant / coefficient;
        if (ratio < secondRatio - EPSILON || (nearZero(ratio - secondRatio) && symbol.id < second.id)) {
          secondRatio = ratio;
          second = symbol;
        }
      }
    });

    if (first.type !== "invalid") return first;
    if (second.type !== "invalid") return second;
    return third;
  }
}

export function constraintViolation(constraint: LinearConstraint) {
  const value = constraint.expression.evaluate();
  if (constraint.operator === "==") return Math.abs(value);
  if (constraint.operator === "<=") return Math.max(0, value);
  return Math.max(0, -value);
}

export function expression(
  constant: number,
  ...terms: readonly [ConstraintVariable, number][]
) {
  return new LinearExpression(
    constant,
    terms.map(([variable, coefficient]) => ({variable, coefficient})),
  );
}
