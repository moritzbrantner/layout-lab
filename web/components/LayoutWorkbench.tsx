"use client";

import {CSSProperties, useEffect, useMemo, useRef, useState} from "react";
import {
  applyWorkbenchPreset,
  createWorkbenchState,
  type WorkbenchItemId,
  type WorkbenchLayout,
  type WorkbenchPreset,
  type WorkbenchState,
  updateWorkbenchItem,
} from "@/lib/layout-workbench-model";

type Selection = "layout" | WorkbenchItemId;

type ItemGeometry = {
  id: WorkbenchItemId;
  width: number;
  height: number;
};

const itemNames: Record<WorkbenchItemId, string> = {
  A: "Navigation",
  B: "Primary panel",
  C: "Inspector",
  D: "Activity",
};

function RangeControl({
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
    <label className="workbench-field workbench-range">
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

function SelectControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="workbench-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function updateLayout(state: WorkbenchState, patch: Partial<WorkbenchLayout>): WorkbenchState {
  return {...state, layout: {...state.layout, ...patch}};
}

function WorkbenchTree({selection, state, onSelect}: {
  selection: Selection;
  state: WorkbenchState;
  onSelect: (selection: Selection) => void;
}) {
  return (
    <div className="workbench-tree" role="tree" aria-label="Object tree">
      <button
        type="button"
        role="treeitem"
        aria-selected={selection === "layout"}
        className={selection === "layout" ? "is-selected" : ""}
        onClick={() => onSelect("layout")}
      >
        <span className="tree-disclosure" aria-hidden="true">⌄</span>
        <span className="tree-icon" aria-hidden="true">▦</span>
        <span className="tree-label"><strong>Layout root</strong><small>{state.layout.mode}</small></span>
      </button>
      <div className="tree-children" role="group">
        {state.items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="treeitem"
            aria-selected={selection === item.id}
            className={selection === item.id ? "is-selected" : ""}
            onClick={() => onSelect(item.id)}
          >
            <span className="tree-icon tree-item-icon" aria-hidden="true">□</span>
            <span className="tree-label"><strong>{item.id} · {itemNames[item.id]}</strong><small>{state.layout.mode === "flex" ? `grow ${item.grow}` : `span ${item.gridSpan}`}</small></span>
          </button>
        ))}
      </div>
    </div>
  );
}

function InlinePanelHeader({title, onHide}: {title: string; onHide: () => void}) {
  return (
    <div className="workbench-inline-heading">
      <strong>{title}</strong>
      <button type="button" onClick={onHide} aria-label="Hide inline controls">Hide</button>
    </div>
  );
}

function LayoutControls({state, setState, onHide}: {
  state: WorkbenchState;
  setState: (state: WorkbenchState) => void;
  onHide: () => void;
}) {
  const layout = state.layout;
  return (
    <div className="workbench-inspector-fields">
      <InlinePanelHeader title="Layout root" onHide={onHide} />
      <SelectControl
        label="layout mode"
        value={layout.mode}
        options={["flex", "grid"] as const}
        onChange={(mode) => setState(updateLayout(state, {mode}))}
      />
      {layout.mode === "flex" ? (
        <>
          <SelectControl
            label="direction"
            value={layout.direction}
            options={["row", "column"] as const}
            onChange={(direction) => setState(updateLayout(state, {direction}))}
          />
          <SelectControl
            label="justify-content"
            value={layout.justify}
            options={["flex-start", "center", "space-between", "space-around", "space-evenly"] as const}
            onChange={(justify) => setState(updateLayout(state, {justify}))}
          />
          <SelectControl
            label="align-items"
            value={layout.align}
            options={["stretch", "flex-start", "center", "flex-end"] as const}
            onChange={(align) => setState(updateLayout(state, {align}))}
          />
          <label className="workbench-toggle">
            <input
              type="checkbox"
              checked={layout.wrap}
              onChange={(event) => setState(updateLayout(state, {wrap: event.target.checked}))}
            />
            <span>flex-wrap</span>
          </label>
        </>
      ) : (
        <RangeControl
          label="columns"
          value={layout.columns}
          min={1}
          max={4}
          onChange={(columns) => setState(updateLayout(state, {columns}))}
        />
      )}
      <RangeControl
        label="gap"
        value={layout.gap}
        min={0}
        max={48}
        step={2}
        unit="px"
        onChange={(gap) => setState(updateLayout(state, {gap}))}
      />
    </div>
  );
}

