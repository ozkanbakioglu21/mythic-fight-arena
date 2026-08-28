export const GRAVITY = 900; // px/s^2
export const PIXELS_PER_METER = 9;
export const MAX_ARROW_SPEED = 1250; // px/s at full draw
export const DRAG = 0.06;

export interface Vec {
  x: number;
  y: number;
}

export interface Arrow {
  pos: Vec;
  prev: Vec;
  vel: Vec;
  angle: number;
  stuck: boolean;
  alive: boolean;
  life: number;
  trail: Vec[];
}

/**
 * Şiddet -> hız çarpanı.
 * 0.5 (orta şiddet) = 1.0 -> hedefin tam ortası
 * 1.0 (tam gerilim)  = 1.5 -> uzun düşer, potayı aşar
 * 0.15 (zayıf)       = ~0.65 -> hedefin önüne düşer
 */
export function powerFactor(power: number): number {
  return 0.5 + power;
}

/**
 * Verilen açıyla hedefin tam merkezine ulaşmak için gereken çıkış hızı.
 * Hedef nişan doğrusunun üstünde kalıyorsa (çözüm yok) null döner.
 */
export function solveSpeedForTarget(origin: Vec, angle: number, target: Vec): number | null {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const cos = Math.cos(angle);
  if (dx <= 0 || cos <= 0.05) return null;
  const drop = dy - dx * Math.tan(angle);
  if (drop <= 0) return null;
  const v2 = (GRAVITY * dx * dx) / (2 * cos * cos * drop);
  if (!isFinite(v2) || v2 <= 0) return null;
  // sürtünme kaybı için küçük telafi
  return Math.sqrt(v2) * (1 + DRAG * 0.55);
}

export function createArrow(origin: Vec, angle: number, power: number, baseSpeed?: number): Arrow {
  const base = baseSpeed && isFinite(baseSpeed) ? baseSpeed : MAX_ARROW_SPEED * 0.7;
  const speed = Math.max(180, Math.min(MAX_ARROW_SPEED * 1.6, base * powerFactor(power)));
  return {
    pos: { ...origin },
    prev: { ...origin },
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    angle,
    stuck: false,
    alive: true,
    life: 0,
    trail: [],
  };
}

/** Advance one arrow. wind is in m/s (positive = tailwind to the right). */
export function stepArrow(a: Arrow, dt: number, wind: number) {
  if (!a.alive || a.stuck) return;
  a.prev.x = a.pos.x;
  a.prev.y = a.pos.y;
  a.vel.y += GRAVITY * dt;
  a.vel.x += wind * PIXELS_PER_METER * 2.2 * dt;
  a.vel.x -= a.vel.x * DRAG * dt;
  a.pos.x += a.vel.x * dt;
  a.pos.y += a.vel.y * dt;
  a.angle = Math.atan2(a.vel.y, a.vel.x);
  a.life += dt;
  a.trail.push({ x: a.pos.x, y: a.pos.y });
  if (a.trail.length > 26) a.trail.shift();
}


/** Predicted trajectory points for the aiming guide. */
export function predictPath(
  origin: Vec,
  angle: number,
  power: number,
  wind: number,
  steps = 18,
  dt = 0.05,
  baseSpeed?: number,
): Vec[] {
  const ghost = createArrow(origin, angle, power, baseSpeed);
  const pts: Vec[] = [];
  for (let i = 0; i < steps; i++) {
    stepArrow(ghost, dt, wind);
    pts.push({ x: ghost.pos.x, y: ghost.pos.y });
  }
  return pts;
}

export function randomWind(max: number): number {
  if (max <= 0) return 0;
  return Number(((Math.random() * 2 - 1) * max).toFixed(1));
}
