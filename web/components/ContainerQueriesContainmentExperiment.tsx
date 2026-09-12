"use client";

import {CSSProperties, RefObject, useEffect, useRef, useState} from "react";
import {
  matchesMinInlineSize,
  resolveIntrinsicInlineContribution,
  type InlineContainmentMode,
} from "@/lib/container-queries-containment";
import {experiments} from "@/lib/experiments";

const QUERY_THRESHOLD = 320;
const CONTENT_INLINE_SIZE = 360;

type QueryMeasurement = {
  inlineSize: number;
  queryActive: boolean;
  gridTemplateColumns: string;
};

type ContainmentMeasurement = {
  wrapperInlineSize: number;
  contentInlineSize: number;
};

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function formatPx(value: number | null) {
  return value === null ? "—" : `${round(value)}px`;
}

function useQueryMeasurement(refreshKey: string): [RefObject<HTMLDivElement | null>, QueryMeasurement | null] {
  const ref = useRef<HTMLDivElement>(null);
  const [measurement, setMeasurement] = useState<QueryMeasurement | null>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const card = container.querySelector<HTMLElement>("[data-query-card]");
    if (!card) return;

    const read = () => {
      const rect = container.getBoundingClientRect();
      const style = getComputedStyle(card);
      setMeasurement({
        inlineSize: round(rect.width),
        queryActive: style.getPropertyValue("--query-active").trim() === "1",
        gridTemplateColumns: style.gridTemplateColumns,
      });
    };

    read();
    const observer = new ResizeObserver(read);
    observer.observe(container);
    observer.observe(card);
    window.addEventListener("resize", read);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", read);
    };
  }, [refreshKey]);

  return [ref, measurement];
}

function useContainmentMeasurement(refreshKey: string): [RefObject<HTMLDivElement | null>, ContainmentMeasurement | null] {
  const ref = useRef<HTMLDivElement>(null);
  const [measurement, setMeasurement] = useState<ContainmentMeasurement | null>(null);

  useEffect(() => {
    const wrapper = ref.current;
    if (!wrapper) return;
    const content = wrapper.querySelector<HTMLElement>("[data-containment-content]");
    if (!content) return;

    const read = () => setMeasurement({
      wrapperInlineSize: round(wrapper.getBoundingClientRect().width),
      contentInlineSize: round(content.getBoundingClientRect().width),
    });

    read();
    const observer = new ResizeObserver(read);
    observer.observe(wrapper);
    observer.observe(content);
    window.addEventListener("resize", read);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", read);
    };
  }, [refreshKey]);

  return [ref, measurement];
}

