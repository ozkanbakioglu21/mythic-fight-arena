// Ötüken Mahjong Solitaire
// Kurallar: aynı Göktürk rününe sahip iki AÇIK taşı seçip eşleştir, kaldır.
// Tüm taşlar kalkınca oyunu kazanırsın.

const CANVAS_W = 720;
const CANVAS_H = 1280;

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
  "𐰁", "𐰂", "𐰗", "𐰜",
];

// Her rün sembolüne özel renk (açık taş üzerinde okunaklı, doygun tonlar).
const RUNE_COLORS = [
  "#c0392b", "#e07b39", "#2e86c1", "#27ae60", "#8e44ad", "#d35400", "#16a085", "#7d3c98",
  "#c1286f", "#6c8e23", "#e8432f", "#0e7ac7", "#9b5de5", "#f1a208", "#0ca3b2", "#7d4fd6",
  "#6f4e37", "#4a148c", "#b0990a", "#0b7285",
];
const TILE_W = 72;
const TILE_H = 100;
const GAP = 10;

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
function randomShape(levelIndex: number, seedOffset = 0): Array<[number, number]> {
  const rng = mulberry32(levelIndex * 104729 + 13 + seedOffset);
  const cols = 8;
  const rows = 6;
  const MAX_CELLS = 40;
  const grid = new Set<string>();
  // Karmaşık taş dizimleri: dikdörtgen, L, T, artı, basamak ve kule şekilleri.
  const shapes = [
    { w: 3, h: 3, cells: rect(3, 3) },
    { w: 2, h: 3, cells: rect(2, 3) },
    { w: 4, h: 2, cells: rect(4, 2) },
    { w: 3, h: 3, cells: lShape() },
    { w: 3, h: 3, cells: tShape() },
    { w: 3, h: 3, cells: plusShape() },
    { w: 3, h: 3, cells: stair() },
    { w: 3, h: 4, cells: tower() },
  ];
  const blocks = 6 + (levelIndex % 7);
  for (let i = 0; i < blocks && grid.size < MAX_CELLS; i++) {
    const sh = shapes[Math.floor(rng() * shapes.length)];
    const cx = Math.floor(rng() * (cols - sh.w + 1));
    const cy = Math.floor(rng() * (rows - sh.h + 1));
    for (const pt of sh.cells) {
      grid.add((cx + pt[0]) + "," + (cy + pt[1]));
      if (grid.size >= MAX_CELLS) break;
    }
  }
  const cells = [...grid].map((s) => {
    const p = s.split(",").map(Number);
    return [p[0], p[1]] as [number, number];
  });
  // Çift hücre garantisi (çözülebilirlik).
  if (cells.length % 2 !== 0) cells.pop();
  return cells;
}

