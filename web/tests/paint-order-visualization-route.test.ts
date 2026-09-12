import {describe, expect, test} from "bun:test";
import {editorCollectionById} from "../lib/editor-pages";
import {experiments} from "../lib/experiments";

describe("paint-order visualization route", () => {
  test("registers the first H6 slice in the rendering collection", () => {
    const experiment = experiments.find((candidate) => candidate.id === "paint-order-visualization");
    expect(experiment).toMatchObject({title: "Paint-order visualization", area: "2D"});
    expect(editorCollectionById["paint-order-visualization"]).toBe("rendering");
  });
});
