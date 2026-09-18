# Layout Lab architecture

Layout Lab deliberately keeps layout semantics separate from experiments, caching, rendering, and implementation technology. The goal is to make optimized or alternate execution paths impossible to treat as independent layout engines by accident.

## Authority boundaries

1. **Browser layout is the conformance oracle for CSS behavior.** Browser-owned geometry tells us what supported CSS constructs do; browser measurements are evidence, not an implementation to copy into the engine.
2. **`layout-tree.ts` owns the typed engine input contract.** Layout identity, style data, and tree structure enter the small engine through this model.
3. **`layout-analysis.ts` and `layout-geometry.ts` own reusable layout math.** Sizing solvers and geometry primitives must stay deterministic and UI-independent.
4. **`layout-engine.ts` is the clean semantic executor for the supported engine subset.** Its output is the reference result for incremental execution.
5. **`layout-invalidation.ts` and `incremental-layout.ts` own reuse policy, not alternate semantics.** Incremental execution may skip work or reuse cached results, but any recomputed geometry must go through the same layout primitives and must remain equivalent to clean execution.
6. **Algorithm-zoo and React components are adapters/inspectors.** They can select algorithms, expose traces, and render evidence. They must not reimplement layout rules.
7. **Renderers consume resolved geometry.** Canvas, WebGPU, or later renderers may visualize `LayoutBox` output but must not become another source of layout state or positioning rules.
8. **A future Rust/WASM core is an alternate implementation behind the same contract until an explicit authority handoff.** It must first pass the shared conformance corpus against the TypeScript reference and browser evidence. Do not run two production authorities in parallel.

## Optimization invariants

- Keep a clean full-layout path as the correctness reference while incremental or specialized paths are optimized.
- Caches are derived and discardable. They must never become a second source of semantic state.
- Layout-tree snapshots are immutable. Mutations create new objects along the changed path so invalidation provenance can be verified without turning the happy path into a full-tree scan.
- Structural mutations remain an explicit invalidation-graph rebuild boundary until a structurally incremental algorithm is implemented and proved equivalent.
- Preserve deterministic ordering, tie-breaking, and replayable inputs. Seed optional stochastic algorithms.
- Compare optimized and clean execution on identical inputs. Differential equivalence is a correctness gate, not a benchmark.
- Blocking performance evidence should use deterministic work counters. Wall-clock timing remains advisory.
- Pathological incremental work should fall back to bounded clean recomputation rather than weakening correctness.

## Renderer and portability rule

The engine boundary is resolved geometry plus deterministic evidence. Renderers, Pages experiments, and WASM bindings stay downstream of that boundary. New rendering technology is justified only when it exposes a layout/compositing concept; it must not carry hidden layout behavior.

`grid-3d-model.ts` is a separate spatial-layout experiment, not a second implementation of 2D CSS Grid. Its `Grid3DDefinition` is authoritative and `ResolvedGrid3DScene` is derived data; SVG and Three.js consume that same scene. If Grid3D ever shares semantics with the 2D engine, move the shared rule into a common semantic kernel rather than synchronizing two implementations.

For Rust portability, first freeze a language-neutral tree/geometry contract and shared fixtures. Port one semantic unit at a time, run TypeScript/Rust/browser differential checks, and only then decide whether authority should move. The TypeScript implementation should not silently continue as a competing production engine after such a handoff.
