import {
  AttackDef,
  CharacterDef,
  FighterState,
  InputAction,
  Vec2,
} from "./types";
import { InputManager } from "./InputManager";
import { CombatEngine, CombatantState } from "./CombatEngine";
import { HitboxManager, localToWorld, WorldHitbox } from "./HitboxManager";
import { SpecialAbilityHandler } from "./characters/SpecialAbilityHandler";

export interface FighterPose {
  state: FighterState;
  facing: 1 | -1;
  position: Vec2;
  velocity: Vec2;
  hp: number;
  maxHp: number;
  meter: number;
  maxMeter: number;
  currentAttackName: string | null;
  attacking: boolean;
  blocking: boolean;
  parrying: boolean;
  airborne: boolean;
}

/**
 * Fighter — dövüşçü/canavar ortak runtime sınıfı.
 *
 * - `combat` (CombatantState): CombatEngine tarafından yönetilen durum.
 * - `inputs`: 6-frame buffer + öncelik sıralamalı InputManager.
 * - Her frame battle loop'u `update()` çağırır; saldırıları InputManager
 *   buffer'ından çözer ve hitbox'ları HitboxManager'a iletir.
 */
export class Fighter {
  readonly def: CharacterDef;
  readonly inputs = new InputManager();
  combat: CombatantState;
  position: Vec2;
  velocity: Vec2 = { x: 0, y: 0 };
  velocityY = 0;
  facing: 1 | -1 = 1;
  /** Bu frame'de üretilecek hitbox'lar. */
  pendingHitboxes: WorldHitbox[] = [];
  /** Özel efekt beklemede (mjolnir/rapture/charge). */
  pendingEffect: string | null = null;
  /** Attack boyunca active-frame hitbox spawn edildi mi. */
  private activeBoxSpawned = false;
  /** Karakter pasif/ultimate yetenek handler'ı. */
  readonly specialAbility: SpecialAbilityHandler;

  constructor(
    def: CharacterDef,
    private engine: CombatEngine,
    private hitboxes: HitboxManager,
    startX: number,
  ) {
    this.def = def;
    this.position = { x: startX, y: def.groundLevel };
    this.specialAbility = new SpecialAbilityHandler(this);
    this.combat = {
      hp: def.maxHp,
      maxHp: def.maxHp,
      meter: 0,
      maxMeter: def.maxMeter,
      state: FighterState.IDLE,
      recoveryLeft: 0,
      stunLeft: 0,
      currentAttack: null,
      activeFramesLeft: 0,
      startupLeft: 0,
      parryActive: false,
      comboHits: 0,
      comboScaling: 1,
      airborne: false,
      armor: def.armor,
    };
  }

  /** Her frame: durumu ilerlet, girdiden tepki ver ve hitbox üret. */
  update(): void {
    const c = this.combat;
    this.pendingHitboxes.length = 0;
    this.pendingEffect = null;

    // CombatEngine durum makinesini ilerlet.
    this.engine.step(this.combat, 1);

    // Aktif/recovery durumunda saldırı hitbox'ı üret.
    if (c.state === FighterState.ATTACKING) {
      this.processActiveAttack();
    }

    // Girdi çözümle (yalnızca tepki verebilecek durumdayken).
    if (this.engine.canAct(this.combat)) {
      this.resolveInput();
    }

    // Fizik: yatay hareket + hava düşüşü eklenir (yarım simüle).
    if (c.state !== FighterState.ATTACKING && !c.airborne) {
      this.position.x += this.velocity.x * this.facing;
    } else if (c.state !== FighterState.ATTACKING) {
      this.position.x += this.velocity.x;
    }
    this.applyGravity();
  }

  private processActiveAttack(): void {
    const a = this.combat.currentAttack;
    if (!a) return;

    // Mjölnir efekti: hedefi çek (yönlü itme zaten knockback'te negatif x).
    if (this.combat.startupLeft <= 0 && this.combat.activeFramesLeft > 0) {
      if (!this.activeBoxSpawned) {
        this.spawnHitbox(a);
        this.activeBoxSpawned = true;
        this.pendingEffect = a.effect ?? null;
      }
    } else if (
      this.combat.startupLeft <= 0 &&
      this.combat.activeFramesLeft <= 0
    ) {
      // Recovery fazı — hitbox temizlendi (battle loop bunu yönetir).
    }
  }

  private spawnHitbox(a: AttackDef): void {
    const rect = localToWorld(a.hitbox, this.getBodyCenter(), this.facing);
    const hb = this.hitboxes.spawn({
      owner: this.def.id,
      attackId: a.id,
      rect,
      damage: a.frames.damage,
      knockback: a.frames.knockback,
      hitstunFrames: a.frames.hitstunFrames,
      launch: !!a.frames.launch,
      armor: !!a.frames.armor,
      parryable: a.frames.parryable !== false,
    });
    // Facing'e göre knockback yönü normalize edilir.
    hb.knockback = {
      x: a === this.combat.currentAttack ? a.frames.knockback.x * this.facing : hb.knockback.x,
      y: a.frames.knockback.y,
    };
    this.pendingHitboxes.push(hb);
  }

