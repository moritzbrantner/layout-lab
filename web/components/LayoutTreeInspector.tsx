import {buildFlexEngineTree, buildGridEngineTree} from "@/lib/layout-engine-fixtures";
import {layoutBlockTree, layoutFlexTree, layoutGridTree} from "@/lib/layout-engine";
import {
  adaptFlexTree,
  adaptGridTree,
  buildBlockLayoutTree,
  buildFlexLayoutTree,
  buildGridLayoutTree,
  flattenLayoutTree,
} from "@/lib/layout-tree";
import type {AlgorithmScenario} from "@/lib/algorithm-pipeline";

function formatNumber(value: number) {
  return Math.round(value * 100) / 100;
}

function formatPx(value: number) {
  return `${formatNumber(value)}px`;
}

function EngineGeometryTable({
  boxes,
}: {
  boxes: readonly {id: string; label: string; rect: {x: number; y: number; width: number; height: number}}[];
}) {
  return (
    <div className="block-engine-table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Box</th>
            <th scope="col">X</th>
            <th scope="col">Y</th>
            <th scope="col">Width</th>
            <th scope="col">Height</th>
          </tr>
        </thead>
        <tbody>
          {boxes.map((box) => (
            <tr key={box.id}>
              <th scope="row">{box.label} <code>{box.id}</code></th>
              <td>{formatPx(box.rect.x)}</td>
              <td>{formatPx(box.rect.y)}</td>
              <td>{formatPx(box.rect.width)}</td>
              <td>{formatPx(box.rect.height)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlockLayoutBaseline() {
  const result = layoutBlockTree(buildBlockLayoutTree());

  return (
    <section className="block-engine-baseline" aria-labelledby="block-engine-title">
      <div className="algorithm-section-heading">
        <div>
          <div className="eyebrow">H5 block engine</div>
          <h3 id="block-engine-title">Deterministic block layout baseline</h3>
        </div>
        <p>
          Block-only trees resolve widths, vertical flow, derived heights, and positive adjacent sibling margins without reading the DOM.
        </p>
      </div>

      <div className="block-engine-summary">
        <div>
          <strong>{result.visitedNodes}</strong>
          <span>visited tree nodes</span>
        </div>
        <div>
          <strong>{formatPx(result.root.rect.width)} × {formatPx(result.root.rect.height)}</strong>
          <span>derived root geometry</span>
        </div>
        <div>
          <strong>{result.marginCollapses.length}</strong>
          <span>adjacent margin collapses</span>
        </div>
      </div>

      <EngineGeometryTable boxes={result.boxes} />

      <div className="block-margin-evidence" aria-label="Block margin collapse evidence">
        {result.marginCollapses.map((collapse) => (
          <p key={`${collapse.beforeId}-${collapse.afterId}`}>
            <strong>{collapse.beforeId} → {collapse.afterId}</strong>
            <span>{formatPx(collapse.beforeMargin)} vs {formatPx(collapse.afterMargin)} → {formatPx(collapse.resolvedGap)} collapsed gap</span>
          </p>
        ))}
      </div>
    </section>
  );
}

function FlexLayoutBaseline({innerSize, gapSize}: {innerSize: number; gapSize: number}) {
  const result = layoutFlexTree(buildFlexEngineTree(innerSize, gapSize));

  return (
    <section className="block-engine-baseline" aria-labelledby="flex-engine-title">
      <div className="algorithm-section-heading">
        <div>
          <div className="eyebrow">H5 flex engine</div>
          <h3 id="flex-engine-title">Deterministic Flexbox subset</h3>
        </div>
        <p>
          A single row of leaf block items turns the existing freeze-and-redistribute resolver into explicit box positions while keeping cross-axis behavior deliberately scoped.
        </p>
      </div>

      <div className="block-engine-summary">
        <div>
          <strong>{result.resolution.iterations.length}</strong>
          <span>resolution passes</span>
        </div>
        <div>
          <strong>{result.resolution.frozenCount}</strong>
          <span>frozen items</span>
        </div>
        <div>
          <strong>{formatPx(result.root.rect.width)} × {formatPx(result.root.rect.height)}</strong>
          <span>root geometry</span>
        </div>
      </div>

      <EngineGeometryTable boxes={result.boxes} />

      <div className="block-margin-evidence" aria-label="Flex resolution evidence">
        {result.resolution.iterations.map((iteration) => (
          <p key={iteration.iteration}>
            <strong>pass {iteration.iteration}</strong>
            <span>
              {formatPx(iteration.freeSpace)} free · {iteration.newlyFrozen.length > 0
                ? `freeze ${iteration.newlyFrozen.join(", ")}`
                : "accept remaining targets"}
            </span>
          </p>
        ))}
      </div>
    </section>
  );
}

function GridLayoutBaseline({innerSize, gapSize}: {innerSize: number; gapSize: number}) {
  const result = layoutGridTree(buildGridEngineTree(innerSize, gapSize));
  const frozenTracks = result.resolution.tracks.filter((track) => track.frozen).map((track) => track.label);

  return (
    <section className="block-engine-baseline" aria-labelledby="grid-engine-title">
      <div className="algorithm-section-heading">
        <div>
          <div className="eyebrow">H5 grid engine</div>
          <h3 id="grid-engine-title">Deterministic Grid subset</h3>
        </div>
        <p>
          Explicit single-row placements turn the existing spanning-contribution, minmax, and flexible-track resolver into concrete item geometry, including internal gaps for spans.
        </p>
      </div>

      <div className="block-engine-summary">
        <div>
          <strong>{formatPx(result.resolution.flexFraction)}</strong>
          <span>resolved 1fr</span>
        </div>
        <div>
          <strong>{frozenTracks.length > 0 ? frozenTracks.join(", ") : "none"}</strong>
          <span>minimum-frozen tracks</span>
        </div>
        <div>
          <strong>{formatPx(result.root.rect.width)} × {formatPx(result.root.rect.height)}</strong>
          <span>root geometry</span>
        </div>
      </div>

      <EngineGeometryTable boxes={result.boxes} />

      <div className="block-margin-evidence" aria-label="Grid resolution evidence">
        {result.resolution.contributionSteps.map((step) => (
          <p key={step.label}>
            <strong>{step.label}</strong>
            <span>span {step.span} · grow bases by {formatPx(step.deficit)}</span>
          </p>
        ))}
        {result.resolution.tracks.map((track, index) => (
          <p key={track.label}>
            <strong>track {track.label}</strong>
            <span>x {formatPx(result.trackStarts[index]!)} · width {formatPx(track.targetSize)}{track.frozen ? " · frozen at minimum" : ""}</span>
          </p>
        ))}
      </div>
    </section>
  );
}

export function LayoutTreeInspector({
  scenario,
  innerSize,
  gapSize,
}: {
  scenario: AlgorithmScenario;
  innerSize: number;
  gapSize: number;
}) {
  const tree = scenario === "flex"
    ? buildFlexLayoutTree(innerSize, gapSize)
    : buildGridLayoutTree(innerSize, gapSize);
  const snapshots = flattenLayoutTree(tree);
  const adapterSummary = scenario === "flex"
    ? (() => {
        const adapter = adaptFlexTree(tree);
        return `${adapter.items.length} flex items · ${adapter.innerSize}px main size · ${adapter.gapSize}px gap`;
      })()
    : (() => {
        const adapter = adaptGridTree(tree);
        return `${adapter.tracks.length} grid tracks · ${adapter.contributions.length} spanning contribution · ${adapter.innerSize}px inline size`;
      })();

  return (
    <>
      <section className="layout-tree-inspector" aria-labelledby="layout-tree-title">
        <div className="algorithm-section-heading">
          <div>
            <div className="eyebrow">H5 engine boundary</div>
            <h3 id="layout-tree-title">Typed layout tree</h3>
          </div>
          <p>
            The engine tree is plain typed data with stable node IDs and no DOM references. The current Flex/Grid algorithms consume it only through narrow, fail-closed adapters.
          </p>
        </div>

        <div className="layout-tree-contract">
          <div>
            <strong>Tree contract</strong>
            <span>node → style → children</span>
          </div>
          <div>
            <strong>Adapter result</strong>
            <span>{adapterSummary}</span>
          </div>
          <div>
            <strong>Measurement boundary</strong>
            <span>intrinsic text/content sizes remain explicit browser-owned inputs</span>
          </div>
        </div>

        <ol className="layout-tree-list" aria-label={`${scenario} typed layout tree`}>
          {snapshots.map((node) => (
            <li key={node.id} style={{paddingInlineStart: `${node.depth * 22 + 14}px`}}>
              <code>{node.id}</code>
              <strong>{node.label}</strong>
              <span>{node.display}</span>
              <span>{node.childCount} {node.childCount === 1 ? "child" : "children"}</span>
            </li>
          ))}
        </ol>
      </section>

      <BlockLayoutBaseline />
      {scenario === "flex" ? <FlexLayoutBaseline innerSize={innerSize} gapSize={gapSize} /> : null}
      {scenario === "grid" ? <GridLayoutBaseline innerSize={innerSize} gapSize={gapSize} /> : null}
    </>
  );
}
