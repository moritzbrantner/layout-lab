import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {AlgorithmZooExplorer} from "../../components/AlgorithmZooExplorer";

describe("AlgorithmZooExplorer", () => {
  test("renders the common contract and registered algorithm selector", () => {
    const markup = renderToStaticMarkup(<AlgorithmZooExplorer />);

    expect(markup).toContain("Algorithm zoo");
    expect(markup).toContain("typed input, geometry output, inspectable trace steps");
    expect(markup).toContain('<option value="block-flow" selected="">Block flow</option>');
    expect(markup).toContain('<option value="flex-row">Flex row</option>');
    expect(markup).toContain('<option value="grid-row">Grid row</option>');
    expect(markup).toContain('<option value="constraint-cassowary">Incremental constraints</option>');
    expect(markup).toContain('<option value="line-greedy">Greedy line breaking</option>');
    expect(markup).toContain('<option value="line-knuth-plass">Knuth–Plass line breaking</option>');
    expect(markup).toContain('<option value="packing-shortest-column">Shortest-column masonry</option>');
    expect(markup).toContain('<option value="packing-first-fit">First-fit packing</option>');
    expect(markup).toContain('<option value="tree-tidy">Tidy tree</option>');
    expect(markup).toContain('<option value="dag-sugiyama">Layered DAG</option>');
    expect(markup).toContain('<option value="graph-force">Seeded force-directed graph</option>');
  });

  test("renders default block execution through geometry and shared step-through surfaces", () => {
    const markup = renderToStaticMarkup(<AlgorithmZooExplorer />);

    expect(markup).toContain("Common geometry output");
    expect(markup).toContain("Shared step-through");
    expect(markup).toContain("Step 1 of 2");
    expect(markup).toContain("block-baseline");
    expect(markup).toContain("content");
    expect(markup).toContain("header → content");
    expect(markup).toContain("resolves to 20px");
    expect(markup).toContain("Previous step");
    expect(markup).toContain("Next step");
  });

  test("renders same-fixture side-by-side comparison as the final H7 surface", () => {
    const markup = renderToStaticMarkup(<AlgorithmZooExplorer />);

    expect(markup).toContain("Side-by-side algorithms");
    expect(markup).toContain("exact input match");
    expect(markup).toContain("paragraph height");
    expect(markup).toContain("Greedy line breaking");
    expect(markup).toContain("Knuth–Plass line breaking");
    expect(markup).toContain("H7 now has one execution contract, one shared step-through surface, and explicit same-fixture comparisons");
  });

  test("renders H8 incremental and deterministic workload evidence on the same Pages surface", () => {
    const markup = renderToStaticMarkup(<AlgorithmZooExplorer />);

    expect(markup).toContain("Invalidation, reuse, and partial execution");
    expect(markup).toContain("Mutation traces and relayout work");
    expect(markup).toContain("Block structural trace");
    expect(markup).toContain("Visited / clean");
    expect(markup).toContain("Solver work / clean");
    expect(markup).toContain("all identical");
  });
});
