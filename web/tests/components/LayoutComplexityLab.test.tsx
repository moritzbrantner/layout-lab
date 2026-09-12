import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {LayoutComplexityLab} from "../../components/LayoutComplexityLab";

describe("LayoutComplexityLab", () => {
  test("renders methodology and raw scale samples without timing claims", () => {
    const markup = renderToStaticMarkup(<LayoutComplexityLab />);

    expect(markup).toContain("Deterministic algorithmic work");
    expect(markup).toContain("layout-complexity-v1");
    expect(markup).toContain("no DOM measurement, rendering, timers, or wall-clock claims");
    expect(markup).toContain("Flex resolution scaling");
    expect(markup).toContain("Grid track scaling");
    expect(markup).toContain("Cassowary constraint scaling");
    expect(markup).toContain("Incremental versus full layout");
    expect(markup).toContain("flex-64");
    expect(markup).toContain("grid-64");
    expect(markup).toContain("constraints-32");
    expect(markup).toContain("incremental-16-16-8");
    expect(markup).not.toContain("milliseconds");
    expect(markup).not.toContain("duration:");
    expect(markup).not.toContain("elapsed time");
  });

  test("exposes deterministic passes, freezes, pivots, and visited-node evidence", () => {
    const markup = renderToStaticMarkup(<LayoutComplexityLab />);

    expect(markup).toContain("resolution passes");
    expect(markup).toContain("frozen items");
    expect(markup).toContain("flex-track passes");
    expect(markup).toContain("frozen tracks");
    expect(markup).toContain("simplex pivots");
    expect(markup).toContain("incremental visited nodes");
    expect(markup).toContain("full-layout visited nodes");
  });

  test("publishes the deliberate one-freeze-per-pass pathologies as raw evidence", () => {
    const markup = renderToStaticMarkup(<LayoutComplexityLab />);

    expect(markup).toContain("Deliberate near-worst-case fixtures");
    expect(markup).toContain("flex-freeze-ladder");
    expect(markup).toContain("grid-freeze-ladder");
    expect(markup).toContain("eight passes and 36 active-element evaluations");
    expect(markup).toContain("item-1 → item-2");
    expect(markup).toContain("track-1 → track-2");
  });

  test("states the boundary for any future wall-clock benchmark", () => {
    const markup = renderToStaticMarkup(<LayoutComplexityLab />);

    expect(markup).toContain("H10 deliberately stops short of wall-clock claims");
    expect(markup).toContain("runtime, warmup, host variance, DOM measurement, and rendering costs");
    expect(markup).toContain("algorithmic counters here remain the stable reference evidence");
  });
});
