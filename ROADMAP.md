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

- [x] Intrinsic sizing baseline: min-content, max-content, fit-content
- [x] Flex sizing baseline: basis, grow, scaled shrink, and browser comparison
- [x] Grid sizing baseline: equal fractional tracks and gap subtraction
- [x] Flex min/max freezing with repeated redistribution for explicit numeric bounds
- [ ] Flex intrinsic/automatic minimum-size interactions
- [x] Grid track sizing supported subset: intrinsic tracks, minmax, auto-fit, auto-fill, spanning contributions
  - [x] minmax + flexible-fraction baseline
  - [x] explicit spanning minimum contribution phase
  - [x] browser-measured intrinsic min-content contribution feeding the deterministic track phase
  - [x] auto-fit / auto-fill capacity and empty-track behavior
- [ ] Block/inline formatting and margin collapse
- [ ] Absolute, sticky, and fixed positioning containing blocks
- [ ] Aspect ratio, replaced elements, overflow, and scroll containers
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

- [ ] Paint-order visualization beyond the focused stacking-context experiment
- [ ] 2D canvas renderer for resolved boxes
- [ ] Optional WebGPU/3D renderer only where it teaches a boundary CSS alone cannot show
- [ ] Performance experiments for large layout trees and incremental relayout

## Scope rule

Prefer experiments that expose a layout rule, an intermediate decision, or measurable geometry. Keep simplified explanatory models visibly scoped and compare them against browser evidence. Browser-native text measurement remains browser-owned rather than being reimplemented approximately. Avoid adding graphics infrastructure merely to make the site visually impressive; rendering technology belongs here only when it clarifies a layout or compositing boundary.
