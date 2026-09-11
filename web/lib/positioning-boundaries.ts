export type AbsoluteReference = "inner positioned ancestor" | "outer positioned ancestor";
export type FixedReference = "inner transformed ancestor" | "outer transformed ancestor";

export function resolveAbsoluteReference(innerPositioned: boolean): AbsoluteReference {
  return innerPositioned ? "inner positioned ancestor" : "outer positioned ancestor";
}

export function resolveFixedReference(innerTransformed: boolean): FixedReference {
  return innerTransformed ? "inner transformed ancestor" : "outer transformed ancestor";
}

export function resolveStickyTop({
  normalTop,
  scrollTop,
  insetTop,
}: {
  normalTop: number;
  scrollTop: number;
  insetTop: number;
}): number {
  const safeNormalTop = Number.isFinite(normalTop) ? Math.max(0, normalTop) : 0;
  const safeScrollTop = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0;
  const safeInsetTop = Number.isFinite(insetTop) ? Math.max(0, insetTop) : 0;
  return Math.max(safeNormalTop - safeScrollTop, safeInsetTop);
}
