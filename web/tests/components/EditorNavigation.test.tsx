import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {EditorNavigation} from "../../components/EditorNavigation";

describe("EditorNavigation", () => {
  test("marks exactly the current editor link as the active page", () => {
    const markup = renderToStaticMarkup(<EditorNavigation current="workbench" />);

    expect(markup).toContain('aria-label="Layout Lab editors"');
    expect(markup).toContain('href="/workbench"');
    expect(markup).toContain('href="/grid-3d"');
    expect(markup).toContain('href="/website"');
    expect(markup.split('aria-current="page"')).toHaveLength(2);
  });

  test("marks the 3D grid as a first-class editor route", () => {
    const markup = renderToStaticMarkup(<EditorNavigation current="grid-3d" />);
    const gridLink = markup.match(/<a[^>]*href="\/grid-3d"[^>]*>/)?.[0];

    expect(gridLink).toBeDefined();
    expect(gridLink).toContain('aria-current="page"');
    expect(markup.split('aria-current="page"')).toHaveLength(2);
  });

  test("marks the website rearranger as a first-class editor route", () => {
    const markup = renderToStaticMarkup(<EditorNavigation current="website" />);
    const websiteLink = markup.match(/<a[^>]*href="\/website"[^>]*>/)?.[0];

    expect(websiteLink).toBeDefined();
    expect(websiteLink).toContain('aria-current="page"');
    expect(markup.split('aria-current="page"')).toHaveLength(2);
  });

  test("does not mark an editor active when no current editor is supplied", () => {
    const markup = renderToStaticMarkup(<EditorNavigation />);

    expect(markup).not.toContain('aria-current="page"');
  });
});
