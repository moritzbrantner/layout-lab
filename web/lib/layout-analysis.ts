export type FlexItemInput = {
  label: string;
  basis: number;
  grow: number;
  shrink: number;
  minSize?: number;
  maxSize?: number;
};

export type FlexResolutionMode = "grow" | "shrink" | "none";
export type FlexClamp = "min" | "max" | null;

export type FlexItemResolution = FlexItemInput & {
  minSize: number;
  maxSize: number;
  weight: number;
  delta: number;
  targetSize: number;
  clamp: FlexClamp;
  frozen: boolean;
};

export type FlexIterationItem = {
  label: string;
  rawTarget: number;
  clampedTarget: number;
  clamp: FlexClamp;
  frozenBefore: boolean;
};

export type FlexIteration = {
  iteration: number;
  freeSpace: number;
  factorSum: number;
  newlyFrozen: string[];
  items: FlexIterationItem[];
};

export type FlexLineResolution = {
  innerSize: number;
  gapSize: number;
  totalGap: number;
  totalBasis: number;
  freeSpace: number;
  finalFreeSpace: number;
  mode: FlexResolutionMode;
  factorSum: number;
  frozenCount: number;
  iterations: FlexIteration[];
  items: FlexItemResolution[];
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function flexClamp(value: number, minimum: number, maximum: number): FlexClamp {
  if (value < minimum) return "min";
  if (value > maximum) return "max";
  return null;
}

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
  const normalized = items.map((item) => {
    const basis = Math.max(0, item.basis);
    const minimum = Math.max(0, item.minSize ?? 0);
    const maximum = Math.max(minimum, item.maxSize ?? Number.POSITIVE_INFINITY);
    return {
      ...item,
      basis,
      grow: Math.max(0, item.grow),
      shrink: Math.max(0, item.shrink),
      minSize: minimum,
      maxSize: maximum,
    };
  });
  const totalGap = Math.max(0, normalized.length - 1) * safeGap;
  const totalBasis = normalized.reduce((sum, item) => sum + item.basis, 0);
  const freeSpace = safeInnerSize - totalBasis - totalGap;
  const growFactorSum = normalized.reduce((sum, item) => sum + item.grow, 0);
  const shrinkFactorSum = normalized.reduce((sum, item) => sum + item.shrink * item.basis, 0);
  const mode: FlexResolutionMode = freeSpace > 0 && growFactorSum > 0
    ? "grow"
    : freeSpace < 0 && shrinkFactorSum > 0
      ? "shrink"
      : "none";
  const factorSum = mode === "grow" ? growFactorSum : mode === "shrink" ? shrinkFactorSum : 0;

  const targetSizes = normalized.map((item) => item.basis);
  const clamps: FlexClamp[] = normalized.map(() => null);
  const frozen = normalized.map(() => false);
  const iterations: FlexIteration[] = [];

  if (mode === "none") {
    normalized.forEach((item, index) => {
      const rawTarget = item.basis;
      const clampReason = flexClamp(rawTarget, item.minSize, item.maxSize);
      targetSizes[index] = clamp(rawTarget, item.minSize, item.maxSize);
      clamps[index] = clampReason;
      frozen[index] = clampReason !== null;
    });
  } else {
    for (let iteration = 1; iteration <= normalized.length + 1; iteration += 1) {
      const active = normalized
        .map((_, index) => index)
        .filter((index) => !frozen[index]);
      if (active.length === 0) break;

      const frozenTotal = normalized.reduce(
        (sum, _, index) => sum + (frozen[index] ? targetSizes[index]! : 0),
        0,
      );
      const activeBasis = active.reduce((sum, index) => sum + normalized[index]!.basis, 0);
      const iterationFreeSpace = safeInnerSize - totalGap - frozenTotal - activeBasis;
      const iterationFactorSum = active.reduce((sum, index) => {
        const item = normalized[index]!;
        return sum + (mode === "grow" ? item.grow : item.shrink * item.basis);
      }, 0);

      if (iterationFactorSum <= 0) break;

      const newlyFrozen: string[] = [];
      const iterationItems: FlexIterationItem[] = active.map((index) => {
        const item = normalized[index]!;
        const weight = mode === "grow" ? item.grow : item.shrink * item.basis;
        const rawTarget = item.basis + iterationFreeSpace * (weight / iterationFactorSum);
        const clampedTarget = clamp(rawTarget, item.minSize, item.maxSize);
        const clampReason = flexClamp(rawTarget, item.minSize, item.maxSize);
        if (clampReason !== null) newlyFrozen.push(item.label);
        return {
          label: item.label,
          rawTarget,
          clampedTarget,
          clamp: clampReason,
          frozenBefore: false,
        };
      });

      iterations.push({
        iteration,
        freeSpace: iterationFreeSpace,
        factorSum: iterationFactorSum,
        newlyFrozen,
        items: iterationItems,
      });

      if (newlyFrozen.length === 0) {
        active.forEach((index, activeIndex) => {
          targetSizes[index] = iterationItems[activeIndex]!.rawTarget;
          clamps[index] = null;
        });
        break;
      }

      active.forEach((index, activeIndex) => {
        const step = iterationItems[activeIndex]!;
        if (step.clamp !== null) {
          targetSizes[index] = step.clampedTarget;
          clamps[index] = step.clamp;
          frozen[index] = true;
        }
      });
    }
  }

  const resolvedItems = normalized.map((item, index): FlexItemResolution => {
    const targetSize = targetSizes[index]!;
    const weight = mode === "grow" ? item.grow : mode === "shrink" ? item.shrink * item.basis : 0;
    return {
      ...item,
      weight,
      delta: targetSize - item.basis,
      targetSize,
      clamp: clamps[index]!,
      frozen: frozen[index]!,
    };
  });
  const finalFreeSpace = safeInnerSize - totalGap - resolvedItems.reduce((sum, item) => sum + item.targetSize, 0);

  return {
    innerSize: safeInnerSize,
    gapSize: safeGap,
    totalGap,
    totalBasis,
    freeSpace,
    finalFreeSpace,
    mode,
    factorSum,
    frozenCount: resolvedItems.filter((item) => item.frozen).length,
    iterations,
    items: resolvedItems,
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

export type GridTrackInput = {
  label: string;
  minSize: number;
  fr: number;
};

export type GridSpanContribution = {
  label: string;
  start: number;
  span: number;
  minSize: number;
};

export type GridContributionStep = {
  label: string;
  start: number;
  span: number;
  requestedSize: number;
  internalGap: number;
  requiredTrackSize: number;
  before: number[];
  deficit: number;
  after: number[];
};

export type GridTrackResult = GridTrackInput & {
  baseSize: number;
  targetSize: number;
  frozen: boolean;
};

export type MinMaxGridResolution = {
  innerSize: number;
  gapSize: number;
  totalGap: number;
  availableForTracks: number;
  baseTotal: number;
  flexFraction: number;
  overflow: number;
  unusedSpace: number;
  contributionSteps: GridContributionStep[];
  tracks: GridTrackResult[];
};

export function resolveMinMaxFractionTracks({
  innerSize,
  gapSize,
  tracks,
  contributions = [],
}: {
  innerSize: number;
  gapSize: number;
  tracks: readonly GridTrackInput[];
  contributions?: readonly GridSpanContribution[];
}): MinMaxGridResolution {
  const safeInnerSize = Math.max(0, innerSize);
  const safeGap = Math.max(0, gapSize);
  const normalized = tracks.map((track) => ({
    ...track,
    minSize: Math.max(0, track.minSize),
    fr: Math.max(0, track.fr),
  }));
  const totalGap = Math.max(0, normalized.length - 1) * safeGap;
  const availableForTracks = Math.max(0, safeInnerSize - totalGap);
  const baseSizes = normalized.map((track) => track.minSize);
  const contributionSteps: GridContributionStep[] = [];

  [...contributions]
    .sort((left, right) => left.span - right.span || left.start - right.start)
    .forEach((contribution) => {
      const start = Math.max(0, Math.min(normalized.length, Math.floor(contribution.start)));
      const span = Math.max(1, Math.min(normalized.length - start, Math.floor(contribution.span)));
      if (span <= 0 || start >= normalized.length) return;
      const indices = Array.from({length: span}, (_, offset) => start + offset);
      const internalGap = Math.max(0, span - 1) * safeGap;
      const requestedSize = Math.max(0, contribution.minSize);
      const requiredTrackSize = Math.max(0, requestedSize - internalGap);
      const before = indices.map((index) => baseSizes[index]!);
      const current = before.reduce((sum, size) => sum + size, 0);
      const deficit = Math.max(0, requiredTrackSize - current);
      const share = indices.length > 0 ? deficit / indices.length : 0;
      indices.forEach((index) => {
        baseSizes[index] = baseSizes[index]! + share;
      });
      contributionSteps.push({
        label: contribution.label,
        start,
        span,
        requestedSize,
        internalGap,
        requiredTrackSize,
        before,
        deficit,
        after: indices.map((index) => baseSizes[index]!),
      });
    });

  const targetSizes = [...baseSizes];
  const frozen = normalized.map((track) => track.fr <= 0);
  let flexFraction = 0;

  for (let iteration = 0; iteration <= normalized.length; iteration += 1) {
    const active = normalized
      .map((_, index) => index)
      .filter((index) => !frozen[index] && normalized[index]!.fr > 0);
    if (active.length === 0) break;
    const fixedSize = normalized.reduce(
      (sum, _, index) => sum + (frozen[index] ? targetSizes[index]! : 0),
      0,
    );
    const factorSum = active.reduce((sum, index) => sum + normalized[index]!.fr, 0);
    flexFraction = factorSum > 0 ? Math.max(0, (availableForTracks - fixedSize) / factorSum) : 0;
    const undersized = active.filter((index) => flexFraction * normalized[index]!.fr < baseSizes[index]!);

    if (undersized.length === 0) {
      active.forEach((index) => {
        targetSizes[index] = flexFraction * normalized[index]!.fr;
      });
      break;
    }

    undersized.forEach((index) => {
      targetSizes[index] = baseSizes[index]!;
      frozen[index] = true;
    });
  }

  const baseTotal = baseSizes.reduce((sum, size) => sum + size, 0);
  const targetTotal = targetSizes.reduce((sum, size) => sum + size, 0);
  const overflow = Math.max(0, targetTotal - availableForTracks);
  const unusedSpace = Math.max(0, availableForTracks - targetTotal);

  return {
    innerSize: safeInnerSize,
    gapSize: safeGap,
    totalGap,
    availableForTracks,
    baseTotal,
    flexFraction,
    overflow,
    unusedSpace,
    contributionSteps,
    tracks: normalized.map((track, index) => ({
      ...track,
      baseSize: baseSizes[index]!,
      targetSize: targetSizes[index]!,
      frozen: frozen[index]!,
    })),
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
