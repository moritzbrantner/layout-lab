import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {VisualRegressionFixtures} from "../../components/VisualRegressionFixtures";
import {VISUAL_FIXTURE_SUITE, visualFixtures} from "../../lib/visual-fixtures";

describe("VisualRegressionFixtures", () => {
  test("publishes a versioned deterministic fixture manifest", () => {
    expect(VISUAL_FIXTURE_SUITE).toBe("layout-v1");
    expect(visualFixtures.map((fixture) => fixture.id)).toEqual([
      "flex-free-space",
      "grid-tracks",
      "positioned-transform",
    ]);
    expect(new Set(visualFixtures.map((fixture) => fixture.id)).size).toBe(visualFixtures.length);
    expect(visualFixtures.every((fixture) => fixture.width === 360 && fixture.height === 180)).toBe(true);
  });

  test("renders stable selectors and capture dimensions for every fixture", () => {
    const markup = renderToStaticMarkup(<VisualRegressionFixtures />);

    expect(markup).toContain(`data-visual-fixture-suite="${VISUAL_FIXTURE_SUITE}"`);
    for (const fixture of visualFixtures) {
      expect(markup).toContain(`data-visual-fixture="${fixture.id}"`);
      expect(markup).toContain(`data-fixture-width="${fixture.width}"`);
      expect(markup).toContain(`data-fixture-height="${fixture.height}"`);
    }
  });

  test("keeps fixture canvases free of text-dependent layout content", () => {
    const markup = renderToStaticMarkup(<VisualRegressionFixtures />);
    const canvases = [...markup.matchAll(/<div class="visual-fixture-canvas[\s\S]*?<\/div><\/article>/g)];

    expect(canvases).toHaveLength(3);
    for (const match of canvases) {
      const canvasMarkup = match[0].slice(0, match[0].lastIndexOf("</div></article>") + 6);
      expect(canvasMarkup).not.toMatch(/>[^<\s][^<]*</);
    }
  });
});
