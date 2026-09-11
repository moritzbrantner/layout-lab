export type VerticalMarginMode = "collapse" | "separate";

export type VerticalMarginResolution = {
  mode: VerticalMarginMode;
  before: number;
  after: number;
  gap: number;
  rule: "max" | "sum";
};

export function resolveAdjacentPositiveMargins({
  mode,
  before,
  after,
}: {
  mode: VerticalMarginMode;
  before: number;
  after: number;
}): VerticalMarginResolution {
  const safeBefore = Number.isFinite(before) ? Math.max(0, before) : 0;
  const safeAfter = Number.isFinite(after) ? Math.max(0, after) : 0;
  return {
    mode,
    before: safeBefore,
    after: safeAfter,
    gap: mode === "collapse" ? Math.max(safeBefore, safeAfter) : safeBefore + safeAfter,
    rule: mode === "collapse" ? "max" : "sum",
  };
}
