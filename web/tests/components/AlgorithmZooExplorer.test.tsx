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

  test("states that same-fixture comparison is the remaining H7 work", () => {
    const markup = renderToStaticMarkup(<AlgorithmZooExplorer />);

    expect(markup).toContain("Every H7 family now uses the same selectable intermediate-state navigator");
    expect(markup).toContain("remaining H7 work");
    expect(markup).toContain("side-by-side comparison");
  });
});
