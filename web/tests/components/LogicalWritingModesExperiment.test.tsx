import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {LogicalWritingModesExperiment} from "../../components/LogicalWritingModesExperiment";

describe("LogicalWritingModesExperiment", () => {
  test("exposes logical sizing and logical inset geometry", () => {
    const markup = renderToStaticMarkup(<LogicalWritingModesExperiment />);

    expect(markup).toContain('id="logical-writing-modes"');
    expect(markup).toContain("Logical axes → physical sides");
    expect(markup).toContain("Logical sizing");
    expect(markup).toContain("Logical inset positioning");
    expect(markup).toContain("writing-mode");
    expect(markup).toContain("inset-inline-start");
  });

  test("states the browser-owned text-layout boundary", () => {
    const markup = renderToStaticMarkup(<LogicalWritingModesExperiment />);

    expect(markup).toContain("Glyph orientation, bidi reordering");
    expect(markup).toContain("orthogonal-flow intrinsic sizing");
    expect(markup).toContain("remain browser-owned");
  });
});
