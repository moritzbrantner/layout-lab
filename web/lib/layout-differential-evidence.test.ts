import {describe, expect, test} from "bun:test";
import {
  BROWSER_CONFORMANCE_EVIDENCE_VERSION,
  corpusReplay,
  createBrowserConformanceEvidence,
  generatedReplay,
} from "./layout-differential-evidence";
import {getLayoutDifferentialFixture} from "./layout-differential-corpus";
import {
  createGeneratedLayoutCase,
  generateLayoutDifferentialCases,
  materializeGeneratedLayoutFixture,
  replayGeneratedEngineGeometry,
  replayGeneratedLayoutCase,
} from "./layout-differential-generated";

describe("browser conformance evidence", () => {
  test("records a static corpus mismatch with enough replay information", () => {
    const fixture = getLayoutDifferentialFixture("block-baseline");
    const browserGeometry = fixture.engineBoxes.map((box) => ({id: box.id, ...box.rect})).map((geometry) =>
      geometry.id === "content" ? {...geometry, width: geometry.width + 0.75} : geometry,
    );

    const evidence = createBrowserConformanceEvidence({
      fixture,
      replay: corpusReplay(fixture),
      browser: {engine: "webkit", version: "26.6-test"},
      browserGeometry,
    });

    expect(evidence.schemaVersion).toBe(BROWSER_CONFORMANCE_EVIDENCE_VERSION);
    expect(evidence.replay).toEqual({type: "corpus", fixtureId: "block-baseline", input: {width: 420}});
    expect(evidence.policy.version).toBe("layout-geometry-v1");
    expect(evidence.mismatches).toContainEqual({
      id: "content",
      field: "width",
      engine: 360,
      browser: 360.75,
      delta: 0.75,
    });
    expect(evidence.fingerprint).toMatch(/^[0-9a-f]{8}$/);
  });

  test("records the complete minimized generated case while retaining original provenance", () => {
    const original = generateLayoutDifferentialCases(0xc0ffee, 1)[0]!;
    const minimized = createGeneratedLayoutCase({
      seed: original.seed,
      index: original.index,
      kind: original.kind,
      innerSize: 360,
      gapSize: 0,
    });
    const fixture = materializeGeneratedLayoutFixture(minimized);
    const browserGeometry = replayGeneratedEngineGeometry(minimized).map((geometry) =>
      geometry.id === "root" ? {...geometry, x: geometry.x + 1} : geometry,
    );
    const replay = generatedReplay(minimized, {
      originalReplayKey: original.replayKey,
      minimizationAttempts: 17,
    });

    const first = createBrowserConformanceEvidence({
      fixture,
      replay,
      browser: {engine: "chromium", version: "153.0-test"},
      browserGeometry,
    });
    const second = createBrowserConformanceEvidence({
      fixture,
      replay,
      browser: {engine: "chromium", version: "153.0-test"},
      browserGeometry: [...browserGeometry].reverse(),
    });

    expect(replayGeneratedLayoutCase(original.seed, original.index)).toEqual(original);
    expect(minimized.innerSize).not.toBe(original.innerSize);
    expect(first.replay).toEqual({
      type: "generated",
      case: minimized,
      originalReplayKey: original.replayKey,
      minimizationAttempts: 17,
    });
    expect(first.replay.type === "generated" ? first.replay.case.innerSize : null).toBe(360);
    expect(first.replay.type === "generated" ? first.replay.case.gapSize : null).toBe(0);
    expect(second).toEqual(first);
  });

  test("refuses to persist matching geometry as mismatch evidence", () => {
    const fixture = getLayoutDifferentialFixture("grid-engine");
    const browserGeometry = fixture.engineBoxes.map((box) => ({id: box.id, ...box.rect}));
    expect(() => createBrowserConformanceEvidence({
      fixture,
      replay: corpusReplay(fixture),
      browser: {engine: "firefox", version: "155-test"},
      browserGeometry,
    })).toThrow("cannot create browser evidence without a mismatch");
  });
});
