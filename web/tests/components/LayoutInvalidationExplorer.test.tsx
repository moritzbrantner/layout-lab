import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {LayoutInvalidationExplorer} from "../../components/LayoutInvalidationExplorer";

describe("LayoutInvalidationExplorer", () => {
  test("renders block invalidation from the typed dependency graph", () => {
    const markup = renderToStaticMarkup(<LayoutInvalidationExplorer />);

    expect(markup).toContain("Typed dependency graph and dirty-set planner");
    expect(markup).toContain('<option value="block" selected="">Block flow</option>');
    expect(markup).toContain("Content height changes");
    expect(markup).toContain("content.height");
    expect(markup).toContain("content:block-size");
    expect(markup).toContain("footer");
    expect(markup).toContain("dirty");
    expect(markup).toContain("reusable");
  });

  test("states the planning boundary before incremental execution exists", () => {
    const markup = renderToStaticMarkup(<LayoutInvalidationExplorer />);

    expect(markup).toContain("plans invalidation only");
    expect(markup).toContain("does not yet claim incremental execution");
    expect(markup).toContain("H8 recomputation will consume this dirty set");
  });

  test("offers block, Flex, and Grid mutation families on the same surface", () => {
    const markup = renderToStaticMarkup(<LayoutInvalidationExplorer />);

    expect(markup).toContain('<option value="block" selected="">Block flow</option>');
    expect(markup).toContain('<option value="flex">Flex row</option>');
    expect(markup).toContain('<option value="grid">Grid row</option>');
  });
});
