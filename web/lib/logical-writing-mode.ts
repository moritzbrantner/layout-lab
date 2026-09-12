export type WritingMode = "horizontal-tb" | "vertical-rl" | "vertical-lr";
export type Direction = "ltr" | "rtl";
export type PhysicalSide = "top" | "right" | "bottom" | "left";

export type LogicalAxes = {
  inlineAxis: "horizontal" | "vertical";
  blockAxis: "horizontal" | "vertical";
  inlineStart: PhysicalSide;
  inlineEnd: PhysicalSide;
  blockStart: PhysicalSide;
  blockEnd: PhysicalSide;
};

export function resolveLogicalAxes({
  writingMode,
  direction,
}: {
  writingMode: WritingMode;
  direction: Direction;
}): LogicalAxes {
  if (writingMode === "horizontal-tb") {
    return {
      inlineAxis: "horizontal",
      blockAxis: "vertical",
      inlineStart: direction === "ltr" ? "left" : "right",
      inlineEnd: direction === "ltr" ? "right" : "left",
      blockStart: "top",
      blockEnd: "bottom",
    };
  }

  return {
    inlineAxis: "vertical",
    blockAxis: "horizontal",
    inlineStart: direction === "ltr" ? "top" : "bottom",
    inlineEnd: direction === "ltr" ? "bottom" : "top",
    blockStart: writingMode === "vertical-rl" ? "right" : "left",
    blockEnd: writingMode === "vertical-rl" ? "left" : "right",
  };
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function resolveLogicalSize({
  inlineSize,
  blockSize,
  writingMode,
}: {
  inlineSize: number;
  blockSize: number;
  writingMode: WritingMode;
}) {
  const safeInlineSize = finiteNonNegative(inlineSize);
  const safeBlockSize = finiteNonNegative(blockSize);
  return writingMode === "horizontal-tb"
    ? {width: safeInlineSize, height: safeBlockSize}
    : {width: safeBlockSize, height: safeInlineSize};
}

export function resolveLogicalPosition({
  containerWidth,
  containerHeight,
  inlineSize,
  blockSize,
  inlineStart,
  blockStart,
  writingMode,
  direction,
}: {
  containerWidth: number;
  containerHeight: number;
  inlineSize: number;
  blockSize: number;
  inlineStart: number;
  blockStart: number;
  writingMode: WritingMode;
  direction: Direction;
}) {
  const container = {
    width: finiteNonNegative(containerWidth),
    height: finiteNonNegative(containerHeight),
  };
  const size = resolveLogicalSize({inlineSize, blockSize, writingMode});
  const axes = resolveLogicalAxes({writingMode, direction});
  const safeInlineStart = finiteNonNegative(inlineStart);
  const safeBlockStart = finiteNonNegative(blockStart);
  let left = 0;
  let top = 0;

  const apply = (side: PhysicalSide, inset: number) => {
    if (side === "left") left = inset;
    if (side === "right") left = container.width - size.width - inset;
    if (side === "top") top = inset;
    if (side === "bottom") top = container.height - size.height - inset;
  };

  apply(axes.inlineStart, safeInlineStart);
  apply(axes.blockStart, safeBlockStart);

  return {
    ...size,
    left,
    top,
    axes,
  };
}
