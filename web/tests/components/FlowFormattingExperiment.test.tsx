import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {FlowFormattingExperiment} from "../../components/FlowFormattingExperiment";

describe("FlowFormattingExperiment", () => {
  test("exposes block margin collapse and inline fragmentation as one scoped experiment", () => {
    const markup = renderToStaticMarkup(<FlowFormattingExperiment />);

    expect(markup).toContain('id="flow-formatting"');
    expect(markup).toContain("Adjacent block margins");
    expect(markup).toContain("Inline formatting fragments");
    expect(markup).toContain("vertical layout");
    expect(markup).toContain("inline display");
  });

  test("states the browser-owned inline formatting boundary and scoped margin model", () => {
    const markup = renderToStaticMarkup(<FlowFormattingExperiment />);

    expect(markup).toContain("two positive vertical sibling margins only");
    expect(markup).toContain("getClientRects()");
    expect(markup).toContain("Inline line breaking, glyph measurement, and line-box construction stay browser-owned");
  });
});
