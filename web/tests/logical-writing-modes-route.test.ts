import {describe, expect, test} from "bun:test";
import {editorCollectionById} from "../lib/editor-pages";
import {experiments} from "../lib/experiments";

describe("logical writing mode route", () => {
  test("registers the H2 slice as a first-class sizing experiment", () => {
    const experiment = experiments.find((candidate) => candidate.id === "logical-writing-modes");

    expect(experiment).toMatchObject({
      title: "Logical properties and writing modes",
      area: "2D",
    });
    expect(editorCollectionById["logical-writing-modes"]).toBe("sizing");
  });
});
