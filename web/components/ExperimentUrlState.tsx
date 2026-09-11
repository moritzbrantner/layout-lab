"use client";

import {useEffect, useRef} from "react";
import {
  experimentUrlSchemas,
  readExperimentUrlState,
  writeExperimentUrlState,
  type ExperimentUrlControl,
  type ExperimentUrlSchema,
} from "@/lib/experiment-url-state";
import type {Experiment} from "@/lib/experiments";

type ControlElement = HTMLInputElement | HTMLSelectElement;

function findControl(section: HTMLElement, definition: ExperimentUrlControl): ControlElement | null {
  for (const label of section.querySelectorAll<HTMLLabelElement>("label")) {
    const labelText = label.querySelector("span")?.textContent?.trim();
    if (labelText !== definition.label) continue;
    const control = label.querySelector<ControlElement>("input, select");
    if (control) return control;
  }
  return null;
}

function setNativeValue(control: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = control instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(control, value);
}

function applyControlValue(control: ControlElement, definition: ExperimentUrlControl, value: string) {
  if (definition.kind === "boolean") {
    if (!(control instanceof HTMLInputElement) || control.type !== "checkbox") return;
    const checked = value === "1";
    if (control.checked !== checked) control.click();
    return;
  }

  if (control.value === value) return;
  setNativeValue(control, value);
  control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? "change" : "input", {bubbles: true}));
}

function readControlValue(control: ControlElement, definition: ExperimentUrlControl): string {
  if (definition.kind === "boolean") {
    return control instanceof HTMLInputElement && control.checked ? "1" : "0";
  }
  return control.value;
}

function collectControlValues(section: HTMLElement, schema: ExperimentUrlSchema): Record<string, string> {
  const values: Record<string, string> = {};
  for (const definition of schema) {
    const control = findControl(section, definition);
    values[definition.key] = control ? readControlValue(control, definition) : definition.defaultValue;
  }
  return values;
}

function replaceSearch(
  experimentId: Experiment["id"],
  schema: ExperimentUrlSchema,
  values: Readonly<Record<string, string>>,
) {
  const nextSearch = writeExperimentUrlState(window.location.search, experimentId, schema, values);
  const currentSearch = window.location.search.startsWith("?")
    ? window.location.search.slice(1)
    : window.location.search;
  if (nextSearch === currentSearch) return;

  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}

export function ExperimentUrlState({experimentId}: {experimentId: Experiment["id"]}) {
  const restoringRef = useRef(false);

  useEffect(() => {
    const schema = experimentUrlSchemas[experimentId];
    if (!schema) return;

    const selection = document.querySelector<HTMLElement>(`.single-editor-selection[data-editor="${experimentId}"]`);
    const section = selection?.querySelector<HTMLElement>(`#${experimentId}`);
    if (!section) return;

    const applyFromLocation = () => {
      restoringRef.current = true;
      const values = readExperimentUrlState(window.location.search, experimentId, schema);
      replaceSearch(experimentId, schema, values);
      for (const definition of schema) {
        const control = findControl(section, definition);
        if (control) applyControlValue(control, definition, values[definition.key] ?? definition.defaultValue);
      }
      queueMicrotask(() => {
        restoringRef.current = false;
      });
    };

    const persistCurrentState = () => {
      if (restoringRef.current) return;
      replaceSearch(experimentId, schema, collectControlValues(section, schema));
    };

    applyFromLocation();
    section.addEventListener("input", persistCurrentState);
    section.addEventListener("change", persistCurrentState);
    window.addEventListener("popstate", applyFromLocation);

    return () => {
      section.removeEventListener("input", persistCurrentState);
      section.removeEventListener("change", persistCurrentState);
      window.removeEventListener("popstate", applyFromLocation);
    };
  }, [experimentId]);

  return null;
}
