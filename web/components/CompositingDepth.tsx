"use client";

import {CSSProperties, PointerEvent as ReactPointerEvent, RefObject, useEffect, useRef, useState} from "react";
import {experiments} from "@/lib/experiments";

type PaintSnapshot = {
  topElement: string;
  aZ: string;
  bZ: string;
  aTransform: string;
  bTransform: string;
};

type HitSnapshot = {
  x: number;
  y: number;
  target: string;
};

type RectSnapshot = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function round(value: number) {
  return Math.round(value * 10) / 10;
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

function usePaintSnapshot(
  refreshKey: string,
): [RefObject<HTMLDivElement | null>, RefObject<HTMLDivElement | null>, RefObject<HTMLDivElement | null>, PaintSnapshot] {
  const stageRef = useRef<HTMLDivElement>(null);
  const aRef = useRef<HTMLDivElement>(null);
  const bRef = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState<PaintSnapshot>({
    topElement: "—",
    aZ: "auto",
    bZ: "auto",
    aTransform: "none",
    bTransform: "none",
  });

  useEffect(() => {
    const stage = stageRef.current;
    const a = aRef.current;
    const b = bRef.current;
    if (!stage || !a || !b) return;

    const frame = requestAnimationFrame(() => {
      const rect = stage.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width * 0.54, rect.top + rect.height * 0.5);
      const paintElement = hit?.closest<HTMLElement>("[data-paint-id]");
      const aStyle = getComputedStyle(a);
      const bStyle = getComputedStyle(b);
      setSnapshot({
        topElement: paintElement?.dataset.paintId ?? "stage",
        aZ: aStyle.zIndex,
        bZ: bStyle.zIndex,
        aTransform: aStyle.transform,
        bTransform: bStyle.transform,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [refreshKey]);

  return [stageRef, aRef, bRef, snapshot];
}

export function StackingContextExperiment() {
  const [aZ, setAZ] = useState(1);
  const [bZ, setBZ] = useState(2);
  const [childZ, setChildZ] = useState(999);
  const [transformA, setTransformA] = useState(true);
  const [transformB, setTransformB] = useState(false);
  const refreshKey = `${aZ}:${bZ}:${childZ}:${transformA}:${transformB}`;
  const [stageRef, aRef, bRef, snapshot] = usePaintSnapshot(refreshKey);

  return (
    <section className="experiment" id="stacking-contexts">
      <ExperimentHeader id="stacking-contexts" />
      <div className="experiment-grid">
        <div className="controls-panel">
          <RangeField label="context A z-index" value={aZ} min={-2} max={6} onChange={setAZ} />
          <RangeField label="context B z-index" value={bZ} min={-2} max={6} onChange={setBZ} />
          <RangeField label="A child z-index" value={childZ} min={0} max={999} step={111} onChange={setChildZ} />
          <ToggleField label="transform context A" checked={transformA} onChange={setTransformA} />
          <ToggleField label="transform context B" checked={transformB} onChange={setTransformB} />
          <RuleList rules={[
            `.A { position: absolute; z-index: ${aZ};${transformA ? " transform: translateZ(0);" : ""} }`,
            `.A-child { z-index: ${childZ}; }`,
            `.B { position: absolute; z-index: ${bZ};${transformB ? " transform: translateZ(0);" : ""} }`,
          ]} />
        </div>
        <div>
          <div ref={stageRef} className="demo-stage stacking-stage">
            <div
              ref={aRef}
              className="stacking-context stacking-context-a"
              style={{zIndex: aZ, transform: transformA ? "translateZ(0)" : undefined}}
              data-paint-id="context A"
            >
              <span>A context · z {aZ}</span>
              <div className="stacking-child" style={{zIndex: childZ}} data-paint-id="A child">
                A child · z {childZ}
              </div>
            </div>
            <div
              ref={bRef}
              className="stacking-context stacking-context-b"
              style={{zIndex: bZ, transform: transformB ? "translateZ(0)" : undefined}}
              data-paint-id="context B"
            >
              <span>B context · z {bZ}</span>
              <div className="stacking-badge" data-paint-id="B child">B child</div>
            </div>
            <div className="stacking-sample-point" aria-hidden="true"><span>sample point</span></div>
          </div>
          <div className="trace-panel">
            <div className="trace-heading">
              <div>
                <strong>Paint-order sample</strong>
                <span>browser hit-test at the marked overlap point</span>
              </div>
              <code>{snapshot.topElement}</code>
            </div>
            <div className="trace-metrics">
              <TraceMetric label="top at overlap" value={snapshot.topElement} />
              <TraceMetric label="A computed z-index" value={snapshot.aZ} />
              <TraceMetric label="B computed z-index" value={snapshot.bZ} />
              <TraceMetric label="A child z-index" value={String(childZ)} />
            </div>
            <div className="paint-evidence">
              <div><span>A transform</span><code>{snapshot.aTransform}</code></div>
              <div><span>B transform</span><code>{snapshot.bTransform}</code></div>
            </div>
            <p className="trace-note">
              The high-z child cannot escape the stacking level of its parent context. Change the two parent z-indices and watch the browser-reported top element at the overlap point; the child’s `z-index: {childZ}` only orders content inside A.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function useTransformedRect(refreshKey: string): [RefObject<HTMLDivElement | null>, RefObject<HTMLDivElement | null>, RectSnapshot] {
  const stageRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<RectSnapshot>({left: 0, top: 0, width: 0, height: 0});

  useEffect(() => {
    const stage = stageRef.current;
    const box = boxRef.current;
    if (!stage || !box) return;
    const read = () => {
      const stageRect = stage.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      setRect({
        left: round(boxRect.left - stageRect.left),
        top: round(boxRect.top - stageRect.top),
        width: round(boxRect.width),
        height: round(boxRect.height),
      });
    };
    const frame = requestAnimationFrame(read);
    const observer = new ResizeObserver(read);
    observer.observe(stage);
    observer.observe(box);
    window.addEventListener("resize", read);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", read);
    };
  }, [refreshKey]);

  return [stageRef, boxRef, rect];
}

export function HitTestingExperiment() {
  const [rotate, setRotate] = useState(32);
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(30);
  const [hit, setHit] = useState<HitSnapshot>({x: 0, y: 0, target: "tap or move inside the stage"});
  const refreshKey = `${rotate}:${scale}:${translateX}`;
  const [stageRef, boxRef, rect] = useTransformedRect(refreshKey);

  const sample = (event: ReactPointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-hit-id]");
    setHit({
      x: round(event.clientX - stageRect.left),
      y: round(event.clientY - stageRect.top),
      target: target?.dataset.hitId ?? "stage/background",
    });
  };

  const transformedStyle: CSSProperties = {
    transform: `translateX(${translateX}px) rotate(${rotate}deg) scale(${scale})`,
  };

  return (
    <section className="experiment" id="hit-testing">
      <ExperimentHeader id="hit-testing" />
      <div className="experiment-grid">
        <div className="controls-panel">
          <RangeField label="translateX" value={translateX} min={-80} max={100} step={5} unit="px" onChange={setTranslateX} />
          <RangeField label="rotate" value={rotate} min={-70} max={70} unit="°" onChange={setRotate} />
          <RangeField label="scale" value={scale} min={0.6} max={1.4} step={0.05} onChange={setScale} />
          <RuleList rules={[
            `.target { transform: translateX(${translateX}px) rotate(${rotate}deg) scale(${scale}); }`,
            "// tap/move: document.elementFromPoint(x, y)",
            "// outline: target.getBoundingClientRect()",
          ]} />
        </div>
        <div>
          <div
            ref={stageRef}
            className="demo-stage hit-test-stage"
            onPointerMove={sample}
            onPointerDown={sample}
            data-hit-id="stage/background"
          >
            <div
              className="bounding-rect-overlay"
              style={{left: rect.left, top: rect.top, width: rect.width, height: rect.height}}
              aria-hidden="true"
            >
              <span>getBoundingClientRect()</span>
            </div>
            <div ref={boxRef} className="hit-test-box" style={transformedStyle} data-hit-id="transformed box">
              <strong>painted box</strong>
              <span>tap inside/outside the rotated shape</span>
            </div>
            {hit.x || hit.y ? <div className="hit-marker" style={{left: hit.x, top: hit.y}} aria-hidden="true" /> : null}
          </div>
          <div className="trace-panel">
            <div className="trace-heading">
              <div>
                <strong>Hit-test evidence</strong>
                <span>visual transform vs axis-aligned bounding rectangle</span>
              </div>
              <code>{hit.target}</code>
            </div>
            <div className="trace-metrics">
              <TraceMetric label="sample X" value={`${hit.x}px`} />
              <TraceMetric label="sample Y" value={`${hit.y}px`} />
              <TraceMetric label="browser hit" value={hit.target} />
              <TraceMetric label="bounding rect" value={`${rect.width} × ${rect.height}px`} />
            </div>
            <p className="trace-note">
              The dashed rectangle is the transformed element’s axis-aligned `getBoundingClientRect()`. Browser hit-testing follows the transformed painted shape, so points inside that rectangle can still hit the stage when they fall outside the rotated box itself.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CompositingDepth() {
  return (
    <div className="compositing-depth-shell">
      <StackingContextExperiment />
      <HitTestingExperiment />
    </div>
  );
}
