// Göktürk Mahjong Solitaire
// Kurallar: aynı Göktürk rününe sahip iki AÇIK taşı seçip eşleştir, kaldır.
// Tüm taşlar kalkınca oyunu kazanırsın.

const CANVAS_W = 1280;
const CANVAS_H = 720;

// Bir hex rengini belirli oranda açık (+) ya da koyu (-) yapar.
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
  symbol: number; // rün indeksi
  x: number; // hücre sütunu
  y: number; // hücre satırı
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

// Göktürk rünleri (Orhun alfabesi). Her biri bir "aile" = 4 taş.
const RUNES = [
  "𐰀", "𐰆", "𐰉", "𐰒", "𐰤", "𐰞", "𐰱", "𐰾",
  "𐰋", "𐰑", "𐰚", "𐰃", "𐰅", "𐰇", "𐰈", "𐰢",
];

// Her rün sembolüne özel renk (açık taş üzerinde okunaklı, doygun tonlar).
const RUNE_COLORS = [
  "#c0392b", "#e07b39", "#2e86c1", "#27ae60", "#8e44ad", "#d35400", "#16a085", "#7d3c98",
  "#c1286f", "#6c8e23", "#e8432f", "#0e7ac7", "#9b5de5", "#f1a208", "#0ca3b2", "#7d4fd6",
];
const TILE_W = 58;
const TILE_H = 94;
const GAP = 14;

