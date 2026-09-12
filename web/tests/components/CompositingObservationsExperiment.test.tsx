import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {CompositingObservationsExperiment} from "../../components/CompositingObservationsExperiment";

describe("CompositingObservationsExperiment", () => {
  test("exposes computed rendering signals, animation evidence, and the paint containment probe", () => {
    const markup = renderToStaticMarkup(<CompositingObservationsExperiment />);
    expect(markup).toContain('id="compositing-observations"');
    expect(markup).toContain("Portable compositing evidence");
    expect(markup).toContain("active animations");
    expect(markup).toContain("overflow child at probe");
    expect(markup).toContain("contain: paint");
  });

  test("never claims portable access to the actual compositor layer tree", () => {
    const markup = renderToStaticMarkup(<CompositingObservationsExperiment />);
    expect(markup).toContain("actual compositor layer");
    expect(markup).toContain("not exposed");
    expect(markup).toContain("Standard web APIs do not expose those internal decisions");
  });
});
