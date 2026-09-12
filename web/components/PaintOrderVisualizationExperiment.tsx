"use client";

import {CSSProperties, RefObject, useEffect, useRef, useState} from "react";
import {createPaintOrderFixture, resolvePaintOrder, topToBottomPaintIds} from "@/lib/paint-order";
import {experiments} from "@/lib/experiments";

type PaintEvidence = {
  browserTopToBottom: string[];
  sampleX: number;
  sampleY: number;
};

function usePaintEvidence(refreshKey: string): [RefObject<HTMLDivElement | null>, PaintEvidence] {
  const ref = useRef<HTMLDivElement>(null);
  const [evidence, setEvidence] = useState<PaintEvidence>({browserTopToBottom: [], sampleX: 0, sampleY: 0});

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const read = () => {
      const rect = root.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const seen = new Set<string>();
      const browserTopToBottom = document.elementsFromPoint(x, y)
        .map((element) => element.closest<HTMLElement>("[data-paint-id]")?.dataset.paintId)
        .filter((id): id is string => Boolean(id))
        .filter((id) => {
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });

      setEvidence({
        browserTopToBottom,
        sampleX: x - rect.left,
        sampleY: y - rect.top,
      });
    };

    const frame = requestAnimationFrame(read);
    window.addEventListener("resize", read);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", read);
    };
  }, [refreshKey]);

  return [ref, evidence];
}

function ExperimentHeader() {
  const experiment = experiments.find((candidate) => candidate.id === "paint-order-visualization")!;
  return (
    <header className="experiment-header">
      <div>
        <div className="eyebrow">{experiment.area}</div>
        <h2>{experiment.title}</h2>
        <p>{experiment.summary}</p>
      </div>
      <div className="property-list" aria-label="CSS properties covered">
        {experiment.properties.map((property) => <code key={property}>{property}</code>)}
      </div>
    </header>
  );
}

