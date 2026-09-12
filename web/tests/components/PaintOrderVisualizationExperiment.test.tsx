import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {PaintOrderVisualizationExperiment} from "../../components/PaintOrderVisualizationExperiment";

describe("PaintOrderVisualizationExperiment", () => {
  test("exposes model and browser paint stacks", () => {
    const markup = renderToStaticMarkup(<PaintOrderVisualizationExperiment />);
    expect(markup).toContain('id="paint-order-visualization"');
    expect(markup).toContain("Scoped paint sequence");
    expect(markup).toContain("Model · bottom → top");
    expect(markup).toContain("Browser · top → bottom");
    expect(markup).toContain("elementsFromPoint");
  });

  test("states the deliberately scoped paint-order boundary", () => {
    const markup = renderToStaticMarkup(<PaintOrderVisualizationExperiment />);
    expect(markup).toContain("Floats, pseudo-elements, outlines");
    expect(markup).toContain("arbitrary nested stacking-context trees remain browser-owned");
    expect(markup).toContain("not a claim that CSS painting is one global");
  });
});
