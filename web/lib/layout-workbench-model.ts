export const workbenchItemIds = ["A", "B", "C", "D"] as const;

export type WorkbenchItemId = (typeof workbenchItemIds)[number];
export type WorkbenchViewMode = "2d" | "3d";
export type WorkbenchLayoutMode = "flex" | "grid";
export type WorkbenchPreset = "equal" | "dominant-b" | "max-clamp";

export type WorkbenchItem = {
  id: WorkbenchItemId;
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
};

const defaultDepths: Record<WorkbenchItemId, number> = {
  A: -54,
  B: 18,
  C: 72,
  D: -8,
};

function makeItem(id: WorkbenchItemId): WorkbenchItem {
  return {
    id,
    basis: 112,
    grow: 1,
    shrink: 1,
    minWidth: 64,
    maxWidth: 360,
    gridSpan: 1,
    depth: defaultDepths[id],
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
