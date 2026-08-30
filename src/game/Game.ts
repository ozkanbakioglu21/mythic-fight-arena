// GÃ¶ktÃ¼rk Mahjong Solitaire
// Kurallar: aynÄ± GÃ¶ktÃ¼rk rÃ¼nÃ¼ne sahip iki AÃ‡IK taÅŸÄ± seÃ§ip eÅŸleÅŸtir, kaldÄ±r.
// TÃ¼m taÅŸlar kalkÄ±nca oyunu kazanÄ±rsÄ±n.

const CANVAS_W = 1280;
const CANVAS_H = 720;

// Bir hex rengini belirli oranda aÃ§Ä±k (+) ya da koyu (-) yapar.
function shade(hex: string, percent: number): string {
  const f = parseInt(hex.slice(1), 16);
  const R = (f >> 16) & 255;
  const G = (f >> 8) & 255;
  const B = f & 255;
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const r = Math.round((t - R) * p) + R;
  const g = Math.round((t - G) * p) + G;
  const b = Math.round((t - B) * p) + B;
  return "#" + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export interface Tile {
  id: number;
  symbol: number; // rÃ¼n indeksi
  x: number; // hÃ¼cre sÃ¼tunu
  y: number; // hÃ¼cre satÄ±rÄ±
  layer: number;
  removed: boolean;
  sx: number; // ekran x merkez
  sy: number; // ekran y merkez
}

export interface HudState {
  remaining: number;
  total: number;
  moves: number;
  seconds: number;
  selected: number;
  won: boolean;
  stuck: boolean;
  level: number;
  levelName: string;
}

// GÃ¶ktÃ¼rk rÃ¼nleri (Orhun alfabesi). Her biri bir "aile" = 4 taÅŸ.
const RUNES = [
  "ğ°€", "ğ°†", "ğ°‰", "ğ°’", "ğ°¤", "ğ°", "ğ°±", "ğ°¾",
  "ğ°‹", "ğ°‘", "ğ°š", "ğ°ƒ", "ğ°…", "ğ°‡", "ğ°ˆ", "ğ°¢",
];

// Her rÃ¼n sembolÃ¼ne Ã¶zel renk (aÃ§Ä±k taÅŸ Ã¼zerinde okunaklÄ±, doygun tonlar).
const RUNE_COLORS = [
  "#c0392b", "#e07b39", "#2e86c1", "#27ae60", "#8e44ad", "#d35400", "#16a085", "#7d3c98",
  "#c1286f", "#6c8e23", "#e8432f", "#0e7ac7", "#9b5de5", "#f1a208", "#0ca3b2", "#7d4fd6",
];
const TILE_W = 58;
const TILE_H = 94;
const GAP = 14;

// Seviye dizimleri. Her hÃ¼cre 2 katman taÅŸ (Ã¼st aÃ§Ä±k, alt kapalÄ±) alÄ±r,
// bÃ¶ylece her seviye her zaman Ã§Ã¶zÃ¼lebilir. HÃ¼cre sayÄ±sÄ± = rÃ¼n sayÄ±sÄ± * 2.
const LEVELS: Array<{ name: string; cells: Array<[number, number]>; bg: [string, string] }> =
  [
    { name: "SÄ±ra", cells: rowShape(2, 4), bg: ["#0e2433", "#16384a"] },
    { name: "Dama", cells: checkerShape(4, 4), bg: ["#0c2833", "#17404e"] },
    { name: "Ã‡apraz", cells: crossShape(4, 4), bg: ["#17243b", "#24365b"] },
    { name: "U Åekli", cells: uShape(4, 5), bg: ["#273323", "#3a4a2f"] },
    { name: "Ã‡erÃ§eve", cells: frameShape(4, 4), bg: ["#14233d", "#20314f"] },
    { name: "SÃ¼tun", cells: rowShape(3, 4), bg: ["#33233c", "#4a2f56"] },
    { name: "Kare", cells: rowShape(4, 4), bg: ["#0d2e33", "#1a4650"] },
    { name: "Piramit", cells: pyramidShape(8), bg: ["#3a2a16", "#544026"] },
    { name: "GeniÅŸ Alan", cells: rowShape(5, 4), bg: ["#271f3f", "#3a2a53"] },
    { name: "Halka", cells: ringShape(5, 5), bg: ["#1f3a33", "#2c5448"] },
    { name: "GeniÅŸ Alan 2", cells: rowShape(7, 4), bg: ["#3a2030", "#542d45"] },
    { name: "BÃ¼yÃ¼k Kare", cells: rowShape(8, 4), bg: ["#2a1f3f", "#3d2a5c"] },
  ];

function rowShape(cols: number, rows: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([c, r]);
  return out;
}
function frameShape(cols: number, rows: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) out.push([c, r]);
  return out;
}
function checkerShape(cols: number, rows: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) if ((r + c) % 2 === 0) out.push([c, r]);
  return out;
}
function crossShape(cols: number, rows: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (c === r || c + r === cols - 1) out.push([c, r]);
  return out;
}
function uShape(cols: number, rows: number): Array<[number, number]> {
  // Ãœst kenar aÃ§Ä±k, alt kenar ve yanlar dolu (U harfi).
  const out: Array<[number, number]> = [];
  for (let r = 1; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (r === rows - 1 || c === 0 || c === cols - 1) out.push([c, r]);
  return out;
}
function pyramidShape(maxCols: number): Array<[number, number]> {
  // BasamaklÄ± ters piramit: her satÄ±rda 2,4,6,8... merkezli hÃ¼cre.
  const out: Array<[number, number]> = [];
  let cols = 2;
  let row = 0;
  while (cols <= maxCols) {
    const start = (maxCols - cols) / 2;
    for (let c = 0; c < cols; c++) out.push([start + c, row]);
    cols += 2;
    row++;
  }
  return out;
}
function ringShape(cols: number, rows: number): Array<[number, number]> {
  // KalÄ±n halka: dÄ±ÅŸ Ã§erÃ§eve + iÃ§ Ã§erÃ§eve.
  const outer = frameShape(cols, rows);
  const inner = frameShape(cols - 2, rows - 2).map(
    ([c, r]): [number, number] => [c + 1, r + 1],
  );
  return [...outer, ...inner];
}

// Deterministik (seeded) rastgele sayÄ± Ã¼retici: aynÄ± seviye her zaman
// aynÄ± dizim Ã¼retir, bÃ¶ylece "yeniden oyna" seviyeyi deÄŸiÅŸtirmez.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Seviye ilerledikÃ§e rastgele yeni bir dizim Ã¼retir: birkaÃ§ bitiÅŸik blok
// (adacÄ±k) rastgele yerleÅŸtirilir. Her bloÄŸun hÃ¼cre sayÄ±sÄ± Ã§ifttir (2x2, 2x3,
// 3x2, 3x3), toplam Ã§ift sayÄ±ya yuvarlanÄ±r, bÃ¶ylece her dizim Ã§Ã¶zÃ¼lebilir ve
// rÃ¼n havuzunu (16 rÃ¼n = 32 hÃ¼cre) aÅŸmaz. Deterministik (seeded): aynÄ± seviye
// her zaman aynÄ± dizimi Ã¼retir.
function randomShape(levelIndex: number): Array<[number, number]> {
  const rng = mulberry32(levelIndex * 104729 + 13);
  const cols = 8;
  const rows = 5;
  const grid = new Set<string>();
  const blocks = 2 + Math.floor(rng() * 2); // 2..3 blok (max 27 hÃ¼cre <= 32)
  const sizes: Array<[number, number]> = [
    [2, 2],
    [2, 3],
    [3, 2],
    [3, 3],
  ];
  for (let b = 0; b < blocks; b++) {
    const [bw, bh] = sizes[Math.floor(rng() * sizes.length)];
    const cx = Math.floor(rng() * (cols - bw + 1));
    const cy = Math.floor(rng() * (rows - bh + 1));
    for (let y = cy; y < cy + bh; y++)
      for (let x = cx; x < cx + bw; x++) grid.add(`${x},${y}`);
  }
  const cells = [...grid].map((s) => {
    const p = s.split(",").map(Number);
    return [p[0], p[1]] as [number, number];
  });
  // Ã‡ift hÃ¼cre garantisi (Ã§Ã¶zÃ¼lebilirlik).
  if (cells.length % 2 !== 0) cells.pop();
  return cells;
}

const RANDOM_BG: Array<[string, string]> = [
  ["#101f3a", "#1c3052"],
  ["#112a3a", "#1e4556"],
  ["#231a42", "#31285c"],
  ["#0d2a24", "#173e34"],
  ["#3a2a10", "#52401c"],
  ["#2a1430", "#3e2048"],
  ["#1f3a30", "#2c5447"],
  ["#402a1c", "#5a3b29"],
  ["#14203f", "#203057"],
  ["#33221f", "#4a3130"],
];

export class Game {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private running = false;
  private last = 0;

  private tiles: Tile[] = [];
  private selectedId: number | null = null;
  private moves = 0;
  private seconds = 0;
  private won = false;
  private history: Array<{ a: number; b: number }> = [];
  private levelIndex = 0;
  private tray: number[] = []; // hazneye dÃ¼ÅŸen eÅŸlenen rÃ¼nler (max 4)
  private shards: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    max: number;
    color: string;
    r: number;
  }> = [];

  onHud?: (h: HudState) => void;

  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    this.ctx = canvas.getContext("2d")!;
    this.newGame();
  }

  start(): void {
    this.running = true;
    this.last = performance.now();
    this.bind();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unbind();
  }

  private bind(): void {
    this.canvas.addEventListener("pointermove", this.onMove);
    this.canvas.addEventListener("pointerdown", this.onDown);
  }
  private unbind(): void {
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerdown", this.onDown);
  }
  private onMove = (_e: PointerEvent): void => {
    // Hover vurgusu ÅŸu anlÄ±k kullanÄ±lmÄ±yor.
  };
  private onDown = (e: PointerEvent): void => {
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * this.canvas.width;
    const y = ((e.clientY - r.top) / r.height) * this.canvas.height;
    this.click(x, y);
  };

  // ---- YerleÅŸim ----
  private level(): { name: string; cells: Array<[number, number]>; bg: [string, string] } {
    if (this.levelIndex < LEVELS.length) {
      return LEVELS[this.levelIndex];
    }
    // Elle tanÄ±mlÄ± seviyeler bittikten sonra rastgele (deterministik) dizim.
    const cells = randomShape(this.levelIndex);
    const bg = RANDOM_BG[this.levelIndex % RANDOM_BG.length];
    return { name: `Rastgele #${this.levelIndex + 1}`, cells, bg };
  }

  private buildLayout(): void {
    // Seviyenin dizimindeki her hÃ¼cre 2 katman taÅŸ alÄ±r (alt + Ã¼st).
    // Ãœst katmandaki tÃ¼m taÅŸlar aÃ§Ä±ktÄ±r ve Ã§iftler halinde eÅŸleÅŸtirilebilir;
    // kalkÄ±nca alttakiler aÃ§Ä±lÄ±r -> her seviye her zaman Ã§Ã¶zÃ¼lebilir.
    const def = this.level();
    const cells = def.cells;
    const runes = cells.length / 2;

    const symbols: number[] = [];
    for (let s = 0; s < runes; s++) {
      for (let k = 0; k < 4; k++) symbols.push(s);
    }
    for (let i = symbols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [symbols[i], symbols[j]] = [symbols[j], symbols[i]];
    }

    // Dizimin boyutundan merkezleme.
    let cols = 0;
    let rows = 0;
    for (const [c, r] of cells) {
      if (c > cols) cols = c;
      if (r > rows) rows = r;
    }
    this.layoutCols = cols + 1;
    this.layoutRows = rows + 1;

    let idx = 0;
    for (const [col, row] of cells) {
      const s0 = symbols[idx++];
      const s1 = symbols[idx++];
      this.tiles.push(this.makeTile(s0, col, row, 0));
      this.tiles.push(this.makeTile(s1, col, row, 1));
    }
  }

  private layoutCols = 4;
  private layoutRows = 4;

  /** SaÄŸ panelin sol kenarÄ±na gÃ¶re, tahtanÄ±n ortalanacaÄŸÄ± x merkezi. */
  private boardOriginX(): number {
    const panelLeft = 900;
    const usableW = panelLeft - 40;
    return usableW / 2;
  }

  private makeTile(symbol: number, col: number, row: number, layer: number): Tile {
    // Ãœst katman aynÄ± hÃ¼crenin Ã¼zerine hafifÃ§e kayarak biner (mahjong hissi).
    const ox = layer * 12;
    const oy = layer * -14;
    const boardW = this.layoutCols * (TILE_W + GAP);
    const boardH = this.layoutRows * (TILE_H + GAP);
    // SaÄŸ panel (x=900+) hariÃ§ kullanÄ±labilir bÃ¶lgenin merkezine hizala.
    const sx0 = this.boardOriginX() - boardW / 2;
    const sy0 = (CANVAS_H - boardH) / 2 + 30;
    const sx = sx0 + col * (TILE_W + GAP) + ox;
    const sy = sy0 + row * (TILE_H + GAP) + oy;
    return {
      id: col * 1000 + row * 10 + layer,
      symbol,
      x: col,
      y: row,
      layer,
      removed: false,
      sx,
      sy,
    };
  }

  newGame(): void {
    this.tiles = [];
    this.selectedId = null;
    this.moves = 0;
    this.seconds = 0;
    this.won = false;
    this.history = [];
    this.tray = [];
    this.shards = [];
    this.buildLayout();
    this.emitHud();
  }

  /** Bir sonraki seviyeye geÃ§er; elle tanÄ±mlÄ±lar bittikten sonra rastgele
   *  seviyeler baÅŸlar ve 1000+ farklÄ± dizime kadar ilerlenebilir. */
  nextLevel(): void {
    this.levelIndex++;
    this.newGame();
  }

  goToLevel(i: number): void {
    this.levelIndex = ((i % LEVELS.length) + LEVELS.length) % LEVELS.length;
    this.newGame();
  }

  getLevelIndex(): number {
    return this.levelIndex;
  }

  getLevelCount(): number {
    return LEVELS.length;
  }

  undo(): void {
    const last = this.history.pop();
    if (!last) return;
    const a = this.tiles.find((t) => t.id === last.a);
    const b = this.tiles.find((t) => t.id === last.b);
    if (a) a.removed = false;
    if (b) b.removed = false;
    this.selectedId = null;
    this.moves = Math.max(0, this.moves - 1);
    this.emitHud();
  }

  // ---- MantÄ±k ----
  private topAt(col: number, row: number): Tile | null {
    let top: Tile | null = null;
    for (const t of this.tiles) {
      if (t.removed) continue;
      if (t.x === col && t.y === row) {
        if (!top || t.layer > top.layer) top = t;
      }
    }
    return top;
  }

  /** TaÅŸ aÃ§Ä±k mÄ±? ÃœstÃ¼nde taÅŸ yok (aynÄ± x,y Ã¼stte). */
  private isOpen(t: Tile): boolean {
    if (t.removed) return false;
    const top = this.topAt(t.x, t.y);
    return top === t;
  }

  private click(x: number, y: number): void {
    if (this.won) return;
    // En Ã¼stteki tÄ±klanan aÃ§Ä±k taÅŸ.
    let target: Tile | null = null;
    for (const t of this.tiles) {
      if (!this.isOpen(t)) continue;
      const halfW = TILE_W / 2;
      const halfH = TILE_H / 2;
      if (
        x >= t.sx - halfW &&
        x <= t.sx + halfW &&
        y >= t.sy - halfH &&
        y <= t.sy + halfH
      ) {
        if (!target || t.layer > target.layer) target = t;
      }
    }
    if (!target) return;

    if (this.selectedId === null) {
      this.selectedId = target.id;
      this.emitHud();
      return;
    }
    const selected = this.tiles.find((t) => t.id === this.selectedId)!;
    if (selected.id === target.id) {
      this.selectedId = null;
      this.emitHud();
      return;
    }
    if (selected.symbol === target.symbol) {
      // EÅŸleÅŸti -> kaldÄ±r, hazneye dÃ¼ÅŸÃ¼r.
      selected.removed = true;
      target.removed = true;
      this.history.push({ a: selected.id, b: target.id });
      this.tray.push(selected.symbol, target.symbol);
      this.moves++;
      this.selectedId = null;
      // Hazne tamamen doldu (4 taÅŸ = 2 eÅŸleÅŸme) -> kÄ±r.
      if (this.tray.length >= 4) {
        this.breakTray();
      }
      // Kazanma.
      if (this.tiles.every((t) => t.removed)) {
        this.won = true;
      }
      this.emitHud();
    } else {
      // EÅŸleÅŸmedi -> yeni seÃ§im.
      this.selectedId = target.id;
      this.emitHud();
    }
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };
  private update(dt: number): void {
    if (this.won) return;
    this.seconds += dt;
    // KÄ±rÄ±lma parÃ§alarÄ±nÄ± gÃ¼ncelle.
    for (const s of this.shards) {
      s.life -= dt;
      s.vy += 900 * dt; // yerÃ§ekimi
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y > CANVAS_H - 30) {
        s.y = CANVAS_H - 30;
        s.vy *= -0.4;
        s.vx *= 0.7;
      }
    }
    this.shards = this.shards.filter((s) => s.life > 0);
  }

  /** Haznedeki 4 taÅŸÄ± parÃ§alara ayÄ±rÄ±p patlatÄ±r ve hazneyi boÅŸaltÄ±r. */
  private breakTray(): void {
    const color = RUNE_COLORS;
    for (let i = 0; i < this.tray.length; i++) {
      const bx = CANVAS_W / 2 + (i - 1.5) * 40;
      const sym = this.tray[i];
      for (let k = 0; k < 6; k++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 180;
        this.shards.push({
          x: bx,
          y: CANVAS_H - 58,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 120,
          life: 0.7 + Math.random() * 0.5,
          max: 1,
          color: color[sym],
          r: 3 + Math.random() * 5,
        });
      }
    }
    this.tray = [];
  }

  private emitHud(): void {
    const remaining = this.tiles.filter((t) => !t.removed).length;
    let stuck = false;
    if (remaining > 0) {
      // Ã‡Ã¶zÃ¼lebilir mi? (basit: aÃ§Ä±k eÅŸleÅŸme var mÄ±)
      const opens = this.tiles.filter((t) => this.isOpen(t));
      const seen = new Set<number>();
      stuck = true;
      for (const o of opens) {
        if (seen.has(o.symbol)) {
          stuck = false;
          break;
        }
        seen.add(o.symbol);
      }
    }
    this.onHud?.({
      remaining,
      total: this.tiles.length,
      moves: this.moves,
      seconds: Math.floor(this.seconds),
      selected: this.selectedId === null ? -1 : this.selectedId,
      won: this.won,
      stuck,
      level: this.levelIndex,
      levelName: this.level().name,
    });
  }

  // ---- Render ----
  private render(): void {
    const c = this.ctx;
    const def = this.level();
    // Arka plan: seviyeye gÃ¶re buz + GÃ¶ktÃ¼rk tonu.
    const g = c.createLinearGradient(0, 0, 0, CANVAS_H);
    g.addColorStop(0, def.bg[0]);
    g.addColorStop(1, def.bg[1]);
    c.fillStyle = g;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // BaÅŸlÄ±k + seviye.
    c.fillStyle = "#d4e8f2";
    c.textAlign = "left";
    c.font = "bold 36px Georgia";
    c.fillText("GÃ¶ktÃ¼rk Mahjong", 90, 52);
    c.font = "bold 22px Georgia";
    c.fillStyle = "#9fd0e0";
    c.fillText(`Seviye ${this.levelIndex + 1} Â· ${def.name}`, 90, 84);

    // YerleÅŸimin Ã§erÃ§evesi (taÅŸ alanÄ±na gÃ¶re).
    const boxW = this.layoutCols * (TILE_W + GAP) + GAP;
    const boxH = this.layoutRows * (TILE_H + GAP) + GAP;
    const bx = this.boardOriginX() - boxW / 2;
    const by = (CANVAS_H - boxH) / 2 + 30;
    c.strokeStyle = "rgba(255,255,255,0.08)";
    c.lineWidth = 2;
    c.strokeRect(bx - 12, by - 12, boxW + 24, boxH + 24);

    // TaÅŸlarÄ± Ã§iz (en Ã¼st katman Ã¶nce deÄŸil, altâ†’Ã¼st sÄ±ralama render etkisi).
    const sorted = [...this.tiles].sort((a, b) => a.layer - b.layer);
    for (const t of sorted) {
      if (t.removed) continue;
      const open = this.isOpen(t);
      const sel = t.id === this.selectedId;
      this.drawTile(c, t, open, sel);
    }

    // ---- Kırılma parçacıkları (taşların üstünde çizilir) ----
    for (const s of this.shards) {
      const a = Math.max(0, s.life / s.max);
      c.globalAlpha = a;
      c.fillStyle = s.color;
      c.beginPath();
      c.moveTo(s.x, s.y);
      c.lineTo(s.x + s.r, s.y - s.r * 1.4);
      c.lineTo(s.x + s.r * 1.6, s.y + s.r * 0.4);
      c.closePath();
      c.fill();
    }
    c.globalAlpha = 1;

    // ---- Hazne (dört taşlık yuva) ----
    const trayY = CANVAS_H - 34;
    const trayCx = CANVAS_W / 2;
    const slotW = 72;
    const gapSlot = 10;
    const trayW = 4 * slotW + 3 * gapSlot;
    c.fillStyle = "rgba(10,20,30,0.35)";
    c.beginPath();
    c.roundRect(trayCx - trayW / 2 - 14, trayY - 40, trayW + 28, 66, 14);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.25)";
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = "#b9d4e0";
    c.font = "bold 14px Georgia";
    c.textAlign = "center";
    c.fillText("HAZNE", trayCx, trayY - 46);
    for (let i = 0; i < 4; i++) {
      const sx = trayCx - trayW / 2 + i * (slotW + gapSlot);
      c.fillStyle = "rgba(255,255,255,0.06)";
      c.beginPath();
      c.roundRect(sx, trayY - 28, slotW, 40, 10);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.18)";
      c.lineWidth = 1;
      c.stroke();
      if (i < this.tray.length) {
        c.fillStyle = RUNE_COLORS[this.tray[i]];
        c.font = "bold 30px 'Segoe UI Historic','Noto Sans Old Turkic',serif";
        c.textBaseline = "alphabetic";
        c.fillText(RUNES[this.tray[i]], sx + slotW / 2, trayY + 8);
      }
    }
    c.textBaseline = "alphabetic";
    // Kenar paneli (saÄŸda): istatistik.
    const remaining = this.tiles.filter((t) => !t.removed).length;
    const total = this.tiles.length;
    c.fillStyle = "#d4e8f2";
    c.font = "18px Georgia";
    c.textAlign = "left";
    c.fillText(`Kalan: ${remaining} / ${total}`, 900, 180);
    c.fillText(`Hamle: ${this.moves}`, 900, 215);
    c.fillText(`SÃ¼re: ${Math.floor(this.seconds)} sn`, 900, 250);

    c.fillStyle = "#7f96b8";
    c.font = "15px Georgia";
    c.fillText("Ä°pucu: AynÄ± rÃ¼nde", 900, 310);
    c.fillText("iki AÃ‡IK taÅŸ seÃ§,", 900, 332);
    c.fillText("kaldÄ±r. ÃœstÃ¼ aÃ§Ä±k", 900, 354);
    c.fillText("taÅŸlar seÃ§ilebilir.", 900, 376);
    c.fillText("[Yeni Oyun] Klavye: N", 900, 420);
    c.fillText("[Geri Al] Klavye: U", 900, 444);
    c.fillText("[Sonraki] Klavye: L", 900, 468);
  }

  private drawTile(
    c: CanvasRenderingContext2D,
    t: Tile,
    open: boolean,
    selected: boolean,
  ): void {
    const w = TILE_W;
    const h = TILE_H;
    const x = t.sx - w / 2;
    const yTop = t.sy - h / 2;

    // ---- Renkler: 2D tek renk taÅŸ (aÃ§Ä±k = fildiÅŸi, kapalÄ± = koyu) ----
    const face = open ? "#f3ead6" : "#3d434b";
    const faceTop = open ? shade(face, 9) : shade(face, 9);
    const faceBot = open ? shade(face, -9) : shade(face, -5);
    const inner = open ? shade(face, -17) : shade(face, 16);
    const rim = open ? shade(face, -27) : shade(face, -22);

    // ---- 2D gÃ¶lge (saÄŸ-alt offset) ----
    c.fillStyle = "rgba(0,0,0,0.25)";
    c.beginPath();
    c.roundRect(x + 4, yTop + 5, w, h, 9);
    c.fill();

    // ---- GÃ¶vde (hafif dikey Ä±ÅŸÄ±k) ----
    const bg = c.createLinearGradient(0, yTop, 0, yTop + h);
    bg.addColorStop(0, faceTop);
    bg.addColorStop(1, faceBot);
    c.fillStyle = bg;
    c.beginPath();
    c.roundRect(x, yTop, w, h, 9);
    c.fill();

    // ---- KapalÄ± taÅŸ: dokuma desen; AÃ§Ä±k taÅŸ: iÃ§ madalyon ----
    if (open) {
      c.fillStyle = inner;
      c.beginPath();
      c.roundRect(x + 7, yTop + 9, w - 14, h - 18, 9);
      c.fill();
      c.strokeStyle = shade(face, -37);
      c.lineWidth = 1.3;
      c.beginPath();
      c.roundRect(x + 7, yTop + 9, w - 14, h - 18, 9);
      c.stroke();
    } else {
      c.save();
      c.globalAlpha = 0.18;
      c.strokeStyle = "#ffffff";
      c.lineWidth = 1;
      for (let i = -1; i < 5; i++) {
        const off = x + i * 12;
        c.beginPath();
        c.moveTo(off, yTop);
        c.lineTo(off + 10, yTop + h);
        c.stroke();
      }
      c.restore();
    }

    // ---- Kenar Ã§izgisi ----
    c.strokeStyle = selected ? "#ffb020" : rim;
    c.lineWidth = selected ? 3.5 : 1.8;
    c.beginPath();
    c.roundRect(x, yTop, w, h, 9);
    c.stroke();

    // ---- Renkli rÃ¼n ----
    c.font =
      (open ? "bold 36px " : "bold 26px ") +
      "'Segoe UI Historic','Noto Sans Old Turkic',serif";
    c.textAlign = "center";
    c.textBaseline = "alphabetic";
    if (open) {
      c.fillStyle = shade(face, -44);
      c.fillText(RUNES[t.symbol], t.sx + 1.5, t.sy + 2);
      c.fillStyle = RUNE_COLORS[t.symbol];
      c.fillText(RUNES[t.symbol], t.sx, t.sy);
    } else {
      c.globalAlpha = 0.35;
      c.fillStyle = RUNE_COLORS[t.symbol];
      c.fillText(RUNES[t.symbol], t.sx, t.sy);
      c.globalAlpha = 1;
    }

    // ---- SeÃ§ili vurgusu ----
    if (selected) {
      c.strokeStyle = "rgba(255,176,32,0.55)";
      c.lineWidth = 2.5;
      c.beginPath();
      c.roundRect(x - 5, yTop - 5, w + 10, h + 10, 12);
      c.stroke();
    }
  }
}
