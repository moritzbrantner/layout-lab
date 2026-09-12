"use client";

import {CSSProperties, RefObject, useEffect, useRef, useState} from "react";
import {
  collectAnimatedStyleProperties,
  includesPaintContainment,
  STANDARD_COMPOSITOR_LAYER_EVIDENCE,
} from "@/lib/compositing-observations";
import {experiments} from "@/lib/experiments";

type AnimationMode = "none" | "transform" | "opacity" | "left";
type WillChangeMode = "auto" | "transform" | "opacity";

type CompositingEvidence = {
  transform: string;
  opacity: string;
  filter: string;
  willChange: string;
  contain: string;
  animationCount: number;
  animatedProperties: string[];
  overflowProbeHit: boolean;
  probeLeft: number;
  probeTop: number;
};

function animationKeyframes(mode: AnimationMode): Keyframe[] | null {
  if (mode === "transform") return [{transform: "translateX(0px)"}, {transform: "translateX(28px)"}];
  if (mode === "opacity") return [{opacity: 1}, {opacity: 0.45}];
  if (mode === "left") return [{left: "0px"}, {left: "28px"}];
  return null;
}

function useCompositingEvidence(
  refreshKey: string,
  animationMode: AnimationMode,
): [RefObject<HTMLDivElement | null>, RefObject<HTMLDivElement | null>, CompositingEvidence] {
  const stageRef = useRef<HTMLDivElement>(null);
  const candidateRef = useRef<HTMLDivElement>(null);
  const [evidence, setEvidence] = useState<CompositingEvidence>({
    transform: "none",
    opacity: "1",
    filter: "none",
    willChange: "auto",
    contain: "none",
    animationCount: 0,
    animatedProperties: [],
    overflowProbeHit: true,
    probeLeft: 0,
    probeTop: 0,
  });

  useEffect(() => {
    const stage = stageRef.current;
    const candidate = candidateRef.current;
    if (!stage || !candidate) return;

    const keyframes = animationKeyframes(animationMode);
    const animation = keyframes
      ? candidate.animate(keyframes, {duration: 1200, iterations: Infinity, direction: "alternate", easing: "ease-in-out"})
      : null;

    const read = () => {
      const style = getComputedStyle(candidate);
      const stageRect = stage.getBoundingClientRect();
      const candidateRect = candidate.getBoundingClientRect();
      const probeX = candidateRect.right + 24;
      const probeY = candidateRect.top + candidateRect.height * 0.5;
      const hit = document.elementFromPoint(probeX, probeY);
      const animations = candidate.getAnimations();
      const animatedProperties = collectAnimatedStyleProperties(
        animations.flatMap((activeAnimation) => {
          const effect = activeAnimation.effect as KeyframeEffect | null;
          return effect?.getKeyframes() ?? [];
        }),
      );

      setEvidence({
        transform: style.transform,
        opacity: style.opacity,
        filter: style.filter,
        willChange: style.willChange,
        contain: style.contain,
        animationCount: animations.length,
        animatedProperties,
        overflowProbeHit: Boolean(hit?.closest("[data-compositing-overflow]")),
        probeLeft: probeX - stageRect.left,
        probeTop: probeY - stageRect.top,
      });
    };

    const frame = requestAnimationFrame(read);
    const observer = new ResizeObserver(read);
    observer.observe(stage);
    observer.observe(candidate);
    window.addEventListener("resize", read);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", read);
      animation?.cancel();
    };
  }, [refreshKey, animationMode]);

  return [stageRef, candidateRef, evidence];
}

