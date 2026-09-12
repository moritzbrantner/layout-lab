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
});
