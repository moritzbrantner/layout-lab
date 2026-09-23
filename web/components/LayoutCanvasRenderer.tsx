"use client";

import {useEffect, useRef} from "react";
import {createLayoutCanvasScene} from "@/lib/layout-canvas-renderer";
import type {LayoutBox} from "@/lib/layout-geometry";

const VIEWPORT_HEIGHT = 260;
const FALLBACK_WIDTH = 720;

function readColor(style: CSSStyleDeclaration, name: string, fallback: string) {
  return style.getPropertyValue(name).trim() || fallback;
}

export function LayoutCanvasRenderer({
  root,
  title,
}: {
  root: LayoutBox;
  title: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const cssWidth = canvas.clientWidth > 0 ? canvas.clientWidth : FALLBACK_WIDTH;
      const cssHeight = canvas.clientHeight || VIEWPORT_HEIGHT;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssWidth * ratio);
      canvas.height = Math.round(cssHeight * ratio);

      const context = canvas.getContext("2d");
      if (!context) return;

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, cssWidth, cssHeight);

      const style = getComputedStyle(canvas);
      const background = readColor(style, "--bg", "#0b0d12");
      const panel = readColor(style, "--panel", "#121722");
      const line = readColor(style, "--line", "#2a3140");
      const text = readColor(style, "--text", "#f4f6fb");
      const muted = readColor(style, "--muted", "#aab3c4");
      const palette = [
        readColor(style, "--series-a", "#84d3b0"),
        readColor(style, "--series-b", "#8eb9ff"),
        readColor(style, "--series-c", "#e5b47a"),
        readColor(style, "--series-d", "#c9a0ff"),
        readColor(style, "--series-e", "#f08eaa"),
      ];

      context.fillStyle = background;
      context.fillRect(0, 0, cssWidth, cssHeight);

      const scene = createLayoutCanvasScene(root, {
        width: cssWidth,
        height: cssHeight,
        padding: 24,
      });

      scene.commands.forEach((command, index) => {
        const color = command.depth === 0 ? muted : palette[(index - 1) % palette.length]!;
        const {x, y, width, height} = command.rect;

        context.globalAlpha = command.depth === 0 ? 0.25 : 0.16;
        context.fillStyle = command.depth === 0 ? panel : color;
        context.fillRect(x, y, width, height);
        context.globalAlpha = 1;
        context.strokeStyle = command.depth === 0 ? line : color;
        context.lineWidth = command.depth === 0 ? 1 : 2;
        context.strokeRect(x, y, width, height);

        if (width >= 54 && height >= 24) {
          context.fillStyle = text;
          context.font = "600 12px ui-sans-serif, system-ui, sans-serif";
          context.textBaseline = "top";
          context.fillText(command.label, x + 8, y + 7, Math.max(0, width - 16));
        }

        if (width >= 72 && height >= 42) {
          context.fillStyle = muted;
          context.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
          context.fillText(command.id, x + 8, y + 24, Math.max(0, width - 16));
        }
      });
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [root]);

  return (
    <section className="layout-canvas-renderer" aria-labelledby="layout-canvas-title">
      <div className="layout-canvas-heading">
        <div>
          <div className="eyebrow">H6 renderer boundary</div>
          <h4 id="layout-canvas-title">2D Canvas resolved-box view</h4>
        </div>
        <p>
          Canvas consumes the same resolved <code>LayoutBox</code> tree as the geometry table. It only projects and paints geometry; layout authority stays in the engine.
        </p>
      </div>

      <canvas
        ref={canvasRef}
        className="layout-canvas"
        role="img"
        aria-label={`${title}: ${root.label} with ${root.children.length} direct children`}
        data-layout-canvas-root={root.id}
      />

      <div className="layout-canvas-evidence" aria-label="Canvas renderer evidence">
        <span><strong>{root.id}</strong> authoritative root box</span>
        <span><strong>responsive projection</strong> fit-to-viewport only</span>
        <span><strong>no DOM measurement</strong> renderer reads resolved geometry</span>
      </div>
    </section>
  );
}
