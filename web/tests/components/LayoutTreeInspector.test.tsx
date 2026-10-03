import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {LayoutTreeInspector} from "../../components/LayoutTreeInspector";

describe("LayoutTreeInspector", () => {
  test("shows the DOM-independent flex tree and adapter boundary", () => {
    const markup = renderToStaticMarkup(
      <LayoutTreeInspector scenario="flex" innerSize={520} gapSize={16} />,
    );

    expect(markup).toContain("Typed layout tree");
    expect(markup).toContain("plain typed data with stable node IDs and no DOM references");
    expect(markup).toContain("3 flex items · 520px main size · 16px gap");
    expect(markup).toContain("item-b");
    expect(markup).toContain("browser-owned inputs");
  });

  test("shows grid tracks and spanning contributions through the adapter", () => {
    const markup = renderToStaticMarkup(
      <LayoutTreeInspector scenario="grid" innerSize={560} gapSize={16} />,
    );

    expect(markup).toContain("3 grid tracks · 1 spanning contribution · 560px inline size");
    expect(markup).toContain("span-ab");
    expect(markup).toContain("Grid container");
  });

  test("renders the selected engine result through the downstream Canvas boundary", () => {
    const flexMarkup = renderToStaticMarkup(
      <LayoutTreeInspector scenario="flex" innerSize={520} gapSize={16} />,
    );
    const gridMarkup = renderToStaticMarkup(
      <LayoutTreeInspector scenario="grid" innerSize={560} gapSize={16} />,
    );

    expect(flexMarkup).toContain("2D Canvas resolved-box view");
    expect(flexMarkup).toContain("layout authority stays in the engine");
    expect(flexMarkup).toContain('data-layout-canvas-root="root"');
    expect(flexMarkup).toContain('aria-label="Flex engine geometry: Flex engine root with 3 direct children"');
    expect(gridMarkup).toContain('aria-label="Grid engine geometry: Grid engine root with 2 direct children"');
    expect(gridMarkup).toContain("no DOM measurement");
  });

  test("shows deterministic block geometry and margin collapse evidence", () => {
    const markup = renderToStaticMarkup(
      <LayoutTreeInspector scenario="flex" innerSize={520} gapSize={16} />,
    );

    expect(markup).toContain("Deterministic block layout baseline");
    expect(markup).toContain("420px × 276px");
    expect(markup).toContain("Content <code>content</code>");
    expect(markup).toContain("header → content");
    expect(markup).toContain("20px vs 12px → 20px collapsed gap");
  });

  test("shows the flex engine geometry and freeze evidence for the flex scenario", () => {
    const markup = renderToStaticMarkup(
      <LayoutTreeInspector scenario="flex" innerSize={520} gapSize={16} />,
    );

    expect(markup).toContain("Deterministic Flexbox subset");
    expect(markup).toContain("Flex engine root <code>root</code>");
    expect(markup).toContain("B <code>item-b</code>");
    expect(markup).toContain("pass 1");
    expect(markup).toContain("freeze B");
    expect(markup).toContain("pass 2");
  });

  test("shows the grid engine geometry, span contribution, and frozen track", () => {
    const markup = renderToStaticMarkup(
      <LayoutTreeInspector scenario="grid" innerSize={560} gapSize={16} />,
    );

    expect(markup).toContain("Deterministic Grid subset");
    expect(markup).toContain("Grid engine root <code>root</code>");
    expect(markup).toContain("A+B panel <code>span-ab</code>");
    expect(markup).toContain("117.33px");
    expect(markup).toContain("A+B panel");
    expect(markup).toContain("grow bases by 24px");
    expect(markup).toContain("track B");
    expect(markup).toContain("width 176px · frozen at minimum");
  });

  test("shows only the engine subset matching the selected flex/grid scenario", () => {
    const flexMarkup = renderToStaticMarkup(
      <LayoutTreeInspector scenario="flex" innerSize={520} gapSize={16} />,
    );
    const gridMarkup = renderToStaticMarkup(
      <LayoutTreeInspector scenario="grid" innerSize={560} gapSize={16} />,
    );

    expect(flexMarkup).toContain("Deterministic Flexbox subset");
    expect(flexMarkup).not.toContain("Deterministic Grid subset");
    expect(gridMarkup).toContain("Deterministic Grid subset");
    expect(gridMarkup).not.toContain("Deterministic Flexbox subset");
  });
});
