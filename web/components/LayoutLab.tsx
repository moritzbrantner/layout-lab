"use client";

import {CSSProperties, RefObject, useEffect, useRef, useState} from "react";
import {
  resolveEqualFractionTracks,
  resolveFitContentSize,
  resolveFlexLine,
  type FlexItemInput,
} from "@/lib/layout-analysis";
import {experiments} from "@/lib/experiments";

type Geometry = {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type ContainerMetrics = {
  innerWidth: number;
  innerHeight: number;
};

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function formatPx(value: number) {
  return `${round(value)}px`;
}

function useLayoutMeasurement<T extends HTMLElement>(
  refreshKey: string,
): [RefObject<T | null>, Geometry[], ContainerMetrics] {
  const ref = useRef<T>(null);
  const [geometry, setGeometry] = useState<Geometry[]>([]);
  const [metrics, setMetrics] = useState<ContainerMetrics>({innerWidth: 0, innerHeight: 0});

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const read = () => {
      const containerRect = container.getBoundingClientRect();
      const computed = getComputedStyle(container);
      const horizontalPadding = parseFloat(computed.paddingLeft) + parseFloat(computed.paddingRight);
      const verticalPadding = parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom);
      setMetrics({
        innerWidth: round(Math.max(0, container.clientWidth - horizontalPadding)),
        innerHeight: round(Math.max(0, container.clientHeight - verticalPadding)),
      });

      const next = Array.from(container.querySelectorAll<HTMLElement>("[data-geometry-item]")).map(
        (element, index) => {
          const rect = element.getBoundingClientRect();
          return {
            label: element.dataset.geometryItem ?? `item ${index + 1}`,
            x: round(rect.left - containerRect.left),
            y: round(rect.top - containerRect.top),
            width: round(rect.width),
            height: round(rect.height),
          };
        },
      );
      setGeometry(next);
    };

    read();
    const observer = new ResizeObserver(read);
    observer.observe(container);
    container.querySelectorAll<HTMLElement>("[data-geometry-item]").forEach((item) => observer.observe(item));
    window.addEventListener("resize", read);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", read);
    };
  }, [refreshKey]);

  return [ref, geometry, metrics];
}

