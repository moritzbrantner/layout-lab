import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {ContainerQueriesContainmentExperiment} from "../../components/ContainerQueriesContainmentExperiment";

describe("ContainerQueriesContainmentExperiment", () => {
  test("exposes query matching and intrinsic containment evidence", () => {
    const markup = renderToStaticMarkup(<ContainerQueriesContainmentExperiment />);

    expect(markup).toContain('id="container-queries-containment"');
    expect(markup).toContain("Named inline-size query container");
    expect(markup).toContain("Intrinsic inline-size containment");
    expect(markup).toContain("container-type: inline-size");
    expect(markup).toContain("contain-intrinsic-inline-size");
  });

  test("states the browser-owned query and containment boundaries", () => {
    const markup = renderToStaticMarkup(<ContainerQueriesContainmentExperiment />);

    expect(markup).toContain("Container selection, query evaluation, style invalidation");
    expect(markup).toContain("Full size/layout/style/paint containment");
    expect(markup).toContain("remain browser-owned");
  });
});
