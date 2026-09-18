import {readFileSync} from "node:fs";
import {describe, expect, test} from "bun:test";
import {
  comparePortableGeometry,
  createPortableLayoutContract,
  portableLayoutContract,
  PORTABLE_LAYOUT_CONTRACT_VERSION,
  runPortableFixtureInTypeScript,
  serializePortableLayoutContract,
} from "./layout-portable-contract";

describe("portable layout contract", () => {
  test("is generated exactly from the current typed H5 fixtures and clean engine", () => {
    const generated = createPortableLayoutContract();

    expect(portableLayoutContract).toEqual(generated);
    expect(
      readFileSync(new URL("../../contracts/layout-core-v1.json", import.meta.url), "utf8"),
    ).toBe(serializePortableLayoutContract(generated));
  });

  test("publishes one versioned language-neutral Block/Flex/Grid corpus", () => {
    expect(portableLayoutContract.version).toBe(PORTABLE_LAYOUT_CONTRACT_VERSION);
    expect(portableLayoutContract.authority).toEqual({
      engine: "typescript-clean-layout",
      fixture_source: "typed-h5-fixtures",
      generator: "web/scripts/generate-portable-layout-contract.ts",
    });
    expect(portableLayoutContract.numeric_tolerance).toBe(1e-9);
    expect(portableLayoutContract.fixtures.map((fixture) => [fixture.id, fixture.kind])).toEqual([
      ["block-baseline", "block"],
      ["flex-engine", "flex"],
      ["grid-engine", "grid"],
    ]);
  });

  test("replays every portable fixture through the authoritative TypeScript engine", () => {
    for (const fixture of portableLayoutContract.fixtures) {
      const actual = runPortableFixtureInTypeScript(fixture);
      expect(comparePortableGeometry(actual, fixture.expected_geometry)).toEqual([]);
    }
  });

  test("keeps stable geometry ids between the portable tree and expected output", () => {
    const flatten = (root: {id: string; children: readonly {id: string; children: readonly any[]}[]}): string[] => [
      root.id,
      ...root.children.flatMap(flatten),
    ];

    for (const fixture of portableLayoutContract.fixtures) {
      expect(fixture.expected_geometry.map((geometry) => geometry.id)).toEqual(flatten(fixture.tree));
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
