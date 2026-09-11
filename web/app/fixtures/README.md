# Visual fixture capture contract

The `/fixtures` route is intentionally static and deterministic.

- Capture individual canvases with `[data-visual-fixture="<id>"] .visual-fixture-canvas`.
- Treat `data-visual-fixture-suite="layout-v1"` as the fixture contract version.
- The canvas dimensions are fixed at 360 × 180 CSS pixels and are mirrored in `data-fixture-width` / `data-fixture-height`.
- Canvas geometry does not depend on text measurement, animation, randomness, viewport-relative sizing, or current time.
- Browser rendering remains authoritative. These fixtures provide stable inputs for visual comparison; they do not replace browser geometry with a model.