// Seviye dizimleri. Her hücre 2 katman taş (üst açık, alt kapalı) alır,
// böylece her seviye her zaman çözülebilir. Hücre sayısı = rün sayısı * 2.
const LEVELS: Array<{ name: string; cells: Array<[number, number]>; bg: [string, string] }> =
  [
    { name: "Sıra", cells: rowShape(2, 4), bg: ["#0e2433", "#16384a"] },
    { name: "Dama", cells: checkerShape(4, 4), bg: ["#0c2833", "#17404e"] },
    { name: "Çapraz", cells: crossShape(4, 4), bg: ["#17243b", "#24365b"] },
    { name: "U Şekli", cells: uShape(4, 5), bg: ["#273323", "#3a4a2f"] },
    { name: "Çerçeve", cells: frameShape(4, 4), bg: ["#14233d", "#20314f"] },
    { name: "Sütun", cells: rowShape(3, 4), bg: ["#33233c", "#4a2f56"] },
    { name: "Kare", cells: rowShape(4, 4), bg: ["#0d2e33", "#1a4650"] },
    { name: "Piramit", cells: pyramidShape(8), bg: ["#3a2a16", "#544026"] },
    { name: "Geniş Alan", cells: rowShape(5, 4), bg: ["#271f3f", "#3a2a53"] },
    { name: "Halka", cells: ringShape(5, 5), bg: ["#1f3a33", "#2c5448"] },
    { name: "Geniş Alan 2", cells: rowShape(7, 4), bg: ["#3a2030", "#542d45"] },
    { name: "Büyük Kare", cells: rowShape(8, 4), bg: ["#2a1f3f", "#3d2a5c"] },
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
  // Üst kenar açık, alt kenar ve yanlar dolu (U harfi).
  const out: Array<[number, number]> = [];
  for (let r = 1; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (r === rows - 1 || c === 0 || c === cols - 1) out.push([c, r]);
  return out;
}
function pyramidShape(maxCols: number): Array<[number, number]> {
  // Basamaklı ters piramit: her satırda 2,4,6,8... merkezli hücre.
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
  // Kalın halka: dış çerçeve + iç çerçeve.
  const outer = frameShape(cols, rows);
  const inner = frameShape(cols - 2, rows - 2).map(
    ([c, r]): [number, number] => [c + 1, r + 1],
  );
  return [...outer, ...inner];
}

// Deterministik (seeded) rastgele sayı üretici: aynı seviye her zaman
// aynı dizim üretir, böylece "yeniden oyna" seviyeyi değiştirmez.
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

// Seviye ilerledikçe rastgele yeni bir dizim üretir: birkaç bitişik blok
// (adacık) rastgele yerleştirilir. Her bloğun hücre sayısı çifttir (2x2, 2x3,
// 3x2, 3x3), toplam çift sayıya yuvarlanır, böylece her dizim çözülebilir ve
// rün havuzunu (16 rün = 32 hücre) aşmaz. Deterministik (seeded): aynı seviye
// her zaman aynı dizimi üretir.
function randomShape(levelIndex: number): Array<[number, number]> {
  const rng = mulberry32(levelIndex * 104729 + 13);
  const cols = 8;
  const rows = 5;
  const grid = new Set<string>();
  const blocks = 2 + Math.floor(rng() * 2); // 2..3 blok (max 27 hücre <= 32)
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
  // Çift hücre garantisi (çözülebilirlik).
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
  private tray: number[] = []; // hazneye düşen eşlenen rünler (max 4)
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
    // Hover vurgusu şu anlık kullanılmıyor.
  };
  private onDown = (e: PointerEvent): void => {
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * this.canvas.width;
    const y = ((e.clientY - r.top) / r.height) * this.canvas.height;
    this.click(x, y);
  };

  // ---- Yerleşim ----
  private level(): { name: string; cells: Array<[number, number]>; bg: [string, string] } {
    if (this.levelIndex < LEVELS.length) {
      return LEVELS[this.levelIndex];
    }
    // Elle tanımlı seviyeler bittikten sonra rastgele (deterministik) dizim.
    const cells = randomShape(this.levelIndex);
    const bg = RANDOM_BG[this.levelIndex % RANDOM_BG.length];
    return { name: `Rastgele #${this.levelIndex + 1}`, cells, bg };
  }

  private buildLayout(): void {
    // Seviyenin dizimindeki her hücre 2 katman taş alır (alt + üst).
    // Üst katmandaki tüm taşlar açıktır ve çiftler halinde eşleştirilebilir;
    // kalkınca alttakiler açılır -> her seviye her zaman çözülebilir.
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

  /** Sağ panelin sol kenarına göre, tahtanın ortalanacağı x merkezi. */
  private boardOriginX(): number {
    const panelLeft = 900;
    const usableW = panelLeft - 40;
    return usableW / 2;
  }

  private makeTile(symbol: number, col: number, row: number, layer: number): Tile {
    // Üst katman aynı hücrenin üzerine hafifçe kayarak biner (mahjong hissi).
    const ox = layer * 12;
    const oy = layer * -14;
    const boardW = this.layoutCols * (TILE_W + GAP);
    const boardH = this.layoutRows * (TILE_H + GAP);
    // Sağ panel (x=900+) hariç kullanılabilir bölgenin merkezine hizala.
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

  /** Bir sonraki seviyeye geçer; elle tanımlılar bittikten sonra rastgele
   *  seviyeler başlar ve 1000+ farklı dizime kadar ilerlenebilir. */
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

  // ---- Mantık ----
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

  /** Taş açık mı? Üstünde taş yok (aynı x,y üstte). */
  private isOpen(t: Tile): boolean {
    if (t.removed) return false;
    const top = this.topAt(t.x, t.y);
    return top === t;
  }

  private click(x: number, y: number): void {
    if (this.won) return;
    // En üstteki tıklanan açık taş.
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
      // Eşleşti -> kaldır, hazneye düşür.
      selected.removed = true;
      target.removed = true;
      this.history.push({ a: selected.id, b: target.id });
      this.tray.push(selected.symbol, target.symbol);
      this.moves++;
      this.selectedId = null;
      // Hazne tamamen doldu (4 taş = 2 eşleşme) -> kır.
      if (this.tray.length >= 4) {
        this.breakTray();
      }
      // Kazanma.
      if (this.tiles.every((t) => t.removed)) {
        this.won = true;
      }
      this.emitHud();
    } else {
      // Eşleşmedi -> yeni seçim.
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
    // Kırılma parçalarını güncelle.
    for (const s of this.shards) {
      s.life -= dt;
      s.vy += 900 * dt; // yerçekimi
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

  /** Haznedeki 4 taşı parçalara ayırıp patlatır ve hazneyi boşaltır. */
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
      // Çözülebilir mi? (basit: açık eşleşme var mı)
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
    // Arka plan: seviyeye göre buz + Göktürk tonu.
    const g = c.createLinearGradient(0, 0, 0, CANVAS_H);
    g.addColorStop(0, def.bg[0]);
    g.addColorStop(1, def.bg[1]);
    c.fillStyle = g;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Başlık + seviye.
    c.fillStyle = "#d4e8f2";
    c.textAlign = "left";
    c.font = "bold 36px Georgia";
    c.fillText("Göktürk Mahjong", 90, 52);
    c.font = "bold 22px Georgia";
    c.fillStyle = "#9fd0e0";
    c.fillText(`Seviye ${this.levelIndex + 1} · ${def.name}`, 90, 84);

    // Yerleşimin çerçevesi (taş alanına göre).
    const boxW = this.layoutCols * (TILE_W + GAP) + GAP;
    const boxH = this.layoutRows * (TILE_H + GAP) + GAP;
    const bx = this.boardOriginX() - boxW / 2;
    const by = (CANVAS_H - boxH) / 2 + 30;
    c.strokeStyle = "rgba(255,255,255,0.08)";
    c.lineWidth = 2;
    c.strokeRect(bx - 12, by - 12, boxW + 24, boxH + 24);

    // Taşları çiz (en üst katman önce değil, alt→üst sıralama render etkisi).
    const sorted = [...this.tiles].sort((a, b) => a.layer - b.layer);
    for (const t of sorted) {
      if (t.removed) continue;
      const open = this.isOpen(t);
      const sel = t.id === this.selectedId;
      this.drawTile(c, t, open, sel);
    }

    // ---- Kirilma parcaciklari (taslarin ustunde cizilir) ----
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

    // ---- Hazne (dort taslik yuva) ----
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


    // Kenar paneli (sağda): istatistik.
    const remaining = this.tiles.filter((t) => !t.removed).length;
    const total = this.tiles.length;
    c.fillStyle = "#d4e8f2";
    c.font = "18px Georgia";
    c.textAlign = "left";
    c.fillText(`Kalan: ${remaining} / ${total}`, 900, 180);
    c.fillText(`Hamle: ${this.moves}`, 900, 215);
    c.fillText(`Süre: ${Math.floor(this.seconds)} sn`, 900, 250);

    c.fillStyle = "#7f96b8";
    c.font = "15px Georgia";
    c.fillText("İpucu: Aynı ründe", 900, 310);
    c.fillText("iki AÇIK taş seç,", 900, 332);
    c.fillText("kaldır. Üstü açık", 900, 354);
    c.fillText("taşlar seçilebilir.", 900, 376);
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

    // ---- Renkler: 2D tek renk taş (açık = fildişi, kapalı = koyu) ----
    const face = open ? "#f3ead6" : "#3d434b";
    const faceTop = open ? shade(face, 9) : shade(face, 9);
    const faceBot = open ? shade(face, -9) : shade(face, -5);
    const inner = open ? shade(face, -17) : shade(face, 16);
    const rim = open ? shade(face, -27) : shade(face, -22);

    // ---- 2D gölge (sağ-alt offset) ----
    c.fillStyle = "rgba(0,0,0,0.25)";
    c.beginPath();
    c.roundRect(x + 4, yTop + 5, w, h, 9);
    c.fill();

    // ---- Gövde (hafif dikey ışık) ----
    const bg = c.createLinearGradient(0, yTop, 0, yTop + h);
    bg.addColorStop(0, faceTop);
    bg.addColorStop(1, faceBot);
    c.fillStyle = bg;
    c.beginPath();
    c.roundRect(x, yTop, w, h, 9);
    c.fill();

    // ---- Kapalı taş: dokuma desen; Açık taş: iç madalyon ----
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

    // ---- Kenar çizgisi ----
    c.strokeStyle = selected ? "#ffb020" : rim;
    c.lineWidth = selected ? 3.5 : 1.8;
    c.beginPath();
    c.roundRect(x, yTop, w, h, 9);
    c.stroke();

    // ---- Renkli rün ----
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

    // ---- Seçili vurgusu ----
    if (selected) {
      c.strokeStyle = "rgba(255,176,32,0.55)";
      c.lineWidth = 2.5;
      c.beginPath();
      c.roundRect(x - 5, yTop - 5, w + 10, h + 10, 12);
      c.stroke();
    }
  }
}
