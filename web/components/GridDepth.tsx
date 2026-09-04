"use client";

import {CSSProperties, RefObject, useEffect, useRef, useState} from "react";
import {resolveAutoRepeat, type AutoRepeatMode} from "@/lib/grid-auto-repeat";
import {resolveMinMaxFractionTracks} from "@/lib/layout-analysis";
import {experiments} from "@/lib/experiments";

type GridMeasurement = {
  innerWidth: number;
  template: string;
  trackSizes: number[];
  boxes: {label: string; width: number}[];
};

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function formatPx(value: number) {
  return `${round(value)}px`;
}

function parseTrackSizes(template: string) {
  const values: number[] = [];
  for (const match of template.matchAll(/(-?\d+(?:\.\d+)?)px/g)) {
    const value = Number(match[1]);
    if (Number.isFinite(value)) values.push(value);
  }
  return values;
}

function useGridMeasurement<T extends HTMLElement>(refreshKey: string): [RefObject<T | null>, GridMeasurement] {
  const ref = useRef<T>(null);
  const [measurement, setMeasurement] = useState<GridMeasurement>({innerWidth: 0, template: "", trackSizes: [], boxes: []});

  useEffect(() => {
    const grid = ref.current;
    if (!grid) return;

    const read = () => {
      const computed = getComputedStyle(grid);
      const horizontalPadding = parseFloat(computed.paddingLeft) + parseFloat(computed.paddingRight);
      const template = computed.gridTemplateColumns;
      setMeasurement({
        innerWidth: round(Math.max(0, grid.clientWidth - horizontalPadding)),
        template,
        trackSizes: parseTrackSizes(template),
        boxes: Array.from(grid.querySelectorAll<HTMLElement>("[data-grid-depth]")).map((element, index) => ({
          label: element.dataset.gridDepth ?? `item ${index + 1}`,
          width: round(element.getBoundingClientRect().width),
        })),
      });
    };

    read();
    const observer = new ResizeObserver(read);
    observer.observe(grid);
    grid.querySelectorAll<HTMLElement>("[data-grid-depth]").forEach((item) => observer.observe(item));
    window.addEventListener("resize", read);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", read);
    };
  }, [refreshKey]);

  return [ref, measurement];
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

