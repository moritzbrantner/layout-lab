export type InlineContainmentMode = "none" | "inline-size";

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function matchesMinInlineSize({
  containerInlineSize,
  minimumInlineSize,
}: {
  containerInlineSize: number;
  minimumInlineSize: number;
}) {
  return finiteNonNegative(containerInlineSize) >= finiteNonNegative(minimumInlineSize);
}

export function resolveIntrinsicInlineContribution({
  contentInlineSize,
  containment,
  fallbackInlineSize,
}: {
  contentInlineSize: number;
  containment: InlineContainmentMode;
  fallbackInlineSize: number;
}) {
  const content = finiteNonNegative(contentInlineSize);
  const fallback = finiteNonNegative(fallbackInlineSize);
  return containment === "inline-size" ? fallback : content;
}
