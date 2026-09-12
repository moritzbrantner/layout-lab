import type {BrowserLayoutGeometry, GeometryComparison} from "./browser-layout-adapter";
import {
  compareLayoutDifferentialFixture,
  engineGeometryForDifferentialFixture,
  type LayoutDifferentialFixture,
} from "./layout-differential-corpus";
import type {DifferentialBrowserEngine, GeneratedLayoutCase} from "./layout-differential-generated";

export const BROWSER_CONFORMANCE_EVIDENCE_VERSION = "layout-browser-evidence-v1";

export type BrowserConformanceReplay =
  | {
      type: "corpus";
      fixtureId: string;
      input: Readonly<Record<string, number | string>>;
    }
  | {
      type: "generated";
      case: GeneratedLayoutCase;
      originalReplayKey?: string;
      minimizationAttempts?: number;
    };

export type BrowserConformanceMismatch = {
  id: string;
  field: "x" | "y" | "width" | "height" | "missing";
  engine: number | null;
  browser: number | null;
  delta: number | null;
};

export type BrowserConformanceEvidence = {
  schemaVersion: typeof BROWSER_CONFORMANCE_EVIDENCE_VERSION;
  fixtureId: string;
  replay: BrowserConformanceReplay;
  browser: {
    engine: DifferentialBrowserEngine;
    version: string;
  };
  policy: LayoutDifferentialFixture["policy"];
  engineGeometry: readonly BrowserLayoutGeometry[];
  browserGeometry: readonly BrowserLayoutGeometry[];
  mismatches: readonly BrowserConformanceMismatch[];
  fingerprint: string;
};

export function corpusReplay(fixture: LayoutDifferentialFixture): BrowserConformanceReplay {
  return {type: "corpus", fixtureId: fixture.id, input: fixture.input};
}

export function generatedReplay(
  layoutCase: GeneratedLayoutCase,
  options: {originalReplayKey?: string; minimizationAttempts?: number} = {},
): BrowserConformanceReplay {
  return {
    type: "generated",
    case: layoutCase,
    ...options,
  };
}

function collectMismatches(comparisons: readonly GeometryComparison[]): BrowserConformanceMismatch[] {
  const mismatches: BrowserConformanceMismatch[] = [];
  comparisons.forEach((comparison) => {
    if (comparison.matches) return;
    if (!comparison.engine || !comparison.browser) {
      mismatches.push({
        id: comparison.id,
        field: "missing",
        engine: null,
        browser: null,
        delta: null,
      });
      return;
    }
    comparison.fields.filter((field) => !field.matches).forEach((field) => {
      mismatches.push({
        id: comparison.id,
        field: field.field,
        engine: field.engine,
        browser: field.browser,
        delta: field.delta,
      });
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

export function createBrowserConformanceEvidence({
  fixture,
  replay,
  browser,
  browserGeometry,
}: {
  fixture: LayoutDifferentialFixture;
  replay: BrowserConformanceReplay;
  browser: {engine: DifferentialBrowserEngine; version: string};
  browserGeometry: readonly BrowserLayoutGeometry[];
}): BrowserConformanceEvidence {
  if (!browser.version.trim()) throw new Error("browser conformance evidence requires a browser version");
  const sortedBrowserGeometry = [...browserGeometry].sort((left, right) => left.id.localeCompare(right.id));
  const engineGeometry = [...engineGeometryForDifferentialFixture(fixture)].sort((left, right) => left.id.localeCompare(right.id));
  const comparisons = compareLayoutDifferentialFixture(fixture, sortedBrowserGeometry);
  const mismatches = collectMismatches(comparisons);
  if (mismatches.length === 0) throw new Error(`${fixture.id}: cannot create browser evidence without a mismatch`);

  const withoutFingerprint = {
    schemaVersion: BROWSER_CONFORMANCE_EVIDENCE_VERSION,
    fixtureId: fixture.id,
    replay,
    browser,
    policy: fixture.policy,
    engineGeometry,
    browserGeometry: sortedBrowserGeometry,
    mismatches,
  } as const;
  return {...withoutFingerprint, fingerprint: fnv1a(JSON.stringify(withoutFingerprint))};
}