function RangeField({label, value, min, max, step = 1, unit = "", onChange}: {
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

export function GridIntrinsicExperiment() {
  const [frameWidth, setFrameWidth] = useState(480);
  const [gap, setGap] = useState(16);
  const [wrapMode, setWrapMode] = useState("normal");
  const text = "layoutalgorithmvisualizer preserves intrinsic constraints";
  const contentStyle: CSSProperties = {overflowWrap: wrapMode as CSSProperties["overflowWrap"]};
  const [probeRef, minContent] = useMeasuredWidth<HTMLDivElement>(wrapMode);
  const [gridRef, measurement] = useGridMeasurement<HTMLDivElement>(`${frameWidth}:${gap}:${wrapMode}`);
  const resolution = resolveMinMaxFractionTracks({
    innerSize: measurement.innerWidth,
    gapSize: gap,
    tracks: [
      {label: "1", minSize: minContent, fr: 1},
      {label: "2", minSize: 80, fr: 1},
    ],
  });
  const template = "minmax(min-content, 1fr) minmax(80px, 1fr)";

  return (
    <section className="experiment" id="grid-intrinsic">
      <ExperimentHeader id="grid-intrinsic" />
      <div className="experiment-grid">
        <div className="controls-panel">
          <RangeField label="grid width" value={frameWidth} min={280} max={700} step={10} unit="px" onChange={setFrameWidth} />
          <RangeField label="gap" value={gap} min={0} max={32} unit="px" onChange={setGap} />
          <SelectField label="overflow-wrap" value={wrapMode} options={["normal", "anywhere"]} onChange={setWrapMode} />
          <RuleList rules={[
            `width: ${frameWidth}px;`,
            `grid-template-columns: ${template};`,
            `gap: ${gap}px;`,
            `.content { overflow-wrap: ${wrapMode}; }`,
          ]} />
        </div>
        <div>
          <div className="intrinsic-probe-strip">
            <span>browser min-content probe</span>
            <div ref={probeRef} className="intrinsic-grid-content probe" style={{...contentStyle, width: "min-content"}}>{text}</div>
          </div>
          <div
            ref={gridRef}
            className="demo-stage intrinsic-grid-stage"
            style={{width: frameWidth, maxWidth: "100%", gap, gridTemplateColumns: template}}
          >
            <div className="intrinsic-grid-content box-a" style={contentStyle} data-grid-depth="1">{text}</div>
            <div className="intrinsic-grid-content box-b" data-grid-depth="2">flexible peer track</div>
          </div>
          <div className="trace-panel">
            <div className="trace-heading">
              <div>
                <strong>Intrinsic contribution → flexible tracks</strong>
                <span>browser supplies min-content; deterministic model resolves the next phase</span>
              </div>
              <code>min-content → 1fr</code>
            </div>
            <div className="trace-metrics">
              <TraceMetric label="browser min-content" value={formatPx(minContent)} />
              <TraceMetric label="track space" value={formatPx(resolution.availableForTracks)} />
              <TraceMetric label="flex fraction" value={formatPx(resolution.flexFraction)} />
              <TraceMetric label="overflow" value={formatPx(resolution.overflow)} />
            </div>
            <div className="trace-table-wrap">
              <table className="trace-table depth-table">
                <thead><tr><th>track</th><th>minimum source</th><th>base</th><th>model</th><th>browser</th></tr></thead>
                <tbody>
                  {resolution.tracks.map((track) => {
                    const measured = measurement.boxes.find((box) => box.label === track.label)?.width;
                    const matches = measured !== undefined && Math.abs(measured - track.targetSize) <= 1.5;
                    return (
                      <tr key={track.label}>
                        <td>{track.label}</td>
                        <td>{track.label === "1" ? "measured min-content" : "80px"}</td>
                        <td>{formatPx(track.baseSize)}</td>
                        <td>{formatPx(track.targetSize)}</td>
                        <td>{measured === undefined ? "—" : `${formatPx(measured)}${matches ? " ✓" : ""}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="trace-note">
              Text measurement stays with the browser. The deterministic layer begins only after that intrinsic contribution is known, which keeps ownership honest while still making the track-sizing consequence visible.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function GridAutoRepeatExperiment() {
  const [frameWidth, setFrameWidth] = useState(620);
  const [gap, setGap] = useState(14);
  const [minimum, setMinimum] = useState(140);
  const [itemCount, setItemCount] = useState(3);
  const [mode, setMode] = useState<AutoRepeatMode>("auto-fit");
  const refreshKey = `${frameWidth}:${gap}:${minimum}:${itemCount}:${mode}`;
  const [gridRef, measurement] = useGridMeasurement<HTMLDivElement>(refreshKey);
  const resolution = resolveAutoRepeat({
    innerSize: measurement.innerWidth,
    gapSize: gap,
    minTrackSize: minimum,
    itemCount,
    mode,
  });
  const template = `repeat(${mode}, minmax(${minimum}px, 1fr))`;
  const visibleBrowserTracks = measurement.trackSizes.filter((size) => size > 0.5);
  const collapsedBrowserTracks = measurement.trackSizes.filter((size) => size <= 0.5).length;
  const labels = ["A", "B", "C", "D", "E", "F", "G", "H"];

  return (
    <section className="experiment" id="grid-auto-repeat">
      <ExperimentHeader id="grid-auto-repeat" />
      <div className="experiment-grid">
        <div className="controls-panel">
          <RangeField label="grid width" value={frameWidth} min={280} max={760} step={10} unit="px" onChange={setFrameWidth} />
          <RangeField label="minimum track" value={minimum} min={90} max={210} step={10} unit="px" onChange={setMinimum} />
          <RangeField label="gap" value={gap} min={0} max={30} unit="px" onChange={setGap} />
          <RangeField label="items" value={itemCount} min={0} max={8} onChange={setItemCount} />
          <SelectField label="repeat mode" value={mode} options={["auto-fit", "auto-fill"]} onChange={(value) => setMode(value as AutoRepeatMode)} />
          <RuleList rules={[
            `width: ${frameWidth}px;`,
            `grid-template-columns: ${template};`,
            `gap: ${gap}px;`,
          ]} />
        </div>
        <div>
          <div
            ref={gridRef}
            className="demo-stage auto-repeat-stage"
            style={{width: frameWidth, maxWidth: "100%", gap, gridTemplateColumns: template}}
          >
            {Array.from({length: itemCount}, (_, index) => (
              <div className={`demo-box box-${["a", "b", "c", "d", "e"][index % 5]}`} data-grid-depth={labels[index]} key={index}>
                {labels[index]}
              </div>
            ))}
          </div>
          <div className="trace-panel">
            <div className="trace-heading">
              <div>
                <strong>Auto-repeat capacity trace</strong>
                <span>how many minimum tracks fit, then what happens to empty tracks</span>
              </div>
              <code>{mode}</code>
            </div>
            <div className="trace-metrics">
              <TraceMetric label="explicit capacity" value={String(resolution.explicitTrackCount)} />
              <TraceMetric label="occupied" value={String(resolution.occupiedTrackCount)} />
              <TraceMetric label={mode === "auto-fit" ? "collapsed" : "empty"} value={String(mode === "auto-fit" ? resolution.collapsedTrackCount : resolution.emptyTrackCount)} />
              <TraceMetric label="model track size" value={formatPx(resolution.trackSize)} />
            </div>
            <div className="phase-list">
              <div className="phase-row">
                <strong>capacity</strong>
                <span>floor((width + gap) / (min + gap))</span>
                <span>{resolution.explicitTrackCount} explicit track{resolution.explicitTrackCount === 1 ? "" : "s"}</span>
              </div>
              <div className="phase-row">
                <strong>empty tracks</strong>
                <span>{mode}</span>
                <span>{mode === "auto-fit" ? "collapse before free-space distribution" : "remain in the explicit grid and keep their share"}</span>
              </div>
            </div>
            <p className="trace-formula">
              browser template: <strong>{measurement.template || "—"}</strong>
            </p>
            <p className="trace-note">
              Browser observation: {measurement.trackSizes.length || 0} explicit computed track entries, {visibleBrowserTracks.length} non-zero, {collapsedBrowserTracks} collapsed. The deterministic model intentionally stops at the auto-repeat sizing arithmetic and leaves placement edge cases to the browser.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function GridDepth() {
  return (
    <div className="grid-depth-shell">
      <GridIntrinsicExperiment />
      <GridAutoRepeatExperiment />
    </div>
  );
}
