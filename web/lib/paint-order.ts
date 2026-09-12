export type PaintPhase =
  | "root-background"
  | "negative-positioned"
  | "in-flow-block"
  | "inline-content"
  | "positioned-auto-zero"
  | "positive-positioned";

export type PaintOrderItem = {
  id: string;
  label: string;
  phase: PaintPhase;
  domOrder: number;
  zIndex?: number;
};

const phaseRank: Record<PaintPhase, number> = {
  "root-background": 0,
  "negative-positioned": 1,
  "in-flow-block": 2,
  "inline-content": 3,
  "positioned-auto-zero": 4,
  "positive-positioned": 5,
};

function phaseZ(item: PaintOrderItem) {
  if (item.phase === "negative-positioned" || item.phase === "positive-positioned") {
    return item.zIndex ?? 0;
  }
  return 0;
}

export function resolvePaintOrder(items: readonly PaintOrderItem[]) {
  return [...items].sort((a, b) => {
    const phaseDelta = phaseRank[a.phase] - phaseRank[b.phase];
    if (phaseDelta !== 0) return phaseDelta;
    const zDelta = phaseZ(a) - phaseZ(b);
    if (zDelta !== 0) return zDelta;
    return a.domOrder - b.domOrder;
  });
}

export function createPaintOrderFixture({
  negativeA = -3,
  negativeB = -1,
  positiveA = 1,
  positiveB = 3,
}: {
  negativeA?: number;
  negativeB?: number;
  positiveA?: number;
  positiveB?: number;
} = {}): PaintOrderItem[] {
  return [
    {id: "root", label: "root background", phase: "root-background", domOrder: 0},
    {id: "negative-a", label: "negative A", phase: "negative-positioned", domOrder: 1, zIndex: negativeA},
    {id: "negative-b", label: "negative B", phase: "negative-positioned", domOrder: 2, zIndex: negativeB},
    {id: "block", label: "in-flow block", phase: "in-flow-block", domOrder: 3},
    {id: "inline", label: "inline content", phase: "inline-content", domOrder: 4},
    {id: "positioned", label: "positioned auto/zero", phase: "positioned-auto-zero", domOrder: 5},
    {id: "positive-a", label: "positive A", phase: "positive-positioned", domOrder: 6, zIndex: positiveA},
    {id: "positive-b", label: "positive B", phase: "positive-positioned", domOrder: 7, zIndex: positiveB},
  ];
}

export function topToBottomPaintIds(items: readonly PaintOrderItem[]) {
  return resolvePaintOrder(items).map((item) => item.id).reverse();
}
