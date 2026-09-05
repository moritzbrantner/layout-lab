export const workbenchItemIds = ["A", "B", "C", "D"] as const;

export type WorkbenchItemId = string;
export type WorkbenchViewMode = "2d" | "3d";
export type WorkbenchLayoutMode = "flex" | "grid";
export type WorkbenchPreset = "equal" | "dominant-b" | "max-clamp";
export type WorkbenchMoveDirection = "up" | "down";
export type WorkbenchParentId = "layout" | WorkbenchItemId;

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
  children: WorkbenchItem[];
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

type WorkbenchItemLocation = {
  parentId: WorkbenchParentId;
  index: number;
  item: WorkbenchItem;
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

export function itemIdForOrdinal(ordinal: number): string {
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
    children: [],
  };
}

function findLocation(
  items: WorkbenchItem[],
  id: WorkbenchItemId,
  parentId: WorkbenchParentId = "layout",
): WorkbenchItemLocation | null {
  for (const [index, item] of items.entries()) {
    if (item.id === id) return {parentId, index, item};
    const nested = findLocation(item.children, id, item.id);
    if (nested) return nested;
  }
  return null;
}

export function findWorkbenchItem(items: WorkbenchItem[], id: WorkbenchItemId): WorkbenchItem | null {
  return findLocation(items, id)?.item ?? null;
}

function updateItems(
  items: WorkbenchItem[],
  id: WorkbenchItemId,
  update: (item: WorkbenchItem) => WorkbenchItem,
): WorkbenchItem[] {
  return items.map((item) => {
    if (item.id === id) return update(item);
    const children = updateItems(item.children, id, update);
    return children === item.children ? item : {...item, children};
  });
}

function insertItem(
  items: WorkbenchItem[],
  parentId: WorkbenchParentId,
  index: number,
  itemToInsert: WorkbenchItem,
): WorkbenchItem[] {
  if (parentId === "layout") {
    const next = [...items];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, itemToInsert);
    return next;
  }

  return items.map((item) => {
    if (item.id === parentId) {
      const children = [...item.children];
      children.splice(Math.max(0, Math.min(index, children.length)), 0, itemToInsert);
      return {...item, children};
    }
    const children = insertItem(item.children, parentId, index, itemToInsert);
    return children === item.children ? item : {...item, children};
  });
}

function removeItem(
  items: WorkbenchItem[],
  id: WorkbenchItemId,
): {items: WorkbenchItem[]; removed: WorkbenchItem | null} {
  for (const [index, item] of items.entries()) {
    if (item.id === id) {
      return {
        items: [...items.slice(0, index), ...items.slice(index + 1)],
        removed: item,
      };
    }

    const nested = removeItem(item.children, id);
    if (nested.removed) {
      const next = [...items];
      next[index] = {...item, children: nested.items};
      return {items: next, removed: nested.removed};
    }
  }

  return {items, removed: null};
}

function containsItem(item: WorkbenchItem, id: WorkbenchItemId): boolean {
  return item.id === id || item.children.some((child) => containsItem(child, id));
}

function childCount(state: WorkbenchState, parentId: WorkbenchParentId): number {
  if (parentId === "layout") return state.items.length;
  return findWorkbenchItem(state.items, parentId)?.children.length ?? 0;
}

function mapTree(items: WorkbenchItem[], update: (item: WorkbenchItem) => WorkbenchItem): WorkbenchItem[] {
  return items.map((item) => {
    const updated = update(item);
    return {...updated, children: mapTree(updated.children, update)};
  });
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
    state.items = mapTree(state.items, (item) => item.id === "B" ? {...item, grow: 5, basis: 132} : item);
  }

  if (preset === "max-clamp") {
    state.items = mapTree(state.items, (item) => {
      if (item.id === "B") return {...item, grow: 8, basis: 132, maxWidth: 184};
      if (item.id === "C") return {...item, grow: 2};
      return item;
    });
  }

  return state;
}

export function addWorkbenchChild(state: WorkbenchState, parentId: WorkbenchParentId): WorkbenchState {
  if (parentId !== "layout" && !findWorkbenchItem(state.items, parentId)) return state;

  const id = itemIdForOrdinal(state.nextItemOrdinal);
  return {
    ...state,
    items: insertItem(state.items, parentId, childCount(state, parentId), makeItem(id)),
    nextItemOrdinal: state.nextItemOrdinal + 1,
  };
}

export function addWorkbenchItem(state: WorkbenchState): WorkbenchState {
  return addWorkbenchChild(state, "layout");
}

export function removeWorkbenchItem(state: WorkbenchState, id: WorkbenchItemId): WorkbenchState {
  const result = removeItem(state.items, id);
  return result.removed ? {...state, items: result.items} : state;
}

export function moveWorkbenchNode(
  state: WorkbenchState,
  id: WorkbenchItemId,
  targetParentId: WorkbenchParentId,
  targetIndex: number,
): WorkbenchState {
  if (id === targetParentId) return state;

  const source = findLocation(state.items, id);
  if (!source) return state;

  const targetParent = targetParentId === "layout" ? null : findWorkbenchItem(state.items, targetParentId);
  if (targetParentId !== "layout" && !targetParent) return state;
  if (targetParent && containsItem(source.item, targetParent.id)) return state;

  let insertionIndex = targetIndex;
  if (source.parentId === targetParentId && source.index < targetIndex) insertionIndex -= 1;

  const removed = removeItem(state.items, id);
  if (!removed.removed) return state;

  const stateAfterRemoval = {...state, items: removed.items};
  const maxIndex = childCount(stateAfterRemoval, targetParentId);
  const boundedIndex = Math.max(0, Math.min(insertionIndex, maxIndex));

  return {
    ...state,
    items: insertItem(removed.items, targetParentId, boundedIndex, removed.removed),
  };
}

export function moveWorkbenchItem(
  state: WorkbenchState,
  id: WorkbenchItemId,
  direction: WorkbenchMoveDirection,
): WorkbenchState {
  const source = findLocation(state.items, id);
  if (!source) return state;

  const targetIndex = direction === "up" ? source.index - 1 : source.index + 2;
  if (direction === "up" && source.index === 0) return state;
  if (direction === "down" && source.index === childCount(state, source.parentId) - 1) return state;
  return moveWorkbenchNode(state, id, source.parentId, targetIndex);
}

export function updateWorkbenchItem(
  state: WorkbenchState,
  id: WorkbenchItemId,
  patch: Partial<Omit<WorkbenchItem, "id" | "children">>,
): WorkbenchState {
  if (!findWorkbenchItem(state.items, id)) return state;
  return {
    ...state,
    items: updateItems(state.items, id, (item) => ({...item, ...patch})),
  };
}

export function visibleWorkbenchItems(items: WorkbenchItem[]): WorkbenchItem[] {
  const visible: WorkbenchItem[] = [];
  for (const item of items) {
    if (!item.visible) continue;
    visible.push(item);
    visible.push(...visibleWorkbenchItems(item.children));
  }
  return visible;
}
