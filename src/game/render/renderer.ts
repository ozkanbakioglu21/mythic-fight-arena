import { Fighter } from "../Fighter";
import { FighterState, Archetype, Pantheon } from "../types";
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

  private fighterArchetype(f: Fighter): Archetype {
    return f.def.characterData?.archetype ?? Archetype.BRAWLER;
  }

  private fighterPantheon(f: Fighter): Pantheon | undefined {
    return f.def.characterData?.pantheon;
  }

  drawFighter(f: Fighter, palette: Palette): void {
    const pose = f.getPose();
    const x = pose.position.x;
    const y = pose.position.y;
    const facing = pose.facing;

    const archetype = this.fighterArchetype(f);
    const pantheon = this.fighterPantheon(f);
    const accent = palette.accent ?? "#ffffff";

    const scale = archetypeScale(archetype);
    const bw = f.def.hurtbox.x * scale;
    const bh = f.def.hurtbox.y * scale;

    // Gölge (archetype'a göre).
    const shadowW = f.def.hurtbox.x * 0.62;
    this.ctx.fillStyle = "rgba(0,0,0,0.35)";
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, shadowW, shadowW * 0.22, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.scale(facing, 1);

    this.drawCharacterBody(this.ctx, archetype, pantheon, palette, accent, bw, bh);

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

  /**
   * Archetype + pantheon'a göre prosedürel karakter gövdesi çizer.
   * Paleti ve gövde boyutlarını ayrı ayrı kullanır.
   */
  private drawCharacterBody(
    ctx: CanvasRenderingContext2D,
    archetype: Archetype,
    pantheon: Pantheon | undefined,
    palette: Palette,
    accent: string,
    bw: number,
    bh: number,
  ): void {
    const body = palette.body;
    const head = palette.head;
    const headR = Math.max(8, bw * 0.34);
    const headY = -bh - headR * 0.6;

    // ---- Bacaklar (archetype'a göre genişlik) ----
    ctx.fillStyle = shade(body, -18);
    const legW = bw * 0.16;
    const legH = bh * 0.28;
    ctx.fillRect(-bw * 0.3 - legW / 2, -legH, legW, legH);
    ctx.fillRect(bw * 0.3 - legW / 2, -legH, legW, legH);

    // ---- Gövde ----
    ctx.fillStyle = body;
    if (archetype === Archetype.TANK) {
      // Tank: geniş, yuvarlak omuzlar.
      ctx.beginPath();
      ctx.moveTo(-bw / 2 - bw * 0.08, -bh);
      ctx.lineTo(-bw / 2, -bh * 0.32);
      ctx.lineTo(bw / 2, -bh * 0.32);
      ctx.lineTo(bw / 2 + bw * 0.08, -bh);
      ctx.closePath();
      ctx.fill();
    } else if (archTypeIsBeastLike(archetype)) {
      // Canavar: öne eğik, iki omuz yumrusu.
      ctx.fillRect(-bw / 2, -bh, bw, bh * 0.7);
      ctx.beginPath();
      ctx.arc(-bw / 4, -bh * 0.62, bh * 0.3, 0, Math.PI * 2);
      ctx.arc(bw / 4, -bh * 0.62, bh * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Standart gövde: hafif trapez.
      ctx.beginPath();
      ctx.moveTo(-bw / 2, -bh);
      ctx.lineTo(-bw / 2 + bw * 0.08, -bh * 0.32);
      ctx.lineTo(bw / 2 - bw * 0.08, -bh * 0.32);
      ctx.lineTo(bw / 2, -bh);
      ctx.closePath();
      ctx.fill();
    }

    // Bel kemeri (accent).
    ctx.fillStyle = accent;
    ctx.fillRect(-bw / 2 - bw * 0.03, -bh * 0.4, bw + bw * 0.06, bh * 0.1);

    // ---- Kollar (archetype silahı) ----
    this.drawWeapon(ctx, archetype, pantheon, accent, bw, bh);

    // ---- Baş ----
    ctx.fillStyle = head;
    ctx.beginPath();
    ctx.arc(0, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Yüz detayı (basit gözler).
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(headR * 0.15, headY - headR * 0.1, headR * 0.22, headR * 0.22);

    // Panteon baş aksesuarı.
    this.drawHeadgear(ctx, archetype, pantheon, accent, headR, headY);
  }

  private drawWeapon(
    ctx: CanvasRenderingContext2D,
    archetype: Archetype,
    pantheon: Pantheon | undefined,
    accent: string,
    bw: number,
    bh: number,
  ): void {
    ctx.fillStyle = accent;
    const armW = bw * 0.12;
    const armH = bh * 0.34;
    switch (archetype) {
      case Archetype.ZONER: {
        // Asa / staff: dikey, başında küre.
        ctx.fillStyle = shade(accent, -20);
        ctx.fillRect(bw * 0.35 - armW / 2, -bh - armH, armW * 0.6, bh * 0.55);
        ctx.beginPath();
        ctx.arc(bw * 0.35, -bh - armH, armW * 0.8, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case Archetype.GRAPPLER: {
        // Kocaman yumruk.
        ctx.fillStyle = shade(accent, -10);
        ctx.beginPath();
        ctx.arc(bw * 0.42, -bh * 0.7, bw * 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case Archetype.NECROMANCER: {
        // Kemik asa + aura.
        ctx.fillStyle = shade(accent, -25);
        ctx.fillRect(bw * 0.42, -bh - armH * 0.5, armW * 0.5, bh * 0.7);
        ctx.beginPath();
        ctx.arc(bw * 0.42, -bh - armH * 0.6, armW * 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(120,255,180,0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -bh * 0.55, bh * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case Archetype.TANK: {
        // Kalkan.
        ctx.fillStyle = shade(accent, -10);
        ctx.fillRect(bw * 0.28 - armW / 2, -bh * 0.85, bw * 0.22, bh * 0.42);
        break;
      }
      default: {
        // Yakın dövüş silahları (rushdown/brawler/crowd/aerial/stance/beast).
        const bladeCol = pantheon === Pantheon.JAPANESE ? "#c8d0e0" : shade(accent, 30);
        ctx.fillStyle = bladeCol;
        ctx.fillRect(bw * 0.35, -bh - armH * 0.5, armW * 0.55, bh * 0.8);
        ctx.fillRect(bw * 0.35, -bh - armH * 0.5, armW * 0.55, armW * 0.6);
      }
    }
  }

  private drawHeadgear(
    ctx: CanvasRenderingContext2D,
    archetype: Archetype,
    pantheon: Pantheon | undefined,
    accent: string,
    headR: number,
    headY: number,
  ): void {
    ctx.fillStyle = accent;
    if (archTypeIsBeastLike(archetype)) {
      // Canavar: kısa kulaklar / boynuzlar.
      ctx.beginPath();
      ctx.moveTo(-headR * 0.6, headY - headR * 0.5);
      ctx.lineTo(-headR * 0.9, headY - headR * 1.3);
      ctx.lineTo(-headR * 0.3, headY - headR * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(headR * 0.6, headY - headR * 0.5);
      ctx.lineTo(headR * 0.9, headY - headR * 1.3);
      ctx.lineTo(headR * 0.3, headY - headR * 0.5);
      ctx.closePath();
      ctx.fill();
      return;
    }
    switch (pantheon) {
      case Pantheon.NORSE: {
        // Miğfer + boynuzlar.
        ctx.fillRect(-headR * 1.1, headY - headR, headR * 2.2, headR * 0.5);
        ctx.beginPath();
        ctx.moveTo(-headR * 0.8, headY - headR);
        ctx.lineTo(-headR * 1.6, headY - headR * 1.5);
        ctx.lineTo(-headR * 0.4, headY - headR * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(headR * 0.8, headY - headR);
        ctx.lineTo(headR * 1.6, headY - headR * 1.5);
        ctx.lineTo(headR * 0.4, headY - headR * 0.8);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case Pantheon.EGYPTIAN: {
        // Nemes başlığı + uraeus.
        ctx.fillRect(-headR * 1.2, headY - headR * 1.2, headR * 2.4, headR * 1.1);
        ctx.fillRect(-headR * 1.2, headY - headR * 0.1, headR * 0.5, headR * 0.9);
        ctx.beginPath();
        ctx.arc(headR * 0.6, headY - headR * 1.5, headR * 0.12, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case Pantheon.GREEK: {
        // Defne çelengi.
        ctx.strokeStyle = accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, headY - headR * 0.5, headR * 1.15, Math.PI, 0);
        ctx.stroke();
        break;
      }
      case Pantheon.TURKIC: {
        // Konik şapka + tüy.
        ctx.beginPath();
        ctx.moveTo(-headR, headY - headR * 0.3);
        ctx.lineTo(0, headY - headR * 2);
        ctx.lineTo(headR, headY - headR * 0.3);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case Pantheon.JAPANESE: {
        // Kabuto + ay.
        ctx.fillRect(-headR * 1.1, headY - headR * 0.8, headR * 2.2, headR * 0.7);
        ctx.fillRect(-headR * 1.1, headY - headR * 0.8, headR * 0.7, headR * 0.35);
        break;
      }
      default: {
        // Basit baş bandı.
        ctx.fillRect(-headR, headY - headR * 0.3, headR * 2, headR * 0.3);
      }
    }
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
  accent?: string;
}

export const THOR_PALETTE: Palette = { body: "#4a6ea9", head: "#c9a227" };
export const MONSTER_PALETTES: Record<string, Palette> = {
  goblin: { body: "#4e8d4a", head: "#3a6a36" },
  skeleton: { body: "#c9c9cf", head: "#e8e8e8" },
  orc: { body: "#7a4a2f", head: "#5d3a24" },
  troll: { body: "#5f6a3a", head: "#46502b" },
  giant: { body: "#3a4a6a", head: "#2c3854" },
};

/** Gövde ölçeği — archetype'a göre boyut farkı. */
function archetypeScale(a: Archetype): number {
  switch (a) {
    case Archetype.TANK:
    case Archetype.GRAPPLER:
      return 1.18;
    case Archetype.BEAST:
      return 0.92;
    case Archetype.ZONER:
    case Archetype.NECROMANCER:
    case Archetype.RUSHDOWN:
      return 0.95;
    default:
      return 1;
  }
}

function archTypeIsBeastLike(a: Archetype): boolean {
  return a === Archetype.BEAST || a === Archetype.CROWD_CONTROL;
}

/** Hex rengi belirli bir miktar koyulaştırır/aydınlatır (negatif=koyu). */
function shade(hex: string, amt: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length !== 6) return hex;
  const num = parseInt(h, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  if (amt > 0) {
    r = Math.min(255, r + amt);
    g = Math.min(255, g + amt);
    b = Math.min(255, b + amt);
  } else {
    r = Math.max(0, r + amt);
    g = Math.max(0, g + amt);
    b = Math.max(0, b + amt);
  }
  return `rgb(${r},${g},${b})`;
}
