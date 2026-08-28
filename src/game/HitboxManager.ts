import { Hitbox, Vec2 } from "./types";

/** Etkin bir hitbox: dünya konumunda AABB kutusu. */
export interface WorldHitbox {
  owner: string;
  attackId: string;
  rect: Rect;
  damage: number;
  knockback: Vec2;
  hitstunFrames: number;
  launch: boolean;
  armor: boolean;
  parryable: boolean;
  /** Bu hitbox'ın zaten çarptığı hedefler (tek vuruş başına çoklu vuruşu engeller). */
  hitEntities: Set<string>;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Hurtbox {
  owner: string;
  rect: Rect;
}

/** Yerel hitbox'ı dünya koordinatına çevirir. */
export function localToWorld(
  local: Hitbox,
  origin: Vec2,
  facing: 1 | -1,
): Rect {
  return {
    x: origin.x + local.offset.x * facing,
    y: origin.y + local.offset.y,
    w: local.size.x,
    h: local.size.y,
  };
}

/**
 * HitboxManager — Hitbox/Hurtbox tetiklemeleri ve çakışma (Collision) mantığı.
 *
 * - Her aktif saldırının hitbox'ını tutar.
 * - Hedefin hurtbox'ıyla AABB kesişimini test eder.
 * - Tek hitbox'ın aynı hedefe birden çok kez vurmasını engeller.
 */
export class HitboxManager {
  private active: WorldHitbox[] = [];

  /** Yeni frame başına temizleme (opsiyonel: recovery bittiğinde manuel temizlenir). */
  clearFrame(): void {
    this.active.length = 0;
  }

  /** Saldırı aktif karelerine girdiğinde hitbox'ı dünyaya ekler. */
  spawn(opts: {
    owner: string;
    attackId: string;
    rect: Rect;
    damage: number;
    knockback: Vec2;
    hitstunFrames: number;
    launch: boolean;
    armor: boolean;
    parryable: boolean;
  }): WorldHitbox {
    const hb: WorldHitbox = {
      owner: opts.owner,
      attackId: opts.attackId,
      rect: opts.rect,
      damage: opts.damage,
      knockback: opts.knockback,
      hitstunFrames: opts.hitstunFrames,
      launch: opts.launch,
      armor: opts.armor,
      parryable: opts.parryable,
      hitEntities: new Set(),
    };
    this.active.push(hb);
    return hb;
  }

  /**
   * Tüm aktif hitbox'ları hedef hurtbox'larla test eder.
   * @returns vuruşlar (her hedefin world hitbox'ına göre ilk çarpışma).
   */
  testAndResolve(
    targets: Hurtbox[],
  ): Array<{ attack: WorldHitbox; target: Hurtbox }> {
    const hits: Array<{ attack: WorldHitbox; target: Hurtbox }> = [];
    for (const hb of this.active) {
      for (const target of targets) {
        if (target.owner === hb.owner) continue;
        if (hb.hitEntities.has(target.owner)) continue; // zaten vuruldu
        if (intersects(hb.rect, target.rect)) {
          hb.hitEntities.add(target.owner);
          hits.push({ attack: hb, target });
        }
      }
    }
    return hits;
  }

  /** Recovery sonunda bu attack'a ait hitbox'ları kaldırır. */
  removeAttack(owner: string, attackId: string): void {
    this.active = this.active.filter(
      (h) => !(h.owner === owner && h.attackId === attackId),
    );
  }

  /** Debug / render için aktif hitbox dikdörtgenleri. */
  getActiveRects(): Rect[] {
    return this.active.map((h) => ({ ...h.rect }));
  }

  reset(): void {
    this.active.length = 0;
  }
}

/** AABB kesişim testi. */
export function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
