import {describe, expect, test} from "bun:test";
import {editorCollectionById} from "../lib/editor-pages";
import {experiments} from "../lib/experiments";

describe("flow formatting route", () => {
  test("registers the roadmap slice as a first-class sizing experiment", () => {
    const experiment = experiments.find((candidate) => candidate.id === "flow-formatting");

    expect(experiment).toMatchObject({
      title: "Block and inline flow",
      area: "2D",
    });
    expect(editorCollectionById["flow-formatting"]).toBe("sizing");
  });
});
