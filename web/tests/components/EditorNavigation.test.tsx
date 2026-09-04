import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {EditorNavigation} from "../../components/EditorNavigation";

describe("EditorNavigation", () => {
  test("marks exactly the current editor link as the active page", () => {
    const markup = renderToStaticMarkup(<EditorNavigation current="workbench" />);

    expect(markup).toContain('aria-label="Layout Lab editors"');
    expect(markup).toContain('href="/workbench"');
    expect(markup.split('aria-current="page"')).toHaveLength(2);
  });

  test("does not mark an editor active when no current editor is supplied", () => {
    const markup = renderToStaticMarkup(<EditorNavigation />);

    expect(markup).not.toContain('aria-current="page"');
  });
});