  private resolveInput(): void {
    const c = this.combat;
    const resolved = this.inputs.resolveHighest();
    this.inputs.clear(); // buffer'ı tüket (konsol hissi)

    if (resolved) {
      const attack = this.findAttack(resolved.action);
      if (attack) {
        // CombatEngine.startAttack ile saldırı durumuna geç.
        this.startAttack(attack);
        return;
      }
    }

    // Movement / Block / Dash
    if (this.inputs.isHeld(InputAction.BLOCK)) {
      c.state = FighterState.BLOCKING;
      return;
    }

    const dir = this.inputs.getMoveX();
    if (dir !== 0) {
      this.facing = dir as 1 | -1;
      this.position.x += dir * this.def.speed;
      c.state = FighterState.MOVING;
    } else {
      c.state = FighterState.IDLE;
    }
  }

  private findAttack(action: InputAction): AttackDef | null {
    const map: Partial<Record<InputAction, string>> = {
      [InputAction.LIGHT]: "light",
      [InputAction.HEAVY]: "heavy",
      [InputAction.SPECIAL]: "special",
      [InputAction.ULTIMATE]: "ultimate",
    };
    const key = map[action];
    if (!key) return null;
    const atk = this.def.attacks[key];
    if (atk && this.combat.meter >= (atk.meterCost ?? 0)) {
      return atk;
    }
    return null;
  }

  /**
   * CombatEngine.startAttack — saldırıyı durum makinesine başlatır.
   * Battle loop bu metodu güvenli şekilde çağırır.
   */
  startAttack(attack: AttackDef): void {
    this.activeBoxSpawned = false;
    this.inputs.clear();
    this.combat.currentAttack = attack;
    this.combat.state = FighterState.ATTACKING;
    this.combat.startupLeft = attack.frames.startup;
    this.combat.activeFramesLeft = attack.frames.active;
    this.combat.recoveryLeft = attack.frames.recovery;
    this.velocity.x = attack.frames.knockback.x * 0.35;
  }

  /** Yön/hız uygulanmış body center point (hitbox origin). */
  getBodyCenter(): Vec2 {
    return {
      x: this.position.x,
      y: this.position.y - this.def.hurtbox.y / 2,
    };
  }

  private applyGravity(): void {
    if (this.combat.airborne) {
      // Basit yer çekimi — battle loop hava/yer seviyesini yönetir.
      if (this.position.y < this.def.groundLevel) {
        this.position.y += this.velocityY;
        this.velocityY += 0.6;
      } else {
        this.position.y = this.def.groundLevel;
        this.combat.airborne = false;
      }
    }
  }

  getPose(): FighterPose {
    const c = this.combat;
    return {
      state: c.state,
      facing: this.facing,
      position: this.position,
      velocity: this.velocity,
      hp: c.hp,
      maxHp: c.maxHp,
      meter: c.meter,
      maxMeter: c.maxMeter,
      currentAttackName: c.currentAttack?.name ?? null,
      attacking: c.state === FighterState.ATTACKING,
      blocking: c.state === FighterState.BLOCKING,
      parrying: c.parryActive,
      airborne: c.airborne,
    };
  }

  takeHit(knockback: Vec2): void {
    if (this.combat.state === FighterState.DEFEATED) return;
    this.velocity.x = clamp(knockback.x * 0.05, -1, 1);
    if (knockback.y < 0) {
      this.combat.airborne = true;
      this.velocityY = -4;
    }
  }

  isDefeated(): boolean {
    return this.combat.hp <= 0;
  }

  /** Rollback netcode için durumın anlık görüntüsü. */
  snapshot(): FighterSnapshot {
    return {
      position: { ...this.position },
      velocity: { ...this.velocity },
      velocityY: this.velocityY,
      facing: this.facing,
      hp: this.combat.hp,
      meter: this.combat.meter,
      state: this.combat.state,
      currentAttackId: this.combat.currentAttack?.id ?? null,
      startupLeft: this.combat.startupLeft,
      activeFramesLeft: this.combat.activeFramesLeft,
      recoveryLeft: this.combat.recoveryLeft,
      stunLeft: this.combat.stunLeft,
      comboHits: this.combat.comboHits,
      airborne: this.combat.airborne,
    };
  }

  /** Rollback netcode için durumu geri yükler. */
  applySnapshot(s: FighterSnapshot): void {
    this.position = { ...s.position };
    this.velocity = { ...s.velocity };
    this.velocityY = s.velocityY;
    this.facing = s.facing;
    this.combat.hp = s.hp;
    this.combat.meter = s.meter;
    this.combat.state = s.state;
    this.combat.currentAttack =
      s.currentAttackId && this.def.attacks[s.currentAttackId]
        ? this.def.attacks[s.currentAttackId]
        : null;
    this.combat.startupLeft = s.startupLeft;
    this.combat.activeFramesLeft = s.activeFramesLeft;
    this.combat.recoveryLeft = s.recoveryLeft;
    this.combat.stunLeft = s.stunLeft;
    this.combat.comboHits = s.comboHits;
    this.combat.airborne = s.airborne;
  }
}

export interface FighterSnapshot {
  position: Vec2;
  velocity: Vec2;
  velocityY: number;
  facing: 1 | -1;
  hp: number;
  meter: number;
  state: FighterState;
  currentAttackId: string | null;
  startupLeft: number;
  activeFramesLeft: number;
  recoveryLeft: number;
  stunLeft: number;
  comboHits: number;
  airborne: boolean;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
