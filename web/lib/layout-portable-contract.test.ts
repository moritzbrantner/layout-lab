import {describe, expect, test} from "bun:test";
import {
  comparePortableGeometry,
  portableLayoutContract,
  PORTABLE_LAYOUT_CONTRACT_VERSION,
  runPortableFixtureInTypeScript,
} from "./layout-portable-contract";

describe("portable layout contract", () => {
  test("publishes one versioned language-neutral Block/Flex/Grid corpus", () => {
    expect(portableLayoutContract.version).toBe(PORTABLE_LAYOUT_CONTRACT_VERSION);
    expect(portableLayoutContract.numeric_tolerance).toBe(1e-9);
    expect(portableLayoutContract.fixtures.map((fixture) => [fixture.id, fixture.kind])).toEqual([
      ["block-baseline", "block"],
      ["flex-engine", "flex"],
      ["grid-engine", "grid"],
    ]);
    expect(new Set(portableLayoutContract.fixtures.map((fixture) => fixture.id)).size)
      .toBe(portableLayoutContract.fixtures.length);
  });

  test("keeps the existing TypeScript H5 engine conformant to every authoritative fixture", () => {
    for (const fixture of portableLayoutContract.fixtures) {
      const actual = runPortableFixtureInTypeScript(fixture);
      expect(comparePortableGeometry(actual, fixture.expected_geometry)).toEqual([]);
    }
  });

  test("keeps stable geometry ids between the tree and expected output", () => {
    const flatten = (root: {id: string; children: readonly any[]}): string[] => [
      root.id,
      ...root.children.flatMap(flatten),
    ];

    for (const fixture of portableLayoutContract.fixtures) {
      expect(fixture.expected_geometry.map((geometry) => geometry.id))
        .toEqual(flatten(fixture.tree));
    }
  });

  test("reports field-level drift against the authoritative tolerance", () => {
    const fixture = portableLayoutContract.fixtures[0]!;
    const actual = fixture.expected_geometry.map((geometry) =>
      geometry.id === "content" ? {...geometry, width: geometry.width + 0.001} : geometry,
    );
    expect(comparePortableGeometry(actual, fixture.expected_geometry)).toEqual([
      "content.width: delta 0.0009999999999763531 exceeds 1e-9",
    ]);
  });
});
