# Layout Lab agent guidance

Read [ARCHITECTURE.md](ARCHITECTURE.md) before changing layout execution, invalidation, rendering, or portability boundaries.

## Semantic authority

- Keep one implementation of each layout rule. Shared sizing and geometry math belongs in reusable semantic modules, not separately in clean, incremental, demo, or renderer paths.
- Treat `layout-engine.ts` clean execution as the reference for the supported engine subset.
- Incremental execution may decide what to recompute or reuse; it must not invent alternate geometry rules.
- Preserve clean-versus-incremental differential equivalence for every supported mutation.
- Use immutable `LayoutNode` snapshots and `updateLayoutNode` for structural-sharing style updates.

## Derived state and rendering

- Caches, resolved scenes, traces, and renderer objects are derived state. Do not make them competing sources of domain truth.
- Keep `Grid3DDefinition` authoritative for Grid3D; derive `ResolvedGrid3DScene` from it.
- SVG, Canvas, Three.js, WebGPU, and future renderers consume resolved geometry. Do not move layout or invalidation semantics into a renderer.

## Performance and determinism

- Correctness gates use deterministic inputs and deterministic work evidence.
- Wall-clock measurements are advisory unless a dedicated stable benchmark environment justifies otherwise.
- When optimizing incremental work, account for invalidation planning and mutation verification as well as solver/recompute work.
- Prefer a bounded clean fallback over a clever incremental path whose equivalence or cost cannot be established.
- Cross-revision benchmark scripts may keep tiny input-construction compatibility helpers when the current script is copied into older worktrees. Do not copy layout semantics into those shims.

## Portability

- A Rust/WASM core must implement `contracts/layout-v1.schema.json` and run the same `contracts/fixtures` before it can become authoritative.
- Do not keep TypeScript and Rust as independent production truths. Any authority handoff must be explicit at the adapter boundary and covered by differential tests.
