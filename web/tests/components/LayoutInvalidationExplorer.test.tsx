import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {LayoutInvalidationExplorer} from "../../components/LayoutInvalidationExplorer";

describe("LayoutInvalidationExplorer", () => {
  test("renders block invalidation, reuse, and actual traversal evidence", () => {
    const markup = renderToStaticMarkup(<LayoutInvalidationExplorer />);

    expect(markup).toContain("Invalidation, reuse, and partial execution");
    expect(markup).toContain('<option value="block" selected="">Block flow</option>');
    expect(markup).toContain("Content height changes");
    expect(markup).toContain("content.height");
    expect(markup).toContain("content:block-size");
    expect(markup).toContain("3</strong><span>recomputed nodes");
    expect(markup).toContain("1</strong><span>reused nodes");
    expect(markup).toContain("4</strong><span>visited nodes");
    expect(markup).toContain("0</strong><span>solver passes");
    expect(markup).toContain("boundary visits / provenance comparisons");
    expect(markup).toContain("dependency graph rebuilds");
    expect(markup).toContain("Planning work:");
    expect(markup).toContain("identical</strong><span>incremental vs clean geometry");
    expect(markup).toContain("recomputed");
    expect(markup).toContain("reused from cache");
  });

  test("keeps structural mutations explicit as a graph-rebuild boundary", () => {
    const markup = renderToStaticMarkup(<LayoutInvalidationExplorer />);

    expect(markup).toContain("Children reorder");
    expect(markup).toContain("Structural insert/remove/reorder remains a fail-closed boundary");
    expect(markup).toContain("dependency graph is rebuilt for the new tree shape");
  });

  test("offers block, Flex, and Grid mutation families on the same surface", () => {
    const markup = renderToStaticMarkup(<LayoutInvalidationExplorer />);

    expect(markup).toContain('<option value="block" selected="">Block flow</option>');
    expect(markup).toContain('<option value="flex">Flex row</option>');
    expect(markup).toContain('<option value="grid">Grid row</option>');
  });
});
