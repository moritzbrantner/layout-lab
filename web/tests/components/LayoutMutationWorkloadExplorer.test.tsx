import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {LayoutMutationWorkloadExplorer} from "../../components/LayoutMutationWorkloadExplorer";

describe("LayoutMutationWorkloadExplorer", () => {
  test("renders the complete default block mutation trace", () => {
    const markup = renderToStaticMarkup(<LayoutMutationWorkloadExplorer />);

    expect(markup).toContain("Mutation traces and relayout work");
    expect(markup).toContain('<option value="block-structure" selected="">Block structural trace</option>');
    expect(markup).toContain('<option value="flex-solver">Flex solver trace</option>');
    expect(markup).toContain('<option value="grid-solver">Grid solver trace</option>');
    expect(markup).toContain("Resize containing block");
    expect(markup).toContain("Content measurement changes");
    expect(markup).toContain("Insert an Aside block");
    expect(markup).toContain("Reorder Content and Aside");
    expect(markup).toContain("Remove the Aside block");
  });

  test("shows structural rebuilds and deterministic work instead of timing claims", () => {
    const markup = renderToStaticMarkup(<LayoutMutationWorkloadExplorer />);

    expect(markup).toContain("Visited / clean");
    expect(markup).toContain("Solver work / clean");
    expect(markup).toContain("Graph rebuild");
    expect(markup).toContain("graph-rebuild");
    expect(markup).toContain("No wall-clock timing is used for these claims");
    expect(markup).not.toContain("duration");
    expect(markup).not.toContain("elapsed");
  });

  test("pins clean-layout equivalence for every default workload step", () => {
    const markup = renderToStaticMarkup(<LayoutMutationWorkloadExplorer />);

    expect((markup.match(/>identical</g) ?? []).length).toBe(5);
    expect(markup).toContain("all identical");
    expect(markup).not.toContain(">mismatch<");
  });

  test("states the bounded Grid work-accounting boundary", () => {
    const markup = renderToStaticMarkup(<LayoutMutationWorkloadExplorer />);

    expect(markup).toContain("Flex work reports real line-resolution iterations");
    expect(markup).toContain("Grid work reports one track-resolution pass per resolver invocation");
    expect(markup).toContain("reserved for H10");
  });
});
