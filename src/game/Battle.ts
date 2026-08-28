import { CombatEngine } from "./CombatEngine";
import { HitboxManager } from "./HitboxManager";
import { Fighter } from "./Fighter";
import { Renderer, THOR_PALETTE, MONSTER_PALETTES } from "./render/renderer";
import { THOR, ORC } from "./moves/frameData";
import { AI } from "./AI";
import { KeyboardInput } from "./inputSource";
import { DungeonManager } from "./DungeonManager";
import { FighterState, CharacterDef } from "./types";
import { RollbackNetcode } from "./network/rollback";

export enum BattleMode {
  PVE = "PVE",
  PVP = "PVP",
  DUNGEON = "DUNGEON",
}

export interface HudState {
  p1: { hp: number; maxHp: number; meter: number; maxMeter: number; state: string };
  p2: {
    hp: number;
    maxHp: number;
    meter: number;
    maxMeter: number;
    state: string;
  } | null;
  mode: BattleMode;
  dungeon: {
    wave: number;
    score: number;
    multiplier: number;
    streak: number;
  } | null;
  roundOver: boolean;
  winner: string | null;
}

/**
 * Battle — oyunun merkezi yöneticisi.
 *
 * - Fixed timestep (60 FPS) akümülatörlü oyun döngüsü.
 * - Moda göre PvE (vs AI), PvP (rollback) ya da Dungeon (survival) çalıştırır.
 * - Saldırı çarpışmalarını çözer, hasar/parry/armor kurallarını uygular,
 *   skor ve meter birikimini yönetir.
 */
export class Battle {
  readonly engine = new CombatEngine();
  readonly hitboxes = new HitboxManager();
  readonly renderer: Renderer;
  readonly inputs: KeyboardInput;

  private p1: Fighter;
  private p2: Fighter | null = null;
  private ai: AI | null = null;
  private dungeon: DungeonManager | null = null;
  private rollback: RollbackNetcode | null = null;

  private mode: BattleMode;
  private acc = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;
  private roundOver = false;
  private winner: string | null = null;

  private onHudChange: (h: HudState) => void = () => {};
  private onMatchEnd: (winner: string) => void = () => {};

  constructor(
    private canvas: HTMLCanvasElement,
    mode: BattleMode,
    playerDef?: CharacterDef,
    opponentDef?: CharacterDef,
  ) {
    this.mode = mode;
    this.renderer = new Renderer(canvas);
    this.renderer.resize(canvas.width, canvas.height);

    // Oyuncu (seçilen karakter; yoksa Thor varsayılan).
    const p1Def = playerDef ?? THOR;
    this.p1 = new Fighter(p1Def, this.engine, this.hitboxes, canvas.width * 0.35);
    this.attachAbilityHandler(this.p1);

    if (mode === BattleMode.PVP) {
      // İkinci oyuncu (seçilen karakter; yoksa Thor varsayılan).
      const p2Def = opponentDef ?? THOR;
      this.p2 = new Fighter(p2Def, this.engine, this.hitboxes, canvas.width * 0.7);
      this.p2.facing = -1;
      this.attachAbilityHandler(this.p2);
      this.rollback = new RollbackNetcode([this.p1, this.p2]);
    } else if (mode === BattleMode.PVE) {
      // PvE rakibi: seçilen ya da varsayılan Orc.
      const p2Def = opponentDef ?? ORC;
      this.p2 = new Fighter(p2Def, this.engine, this.hitboxes, canvas.width * 0.72);
      this.p2.facing = -1;
      this.attachAbilityHandler(this.p2);
      this.ai = new AI(this.p2, this.p1);
    } else {
      // Dungeon — canavarlar DungeonManager tarafından spawn edilir.
      this.p1.position.x = canvas.width * 0.5;
      const ground = canvas.height - 40;
      this.p1.position.y = ground;
      this.dungeon = new DungeonManager(
        this.engine,
        this.hitboxes,
        this.p1,
        ground,
      );
      this.dungeon.start();
    }

    // Klavye oyuncu-1'e bağlanır.
    this.inputs = new KeyboardInput(this.p1.inputs);
  }

