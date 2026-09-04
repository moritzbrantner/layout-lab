"use client";

import {CSSProperties, useEffect, useMemo, useRef, useState} from "react";
import {
  addWorkbenchItem,
  applyWorkbenchPreset,
  createWorkbenchState,
  moveWorkbenchItem,
  removeWorkbenchItem,
  type WorkbenchItemId,
  type WorkbenchLayout,
  type WorkbenchMoveDirection,
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

function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);

  useEffect(() => {
    draftRef.current = value;
    setDraft(value);
  }, [value]);

  const updateDraft = (next: number) => {
    draftRef.current = next;
    setDraft(next);
  };

  const commit = () => {
    if (draftRef.current !== value) onCommit(draftRef.current);
  };

  return (
    <label className="workbench-field workbench-range">
      <span>{label}</span>
      <output>{draft}{unit}</output>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(event) => updateDraft(Number(event.target.value))}
        onMouseUp={commit}
        onTouchEnd={commit}
        onKeyUp={commit}
        onBlur={commit}
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

function WorkbenchTree({
  selection,
  state,
  onSelect,
  onAdd,
  onDelete,
  onMove,
  onToggleVisibility,
}: {
  selection: Selection;
  state: WorkbenchState;
  onSelect: (selection: Selection) => void;
  onAdd: () => void;
  onDelete: (id: WorkbenchItemId) => void;
  onMove: (id: WorkbenchItemId, direction: WorkbenchMoveDirection) => void;
  onToggleVisibility: (id: WorkbenchItemId, visible: boolean) => void;
}) {
  return (
    <>
      <div className="workbench-panel-heading">
        <span>Objects</span>
        <button type="button" className="workbench-add-object" onClick={onAdd}>+ Add object</button>
      </div>
      <div className="workbench-tree" role="tree" aria-label="Object tree">
        <button
          type="button"
          role="treeitem"
          aria-selected={selection === "layout"}
          className={`workbench-tree-root ${selection === "layout" ? "is-selected" : ""}`}
          onClick={() => onSelect("layout")}
        >
          <span className="tree-disclosure" aria-hidden="true">⌄</span>
          <span className="tree-icon" aria-hidden="true">▦</span>
          <span className="tree-label"><strong>Layout root</strong><small>{state.layout.mode}</small></span>
        </button>
        <div className="tree-children" role="group">
          {state.items.map((item, index) => (
            <div
              key={item.id}
              role="treeitem"
              aria-selected={selection === item.id}
              className={`tree-row ${selection === item.id ? "is-selected" : ""} ${item.visible ? "" : "is-hidden"}`}
            >
              <input
                className="tree-visibility"
                type="checkbox"
                checked={item.visible}
                aria-label={`${item.visible ? "Hide" : "Show"} ${item.id} · ${item.name}`}
                onChange={(event) => onToggleVisibility(item.id, event.target.checked)}
              />
              <button
                type="button"
                className="tree-select"
                aria-label={`Edit ${item.id} · ${item.name}`}
                onClick={() => onSelect(item.id)}
              >
                <span className="tree-label">
                  <strong>{item.id} · {item.name}</strong>
                  <small>{state.layout.mode === "flex" ? `grow ${item.grow}` : `span ${item.gridSpan}`}</small>
                </span>
              </button>
              <div className="tree-actions" aria-label={`Actions for ${item.id} · ${item.name}`}>
                <button
                  type="button"
                  className="tree-action"
                  aria-label={`Move ${item.id} up`}
                  disabled={index === 0}
                  onClick={() => onMove(item.id, "up")}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="tree-action"
                  aria-label={`Move ${item.id} down`}
                  disabled={index === state.items.length - 1}
                  onClick={() => onMove(item.id, "down")}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="tree-action tree-delete"
                  aria-label={`Delete ${item.id} · ${item.name}`}
                  onClick={() => onDelete(item.id)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function InspectorHeading({title, subtitle}: {title: string; subtitle: string}) {
  return (
    <div className="workbench-inspector-heading">
      <strong>{title}</strong>
      <span>{subtitle}</span>
    </div>
  );
}

function LayoutControls({state, setState}: {
  state: WorkbenchState;
  setState: (state: WorkbenchState) => void;
}) {
  const layout = state.layout;
  return (
    <div className="workbench-inspector-fields">
      <InspectorHeading title="Layout root" subtitle="Container constraints" />
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
          onCommit={(columns) => setState(updateLayout(state, {columns}))}
        />
      )}
      <RangeControl
        label="gap"
        value={layout.gap}
        min={0}
        max={48}
        step={2}
        unit="px"
        onCommit={(gap) => setState(updateLayout(state, {gap}))}
      />
    </div>
  );
}

function ItemControls({id, state, setState}: {
  id: WorkbenchItemId;
  state: WorkbenchState;
  setState: (state: WorkbenchState) => void;
}) {
  const item = state.items.find((candidate) => candidate.id === id);
  if (!item) return <p className="workbench-empty-inspector">Select an object to edit its constraints.</p>;

  const update = (patch: Parameters<typeof updateWorkbenchItem>[2]) => setState(updateWorkbenchItem(state, id, patch));

  return (
    <div className="workbench-inspector-fields">
      <InspectorHeading title={`${item.id} · ${item.name}`} subtitle={item.visible ? "Visible object" : "Hidden object"} />
      {state.layout.mode === "flex" ? (
        <>
          <RangeControl label="flex-grow" value={item.grow} min={0} max={8} onCommit={(grow) => update({grow})} />
          <RangeControl label="flex-basis" value={item.basis} min={64} max={240} step={4} unit="px" onCommit={(basis) => update({basis})} />
          <RangeControl label="flex-shrink" value={item.shrink} min={0} max={4} onCommit={(shrink) => update({shrink})} />
          <RangeControl label="min-width" value={item.minWidth} min={40} max={180} step={4} unit="px" onCommit={(minWidth) => update({minWidth: Math.min(minWidth, item.maxWidth)})} />
          <RangeControl label="max-width" value={item.maxWidth} min={96} max={420} step={4} unit="px" onCommit={(maxWidth) => update({maxWidth: Math.max(maxWidth, item.minWidth)})} />
        </>
      ) : (
        <RangeControl
          label="grid-column span"
          value={Math.min(item.gridSpan, Math.max(1, state.layout.columns))}
          min={1}
          max={Math.max(1, state.layout.columns)}
          onCommit={(gridSpan) => update({gridSpan})}
        />
      )}
      <RangeControl label="Z depth" value={item.depth} min={-120} max={120} step={6} unit="px" onCommit={(depth) => update({depth})} />
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
  const stageRef = useRef<HTMLDivElement>(null);

  const refreshKey = useMemo(() => JSON.stringify(state), [state]);
  const visibleItems = state.items.filter((item) => item.visible);

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
  };

  const reset = () => {
    setState(createWorkbenchState());
    setSelection("layout");
  };

  const addItem = () => {
    const next = addWorkbenchItem(state);
    const added = next.items.at(-1);
    setState(next);
    if (added) setSelection(added.id);
  };

  const deleteItem = (id: WorkbenchItemId) => {
    const index = state.items.findIndex((item) => item.id === id);
    const next = removeWorkbenchItem(state, id);
    setState(next);

    if (selection === id) {
      const fallback = next.items[Math.min(Math.max(index, 0), Math.max(0, next.items.length - 1))];
      setSelection(fallback?.id ?? "layout");
    }
  };

  const moveItem = (id: WorkbenchItemId, direction: WorkbenchMoveDirection) => {
    setState(moveWorkbenchItem(state, id, direction));
  };

  const toggleVisibility = (id: WorkbenchItemId, visible: boolean) => {
    setState(updateWorkbenchItem(state, id, {visible}));
  };

  return (
    <section className="layout-workbench" id="workbench" aria-labelledby="workbench-title">
      <header className="workbench-heading">
        <div>
          <div className="eyebrow">interactive editor</div>
          <h2 id="workbench-title">Object tree → constraints → live geometry</h2>
          <p>
            Build and reorder the object tree on the left, select any node, then edit its constraints in the inspector on the right. Slider changes are previewed in the control and committed only when the interaction ends.
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
          <WorkbenchTree
            selection={selection}
            state={state}
            onSelect={setSelection}
            onAdd={addItem}
            onDelete={deleteItem}
            onMove={moveItem}
            onToggleVisibility={toggleVisibility}
          />
        </aside>

        <div className="workbench-main">
          <div className="workbench-viewport-toolbar">
            <div>
              <strong>{state.view === "2d" ? "2D layout viewport" : "3D layout viewport"}</strong>
              <span>{state.layout.mode} · {state.layout.gap}px gap</span>
            </div>
            <div className="workbench-viewport-actions">
              <code>{state.layout.mode === "flex" ? `display:flex; flex-direction:${state.layout.direction}` : `display:grid; columns:${state.layout.columns}`}</code>
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
                onClick={() => setSelection("layout")}
              >
                root · {state.layout.mode}
              </button>

              {visibleItems.map((item) => {
                const style: CSSProperties = state.layout.mode === "flex"
                  ? {
                      flex: `${item.grow} ${item.shrink} ${item.basis}px`,
                      minWidth: item.minWidth,
                      maxWidth: item.maxWidth,
                    }
                  : {
                      gridColumn: `span ${Math.min(item.gridSpan, state.layout.columns)}`,
                    };

                if (state.view === "3d") style.transform = `translateZ(${item.depth}px)`;

                return (
                  <article
                    key={item.id}
                    data-workbench-item={item.id}
                    className={`workbench-object object-${item.id.toLowerCase()} ${selection === item.id ? "is-selected" : ""}`}
                    style={style}
                  >
                    <button
                      type="button"
                      className="workbench-object-select"
                      aria-pressed={selection === item.id}
                      onClick={() => setSelection(item.id)}
                    >
                      <span className="object-id">{item.id}</span>
                      <strong>{item.name}</strong>
                      <small>{state.layout.mode === "flex" ? `grow ${item.grow} · ${measuredLabel(geometry, item.id)}` : `span ${item.gridSpan} · ${measuredLabel(geometry, item.id)}`}</small>
                      {state.view === "3d" ? <em>{item.depth > 0 ? "+" : ""}{item.depth}px Z</em> : null}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="workbench-readout" aria-live="polite">
            {visibleItems.length > 0 ? visibleItems.map((item) => {
              const measured = geometry.find((candidate) => candidate.id === item.id);
              return (
                <div key={item.id} className={selection === item.id ? "is-selected" : ""}>
                  <span>{item.id}</span>
                  <strong>{measured ? `${measured.width} × ${measured.height}px` : "measuring…"}</strong>
                  <small>{state.layout.mode === "flex" ? `grow ${item.grow} / max ${item.maxWidth}px` : `span ${item.gridSpan}`}</small>
                </div>
              );
            }) : (
              <div className="workbench-readout-empty">All objects are hidden. Use the tree checkboxes to show one again.</div>
            )}
          </div>
        </div>

        <aside className="workbench-inspector" aria-label="Edit inspector">
          <div className="workbench-inspector-tabs" role="tablist" aria-label="Inspector tabs">
            <button
              id="workbench-edit-tab"
              type="button"
              role="tab"
              aria-selected="true"
              aria-controls="workbench-edit-panel"
            >
              Edit
            </button>
          </div>
          <div
            id="workbench-edit-panel"
            className="workbench-inspector-body"
            role="tabpanel"
            aria-labelledby="workbench-edit-tab"
          >
            {selection === "layout" ? (
              <LayoutControls state={state} setState={setState} />
            ) : (
              <ItemControls id={selection} state={state} setState={setState} />
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
