import {describe, expect, test} from "bun:test";
import {editorCollectionById} from "../lib/editor-pages";
import {experiments} from "../lib/experiments";

describe("algorithm pipeline route", () => {
  test("registers the constraint graph as a first-class algorithm experiment", () => {
    const experiment = experiments.find((candidate) => candidate.id === "algorithm-pipeline");

    expect(experiment).toMatchObject({
      title: "Layout algorithm pipeline",
      area: "2D",
    });
    expect(editorCollectionById["algorithm-pipeline"]).toBe("algorithms");
  });
});
