import { Fighter } from "../Fighter";
import { FighterState } from "../types";
import { MonsterSlot } from "../DungeonManager";

/** Canvas2D renderer — oyun dünyasını çizer. */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  debug = false;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context desteklenmiyor");
    this.ctx = ctx;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  /** Zemin çizimi. */
  drawGround(groundY: number, arenaColor = "#1a2332"): void {
    const ctx = this.ctx;
    ctx.fillStyle = arenaColor;
    ctx.fillRect(0, groundY, this.width, this.height - groundY);
    ctx.strokeStyle = "#3b4b63";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(this.width, groundY);
    ctx.stroke();
  }

  drawBackground(): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.height);
    g.addColorStop(0, "#0b0f19");
    g.addColorStop(0.7, "#1a2332");
    g.addColorStop(1, "#2a2f3d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  drawFighter(f: Fighter, palette: Palette): void {
    const pose = f.getPose();
    const x = pose.position.x;
    const y = pose.position.y;
    const facing = pose.facing;

    // Gölge.
    this.ctx.fillStyle = "rgba(0,0,0,0.35)";
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, 22, 5, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.scale(facing, 1);

    const bw = f.def.hurtbox.x;
    const bh = f.def.hurtbox.y;

    // Vücut.
    this.ctx.fillStyle = palette.body;
    this.ctx.fillRect(-bw / 2, -bh, bw, bh);

    // Baş.
    this.ctx.fillStyle = palette.head;
    this.ctx.beginPath();
    this.ctx.arc(0, -bh - 10, 12, 0, Math.PI * 2);
    this.ctx.fill();

    // Blok kalkanı.
    if (pose.blocking) {
      this.ctx.fillStyle = "rgba(80,140,220,0.55)";
      this.ctx.fillRect(4, -bh * 0.7, 14, bh * 0.5);
    }
    // Parry parıltısı.
    if (pose.parrying) {
      this.ctx.strokeStyle = "#ffe680";
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(0, -bh * 0.5, 20, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    // Hitstun titreşimi.
    if (pose.state === FighterState.HITSTUN || pose.state === FighterState.LAUNCHED) {
      this.ctx.fillStyle = "rgba(255,80,60,0.4)";
      this.ctx.fillRect(-bw / 2, -bh, bw, bh);
    }
    // Knockdown.
    if (pose.state === FighterState.KNOCKDOWN) {
      this.ctx.rotate(-Math.PI / 2);
      this.ctx.fillRect(-bw / 2, -bh / 2, bw, bh / 2);
    }
    // Defeated.
    if (f.isDefeated()) {
      this.ctx.globalAlpha = 0.35;
    }
    this.ctx.restore();
    this.ctx.globalAlpha = 1;

    if (this.debug) this.drawHurtbox(f);
  }

  drawMonster(m: MonsterSlot, palette: Palette): void {
    if (!m.alive) this.drawFighter(m.fighter, { ...palette, body: "#2c2c30" });
    else this.drawFighter(m.fighter, palette);
  }

  private drawHurtbox(f: Fighter): void {
    const pose = f.getPose();
    this.ctx.strokeStyle = "rgba(0,255,120,0.5)";
    this.ctx.lineWidth = 1;
    const bw = f.def.hurtbox.x;
    const bh = f.def.hurtbox.y;
    this.ctx.strokeRect(
      pose.position.x - bw / 2,
      pose.position.y - bh,
      bw,
      bh,
    );
  }

  /** Aktif hitbox göstergesi (debug). */
  drawActives(rects: { x: number; y: number; w: number; h: number }[]): void {
    if (!this.debug) return;
    this.ctx.fillStyle = "rgba(255,60,60,0.3)";
    for (const r of rects) {
      this.ctx.fillRect(r.x, r.y, r.w, r.h);
    }
  }
}

export interface Palette {
  body: string;
  head: string;
}

export const THOR_PALETTE: Palette = { body: "#4a6ea9", head: "#c9a227" };
export const MONSTER_PALETTES: Record<string, Palette> = {
  goblin: { body: "#4e8d4a", head: "#3a6a36" },
  skeleton: { body: "#c9c9cf", head: "#e8e8e8" },
  orc: { body: "#7a4a2f", head: "#5d3a24" },
  troll: { body: "#5f6a3a", head: "#46502b" },
  giant: { body: "#3a4a6a", head: "#2c3854" },
};