function ExperimentHeader() {
  const experiment = experiments.find((candidate) => candidate.id === "compositing-observations")!;
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

function ToggleField({label, checked, onChange}: {label: string; checked: boolean; onChange: (checked: boolean) => void}) {
  return (
    <label className="toggle-control">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
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

export function CompositingObservationsExperiment() {
  const [transform3d, setTransform3d] = useState(true);
  const [opacity, setOpacity] = useState(0.85);
  const [blur, setBlur] = useState(0);
  const [willChange, setWillChange] = useState<WillChangeMode>("auto");
  const [paintContain, setPaintContain] = useState(false);
  const [animationMode, setAnimationMode] = useState<AnimationMode>("transform");
  const refreshKey = `${transform3d}:${opacity}:${blur}:${willChange}:${paintContain}:${animationMode}`;
  const [stageRef, candidateRef, evidence] = useCompositingEvidence(refreshKey, animationMode);
  const computedPaintContainment = includesPaintContainment(evidence.contain);

  const candidateStyle: CSSProperties = {
    transform: transform3d ? "translateZ(0)" : "none",
    opacity,
    filter: blur > 0 ? `blur(${blur}px)` : "none",
    willChange,
    contain: paintContain ? "paint" : "none",
  };

  return (
    <section className="experiment" id="compositing-observations">
      <ExperimentHeader />
      <div className="experiment-grid">
        <div className="controls-panel">
          <ToggleField label="translateZ(0)" checked={transform3d} onChange={setTransform3d} />
          <RangeField label="opacity" value={opacity} min={0.4} max={1} step={0.05} onChange={setOpacity} />
          <RangeField label="filter blur" value={blur} min={0} max={8} unit="px" onChange={setBlur} />
          <SelectField label="will-change" value={willChange} options={["auto", "transform", "opacity"]} onChange={(value) => setWillChange(value as WillChangeMode)} />
          <ToggleField label="contain: paint" checked={paintContain} onChange={setPaintContain} />
          <SelectField label="active animation" value={animationMode} options={["none", "transform", "opacity", "left"]} onChange={(value) => setAnimationMode(value as AnimationMode)} />
          <RuleList rules={[
            `.candidate { transform: ${transform3d ? "translateZ(0)" : "none"}; }`,
            `.candidate { opacity: ${opacity}; filter: ${blur > 0 ? `blur(${blur}px)` : "none"}; }`,
            `.candidate { will-change: ${willChange}; contain: ${paintContain ? "paint" : "none"}; }`,
            `animation evidence: ${animationMode}`,
          ]} />
        </div>

        <div>
          <div ref={stageRef} className="demo-stage compositing-observation-stage">
            <div ref={candidateRef} className="compositing-candidate" style={candidateStyle}>
              <strong>candidate</strong>
              <span>portable rendering evidence</span>
              <div className="compositing-overflow-child" data-compositing-overflow>overflow child</div>
            </div>
            <div
              className="compositing-probe-marker"
              style={{left: evidence.probeLeft, top: evidence.probeTop}}
              aria-hidden="true"
            >
              <span>overflow probe</span>
            </div>
          </div>

          <div className="trace-panel">
            <div className="trace-heading">
              <div>
                <strong>Portable compositing evidence</strong>
                <span>standard APIs expose rendering signals and consequences, not the internal layer tree</span>
              </div>
              <code>{STANDARD_COMPOSITOR_LAYER_EVIDENCE}</code>
            </div>
            <div className="trace-metrics">
              <TraceMetric label="actual compositor layer" value="not exposed" />
              <TraceMetric label="active animations" value={String(evidence.animationCount)} />
              <TraceMetric label="animated properties" value={evidence.animatedProperties.join(", ") || "none"} />
              <TraceMetric label="overflow child at probe" value={evidence.overflowProbeHit ? "hittable" : "clipped"} />
            </div>
            <div className="compositing-observation-grid">
              <div><span>computed transform</span><code>{evidence.transform}</code></div>
              <div><span>computed opacity</span><code>{evidence.opacity}</code></div>
              <div><span>computed filter</span><code>{evidence.filter}</code></div>
              <div><span>computed will-change</span><code>{evidence.willChange}</code></div>
              <div><span>computed contain</span><code>{evidence.contain}</code></div>
              <div><span>paint containment</span><code>{computedPaintContainment ? "yes" : "no"}</code></div>
            </div>
            <p className="trace-note">
              A transform, opacity, filter, `will-change`, or active transform/opacity animation can be relevant to a browser&apos;s compositing strategy, but none proves that this element owns a compositor layer or that an animation executes on the compositor thread. Standard web APIs do not expose those internal decisions. The paint-containment probe is different: `elementFromPoint()` gives a portable observable consequence when the overflowing child is clipped outside the contained box.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
