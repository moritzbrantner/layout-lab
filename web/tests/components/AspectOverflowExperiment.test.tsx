import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {AspectOverflowExperiment} from "../../components/AspectOverflowExperiment";

describe("AspectOverflowExperiment", () => {
  test("exposes aspect ratio, replaced element, and overflow evidence", () => {
    const markup = renderToStaticMarkup(<AspectOverflowExperiment />);

    expect(markup).toContain('id="aspect-overflow"');
    expect(markup).toContain("Non-replaced aspect ratio");
    expect(markup).toContain("Replaced-element intrinsic ratio");
    expect(markup).toContain("Overflow and scroll container");
  });

  test("states the browser-owned replaced and scrolling boundaries", () => {
    const markup = renderToStaticMarkup(<AspectOverflowExperiment />);

    expect(markup).toContain("Intrinsic decoding stays browser-owned");
    expect(markup).toContain("browser-owned overflow geometry");
    expect(markup).toContain("accepts programmatic scrolling remains browser-owned evidence");
  });
});
