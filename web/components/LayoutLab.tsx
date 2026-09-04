"use client";

import {CSSProperties, RefObject, useEffect, useRef, useState} from "react";
import {experiments} from "@/lib/experiments";

type Geometry = {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function useGeometry<T extends HTMLElement>(refreshKey: string): [RefObject<T | null>, Geometry[]] {
  const ref = useRef<T>(null);
  const [geometry, setGeometry] = useState<Geometry[]>([]);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const read = () => {
      const containerRect = container.getBoundingClientRect();
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

  return [ref, geometry];
}

function GeometryTable({geometry}: {geometry: Geometry[]}) {
  return (
    <div className="geometry-wrap">
      <div className="geometry-heading">
        <strong>Measured geometry</strong>
        <span>relative to the demo container</span>
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

function FlexExperiment() {
  const [direction, setDirection] = useState("row");
  const [justify, setJustify] = useState("space-between");
  const [align, setAlign] = useState("center");
  const [gap, setGap] = useState(16);
  const refreshKey = `${direction}:${justify}:${align}:${gap}`;
  const [containerRef, geometry] = useGeometry<HTMLDivElement>(refreshKey);

  const style: CSSProperties = {
    flexDirection: direction as CSSProperties["flexDirection"],
    justifyContent: justify,
    alignItems: align,
    gap,
  };

  return (
    <section className="experiment" id="flex">
      <ExperimentHeader id="flex" />
      <div className="experiment-grid">
        <div className="controls-panel">
          <SelectField label="direction" value={direction} options={["row", "row-reverse", "column", "column-reverse"]} onChange={setDirection} />
          <SelectField label="justify-content" value={justify} options={["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"]} onChange={setJustify} />
          <SelectField label="align-items" value={align} options={["stretch", "flex-start", "center", "flex-end"]} onChange={setAlign} />
          <RangeField label="gap" value={gap} min={0} max={40} unit="px" onChange={setGap} />
          <RuleList rules={[
            "display: flex;",
            `flex-direction: ${direction};`,
            `justify-content: ${justify};`,
            `align-items: ${align};`,
            `gap: ${gap}px;`,
          ]} />
        </div>
        <div>
          <div ref={containerRef} className="demo-stage flex-stage" style={style}>
            <div className="demo-box box-a" data-geometry-item="A">A</div>
            <div className="demo-box box-b flex-grow-item" data-geometry-item="B">B <small>flex: 1</small></div>
            <div className="demo-box box-c" data-geometry-item="C">C</div>
          </div>
          <GeometryTable geometry={geometry} />
        </div>
      </div>
    </section>
  );
}

function GridExperiment() {
  const [columns, setColumns] = useState(3);
  const [gap, setGap] = useState(14);
  const [dense, setDense] = useState(false);
  const refreshKey = `${columns}:${gap}:${dense}`;
  const [containerRef, geometry] = useGeometry<HTMLDivElement>(refreshKey);

  return (
    <section className="experiment" id="grid">
      <ExperimentHeader id="grid" />
      <div className="experiment-grid">
        <div className="controls-panel">
          <RangeField label="columns" value={columns} min={2} max={5} onChange={setColumns} />
          <RangeField label="gap" value={gap} min={0} max={32} unit="px" onChange={setGap} />
          <label className="toggle-control">
            <input type="checkbox" checked={dense} onChange={(event) => setDense(event.target.checked)} />
            <span>dense auto-placement</span>
          </label>
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
            Change declarative layout rules, watch the browser resolve them, and inspect the geometry that comes out.
            The first slice covers core 2D layout and CSS-native 3D transforms.
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
      <PositioningExperiment />
      <ThreeDExperiment />
    </main>
  );
}
