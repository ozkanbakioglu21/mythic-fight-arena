export type TargetKind = "static" | "moving" | "far" | "small";

export interface LevelConfig {
  index: number;
  name: string;
  distanceMeters: number;
  targetRadius: number; // px radius of outer ring
  kind: TargetKind;
  moveSpeed: number; // px/s vertical bobbing
  moveRange: number; // px
  windMax: number; // m/s
  arrows: number;
  /** Hedefin yatay konumu: 0 = en solda izinli, 1 = en sağda izinli. Verilmezse mesafeye göre hesaplanır. */
  posX?: number;
  /** Küçük yatay ofset (px). + sağa, - sola. */
  offsetX?: number;
  /** Küçük dikey ofset (px). + aşağı, - yukarı. */
  offsetY?: number;
}

const kindFor = (i: number): TargetKind => {
  if (i >= 9) return "small";
  if (i >= 7) return "far";
  if (i >= 4) return "moving";
  if (i >= 2 && i % 2 === 1) return "moving";
  return "static";
};

/** Seviye bazlı hedef konumu ince ayarı. Buradan tek tek oynayabilirsin. */
const LEVEL_PLACEMENT: Partial<Record<number, { posX?: number; offsetX?: number; offsetY?: number }>> = {
  0: { offsetX: -10 },
  1: { offsetX: 0 },
  2: { offsetX: 12, offsetY: -6 },
  3: { offsetX: -14 },
  4: { offsetX: 16, offsetY: -10 },
  5: { offsetX: -8, offsetY: 4 },
  6: { offsetX: 18 },
  7: { offsetX: -12, offsetY: -8 },
  8: { offsetX: 10, offsetY: 6 },
  9: { offsetX: 0, offsetY: -12 },
};

export const LEVELS: LevelConfig[] = Array.from({ length: 10 }, (_, i) => {
  const distance = 10 + i * 10; // 10..100 m
  const radius = 78 - i * 5.2; // shrinks with level
  const kind = kindFor(i);
  return {
    index: i + 1,
    name: `Seviye ${i + 1}`,
    distanceMeters: distance,
    targetRadius: Math.round(radius),
    kind,
    moveSpeed: kind === "static" ? 0 : 28 + i * 9,
    moveRange: kind === "static" ? 0 : 50 + i * 9,
    windMax: i * 0.9,
    arrows: 5,
    ...(LEVEL_PLACEMENT[i] ?? {}),
  };
});

export const TOTAL_LEVELS = LEVELS.length;
