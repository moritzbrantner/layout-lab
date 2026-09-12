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

  test("states the implemented constraint family and future-family boundary", () => {
    const markup = renderToStaticMarkup(<AlgorithmZooExplorer />);

    expect(markup).toContain("Constraint solving now uses this shared result contract");
    expect(markup).toContain("line-breaking, packing, tree, DAG, and force-directed algorithms");
    expect(markup).toContain("same surface");
  });
});
