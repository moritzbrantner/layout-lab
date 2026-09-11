export type FlexMinimumMode = "auto" | "zero";

export type FlexMinimumFloor = {
  mode: FlexMinimumMode;
  measuredMinContent: number;
  minimum: number;
  source: "browser min-content" | "explicit zero";
};

export function resolveFlexMinimumFloor({
  mode,
  minContentSize,
}: {
  mode: FlexMinimumMode;
  minContentSize: number;
}): FlexMinimumFloor {
  const measuredMinContent = Number.isFinite(minContentSize) ? Math.max(0, minContentSize) : 0;
  return {
    mode,
    measuredMinContent,
    minimum: mode === "auto" ? measuredMinContent : 0,
    source: mode === "auto" ? "browser min-content" : "explicit zero",
  };
}
