export type FlexItemInput = {
  label: string;
  basis: number;
  grow: number;
  shrink: number;
};

export type FlexResolutionMode = "grow" | "shrink" | "none";

export type FlexItemResolution = FlexItemInput & {
  weight: number;
  delta: number;
  targetSize: number;
};

export type FlexLineResolution = {
  innerSize: number;
  gapSize: number;
  totalGap: number;
  totalBasis: number;
  freeSpace: number;
  mode: FlexResolutionMode;
  factorSum: number;
  items: FlexItemResolution[];
};

export function resolveFlexLine({
  innerSize,
  gapSize,
  items,
}: {
  innerSize: number;
  gapSize: number;
  items: readonly FlexItemInput[];
}): FlexLineResolution {
  const safeInnerSize = Math.max(0, innerSize);
  const safeGap = Math.max(0, gapSize);
  const normalized = items.map((item) => ({
    ...item,
    basis: Math.max(0, item.basis),
    grow: Math.max(0, item.grow),
    shrink: Math.max(0, item.shrink),
  }));
  const totalGap = Math.max(0, normalized.length - 1) * safeGap;
  const totalBasis = normalized.reduce((sum, item) => sum + item.basis, 0);
  const freeSpace = safeInnerSize - totalBasis - totalGap;

  if (freeSpace > 0) {
    const factorSum = normalized.reduce((sum, item) => sum + item.grow, 0);
    const mode: FlexResolutionMode = factorSum > 0 ? "grow" : "none";
    return {
      innerSize: safeInnerSize,
      gapSize: safeGap,
      totalGap,
      totalBasis,
      freeSpace,
      mode,
      factorSum,
      items: normalized.map((item) => {
        const weight = item.grow;
        const delta = factorSum > 0 ? freeSpace * (weight / factorSum) : 0;
        return {...item, weight, delta, targetSize: item.basis + delta};
      }),
    };
  }

  if (freeSpace < 0) {
    const factorSum = normalized.reduce((sum, item) => sum + item.shrink * item.basis, 0);
    const mode: FlexResolutionMode = factorSum > 0 ? "shrink" : "none";
    return {
      innerSize: safeInnerSize,
      gapSize: safeGap,
      totalGap,
      totalBasis,
      freeSpace,
      mode,
      factorSum,
      items: normalized.map((item) => {
        const weight = item.shrink * item.basis;
        const delta = factorSum > 0 ? freeSpace * (weight / factorSum) : 0;
        return {...item, weight, delta, targetSize: Math.max(0, item.basis + delta)};
      }),
    };
  }

  return {
    innerSize: safeInnerSize,
    gapSize: safeGap,
    totalGap,
    totalBasis,
    freeSpace,
    mode: "none",
    factorSum: 0,
    items: normalized.map((item) => ({...item, weight: 0, delta: 0, targetSize: item.basis})),
  };
}

export type FractionTrackResolution = {
  innerSize: number;
  count: number;
  gapSize: number;
  totalGap: number;
  distributableSize: number;
  trackSize: number;
};

export function resolveEqualFractionTracks({
  innerSize,
  count,
  gapSize,
}: {
  innerSize: number;
  count: number;
  gapSize: number;
}): FractionTrackResolution {
  const safeInnerSize = Math.max(0, innerSize);
  const safeCount = Math.max(1, Math.floor(count));
  const safeGap = Math.max(0, gapSize);
  const totalGap = Math.max(0, safeCount - 1) * safeGap;
  const distributableSize = Math.max(0, safeInnerSize - totalGap);

  return {
    innerSize: safeInnerSize,
    count: safeCount,
    gapSize: safeGap,
    totalGap,
    distributableSize,
    trackSize: distributableSize / safeCount,
  };
}

export function resolveFitContentSize({
  minContent,
  maxContent,
  available,
}: {
  minContent: number;
  maxContent: number;
  available: number;
}) {
  const minimum = Math.max(0, Math.min(minContent, maxContent));
  const maximum = Math.max(minimum, maxContent);
  return Math.min(Math.max(minimum, Math.max(0, available)), maximum);
}
