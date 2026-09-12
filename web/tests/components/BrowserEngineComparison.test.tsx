import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {BrowserEngineComparison} from "../../components/BrowserEngineComparison";

describe("BrowserEngineComparison", () => {
  test("renders the browser adapter boundary and pending server-side evidence", () => {
    const markup = renderToStaticMarkup(
      <BrowserEngineComparison scenario="flex" innerSize={520} gapSize={16} />,
    );

    expect(markup).toContain("Engine ↔ browser geometry");
    expect(markup).toContain("engine remains pure typed data");
    expect(markup).toContain("0.5px tolerance");
    expect(markup).toContain("Block fixture");
    expect(markup).toContain("Flex fixture");
    expect(markup).toContain('data-browser-comparison-status="pending"');
    expect(markup).toContain("browser measurement pending");
  });

  test("uses the selected Grid engine fixture without rendering the Flex fixture", () => {
    const markup = renderToStaticMarkup(
      <BrowserEngineComparison scenario="grid" innerSize={560} gapSize={16} />,
    );

    expect(markup).toContain("Grid fixture");
    expect(markup).toContain("Same minmax tracks, spanning minimum, explicit placement");
    expect(markup).toContain('data-layout-engine-node="span-ab"');
    expect(markup).not.toContain("Same basis, grow/shrink factors");
  });

  test("renders exact Flex inputs as browser-owned CSS evidence", () => {
    const markup = renderToStaticMarkup(
      <BrowserEngineComparison scenario="flex" innerSize={520} gapSize={16} />,
    );

    expect(markup).toContain('data-layout-engine-node="item-b"');
    expect(markup).toContain("flex:8 1 132px");
    expect(markup).toContain("max-width:184px");
    expect(markup).toContain("gap:16px");
  });
});
