export const workbenchItemIds = ["A", "B", "C", "D"] as const;

export type WorkbenchItemId = string;
export type WorkbenchViewMode = "2d" | "3d";
export type WorkbenchLayoutMode = "flex" | "grid";
export type WorkbenchPreset = "equal" | "dominant-b" | "max-clamp";
export type WorkbenchMoveDirection = "up" | "down";

export type WorkbenchItem = {
  id: WorkbenchItemId;
  name: string;
  visible: boolean;
  basis: number;
  grow: number;
  shrink: number;
  minWidth: number;
  maxWidth: number;
  gridSpan: number;
  depth: number;
};

export type WorkbenchLayout = {
  mode: WorkbenchLayoutMode;
  direction: "row" | "column";
  justify: "flex-start" | "center" | "space-between" | "space-around" | "space-evenly";
  align: "stretch" | "flex-start" | "center" | "flex-end";
  wrap: boolean;
  gap: number;
  columns: number;
};

export type WorkbenchState = {
  view: WorkbenchViewMode;
  layout: WorkbenchLayout;
  items: WorkbenchItem[];
  nextItemOrdinal: number;
};

const defaultNames: Record<string, string> = {
  A: "Navigation",
  B: "Primary panel",
  C: "Inspector",
  D: "Activity",
};

const defaultDepths: Record<string, number> = {
  A: -54,
  B: 18,
  C: 72,
  D: -8,
};

function itemIdForOrdinal(ordinal: number): string {
  let current = Math.max(1, Math.floor(ordinal));
  let id = "";

  while (current > 0) {
    current -= 1;
    id = String.fromCharCode(65 + (current % 26)) + id;
    current = Math.floor(current / 26);
  }

  return id;
}

function makeItem(id: WorkbenchItemId): WorkbenchItem {
  return {
    id,
    name: defaultNames[id] ?? `Object ${id}`,
    visible: true,
    basis: 112,
    grow: 1,
    shrink: 1,
    minWidth: 64,
    maxWidth: 360,
    gridSpan: 1,
    depth: defaultDepths[id] ?? 0,
  };
}

export function createWorkbenchState(): WorkbenchState {
  return {
    view: "2d",
    layout: {
      mode: "flex",
      direction: "row",
      justify: "flex-start",
      align: "stretch",
      wrap: false,
      gap: 16,
      columns: 4,
    },
    items: workbenchItemIds.map(makeItem),
    nextItemOrdinal: workbenchItemIds.length + 1,
  };
}

export function applyWorkbenchPreset(preset: WorkbenchPreset, view: WorkbenchViewMode = "2d"): WorkbenchState {
  const state = createWorkbenchState();
  state.view = view;

  if (preset === "dominant-b") {
    state.items = state.items.map((item) => item.id === "B" ? {...item, grow: 5, basis: 132} : item);
  }

  if (preset === "max-clamp") {
    state.items = state.items.map((item) => {
      if (item.id === "B") return {...item, grow: 8, basis: 132, maxWidth: 184};
      if (item.id === "C") return {...item, grow: 2};
      return item;
    });
  }

  return state;
}

export function addWorkbenchItem(state: WorkbenchState): WorkbenchState {
  const id = itemIdForOrdinal(state.nextItemOrdinal);
  return {
    ...state,
    items: [...state.items, makeItem(id)],
    nextItemOrdinal: state.nextItemOrdinal + 1,
  };
}

export function removeWorkbenchItem(state: WorkbenchState, id: WorkbenchItemId): WorkbenchState {
  if (!state.items.some((item) => item.id === id)) return state;
  return {...state, items: state.items.filter((item) => item.id !== id)};
}

export function moveWorkbenchItem(
  state: WorkbenchState,
  id: WorkbenchItemId,
  direction: WorkbenchMoveDirection,
): WorkbenchState {
  const index = state.items.findIndex((item) => item.id === id);
  if (index < 0) return state;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= state.items.length) return state;

  const items = [...state.items];
  [items[index], items[targetIndex]] = [items[targetIndex], items[index]];
  return {...state, items};
}

export function updateWorkbenchItem(
  state: WorkbenchState,
  id: WorkbenchItemId,
  patch: Partial<Omit<WorkbenchItem, "id">>,
): WorkbenchState {
  return {
    ...state,
    items: state.items.map((item) => item.id === id ? {...item, ...patch} : item),
  };
}
