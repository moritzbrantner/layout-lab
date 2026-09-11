"use client";

import {CSSProperties, RefObject, useEffect, useRef, useState} from "react";
import {
  resolveAbsoluteReference,
  resolveFixedReference,
  resolveStickyTop,
} from "@/lib/positioning-boundaries";
import {experiments} from "@/lib/experiments";

type OffsetMeasurement = {
  outerX: number | null;
  outerY: number | null;
  innerX: number | null;
  innerY: number | null;
};

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function formatPx(value: number | null) {
  return value === null ? "—" : `${round(value)}px`;
}

function relativeOffset(target: HTMLElement, reference: HTMLElement) {
  const targetRect = target.getBoundingClientRect();
  const referenceRect = reference.getBoundingClientRect();
  return {
    x: round(targetRect.left - referenceRect.left - reference.clientLeft),
    y: round(targetRect.top - referenceRect.top - reference.clientTop),
  };
}

function useNestedOffsets(refreshKey: string): [RefObject<HTMLDivElement | null>, OffsetMeasurement] {
  const ref = useRef<HTMLDivElement>(null);
  const [measurement, setMeasurement] = useState<OffsetMeasurement>({
    outerX: null,
    outerY: null,
    innerX: null,
    innerY: null,
  });

  useEffect(() => {
    const outer = ref.current;
    if (!outer) return;
    const inner = outer.querySelector<HTMLElement>("[data-position-inner]");
    const target = outer.querySelector<HTMLElement>("[data-position-target]");
    if (!inner || !target) return;

    const read = () => {
      const outerOffset = relativeOffset(target, outer);
      const innerOffset = relativeOffset(target, inner);
      setMeasurement({
        outerX: outerOffset.x,
        outerY: outerOffset.y,
        innerX: innerOffset.x,
        innerY: innerOffset.y,
      });
    };

    read();
    const observer = new ResizeObserver(read);
    observer.observe(outer);
    observer.observe(inner);
    observer.observe(target);
    window.addEventListener("resize", read);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", read);
    };
  }, [refreshKey]);

  return [ref, measurement];
}

function useStickyMeasurement(
  scrollTop: number,
): [RefObject<HTMLDivElement | null>, number | null] {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    const scroller = ref.current;
    if (!scroller) return;
    const sticky = scroller.querySelector<HTMLElement>("[data-sticky-target]");
    if (!sticky) return;

    const read = () => {
      const scrollerRect = scroller.getBoundingClientRect();
      const stickyRect = sticky.getBoundingClientRect();
      setTop(round(stickyRect.top - scrollerRect.top - scroller.clientTop));
    };

    scroller.scrollTop = scrollTop;
    read();
    scroller.addEventListener("scroll", read);
    const observer = new ResizeObserver(read);
    observer.observe(scroller);
    observer.observe(sticky);
    return () => {
      scroller.removeEventListener("scroll", read);
      observer.disconnect();
    };
  }, [scrollTop]);

  return [ref, top];
}