function ItemControls({id, state, setState, onHide}: {
  id: WorkbenchItemId;
  state: WorkbenchState;
  setState: (state: WorkbenchState) => void;
  onHide: () => void;
}) {
  const item = state.items.find((candidate) => candidate.id === id)!;
  const update = (patch: Parameters<typeof updateWorkbenchItem>[2]) => setState(updateWorkbenchItem(state, id, patch));

  return (
    <div className="workbench-inspector-fields">
      <InlinePanelHeader title={`${id} · ${itemNames[id]}`} onHide={onHide} />
      {state.layout.mode === "flex" ? (
        <>
          <RangeControl label="flex-grow" value={item.grow} min={0} max={8} onChange={(grow) => update({grow})} />
          <RangeControl label="flex-basis" value={item.basis} min={64} max={240} step={4} unit="px" onChange={(basis) => update({basis})} />
          <RangeControl label="flex-shrink" value={item.shrink} min={0} max={4} onChange={(shrink) => update({shrink})} />
          <RangeControl label="min-width" value={item.minWidth} min={40} max={180} step={4} unit="px" onChange={(minWidth) => update({minWidth: Math.min(minWidth, item.maxWidth)})} />
          <RangeControl label="max-width" value={item.maxWidth} min={96} max={420} step={4} unit="px" onChange={(maxWidth) => update({maxWidth: Math.max(maxWidth, item.minWidth)})} />
        </>
      ) : (
        <RangeControl label="grid-column span" value={item.gridSpan} min={1} max={Math.max(1, state.layout.columns)} onChange={(gridSpan) => update({gridSpan})} />
      )}
      <RangeControl label="Z depth" value={item.depth} min={-120} max={120} step={6} unit="px" onChange={(depth) => update({depth})} />
    </div>
  );
}

function measuredLabel(geometry: ItemGeometry[], id: WorkbenchItemId) {
  const item = geometry.find((candidate) => candidate.id === id);
  return item ? `${item.width}px` : "—";
}

