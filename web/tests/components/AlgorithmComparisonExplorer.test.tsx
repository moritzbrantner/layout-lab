import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {AlgorithmComparisonExplorer} from "../../components/AlgorithmComparisonExplorer";

describe("AlgorithmComparisonExplorer", () => {
  test("renders only registered same-fixture comparison groups", () => {
    const markup = renderToStaticMarkup(<AlgorithmComparisonExplorer />);

    expect(markup).toContain("Side-by-side algorithms");
    expect(markup).toContain('<option value="line-breaking" selected="">Line breaking</option>');
    expect(markup).toContain('<option value="packing">Packing</option>');
    expect(markup).toContain("exact input match");
  });

  test("shows the default line-breaking result on identical pre-measured input", () => {
    const markup = renderToStaticMarkup(<AlgorithmComparisonExplorer />);

    expect(markup).toContain("premeasured-paragraph");
    expect(markup).toContain("Greedy line breaking");
    expect(markup).toContain("Knuth–Plass line breaking");
    expect(markup).toContain("paragraph height");
    expect(markup).toContain(">96px<");
    expect(markup).toContain(">64px<");
    expect(markup).toContain("Geometry from the same fixture");
    expect(markup).toContain("x 0 · y 0 · 260×96");
    expect(markup).toContain("x 0 · y 0 · 260×64");
  });

  test("states that the comparison isolates algorithm choice rather than fixture drift", () => {
    const markup = renderToStaticMarkup(<AlgorithmComparisonExplorer />);

    expect(markup).toContain("byte-for-byte equivalent serialized fixture input");
    expect(markup).toContain("Differences below therefore come from the algorithms");
  });
});
