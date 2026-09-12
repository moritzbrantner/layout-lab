"use client";

import {type CSSProperties, type ReactNode, useEffect, useRef, useState} from "react";
import {
  compareLayoutGeometry,
  DEFAULT_GEOMETRY_TOLERANCE,
  measureBrowserLayout,
  type GeometryComparison,
} from "@/lib/browser-layout-adapter";
import {buildFlexEngineTree, buildGridEngineTree} from "@/lib/layout-engine-fixtures";
import {layoutBlockTree, layoutFlexTree, layoutGridTree, type LayoutBox} from "@/lib/layout-engine";
import {buildBlockLayoutTree} from "@/lib/layout-tree";
import type {AlgorithmScenario} from "@/lib/algorithm-pipeline";

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value * 100) / 100}`;
}

function summarizeGeometry(box: {x: number; y: number; width: number; height: number}) {
  return `x ${formatNumber(box.x)} · y ${formatNumber(box.y)} · ${formatNumber(box.width)}×${formatNumber(box.height)}`;
}

function useBrowserGeometryComparison(
  engineBoxes: readonly LayoutBox[],
  refreshKey: string,
) {
  const ref = useRef<HTMLDivElement>(null);
  const [comparisons, setComparisons] = useState<GeometryComparison[]>([]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const read = () => {
      const browser = measureBrowserLayout(root);
      setComparisons(compareLayoutGeometry(engineBoxes, browser));
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
  }, [engineBoxes, refreshKey]);

  return [ref, comparisons] as const;
}

function BrowserFixtureComparison({
  title,
  summary,
  refreshKey,
  engineBoxes,
  children,
}: {
  title: string;
  summary: string;
  refreshKey: string;
  engineBoxes: readonly LayoutBox[];
  children: (ref: React.RefObject<HTMLDivElement | null>) => ReactNode;
}) {
  const [ref, comparisons] = useBrowserGeometryComparison(engineBoxes, refreshKey);
  const measured = comparisons.length > 0;
  const matches = measured && comparisons.every((comparison) => comparison.matches);

  return (
    <article className="browser-engine-fixture">
      <header>
        <div>
          <strong>{title}</strong>
          <p>{summary}</p>
        </div>
        <span data-browser-comparison-status={measured ? (matches ? "match" : "mismatch") : "pending"}>
          {measured
            ? matches
              ? `browser matches engine within ${DEFAULT_GEOMETRY_TOLERANCE}px`
              : `browser differs beyond ${DEFAULT_GEOMETRY_TOLERANCE}px`
            : "browser measurement pending"}
        </span>
      </header>

      <div className="browser-engine-fixture-scroll">
        <div className="browser-engine-fixture-frame">
          {children(ref)}
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
            )) : engineBoxes.map((box) => (
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

function BlockBrowserFixture({ref}: {ref: React.RefObject<HTMLDivElement | null>}) {
  return (
    <div
      ref={ref}
      data-layout-engine-node="block-root"
      style={{width: 420, boxSizing: "border-box"}}
    >
      <div
        data-layout-engine-node="header"
        style={{height: 56, marginBlockEnd: 20, boxSizing: "border-box"}}
      />
      <div
        data-layout-engine-node="content"
        style={{height: 132, minWidth: 240, maxWidth: 360, marginBlockStart: 12, marginBlockEnd: 18, boxSizing: "border-box"}}
      />
      <div
        data-layout-engine-node="footer"
        style={{width: 280, height: 44, marginBlockStart: 24, boxSizing: "border-box"}}
      />
    </div>
  );
}

function FlexBrowserFixture({
  ref,
  innerSize,
  gapSize,
}: {
  ref: React.RefObject<HTMLDivElement | null>;
  innerSize: number;
  gapSize: number;
}) {
  const itemStyle = (
    flex: string,
    height: number,
    minWidth: number,
    maxWidth: number,
  ): CSSProperties => ({
    flex,
    height,
    minWidth,
    maxWidth,
    boxSizing: "border-box",
  });

  return (
    <div
      ref={ref}
      data-layout-engine-node="root"
      style={{display: "flex", width: innerSize, height: 120, gap: gapSize, alignItems: "flex-start", boxSizing: "border-box"}}
    >
      <div data-layout-engine-node="item-a" style={itemStyle("1 1 120px", 72, 80, 220)} />
      <div data-layout-engine-node="item-b" style={itemStyle("8 1 132px", 104, 96, 184)} />
      <div data-layout-engine-node="item-c" style={itemStyle("2 1 112px", 88, 72, 240)} />
    </div>
  );
}

function GridBrowserFixture({
  ref,
  innerSize,
  gapSize,
}: {
  ref: React.RefObject<HTMLDivElement | null>;
  innerSize: number;
  gapSize: number;
}) {
  return (
    <div
      ref={ref}
      data-layout-engine-node="root"
      style={{
        display: "grid",
        width: innerSize,
        height: 120,
        gridTemplateColumns: "minmax(96px, 1fr) minmax(164px, 1fr) minmax(88px, 2fr)",
        gridTemplateRows: "120px",
        gap: gapSize,
        alignItems: "start",
        boxSizing: "border-box",
      }}
    >
      <div
        data-layout-engine-node="span-ab"
        style={{gridColumn: "1 / span 2", gridRow: 1, minWidth: 300, height: 80, boxSizing: "border-box"}}
      />
      <div
        data-layout-engine-node="item-c"
        style={{gridColumn: 3, gridRow: 1, height: 96, boxSizing: "border-box"}}
      />
    </div>
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
  const block = layoutBlockTree(buildBlockLayoutTree());
  const selected = scenario === "flex"
    ? layoutFlexTree(buildFlexEngineTree(innerSize, gapSize))
    : layoutGridTree(buildGridEngineTree(innerSize, gapSize));

  return (
    <section className="browser-engine-comparison" aria-labelledby="browser-engine-comparison-title">
      <div className="algorithm-section-heading">
        <div>
          <div className="eyebrow">H5 browser adapter</div>
          <h3 id="browser-engine-comparison-title">Engine ↔ browser geometry</h3>
        </div>
        <p>
          The engine remains pure typed data. A narrow browser adapter measures matching CSS fixtures afterward and compares geometry with an explicit {DEFAULT_GEOMETRY_TOLERANCE}px tolerance.
        </p>
      </div>

      <div className="browser-engine-fixtures">
        <BrowserFixtureComparison
          title="Block fixture"
          summary="Same widths, heights, and positive sibling margins as the deterministic block baseline."
          refreshKey="block-v1"
          engineBoxes={block.boxes}
        >
          {(ref) => <BlockBrowserFixture ref={ref} />}
        </BrowserFixtureComparison>

        <BrowserFixtureComparison
          title={scenario === "flex" ? "Flex fixture" : "Grid fixture"}
          summary={scenario === "flex"
            ? "Same basis, grow/shrink factors, min/max bounds, cross sizes, container width, and gap as the Flex engine fixture."
            : "Same minmax tracks, spanning minimum, explicit placement, container width, and gap as the Grid engine fixture."}
          refreshKey={`${scenario}:${innerSize}:${gapSize}`}
          engineBoxes={selected.boxes}
        >
          {(ref) => scenario === "flex"
            ? <FlexBrowserFixture ref={ref} innerSize={innerSize} gapSize={gapSize} />
            : <GridBrowserFixture ref={ref} innerSize={innerSize} gapSize={gapSize} />}
        </BrowserFixtureComparison>
      </div>
    </section>
  );
}
