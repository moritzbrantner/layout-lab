export type AspectRatio = {
  width: number;
  height: number;
};

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function resolveAspectHeight({
  width,
  ratio,
}: {
  width: number;
  ratio: AspectRatio;
}) {
  const safeWidth = finiteNonNegative(width);
  const ratioWidth = finiteNonNegative(ratio.width);
  const ratioHeight = finiteNonNegative(ratio.height);
  if (ratioWidth <= 0 || ratioHeight <= 0) return 0;
  return safeWidth * (ratioHeight / ratioWidth);
}

export function resolveOverflowExtent({
  clientSize,
  scrollSize,
}: {
  clientSize: number;
  scrollSize: number;
}) {
  const client = finiteNonNegative(clientSize);
  const scroll = finiteNonNegative(scrollSize);
  return Math.max(0, scroll - client);
}

export function clampScrollOffset({
  requested,
  maximum,
}: {
  requested: number;
  maximum: number;
}) {
  const safeMaximum = finiteNonNegative(maximum);
  return Math.min(finiteNonNegative(requested), safeMaximum);
}
