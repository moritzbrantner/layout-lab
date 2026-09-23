"use client";

import {PrecisionRange as RangeField} from "./PrecisionRange";
import {CSSProperties, RefObject, useEffect, useRef, useState} from "react";
import {
  clampScrollOffset,
  resolveAspectHeight,
  resolveOverflowExtent,
  type AspectRatio,
} from "@/lib/aspect-overflow";
import {experiments} from "@/lib/experiments";

type OverflowMode = "auto" | "hidden" | "clip" | "visible";
type BoxMeasurement = {width: number; height: number};
type ImageMeasurement = BoxMeasurement & {naturalWidth: number; naturalHeight: number};
type ScrollMeasurement = {
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  scrollLeft: number;
};

const REPLACED_IMAGE_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='90' viewBox='0 0 160 90'%3E%3Crect width='160' height='90' fill='%2385a7ff'/%3E%3Ccircle cx='44' cy='42' r='22' fill='%2310151d'/%3E%3Crect x='82' y='24' width='54' height='42' rx='8' fill='%23e5b47a'/%3E%3C/svg%3E";

const ratios: Record<string, AspectRatio> = {
  "16 / 9": {width: 16, height: 9},
  "4 / 3": {width: 4, height: 3},
  "1 / 1": {width: 1, height: 1},
};

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

function useImageMeasurement(refreshKey: string): [RefObject<HTMLImageElement | null>, ImageMeasurement | null] {
  const ref = useRef<HTMLImageElement>(null);
  const [measurement, setMeasurement] = useState<ImageMeasurement | null>(null);

  useEffect(() => {
    const image = ref.current;
    if (!image) return;
    const read = () => {
      const rect = image.getBoundingClientRect();
      setMeasurement({
        width: round(rect.width),
        height: round(rect.height),
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      });
    };
    image.addEventListener("load", read);
    read();
    const observer = new ResizeObserver(read);
    observer.observe(image);
    return () => {
      image.removeEventListener("load", read);
      observer.disconnect();
    };
  }, [refreshKey]);

  return [ref, measurement];
}

function useScrollMeasurement(
  mode: OverflowMode,
  requestedScrollLeft: number,
): [RefObject<HTMLDivElement | null>, ScrollMeasurement | null] {
  const ref = useRef<HTMLDivElement>(null);
  const [measurement, setMeasurement] = useState<ScrollMeasurement | null>(null);

  useEffect(() => {
    const scroller = ref.current;
    if (!scroller) return;
    const read = () => setMeasurement({
      clientWidth: scroller.clientWidth,
      clientHeight: scroller.clientHeight,
      scrollWidth: scroller.scrollWidth,
      scrollHeight: scroller.scrollHeight,
      scrollLeft: round(scroller.scrollLeft),
    });
    scroller.scrollLeft = requestedScrollLeft;
    read();
    scroller.addEventListener("scroll", read);
    const observer = new ResizeObserver(read);
    observer.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", read);
      observer.disconnect();
    };
  }, [mode, requestedScrollLeft]);

  return [ref, measurement];
}

function ExperimentHeader() {
  const experiment = experiments.find((candidate) => candidate.id === "aspect-overflow")!;
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
  return <div className="trace-metric"><span>{label}</span><strong>{value}</strong></div>;
}

