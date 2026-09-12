import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {BrowserEngineComparison} from "../../components/BrowserEngineComparison";

describe("BrowserEngineComparison", () => {
  test("renders the reusable differential corpus and explicit conformance policy", () => {
    const markup = renderToStaticMarkup(
      <BrowserEngineComparison scenario="flex" innerSize={520} gapSize={16} />,
    );

    expect(markup).toContain("Engine ↔ browser geometry");
    expect(markup).toContain("one reusable differential corpus");
    expect(markup).toContain("versioned per-field tolerance");
    expect(markup).toContain("layout-geometry-v1");
    expect(markup).toContain("x 0.5px · y 0.5px · width 0.5px · height 0.5px · 4 decimal normalization");
    expect(markup).toContain('data-differential-fixture="block-baseline"');
    expect(markup).toContain('data-differential-fixture="flex-engine"');
    expect(markup).toContain('data-browser-comparison-status="pending"');
    expect(markup).toContain("browser measurement pending");
  });

  test("uses the selected Grid corpus fixture without rendering the Flex fixture", () => {
    const markup = renderToStaticMarkup(
      <BrowserEngineComparison scenario="grid" innerSize={560} gapSize={16} />,
    );

    expect(markup).toContain('data-differential-fixture="grid-engine"');
    expect(markup).toContain("Minmax tracks, spanning minimum contribution, explicit placement");
    expect(markup).toContain('data-layout-engine-node="span-ab"');
    expect(markup).not.toContain('data-differential-fixture="flex-engine"');
  });

  test("renders exact dynamic Flex inputs from the corpus as browser-owned CSS evidence", () => {
    const markup = renderToStaticMarkup(
      <BrowserEngineComparison scenario="flex" innerSize={640} gapSize={20} />,
    );

    expect(markup).toContain('data-layout-engine-node="item-b"');
    expect(markup).toContain("flex:8 1 132px");
    expect(markup).toContain("max-width:184px");
    expect(markup).toContain("width:640px");
    expect(markup).toContain("gap:20px");
  });
});
