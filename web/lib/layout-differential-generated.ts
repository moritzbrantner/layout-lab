import type {BrowserLayoutGeometry, GeometryComparison} from "./browser-layout-adapter";
import {
  compareLayoutDifferentialFixture,
  engineGeometryForDifferentialFixture,
  getLayoutDifferentialFixture,
  type LayoutDifferentialFixture,
  type LayoutDifferentialFixtureId,
} from "./layout-differential-corpus";

export const DIFFERENTIAL_GENERATOR_VERSION = "layout-generated-v1";
export const DIFFERENTIAL_EVIDENCE_VERSION = "layout-differential-evidence-v1";
export const GENERATED_WIDTH_MIN = 360;
export const GENERATED_WIDTH_MAX = 760;
export const GENERATED_WIDTH_STEP = 10;
export const GENERATED_GAP_MIN = 0;
export const GENERATED_GAP_MAX = 40;
export const GENERATED_GAP_STEP = 2;

export type GeneratedLayoutKind = "flex" | "grid";
export type DifferentialBrowserEngine = "chromium" | "firefox" | "webkit";

export type GeneratedLayoutCase = {
  id: string;
  generatorVersion: typeof DIFFERENTIAL_GENERATOR_VERSION;
  seed: number;
  index: number;
  kind: GeneratedLayoutKind;
  fixtureId: Extract<LayoutDifferentialFixtureId, "flex-engine" | "grid-engine">;
  innerSize: number;
  gapSize: number;
  replayKey: string;
};

export type DifferentialMismatchField = {
  id: string;
  field: "x" | "y" | "width" | "height" | "missing";
  delta: number | null;
};

export type DifferentialMismatchEvidence = {
  schemaVersion: typeof DIFFERENTIAL_EVIDENCE_VERSION;
  generatorVersion: typeof DIFFERENTIAL_GENERATOR_VERSION;
  case: GeneratedLayoutCase;
  browser: {
    engine: DifferentialBrowserEngine;
    version: string;
  };
  policyVersion: string;
  browserGeometry: readonly BrowserLayoutGeometry[];
  mismatches: readonly DifferentialMismatchField[];
  fingerprint: string;
};

export type DifferentialMinimizationResult = {
  original: GeneratedLayoutCase;
  minimized: GeneratedLayoutCase;
  attemptedCases: number;
};

