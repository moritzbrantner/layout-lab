import {describe, expect, test} from "bun:test";
import {editorCollectionById} from "../lib/editor-pages";
import {experiments} from "../lib/experiments";

describe("compositing observations route", () => {
  test("registers the final H3 slice as a first-class compositing experiment", () => {
    const experiment = experiments.find((candidate) => candidate.id === "compositing-observations");
    expect(experiment).toMatchObject({title: "Compositing observations", area: "3D"});
    expect(editorCollectionById["compositing-observations"]).toBe("compositing");
  });
});
