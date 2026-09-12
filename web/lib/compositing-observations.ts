const KEYFRAME_METADATA = new Set(["offset", "computedOffset", "easing", "composite"]);

export function collectAnimatedStyleProperties(keyframes: readonly Record<string, unknown>[]) {
  const properties = new Set<string>();
  for (const keyframe of keyframes) {
    for (const property of Object.keys(keyframe)) {
      if (!KEYFRAME_METADATA.has(property)) properties.add(property);
    }
  }
  return [...properties].sort();
}

export function includesPaintContainment(contain: string) {
  const tokens = contain.trim().split(/\s+/).filter(Boolean);
  return tokens.includes("paint") || tokens.includes("content") || tokens.includes("strict");
}

export const STANDARD_COMPOSITOR_LAYER_EVIDENCE = "not exposed by standard web APIs" as const;
