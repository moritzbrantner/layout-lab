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

  test("renders default block execution through the common geometry and trace surfaces", () => {
    const markup = renderToStaticMarkup(<AlgorithmZooExplorer />);

    expect(markup).toContain("Common geometry output");
    expect(markup).toContain("Common trace output");
    expect(markup).toContain("block-baseline");
    expect(markup).toContain("content");
    expect(markup).toContain("header → content");
    expect(markup).toContain("resolves to 20px");
  });

  test("states that all H7 algorithm families now share the registry", () => {
    const markup = renderToStaticMarkup(<AlgorithmZooExplorer />);

    expect(markup).toContain("seeded force-directed graph layout now use this shared result contract");
    expect(markup).toContain("remaining H7 work");
    expect(markup).toContain("step-through");
    expect(markup).toContain("same-fixture comparison");
  });
});