function RangeField({label, value, min, max, onChange}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="control range-control">
      <span>{label}</span>
      <output>{value}</output>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ToggleField({label, checked, onChange}: {label: string; checked: boolean; onChange: (checked: boolean) => void}) {
  return (
    <label className="toggle-control">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function RuleList({rules}: {rules: readonly string[]}) {
  return <pre className="rule-list" aria-label="Active CSS rules">{rules.join("\n")}</pre>;
}

function TraceMetric({label, value}: {label: string; value: string}) {
  return (
    <div className="trace-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function PaintOrderVisualizationExperiment() {
  const [negativeA, setNegativeA] = useState(-3);
  const [negativeB, setNegativeB] = useState(-1);
  const [positiveA, setPositiveA] = useState(1);
  const [positiveB, setPositiveB] = useState(3);
  const [positionedZero, setPositionedZero] = useState(false);

  const fixture = createPaintOrderFixture({negativeA, negativeB, positiveA, positiveB});
  const modelBottomToTop = resolvePaintOrder(fixture);
  const expectedTopToBottom = topToBottomPaintIds(fixture);
  const refreshKey = `${negativeA}:${negativeB}:${positiveA}:${positiveB}:${positionedZero}`;
  const [stageRef, evidence] = usePaintEvidence(refreshKey);
  const browserMatches = evidence.browserTopToBottom.length === expectedTopToBottom.length
    && evidence.browserTopToBottom.every((id, index) => id === expectedTopToBottom[index]);

  const positionedStyle: CSSProperties = {zIndex: positionedZero ? 0 : "auto"};

  return (
    <div className="rendering-depth-shell">
      <section className="experiment" id="paint-order-visualization">
        <ExperimentHeader />
        <div className="experiment-grid">
          <div className="controls-panel">
            <RangeField label="negative A z-index" value={negativeA} min={-5} max={-1} onChange={setNegativeA} />
            <RangeField label="negative B z-index" value={negativeB} min={-5} max={-1} onChange={setNegativeB} />
            <RangeField label="positive A z-index" value={positiveA} min={1} max={5} onChange={setPositiveA} />
            <RangeField label="positive B z-index" value={positiveB} min={1} max={5} onChange={setPositiveB} />
            <ToggleField label="positioned phase uses z-index: 0" checked={positionedZero} onChange={setPositionedZero} />
            <RuleList rules={[
              ".root { isolation: isolate; position: relative; }",
              `.negative-a { position: absolute; z-index: ${negativeA}; }`,
              `.negative-b { position: absolute; z-index: ${negativeB}; }`,
              ".block { display: block; }",
              ".inline { display: inline-grid; }",
              `.positioned { position: absolute; z-index: ${positionedZero ? "0" : "auto"}; }`,
              `.positive-a { position: absolute; z-index: ${positiveA}; }`,
              `.positive-b { position: absolute; z-index: ${positiveB}; }`,
            ]} />
          </div>

          <div>
            <div ref={stageRef} className="paint-order-stage" data-paint-id="root">
              <div className="paint-order-layer paint-order-negative-a" style={{zIndex: negativeA}} data-paint-id="negative-a">negative A</div>
              <div className="paint-order-layer paint-order-negative-b" style={{zIndex: negativeB}} data-paint-id="negative-b">negative B</div>
              <div className="paint-order-block" data-paint-id="block">
                <span className="paint-order-inline" data-paint-id="inline">inline content</span>
              </div>
              <div className="paint-order-layer paint-order-positioned" style={positionedStyle} data-paint-id="positioned">
                positioned {positionedZero ? "z 0" : "auto"}
              </div>
              <div className="paint-order-layer paint-order-positive-a" style={{zIndex: positiveA}} data-paint-id="positive-a">positive A</div>
              <div className="paint-order-layer paint-order-positive-b" style={{zIndex: positiveB}} data-paint-id="positive-b">positive B</div>
              <div className="paint-order-sample" style={{left: evidence.sampleX, top: evidence.sampleY}} aria-hidden="true">
                <span>sample</span>
              </div>
            </div>

            <div className="trace-panel">
              <div className="trace-heading">
                <div>
                  <strong>Scoped paint sequence</strong>
                  <span>model paints bottom → top; browser hit stack reports top → bottom at the shared overlap point</span>
                </div>
                <code>{browserMatches ? "match" : "difference"}</code>
              </div>
              <div className="trace-metrics">
                <TraceMetric label="supported phases" value={String(new Set(fixture.map((item) => item.phase)).size)} />
                <TraceMetric label="model entries" value={String(modelBottomToTop.length)} />
                <TraceMetric label="browser entries" value={String(evidence.browserTopToBottom.length)} />
                <TraceMetric label="browser/model" value={browserMatches ? "match ✓" : "difference"} />
              </div>
              <div className="paint-order-columns">
                <div>
                  <strong>Model · bottom → top</strong>
                  <ol className="paint-order-list">
                    {modelBottomToTop.map((item) => (
                      <li key={item.id}>
                        <code>{item.id}</code>
                        <span>{item.phase}{item.zIndex === undefined ? "" : ` · z ${item.zIndex}`}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <strong>Browser · top → bottom</strong>
                  <ol className="paint-order-list">
                    {evidence.browserTopToBottom.map((id) => {
                      const item = fixture.find((candidate) => candidate.id === id);
                      return (
                        <li key={id}>
                          <code>{id}</code>
                          <span>{item?.phase ?? "browser element"}</span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
              <p className="trace-note">
                Scope: one isolated stacking context with its background, negative positioned contexts, one in-flow block, one atomic inline-level box, positioned `auto`/`0`, and positive positioned contexts. Floats, pseudo-elements, outlines, the top layer, blending, SVG painting, 3D depth sorting, and arbitrary nested stacking-context trees remain browser-owned. This is a paint-phase visualization, not a claim that CSS painting is one global `z-index` sort.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