function GeometryTable({geometry}: {geometry: Geometry[]}) {
  return (
    <div className="geometry-wrap">
      <div className="geometry-heading">
        <strong>Measured geometry</strong>
        <span>browser output, relative to the demo container</span>
      </div>
      <div className="geometry-table-wrap">
        <table className="geometry-table">
          <thead>
            <tr>
              <th>box</th>
              <th>x</th>
              <th>y</th>
              <th>w</th>
              <th>h</th>
            </tr>
          </thead>
          <tbody>
            {geometry.map((item) => (
              <tr key={item.label}>
                <td>{item.label}</td>
                <td>{item.x}</td>
                <td>{item.y}</td>
                <td>{item.width}</td>
                <td>{item.height}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RuleList({rules}: {rules: readonly string[]}) {
  return (
    <pre className="rule-list" aria-label="Active CSS rules">
      {rules.join("\n")}
    </pre>
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
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
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

function TraceMetric({label, value}: {label: string; value: string}) {
  return (
    <div className="trace-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FlexTrace({
  direction,
  gap,
  items,
  metrics,
  geometry,
}: {
  direction: string;
  gap: number;
  items: readonly FlexItemInput[];
  metrics: ContainerMetrics;
  geometry: Geometry[];
}) {
  const isRow = direction.startsWith("row");
  const mainSize = isRow ? metrics.innerWidth : metrics.innerHeight;
  const resolution = resolveFlexLine({innerSize: mainSize, gapSize: gap, items});

  return (
    <div className="trace-panel">
      <div className="trace-heading">
        <div>
          <strong>Flex sizing trace</strong>
          <span>single-line free-space model</span>
        </div>
        <code>{resolution.mode}</code>
      </div>
      <div className="trace-metrics">
        <TraceMetric label="inner main size" value={formatPx(resolution.innerSize)} />
        <TraceMetric label="basis total" value={formatPx(resolution.totalBasis)} />
        <TraceMetric label="gaps" value={formatPx(resolution.totalGap)} />
        <TraceMetric label="free space" value={formatPx(resolution.freeSpace)} />
      </div>
      <div className="trace-table-wrap">
        <table className="trace-table">
          <thead>
            <tr><th>item</th><th>basis</th><th>factor</th><th>delta</th><th>model</th><th>browser</th></tr>
          </thead>
          <tbody>
            {resolution.items.map((item) => {
              const measured = geometry.find((candidate) => candidate.label === item.label);
              const measuredSize = measured ? (isRow ? measured.width : measured.height) : null;
              const matches = measuredSize !== null && Math.abs(measuredSize - item.targetSize) <= 1.5;
              return (
                <tr key={item.label}>
                  <td>{item.label}</td>
                  <td>{formatPx(item.basis)}</td>
                  <td>{round(item.weight)}</td>
                  <td>{formatPx(item.delta)}</td>
                  <td>{formatPx(item.targetSize)}</td>
                  <td>{measuredSize === null ? "—" : `${formatPx(measuredSize)}${matches ? " ✓" : ""}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="trace-note">
        This intentionally models one flex line before min/max freezing and intrinsic clamping. Browser geometry remains the source of truth when those constraints become relevant.
      </p>
    </div>
  );
}

function FlexExperiment() {
  const [direction, setDirection] = useState("row");
  const [justify, setJustify] = useState("space-between");
  const [align, setAlign] = useState("center");
  const [gap, setGap] = useState(16);
  const [growEnabled, setGrowEnabled] = useState(false);
  const refreshKey = `${direction}:${justify}:${align}:${gap}:${growEnabled}`;
  const [containerRef, geometry, metrics] = useLayoutMeasurement<HTMLDivElement>(refreshKey);
  const items: readonly FlexItemInput[] = [
    {label: "A", basis: 72, grow: 0, shrink: 1},
    {label: "B", basis: 120, grow: growEnabled ? 1 : 0, shrink: 1},
    {label: "C", basis: 96, grow: growEnabled ? 2 : 0, shrink: 1},
  ];

  const style: CSSProperties = {
    flexDirection: direction as CSSProperties["flexDirection"],
    justifyContent: justify,
    alignItems: align,
    gap,
  };

  const itemStyle = (item: FlexItemInput): CSSProperties => ({
    flex: `${item.grow} ${item.shrink} ${item.basis}px`,
    minWidth: 0,
    minHeight: 0,
  });

  return (
    <section className="experiment" id="flex">
      <ExperimentHeader id="flex" />
      <div className="experiment-grid">
        <div className="controls-panel">
          <SelectField label="direction" value={direction} options={["row", "row-reverse", "column", "column-reverse"]} onChange={setDirection} />
          <SelectField label="justify-content" value={justify} options={["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"]} onChange={setJustify} />
          <SelectField label="align-items" value={align} options={["stretch", "flex-start", "center", "flex-end"]} onChange={setAlign} />
          <RangeField label="gap" value={gap} min={0} max={40} unit="px" onChange={setGap} />
          <ToggleField label="enable B/C flex-grow" checked={growEnabled} onChange={setGrowEnabled} />
          <RuleList rules={[
            "display: flex;",
            `flex-direction: ${direction};`,
            `justify-content: ${justify};`,
            `align-items: ${align};`,
            `gap: ${gap}px;`,
            `.B { flex: ${items[1]?.grow} 1 120px; }`,
            `.C { flex: ${items[2]?.grow} 1 96px; }`,
          ]} />
        </div>
        <div>
          <div ref={containerRef} className="demo-stage flex-stage" style={style}>
            <div className="demo-box box-a" style={itemStyle(items[0]!)} data-geometry-item="A">A <small>72px</small></div>
            <div className="demo-box box-b" style={itemStyle(items[1]!)} data-geometry-item="B">B <small>120px</small></div>
            <div className="demo-box box-c" style={itemStyle(items[2]!)} data-geometry-item="C">C <small>96px</small></div>
          </div>
          <FlexTrace direction={direction} gap={gap} items={items} metrics={metrics} geometry={geometry} />
          <GeometryTable geometry={geometry} />
        </div>
      </div>
    </section>
  );
}

function GridTrace({columns, gap, metrics, geometry}: {columns: number; gap: number; metrics: ContainerMetrics; geometry: Geometry[]}) {
  const resolution = resolveEqualFractionTracks({innerSize: metrics.innerWidth, count: columns, gapSize: gap});
  const measuredTrack = geometry.find((item) => item.label === "B")?.width;
  const matches = measuredTrack !== undefined && Math.abs(measuredTrack - resolution.trackSize) <= 1.5;

  return (
    <div className="trace-panel">
      <div className="trace-heading">
        <div>
          <strong>Grid track trace</strong>
          <span>repeat(n, minmax(0, 1fr))</span>
        </div>
        <code>{columns} × 1fr</code>
      </div>
      <div className="trace-metrics">
        <TraceMetric label="inner inline size" value={formatPx(resolution.innerSize)} />
        <TraceMetric label="gap total" value={formatPx(resolution.totalGap)} />
        <TraceMetric label="for tracks" value={formatPx(resolution.distributableSize)} />
        <TraceMetric label="each 1fr" value={formatPx(resolution.trackSize)} />
      </div>
      <p className="trace-formula">
        ({round(resolution.innerSize)} − {round(resolution.totalGap)}) ÷ {columns} = <strong>{formatPx(resolution.trackSize)}</strong>
        {measuredTrack === undefined ? null : <> · browser B = <strong>{formatPx(measuredTrack)}{matches ? " ✓" : ""}</strong></>}
      </p>
      <p className="trace-note">
        `minmax(0, 1fr)` removes intrinsic minimums from this baseline. Content-based tracks, minmax constraints, and spanning contributions are the next Grid sizing layer.
      </p>
    </div>
  );
}

function GridExperiment() {
  const [columns, setColumns] = useState(3);
  const [gap, setGap] = useState(14);
  const [dense, setDense] = useState(false);
  const refreshKey = `${columns}:${gap}:${dense}`;
  const [containerRef, geometry, metrics] = useLayoutMeasurement<HTMLDivElement>(refreshKey);

  return (
    <section className="experiment" id="grid">
      <ExperimentHeader id="grid" />
      <div className="experiment-grid">
        <div className="controls-panel">
          <RangeField label="columns" value={columns} min={2} max={5} onChange={setColumns} />
          <RangeField label="gap" value={gap} min={0} max={32} unit="px" onChange={setGap} />
          <ToggleField label="dense auto-placement" checked={dense} onChange={setDense} />
          <RuleList rules={[
            "display: grid;",
            `grid-template-columns: repeat(${columns}, minmax(0, 1fr));`,
            `grid-auto-flow: ${dense ? "row dense" : "row"};`,
            `gap: ${gap}px;`,
            ".wide { grid-column: span 2; }",
          ]} />
        </div>
        <div>
          <div
            ref={containerRef}
            className="demo-stage grid-stage"
            style={{gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap, gridAutoFlow: dense ? "row dense" : "row"}}
          >
            <div className="demo-box box-a wide-grid-item" data-geometry-item="A">A <small>span 2</small></div>
            <div className="demo-box box-b" data-geometry-item="B">B</div>
            <div className="demo-box box-c" data-geometry-item="C">C</div>
            <div className="demo-box box-d" data-geometry-item="D">D</div>
            <div className="demo-box box-e wide-grid-item" data-geometry-item="E">E <small>span 2</small></div>
          </div>
          <GridTrace columns={columns} gap={gap} metrics={metrics} geometry={geometry} />
          <GeometryTable geometry={geometry} />
        </div>
      </div>
    </section>
  );
}

function IntrinsicTrace({geometry, metrics}: {geometry: Geometry[]; metrics: ContainerMetrics}) {
  const minimum = geometry.find((item) => item.label === "min-content")?.width;
  const maximum = geometry.find((item) => item.label === "max-content")?.width;
  const fit = geometry.find((item) => item.label === "fit-content")?.width;
  const model = minimum !== undefined && maximum !== undefined
    ? resolveFitContentSize({minContent: minimum, maxContent: maximum, available: metrics.innerWidth})
    : null;
  const matches = fit !== undefined && model !== null && Math.abs(fit - model) <= 1.5;

  return (
    <div className="trace-panel">
      <div className="trace-heading">
        <div>
          <strong>Intrinsic clamp</strong>
          <span>fit-content uses intrinsic bounds</span>
        </div>
        <code>min(max(min, available), max)</code>
      </div>
      <div className="trace-metrics">
        <TraceMetric label="available" value={formatPx(metrics.innerWidth)} />
        <TraceMetric label="min-content" value={minimum === undefined ? "—" : formatPx(minimum)} />
        <TraceMetric label="max-content" value={maximum === undefined ? "—" : formatPx(maximum)} />
        <TraceMetric label="fit-content" value={fit === undefined ? "—" : `${formatPx(fit)}${matches ? " ✓" : ""}`} />
      </div>
      <p className="trace-note">
        The intrinsic bounds above are measured from the browser itself; the clamp model then predicts the fit-content result. Toggle wrapping to see the minimum contribution change.
      </p>
    </div>
  );
}

function IntrinsicSizingExperiment() {
  const [frameWidth, setFrameWidth] = useState(460);
  const [wrapMode, setWrapMode] = useState("normal");
  const refreshKey = `${frameWidth}:${wrapMode}`;
  const [frameRef, geometry, metrics] = useLayoutMeasurement<HTMLDivElement>(refreshKey);
  const text = "Layout engines preserve layoutalgorithmvisualizer constraints across available space.";
  const boxStyle: CSSProperties = {overflowWrap: wrapMode as CSSProperties["overflowWrap"]};

  return (
    <section className="experiment" id="intrinsic-sizing">
      <ExperimentHeader id="intrinsic-sizing" />
      <div className="experiment-grid">
        <div className="controls-panel">
          <RangeField label="containing block" value={frameWidth} min={220} max={620} step={10} unit="px" onChange={setFrameWidth} />
          <SelectField label="overflow-wrap" value={wrapMode} options={["normal", "anywhere"]} onChange={setWrapMode} />
          <RuleList rules={[
            `.frame { width: ${frameWidth}px; }`,
            `.box { overflow-wrap: ${wrapMode}; }`,
            ".min { width: min-content; }",
            ".max { width: max-content; }",
            ".fit { width: fit-content; }",
          ]} />
        </div>
        <div>
          <div className="demo-stage intrinsic-stage">
            <div ref={frameRef} className="intrinsic-frame" style={{width: frameWidth, maxWidth: "100%"}}>
              <div className="intrinsic-row">
                <code>min-content</code>
                <div className="intrinsic-box box-a" style={{...boxStyle, width: "min-content"}} data-geometry-item="min-content">{text}</div>
              </div>
              <div className="intrinsic-row">
                <code>max-content</code>
                <div className="intrinsic-box box-b" style={{...boxStyle, width: "max-content"}} data-geometry-item="max-content">{text}</div>
              </div>
              <div className="intrinsic-row">
                <code>fit-content</code>
                <div className="intrinsic-box box-c" style={{...boxStyle, width: "fit-content"}} data-geometry-item="fit-content">{text}</div>
              </div>
            </div>
          </div>
          <IntrinsicTrace geometry={geometry} metrics={metrics} />
          <GeometryTable geometry={geometry} />
        </div>
      </div>
    </section>
  );
}

function PositioningExperiment() {
  const [x, setX] = useState(84);
  const [y, setY] = useState(62);
  const [rotate, setRotate] = useState(12);
  const [scale, setScale] = useState(1);

  return (
    <section className="experiment" id="positioning">
      <ExperimentHeader id="positioning" />
      <div className="experiment-grid">
        <div className="controls-panel">
          <RangeField label="left" value={x} min={0} max={220} unit="px" onChange={setX} />
          <RangeField label="top" value={y} min={0} max={130} unit="px" onChange={setY} />
          <RangeField label="rotate" value={rotate} min={-45} max={45} unit="°" onChange={setRotate} />
          <RangeField label="scale" value={scale} min={0.5} max={1.5} step={0.05} onChange={setScale} />
          <RuleList rules={[
            ".frame { position: relative; }",
            ".box { position: absolute;",
            `  left: ${x}px; top: ${y}px;`,
            `  transform: rotate(${rotate}deg) scale(${scale});`,
            "}",
          ]} />
        </div>
        <div className="position-stage demo-stage">
          <div className="origin-marker">containing block</div>
          <div className="positioned-box" style={{left: x, top: y, transform: `rotate(${rotate}deg) scale(${scale})`}}>
            transformed box
          </div>
          <div className="axis axis-x" aria-hidden="true" />
          <div className="axis axis-y" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

function ThreeDExperiment() {
  const [perspective, setPerspective] = useState(700);
  const [rotateX, setRotateX] = useState(-18);
  const [rotateY, setRotateY] = useState(28);
  const [depth, setDepth] = useState(70);

  return (
    <section className="experiment" id="transforms-3d">
      <ExperimentHeader id="transforms-3d" />
      <div className="experiment-grid">
        <div className="controls-panel">
          <RangeField label="perspective" value={perspective} min={300} max={1400} step={20} unit="px" onChange={setPerspective} />
          <RangeField label="rotateX" value={rotateX} min={-60} max={60} unit="°" onChange={setRotateX} />
          <RangeField label="rotateY" value={rotateY} min={-60} max={60} unit="°" onChange={setRotateY} />
          <RangeField label="Z separation" value={depth} min={20} max={140} unit="px" onChange={setDepth} />
          <RuleList rules={[
            `.scene { perspective: ${perspective}px; }`,
            ".stack { transform-style: preserve-3d;",
            `  transform: rotateX(${rotateX}deg) rotateY(${rotateY}deg);`,
            "}",
            `.front { transform: translateZ(${depth}px); }`,
            `.back { transform: translateZ(-${depth}px); }`,
          ]} />
        </div>
        <div className="scene-3d demo-stage" style={{perspective}}>
          <div className="stack-3d" style={{transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`}}>
            <div className="plane-3d plane-back" style={{transform: `translateZ(-${depth}px)`}}><span>back</span><code>-{depth}px</code></div>
            <div className="plane-3d plane-middle"><span>origin plane</span><code>0px</code></div>
            <div className="plane-3d plane-front" style={{transform: `translateZ(${depth}px)`}}><span>front</span><code>+{depth}px</code></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LayoutLab() {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">browser layout, made visible</div>
          <h1>layout-lab</h1>
          <p>
            Change declarative layout rules, inspect the geometry the browser resolves, and follow compact sizing traces that explain the common case without pretending to replace the full CSS algorithms.
          </p>
        </div>
        <nav className="experiment-index" aria-label="Experiments">
          {experiments.map((experiment) => (
            <a key={experiment.id} href={`#${experiment.id}`}>
              <span>{experiment.area}</span>
              <strong>{experiment.title}</strong>
            </a>
          ))}
        </nav>
      </section>

      <FlexExperiment />
      <GridExperiment />
      <IntrinsicSizingExperiment />
      <PositioningExperiment />
      <ThreeDExperiment />
    </main>
  );
}
