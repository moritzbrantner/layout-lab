import {describe, expect, test} from "bun:test";
import {editorCollectionById} from "./editor-pages";
import {experiments} from "./experiments";

describe("editor pages", () => {
  test("assigns every registered experiment to exactly one page collection", () => {
    const registeredIds = experiments.map((experiment) => experiment.id).sort();
    const routedIds = Object.keys(editorCollectionById).sort();

    expect(routedIds).toEqual(registeredIds);
  });
});
