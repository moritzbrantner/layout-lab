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

  test("shows declared, resolved, and final geometry side by side", () => {
    const markup = renderToStaticMarkup(<AlgorithmPipelineExperiment />);

    expect(markup).toContain("Declared style → resolved values → final geometry");
    expect(markup).toContain('aria-label="Declared style"');
    expect(markup).toContain('aria-label="Resolved values"');
    expect(markup).toContain('aria-label="Final geometry"');
    expect(markup).toContain("A: 148.36px");
  });

  test("renders the flex edge-case corpus with expected geometry", () => {
    const markup = renderToStaticMarkup(<AlgorithmPipelineExperiment />);

    expect(markup).toContain("Edge-case corpus");
    expect(markup).toContain("Positive free-space distribution");
    expect(markup).toContain("A: 175px · B: 175px");
    expect(markup).toContain("matches expected");
  });

  test("states the browser-owned measurement boundary", () => {
    const markup = renderToStaticMarkup(<AlgorithmPipelineExperiment />);

    expect(markup).toContain("Browser-owned text and intrinsic measurement stay outside this graph");
    expect(markup).toContain("not a replacement for CSSOM computed style");
  });
});
