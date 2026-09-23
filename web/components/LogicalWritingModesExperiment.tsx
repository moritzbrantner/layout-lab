"use client";

import {PrecisionRange as RangeField} from "./PrecisionRange";
import {CSSProperties, RefObject, useEffect, useRef, useState} from "react";
import {
  resolveLogicalAxes,
  resolveLogicalPosition,
  resolveLogicalSize,
  type Direction,
  type WritingMode,
} from "@/lib/logical-writing-mode";
import {experiments} from "@/lib/experiments";

type BoxMeasurement = {
  width: number;
  height: number;
};

type PositionMeasurement = BoxMeasurement & {
  left: number;
  top: number;
};

const POSITION_STAGE_WIDTH = 360;
const POSITION_STAGE_HEIGHT = 260;
const POSITION_INLINE_SIZE = 90;
const POSITION_BLOCK_SIZE = 56;

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function formatPx(value: number | null) {
  return value === null ? "—" : `${round(value)}px`;
}

function useBoxMeasurement<T extends HTMLElement>(refreshKey: string): [RefObject<T | null>, BoxMeasurement | null] {
  const ref = useRef<T>(null);
  const [measurement, setMeasurement] = useState<BoxMeasurement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const read = () => {
      const rect = element.getBoundingClientRect();
      setMeasurement({width: round(rect.width), height: round(rect.height)});
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, [refreshKey]);

  return [ref, measurement];
}

function usePositionMeasurement(refreshKey: string): [RefObject<HTMLDivElement | null>, PositionMeasurement | null] {
  const ref = useRef<HTMLDivElement>(null);
  const [measurement, setMeasurement] = useState<PositionMeasurement | null>(null);

  useEffect(() => {
    const stage = ref.current;
    if (!stage) return;
    const target = stage.querySelector<HTMLElement>("[data-logical-target]");
    if (!target) return;

    const read = () => {
      const stageRect = stage.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      setMeasurement({
        left: round(targetRect.left - stageRect.left),
        top: round(targetRect.top - stageRect.top),
        width: round(targetRect.width),
        height: round(targetRect.height),
      });
    };

    read();
    const observer = new ResizeObserver(read);
    observer.observe(stage);
    observer.observe(target);
    window.addEventListener("resize", read);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", read);
    };
  }, [refreshKey]);

  return [ref, measurement];
}

