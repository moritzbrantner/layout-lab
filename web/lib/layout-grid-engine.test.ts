import {describe, expect, test} from "bun:test";
import {buildGridEngineTree} from "./layout-engine-fixtures";
import {layoutGridTree} from "./layout-engine";
import type {LayoutNode} from "./layout-tree";

function expectClose(actual: number, expected: number) {
  expect(actual).toBeCloseTo(expected, 8);
}

describe("grid layout engine", () => {
  test("places an explicit single row from the existing track sizing resolver", () => {
    const result = layoutGridTree(buildGridEngineTree());
    const span = result.boxes.find((box) => box.id === "span-ab")!;
    const c = result.boxes.find((box) => box.id === "item-c")!;

    expect(result.visitedNodes).toBe(3);
    expect(result.resolution.contributionSteps).toHaveLength(1);
    expect(result.resolution.contributionSteps[0]?.label).toBe("A+B panel");
    expect(result.resolution.tracks.find((track) => track.label === "B")?.frozen).toBe(true);

    expect(result.root.rect).toEqual({x: 0, y: 0, width: 560, height: 120});
    expectClose(result.trackStarts[0]!, 0);
    expectClose(result.trackStarts[1]!, 133.33333333333334);
    expectClose(result.trackStarts[2]!, 325.33333333333337);

    expectClose(span.rect.x, 0);
    expectClose(span.rect.width, 309.33333333333337);
    expect(span.rect.height).toBe(80);

    expectClose(c.rect.x, 325.33333333333337);
    expectClose(c.rect.width, 234.66666666666666);
    expect(c.rect.height).toBe(96);
  });

  test("derives row height from the tallest explicit leaf when root height is auto", () => {
    const source = buildGridEngineTree();
    const tree: LayoutNode = {
      ...source,
      style: {...source.style, height: undefined},
    };

    expect(layoutGridTree(tree).root.rect.height).toBe(96);
  });

  test("fails closed when explicit placement exceeds the track set", () => {
    const source = buildGridEngineTree();
    const invalid: LayoutNode = {
      ...source,
      children: source.children.map((child, index) => index === 1
        ? {
            ...child,
            style: {
              ...child.style,
              gridItem: {columnStart: 2, columnSpan: 2},
            },
          }
        : child),
    };

    expect(() => layoutGridTree(invalid)).toThrow("item-c: grid placement exceeds the explicit column set");
  });

  test("fails closed for nested grid item contents", () => {
    const source = buildGridEngineTree();
    const nested: LayoutNode = {
      ...source,
      children: source.children.map((child, index) => index === 0
        ? {
            ...child,
            children: [
              {id: "nested", label: "Nested", style: {display: "block", height: 20}, children: []},
            ],
          }
        : child),
    };

    expect(() => layoutGridTree(nested)).toThrow("span-ab: grid baseline does not yet lay out nested item contents");
  });
});
