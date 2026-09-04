"use client";

import {CSSProperties, RefObject, useEffect, useRef, useState} from "react";
import {experiments} from "@/lib/experiments";

type StyleSnapshot = {
  transform: string;
  transformOrigin: string;
  transformStyle: string;
  perspective: string;
  perspectiveOrigin: string;
  backfaceVisibility: string;
};

const emptySnapshot: StyleSnapshot = {
  transform: "none",
  transformOrigin: "—",
  transformStyle: "flat",
  perspective: "none",
  perspectiveOrigin: "—",
  backfaceVisibility: "visible",
};

function useStyleSnapshot<T extends HTMLElement>(refreshKey: string): [RefObject<T | null>, StyleSnapshot] {
  const ref = useRef<T>(null);
  const [snapshot, setSnapshot] = useState<StyleSnapshot>(emptySnapshot);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const frame = requestAnimationFrame(() => {
      const style = getComputedStyle(element);
      setSnapshot({
        transform: style.transform,
        transformOrigin: style.transformOrigin,
        transformStyle: style.transformStyle,
        perspective: style.perspective,
        perspectiveOrigin: style.perspectiveOrigin,
        backfaceVisibility: style.backfaceVisibility,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [refreshKey]);

  return [ref, snapshot];
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

function MatrixReadout({label, value}: {label: string; value: string}) {
  return (
    <div className="matrix-readout">
      <span>{label}</span>
      <code>{value}</code>
    </div>
  );
}

export function ThreeDOriginsExperiment() {
  const [perspective, setPerspective] = useState(720);
  const [perspectiveX, setPerspectiveX] = useState(42);
  const [perspectiveY, setPerspectiveY] = useState(40);
  const [originX, setOriginX] = useState(50);
  const [originY, setOriginY] = useState(50);
  const [originZ, setOriginZ] = useState(0);
  const [rotateX, setRotateX] = useState(-22);
  const [rotateY, setRotateY] = useState(34);
  const refreshKey = `${perspective}:${perspectiveX}:${perspectiveY}:${originX}:${originY}:${originZ}:${rotateX}:${rotateY}`;
  const [sceneRef, sceneStyle] = useStyleSnapshot<HTMLDivElement>(refreshKey);
  const [objectRef, objectStyle] = useStyleSnapshot<HTMLDivElement>(refreshKey);

  return (
    <section className="experiment" id="origins-3d">
      <ExperimentHeader id="origins-3d" />
      <div className="experiment-grid">
        <div className="controls-panel">
          <RangeField label="perspective" value={perspective} min={300} max={1400} step={20} unit="px" onChange={setPerspective} />
          <RangeField label="perspective-origin X" value={perspectiveX} min={0} max={100} unit="%" onChange={setPerspectiveX} />
          <RangeField label="perspective-origin Y" value={perspectiveY} min={0} max={100} unit="%" onChange={setPerspectiveY} />
          <RangeField label="transform-origin X" value={originX} min={0} max={100} unit="%" onChange={setOriginX} />
          <RangeField label="transform-origin Y" value={originY} min={0} max={100} unit="%" onChange={setOriginY} />
          <RangeField label="transform-origin Z" value={originZ} min={-120} max={120} step={10} unit="px" onChange={setOriginZ} />
          <RangeField label="rotateX" value={rotateX} min={-70} max={70} unit="°" onChange={setRotateX} />
          <RangeField label="rotateY" value={rotateY} min={-70} max={70} unit="°" onChange={setRotateY} />
          <RuleList rules={[
            `.scene { perspective: ${perspective}px;`,
            `  perspective-origin: ${perspectiveX}% ${perspectiveY}%; }`,
            `.object { transform-origin: ${originX}% ${originY}% ${originZ}px;`,
            `  transform: rotateX(${rotateX}deg) rotateY(${rotateY}deg); }`,
          ]} />
        </div>
        <div>
          <div
            ref={sceneRef}
            className="demo-stage origin-3d-scene"
            style={{perspective, perspectiveOrigin: `${perspectiveX}% ${perspectiveY}%`}}
          >
            <div className="perspective-origin-marker" style={{left: `${perspectiveX}%`, top: `${perspectiveY}%`}}>
              <span>perspective origin</span>
            </div>
            <div
              ref={objectRef}
              className="origin-3d-object"
              style={{
                transformOrigin: `${originX}% ${originY}% ${originZ}px`,
                transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
              }}
            >
              <div className="origin-grid" aria-hidden="true" />
              <div className="transform-origin-marker" style={{left: `${originX}%`, top: `${originY}%`}}>
                <span>transform origin</span>
              </div>
              <strong>transform plane</strong>
              <code>Z origin {originZ}px</code>
            </div>
          </div>
          <div className="trace-panel">
            <div className="trace-heading">
              <div>
                <strong>Browser-resolved origins</strong>
                <span>move the camera origin separately from the object pivot</span>
              </div>
              <code>matrix3d</code>
            </div>
            <div className="trace-metrics">
              <TraceMetric label="perspective" value={sceneStyle.perspective} />
              <TraceMetric label="perspective origin" value={sceneStyle.perspectiveOrigin} />
              <TraceMetric label="transform origin" value={objectStyle.transformOrigin} />
              <TraceMetric label="transform style" value={objectStyle.transformStyle} />
            </div>
            <MatrixReadout label="resolved transform" value={objectStyle.transform} />
            <p className="trace-note">
              `perspective-origin` moves the viewer’s vanishing point on the scene; `transform-origin` moves the object’s pivot before the transform matrix is applied. The markers make those two coordinate choices independently visible.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ThreeDContextExperiment() {
  const [preserve, setPreserve] = useState(true);
  const [hideBackface, setHideBackface] = useState(true);
  const [depth, setDepth] = useState(90);
  const [parentRotateY, setParentRotateY] = useState(26);
  const [cardRotateY, setCardRotateY] = useState(34);
  const refreshKey = `${preserve}:${hideBackface}:${depth}:${parentRotateY}:${cardRotateY}`;
  const [rootRef, rootStyle] = useStyleSnapshot<HTMLDivElement>(refreshKey);
  const [cardRef, cardStyle] = useStyleSnapshot<HTMLDivElement>(refreshKey);
  const [frontRef, frontStyle] = useStyleSnapshot<HTMLDivElement>(refreshKey);
  const backface = hideBackface ? "hidden" : "visible";

  return (
    <section className="experiment" id="context-3d">
      <ExperimentHeader id="context-3d" />
      <div className="experiment-grid">
        <div className="controls-panel">
          <ToggleField label="preserve nested 3D" checked={preserve} onChange={setPreserve} />
          <ToggleField label="hide backfaces" checked={hideBackface} onChange={setHideBackface} />
          <RangeField label="Z separation" value={depth} min={20} max={150} step={10} unit="px" onChange={setDepth} />
          <RangeField label="parent rotateY" value={parentRotateY} min={-60} max={60} unit="°" onChange={setParentRotateY} />
          <RangeField label="card rotateY" value={cardRotateY} min={-180} max={180} step={5} unit="°" onChange={setCardRotateY} />
          <RuleList rules={[
            `.context { transform-style: ${preserve ? "preserve-3d" : "flat"};`,
            `  transform: rotateX(-18deg) rotateY(${parentRotateY}deg); }`,
            `.card { transform: translateZ(${depth}px) rotateY(${cardRotateY}deg); }`,
            `.face { backface-visibility: ${backface}; }`,
          ]} />
        </div>
        <div>
          <div className="demo-stage context-3d-scene">
            <div
              ref={rootRef}
              className="context-3d-root"
              style={{transformStyle: preserve ? "preserve-3d" : "flat", transform: `rotateX(-18deg) rotateY(${parentRotateY}deg)`}}
            >
              <div className="context-depth-plane context-depth-back" style={{transform: `translateZ(-${depth}px)`}}>
                back layer · −{depth}px
              </div>
              <div className="context-depth-plane context-depth-zero">parent plane · 0px</div>
              <div
                ref={cardRef}
                className="flip-card-3d"
                style={{transform: `translateZ(${depth}px) rotateY(${cardRotateY}deg)`}}
              >
                <div ref={frontRef} className="flip-face flip-front" style={{backfaceVisibility: backface}}>front face</div>
                <div className="flip-face flip-back" style={{backfaceVisibility: backface}}>back face</div>
              </div>
            </div>
          </div>
          <div className="trace-panel">
            <div className="trace-heading">
              <div>
                <strong>Nested context evidence</strong>
                <span>flattening changes descendant depth; backface visibility changes face painting</span>
              </div>
              <code>{preserve ? "preserve-3d" : "flat"}</code>
            </div>
            <div className="trace-metrics">
              <TraceMetric label="root transform-style" value={rootStyle.transformStyle} />
              <TraceMetric label="front backface" value={frontStyle.backfaceVisibility} />
              <TraceMetric label="Z separation" value={`${depth}px`} />
              <TraceMetric label="card rotation" value={`${cardRotateY}°`} />
            </div>
            <MatrixReadout label="parent transform" value={rootStyle.transform} />
            <MatrixReadout label="nested card transform" value={cardStyle.transform} />
            <p className="trace-note">
              Switch the parent to `flat` to see descendant Z positions projected into the parent plane. Rotate the card past 90° with hidden backfaces to see the browser stop painting the face that points away from the viewer.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ThreeDDepth() {
  return (
    <div className="three-d-depth-shell">
      <ThreeDOriginsExperiment />
      <ThreeDContextExperiment />
    </div>
  );
}