function assertStep(value: number, minimum: number, maximum: number, step: number, label: string) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}`);
  }
  const steps = (value - minimum) / step;
  if (Math.abs(steps - Math.round(steps)) > 1e-9) {
    throw new Error(`${label} must align to step ${step}`);
  }
}

function normalizeSeed(seed: number) {
  if (!Number.isFinite(seed)) throw new Error("generated layout seed must be finite");
  return Math.trunc(seed) >>> 0;
}

function hexSeed(seed: number) {
  return normalizeSeed(seed).toString(16).padStart(8, "0");
}

function caseId(kind: GeneratedLayoutKind, seed: number, index: number, innerSize: number, gapSize: number) {
  return `${kind}-${hexSeed(seed)}-${String(index).padStart(3, "0")}-${innerSize}-${gapSize}`;
}

function replayKey(seed: number, index: number) {
  return `${DIFFERENTIAL_GENERATOR_VERSION}:${hexSeed(seed)}:${index}`;
}

function makeCase({
  seed,
  index,
  kind,
  innerSize,
  gapSize,
}: {
  seed: number;
  index: number;
  kind: GeneratedLayoutKind;
  innerSize: number;
  gapSize: number;
}): GeneratedLayoutCase {
  if (!Number.isInteger(index) || index < 0) throw new Error("generated layout case index must be a non-negative integer");
  assertStep(innerSize, GENERATED_WIDTH_MIN, GENERATED_WIDTH_MAX, GENERATED_WIDTH_STEP, "generated layout innerSize");
  assertStep(gapSize, GENERATED_GAP_MIN, GENERATED_GAP_MAX, GENERATED_GAP_STEP, "generated layout gapSize");
  const safeSeed = normalizeSeed(seed);
  return {
    id: caseId(kind, safeSeed, index, innerSize, gapSize),
    generatorVersion: DIFFERENTIAL_GENERATOR_VERSION,
    seed: safeSeed,
    index,
    kind,
    fixtureId: kind === "flex" ? "flex-engine" : "grid-engine",
    innerSize,
    gapSize,
    replayKey: replayKey(safeSeed, index),
  };
}

export function createGeneratedLayoutCase(input: {
  seed: number;
  index: number;
  kind: GeneratedLayoutKind;
  innerSize: number;
  gapSize: number;
}) {
  return makeCase(input);
}

function createRandom(seed: number) {
  let state = normalizeSeed(seed) || 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x1_0000_0000;
  };
}

function pickStepped(random: () => number, minimum: number, maximum: number, step: number) {
  const count = Math.floor((maximum - minimum) / step) + 1;
  const index = Math.min(count - 1, Math.floor(random() * count));
  return minimum + index * step;
}

export function generateLayoutDifferentialCases(seed: number, count: number): readonly GeneratedLayoutCase[] {
  if (!Number.isInteger(count) || count < 0 || count > 512) {
    throw new Error("generated layout case count must be an integer between 0 and 512");
  }
  const safeSeed = normalizeSeed(seed);
  const random = createRandom(safeSeed);
  return Array.from({length: count}, (_, index) => {
    const kind: GeneratedLayoutKind = random() < 0.5 ? "flex" : "grid";
    const innerSize = pickStepped(random, GENERATED_WIDTH_MIN, GENERATED_WIDTH_MAX, GENERATED_WIDTH_STEP);
    const gapSize = pickStepped(random, GENERATED_GAP_MIN, GENERATED_GAP_MAX, GENERATED_GAP_STEP);
    return makeCase({seed: safeSeed, index, kind, innerSize, gapSize});
  });
}

export function replayGeneratedLayoutCase(seed: number, index: number): GeneratedLayoutCase {
  if (!Number.isInteger(index) || index < 0 || index >= 512) {
    throw new Error("generated layout replay index must be an integer between 0 and 511");
  }
  return generateLayoutDifferentialCases(seed, index + 1)[index]!;
}

export function materializeGeneratedLayoutFixture(layoutCase: GeneratedLayoutCase): LayoutDifferentialFixture {
  const options = layoutCase.kind === "flex"
    ? {flexInnerSize: layoutCase.innerSize, flexGapSize: layoutCase.gapSize}
    : {gridInnerSize: layoutCase.innerSize, gridGapSize: layoutCase.gapSize};
  return getLayoutDifferentialFixture(layoutCase.fixtureId, options);
}

export function replayGeneratedEngineGeometry(layoutCase: GeneratedLayoutCase): readonly BrowserLayoutGeometry[] {
  return engineGeometryForDifferentialFixture(materializeGeneratedLayoutFixture(layoutCase));
}

function mismatchFields(comparisons: readonly GeometryComparison[]): DifferentialMismatchField[] {
  const mismatches: DifferentialMismatchField[] = [];
  comparisons.forEach((comparison) => {
    if (comparison.matches) return;
    if (!comparison.engine || !comparison.browser) {
      mismatches.push({id: comparison.id, field: "missing", delta: null});
      return;
    }
    comparison.fields.filter((field) => !field.matches).forEach((field) => {
      mismatches.push({id: comparison.id, field: field.field, delta: field.delta});
    });
  });
  return mismatches;
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function createDifferentialMismatchEvidence(
  layoutCase: GeneratedLayoutCase,
  browser: {engine: DifferentialBrowserEngine; version: string},
  browserGeometry: readonly BrowserLayoutGeometry[],
): DifferentialMismatchEvidence {
  if (!browser.version.trim()) throw new Error("browser evidence requires a version");
  const fixture = materializeGeneratedLayoutFixture(layoutCase);
  const sortedBrowserGeometry = [...browserGeometry].sort((left, right) => left.id.localeCompare(right.id));
  const comparisons = compareLayoutDifferentialFixture(fixture, sortedBrowserGeometry);
  const mismatches = mismatchFields(comparisons);
  if (mismatches.length === 0) {
    throw new Error(`${layoutCase.id}: cannot create mismatch evidence for matching geometry`);
  }

  const evidenceWithoutFingerprint = {
    schemaVersion: DIFFERENTIAL_EVIDENCE_VERSION,
    generatorVersion: DIFFERENTIAL_GENERATOR_VERSION,
    case: layoutCase,
    browser,
    policyVersion: fixture.policy.version,
    browserGeometry: sortedBrowserGeometry,
    mismatches,
  } as const;
  const fingerprint = fnv1a(JSON.stringify(evidenceWithoutFingerprint));
  return {...evidenceWithoutFingerprint, fingerprint};
}

function candidateCases(original: GeneratedLayoutCase) {
  const candidates: GeneratedLayoutCase[] = [];
  for (let innerSize = GENERATED_WIDTH_MIN; innerSize <= original.innerSize; innerSize += GENERATED_WIDTH_STEP) {
    for (let gapSize = GENERATED_GAP_MIN; gapSize <= original.gapSize; gapSize += GENERATED_GAP_STEP) {
      candidates.push(makeCase({
        seed: original.seed,
        index: original.index,
        kind: original.kind,
        innerSize,
        gapSize,
      }));
    }
  }
  return candidates.sort((left, right) => {
    const leftComplexity = (left.innerSize - GENERATED_WIDTH_MIN) / GENERATED_WIDTH_STEP
      + (left.gapSize - GENERATED_GAP_MIN) / GENERATED_GAP_STEP;
    const rightComplexity = (right.innerSize - GENERATED_WIDTH_MIN) / GENERATED_WIDTH_STEP
      + (right.gapSize - GENERATED_GAP_MIN) / GENERATED_GAP_STEP;
    return leftComplexity - rightComplexity
      || left.innerSize - right.innerSize
      || left.gapSize - right.gapSize;
  });
}

export function minimizeGeneratedLayoutMismatch(
  original: GeneratedLayoutCase,
  mismatchOracle: (candidate: GeneratedLayoutCase) => boolean,
): DifferentialMinimizationResult {
  if (!mismatchOracle(original)) throw new Error(`${original.id}: original case does not reproduce the mismatch`);
  let attemptedCases = 1;
  for (const candidate of candidateCases(original)) {
    if (candidate.innerSize === original.innerSize && candidate.gapSize === original.gapSize) continue;
    attemptedCases += 1;
    if (mismatchOracle(candidate)) {
      return {original, minimized: candidate, attemptedCases};
    }
  }
  return {original, minimized: original, attemptedCases};
}

export async function minimizeGeneratedLayoutMismatchAsync(
  original: GeneratedLayoutCase,
  mismatchOracle: (candidate: GeneratedLayoutCase) => Promise<boolean>,
): Promise<DifferentialMinimizationResult> {
  if (!(await mismatchOracle(original))) throw new Error(`${original.id}: original case does not reproduce the mismatch`);
  let attemptedCases = 1;
  for (const candidate of candidateCases(original)) {
    if (candidate.innerSize === original.innerSize && candidate.gapSize === original.gapSize) continue;
    attemptedCases += 1;
    if (await mismatchOracle(candidate)) {
      return {original, minimized: candidate, attemptedCases};
    }
  }
  return {original, minimized: original, attemptedCases};
}
