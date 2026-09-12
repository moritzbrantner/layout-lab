import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {AlgorithmPipelineExperiment} from "../../components/AlgorithmPipelineExperiment";

describe("AlgorithmPipelineExperiment", () => {
  test("renders the deterministic flex pipeline and its feedback dependency", () => {
    const markup = renderToStaticMarkup(<AlgorithmPipelineExperiment />);

    expect(markup).toContain('id="algorithm-pipeline"');
    expect(markup).toContain("Flexbox free-space resolution");
    expect(markup).toContain("Declared inputs");
    expect(markup).toContain("Iterative resolution");
    expect(markup).toContain("Feedback edge");
    expect(markup).toContain("recompute remaining free space after freezing");
  });

  test("states the browser-owned measurement boundary", () => {
    const markup = renderToStaticMarkup(<AlgorithmPipelineExperiment />);

    expect(markup).toContain("Browser-owned text and intrinsic measurement stay outside this graph");
  });
});
