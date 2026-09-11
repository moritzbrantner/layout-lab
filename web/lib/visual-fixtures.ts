export const VISUAL_FIXTURE_SUITE = "layout-v1";

export type VisualFixture = {
  id: "flex-free-space" | "grid-tracks" | "positioned-transform";
  title: string;
  description: string;
  width: number;
  height: number;
};

export const visualFixtures: readonly VisualFixture[] = [
  {
    id: "flex-free-space",
    title: "Flex free-space distribution",
    description: "Fixed-size flex container with unequal grow factors, explicit bases, and a stable gap.",
    width: 360,
    height: 180,
  },
  {
    id: "grid-tracks",
    title: "Grid track distribution",
    description: "Fixed-size two-row grid with 1fr/2fr/1fr columns and explicit placement.",
    width: 360,
    height: 180,
  },
  {
    id: "positioned-transform",
    title: "Positioned transform overlap",
    description: "Fixed containing block with absolute positioning, integer translation, scale, and z-order overlap.",
    width: 360,
    height: 180,
  },
] as const;
