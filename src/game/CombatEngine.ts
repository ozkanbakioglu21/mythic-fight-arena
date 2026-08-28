import { AttackDef, FighterState, FrameData } from "./types";

/** Kombo sonrası her ek vuruşta hasar azaltma oranı. */
export const DAMAGE_SCALE_STEP = 0.1;
/** Minimum hasar sınırı. */
export const DAMAGE_SCALE_MIN = 0.2;

export interface CombatantState {
  hp: number;
  maxHp: number;
  meter: number;
  maxMeter: number;
  state: FighterState;
  /** Saldırı sonrası recovery kalan kare. */
  recoveryLeft: number;
  /** Hitstun / knockdown kalan kare. */
  stunLeft: number;
  /** Mevcut atak (ATTACKING iken). */
  currentAttack: AttackDef | null;
  /** Aktif kare sayaç. */
  activeFramesLeft: number;
  /** Startup kalan kare. */
  startupLeft: number;
  /** Bu frame'de parry yapacak mı. */
  parryActive: boolean;
  /** Kombo sayaç (damage scaling için). */
  comboHits: number;
  /** Combo scaling olmadan base damage. */
  comboScaling: number;
  /** Yerde mi (LAUNCHED sonrası). */
  airborne: boolean;
  /** Air-tight hitstun while airborne. */
}

/**
 * CombatEngine — Sağlık, durum makinesi, hasar ölçekleme ve parry hesaplar.
 *
 * Durum makinesi: IDLE/MOVING -> ATTACKING -> (HITSTUN | BLOCKING |
 * LAUNCHED | KNOCKDOWN) -> IDLE.
 *
 * Damage Scaling: Kombo uzadıkça her ek vuruşta hasar %10 azalır,
 * minimum %20'ye kadar iner.
 *
 * Parry: Perfect block — rakip saldırısını yakalayıp rakibi stun'lar.
 */
export class CombatEngine {
  static readonly FRAMES_PER_SECOND = 60;

  /** Yeni frame adımı: kaç frame ilerleneceği. */
  step(c: CombatantState, frames = 1): void {
    for (let i = 0; i < frames; i++) {
      this.tick(c);
    }
  }

  private tick(c: CombatantState): void {
    c.parryActive = false;
    if (c.state === FighterState.ATTACKING) {
      this.tickAttacking(c);
    } else if (c.state === FighterState.HITSTUN) {
      c.stunLeft--;
      if (c.stunLeft <= 0) {
        c.state = FighterState.IDLE;
        if (c.stunLeft <= -30) c.state = FighterState.KNOCKDOWN;
      }
    } else if (c.state === FighterState.LAUNCHED) {
      c.stunLeft--;
      if (c.stunLeft <= 0) {
        c.state = FighterState.IDLE;
        c.airborne = false;
      }
    } else if (c.state === FighterState.KNOCKDOWN) {
      c.stunLeft--;
      if (c.stunLeft <= 0) {
        c.state = FighterState.IDLE;
      }
    } else if (c.state === FighterState.PARRYING) {
      // Parry birkaç kare sürer; tek frame garantili parryActive ayarlandı.
      c.state = FighterState.IDLE;
    }
  }

  private tickAttacking(c: CombatantState): void {
    const a = c.currentAttack;
    if (!a) {
      c.state = FighterState.IDLE;
      return;
    }
    if (c.startupLeft > 0) {
      c.startupLeft--;
    } else if (c.activeFramesLeft > 0) {
      c.activeFramesLeft--;
    } else if (c.recoveryLeft > 0) {
      c.recoveryLeft--;
      if (c.recoveryLeft <= 0) {
        c.state = FighterState.IDLE;
        c.currentAttack = null;
      }
    }
  }

  /**
   * Saldırı başlatma. Fighter state'i ATTACKING'e geçirir ve frame
   * sayacını kurar.
   */
  startAttack(c: CombatantState, attack: AttackDef): void {
    if (c.meter < (attack.meterCost ?? 0)) return; // yeterli meter yok
    c.meter -= attack.meterCost ?? 0;
    c.currentAttack = attack;
    c.state = FighterState.ATTACKING;
    c.startupLeft = attack.frames.startup;
    c.activeFramesLeft = attack.frames.active;
    c.recoveryLeft = attack.frames.recovery;
    c.airborne = false;
  }

  /** ATTACKING iken aktif fazda mıyız (hitbox tetikleme zamanı). */
  isActive(c: CombatantState): boolean {
    return (
      c.state === FighterState.ATTACKING &&
      c.startupLeft <= 0 &&
      c.activeFramesLeft > 0
    );
  }

  /** Recovery fazında mıyız. */
  isRecovery(c: CombatantState): boolean {
    return (
      c.state === FighterState.ATTACKING &&
      c.startupLeft <= 0 &&
      c.activeFramesLeft <= 0 &&
      c.recoveryLeft > 0
    );
  }

  canAct(c: CombatantState): boolean {
    return (
      c.state === FighterState.IDLE ||
      c.state === FighterState.MOVING ||
      c.state === FighterState.BLOCKING
    );
  }

  /**
   * Hasar uygulama: damage scaling uygular, kombo sayar.
   * @returns uygulanan gerçek hasar.
   */
  applyDamage(
    target: CombatantState,
    baseDamage: number,
    comboIncrement: boolean,
  ): { dealt: number; scaling: number } {
    // Yeni rakibe geçişte kombo sıfırlanır.
    const scaling = Math.max(
      DAMAGE_SCALE_MIN,
      1 - target.comboHits * DAMAGE_SCALE_STEP,
    );
    const dealt = Math.round(baseDamage * scaling);
    target.hp = Math.max(0, target.hp - dealt);
    if (comboIncrement) target.comboHits++;
    return { dealt, scaling };
  }

  /** Hasar alanın stun'a girme durumu (armor kontrolü ile). */
  applyHitstun(
    target: CombatantState,
    frames: FrameData,
    attackerComboHits: number,
  ): boolean {
    // Süper armor: saldırı animasyonundayken kesintiye uğramaz.
    if (frames.armor && target.state === FighterState.ATTACKING) return false;
    if (frames.launch) {
      target.state = FighterState.LAUNCHED;
      target.airborne = true;
    } else {
      target.state = FighterState.HITSTUN;
    }
    target.stunLeft = frames.hitstunFrames;
    target.comboHits = attackerComboHits; // rakip kombo sayısını devral
    return true;
  }

  /**
   * Parry (Perfect Block) hesabı. Eğer target PARRYING durumunda ve saldırı
   * parryable ise saldırıyı yakalar; aksi halde normal block.
   */
  tryParry(
    target: CombatantState,
    frame: FrameData,
  ): { success: boolean; stunned: boolean } {
    if (target.state === FighterState.PARRYING && frame.parryable !== false) {
      target.state = FighterState.IDLE;
      target.parryActive = true;
      return { success: true, stunned: true };
    }
    // Normal block: hasarı azalt.
    target.state = FighterState.BLOCKING;
    return { success: false, stunned: false };
  }

  resetCombo(c: CombatantState): void {
    c.comboHits = 0;
    c.comboScaling = 1;
  }
}