function ExperimentHeader() {
  const experiment = experiments.find((candidate) => candidate.id === "positioning-boundaries")!;
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

function ToggleField({label, checked, onChange}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
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

function referenceOffset(measurement: OffsetMeasurement, inner: boolean) {
  return {
    x: inner ? measurement.innerX : measurement.outerX,
    y: inner ? measurement.innerY : measurement.outerY,
  };
}

export function PositioningBoundariesExperiment() {
  const [absoluteInnerPositioned, setAbsoluteInnerPositioned] = useState(true);
  const [fixedInnerTransformed, setFixedInnerTransformed] = useState(true);
  const [stickyScrollTop, setStickyScrollTop] = useState(0);

  const absoluteReference = resolveAbsoluteReference(absoluteInnerPositioned);
  const fixedReference = resolveFixedReference(fixedInnerTransformed);
  const [absoluteRef, absoluteMeasurement] = useNestedOffsets(String(absoluteInnerPositioned));
  const [fixedRef, fixedMeasurement] = useNestedOffsets(String(fixedInnerTransformed));

  const stickyNormalTop = 72;
  const stickyInsetTop = 12;
  const stickyModelTop = resolveStickyTop({
    normalTop: stickyNormalTop,
    scrollTop: stickyScrollTop,
    insetTop: stickyInsetTop,
  });
  const [stickyRef, stickyBrowserTop] = useStickyMeasurement(stickyScrollTop);

  const absoluteOffset = referenceOffset(absoluteMeasurement, absoluteInnerPositioned);
  const fixedOffset = referenceOffset(fixedMeasurement, fixedInnerTransformed);
  const absoluteMatches = absoluteOffset.x !== null && absoluteOffset.y !== null
    && Math.abs(absoluteOffset.x - 24) <= 1
    && Math.abs(absoluteOffset.y - 18) <= 1;
  const fixedMatches = fixedOffset.x !== null && fixedOffset.y !== null
    && Math.abs(fixedOffset.x - 24) <= 1
    && Math.abs(fixedOffset.y - 18) <= 1;
  const stickyMatches = stickyBrowserTop !== null && Math.abs(stickyBrowserTop - stickyModelTop) <= 1;

  const absoluteInnerStyle: CSSProperties = {
    position: absoluteInnerPositioned ? "relative" : "static",
  };
  const fixedInnerStyle: CSSProperties = {
    transform: fixedInnerTransformed ? "translateZ(0)" : "none",
  };

  return (
    <div className="sizing-depth-shell positioning-boundaries-shell">
      <section className="experiment" id="positioning-boundaries">
        <ExperimentHeader />
        <div className="experiment-grid">
          <div className="controls-panel">
            <ToggleField
              label="position the inner absolute ancestor"
              checked={absoluteInnerPositioned}
              onChange={setAbsoluteInnerPositioned}
            />
            <ToggleField
              label="transform the inner fixed ancestor"
              checked={fixedInnerTransformed}
              onChange={setFixedInnerTransformed}
            />
            <RangeField
              label="sticky scroll position"
              value={stickyScrollTop}
              min={0}
              max={160}
              unit="px"
              onChange={setStickyScrollTop}
            />
            <RuleList rules={[
              `.absolute-inner { position: ${absoluteInnerPositioned ? "relative" : "static"}; }`,
              ".absolute-target { position: absolute; left: 24px; top: 18px; }",
              `.fixed-inner { transform: ${fixedInnerTransformed ? "translateZ(0)" : "none"}; }`,
              ".fixed-target { position: fixed; left: 24px; top: 18px; }",
              `.sticky-target { position: sticky; top: ${stickyInsetTop}px; }`,
            ]} />
          </div>

          <div className="positioning-boundaries-demos">
            <div className="trace-panel">
              <div className="trace-heading">
                <div>
                  <strong>Absolute containing block</strong>
                  <span>the nearest positioned ancestor supplies the inset reference</span>
                </div>
                <code>{absoluteReference}</code>
              </div>
              <div className="trace-metrics">
                <TraceMetric label="reference" value={absoluteInnerPositioned ? "inner" : "outer"} />
                <TraceMetric label="browser x" value={`${formatPx(absoluteOffset.x)}${absoluteMatches ? " ✓" : ""}`} />
                <TraceMetric label="browser y" value={formatPx(absoluteOffset.y)} />
                <TraceMetric label="declared inset" value="24px / 18px" />
              </div>
              <div ref={absoluteRef} className="position-reference-stage absolute-reference-outer" data-position-outer>
                <span className="position-reference-label">outer · position: relative</span>
                <div className="position-reference-inner absolute-reference-inner" data-position-inner style={absoluteInnerStyle}>
                  <span className="position-reference-label">inner · position: {absoluteInnerPositioned ? "relative" : "static"}</span>
                  <div className="position-target position-target-absolute" data-position-target>absolute</div>
                </div>
              </div>
              <p className="trace-note">
                Scope: physical `top`/`left` insets and positioned ancestors only. The browser remains authoritative for padding-box geometry, percentage insets, writing modes, and other containing-block creators.
              </p>
            </div>

            <div className="trace-panel">
              <div className="trace-heading">
                <div>
                  <strong>Fixed containing block</strong>
                  <span>a transformed ancestor captures a fixed descendant instead of letting it escape to the viewport</span>
                </div>
                <code>{fixedReference}</code>
              </div>
              <div className="trace-metrics">
                <TraceMetric label="reference" value={fixedInnerTransformed ? "inner transform" : "outer transform"} />
                <TraceMetric label="browser x" value={`${formatPx(fixedOffset.x)}${fixedMatches ? " ✓" : ""}`} />
                <TraceMetric label="browser y" value={formatPx(fixedOffset.y)} />
                <TraceMetric label="declared inset" value="24px / 18px" />
              </div>
              <div ref={fixedRef} className="position-reference-stage fixed-reference-outer" data-position-outer>
                <span className="position-reference-label">outer · transform: translateZ(0)</span>
                <div className="position-reference-inner fixed-reference-inner" data-position-inner style={fixedInnerStyle}>
                  <span className="position-reference-label">inner · transform: {fixedInnerTransformed ? "translateZ(0)" : "none"}</span>
                  <div className="position-target position-target-fixed" data-position-target>fixed</div>
                </div>
              </div>
              <p className="trace-note">
                The outer transform intentionally keeps this demo local. The scoped model only chooses between two transform-created fixed containing blocks; the ordinary viewport case and other fixed containing-block creators remain browser-owned.
              </p>
            </div>

            <div className="trace-panel">
              <div className="trace-heading">
                <div>
                  <strong>Sticky scrollport boundary</strong>
                  <span>sticky positioning is constrained by the nearest scrolling ancestor rather than behaving like absolute positioning</span>
                </div>
                <code>top: {stickyInsetTop}px</code>
              </div>
              <div className="trace-metrics">
                <TraceMetric label="scrollTop" value={formatPx(stickyScrollTop)} />
                <TraceMetric label="model top" value={formatPx(stickyModelTop)} />
                <TraceMetric label="browser top" value={`${formatPx(stickyBrowserTop)}${stickyMatches ? " ✓" : ""}`} />
                <TraceMetric label="scroll reference" value="nearest scroll container" />
              </div>
              <div ref={stickyRef} className="position-sticky-scroller">
                <div className="position-sticky-spacer" aria-hidden="true" />
                <div className="position-target position-target-sticky" data-sticky-target>sticky</div>
                <div className="position-sticky-tail" aria-hidden="true" />
              </div>
              <p className="trace-note">
                Scope: one vertical `overflow: auto` scroll container, a positive `top` inset, and a scroll range that does not reach the sticky element&apos;s containing-block end constraint. The browser owns the full sticky-positioning algorithm.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
