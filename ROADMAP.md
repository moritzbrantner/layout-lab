# layout-lab roadmap

## H1 — Browser-native layout foundation

- [x] Pages-ready interactive shell
- [x] Flexbox playground with geometry readout
- [x] Grid playground with geometry readout
- [x] 2D positioning and transform playground
- [x] CSS 3D perspective and transform playground
- [x] Shareable experiment state in the URL
- [x] Small deterministic visual-regression fixtures

## H2 — 2D layout depth

- [x] Intrinsic sizing baseline: min-content, max-content, fit-content
- [x] Flex sizing baseline: basis, grow, scaled shrink, and browser comparison
- [x] Grid sizing baseline: equal fractional tracks and gap subtraction
- [x] Flex min/max freezing with repeated redistribution for explicit numeric bounds
- [x] Flex intrinsic/automatic minimum-size interactions
- [x] Grid track sizing supported subset: intrinsic tracks, minmax, auto-fit, auto-fill, spanning contributions
  - [x] minmax + flexible-fraction baseline
  - [x] explicit spanning minimum contribution phase
  - [x] browser-measured intrinsic min-content contribution feeding the deterministic track phase
  - [x] auto-fit / auto-fill capacity and empty-track behavior
- [x] Block/inline formatting and margin collapse
- [x] Absolute, sticky, and fixed positioning containing blocks
- [x] Aspect ratio, replaced elements, overflow, and scroll containers
- [ ] Logical properties and writing modes
- [ ] Container queries and containment

## H3 — 3D layout and compositing

- [x] Transform-origin and perspective-origin visualization with resolved matrix evidence
- [x] Nested 3D contexts and flattening
- [x] Backface visibility
- [x] Stacking contexts, paint order, and z-index interaction with browser overlap sampling
- [x] Hit-testing versus transformed visual geometry
- [ ] Compositing-layer observations where browser APIs expose useful evidence

## H4 — Explain the algorithms

- [x] Deterministic pure sizing helpers with browser-side geometry comparison
- [x] Step-through Flexbox resolution with frozen/flexible item states for explicit numeric bounds
- [x] Step-through Grid base-growth and flexible-track phases for the supported subset
- [x] Auto-repeat capacity/collapse model with browser computed-track comparison
- [x] Constraint graph representation for layout dependencies
- [x] Side-by-side declared style, resolved style, and final geometry
- [x] Edge-case corpus with expected geometry

## H5 — Small layout engine

- [x] Typed layout tree independent of the DOM
- [x] Deterministic block layout baseline
- [x] Deterministic flex subset
- [x] Deterministic grid subset
- [x] Compare engine output against browser fixtures
- [x] Keep browser integration as an adapter so algorithms remain reusable

## H6 — Layout to rendering

- [ ] Paint-order visualization beyond the focused stacking-context experiment
- [ ] 2D canvas renderer for resolved boxes
- [ ] Optional WebGPU/3D renderer only where it teaches a boundary CSS alone cannot show
- [ ] Performance experiments for large layout trees and incremental relayout

## H7 — Layout algorithm zoo

Build a common experiment contract so substantially different layout algorithms can consume comparable inputs, expose intermediate decisions, and produce inspectable geometry.

- [x] Common algorithm input/output contract and selector in the algorithm explorer
- [x] Constraint-based layout with a Cassowary-style incremental linear constraint solver
- [x] Line breaking comparison: greedy wrapping versus Knuth–Plass paragraph optimization
- [x] Masonry / packing comparison: shortest-column placement versus deterministic first-fit packing
- [x] Tidy tree layout using a Reingold–Tilford-style algorithm
- [x] Layered DAG layout with an inspectable Sugiyama-style pipeline: ranking, crossing reduction, coordinate assignment
- [x] Optional force-directed graph layout with seeded deterministic initialization and convergence evidence
- [x] Shared step-through view for algorithm-specific intermediate state
- [x] Side-by-side comparison where multiple algorithms can solve the same fixture

## H8 — Incremental relayout and invalidation

- [x] Represent layout dependencies as an invalidation graph tied to the typed layout tree
- [x] Map style/tree mutations to the smallest dirty dependency set
- [x] Recompute only affected subtrees or algorithm phases
- [x] Visualize reused versus recomputed nodes after each mutation
- [x] Verify incremental output is identical to a clean full recomputation
- [x] Add deterministic mutation workloads for resize, content changes, insertion, removal, and reordering
- [x] Measure relayout work by visited nodes and algorithm iterations before adding wall-clock claims

## H9 — Differential and conformance laboratory

- [x] Promote browser fixtures into a reusable differential-testing corpus
- [x] Compare the small engine with browser-owned geometry for supported CSS subsets
- [ ] Add Chromium, Firefox, and WebKit comparison where CI can provide stable evidence
- [x] Make numeric tolerance and rounding rules explicit instead of silently accepting drift
- [ ] Generate bounded layout cases from typed inputs and replay them deterministically
- [ ] Minimize mismatching generated cases into small regression fixtures
- [ ] Preserve a replayable evidence record for every discovered mismatch

## H10 — Complexity and performance laboratory

- [ ] Benchmark algorithmic work independently from DOM measurement and rendering cost
- [ ] Scale fixtures by nodes, tracks, constraints, spans, and mutation size
- [ ] Track deterministic work counters such as passes, freezes, constraint pivots, and visited nodes
- [ ] Add pathological cases that expose worst-case or near-worst-case behavior
- [ ] Compare full layout versus incremental relayout on identical mutation traces
- [ ] Expose benchmark methodology and raw samples on GitHub Pages rather than decorative summary counters

## H11 — Portable engine core

Only pursue this after the H5 TypeScript model and fixtures establish stable semantics.

- [ ] Define a language-neutral layout-tree and geometry contract from the H5 model
- [ ] Implement the deterministic core in Rust without changing the established semantics
- [ ] Run the same conformance and edge-case corpus against TypeScript and Rust implementations
- [ ] Expose the Rust core to the browser through WASM behind the existing adapter boundary
- [ ] Differentially verify TypeScript, Rust/WASM, and browser geometry for supported cases
- [ ] Keep one authoritative behavior contract so the implementations cannot silently fork

## Sequencing rule

H5 remains the immediate engine milestone. H7 should start only once the typed tree and reusable geometry contract are stable enough that new algorithms do not invent incompatible representations. H8–H10 then use those common contracts for incremental work, differential verification, and performance evidence. H11 is an implementation-portability milestone, not a reason to duplicate semantics early.

## Scope rule

Prefer experiments that expose a layout rule, an intermediate decision, or measurable geometry. Keep simplified explanatory models visibly scoped and compare them against browser evidence. Browser-native text measurement remains browser-owned rather than being reimplemented approximately. Avoid adding graphics infrastructure merely to make the site visually impressive; rendering technology belongs here only when it clarifies a layout or compositing boundary.