export function LayoutWorkbench() {
  const [state, setState] = useState<WorkbenchState>(() => createWorkbenchState());
  const [selection, setSelection] = useState<Selection>("layout");
  const [geometry, setGeometry] = useState<ItemGeometry[]>([]);
  const [showControls, setShowControls] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);

  const refreshKey = useMemo(() => JSON.stringify(state), [state]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const measure = () => {
      const next = Array.from(stage.querySelectorAll<HTMLElement>("[data-workbench-item]")).map((element) => ({
        id: element.dataset.workbenchItem as WorkbenchItemId,
        width: Math.round(element.getBoundingClientRect().width),
        height: Math.round(element.getBoundingClientRect().height),
      }));
      setGeometry(next);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    stage.querySelectorAll<HTMLElement>("[data-workbench-item]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [refreshKey]);

  const containerStyle: CSSProperties = state.layout.mode === "flex"
    ? {
        display: "flex",
        flexDirection: state.layout.direction,
        justifyContent: state.layout.justify,
        alignItems: state.layout.align,
        flexWrap: state.layout.wrap ? "wrap" : "nowrap",
        gap: state.layout.gap,
      }
    : {
        display: "grid",
        gridTemplateColumns: `repeat(${state.layout.columns}, minmax(0, 1fr))`,
        alignItems: state.layout.align,
        gap: state.layout.gap,
      };

  const applyPreset = (preset: WorkbenchPreset) => {
    setState(applyWorkbenchPreset(preset, state.view));
    setSelection(preset === "equal" ? "layout" : "B");
    setShowControls(true);
  };

  const reset = () => {
    setState(createWorkbenchState());
    setSelection("layout");
    setShowControls(true);
  };

  const select = (next: Selection) => {
    setSelection(next);
    setShowControls(true);
  };

  return (
    <section className="layout-workbench" id="workbench" aria-labelledby="workbench-title">
      <header className="workbench-heading">
        <div>
          <div className="eyebrow">interactive editor</div>
          <h2 id="workbench-title">Object tree → constraints → live geometry</h2>
          <p>
            Select a node in the tree or directly in the viewport. Its controls open inside that element as an overlay, so editing stays spatially attached to the thing being changed without affecting measured layout geometry.
          </p>
        </div>
        <div className="workbench-view-switch" aria-label="Viewport mode">
          {(["2d", "3d"] as const).map((view) => (
            <button
              key={view}
              type="button"
              aria-pressed={state.view === view}
              className={state.view === view ? "is-active" : ""}
              onClick={() => setState({...state, view})}
            >
              {view.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <div className="workbench-presets" aria-label="Layout presets">
        <span>Try a transition:</span>
        <button type="button" onClick={() => applyPreset("equal")}>Equal growth</button>
        <button type="button" onClick={() => applyPreset("dominant-b")}>B grows ×5</button>
        <button type="button" onClick={() => applyPreset("max-clamp")}>B hits max-width</button>
        <button type="button" className="workbench-reset" onClick={reset}>Reset</button>
      </div>

      <div className="workbench-shell">
        <aside className="workbench-sidebar" aria-label="Object tree">
          <div className="workbench-panel-heading">
            <span>Objects</span>
            <small>Select to edit</small>
          </div>
          <WorkbenchTree selection={selection} state={state} onSelect={select} />
        </aside>

        <div className="workbench-main">
          <div className="workbench-viewport-toolbar">
            <div>
              <strong>{state.view === "2d" ? "2D layout viewport" : "3D layout viewport"}</strong>
              <span>{state.layout.mode} · {state.layout.gap}px gap</span>
            </div>
            <div className="workbench-viewport-actions">
              <code>{state.layout.mode === "flex" ? `display:flex; flex-direction:${state.layout.direction}` : `display:grid; columns:${state.layout.columns}`}</code>
              <button
                type="button"
                aria-pressed={showControls}
                onClick={() => setShowControls((visible) => !visible)}
              >
                {showControls ? "Hide controls" : "Show controls"}
              </button>
            </div>
          </div>

          <div className={`workbench-viewport ${state.view === "3d" ? "is-3d" : "is-2d"}`}>
            <div className="workbench-grid-floor" aria-hidden="true" />
            <div
              ref={stageRef}
              className={`workbench-layout-plane ${selection === "layout" ? "is-selected" : ""}`}
              style={{
                ...containerStyle,
                transform: state.view === "3d" ? "rotateX(52deg) rotateZ(-24deg)" : undefined,
                transformStyle: state.view === "3d" ? "preserve-3d" : undefined,
              }}
            >
              <button
                type="button"
                className="workbench-root-badge"
                aria-pressed={selection === "layout"}
                onClick={() => select("layout")}
              >
                root · {state.layout.mode}
              </button>

              {showControls && selection === "layout" ? (
                <div className="workbench-root-controls" onClick={(event) => event.stopPropagation()}>
                  <LayoutControls state={state} setState={setState} onHide={() => setShowControls(false)} />
                </div>
              ) : null}

              {state.items.map((item) => {
                const style: CSSProperties = state.layout.mode === "flex"
                  ? {
                      flex: `${item.grow} ${item.shrink} ${item.basis}px`,
                      minWidth: item.minWidth,
                      maxWidth: item.maxWidth,
                    }
                  : {
                      gridColumn: `span ${Math.min(item.gridSpan, state.layout.columns)}`,
                    };

                if (state.view === "3d") {
                  style.transform = `translateZ(${item.depth}px)`;
                }

                const isEditing = showControls && selection === item.id;

                return (
                  <article
                    key={item.id}
                    data-workbench-item={item.id}
                    className={`workbench-object object-${item.id.toLowerCase()} ${selection === item.id ? "is-selected" : ""} ${isEditing ? "is-editing" : ""}`}
                    style={style}
                  >
                    <button
                      type="button"
                      className="workbench-object-select"
                      aria-pressed={selection === item.id}
                      onClick={() => select(item.id)}
                    >
                      <span className="object-id">{item.id}</span>
                      <strong>{itemNames[item.id]}</strong>
                      <small>{state.layout.mode === "flex" ? `grow ${item.grow} · ${measuredLabel(geometry, item.id)}` : `span ${item.gridSpan} · ${measuredLabel(geometry, item.id)}`}</small>
                      {state.view === "3d" ? <em>{item.depth > 0 ? "+" : ""}{item.depth}px Z</em> : null}
                    </button>

                    {isEditing ? (
                      <div className="workbench-inline-controls" onClick={(event) => event.stopPropagation()}>
                        <ItemControls id={item.id} state={state} setState={setState} onHide={() => setShowControls(false)} />
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>

          <div className="workbench-readout" aria-live="polite">
            {state.items.map((item) => {
              const measured = geometry.find((candidate) => candidate.id === item.id);
              return (
                <div key={item.id} className={selection === item.id ? "is-selected" : ""}>
                  <span>{item.id}</span>
                  <strong>{measured ? `${measured.width} × ${measured.height}px` : "measuring…"}</strong>
                  <small>{state.layout.mode === "flex" ? `grow ${item.grow} / max ${item.maxWidth}px` : `span ${item.gridSpan}`}</small>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
