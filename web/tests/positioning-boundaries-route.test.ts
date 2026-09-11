import {describe, expect, test} from "bun:test";
import {editorCollectionById} from "../lib/editor-pages";
import {experiments} from "../lib/experiments";

describe("positioning boundary route", () => {
  test("registers the positioning roadmap slice as a first-class sizing experiment", () => {
    const experiment = experiments.find((candidate) => candidate.id === "positioning-boundaries");

    expect(experiment).toMatchObject({
      title: "Positioning boundaries",
      area: "2D",
    });
    expect(editorCollectionById["positioning-boundaries"]).toBe("sizing");
  });
});
