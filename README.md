# layout-lab

Experimental browser laboratory for understanding layout engines, positioning, constraint resolution, and the path from declarative layout rules to rendered geometry.

The GitHub Pages site is the primary interactive surface: each experiment explains one layout concept and makes its inputs, computed geometry, and trade-offs visible.

## First slice

The first browser slice establishes four interactive experiments:

- **Flexbox** — direction, main-axis distribution, cross-axis alignment, and gap.
- **Grid** — explicit columns, gaps, spanning items, and dense auto-placement.
- **2D positioning** — relative containing blocks, absolute offsets, rotation, and scale.
- **3D transforms** — perspective, `preserve-3d`, X/Y rotation, and Z separation.

Flexbox and Grid also expose live child bounding boxes so the lab connects CSS declarations to measured geometry rather than stopping at screenshots.

## Development

```bash
cd web
bun install
bun run dev
```

Verification:

```bash
bun run typecheck
bun run build
```

The production build is a static export configured for `/layout-lab` on GitHub Pages.

## Direction

See [ROADMAP.md](ROADMAP.md). The lab starts with browser-native CSS layout and transforms, then grows toward constraint visualization, intrinsic sizing, containment, writing modes, and eventually small layout-engine implementations whose intermediate decisions can be inspected.