export function AspectOverflowExperiment() {
  const [aspectWidth, setAspectWidth] = useState(320);
  const [ratioLabel, setRatioLabel] = useState("16 / 9");
  const [imageWidth, setImageWidth] = useState(320);
  const [overflowMode, setOverflowMode] = useState<OverflowMode>("auto");
  const [requestedScrollLeft, setRequestedScrollLeft] = useState(120);

  const ratio = ratios[ratioLabel]!;
  const aspectModelHeight = resolveAspectHeight({width: aspectWidth, ratio});
  const [aspectRef, aspectBrowser] = useBoxMeasurement<HTMLDivElement>(`${aspectWidth}:${ratioLabel}`);
  const aspectMatches = aspectBrowser !== null && Math.abs(aspectBrowser.height - aspectModelHeight) <= 1;

  const [imageRef, imageBrowser] = useImageMeasurement(String(imageWidth));
  const intrinsicRatio: AspectRatio | null = imageBrowser && imageBrowser.naturalWidth > 0 && imageBrowser.naturalHeight > 0
    ? {width: imageBrowser.naturalWidth, height: imageBrowser.naturalHeight}
    : null;
  const imageModelHeight = intrinsicRatio ? resolveAspectHeight({width: imageWidth, ratio: intrinsicRatio}) : null;
  const imageMatches = imageBrowser !== null && imageModelHeight !== null
    && Math.abs(imageBrowser.height - imageModelHeight) <= 1;

  const [scrollRef, scrollBrowser] = useScrollMeasurement(overflowMode, requestedScrollLeft);
  const horizontalExtent = scrollBrowser
    ? resolveOverflowExtent({clientSize: scrollBrowser.clientWidth, scrollSize: scrollBrowser.scrollWidth})
    : 0;
  const verticalExtent = scrollBrowser
    ? resolveOverflowExtent({clientSize: scrollBrowser.clientHeight, scrollSize: scrollBrowser.scrollHeight})
    : 0;
  const clampedRequest = clampScrollOffset({requested: requestedScrollLeft, maximum: horizontalExtent});
  const overflowStyle: CSSProperties = {overflow: overflowMode};

  return (
    <div className="sizing-depth-shell aspect-overflow-shell">
      <section className="experiment" id="aspect-overflow">
        <ExperimentHeader />
        <div className="experiment-grid">
          <div className="controls-panel">
            <RangeField label="aspect box width" value={aspectWidth} min={180} max={520} unit="px" onChange={setAspectWidth} />
            <SelectField label="aspect ratio" value={ratioLabel} options={Object.keys(ratios)} onChange={setRatioLabel} />
            <RangeField label="image width" value={imageWidth} min={160} max={520} unit="px" onChange={setImageWidth} />
            <SelectField label="overflow" value={overflowMode} options={["auto", "hidden", "clip", "visible"]} onChange={(value) => setOverflowMode(value as OverflowMode)} />
            <RangeField label="requested scrollLeft" value={requestedScrollLeft} min={0} max={260} unit="px" onChange={setRequestedScrollLeft} />
            <RuleList rules={[
              `.ratio-box { width: ${aspectWidth}px; aspect-ratio: ${ratioLabel}; }`,
              `.replaced-image { width: ${imageWidth}px; height: auto; }`,
              `.overflow-box { width: 320px; height: 160px; overflow: ${overflowMode}; }`,
              ".overflow-content { width: 560px; height: 260px; }",
            ]} />
          </div>

          <div className="aspect-overflow-demos">
            <div className="trace-panel">
              <div className="trace-heading">
                <div><strong>Non-replaced aspect ratio</strong><span>one definite axis plus an explicit ratio determines the other axis</span></div>
                <code>{ratioLabel}</code>
              </div>
              <div className="trace-metrics">
                <TraceMetric label="declared width" value={formatPx(aspectWidth)} />
                <TraceMetric label="model height" value={formatPx(aspectModelHeight)} />
                <TraceMetric label="browser height" value={`${formatPx(aspectBrowser?.height ?? null)}${aspectMatches ? " ✓" : ""}`} />
                <TraceMetric label="browser width" value={formatPx(aspectBrowser?.width ?? null)} />
              </div>
              <div className="aspect-stage">
                <div ref={aspectRef} className="aspect-demo-box" style={{width: aspectWidth, aspectRatio: ratioLabel}}>aspect-ratio</div>
              </div>
              <p className="trace-note">
                The deterministic helper covers only the direct width-to-height ratio arithmetic. Min/max constraints, transferred sizes, flex/grid participation, and replaced-element rules remain separate concerns.
              </p>
            </div>

            <div className="trace-panel">
              <div className="trace-heading">
                <div><strong>Replaced-element intrinsic ratio</strong><span>the browser decodes the embedded image&apos;s intrinsic dimensions and uses them with `height: auto`</span></div>
                <code>browser intrinsic size</code>
              </div>
              <div className="trace-metrics">
                <TraceMetric label="natural size" value={intrinsicRatio ? `${intrinsicRatio.width} × ${intrinsicRatio.height}` : "—"} />
                <TraceMetric label="rendered width" value={formatPx(imageBrowser?.width ?? null)} />
                <TraceMetric label="model height" value={formatPx(imageModelHeight)} />
                <TraceMetric label="browser height" value={`${formatPx(imageBrowser?.height ?? null)}${imageMatches ? " ✓" : ""}`} />
              </div>
              <div className="aspect-stage replaced-stage">
                <img
                  ref={imageRef}
                  className="replaced-demo-image"
                  src={REPLACED_IMAGE_SRC}
                  alt="Intrinsic 16 by 9 replaced-element fixture"
                  style={{width: imageWidth, height: "auto"}}
                />
              </div>
              <p className="trace-note">
                Intrinsic decoding stays browser-owned. The model begins only after the browser exposes `naturalWidth` and `naturalHeight`; it does not reproduce replaced-element sizing or object fitting.
              </p>
            </div>

            <div className="trace-panel">
              <div className="trace-heading">
                <div><strong>Overflow and scroll container</strong><span>compare the scrollable extent with the scroll position the browser actually accepts for each overflow mode</span></div>
                <code>overflow: {overflowMode}</code>
              </div>
              <div className="trace-metrics">
                <TraceMetric label="horizontal overflow" value={formatPx(horizontalExtent)} />
                <TraceMetric label="vertical overflow" value={formatPx(verticalExtent)} />
                <TraceMetric label="clamped request" value={formatPx(clampedRequest)} />
                <TraceMetric label="browser scrollLeft" value={formatPx(scrollBrowser?.scrollLeft ?? null)} />
              </div>
              <div ref={scrollRef} className="overflow-demo-box" style={overflowStyle} data-scroll-container>
                <div className="overflow-demo-content"><span>560 × 260 overflow content</span></div>
              </div>
              <div className="phase-list" aria-label="Overflow geometry evidence">
                <div className="phase-row">
                  <strong>client box</strong>
                  <span>{scrollBrowser ? `${scrollBrowser.clientWidth} × ${scrollBrowser.clientHeight}px` : "—"}</span>
                  <span>browser-owned viewport for the element&apos;s scrolling area</span>
                </div>
                <div className="phase-row">
                  <strong>scroll area</strong>
                  <span>{scrollBrowser ? `${scrollBrowser.scrollWidth} × ${scrollBrowser.scrollHeight}px` : "—"}</span>
                  <span>browser-owned overflow geometry</span>
                </div>
              </div>
              <p className="trace-note">
                The deterministic layer computes only overflow extent and clamps a requested offset to that extent. Whether a given `overflow` value clips, exposes scrolling UI, or accepts programmatic scrolling remains browser-owned evidence.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
