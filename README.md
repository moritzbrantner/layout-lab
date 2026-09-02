# layout-lab

Experimental browser laboratory for understanding layout engines, positioning, constraint resolution, and the path from declarative layout rules to rendered geometry.

The GitHub Pages site is the primary interactive surface: each experiment should explain one layout concept and make its inputs, computed geometry, and trade-offs visible.

## First experiment

The initial page keeps one four-box tree constant while switching between normal flow, flexbox, and grid. Width, gap, and flex wrapping are adjustable, and the page measures the resulting stage dimensions and row count from the browser's computed geometry.

This deliberately uses the browser as the first reference implementation. Later experiments can place custom layout algorithms beside native CSS and compare their geometry for the same fixture.

## Run locally

The first site is dependency-free. Serve the repository root with any static file server and open `site/index.html` through that server.

## Direction

Good future experiments include intrinsic sizing, containing blocks and positioning, stacking contexts, fragmentation, constraint solvers, layout invalidation/performance, and genuinely spatial/3D layout models.
