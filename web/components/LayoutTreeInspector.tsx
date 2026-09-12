import {
  adaptFlexTree,
  adaptGridTree,
  buildFlexLayoutTree,
  buildGridLayoutTree,
  flattenLayoutTree,
} from "@/lib/layout-tree";
import type {AlgorithmScenario} from "@/lib/algorithm-pipeline";

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
  );
}
