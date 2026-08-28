import { Fighter } from "./Fighter";
import { FighterState, InputAction } from "./types";

/**
 * AI — PvE (Vs AI) ve Dungeon canavarlarına ortak programatik kontrol.
 * Fighter'ın InputManager'ını istediği karelerde programatik olarak besler;
 * böylece aynı girdi hattı (6-frame buffer) kullanılır.
 *
 * Basit bir doğrusal muhakeme: menzile göre saldırı seç, ara ver, dön.
 */
export class AI {
  private cooldown = 0;
  private decision = 0;
  private strafeDir: 1 | -1 = 1;

  constructor(private owner: Fighter, private opponent: Fighter) {}

  /** Her frame çağrılır; owner'ın girdi yönetimini besler. */
  think(): void {
    const o = this.owner;
    const p = this.opponent;
    const dx = p.position.x - o.position.x;
    const facing = dx > 0 ? (1 as const) : (-1 as const);
    if (dx !== 0) o.facing = facing;

    this.decision--;
    if (this.decision > 0) {
      // Saldırı karar süresinde kilitli (animasyon bekleniyor).
      o.inputs.beginFrame();
      return;
    }

    const dist = Math.abs(dx);

    // Menzil içinde değilse yaklaş / uzaklaş.
    if (dist > 90) {
      o.inputs.beginFrame();
      o.inputs.setHeld(
        new Set([dx > 0 ? InputAction.MOVE_RIGHT : InputAction.MOVE_LEFT]),
        facing,
        0,
      );
      return;
    }

    if (this.cooldown > 0) {
      this.cooldown--;
      o.inputs.beginFrame();
      o.inputs.setHeld(
        new Set([InputAction.MOVE_LEFT]),
        -facing * this.strafeDir,
        0,
      );
      return;
    }

    if (this.cooldown <= 0) {
      o.inputs.beginFrame();
      // Hafif veya ağır saldırı seç, ardından bekleme süresi.
      if (Math.random() < 0.4) {
        o.inputs.press(InputAction.SPECIAL);
      } else if (Math.random() < 0.5) {
        o.inputs.press(InputAction.HEAVY);
      } else {
        o.inputs.press(InputAction.LIGHT);
      }
      this.cooldown = 18 + Math.floor(Math.random() * 12);
      this.decision = 12;
      this.strafeDir = this.strafeDir === 1 ? -1 : 1;
    }
  }

  /** Dungeon canavarı davranışı: sürekli oyuncuya koş ve vur. */
  thinkDungeon(): void {
    const o = this.owner;
    const p = this.opponent;
    const dx = p.position.x - o.position.x;
    const facing = dx > 0 ? (1 as const) : (-1 as const);
    if (dx !== 0) o.facing = facing;

    const dist = Math.abs(dx);
    o.inputs.beginFrame();

    if (this.cooldown > 0) {
      this.cooldown--;
      if (dist > 70) {
        o.inputs.setHeld(
          new Set([dx > 0 ? InputAction.MOVE_RIGHT : InputAction.MOVE_LEFT]),
          facing,
          0,
        );
      }
      return;
    }

    if (dist > 80) {
      o.inputs.setHeld(
        new Set([dx > 0 ? InputAction.MOVE_RIGHT : InputAction.MOVE_LEFT]),
        facing,
        0,
      );
    } else {
      if (Math.random() < 0.55) o.inputs.press(InputAction.SPECIAL);
      else o.inputs.press(InputAction.LIGHT);
      this.cooldown = 24 + Math.floor(Math.random() * 16);
    }
  }

  get state(): FighterState {
    return this.owner.getPose().state;
  }
}