function ExperimentHeader() {
  const experiment = experiments.find((candidate) => candidate.id === "logical-writing-modes")!;
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

export function LogicalWritingModesExperiment() {
  const [writingMode, setWritingMode] = useState<WritingMode>("horizontal-tb");
  const [direction, setDirection] = useState<Direction>("ltr");
  const [inlineSize, setInlineSize] = useState(210);
  const [blockSize, setBlockSize] = useState(120);
  const [inlineStart, setInlineStart] = useState(20);
  const [blockStart, setBlockStart] = useState(28);

  const axes = resolveLogicalAxes({writingMode, direction});
  const sizeModel = resolveLogicalSize({inlineSize, blockSize, writingMode});
  const [sizeRef, sizeBrowser] = useBoxMeasurement<HTMLDivElement>(`${writingMode}:${direction}:${inlineSize}:${blockSize}`);
  const sizeMatches = sizeBrowser !== null
    && Math.abs(sizeBrowser.width - sizeModel.width) <= 1
    && Math.abs(sizeBrowser.height - sizeModel.height) <= 1;

  const positionModel = resolveLogicalPosition({
    containerWidth: POSITION_STAGE_WIDTH,
    containerHeight: POSITION_STAGE_HEIGHT,
    inlineSize: POSITION_INLINE_SIZE,
    blockSize: POSITION_BLOCK_SIZE,
    inlineStart,
    blockStart,
    writingMode,
    direction,
  });
  const [positionRef, positionBrowser] = usePositionMeasurement(`${writingMode}:${direction}:${inlineStart}:${blockStart}`);
  const positionMatches = positionBrowser !== null
    && Math.abs(positionBrowser.left - positionModel.left) <= 1
    && Math.abs(positionBrowser.top - positionModel.top) <= 1
    && Math.abs(positionBrowser.width - positionModel.width) <= 1
    && Math.abs(positionBrowser.height - positionModel.height) <= 1;

  const sizeStyle: CSSProperties = {
    writingMode,
    direction,
    inlineSize,
    blockSize,
  };
  const stageStyle: CSSProperties = {writingMode, direction};
  const targetStyle: CSSProperties = {
    writingMode,
    direction,
    inlineSize: POSITION_INLINE_SIZE,
    blockSize: POSITION_BLOCK_SIZE,
    insetInlineStart: inlineStart,
    insetBlockStart: blockStart,
  };

  return (
    <div className="sizing-depth-shell logical-writing-shell">
      <section className="experiment" id="logical-writing-modes">
        <ExperimentHeader />
        <div className="experiment-grid">
          <div className="controls-panel">
            <SelectField
              label="writing-mode"
              value={writingMode}
              options={["horizontal-tb", "vertical-rl", "vertical-lr"]}
              onChange={(value) => setWritingMode(value as WritingMode)}
            />
            <SelectField label="direction" value={direction} options={["ltr", "rtl"]} onChange={(value) => setDirection(value as Direction)} />
            <RangeField label="inline-size" value={inlineSize} min={120} max={280} unit="px" onChange={setInlineSize} />
            <RangeField label="block-size" value={blockSize} min={80} max={200} unit="px" onChange={setBlockSize} />
            <RangeField label="inset-inline-start" value={inlineStart} min={0} max={60} unit="px" onChange={setInlineStart} />
            <RangeField label="inset-block-start" value={blockStart} min={0} max={60} unit="px" onChange={setBlockStart} />
            <RuleList rules={[
              `writing-mode: ${writingMode};`,
              `direction: ${direction};`,
              `inline-size: ${inlineSize}px;`,
              `block-size: ${blockSize}px;`,
              `inset-inline-start: ${inlineStart}px;`,
              `inset-block-start: ${blockStart}px;`,
            ]} />
          </div>

          <div className="logical-writing-demos">
            <div className="trace-panel">
              <div className="trace-heading">
                <div>
                  <strong>Logical axes → physical sides</strong>
                  <span>writing mode establishes the axes; direction chooses inline progression</span>
                </div>
                <code>{writingMode} · {direction}</code>
              </div>
              <div className="trace-metrics">
                <TraceMetric label="inline axis" value={axes.inlineAxis} />
                <TraceMetric label="block axis" value={axes.blockAxis} />
                <TraceMetric label="inline start" value={axes.inlineStart} />
                <TraceMetric label="block start" value={axes.blockStart} />
              </div>
              <div className="trace-table-wrap">
                <table className="trace-table logical-axis-table">
                  <thead><tr><th>logical side</th><th>physical side</th></tr></thead>
                  <tbody>
                    <tr><td>inline-start</td><td>{axes.inlineStart}</td></tr>
                    <tr><td>inline-end</td><td>{axes.inlineEnd}</td></tr>
                    <tr><td>block-start</td><td>{axes.blockStart}</td></tr>
                    <tr><td>block-end</td><td>{axes.blockEnd}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="trace-panel">
              <div className="trace-heading">
                <div>
                  <strong>Logical sizing</strong>
                  <span>`inline-size` and `block-size` rotate onto physical width and height with the writing mode</span>
                </div>
                <code>{inlineSize}px × {blockSize}px logical</code>
              </div>
              <div className="trace-metrics">
                <TraceMetric label="model width" value={formatPx(sizeModel.width)} />
                <TraceMetric label="model height" value={formatPx(sizeModel.height)} />
                <TraceMetric label="browser width" value={formatPx(sizeBrowser?.width ?? null)} />
                <TraceMetric label="browser height" value={`${formatPx(sizeBrowser?.height ?? null)}${sizeMatches ? " ✓" : ""}`} />
              </div>
              <div className="logical-size-stage">
                <div ref={sizeRef} className="logical-size-box" style={sizeStyle}>
                  <span className="logical-readable-label">inline / block</span>
                </div>
              </div>
            </div>

            <div className="trace-panel">
              <div className="trace-heading">
                <div>
                  <strong>Logical inset positioning</strong>
                  <span>the same logical start insets move to different physical edges without rewriting the declaration</span>
                </div>
                <code>inline {inlineStart}px · block {blockStart}px</code>
              </div>
              <div className="trace-metrics">
                <TraceMetric label="model left" value={formatPx(positionModel.left)} />
                <TraceMetric label="model top" value={formatPx(positionModel.top)} />
                <TraceMetric label="browser left" value={formatPx(positionBrowser?.left ?? null)} />
                <TraceMetric label="browser top" value={`${formatPx(positionBrowser?.top ?? null)}${positionMatches ? " ✓" : ""}`} />
              </div>
              <div className="logical-position-scroll">
                <div ref={positionRef} className="logical-position-stage" style={stageStyle}>
                  <div className="logical-position-target" data-logical-target style={targetStyle}>
                    <span className="logical-readable-label">logical box</span>
                  </div>
                </div>
              </div>
              <p className="trace-note">
                Scope: `horizontal-tb`, `vertical-rl`, and `vertical-lr` with physical geometry for logical sizes and start insets. Glyph orientation, bidi reordering, orthogonal-flow intrinsic sizing, fragmentation, and `sideways-*` modes remain browser-owned.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
