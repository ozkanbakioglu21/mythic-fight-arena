import type { LevelConfig } from "./levels";

export interface Target {
  x: number;
  y: number;
  baseY: number;
  radius: number;
  speed: number;
  range: number;
  phase: number;
}

export interface HitResult {
  score: number;
  label: string;
  ring: number; // 0 = miss
}

export const RINGS: { max: number; score: number; label: string }[] = [
  { max: 0.22, score: 100, label: "Merkez" },
  { max: 0.46, score: 75, label: "İç halka" },
  { max: 0.72, score: 50, label: "Orta halka" },
  { max: 1.0, score: 25, label: "Dış halka" },
];

export function createTarget(level: LevelConfig, width: number, groundY: number): Target {
  // hedef, okçunun tam karşısında (aynı hizada) ve ekranın sağ tarafında dursun
  const minX = width * 0.62;
  const maxX = width - 120;
  const t = level.posX ?? Math.min(1, (level.distanceMeters - 10) / 90);
  const rawX = minX + (maxX - minX) * Math.min(1, Math.max(0, t)) + (level.offsetX ?? 0);
  // ofsetler ekran dışına taşmasın
  const x = Math.min(width - level.targetRadius - 16, Math.max(minX - 40, rawX));
  const baseY = groundY - 90 + (level.offsetY ?? 0); // okçunun yay hizası
  return {
    x,
    y: baseY,
    baseY,
    radius: level.targetRadius,
    speed: level.moveSpeed,
    range: level.moveRange,
    phase: Math.random() * Math.PI * 2,
  };
}


export function stepTarget(t: Target, dt: number) {
  if (t.speed <= 0) return;
  t.phase += (t.speed / Math.max(1, t.range)) * dt;
  t.y = t.baseY + Math.sin(t.phase) * (t.range / 2);
}

export function evaluateHit(t: Target, x: number, y: number): HitResult {
  const d = Math.hypot(x - t.x, y - t.y) / t.radius;
  for (const ring of RINGS) {
    if (d <= ring.max) return { score: ring.score, label: ring.label, ring: RINGS.indexOf(ring) + 1 };
  }
  return { score: 0, label: "Iskaladın", ring: 0 };
}
