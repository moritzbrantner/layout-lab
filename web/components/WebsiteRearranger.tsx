"use client";

import {useEffect, useRef, useState} from "react";
import type {ChangeEvent, FormEvent} from "react";
import {
  describeImportedElement,
  normalizeWebsiteUrl,
  prepareImportedHtml,
} from "@/lib/website-rearranger";

type SelectionState = {
  label: string;
  x: number;
  y: number;
};

type DragState = {
  element: Element;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
};

function numericAttribute(element: Element, name: string): number {
  const value = Number(element.getAttribute(name) ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function styleFor(element: Element): CSSStyleDeclaration {
  return (element as HTMLElement).style;
}

export function WebsiteRearranger() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const detachFrameListenersRef = useRef<(() => void) | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [pastedHtml, setPastedHtml] = useState("");
  const [snapshotHtml, setSnapshotHtml] = useState<string | null>(null);
  const [loadedFrom, setLoadedFrom] = useState("No page loaded");
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [status, setStatus] = useState("Load a URL, HTML file, or pasted document to start rearranging it.");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => () => detachFrameListenersRef.current?.(), []);

  function attachFrameEditor() {
    detachFrameListenersRef.current?.();

    const document = frameRef.current?.contentDocument;
    if (!document) {
      return;
    }

    let selectedElement: Element | null = null;
    let drag: DragState | null = null;

    const updateSelection = (element: Element, x?: number, y?: number) => {
      selectedElement?.removeAttribute("data-layout-lab-selected");
      selectedElement = element;
      selectedElement.setAttribute("data-layout-lab-selected", "true");
      setSelection({
        label: describeImportedElement(element),
        x: x ?? numericAttribute(element, "data-layout-lab-x"),
        y: y ?? numericAttribute(element, "data-layout-lab-y"),
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      const element = event.target as Element | null;
      if (!element || element === document.documentElement || element === document.body || !("style" in element)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const originX = numericAttribute(element, "data-layout-lab-x");
      const originY = numericAttribute(element, "data-layout-lab-y");
      drag = {
        element,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX,
        originY,
        currentX: originX,
        currentY: originY,
      };

      updateSelection(element, originX, originY);
      element.setAttribute("data-layout-lab-dragging", "true");
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is an enhancement; document-level listeners still handle the drag.
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const x = Math.round(drag.originX + event.clientX - drag.startX);
      const y = Math.round(drag.originY + event.clientY - drag.startY);
      drag.currentX = x;
      drag.currentY = y;
      drag.element.setAttribute("data-layout-lab-moved", "true");
      drag.element.setAttribute("data-layout-lab-x", String(x));
      drag.element.setAttribute("data-layout-lab-y", String(y));
      styleFor(drag.element).setProperty("--layout-lab-x", `${x}px`);
      styleFor(drag.element).setProperty("--layout-lab-y", `${y}px`);
    };

    const finishDrag = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      drag.element.removeAttribute("data-layout-lab-dragging");
      try {
        drag.element.releasePointerCapture(event.pointerId);
      } catch {
        // The pointer may already have been released by the browser.
      }
      updateSelection(drag.element, drag.currentX, drag.currentY);
      drag = null;
    };

    const blockInteraction = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const blockedEvents = [
      "auxclick",
      "beforeinput",
      "change",
      "click",
      "contextmenu",
      "dblclick",
      "dragstart",
      "drop",
      "input",
      "keydown",
      "submit",
    ];

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointermove", handlePointerMove, true);
    document.addEventListener("pointerup", finishDrag, true);
    document.addEventListener("pointercancel", finishDrag, true);
    blockedEvents.forEach((eventName) => document.addEventListener(eventName, blockInteraction, true));

    detachFrameListenersRef.current = () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("pointerup", finishDrag, true);
      document.removeEventListener("pointercancel", finishDrag, true);
      blockedEvents.forEach((eventName) => document.removeEventListener(eventName, blockInteraction, true));
    };
  }

  function loadSnapshot(html: string, label: string, sourceUrl?: string) {
    if (!html.trim()) {
      setStatus("The imported HTML is empty.");
      return;
    }

    setSnapshotHtml(prepareImportedHtml(html, sourceUrl));
    setLoadedFrom(label);
    setSelection(null);
    setStatus("Snapshot loaded. Click and drag any visible element; links, forms, typing, and page scripts are blocked.");
  }

  async function handleUrlSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setSelection(null);

    try {
      const url = normalizeWebsiteUrl(urlInput);
      const response = await fetch(url, {
        credentials: "omit",
        mode: "cors",
        redirect: "follow",
      });
      if (!response.ok) {
        throw new Error(`The website returned HTTP ${response.status}.`);
      }

      const html = await response.text();
      const resolvedUrl = response.url || url;
      loadSnapshot(html, resolvedUrl, resolvedUrl);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The browser rejected the request.";
      setStatus(`${detail} Many websites block cross-origin HTML reads; paste the page HTML or load a saved HTML file instead.`);
    } finally {
      setIsLoading(false);
    }
  }

  function handlePastedHtmlSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadSnapshot(pastedHtml, "Pasted HTML");
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const html = await file.text();
    loadSnapshot(html, file.name);
    event.target.value = "";
  }

  function resetPositions() {
    const document = frameRef.current?.contentDocument;
    if (!document) {
      return;
    }

    document.querySelectorAll("[data-layout-lab-moved], [data-layout-lab-selected], [data-layout-lab-dragging]").forEach((element) => {
      element.removeAttribute("data-layout-lab-moved");
      element.removeAttribute("data-layout-lab-selected");
      element.removeAttribute("data-layout-lab-dragging");
      element.removeAttribute("data-layout-lab-x");
      element.removeAttribute("data-layout-lab-y");
      if ("style" in element) {
        styleFor(element).removeProperty("--layout-lab-x");
        styleFor(element).removeProperty("--layout-lab-y");
      }
    });
    setSelection(null);
    setStatus("All drag offsets were reset to the imported layout.");
  }

  return (
    <div className="website-rearranger">
      <aside className="website-source-panel" aria-label="Website import controls">
        <section>
          <div className="eyebrow">Source</div>
          <h2>Load a page</h2>
          <form className="website-url-form" onSubmit={handleUrlSubmit}>
            <label htmlFor="website-url">Website URL</label>
            <div className="website-url-row">
              <input
                id="website-url"
                type="text"
                inputMode="url"
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder="https://example.com"
              />
              <button type="submit" disabled={isLoading}>{isLoading ? "Loading…" : "Load"}</button>
            </div>
          </form>
        </section>

        <section className="website-import-fallbacks">
          <label className="website-file-input">
            <span>Saved HTML file</span>
            <input type="file" accept="text/html,.html,.htm" onChange={handleFileChange} />
          </label>

          <form onSubmit={handlePastedHtmlSubmit}>
            <label htmlFor="website-html">Or paste HTML</label>
            <textarea
              id="website-html"
              value={pastedHtml}
              onChange={(event) => setPastedHtml(event.target.value)}
              placeholder="<!doctype html>…"
              rows={8}
            />
            <button type="submit">Load pasted HTML</button>
          </form>
        </section>

        <p className="website-import-status" role="status">{status}</p>
        <p className="website-import-boundary">
          Layout Lab is a static GitHub Pages app, so it cannot bypass a site&apos;s CORS policy. Imported documents run without scripts or form/navigation privileges.
        </p>
      </aside>

      <section className="website-stage" aria-label="Rearrange imported website">
        <div className="website-stage-toolbar">
          <div>
            <strong>{loadedFrom}</strong>
            <span>
              {selection ? `${selection.label} · x ${selection.x}px · y ${selection.y}px` : "No element selected"}
            </span>
          </div>
          <button type="button" onClick={resetPositions} disabled={!snapshotHtml}>Reset positions</button>
        </div>

        <div className="website-frame-shell">
          {snapshotHtml ? (
            <iframe
              ref={frameRef}
              title="Imported website snapshot"
              srcDoc={snapshotHtml}
              sandbox="allow-same-origin"
              referrerPolicy="no-referrer"
              onLoad={attachFrameEditor}
            />
          ) : (
            <div className="website-frame-empty">
              Load a page to create an inert snapshot. Its own controls will not activate; dragging belongs to Layout Lab.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
