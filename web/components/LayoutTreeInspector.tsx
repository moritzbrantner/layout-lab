import {buildFlexEngineTree} from "@/lib/layout-engine-fixtures";
import {layoutBlockTree, layoutFlexTree} from "@/lib/layout-engine";
import {
  adaptFlexTree,
  adaptGridTree,
  buildBlockLayoutTree,
  buildFlexLayoutTree,
  buildGridLayoutTree,
  flattenLayoutTree,
} from "@/lib/layout-tree";
import type {AlgorithmScenario} from "@/lib/algorithm-pipeline";

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
              <td>{box.rect.x}px</td>
              <td>{box.rect.y}px</td>
              <td>{box.rect.width}px</td>
              <td>{box.rect.height}px</td>
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
          <strong>{result.root.rect.width}px × {result.root.rect.height}px</strong>
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
            <span>{collapse.beforeMargin}px vs {collapse.afterMargin}px → {collapse.resolvedGap}px collapsed gap</span>
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
          <strong>{result.root.rect.width}px × {result.root.rect.height}px</strong>
          <span>root geometry</span>
        </div>
      </div>

      <EngineGeometryTable boxes={result.boxes} />

      <div className="block-margin-evidence" aria-label="Flex resolution evidence">
        {result.resolution.iterations.map((iteration) => (
          <p key={iteration.iteration}>
            <strong>pass {iteration.iteration}</strong>
            <span>
              {iteration.freeSpace}px free · {iteration.newlyFrozen.length > 0
                ? `freeze ${iteration.newlyFrozen.join(", ")}`
                : "accept remaining targets"}
            </span>
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
    </>
  );
}
