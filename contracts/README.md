# Portable layout contract

`layout-v1.schema.json` is the language-neutral boundary for Layout Lab's H5 engine model and resolved geometry.

The contract deliberately does not define a second layout engine. TypeScript remains the reference implementation until a later, explicit authority handoff. Other implementations consume the same JSON-shaped tree, produce the same JSON-shaped geometry, and are checked against shared fixtures before they can be treated as equivalent.

## Version

- Contract: `layout-lab/portable-layout-v1`
- Coordinate space: CSS pixels (`css-px`)
- Child order is significant and deterministic.
- Grid `columnStart` is zero-based; `columnSpan` is a positive count.
- Widths, heights, gaps, margins, flex factors, track minima, and contributions are finite non-negative numbers.
- Geometry `x` and `y` may be any finite number; geometry sizes are non-negative.
- Browser-owned intrinsic measurement stays outside this contract until supplied as explicit numeric input.

## Documents

A `layout-tree` document carries the typed input tree. A `geometry` document carries the resolved box tree. Both use the same stable node IDs so conformance tests can compare implementations without depending on renderer state.

The TypeScript adapter lives in `web/lib/portable-layout-contract.ts`. Shared fixtures under `contracts/fixtures` are intentionally JSON so a future Rust implementation can consume them without importing TypeScript code.