function ExperimentHeader() {
  const experiment = experiments.find((candidate) => candidate.id === "container-queries-containment")!;
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

export function ContainerQueriesContainmentExperiment() {
  const [containerWidth, setContainerWidth] = useState(300);
  const [containment, setContainment] = useState<InlineContainmentMode>("inline-size");
  const [fallbackInlineSize, setFallbackInlineSize] = useState(180);

  const [queryRef, queryBrowser] = useQueryMeasurement(String(containerWidth));
  const queryModel = queryBrowser
    ? matchesMinInlineSize({containerInlineSize: queryBrowser.inlineSize, minimumInlineSize: QUERY_THRESHOLD})
    : null;
  const queryMatches = queryBrowser !== null && queryModel === queryBrowser.queryActive;

  const [containmentRef, containmentBrowser] = useContainmentMeasurement(`${containment}:${fallbackInlineSize}`);
  const containmentModel = containmentBrowser
    ? resolveIntrinsicInlineContribution({
        contentInlineSize: containmentBrowser.contentInlineSize,
        containment,
        fallbackInlineSize,
      })
    : null;
  const containmentMatches = containmentBrowser !== null && containmentModel !== null
    && Math.abs(containmentBrowser.wrapperInlineSize - containmentModel) <= 1;

  const containmentStyle = {
    "--contain-fallback": `${fallbackInlineSize}px`,
  } as CSSProperties;

  return (
    <div className="sizing-depth-shell container-queries-shell">
      <section className="experiment" id="container-queries-containment">
        <ExperimentHeader />
        <div className="experiment-grid">
          <div className="controls-panel">
            <RangeField label="query container width" value={containerWidth} min={240} max={440} unit="px" onChange={setContainerWidth} />
            <SelectField
              label="containment"
              value={containment}
              options={["none", "inline-size"]}
              onChange={(value) => setContainment(value as InlineContainmentMode)}
            />
            <RangeField label="intrinsic fallback" value={fallbackInlineSize} min={120} max={280} unit="px" onChange={setFallbackInlineSize} />
            <RuleList rules={[
              "container-type: inline-size;",
              "container-name: lab-card;",
              `@container lab-card (min-width: ${QUERY_THRESHOLD}px) { … }`,
              `contain: ${containment};`,
              `contain-intrinsic-inline-size: ${fallbackInlineSize}px;`,
            ]} />
          </div>

          <div className="container-queries-demos">
            <div className="trace-panel">
              <div className="trace-heading">
                <div>
                  <strong>Named inline-size query container</strong>
                  <span>the child layout switches only when the browser matches the named container threshold</span>
                </div>
                <code>min-width: {QUERY_THRESHOLD}px</code>
              </div>
              <div className="trace-metrics">
                <TraceMetric label="measured inline size" value={formatPx(queryBrowser?.inlineSize ?? null)} />
                <TraceMetric label="model match" value={queryModel === null ? "—" : queryModel ? "yes" : "no"} />
                <TraceMetric label="browser match" value={queryBrowser ? `${queryBrowser.queryActive ? "yes" : "no"}${queryMatches ? " ✓" : ""}` : "—"} />
                <TraceMetric label="computed tracks" value={queryBrowser?.gridTemplateColumns ?? "—"} />
              </div>
              <div className="container-query-stage">
                <div ref={queryRef} className="container-query-box" style={{width: containerWidth}}>
                  <div className="container-query-card" data-query-card>
                    <div>primary</div>
                    <div>secondary</div>
                  </div>
                </div>
              </div>
              <p className="trace-note">
                The deterministic helper evaluates only the measured numeric threshold. Container selection, query evaluation, style invalidation, query units, style queries, and nested-container rules stay browser-owned.
              </p>
            </div>

            <div className="trace-panel">
              <div className="trace-heading">
                <div>
                  <strong>Intrinsic inline-size containment</strong>
                  <span>inline-size containment replaces descendant-driven intrinsic width with the explicit intrinsic fallback</span>
                </div>
                <code>contain: {containment}</code>
              </div>
              <div className="trace-metrics">
                <TraceMetric label="child inline size" value={formatPx(containmentBrowser?.contentInlineSize ?? null)} />
                <TraceMetric label="model contribution" value={formatPx(containmentModel)} />
                <TraceMetric label="browser wrapper" value={`${formatPx(containmentBrowser?.wrapperInlineSize ?? null)}${containmentMatches ? " ✓" : ""}`} />
                <TraceMetric label="intrinsic fallback" value={formatPx(fallbackInlineSize)} />
              </div>
              <div className="containment-stage">
                <div
                  ref={containmentRef}
                  className={`containment-probe${containment === "inline-size" ? " is-contained" : ""}`}
                  style={containmentStyle}
                >
                  <div className="containment-content" data-containment-content style={{width: CONTENT_INLINE_SIZE}}>
                    {CONTENT_INLINE_SIZE}px descendant
                  </div>
                </div>
              </div>
              <p className="trace-note">
                Scope: one inline-block intrinsic-width probe using `contain: inline-size` and an explicit `contain-intrinsic-inline-size`. Full size/layout/style/paint containment, skipped-content behavior, and intrinsic sizing interactions remain browser-owned.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
