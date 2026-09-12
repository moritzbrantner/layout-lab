import {describe, expect, test} from "bun:test";
import {
  createDifferentialMismatchEvidence,
  DIFFERENTIAL_EVIDENCE_VERSION,
  DIFFERENTIAL_GENERATOR_VERSION,
  generateLayoutDifferentialCases,
  GENERATED_GAP_MAX,
  GENERATED_GAP_MIN,
  GENERATED_GAP_STEP,
  GENERATED_WIDTH_MAX,
  GENERATED_WIDTH_MIN,
  GENERATED_WIDTH_STEP,
  materializeGeneratedLayoutFixture,
  minimizeGeneratedLayoutMismatch,
  replayGeneratedEngineGeometry,
  replayGeneratedLayoutCase,
} from "./layout-differential-generated";
import {compareLayoutDifferentialFixture} from "./layout-differential-corpus";

describe("generated layout differential cases", () => {
  test("replays the same bounded cases for the same seed", () => {
    const first = generateLayoutDifferentialCases(0x51a9, 32);
    const second = generateLayoutDifferentialCases(0x51a9, 32);
    const different = generateLayoutDifferentialCases(0x51aa, 32);

    expect(second).toEqual(first);
    expect(different).not.toEqual(first);
    expect(new Set(first.map((layoutCase) => layoutCase.id)).size).toBe(first.length);
    for (const layoutCase of first) {
      expect(layoutCase.generatorVersion).toBe(DIFFERENTIAL_GENERATOR_VERSION);
      expect(layoutCase.innerSize).toBeGreaterThanOrEqual(GENERATED_WIDTH_MIN);
      expect(layoutCase.innerSize).toBeLessThanOrEqual(GENERATED_WIDTH_MAX);
      expect((layoutCase.innerSize - GENERATED_WIDTH_MIN) % GENERATED_WIDTH_STEP).toBe(0);
      expect(layoutCase.gapSize).toBeGreaterThanOrEqual(GENERATED_GAP_MIN);
      expect(layoutCase.gapSize).toBeLessThanOrEqual(GENERATED_GAP_MAX);
      expect((layoutCase.gapSize - GENERATED_GAP_MIN) % GENERATED_GAP_STEP).toBe(0);
    }
  });

  test("replays a case exactly from its seed and index", () => {
    const cases = generateLayoutDifferentialCases(0x10203040, 20);
    for (const layoutCase of cases) {
      expect(replayGeneratedLayoutCase(layoutCase.seed, layoutCase.index)).toEqual(layoutCase);
      expect(layoutCase.replayKey).toBe(`${DIFFERENTIAL_GENERATOR_VERSION}:${layoutCase.seed.toString(16).padStart(8, "0")}:${layoutCase.index}`);
    }
  });

  test("materializes every generated case through the reusable H9 corpus", () => {
    for (const layoutCase of generateLayoutDifferentialCases(0xc0ffee, 40)) {
      const fixture = materializeGeneratedLayoutFixture(layoutCase);
      expect(fixture.id).toBe(layoutCase.fixtureId);
      expect(fixture.input).toEqual({innerSize: layoutCase.innerSize, gapSize: layoutCase.gapSize});
      const replayed = replayGeneratedEngineGeometry(layoutCase);
      expect(compareLayoutDifferentialFixture(fixture, replayed).every((comparison) => comparison.matches)).toBe(true);
    }
  });

  test("records replayable browser mismatch evidence with a stable fingerprint", () => {
    const layoutCase = generateLayoutDifferentialCases(0xabc123, 1)[0]!;
    const browserGeometry = replayGeneratedEngineGeometry(layoutCase).map((geometry) =>
      geometry.id === "root" ? {...geometry, width: geometry.width + 1.25} : geometry,
    );
    const browser = {engine: "chromium" as const, version: "140.0-test"};

    const first = createDifferentialMismatchEvidence(layoutCase, browser, browserGeometry);
    const second = createDifferentialMismatchEvidence(layoutCase, browser, [...browserGeometry].reverse());

    expect(first.schemaVersion).toBe(DIFFERENTIAL_EVIDENCE_VERSION);
    expect(first.generatorVersion).toBe(DIFFERENTIAL_GENERATOR_VERSION);
    expect(first.case.replayKey).toBe(layoutCase.replayKey);
    expect(first.policyVersion).toBe("layout-geometry-v1");
    expect(first.mismatches).toContainEqual({id: "root", field: "width", delta: 1.25});
    expect(first.fingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(second).toEqual(first);
  });

  test("refuses to create mismatch evidence for matching geometry", () => {
    const layoutCase = generateLayoutDifferentialCases(123, 1)[0]!;
    expect(() => createDifferentialMismatchEvidence(
      layoutCase,
      {engine: "firefox", version: "test"},
      replayGeneratedEngineGeometry(layoutCase),
    )).toThrow("cannot create mismatch evidence for matching geometry");
  });

  test("minimizes a bounded mismatch to the smallest reproducing width and gap", () => {
    const original = generateLayoutDifferentialCases(0xdeadbeef, 512)
      .find((layoutCase) => layoutCase.innerSize >= 600 && layoutCase.gapSize >= 20);
    expect(original).toBeDefined();

    const result = minimizeGeneratedLayoutMismatch(
      original!,
      (candidate) => candidate.innerSize >= 600 && candidate.gapSize >= 20,
    );

    expect(result.minimized.kind).toBe(original!.kind);
    expect(result.minimized.innerSize).toBe(600);
    expect(result.minimized.gapSize).toBe(20);
    expect(result.attemptedCases).toBeGreaterThan(1);
  });

  test("fails closed when the original case does not reproduce the mismatch", () => {
    const original = generateLayoutDifferentialCases(99, 1)[0]!;
    expect(() => minimizeGeneratedLayoutMismatch(original, () => false))
      .toThrow("original case does not reproduce the mismatch");
  });
});
