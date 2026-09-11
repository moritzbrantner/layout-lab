import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {FlexAutomaticMinimumExperiment} from "../../components/FlexAutomaticMinimumExperiment";

describe("FlexAutomaticMinimumExperiment", () => {
  test("exposes the automatic-minimum comparison as a dedicated experiment", () => {
    const markup = renderToStaticMarkup(<FlexAutomaticMinimumExperiment />);

    expect(markup).toContain('id="flex-auto-minimum"');
    expect(markup).toContain("Flex automatic minimum");
    expect(markup).toContain("browser min-content probe");
    expect(markup).toContain("B min-width");
    expect(markup).toContain("overflow-wrap");
  });

  test("states the browser-owned intrinsic measurement boundary", () => {
    const markup = renderToStaticMarkup(<FlexAutomaticMinimumExperiment />);

    expect(markup).toContain("Intrinsic text measurement stays browser-owned");
    expect(markup).toContain("non-scroll B item");
    expect(markup).toContain("no aspect-ratio transfer");
  });
});