function rect(w: number, h: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push([x, y]);
  return out;
}
function lShape(): [number, number][] {
  return [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]];
}
function tShape(): [number, number][] {
  return [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]];
}
function plusShape(): [number, number][] {
  return [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]];
}
function stair(): [number, number][] {
  return [[0, 2], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]];
}
function tower(): [number, number][] {
  return [[1, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2], [1, 3]];
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
  private lost = false;
  private currentLevel: { name: string; cells: Array<[number, number]>; bg: [string, string] } | null = null;
  private history: Array<{ a: number; b: number }> = [];
  private levelIndex = 0;
  private tray: Array<{ id: number; symbol: number }> = []; // hazneye düşen eşlenen rünler (max 4)
  private motifsCache: HTMLCanvasElement | null = null;
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
  private bursts: Array<{ x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number }> = [];
  private floats: Array<{ x: number; y: number; life: number; max: number; text: string; color: string }> = [];
  private pops: Array<{ x: number; y: number; life: number; max: number; symbol: number; open: boolean }> = [];
  private time = 0;

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
    if (!this.currentLevel) {
      // Her oyunda farkli bir rastgele dizilim + rastgele gecmis/bg.
      const cells = randomShape(this.levelIndex, Math.floor(Math.random() * 100000) + 1);
      const special = this.specialArt();
      const seasonBg = ["#163a26", "#24503a"] as [string, string];
      const animalBg = ["#2f3b1c", "#4a5b2a"] as [string, string];
      const bg = special === "animals" ? animalBg : special === "seasonal" ? seasonBg : RANDOM_BG[this.levelIndex % RANDOM_BG.length];
      const name =
        this.levelIndex < LEVELS.length
          ? LEVELS[this.levelIndex].name
          : special === "seasonal"
            ? "Mevsimler & Ağaçlar"
            : special === "animals"
              ? "Hayvanlar"
              : `Rastgele #${this.levelIndex + 1}`;
      this.currentLevel = { name, cells, bg };
    }
    return this.currentLevel;
  }

  private buildLayout(): void {
    // Seviyenin dizimindeki her hücre 2 katman taş alır (alt + üst).
    // Üst katmandaki tüm taşlar açıktır ve çiftler halinde eşleştirilebilir;
    // kalkınca alttakiler açılır -> her seviye her zaman çözülebilir.
    const def = this.level();
    const cells = def.cells;
    let runes = Math.min(RUNES.length, Math.floor(cells.length / 2));
    if (this.specialArt() !== "none") runes = 16; // özel seviyelerde 8 ikon + 8 rün

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
      if (idx + 2 > symbols.length) break;
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
    return CANVAS_W / 2;
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
    this.lost = false;
    this.currentLevel = null;
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

  /** Yanı (sol ve sağ yatay komşusu) en az biri boş mu, ya da
   *  yandaki taş alt dizide (daha alt katmanda) mı? Yüksekte kalan taş,
   *  yanındaki taş aynı veya daha üst katmandaysa bloklanır; alt katmandaysa alınabilir. */
  private sideFree(t: Tile): boolean {
    const blocking = (x: number) =>
      this.tiles.some(
        (o) => !o.removed && o.x === x && o.y === t.y && o.layer >= t.layer,
      );
    return !blocking(t.x - 1) || !blocking(t.x + 1);
  }

  private retryHit(x: number, y: number): boolean {
    const bcx = CANVAS_W / 2, bcy = CANVAS_H - 380;
    return x >= bcx - 105 && x <= bcx + 105 && y >= bcy - 29 && y <= bcy + 29;
  }

  private click(x: number, y: number): void {
    if (this.won) return;
    if (this.lost) {
      if (this.retryHit(x, y)) this.newGame();
      return;
    }
    // En üstteki tıklanan açık taş.
    let target: Tile | null = null;
    for (const t of this.tiles) {
      if (!this.isOpen(t) || !this.sideFree(t)) continue;
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

    // Taşı tahtadan alıp hazneye tek tek ekle.
    target.removed = true;
    this.tray.push({ id: target.id, symbol: target.symbol });

    // Haznede aynı ründen 2 varsa -> kır (eşleşme).
    const lastIdx = this.tray.length - 1;
    let pairIdx = -1;
    for (let i = 0; i < lastIdx; i++) {
      if (this.tray[i].symbol === target.symbol) {
        pairIdx = i;
        break;
      }
    }
    if (pairIdx !== -1) {
      this.breakPair(pairIdx, lastIdx);
    } else if (this.tray.length >= 4) {
      // Hazne doldu: oyuncu kaybeder.
      this.lost = true;
    }

    // Kazanma.
    if (this.tiles.every((t) => t.removed)) {
      this.won = true;
    }
    this.emitHud();
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
    this.time += dt;
    if (!this.won && !this.lost) this.seconds += dt;
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
    for (const b of this.bursts) { b.life -= dt; b.vy += 600 * dt; b.x += b.vx * dt; b.y += b.vy * dt; }
    this.bursts = this.bursts.filter((b) => b.life > 0);
    for (const f of this.floats) { f.life -= dt; f.y -= 40 * dt; }
    this.floats = this.floats.filter((f) => f.life > 0);
    for (const pp of this.pops) pp.life -= dt;
    this.pops = this.pops.filter((pp) => pp.life > 0);
    // Kazaninca kutlama kivilcimlari fiskirir.
    if (this.won) {
      for (let k = 0; k < 2; k++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 200;
        this.bursts.push({
          x: CANVAS_W / 2 + (Math.random() - 0.5) * 320,
          y: CANVAS_H - 120 + Math.random() * 60,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 140,
          life: 0.6 + Math.random() * 0.6,
          max: 1,
          color: RUNE_COLORS[Math.floor(Math.random() * RUNE_COLORS.length)],
          r: 4 + Math.random() * 6,
        });
      }
    }
    // Kazaninca kutlama kivilcimlari fiskirir.
    if (this.won) {
      for (let k = 0; k < 2; k++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 200;
        this.bursts.push({
          x: CANVAS_W / 2 + (Math.random() - 0.5) * 320,
          y: CANVAS_H - 120 + Math.random() * 60,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 140,
          life: 0.6 + Math.random() * 0.6,
          max: 1,
          color: RUNE_COLORS[Math.floor(Math.random() * RUNE_COLORS.length)],
          r: 4 + Math.random() * 6,
        });
      }
    }
    // Kazaninca kutlama kivilcimlari fiskirir.
    if (this.won) {
      for (let k = 0; k < 2; k++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 200;
        this.bursts.push({
          x: CANVAS_W / 2 + (Math.random() - 0.5) * 320,
          y: CANVAS_H - 120 + Math.random() * 60,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 140,
          life: 0.6 + Math.random() * 0.6,
          max: 1,
          color: RUNE_COLORS[Math.floor(Math.random() * RUNE_COLORS.length)],
          r: 4 + Math.random() * 6,
        });
      }
    }
    // Kazaninca kutlama kivilcimlari fiskirir.
    if (this.won) {
      for (let k = 0; k < 2; k++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 200;
        this.bursts.push({
          x: CANVAS_W / 2 + (Math.random() - 0.5) * 320,
          y: CANVAS_H - 120 + Math.random() * 60,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 140,
          life: 0.6 + Math.random() * 0.6,
          max: 1,
          color: RUNE_COLORS[Math.floor(Math.random() * RUNE_COLORS.length)],
          r: 4 + Math.random() * 6,
        });
      }
    }
    // Kazaninca kutlama kivilcimlari fiskirir.
    if (this.won) {
      for (let k = 0; k < 2; k++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 200;
        this.bursts.push({
          x: CANVAS_W / 2 + (Math.random() - 0.5) * 320,
          y: CANVAS_H - 120 + Math.random() * 60,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 140,
          life: 0.6 + Math.random() * 0.6,
          max: 1,
          color: RUNE_COLORS[Math.floor(Math.random() * RUNE_COLORS.length)],
          r: 4 + Math.random() * 6,
        });
      }
    }
    // Kazaninca kutlama kivilcimlari fiskirir.
    if (this.won) {
      for (let k = 0; k < 2; k++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 200;
        this.bursts.push({
          x: CANVAS_W / 2 + (Math.random() - 0.5) * 320,
          y: CANVAS_H - 120 + Math.random() * 60,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 140,
          life: 0.6 + Math.random() * 0.6,
          max: 1,
          color: RUNE_COLORS[Math.floor(Math.random() * RUNE_COLORS.length)],
          r: 4 + Math.random() * 6,
        });
      }
    }
    // Kazaninca kutlama kivilcimlari fiskirir.
    if (this.won) {
      for (let k = 0; k < 2; k++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 200;
        this.bursts.push({
          x: CANVAS_W / 2 + (Math.random() - 0.5) * 320,
          y: CANVAS_H - 120 + Math.random() * 60,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 140,
          life: 0.6 + Math.random() * 0.6,
          max: 1,
          color: RUNE_COLORS[Math.floor(Math.random() * RUNE_COLORS.length)],
          r: 4 + Math.random() * 6,
        });
      }
    }
  }

  /** Haznedeki 4 taşı parçalara ayırıp patlatır ve hazneyi boşaltır. */
    /** Haznedeki pairIdx ve lastIdx slotlarindaki iki tasi kirar. */
  private breakPair(a: number, b: number): void {
    const color = RUNE_COLORS;
    if (a > b) {
      const t = a;
      a = b;
      b = t;
    }
    const eA = this.tray[a];
    const eB = this.tray[b];
    if (eA && eB) {
      const btA = this.tiles.find((tt) => tt.id === eA.id);
      const btB = this.tiles.find((tt) => tt.id === eB.id);
      for (const bt of [btA, btB]) {
        if (!bt) continue;
        for (let k = 0; k < 18; k++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 90 + Math.random() * 260;
          this.bursts.push({ x: bt.sx, y: bt.sy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 60, life: 0.7, max: 1, color: RUNE_COLORS[bt.symbol], r: 3 + Math.random() * 6 });
        }
        this.bursts.push({ x: bt.sx, y: bt.sy, vx: 0, vy: -40, life: 0.35, max: 0.35, color: "#ffffff", r: 26 });
      }
      this.floats.push({ x: (btA!.sx + btB!.sx) / 2, y: (btA!.sy + btB!.sy) / 2 - 10, life: 1.0, max: 1.0, text: "+2", color: "#ffd75e" });
    }
    const shard = (slot: number, sym: number) => {
      const bx = CANVAS_W / 2 + (slot - 1.5) * 40;
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
    };
    shard(a, eA.symbol);
    shard(b, eB.symbol);
    this.history.push({ a: eA.id, b: eB.id });
    this.moves++;
    this.tray.splice(b, 1);
    this.tray.splice(a, 1);
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

  /** Göktürk motifleri: arka plan rünleri, altın tonlu bantlar (bir kez çizilip önbelleğe alınır). */
  /** Göktürk obası sahnesi + motifler (bir kez çizilip önbelleğe alınır). */
  private drawMotifs(c: CanvasRenderingContext2D): void {
    if (!this.motifsCache) {
      const off = document.createElement("canvas");
      off.width = CANVAS_W;
      off.height = CANVAS_H;
      const m = off.getContext("2d")!;
      m.textAlign = "center";

      // ---- Uzak dağ tepeleri (silüet) ----
      const ridge = (baseY: number, amp: number, seed: number) => {
        m.beginPath();
        m.moveTo(0, baseY + 40);
        for (let x = 0; x <= CANVAS_W; x += 30) {
          const y = baseY - Math.abs(Math.sin((x + seed) * 0.006) * amp) - amp * 0.4;
          m.lineTo(x, y);
        }
        m.lineTo(CANVAS_W, CANVAS_H);
        m.lineTo(0, CANVAS_H);
        m.closePath();
        m.fill();
      };
      m.save();
      m.globalAlpha = 0.5;
      m.fillStyle = "rgba(140,165,190,0.14)";
      ridge(420, 60, 40);
      m.fillStyle = "rgba(120,150,175,0.18)";
      ridge(505, 45, 130);
      m.fillStyle = "rgba(100,130,155,0.22)";
      ridge(590, 38, 210);
      m.restore();

      // ---- Gök bayrağı / tuğ (solda) ----
      const tugh = (fx: number, fy: number) => {
        m.strokeStyle = "rgba(90,110,120,0.35)";
        m.lineWidth = 3;
        m.beginPath();
        m.moveTo(fx, fy);
        m.lineTo(fx, fy + 90);
        m.stroke();
        m.strokeStyle = "rgba(180,200,215,0.30)";
        m.lineWidth = 2;
        for (let k = 0; k < 4; k++) {
          m.beginPath();
          m.moveTo(fx, fy);
          m.quadraticCurveTo(fx - 26, fy + 10 + k * 5, fx - 10, fy + 34 + k * 5);
          m.stroke();
        }
      };
      m.save();
      m.globalAlpha = 0.6;
      tugh(140, 150);
      tugh(148, 148);
      m.restore();

      // ---- Yurtlar (konik çadırlar) ----
      const yurt = (cx: number, baseY: number, w: number, h: number) => {
        m.fillStyle = "rgba(150,150,130,0.28)";
        m.beginPath();
        m.moveTo(cx - w / 2, baseY);
        m.lineTo(cx, baseY - h);
        m.lineTo(cx + w / 2, baseY);
        m.closePath();
        m.fill();
        m.strokeStyle = "rgba(255,255,255,0.10)";
        m.lineWidth = 1.5;
        m.stroke();
        m.fillStyle = "rgba(80,70,50,0.35)";
        m.beginPath();
        m.moveTo(cx - 8, baseY);
        m.lineTo(cx - 8, baseY - 16);
        m.lineTo(cx + 8, baseY - 16);
        m.lineTo(cx + 8, baseY);
        m.closePath();
        m.fill();
        m.strokeStyle = "rgba(200,150,80,0.25)";
        m.lineWidth = 2;
        m.beginPath();
        m.moveTo(cx - w / 2 + 4, baseY - h * 0.15);
        m.lineTo(cx + w / 2 - 4, baseY - h * 0.15);
        m.stroke();
      };
      m.save();
      m.globalAlpha = 0.7;
      yurt(360, 648, 150, 108);
      yurt(560, 660, 175, 124);
      yurt(820, 648, 140, 100);
      yurt(1050, 665, 180, 130);
      m.restore();

      // ---- Ateş / ocak (solda, yurt önünde) ----
      m.save();
      m.globalAlpha = 0.5;
      const fireX = 470;
      const fireY = 668;
      m.fillStyle = "rgba(230,150,60,0.35)";
      m.beginPath();
      m.moveTo(fireX - 14, fireY);
      m.quadraticCurveTo(fireX - 4, fireY - 34, fireX, fireY - 46);
      m.quadraticCurveTo(fireX + 6, fireY - 30, fireX + 16, fireY);
      m.closePath();
      m.fill();
      m.fillStyle = "rgba(250,210,120,0.35)";
      m.beginPath();
      m.moveTo(fireX - 8, fireY);
      m.quadraticCurveTo(fireX - 2, fireY - 20, fireX, fireY - 28);
      m.quadraticCurveTo(fireX + 4, fireY - 18, fireX + 10, fireY);
      m.closePath();
      m.fill();
      m.restore();

      // ---- Zayıf arka plan rünleri (su izi) ----
      m.save();
      m.globalAlpha = 0.06;
      m.fillStyle = "#ffffff";
      m.font = "150px 'Segoe UI Historic','Noto Sans Old Turkic',serif";
      const spots: Array<[number, number, number]> = [
        [130, 205, 0], [355, 140, 1], [560, 265, 4], [765, 130, 5],
        [1055, 100, 8], [1230, 300, 9], [90, 545, 12], [1180, 600, 13],
      ];
      for (const [x, y, i] of spots) {
        m.save();
        m.translate(x, y);
        m.rotate(-0.5 + i * 0.13);
        m.fillText(RUNES[i % RUNES.length], 0, 0);
        m.restore();
      }
      m.restore();

      // ---- Altın tonlu şerit bantları: basamak + baklava motifi ----
      const gold = (a: number) => "rgba(212,175,55," + a + ")";
      const band = (yBase: number, dir: 1 | -1) => {
        m.strokeStyle = gold(0.14);
        m.lineWidth = 2;
        m.beginPath();
        m.moveTo(44, yBase);
        m.lineTo(CANVAS_W - 44, yBase);
        m.stroke();
        m.fillStyle = gold(0.2);
        for (let x = 44; x <= CANVAS_W - 44; x += 20) {
          m.beginPath();
          m.moveTo(x, yBase - 13 * dir);
          m.lineTo(x + 5, yBase - 8 * dir);
          m.lineTo(x, yBase - 3 * dir);
          m.lineTo(x - 5, yBase - 8 * dir);
          m.closePath();
          m.fill();
        }
        m.fillStyle = gold(0.1);
        const sy = yBase + 8 * dir;
        for (let x = 40; x <= CANVAS_W - 44; x += 40) {
          m.beginPath();
          m.moveTo(x + 8, sy - 8 * dir);
          m.lineTo(x + 16, sy - 8 * dir);
          m.lineTo(x + 16, sy);
          m.lineTo(x + 26, sy);
          m.lineTo(x + 26, sy + 8 * dir);
          m.fill();
        }
      };
      band(102, 1); // başlık altı
      band(CANVAS_H - 92, -1); // hazne üstü

      this.motifsCache = off;
    }
    c.drawImage(this.motifsCache, 0, 0);
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
    this.drawMotifs(c);

    // Başlık + seviye (üstte ortalanmış).
    c.fillStyle = "#d4e8f2";
    c.textAlign = "center";
    c.font = "bold 42px Georgia";
    c.fillText("Ötüken Mahjong", CANVAS_W / 2, 60);
    c.font = "bold 22px Georgia";
    c.fillStyle = "#9fd0e0";
    c.fillText(`Seviye ${this.levelIndex + 1} · ${def.name}`, CANVAS_W / 2, 92);

    // Yerleşimin çerçevesi (taş alanına göre).
    const boxW = this.layoutCols * (TILE_W + GAP) + GAP;
    const boxH = this.layoutRows * (TILE_H + GAP) + GAP;
    const bx = this.boardOriginX() - boxW / 2;
    const by = (CANVAS_H - boxH) / 2 + 30;
    c.strokeStyle = "rgba(255,255,255,0.08)";
    c.lineWidth = 2;
    c.strokeRect(bx - 12, by - 12, boxW + 24, boxH + 24);

    // Köşe tamga süsleri (tahta çerçevesi etrafında dört nokta).
    const ts = 13;
    c.strokeStyle = "rgba(212,175,55,0.55)";
    c.lineWidth = 1.8;
    const corners: Array<[number, number]> = [
      [bx - 22 - ts, by - 22 - ts],
      [bx + boxW + 24 + ts, by - 22 - ts],
      [bx - 22 - ts, by + boxH + 26 + ts],
      [bx + boxW + 24 + ts, by + boxH + 26 + ts],
    ];
    for (const [cx2, cy2] of corners) {
      c.strokeRect(cx2 - ts, cy2 - ts, ts * 2, ts * 2);
      c.beginPath();
      c.moveTo(cx2, cy2 - ts);
      c.lineTo(cx2 + ts, cy2);
      c.lineTo(cx2, cy2 + ts);
      c.lineTo(cx2 - ts, cy2);
      c.closePath();
      c.stroke();
    }

    // Taşları çiz (en üst katman önce değil, alt→üst sıralama render etkisi).
    const sorted = [...this.tiles].sort((a, b) => a.layer - b.layer);
    for (const t of sorted) {
      if (t.removed) continue;
      const open = this.isOpen(t);
      const sel = t.id === this.selectedId;
      this.drawTile(c, t, open, sel, open && this.sideFree(t));
    }

    // ---- Eslesme patlamasi (parlak parcaciklar) ----
    for (const b of this.bursts) {
      const a = Math.max(0, b.life / b.max);
      c.globalAlpha = a * 0.9;
      c.fillStyle = b.color;
      c.beginPath();
      c.arc(b.x, b.y, Math.max(1, b.r * a), 0, Math.PI * 2);
      c.fill();
    }
    // ---- Suzulen yazi (+2) ----
    for (const f of this.floats) {
      const a = Math.max(0, f.life / f.max);
      c.globalAlpha = a;
      c.fillStyle = f.color;
      c.font = "bold 26px Georgia";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(f.text, f.x, f.y);
      c.restore();
      c.fillStyle = f.color;
    }
    // ---- Tas pop animasyonu (kaybolan halka + run) ----
    for (const pp of this.pops) {
      const k = pp.life / pp.max;
      const a = Math.max(0, Math.min(1, k * 2.5));
      c.save();
      c.globalAlpha = a;
      c.strokeStyle = RUNE_COLORS[pp.symbol];
      c.lineWidth = 3;
      const rr = (1 - k) * 46 + 8;
      c.beginPath();
      c.arc(pp.x, pp.y, rr, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = a * 0.55;
      c.fillStyle = RUNE_COLORS[pp.symbol];
      c.font = "bold 40px 'Segoe UI Historic','Noto Sans Old Turkic',serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(RUNES[pp.symbol], pp.x, pp.y);
      c.restore();
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
        c.fillStyle = RUNE_COLORS[this.tray[i].symbol];
        c.font = "bold 30px 'Segoe UI Historic','Noto Sans Old Turkic',serif";
        c.textBaseline = "alphabetic";
        c.fillText(RUNES[this.tray[i].symbol], sx + slotW / 2, trayY + 8);
      }
    }
    c.textBaseline = "alphabetic";


    // Üst şerit: istatistik (portrede üstte ortalanmış).
    const remaining = this.tiles.filter((t) => !t.removed).length;
    const total = this.tiles.length;
    c.fillStyle = "#d4e8f2";
    c.font = "bold 19px Georgia";
    c.textAlign = "center";
    c.fillText(`Kalan: ${remaining}/${total}   Hamle: ${this.moves}   Süre: ${Math.floor(this.seconds)} sn`, CANVAS_W / 2, 128);

    // Alttaki kısayollar (haznenin üstü).
    c.fillStyle = "#7f96b8";
    c.font = "15px Georgia";
    c.fillText("[Yeni Oyun] N   [Geri Al] U   [Sonraki] L", CANVAS_W / 2, CANVAS_H - 60);
    // ---- Kayip ekrani ----
    if (this.lost) {
      c.fillStyle = "rgba(30,5,5,0.55)";
      c.fillRect(0, 0, CANVAS_W, CANVAS_H);
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = "bold 64px Georgia";
      c.fillStyle = "#ff7a6e";
      c.fillText("Kaybettin!", CANVAS_W / 2, CANVAS_H / 2 - 120);
      c.font = "bold 26px Georgia";
      c.fillStyle = "#f2c9c4";
      c.fillText("Hazne doldu, eslesme kalmadi.", CANVAS_W / 2, CANVAS_H / 2 - 65);
      const bcx = CANVAS_W / 2, bcy = CANVAS_H - 380;
      c.fillStyle = "#7d2a2a";
      c.beginPath();
      c.roundRect(bcx - 105, bcy - 29, 210, 58, 16);
      c.fill();
      c.strokeStyle = "#ffb27a";
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(bcx - 105, bcy - 29, 210, 58, 16);
      c.stroke();
      c.fillStyle = "#ffe6d5";
      c.font = "bold 24px Georgia";
      c.fillText("Yeniden Oyna", bcx, bcy);
    }

    // ---- Kazanma ekrani ----
    if (this.won) {
      c.fillStyle = "rgba(0,10,20,0.35)";
      c.fillRect(0, 0, CANVAS_W, CANVAS_H);
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = "bold 64px Georgia";
      c.fillStyle = "#ffe08a";
      c.fillText("Zafer!", CANVAS_W / 2, CANVAS_H / 2 - 120);
      c.font = "bold 26px Georgia";
      c.fillStyle = "#cfe6f2";
      c.fillText("Tum taslar eslestirildi. Seviye tamamlandi!", CANVAS_W / 2, CANVAS_H / 2 - 60);
      c.fillStyle = "#9fd0e0";
      c.font = "bold 20px Georgia";
      c.fillText("[Sonraki Seviye] L    [Yeniden Oyna] N", CANVAS_W / 2, CANVAS_H / 2);
    }
  }

  private specialArt(): "none" | "seasonal" | "animals" {
    if (this.levelIndex === 100) return "seasonal";
    if (this.levelIndex === 200) return "animals";
    return "none";
  }

  /** 201. seviye (Hayvanlar) taş yüzü çizimi. t.symbol % 8:
   *  0 at · 1 koyun · 2 kartal · 3 kurt · 4 geyik · 5 boğa ·
   *  6 tilki · 7 yılan. */
  private drawAnimalIcon(
    c: CanvasRenderingContext2D,
    t: Tile,
    open: boolean,
  ): void {
    const cx = t.sx;
    const cy = t.sy + 6;
    c.save();
    c.globalAlpha *= open ? 1 : 0.32;
    c.lineCap = "round";
    c.lineJoin = "round";
    switch (t.symbol % 8) {
      case 0: {
        // At (kafa profili)
        c.strokeStyle = "#5a3a1c";
        c.fillStyle = "#a06a3a";
        c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(cx - 8, cy + 16);
        c.quadraticCurveTo(cx - 16, cy + 2, cx - 9, cy - 4);
        c.lineTo(cx - 4, cy - 14);
        c.lineTo(cx + 2, cy - 12);
        c.lineTo(cx + 5, cy - 6);
        c.quadraticCurveTo(cx + 12, cy + 0, cx + 10, cy + 8);
        c.quadraticCurveTo(cx + 4, cy + 12, cx - 8, cy + 16);
        c.closePath();
        c.fill();
        c.stroke();
        c.strokeStyle = "#6b4423";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(cx - 8, cy - 2);
        c.quadraticCurveTo(cx - 2, cy + 2, cx + 2, cy + 8);
        c.stroke();
        break;
      }
      case 1: {
        // Koyun (yün + kafa)
        c.fillStyle = "#f7f2e6";
        c.beginPath();
        c.arc(cx, cy + 2, 12, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.arc(cx - 8, cy + 2, 6, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.arc(cx + 8, cy + 2, 6, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#d9b48a";
        c.beginPath();
        c.ellipse(cx, cy - 10, 5, 6, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#3a2a1a";
        c.beginPath();
        c.arc(cx + 2, cy - 11, 1.2, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.arc(cx - 9, cy - 11, 2, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.arc(cx + 8, cy - 11, 2, 0, Math.PI * 2);
        c.fill();
        break;
      }
      case 2: {
        // Kartal (kanatlı kuş ikonu)
        c.fillStyle = "#7a4a1a";
        c.beginPath();
        c.ellipse(cx, cy + 2, 5, 9, 0, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.moveTo(cx - 3, cy - 2);
        c.lineTo(cx - 18, cy - 8);
        c.lineTo(cx - 8, cy + 4);
        c.closePath();
        c.fill();
        c.beginPath();
        c.moveTo(cx + 3, cy - 2);
        c.lineTo(cx + 18, cy - 8);
        c.lineTo(cx + 8, cy + 4);
        c.closePath();
        c.fill();
        c.fillStyle = "#5a3412";
        c.beginPath();
        c.arc(cx, cy - 10, 3, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#ffcf33";
        c.beginPath();
        c.moveTo(cx, cy - 8);
        c.lineTo(cx + 4, cy - 12);
        c.lineTo(cx, cy - 13);
        c.closePath();
        c.fill();
        break;
      }
      case 3: {
        // Kurt (kafa)
        c.fillStyle = "#8a959f";
        c.beginPath();
        c.moveTo(cx - 10, cy + 2);
        c.lineTo(cx, cy - 14);
        c.lineTo(cx + 10, cy + 2);
        c.closePath();
        c.fill();
        c.beginPath();
        c.moveTo(cx - 6, cy - 6);
        c.lineTo(cx - 10, cy - 18);
        c.lineTo(cx - 1, cy - 10);
        c.closePath();
        c.fill();
        c.beginPath();
        c.moveTo(cx + 6, cy - 6);
        c.lineTo(cx + 10, cy - 18);
        c.lineTo(cx + 1, cy - 10);
        c.closePath();
        c.fill();
        c.fillStyle = "#5f6975";
        c.beginPath();
        c.ellipse(cx, cy + 5, 7, 4, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#fff";
        c.beginPath();
        c.arc(cx - 4, cy - 3, 1.6, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.arc(cx + 4, cy - 3, 1.6, 0, Math.PI * 2);
        c.fill();
        break;
      }
      case 4: {
        // Geyik (kafa + boynuz)
        c.fillStyle = "#c2844a";
        c.beginPath();
        c.ellipse(cx, cy + 3, 7, 9, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "#8a5a28";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(cx - 4, cy - 5);
        c.lineTo(cx - 6, cy - 12);
        c.lineTo(cx - 10, cy - 14);
        c.moveTo(cx - 6, cy - 12);
        c.lineTo(cx - 3, cy - 17);
        c.stroke();
        c.beginPath();
        c.moveTo(cx + 4, cy - 5);
        c.lineTo(cx + 6, cy - 12);
        c.lineTo(cx + 10, cy - 14);
        c.moveTo(cx + 6, cy - 12);
        c.lineTo(cx + 3, cy - 17);
        c.stroke();
        c.fillStyle = "#a06a3a";
        c.beginPath();
        c.ellipse(cx - 8, cy - 2, 2.5, 5, -0.3, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.ellipse(cx + 8, cy - 2, 2.5, 5, 0.3, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#2a1a0e";
        c.beginPath();
        c.arc(cx - 2, cy + 1, 1.2, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.arc(cx + 2, cy + 1, 1.2, 0, Math.PI * 2);
        c.fill();
        break;
      }
      case 5: {
        // Boğa (kafa + boynuzlar)
        c.fillStyle = "#8a4422";
        c.beginPath();
        c.ellipse(cx, cy + 2, 11, 8, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#6b3418";
        c.beginPath();
        c.ellipse(cx - 12, cy + 1, 2, 4, -0.4, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.ellipse(cx + 12, cy + 1, 2, 4, 0.4, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "#e0d8c0";
        c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(cx - 8, cy - 3);
        c.quadraticCurveTo(cx - 14, cy - 12, cx - 6, cy - 14);
        c.stroke();
        c.beginPath();
        c.moveTo(cx + 8, cy - 3);
        c.quadraticCurveTo(cx + 14, cy - 12, cx + 6, cy - 14);
        c.stroke();
        c.fillStyle = "#2a1a0e";
        c.beginPath();
        c.arc(cx - 4, cy + 1, 1.2, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.arc(cx + 4, cy + 1, 1.2, 0, Math.PI * 2);
        c.fill();
        break;
      }
      case 6: {
        // Tilki (kafa)
        c.fillStyle = "#e8912f";
        c.beginPath();
        c.moveTo(cx, cy - 4);
        c.lineTo(cx + 8, cy + 8);
        c.lineTo(cx - 8, cy + 8);
        c.closePath();
        c.fill();
        c.fillStyle = "#fff";
        c.beginPath();
        c.moveTo(cx, cy - 4);
        c.lineTo(cx + 3, cy + 8);
        c.lineTo(cx - 3, cy + 8);
        c.closePath();
        c.fill();
        c.fillStyle = "#c26f1c";
        c.beginPath();
        c.moveTo(cx - 6, cy + 2);
        c.lineTo(cx - 9, cy - 8);
        c.lineTo(cx - 2, cy - 2);
        c.closePath();
        c.fill();
        c.beginPath();
        c.moveTo(cx + 6, cy + 2);
        c.lineTo(cx + 9, cy - 8);
        c.lineTo(cx + 2, cy - 2);
        c.closePath();
        c.fill();
        c.fillStyle = "#3a2410";
        c.beginPath();
        c.arc(cx - 4, cy + 2, 1.4, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.arc(cx + 4, cy + 2, 1.4, 0, Math.PI * 2);
        c.fill();
        break;
      }
      default: {
        // Yılan (7) S kıvrım
        c.strokeStyle = "#4a9e6a";
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(cx - 14, cy + 12);
        c.quadraticCurveTo(cx + 14, cy + 10, cx - 2, cy + 2);
        c.quadraticCurveTo(cx - 16, cy - 6, cx + 2, cy - 8);
        c.quadraticCurveTo(cx + 12, cy - 10, cx + 8, cy - 13);
        c.stroke();
        c.fillStyle = "#4a9e6a";
        c.beginPath();
        c.arc(cx + 8, cy - 13, 4, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "#e23030";
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(cx + 12, cy - 13);
        c.lineTo(cx + 17, cy - 16);
        c.moveTo(cx + 12, cy - 13);
        c.lineTo(cx + 16, cy - 11);
        c.stroke();
        c.fillStyle = "#fff";
        c.beginPath();
        c.arc(cx + 9, cy - 14, 1.2, 0, Math.PI * 2);
        c.fill();
        break;
      }
    }
    c.restore();
  }

  /** 101. seviye (Mevsimler & Ağaçlar) taş yüzü çizimi. t.symbol % 8:
   *  0 kar · 1 çiçek · 2 güneş · 3 yaprak · 4 çam · 5 yapraklı ağaç ·
   *  6 meyve ağacı · 7 kiraz çiçeği ağacı. */
  private drawSeasonIcon(
    c: CanvasRenderingContext2D,
    t: Tile,
    open: boolean,
  ): void {
    const cx = t.sx;
    const cy = t.sy + 6;
    c.save();
    c.globalAlpha *= open ? 1 : 0.32;
    c.strokeStyle = "#3a2a1a";
    c.lineWidth = 3;
    c.lineCap = "round";
    c.lineJoin = "round";
    switch (t.symbol % 8) {
      case 0: {
        // Kar (kış)
        c.fillStyle = "#eef6ff";
        c.beginPath();
        c.moveTo(cx - 20, cy + 16);
        c.quadraticCurveTo(cx - 14, cy + 2, cx, cy + 8);
        c.quadraticCurveTo(cx + 14, cy + 16, cx + 20, cy + 16);
        c.closePath();
        c.fill();
        c.strokeStyle = "#bfe0ff";
        c.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
          c.beginPath();
          c.moveTo(cx + i * 14, cy - 2);
          c.lineTo(cx + i * 14, cy - 16);
          c.lineTo(cx + i * 14 + 5, cy - 11);
          c.moveTo(cx + i * 14, cy - 9);
          c.lineTo(cx + i * 14 - 5, cy - 4);
          c.stroke();
        }
        break;
      }
      case 1: {
        // Çiçek (ilkbahar)
        c.beginPath();
        c.moveTo(cx, cy + 16);
        c.lineTo(cx, cy - 4);
        c.stroke();
        const petals = ["#e66aa0", "#ffad4d", "#c86ae6", "#7a9cff"];
        for (let i = 0; i < 4; i++) {
          c.fillStyle = petals[i];
          c.beginPath();
          c.arc(cx + (i - 1.5) * 11, cy - 10, 6, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = "#fff3c4";
        c.beginPath();
        c.arc(cx, cy - 10, 3, 0, Math.PI * 2);
        c.fill();
        break;
      }
      case 2: {
        // Güneş (yaz)
        c.fillStyle = "#ffcf33";
        c.beginPath();
        c.arc(cx, cy, 12, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "#ffb020";
        c.lineWidth = 4;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          c.beginPath();
          c.moveTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16);
          c.lineTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24);
          c.stroke();
        }
        break;
      }
      case 3: {
        // Yaprak (sonbahar)
        const cols = ["#e8a33d", "#d06b2f", "#b8332f"];
        for (let i = 0; i < 3; i++) {
          c.fillStyle = cols[i];
          c.beginPath();
          c.ellipse(cx - 14 + i * 14, cy + 2 - i * 2, 7, 4.5, -0.5 + i * 0.3, 0, Math.PI * 2);
          c.fill();
        }
        break;
      }
      case 4: {
        // Çam ağacı
        for (let i = 0; i < 3; i++) {
          const yy = cy + 16 - i * 9;
          const w = 22 - i * 6;
          c.fillStyle = i % 2 ? "#1f7a3c" : "#2fa05a";
          c.beginPath();
          c.moveTo(cx, yy - 12);
          c.lineTo(cx + w, yy + 4);
          c.lineTo(cx - w, yy + 4);
          c.closePath();
          c.fill();
        }
        c.fillStyle = "#6b4a2a";
        c.fillRect(cx - 3, cy + 16, 6, 8);
        break;
      }
      case 5: {
        // Yapraklı ağaç
        c.beginPath();
        c.moveTo(cx, cy + 22);
        c.lineTo(cx, cy + 4);
        c.stroke();
        c.fillStyle = "#2f9e5f";
        c.beginPath();
        c.arc(cx, cy - 2, 13, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#3cc873";
        c.beginPath();
        c.arc(cx - 6, cy - 6, 6, 0, Math.PI * 2);
        c.fill();
        break;
      }
      case 6: {
        // Meyve ağacı
        c.beginPath();
        c.moveTo(cx, cy + 22);
        c.lineTo(cx, cy + 6);
        c.stroke();
        c.fillStyle = "#2f9e5f";
        c.beginPath();
        c.arc(cx, cy, 12, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#e23030";
        for (const [fx, fy] of [[-6, -4], [4, -7], [0, 5], [7, 3]] as Array<[number, number]>) {
          c.beginPath();
          c.arc(cx + fx, cy + fy, 3, 0, Math.PI * 2);
          c.fill();
        }
        break;
      }
      default: {
        // Kiraz çiçeği ağacı (7)
        c.beginPath();
        c.moveTo(cx, cy + 22);
        c.lineTo(cx, cy + 6);
        c.stroke();
        c.fillStyle = "#f0a0c0";
        c.beginPath();
        c.arc(cx, cy - 1, 13, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#ffd0e6";
        c.beginPath();
        c.arc(cx - 6, cy - 6, 7, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#fff";
        for (const [fx, fy] of [[-4, -4], [4, -6], [1, 3]] as Array<[number, number]>) {
          c.beginPath();
          c.arc(cx + fx, cy + fy, 2, 0, Math.PI * 2);
          c.fill();
        }
        break;
      }
    }
    c.restore();
  }

  private drawTile(
    c: CanvasRenderingContext2D,
    t: Tile,
    open: boolean,
    selected: boolean,
    canTake: boolean,
  ): void {
    const w = TILE_W;
    const h = TILE_H;
    const x = t.sx - w / 2;
    const yTop = t.sy - h / 2;
    const R = 9;

    // ---- Renk paleti (acik = fildisi, kapali = koyu duman) ----
    const face = open ? "#f2e3c0" : "#1f4a37";
    const faceTop = open ? "#fdf3da" : shade(face, 16);
    const faceBot = open ? "#e2cb99" : shade(face, -9);
    const innerTop = open ? "#f8ecd0" : shade(face, 8);
    const innerBot = open ? "#d9c08d" : shade(face, -13);
    const rim = open ? "#c3a86c" : "#2f5f48";

    // ---- Dis golge (sag-alt) ----
    c.fillStyle = "rgba(10,15,20,0.30)";
    c.beginPath();
    c.roundRect(x + 3, yTop + 5, w, h, R + 1);
    c.fill();

    // ---- Govde: dikey degrade + bevel ----
    const bg = c.createLinearGradient(0, yTop, 0, yTop + h);
    bg.addColorStop(0, faceTop);
    bg.addColorStop(1, faceBot);
    c.fillStyle = bg;
    c.beginPath();
    c.roundRect(x, yTop, w, h, R);
    c.fill();

    // ---- Ic madalyon (acik) / dokuma yuzey (kapali) ----
    if (open) {
      const ig = c.createLinearGradient(0, yTop + 9, 0, yTop + h - 9);
      ig.addColorStop(0, innerTop);
      ig.addColorStop(1, innerBot);
      c.fillStyle = ig;
      c.beginPath();
      c.roundRect(x + 7, yTop + 9, w - 14, h - 18, R - 2);
      c.fill();
      // Ic gogei (ustte hafif kucuk)
      const sh = c.createLinearGradient(0, yTop + 9, 0, yTop + 34);
      sh.addColorStop(0, "rgba(0,0,0,0.06)");
      sh.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = sh;
      c.beginPath();
      c.roundRect(x + 7, yTop + 9, w - 14, 25, R - 2);
      c.fill();
      // Ust kenar parlaklik cizgisi (madalyon)
      c.strokeStyle = "rgba(255,255,255,0.55)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x + 10, yTop + 11);
      c.lineTo(x + w - 10, yTop + 11);
      c.stroke();
    } else {
      c.save();
      c.globalAlpha = 0.16;
      c.strokeStyle = "#ffffff";
      c.lineWidth = 1.2;
      for (let i = -1; i < 5; i++) {
        const off = x + i * 12;
        c.beginPath();
        c.moveTo(off, yTop);
        c.lineTo(off + 11, yTop + h);
        c.stroke();
      }
      c.restore();
    }

    // ---- Sag-alt bevel cizgisi (derinlik) ----
    c.strokeStyle = "rgba(0,0,0,0.22)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x + R, yTop + h - 1);
    c.lineTo(x + w - 3, yTop + h - 1);
    c.lineTo(x + w - 1, yTop + R);
    c.stroke();
    // Sol-ust parlak cizgi
    c.strokeStyle = "rgba(255,255,255,0.30)";
    c.beginPath();
    c.moveTo(x + R, yTop + 1);
    c.lineTo(x + w - 3, yTop + 1);
    c.lineTo(x + w - 1, yTop + R);
    c.stroke();

    // ---- Dis cerceve ----
    c.strokeStyle = selected ? "#ffb020" : rim;
    c.lineWidth = selected ? 3.5 : 2;
    c.beginPath();
    c.roundRect(x, yTop, w, h, R);
    c.stroke();

    // ---- Taş yüzü: rün (normal) / mevsim+ağaç (101. seviye) ----
    const art = this.specialArt();
    if (art === "animals" && t.symbol < 8) {
      this.drawAnimalIcon(c, t, open);
    } else if (art === "seasonal" && t.symbol < 8) {
      this.drawSeasonIcon(c, t, open);
    } else {
      c.font =
        (open ? "bold 36px " : "bold 26px ") +
        "'Segoe UI Historic','Noto Sans Old Turkic',serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      if (open && canTake) {
        c.fillStyle = "rgba(0,0,0,0.5)";
        c.fillText(RUNES[t.symbol], t.sx + 2, t.sy + 3);
        const glow = c.createRadialGradient(t.sx, t.sy, 2, t.sx, t.sy, 30);
        glow.addColorStop(0, RUNE_COLORS[t.symbol]);
        glow.addColorStop(1, "transparent");
        c.globalAlpha = 0.25;
        c.fillStyle = glow;
        c.beginPath();
        c.arc(t.sx, t.sy, 30, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 1;
        c.fillStyle = RUNE_COLORS[t.symbol];
        c.fillText(RUNES[t.symbol], t.sx, t.sy);
      } else {
        c.globalAlpha = 0.4;
        c.fillStyle = RUNE_COLORS[t.symbol];
        c.fillText(RUNES[t.symbol], t.sx, t.sy);
        c.globalAlpha = 1;
      }
    }

    // ---- Secili vurgusu ----
    if (selected) {
      c.strokeStyle = "rgba(255,176,32,0.4)";
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(x - 6, yTop - 6, w + 12, h + 12, 13);
      c.stroke();
    }
  }

}
