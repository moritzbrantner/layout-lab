"use client";

import {CSSProperties, RefObject, useEffect, useRef, useState} from "react";
import {
  resolveFlexLine,
  resolveMinMaxFractionTracks,
  type FlexItemInput,
  type GridTrackInput,
} from "@/lib/layout-analysis";
import {experiments} from "@/lib/experiments";

type MeasuredBox = {
  label: string;
  width: number;
  height: number;
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
      setBoxes(
        Array.from(stage.querySelectorAll<HTMLElement>("[data-depth-item]")).map((element, index) => {
          const rect = element.getBoundingClientRect();
          return {
            label: element.dataset.depthItem ?? `item ${index + 1}`,
            width: round(rect.width),
            height: round(rect.height),
          };
        }),
      );
    };

    read();
    const observer = new ResizeObserver(read);
    observer.observe(stage);
    stage.querySelectorAll<HTMLElement>("[data-depth-item]").forEach((item) => observer.observe(item));
    window.addEventListener("resize", read);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", read);
    };
  }, [refreshKey]);

  return [ref, boxes, metrics];
}

function ExperimentHeader({id}: {id: (typeof experiments)[number]["id"]}) {
  const experiment = experiments.find((candidate) => candidate.id === id)!;
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

function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="control range-control">
      <span>{label}</span>
      <output>{value}{unit}</output>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ToggleField({label, checked, onChange}: {label: string; checked: boolean; onChange: (value: boolean) => void}) {
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

function bounds(item: FlexItemInput) {
  const min = item.minSize ?? 0;
  const max = item.maxSize ?? Number.POSITIVE_INFINITY;
  return `${formatPx(min)}…${Number.isFinite(max) ? formatPx(max) : "∞"}`;
}

export function FlexFreezingExperiment() {
  const [frameWidth, setFrameWidth] = useState(620);
  const [gap, setGap] = useState(16);
  const [constraints, setConstraints] = useState(true);
  const refreshKey = `${frameWidth}:${gap}:${constraints}`;
  const [stageRef, boxes, metrics] = useMeasuredStage<HTMLDivElement>(refreshKey);
  const items: readonly FlexItemInput[] = [
    {label: "A", basis: 110, grow: 1, shrink: 1, minSize: constraints ? 70 : 0},
    {label: "B", basis: 120, grow: 1, shrink: 1, maxSize: constraints ? 150 : undefined},
    {label: "C", basis: 100, grow: 2, shrink: 1, minSize: constraints ? 120 : 0},
  ];
  const resolution = resolveFlexLine({innerSize: metrics.innerWidth, gapSize: gap, items});

  const itemStyle = (item: FlexItemInput): CSSProperties => ({
    flex: `${item.grow} ${item.shrink} ${item.basis}px`,
    minWidth: item.minSize ?? 0,
    maxWidth: item.maxSize,
  });

  return (
    <section className="experiment" id="flex-freezing">
      <ExperimentHeader id="flex-freezing" />
      <div className="experiment-grid">
        <div className="controls-panel">
          <RangeField label="line width" value={frameWidth} min={340} max={720} step={10} unit="px" onChange={setFrameWidth} />
          <RangeField label="gap" value={gap} min={0} max={32} unit="px" onChange={setGap} />
          <ToggleField label="apply explicit min/max constraints" checked={constraints} onChange={setConstraints} />
          <RuleList rules={[
            `width: ${frameWidth}px;`,
            `gap: ${gap}px;`,
            ".A { flex: 1 1 110px; min-width: 70px; }",
            ".B { flex: 1 1 120px; max-width: 150px; }",
            ".C { flex: 2 1 100px; min-width: 120px; }",
          ]} />
        </div>
        <div>
          <div
            ref={stageRef}
            className="demo-stage flex-stage depth-flex-stage"
            style={{width: frameWidth, maxWidth: "100%", gap}}
          >
            <div className="demo-box box-a" style={itemStyle(items[0]!)} data-depth-item="A">A <small>110px</small></div>
            <div className="demo-box box-b" style={itemStyle(items[1]!)} data-depth-item="B">B <small>{constraints ? "max 150" : "open"}</small></div>
            <div className="demo-box box-c" style={itemStyle(items[2]!)} data-depth-item="C">C <small>{constraints ? "min 120" : "open"}</small></div>
          </div>

          <div className="trace-panel">
            <div className="trace-heading">
              <div>
                <strong>Freeze / redistribute trace</strong>
                <span>definite bases + explicit min/max bounds</span>
              </div>
              <code>{resolution.mode} · {resolution.iterations.length} pass{resolution.iterations.length === 1 ? "" : "es"}</code>
            </div>
            <div className="trace-metrics">
              <TraceMetric label="initial free space" value={formatPx(resolution.freeSpace)} />
              <TraceMetric label="final free space" value={formatPx(resolution.finalFreeSpace)} />
              <TraceMetric label="frozen items" value={String(resolution.frozenCount)} />
              <TraceMetric label="inner line" value={formatPx(resolution.innerSize)} />
            </div>
            {resolution.iterations.length > 0 ? (
              <div className="phase-list" aria-label="Flex resolution passes">
                {resolution.iterations.map((iteration) => (
                  <div className="phase-row" key={iteration.iteration}>
                    <strong>pass {iteration.iteration}</strong>
                    <span>free {formatPx(iteration.freeSpace)}</span>
                    <span>{iteration.newlyFrozen.length ? `freeze ${iteration.newlyFrozen.join(", ")}` : "settle remaining items"}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="trace-table-wrap">
              <table className="trace-table depth-table">
                <thead><tr><th>item</th><th>basis</th><th>bounds</th><th>delta</th><th>model</th><th>state</th><th>browser</th></tr></thead>
                <tbody>
                  {resolution.items.map((item) => {
                    const measured = boxes.find((box) => box.label === item.label)?.width;
                    const matches = measured !== undefined && Math.abs(measured - item.targetSize) <= 1.5;
                    return (
                      <tr key={item.label}>
                        <td>{item.label}</td>
                        <td>{formatPx(item.basis)}</td>
                        <td>{bounds(item)}</td>
                        <td>{formatPx(item.delta)}</td>
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
              This is a deliberately bounded subset of Flexbox: one line, definite flex bases, and explicit numeric min/max constraints. It now models repeated freezing and redistribution, while `auto` minimums and intrinsic flex bases remain browser-owned evidence.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function GridTrackSizingExperiment() {
  const [frameWidth, setFrameWidth] = useState(460);
  const [gap, setGap] = useState(14);
  const [spanMinimum, setSpanMinimum] = useState(300);
  const [spanEnabled, setSpanEnabled] = useState(true);
  const refreshKey = `${frameWidth}:${gap}:${spanMinimum}:${spanEnabled}`;
  const [stageRef, boxes, metrics] = useMeasuredStage<HTMLDivElement>(refreshKey);
  const tracks: readonly GridTrackInput[] = [
    {label: "1", minSize: 80, fr: 1},
    {label: "2", minSize: 120, fr: 1},
    {label: "3", minSize: 80, fr: 1},
  ];
  const contributions = spanEnabled
    ? [{label: "span 1–2", start: 0, span: 2, minSize: spanMinimum}] as const
    : [];
  const resolution = resolveMinMaxFractionTracks({innerSize: metrics.innerWidth, gapSize: gap, tracks, contributions});
  const columns = "minmax(80px, 1fr) minmax(120px, 1fr) minmax(80px, 1fr)";
  const spanStep = resolution.contributionSteps[0];

  return (
    <section className="experiment" id="grid-track-sizing">
      <ExperimentHeader id="grid-track-sizing" />
      <div className="experiment-grid">
        <div className="controls-panel">
          <RangeField label="grid width" value={frameWidth} min={340} max={720} step={10} unit="px" onChange={setFrameWidth} />
          <RangeField label="gap" value={gap} min={0} max={30} unit="px" onChange={setGap} />
          <RangeField label="span minimum" value={spanMinimum} min={180} max={440} step={10} unit="px" onChange={setSpanMinimum} />
          <ToggleField label="apply spanning minimum" checked={spanEnabled} onChange={setSpanEnabled} />
          <RuleList rules={[
            `width: ${frameWidth}px;`,
            `grid-template-columns: ${columns};`,
            `gap: ${gap}px;`,
            `.span { grid-column: 1 / span 2; min-width: ${spanEnabled ? spanMinimum : 0}px; }`,
          ]} />
        </div>
        <div>
          <div
            ref={stageRef}
            className="demo-stage depth-grid-stage"
            style={{width: frameWidth, maxWidth: "100%", gap, gridTemplateColumns: columns}}
          >
            <div className="demo-box box-a" style={{gridColumn: 1, gridRow: 1}} data-depth-item="1">1 <small>min 80</small></div>
            <div className="demo-box box-b" style={{gridColumn: 2, gridRow: 1}} data-depth-item="2">2 <small>min 120</small></div>
            <div className="demo-box box-c" style={{gridColumn: 3, gridRow: 1}} data-depth-item="3">3 <small>min 80</small></div>
            <div
              className="span-contribution"
              style={{gridColumn: "1 / span 2", gridRow: 2, minWidth: spanEnabled ? spanMinimum : 0}}
              data-depth-item="span"
            >
              spanning item · min {spanEnabled ? spanMinimum : 0}px
            </div>
          </div>

          <div className="trace-panel">
            <div className="trace-heading">
              <div>
                <strong>Grid track phases</strong>
                <span>minimum bases → span contribution → flex fraction</span>
              </div>
              <code>minmax(min, 1fr)</code>
            </div>
            <div className="trace-metrics">
              <TraceMetric label="for tracks" value={formatPx(resolution.availableForTracks)} />
              <TraceMetric label="base total" value={formatPx(resolution.baseTotal)} />
              <TraceMetric label="flex fraction" value={formatPx(resolution.flexFraction)} />
              <TraceMetric label="overflow" value={formatPx(resolution.overflow)} />
            </div>
            <div className="phase-list" aria-label="Grid sizing phases">
              <div className="phase-row">
                <strong>1 · initialize</strong>
                <span>80 / 120 / 80px</span>
                <span>track minimums become base sizes</span>
              </div>
              <div className="phase-row">
                <strong>2 · spanning item</strong>
                <span>{spanStep ? `+${formatPx(spanStep.deficit)}` : "no contribution"}</span>
                <span>{spanStep ? `bases ${spanStep.after.map(formatPx).join(" / ")}` : "bases unchanged"}</span>
              </div>
              <div className="phase-row">
                <strong>3 · resolve 1fr</strong>
                <span>{formatPx(resolution.flexFraction)}</span>
                <span>tracks above the candidate fraction freeze at their base</span>
              </div>
            </div>
            <div className="trace-table-wrap">
              <table className="trace-table depth-table">
                <thead><tr><th>track</th><th>minimum</th><th>base</th><th>model</th><th>state</th><th>browser</th></tr></thead>
                <tbody>
                  {resolution.tracks.map((track) => {
                    const measured = boxes.find((box) => box.label === track.label)?.width;
                    const delta = measured === undefined ? null : measured - track.targetSize;
                    const matches = delta !== null && Math.abs(delta) <= 1.5;
                    return (
                      <tr key={track.label}>
                        <td>{track.label}</td>
                        <td>{formatPx(track.minSize)}</td>
                        <td>{formatPx(track.baseSize)}</td>
                        <td>{formatPx(track.targetSize)}</td>
                        <td>{track.frozen ? "base frozen" : "flex"}</td>
                        <td>{measured === undefined ? "—" : `${formatPx(measured)}${matches ? " ✓" : ` · Δ ${formatPx(delta!)}`}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="trace-note">
              The spanning minimum is an explicit teaching input, not a claim to reproduce every intrinsic Grid contribution rule. The model captures the ordering that matters: establish bases, grow them for a span, then find an `fr` size while freezing tracks whose bases are already larger.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SizingDepth() {
  return (
    <div className="sizing-depth-shell">
      <FlexFreezingExperiment />
      <GridTrackSizingExperiment />
    </div>
  );
}
