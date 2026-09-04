import type {Experiment} from "@/lib/experiments";

export type EditorCollection = "foundation" | "sizing" | "grid" | "three-d" | "compositing";

export const editorCollectionById: Record<Experiment["id"], EditorCollection> = {
  flex: "foundation",
  grid: "foundation",
  "intrinsic-sizing": "foundation",
  positioning: "foundation",
  "transforms-3d": "foundation",
  "flex-freezing": "sizing",
  "grid-track-sizing": "sizing",
  "grid-intrinsic": "grid",
  "grid-auto-repeat": "grid",
  "origins-3d": "three-d",
  "context-3d": "three-d",
  "stacking-contexts": "compositing",
  "hit-testing": "compositing",
};
