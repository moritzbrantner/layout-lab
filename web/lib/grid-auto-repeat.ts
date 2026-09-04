export type AutoRepeatMode = "auto-fit" | "auto-fill";

export type AutoRepeatResolution = {
  innerSize: number;
  gapSize: number;
  minTrackSize: number;
  itemCount: number;
  mode: AutoRepeatMode;
  explicitTrackCount: number;
  occupiedTrackCount: number;
  sizingTrackCount: number;
  collapsedTrackCount: number;
  emptyTrackCount: number;
  totalGap: number;
  trackSize: number;
  overflow: number;
};

export function resolveAutoRepeat({
  innerSize,
  gapSize,
  minTrackSize,
  itemCount,
  mode,
}: {
  innerSize: number;
  gapSize: number;
  minTrackSize: number;
  itemCount: number;
  mode: AutoRepeatMode;
}): AutoRepeatResolution {
  const safeInnerSize = Math.max(0, innerSize);
  const safeGap = Math.max(0, gapSize);
  const safeMinimum = Math.max(1, minTrackSize);
  const safeItems = Math.max(0, Math.floor(itemCount));
  const explicitTrackCount = Math.max(1, Math.floor((safeInnerSize + safeGap) / (safeMinimum + safeGap)));
  const occupiedTrackCount = Math.min(explicitTrackCount, safeItems);
  const sizingTrackCount = mode === "auto-fit" ? occupiedTrackCount : explicitTrackCount;
  const collapsedTrackCount = mode === "auto-fit" ? explicitTrackCount - occupiedTrackCount : 0;
  const emptyTrackCount = mode === "auto-fill" ? explicitTrackCount - occupiedTrackCount : 0;
  const totalGap = Math.max(0, sizingTrackCount - 1) * safeGap;
  const distributedTrackSize = sizingTrackCount > 0
    ? Math.max(0, safeInnerSize - totalGap) / sizingTrackCount
    : 0;
  const trackSize = sizingTrackCount > 0 ? Math.max(safeMinimum, distributedTrackSize) : 0;
  const usedSize = sizingTrackCount > 0 ? sizingTrackCount * trackSize + totalGap : 0;

  return {
    innerSize: safeInnerSize,
    gapSize: safeGap,
    minTrackSize: safeMinimum,
    itemCount: safeItems,
    mode,
    explicitTrackCount,
    occupiedTrackCount,
    sizingTrackCount,
    collapsedTrackCount,
    emptyTrackCount,
    totalGap,
    trackSize,
    overflow: Math.max(0, usedSize - safeInnerSize),
  };
}
