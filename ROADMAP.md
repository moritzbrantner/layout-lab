# layout-lab roadmap

## H1 — Browser-native layout foundation

- [x] Pages-ready interactive shell
- [x] Flexbox playground with geometry readout
- [x] Grid playground with geometry readout
- [x] 2D positioning and transform playground
- [x] CSS 3D perspective and transform playground
- [ ] Shareable experiment state in the URL
- [ ] Small deterministic visual-regression fixtures

## H2 — 2D layout depth

- [ ] Intrinsic sizing: min-content, max-content, fit-content
- [ ] Flex sizing algorithm: basis, grow, shrink, min-size interactions
- [ ] Grid track sizing: fixed, fractional, minmax, auto-fit/auto-fill
- [ ] Block/inline formatting and margin collapse
- [ ] Absolute, sticky, and fixed positioning containing blocks
- [ ] Aspect ratio, replaced elements, overflow, and scroll containers
- [ ] Logical properties and writing modes
- [ ] Container queries and containment

## H3 — 3D layout and compositing

- [ ] Transform-origin and perspective-origin visualization
- [ ] Nested 3D contexts and flattening
- [ ] Backface visibility
- [ ] Stacking contexts, paint order, and z-index interaction
- [ ] Hit-testing versus transformed visual geometry
- [ ] Compositing-layer observations where browser APIs expose useful evidence

## H4 — Explain the algorithms

- [ ] Step-through Flexbox resolution with frozen/flexible item states
- [ ] Step-through Grid track sizing phases
- [ ] Constraint graph representation for layout dependencies
- [ ] Side-by-side declared style, resolved style, and final geometry
- [ ] Edge-case corpus with expected geometry

## H5 — Small layout engine

- [ ] Typed layout tree independent of the DOM
- [ ] Deterministic block layout baseline
- [ ] Deterministic flex subset
- [ ] Deterministic grid subset
- [ ] Compare engine output against browser fixtures
- [ ] Keep browser integration as an adapter so algorithms remain reusable

## H6 — Layout to rendering

- [ ] Paint-order visualization
- [ ] 2D canvas renderer for resolved boxes
- [ ] Optional WebGPU/3D renderer only where it teaches a boundary CSS alone cannot show
- [ ] Performance experiments for large layout trees and incremental relayout

## Scope rule

Prefer experiments that expose a layout rule, an intermediate decision, or measurable geometry. Avoid adding graphics infrastructure merely to make the site visually impressive; rendering technology belongs here only when it clarifies a layout or compositing boundary.