  /** Fighter'a kaynak CharacterData varsa SpecialAbilityHandler bağlar. */
  private attachAbilityHandler(f: Fighter): void {
    const data = f.def.characterData;
    if (data) {
      f.specialAbility.setup(data);
    }
  }

  setHudListener(fn: (h: HudState) => void): void {
    this.onHudChange = fn;
  }

  setMatchEndListener(fn: (winner: string) => void): void {
    this.onMatchEnd = fn;
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.inputs.dispose();
  }

  private loop = (time: number): void => {
    if (!this.running) return;
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    // Fixed timestep: sabit 1/60 adım biriktir.
    this.acc += dt;
    const step = 1 / 60;
    while (this.acc >= step) {
      this.update();
      this.acc -= step;
    }
    this.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(): void {
    if (this.roundOver) return;

    this.inputs.sync();

    if (this.mode === BattleMode.DUNGEON && this.dungeon) {
      this.updateDungeon();
      return;
    }

    // PvE / PvP.
    this.updateDuel();

    // Round sonu kontrolü.
    if (this.p2 && this.p2.isDefeated() && !this.roundOver) {
      this.roundOver = true;
      this.winner = this.p1.def.name;
      this.onMatchEnd(this.winner);
    }
    if (this.p1.isDefeated() && !this.roundOver) {
      this.roundOver = true;
      this.winner = this.p2 ? this.p2.def.name : "Düşman";
      this.onMatchEnd(this.winner);
    }
  }

  private updateDuel(): void {
    // P1 güncelle.
    this.p1.update();

    // P2 güncelle (AI ya da ikinci oyuncu simülasyonu).
    if (this.p2) {
      if (this.ai) this.ai.think();
      this.p2.update();
    }

    if (this.rollback) {
      // Rollback altyapı adımı (state kaydı, giriş kuyruğu).
      this.rollback.step({ frame: this.rollback.getFrame() + 1, input: "player1" });
    }

    // Çarpışmaları çöz.
    this.resolveDuelCollisions();

    // Meter birikimi.
    this.gainMeter(this.p1);
    if (this.p2) this.gainMeter(this.p2);
  }

  private resolveDuelCollisions(): void {
    if (!this.p2) return;
    // P1 saldırıları -> P2.
    this.applyPlayerAttack(this.p1, this.p2);
    // P2 saldırıları -> P1.
    this.applyPlayerAttack(this.p2, this.p1);
    this.hitboxes.clearFrame();
  }

  private applyPlayerAttack(attacker: Fighter, defender: Fighter): void {
    if (attacker.getPose().state !== FighterState.ATTACKING) return;
    const targets = [
      {
        owner: defender.def.id,
        rect: {
          x: defender.position.x - defender.def.hurtbox.x / 2,
          y: defender.position.y - defender.def.hurtbox.y,
          w: defender.def.hurtbox.x,
          h: defender.def.hurtbox.y,
        },
      },
    ];
    const hits = this.hitboxes.testAndResolve(targets);
    for (const hit of hits) {
      const frame = this.frameOfAttack(attacker, hit.attack.attackId);
      if (!frame) continue;
      // Parry / block kontrolü.
      const defPose = defender.getPose();
      if (defPose.parrying && hit.attack.parryable) {
        // Parry başarılı: rakibi stun'la, saldırgan hasar alsın.
        this.engine.applyHitstun(attacker.combat, {
          startup: 0,
          active: 0,
          recovery: 0,
          damage: 0,
          knockback: { x: 2, y: 0 },
          hitstunFrames: 18,
        }, defender.combat.comboHits);
        this.onParry(defender);
        continue;
      }
      if (defPose.blocking) {
        this.engine.applyDamage(defender.combat, Math.round(frame.damage * 0.2), false);
        continue;
      }
      // Normal vuruş.
      const { dealt } = this.engine.applyDamage(defender.combat, frame.damage, true);
      const interrupted = this.engine.applyHitstun(
        defender.combat,
        frame,
        attacker.combat.comboHits,
      );
      if (interrupted) defender.takeHit(hit.attack.knockback);
      // Meter kazanımı.
      attacker.combat.meter = Math.min(
        attacker.combat.maxMeter,
        attacker.combat.meter + dealt * 0.5,
      );
      // Dungeon skor/çarpan (dungeon modunda canavara vurduysak).
      this.onHitScored(interrupted);
      break; // ilk hedefe bir vuruş
    }
  }

  private frameOfAttack(f: Fighter, attackId: string) {
    return f.def.attacks[attackId]?.frames ?? null;
  }

  /** Dungeon dışındaki modlarda skor yoktur (no-op). */
  private onHitScored(_interrupted: boolean): void {}

  private onParry(f: Fighter): void {
    // Parry hissi — küçük meter bonusu.
    f.combat.meter = Math.min(f.combat.maxMeter, f.combat.meter + 15);
  }

  private updateDungeon(): void {
    const dm = this.dungeon!;
    // Oyuncu güncelle.
    this.p1.update();
    // Canavarları güncelle.
    for (const m of dm.getMonsters()) {
      if (!m.alive) continue;
      m.ai ??= new AI(m.fighter, this.p1);
      m.ai.thinkDungeon();
      m.fighter.update();
    }

    // Çarpışmalar: oyuncu saldırısı -> canavarlar; canavar saldırısı -> oyuncu.
    this.resolveDungeonCollisions();

    // Meter.
    this.gainMeter(this.p1);

    // Dungeon ilerlemesi.
    dm.update();

    // Sonraki dalgaya geçiş.
    if (dm.isWaveComplete() && !dm.getState().gameOver) {
      dm.startNextWave();
    }

    // Oyuncu öldüyse round bitti.
    if (this.p1.isDefeated() && !this.roundOver) {
      this.roundOver = true;
      this.winner = "Canavarlar";
      this.onMatchEnd(this.winner);
    }
    // Tüm dalgalar bitince zafer.
    if (dm.getState().gameOver && !this.roundOver) {
      this.roundOver = true;
      this.winner = this.p1.def.name;
      this.onMatchEnd(this.winner);
    }
  }

  private resolveDungeonCollisions(): void {
    const dm = this.dungeon!;
    const monsters = dm
      .getMonsters()
      .filter((m) => m.alive)
      .map((m) => ({
        owner: m.fighter.def.id,
        fighter: m.fighter,
        rect: {
          x: m.fighter.position.x - m.fighter.def.hurtbox.x / 2,
          y: m.fighter.position.y - m.fighter.def.hurtbox.y,
          w: m.fighter.def.hurtbox.x,
          h: m.fighter.def.hurtbox.y,
        },
      }));

    // Oyuncu saldırısı.
    if (this.p1.getPose().state === FighterState.ATTACKING) {
      for (const m of monsters) {
        const hits = this.hitboxes.testAndResolve([{
          owner: m.owner,
          rect: m.rect,
        }]);
        for (const hit of hits) {
          const frame = this.frameOfAttack(this.p1, hit.attack.attackId);
          if (!frame) continue;
          const { dealt } = this.engine.applyDamage(m.fighter.combat, frame.damage, true);
          const interrupted = this.engine.applyHitstun(
            m.fighter.combat,
            frame,
            this.p1.combat.comboHits,
          );
          if (interrupted) m.fighter.takeHit(hit.attack.knockback);
          this.p1.combat.meter = Math.min(
            this.p1.combat.maxMeter,
            this.p1.combat.meter + dealt * 0.4,
          );
          if (m.fighter.isDefeated()) {
            dm.onMonsterDown(this.toSlot(m.fighter), true);
          }
          break;
        }
      }
    }

    // Canavar saldırıları -> oyuncu.
    for (const m of monsters) {
      if (m.fighter.getPose().state !== FighterState.ATTACKING) continue;
      const hits = this.hitboxes.testAndResolve([
        {
          owner: this.p1.def.id,
          rect: {
            x: this.p1.position.x - this.p1.def.hurtbox.x / 2,
            y: this.p1.position.y - this.p1.def.hurtbox.y,
            w: this.p1.def.hurtbox.x,
            h: this.p1.def.hurtbox.y,
          },
        },
      ]);
      for (const hit of hits) {
        const frame = this.frameOfAttack(m.fighter, hit.attack.attackId);
        if (!frame) continue;
        const { dealt } = this.engine.applyDamage(this.p1.combat, frame.damage, true);
        const interrupted = this.engine.applyHitstun(
          this.p1.combat,
          frame,
          m.fighter.combat.comboHits,
        );
        if (interrupted) this.p1.takeHit(hit.attack.knockback);
        if (dealt > 0) dm.onPlayerHit();
        break;
      }
    }

    this.hitboxes.clearFrame();
  }

  private toSlot(f: Fighter) {
    const slot = this.dungeon!
      .getMonsters()
      .find((m) => m.fighter === f);
    return slot ?? { fighter: f, ai: null, scoreValue: 0, alive: true };
  }

  private gainMeter(f: Fighter): void {
    // Pasif meter toplanır (zamanla).
    f.combat.meter = Math.min(f.combat.maxMeter, f.combat.meter + 0.05);
  }

  private palOf(f: Fighter) {
    if (f.def.palette) {
      return { body: f.def.palette.body, head: f.def.palette.head };
    }
    return THOR_PALETTE;
  }

  private render(): void {
    const r = this.renderer;
    r.clear();
    r.drawBackground();
    const ground = this.canvas.height - 40;

    if (this.mode === BattleMode.DUNGEON) {
      r.drawGround(ground, "#2c2a1e");
      r.drawFighter(this.p1, this.palOf(this.p1));
      const dm = this.dungeon!;
      for (const m of dm.getMonsters()) {
        if (!m.alive) continue;
        const pal = MONSTER_PALETTES[m.fighter.def.id] ?? MONSTER_PALETTES.orc;
        r.drawMonster(m, pal);
      }
      // Canavar aktif hitbox'ları (debug).
      this.renderActives();
    } else {
      r.drawGround(ground);
      r.drawFighter(this.p1, this.palOf(this.p1));
      if (this.p2) {
        const pal =
          this.p2.def.palette
            ? { body: this.p2.def.palette.body, head: this.p2.def.palette.head }
            : this.p2.def.id === "orc"
              ? MONSTER_PALETTES.orc
              : { body: "#a0443c", head: "#7a2f28" };
        r.drawFighter(this.p2, pal);
      }
      this.renderActives();
    }
    this.emitHud();
  }

  private renderActives(): void {
    if (this.renderer.debug) {
      this.renderer.drawActives(this.hitboxes.getActiveRects());
    }
  }

  private emitHud(): void {
    const hud: HudState = {
      p1: this.hudOf(this.p1),
      p2: this.p2 ? this.hudOf(this.p2) : null,
      mode: this.mode,
      dungeon: this.dungeon
        ? {
            wave: this.dungeon.getState().wave,
            score: this.dungeon.getState().score,
            multiplier: this.dungeon.getState().multiplier,
            streak: this.dungeon.getState().streak,
          }
        : null,
      roundOver: this.roundOver,
      winner: this.winner,
    };
    this.onHudChange(hud);
  }

  private hudOf(f: Fighter) {
    const p = f.getPose();
    return {
      hp: Math.max(0, p.hp),
      maxHp: p.maxHp,
      meter: Math.round(p.meter),
      maxMeter: p.maxMeter,
      state: p.state,
    };
  }

  getMode(): BattleMode {
    return this.mode;
  }
}
