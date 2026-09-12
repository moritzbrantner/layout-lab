"use client";

import {type CSSProperties, useEffect, useRef, useState} from "react";
import {
  measureBrowserLayout,
  type GeometryComparison,
} from "@/lib/browser-layout-adapter";
import {
  compareLayoutDifferentialFixture,
  getLayoutDifferentialFixture,
  type BrowserFixtureNode,
  type LayoutDifferentialFixture,
} from "@/lib/layout-differential-corpus";
import type {AlgorithmScenario} from "@/lib/algorithm-pipeline";

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value * 10_000) / 10_000}`;
}

function summarizeGeometry(box: {x: number; y: number; width: number; height: number}) {
  return `x ${formatNumber(box.x)} · y ${formatNumber(box.y)} · ${formatNumber(box.width)}×${formatNumber(box.height)}`;
}

function policySummary(fixture: LayoutDifferentialFixture) {
  const tolerance = fixture.policy.tolerance;
  return `${fixture.policy.version} · x ${tolerance.x}px · y ${tolerance.y}px · width ${tolerance.width}px · height ${tolerance.height}px · ${fixture.policy.roundingDecimals} decimal normalization`;
}

function useBrowserGeometryComparison(
  fixture: LayoutDifferentialFixture,
  refreshKey: string,
) {
  const ref = useRef<HTMLDivElement>(null);
  const [comparisons, setComparisons] = useState<GeometryComparison[]>([]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const read = () => {
      const browser = measureBrowserLayout(root);
      setComparisons(compareLayoutDifferentialFixture(fixture, browser));
    };

    read();
    const observer = new ResizeObserver(read);
    observer.observe(root);
    root.querySelectorAll<HTMLElement>("[data-layout-engine-node]").forEach((element) => observer.observe(element));
    window.addEventListener("resize", read);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", read);
    };
  }, [fixture, refreshKey]);

  return [ref, comparisons] as const;
}

function BrowserFixtureTree({
  node,
  rootRef,
  isRoot = false,
}: {
  node: BrowserFixtureNode;
  rootRef: React.RefObject<HTMLDivElement | null>;
  isRoot?: boolean;
}) {
  return (
    <div
      ref={isRoot ? rootRef : undefined}
      data-layout-engine-node={node.id}
      style={node.style as unknown as CSSProperties}
    >
      {node.children.map((child) => (
        <BrowserFixtureTree key={child.id} node={child} rootRef={rootRef} />
      ))}
    </div>
  );
}

function BrowserFixtureComparison({
  fixture,
  refreshKey,
}: {
  fixture: LayoutDifferentialFixture;
  refreshKey: string;
}) {
  const [ref, comparisons] = useBrowserGeometryComparison(fixture, refreshKey);
  const measured = comparisons.length > 0;
  const matches = measured && comparisons.every((comparison) => comparison.matches);

  return (
    <article className="browser-engine-fixture" data-differential-fixture={fixture.id}>
      <header>
        <div>
          <strong>{fixture.title}</strong>
          <p>{fixture.summary}</p>
          <p><code>{policySummary(fixture)}</code></p>
        </div>
        <span data-browser-comparison-status={measured ? (matches ? "match" : "mismatch") : "pending"}>
          {measured
            ? matches
              ? `browser matches ${fixture.policy.version}`
              : `browser differs from ${fixture.policy.version}`
            : "browser measurement pending"}
        </span>
      </header>

      <div className="browser-engine-fixture-scroll">
        <div className="browser-engine-fixture-frame">
          <BrowserFixtureTree node={fixture.browserTree} rootRef={ref} isRoot />
        </div>
      </div>

      <div className="browser-engine-comparison-table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Box</th>
              <th scope="col">Engine geometry</th>
              <th scope="col">Browser geometry</th>
              <th scope="col">Max Δ</th>
            </tr>
          </thead>
          <tbody>
            {measured ? comparisons.map((comparison) => (
              <tr key={comparison.id} data-match={comparison.matches ? "true" : "false"}>
                <th scope="row"><code>{comparison.id}</code></th>
                <td>{comparison.engine ? summarizeGeometry(comparison.engine) : "missing"}</td>
                <td>{comparison.browser ? summarizeGeometry(comparison.browser) : "missing"}</td>
                <td>{formatNumber(comparison.maximumDelta)}px</td>
              </tr>
            )) : fixture.engineBoxes.map((box) => (
              <tr key={box.id}>
                <th scope="row"><code>{box.id}</code></th>
                <td>{summarizeGeometry(box.rect)}</td>
                <td>pending</td>
                <td>—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function BrowserEngineComparison({
  scenario,
  innerSize,
  gapSize,
}: {
  scenario: AlgorithmScenario;
  innerSize: number;
  gapSize: number;
}) {
  const options = {
    flexInnerSize: innerSize,
    flexGapSize: gapSize,
    gridInnerSize: innerSize,
    gridGapSize: gapSize,
  };
  const block = getLayoutDifferentialFixture("block-baseline", options);
  const selected = getLayoutDifferentialFixture(
    scenario === "flex" ? "flex-engine" : "grid-engine",
    options,
  );

  return (
    <section className="browser-engine-comparison" aria-labelledby="browser-engine-comparison-title">
      <div className="algorithm-section-heading">
        <div>
          <div className="eyebrow">H9 differential corpus</div>
          <h3 id="browser-engine-comparison-title">Engine ↔ browser geometry</h3>
        </div>
        <p>
          The H5 engine and browser fixtures now come from one reusable differential corpus. Every case carries a versioned per-field tolerance and fixed numeric normalization rule so later browser-matrix CI can replay the same evidence.
        </p>
      </div>

      <div className="browser-engine-fixtures">
        <BrowserFixtureComparison fixture={block} refreshKey="block-baseline" />
        <BrowserFixtureComparison
          fixture={selected}
          refreshKey={`${selected.id}:${innerSize}:${gapSize}:${selected.policy.version}`}
        />
      </div>
    </section>
  );
}
