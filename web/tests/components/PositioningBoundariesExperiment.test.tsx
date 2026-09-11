import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {PositioningBoundariesExperiment} from "../../components/PositioningBoundariesExperiment";

describe("PositioningBoundariesExperiment", () => {
  test("exposes absolute, fixed, and sticky reference boundaries", () => {
    const markup = renderToStaticMarkup(<PositioningBoundariesExperiment />);

    expect(markup).toContain('id="positioning-boundaries"');
    expect(markup).toContain("Absolute containing block");
    expect(markup).toContain("Fixed containing block");
    expect(markup).toContain("Sticky scrollport boundary");
  });

  test("states the deliberately scoped browser-authority boundaries", () => {
    const markup = renderToStaticMarkup(<PositioningBoundariesExperiment />);

    expect(markup).toContain("The outer transform intentionally keeps this demo local");
    expect(markup).toContain("The browser owns the full sticky-positioning algorithm");
    expect(markup).toContain("other containing-block creators");
  });
});
