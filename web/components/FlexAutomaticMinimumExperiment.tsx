"use client";

import {PrecisionRange as RangeField} from "./PrecisionRange";
import {CSSProperties, RefObject, useEffect, useRef, useState} from "react";
import {resolveFlexMinimumFloor, type FlexMinimumMode} from "@/lib/flex-auto-minimum";
import {resolveFlexLine, type FlexItemInput} from "@/lib/layout-analysis";
import {experiments} from "@/lib/experiments";

type MeasuredBox = {
  label: string;
  width: number;
};

type StageMetrics = {
  innerWidth: number;
};

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function formatPx(value: number) {
  return `${round(value)}px`;
}

function useMeasuredWidth<T extends HTMLElement>(refreshKey: string): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const read = () => setWidth(round(element.getBoundingClientRect().width));
    read();
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, [refreshKey]);

  return [ref, width];
}

function useMeasuredStage<T extends HTMLElement>(refreshKey: string): [RefObject<T | null>, MeasuredBox[], StageMetrics] {
  const ref = useRef<T>(null);
  const [boxes, setBoxes] = useState<MeasuredBox[]>([]);
  const [metrics, setMetrics] = useState<StageMetrics>({innerWidth: 0});

  useEffect(() => {
    const stage = ref.current;
    if (!stage) return;

    const read = () => {
      const computed = getComputedStyle(stage);
      const horizontalPadding = parseFloat(computed.paddingLeft) + parseFloat(computed.paddingRight);
      setMetrics({innerWidth: round(Math.max(0, stage.clientWidth - horizontalPadding))});
      setBoxes(Array.from(stage.querySelectorAll<HTMLElement>("[data-flex-auto-item]")).map((element, index) => ({
        label: element.dataset.flexAutoItem ?? `item ${index + 1}`,
        width: round(element.getBoundingClientRect().width),
      })));
    };

    read();
    const observer = new ResizeObserver(read);
    observer.observe(stage);
    stage.querySelectorAll<HTMLElement>("[data-flex-auto-item]").forEach((item) => observer.observe(item));
    window.addEventListener("resize", read);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", read);
    };
  }, [refreshKey]);

  return [ref, boxes, metrics];
}

