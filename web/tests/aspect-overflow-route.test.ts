import {describe, expect, test} from "bun:test";
import {editorCollectionById} from "../lib/editor-pages";
import {experiments} from "../lib/experiments";

describe("aspect and overflow route", () => {
  test("registers the roadmap slice as a first-class sizing experiment", () => {
    const experiment = experiments.find((candidate) => candidate.id === "aspect-overflow");

    expect(experiment).toMatchObject({
      title: "Aspect ratio and overflow",
      area: "2D",
    });
    expect(editorCollectionById["aspect-overflow"]).toBe("sizing");
  });
});
