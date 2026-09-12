import {describe, expect, test} from "bun:test";
import {editorCollectionById} from "../lib/editor-pages";
import {experiments} from "../lib/experiments";

describe("container queries and containment route", () => {
  test("registers the final H2 slice as a first-class sizing experiment", () => {
    const experiment = experiments.find((candidate) => candidate.id === "container-queries-containment");

    expect(experiment).toMatchObject({
      title: "Container queries and containment",
      area: "2D",
    });
    expect(editorCollectionById["container-queries-containment"]).toBe("sizing");
  });
});
