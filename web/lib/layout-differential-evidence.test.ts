import {describe, expect, test} from "bun:test";
import {
  BROWSER_CONFORMANCE_EVIDENCE_VERSION,
  corpusReplay,
  createBrowserConformanceEvidence,
  generatedReplay,
} from "./layout-differential-evidence";
import {getLayoutDifferentialFixture} from "./layout-differential-corpus";
import {
  generateLayoutDifferentialCases,
  materializeGeneratedLayoutFixture,
  replayGeneratedEngineGeometry,
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

  test("records a minimized generated replay while retaining its original replay key", () => {
    const layoutCase = generateLayoutDifferentialCases(0xc0ffee, 1)[0]!;
    const fixture = materializeGeneratedLayoutFixture(layoutCase);
    const browserGeometry = replayGeneratedEngineGeometry(layoutCase).map((geometry) =>
      geometry.id === "root" ? {...geometry, x: geometry.x + 1} : geometry,
    );
    const replay = generatedReplay(layoutCase, {
      originalReplayKey: "layout-generated-v1:00000001:9",
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

    expect(first.replay).toEqual({
      type: "generated",
      generatorVersion: layoutCase.generatorVersion,
      seed: layoutCase.seed,
      index: layoutCase.index,
      replayKey: layoutCase.replayKey,
      originalReplayKey: "layout-generated-v1:00000001:9",
      minimizationAttempts: 17,
    });
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