function ExperimentHeader() {
  const experiment = experiments.find((candidate) => candidate.id === "flex-auto-minimum")!;
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

export function FlexAutomaticMinimumExperiment() {
  const [frameWidth, setFrameWidth] = useState(400);
  const [gap, setGap] = useState(12);
  const [minimumMode, setMinimumMode] = useState<FlexMinimumMode>("auto");
  const [wrapMode, setWrapMode] = useState("normal");
  const text = "layoutalgorithmvisualizerboundary";
  const contentStyle: CSSProperties = {overflowWrap: wrapMode as CSSProperties["overflowWrap"]};
  const [probeRef, minContent] = useMeasuredWidth<HTMLDivElement>(wrapMode);
  const refreshKey = `${frameWidth}:${gap}:${minimumMode}:${wrapMode}`;
  const [stageRef, boxes, metrics] = useMeasuredStage<HTMLDivElement>(refreshKey);
  const minimum = resolveFlexMinimumFloor({mode: minimumMode, minContentSize: minContent});
  const items: readonly FlexItemInput[] = [
    {label: "A", basis: 110, grow: 0, shrink: 1, minSize: 0},
    {label: "B", basis: 280, grow: 0, shrink: 1, minSize: minimum.minimum},
    {label: "C", basis: 90, grow: 0, shrink: 1, minSize: 0},
  ];
  const resolution = resolveFlexLine({innerSize: metrics.innerWidth, gapSize: gap, items});
  const flexStyle = (item: FlexItemInput): CSSProperties => ({
    flex: `${item.grow} ${item.shrink} ${item.basis}px`,
    minWidth: item.label === "B" ? (minimumMode === "auto" ? "auto" : 0) : 0,
  });

  return (
    <div className="sizing-depth-shell">
      <section className="experiment" id="flex-auto-minimum">
        <ExperimentHeader />
        <div className="experiment-grid">
          <div className="controls-panel">
            <RangeField label="line width" value={frameWidth} min={300} max={680} step={10} unit="px" onChange={setFrameWidth} />
            <RangeField label="gap" value={gap} min={0} max={28} unit="px" onChange={setGap} />
            <SelectField label="B min-width" value={minimumMode} options={["auto", "zero"]} onChange={(value) => setMinimumMode(value as FlexMinimumMode)} />
            <SelectField label="overflow-wrap" value={wrapMode} options={["normal", "anywhere"]} onChange={setWrapMode} />
            <RuleList rules={[
              `width: ${frameWidth}px;`,
              `gap: ${gap}px;`,
              ".A { flex: 0 1 110px; min-width: 0; }",
              `.B { flex: 0 1 280px; min-width: ${minimumMode === "auto" ? "auto" : "0"}; overflow-wrap: ${wrapMode}; }`,
              ".C { flex: 0 1 90px; min-width: 0; }",
            ]} />
          </div>
          <div>
            <div className="flex-auto-probe-strip">
              <span>browser min-content probe</span>
              <div
                ref={probeRef}
                className="demo-box box-b flex-auto-content flex-auto-probe"
                style={{...contentStyle, width: "min-content"}}
              >
                {text}
              </div>
            </div>

            <div
              ref={stageRef}
              className="demo-stage flex-stage depth-flex-stage flex-auto-stage"
              style={{width: frameWidth, maxWidth: "100%", gap}}
            >
              <div className="demo-box box-a" style={flexStyle(items[0]!)} data-flex-auto-item="A">A</div>
              <div
                className="demo-box box-b flex-auto-content"
                style={{...flexStyle(items[1]!), ...contentStyle}}
                data-flex-auto-item="B"
              >
                {text}
              </div>
              <div className="demo-box box-c" style={flexStyle(items[2]!)} data-flex-auto-item="C">C</div>
            </div>

            <div className="trace-panel">
              <div className="trace-heading">
                <div>
                  <strong>Automatic minimum → flex shrink</strong>
                  <span>browser supplies min-content; the deterministic solver applies that floor during redistribution</span>
                </div>
                <code>min-width: {minimumMode === "auto" ? "auto" : "0"}</code>
              </div>
              <div className="trace-metrics">
                <TraceMetric label="browser min-content" value={formatPx(minimum.measuredMinContent)} />
                <TraceMetric label="B minimum used" value={formatPx(minimum.minimum)} />
                <TraceMetric label="initial free space" value={formatPx(resolution.freeSpace)} />
                <TraceMetric label="final free space" value={formatPx(resolution.finalFreeSpace)} />
              </div>
              <div className="phase-list" aria-label="Automatic minimum phases">
                <div className="phase-row">
                  <strong>1 · measure</strong>
                  <span>{formatPx(minimum.measuredMinContent)}</span>
                  <span>browser measures B at min-content with the same wrapping rule</span>
                </div>
                <div className="phase-row">
                  <strong>2 · choose floor</strong>
                  <span>{minimum.source}</span>
                  <span>{minimumMode === "auto" ? "non-scroll automatic minimum uses the measured content floor in this scoped case" : "explicit zero removes the intrinsic floor"}</span>
                </div>
                <div className="phase-row">
                  <strong>3 · shrink</strong>
                  <span>{resolution.iterations.length} pass{resolution.iterations.length === 1 ? "" : "es"}</span>
                  <span>scaled flex-shrink redistributes remaining negative free space after any clamp</span>
                </div>
              </div>
              <div className="trace-table-wrap">
                <table className="trace-table depth-table">
                  <thead><tr><th>item</th><th>basis</th><th>minimum</th><th>model</th><th>state</th><th>browser</th></tr></thead>
                  <tbody>
                    {resolution.items.map((item) => {
                      const measured = boxes.find((box) => box.label === item.label)?.width;
                      const matches = measured !== undefined && Math.abs(measured - item.targetSize) <= 1.5;
                      return (
                        <tr key={item.label}>
                          <td>{item.label}</td>
                          <td>{formatPx(item.basis)}</td>
                          <td>{item.label === "B" ? `${minimum.source} · ${formatPx(item.minSize)}` : "0px"}</td>
                          <td>{formatPx(item.targetSize)}</td>
                          <td>{item.clamp ? `freeze ${item.clamp}` : "flex"}</td>
                          <td>{measured === undefined ? "—" : `${formatPx(measured)}${matches ? " ✓" : ""}`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="trace-note">
                Scope: one row flex line, definite flex bases, a non-scroll B item, no specified main-size suggestion, no aspect-ratio transfer, and no replaced elements. Intrinsic text measurement stays browser-owned; the deterministic model starts from that measured evidence.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
