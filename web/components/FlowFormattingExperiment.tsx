"use client";

import {CSSProperties, RefObject, useEffect, useRef, useState} from "react";
import {resolveAdjacentPositiveMargins, type VerticalMarginMode} from "@/lib/flow-formatting";
import {experiments} from "@/lib/experiments";

type InlineMode = "inline" | "inline-block";

type InlineFragment = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function formatPx(value: number) {
  return `${round(value)}px`;
}

function useSiblingGap(refreshKey: string): [RefObject<HTMLDivElement | null>, number | null] {
  const ref = useRef<HTMLDivElement>(null);
  const [gap, setGap] = useState<number | null>(null);

  useEffect(() => {
    const stage = ref.current;
    if (!stage) return;
    const read = () => {
      const blocks = stage.querySelectorAll<HTMLElement>("[data-flow-block]");
      const first = blocks[0]?.getBoundingClientRect();
      const second = blocks[1]?.getBoundingClientRect();
      setGap(first && second ? round(second.top - first.bottom) : null);
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(stage);
    window.addEventListener("resize", read);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", read);
    };
  }, [refreshKey]);

  return [ref, gap];
}

function useInlineFragments(refreshKey: string): [RefObject<HTMLSpanElement | null>, InlineFragment[]] {
  const ref = useRef<HTMLSpanElement>(null);
  const [fragments, setFragments] = useState<InlineFragment[]>([]);

  useEffect(() => {
    const inline = ref.current;
    if (!inline) return;
    const read = () => {
      const origin = inline.parentElement?.getBoundingClientRect();
      if (!origin) return;
      setFragments(Array.from(inline.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0).map((rect) => ({
        left: round(rect.left - origin.left),
        top: round(rect.top - origin.top),
        width: round(rect.width),
        height: round(rect.height),
      })));
    };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, [refreshKey]);

  return [ref, fragments];
}

function ExperimentHeader() {
  const experiment = experiments.find((candidate) => candidate.id === "flow-formatting")!;
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

function RangeField({label, value, min, max, unit = "", onChange}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="control range-control">
      <span>{label}</span>
      <output>{value}{unit}</output>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function SelectField({label, value, options, onChange}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
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

export function FlowFormattingExperiment() {
  const [layoutMode, setLayoutMode] = useState<VerticalMarginMode>("collapse");
  const [marginAfterFirst, setMarginAfterFirst] = useState(36);
  const [marginBeforeSecond, setMarginBeforeSecond] = useState(20);
  const [inlineWidth, setInlineWidth] = useState(320);
  const [inlineMode, setInlineMode] = useState<InlineMode>("inline");
  const marginResolution = resolveAdjacentPositiveMargins({
    mode: layoutMode,
    before: marginAfterFirst,
    after: marginBeforeSecond,
  });
  const [marginStageRef, browserGap] = useSiblingGap(`${layoutMode}:${marginAfterFirst}:${marginBeforeSecond}`);
  const [inlineRef, fragments] = useInlineFragments(`${inlineWidth}:${inlineMode}`);
  const gapMatches = browserGap !== null && Math.abs(browserGap - marginResolution.gap) <= 1;
  const marginStageStyle: CSSProperties = layoutMode === "collapse"
    ? {display: "block"}
    : {display: "flex", flexDirection: "column"};
  const inlineText = "one inline box can fragment across several browser line boxes when available inline space becomes narrow";

  return (
    <div className="sizing-depth-shell flow-formatting-shell">
      <section className="experiment" id="flow-formatting">
        <ExperimentHeader />
        <div className="experiment-grid">
          <div className="controls-panel">
            <SelectField
              label="vertical layout"
              value={layoutMode}
              options={["collapse", "separate"]}
              onChange={(value) => setLayoutMode(value as VerticalMarginMode)}
            />
            <RangeField label="A margin-bottom" value={marginAfterFirst} min={0} max={64} unit="px" onChange={setMarginAfterFirst} />
            <RangeField label="B margin-top" value={marginBeforeSecond} min={0} max={64} unit="px" onChange={setMarginBeforeSecond} />
            <RangeField label="inline frame width" value={inlineWidth} min={200} max={520} unit="px" onChange={setInlineWidth} />
            <SelectField label="inline display" value={inlineMode} options={["inline", "inline-block"]} onChange={(value) => setInlineMode(value as InlineMode)} />
            <RuleList rules={[
              `.blocks { display: ${layoutMode === "collapse" ? "block" : "flex; flex-direction: column"}; }`,
              `.A { margin-bottom: ${marginAfterFirst}px; }`,
              `.B { margin-top: ${marginBeforeSecond}px; }`,
              `.phrase { display: ${inlineMode}; }`,
              `.inline-frame { width: ${inlineWidth}px; }`,
            ]} />
          </div>

          <div className="flow-formatting-demos">
            <div className="trace-panel">
              <div className="trace-heading">
                <div>
                  <strong>Adjacent block margins</strong>
                  <span>positive sibling margins in normal block flow versus flex items</span>
                </div>
                <code>{marginResolution.rule}({marginAfterFirst}, {marginBeforeSecond})</code>
              </div>
              <div className="trace-metrics">
                <TraceMetric label="model gap" value={formatPx(marginResolution.gap)} />
                <TraceMetric label="browser gap" value={browserGap === null ? "—" : `${formatPx(browserGap)}${gapMatches ? " ✓" : ""}`} />
                <TraceMetric label="A margin-bottom" value={formatPx(marginAfterFirst)} />
                <TraceMetric label="B margin-top" value={formatPx(marginBeforeSecond)} />
              </div>
              <div ref={marginStageRef} className="flow-margin-stage" style={marginStageStyle}>
                <div className="flow-block flow-block-a" data-flow-block="A" style={{marginBottom: marginAfterFirst}}>A</div>
                <div className="flow-block flow-block-b" data-flow-block="B" style={{marginTop: marginBeforeSecond}}>B</div>
              </div>
              <p className="trace-note">
                Scoped model: two positive vertical sibling margins only. Normal block-flow siblings collapse to the larger margin; flex-item margins do not collapse and therefore add. Parent/child collapse, negative margins, clearance, floats, and empty blocks remain outside this slice.
              </p>
            </div>

            <div className="trace-panel">
              <div className="trace-heading">
                <div>
                  <strong>Inline formatting fragments</strong>
                  <span>the browser constructs line boxes and exposes each painted inline fragment</span>
                </div>
                <code>display: {inlineMode}</code>
              </div>
              <div className="trace-metrics">
                <TraceMetric label="outer display" value={inlineMode} />
                <TraceMetric label="client rects" value={String(fragments.length)} />
                <TraceMetric label="frame width" value={formatPx(inlineWidth)} />
                <TraceMetric label="authority" value="browser" />
              </div>
              <div className="flow-inline-stage" style={{width: inlineWidth, maxWidth: "100%"}}>
                prefix <span ref={inlineRef} className="flow-inline-phrase" style={{display: inlineMode}}>{inlineText}</span> suffix
              </div>
              <div className="trace-table-wrap">
                <table className="trace-table flow-fragment-table">
                  <thead><tr><th>fragment</th><th>x</th><th>y</th><th>width</th><th>height</th></tr></thead>
                  <tbody>
                    {fragments.map((fragment, index) => (
                      <tr key={`${fragment.left}:${fragment.top}:${index}`}>
                        <td>{index + 1}</td>
                        <td>{formatPx(fragment.left)}</td>
                        <td>{formatPx(fragment.top)}</td>
                        <td>{formatPx(fragment.width)}</td>
                        <td>{formatPx(fragment.height)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="trace-note">
                Inline line breaking, glyph measurement, and line-box construction stay browser-owned. This experiment observes fragmentation with `getClientRects()`; it does not approximate text shaping or the inline formatting algorithm.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
