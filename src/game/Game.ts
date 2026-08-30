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
const RUNE_COLORS = [
  "#e05a3a",
  "#d4af37",
  "#3a7be0",
  "#37b06a",
  "#a85c8c",
  "#e07a3a",
  "#5c8ca8",
  "#7a5cc8",
  "#c85c3a",
  "#2fb98f",
  "#d47a2a",
  "#4a9ee0",
  "#e0478c",
  "#8fbf3a",
  "#3abfd4",
  "#b08fe0",
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
      // Eşleşti -> kaldır.
      selected.removed = true;
      target.removed = true;
      this.history.push({ a: selected.id, b: target.id });
      this.moves++;
      this.selectedId = null;
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
    const h = TILE_H - 3; // üst yüzey yüksekliği
    const depth = 20; // gerçekçi kalın gövde (3B derinlik)
    const x = t.sx - w / 2;
    const yTop = t.sy - TILE_H / 2; // üst yüzey üst kenarı
    const cx = t.sx;

    // ---- Yumuşak zemin gölgesi (katmanlı + ambient occlusion) ----
    for (let k = 0; k < 4; k++) {
      c.beginPath();
      c.ellipse(
        cx + 3, yTop + h + depth * 0.7 + 3 + k * 3,
        w / 2 + 6 + k * 3, 11 + k * 5,
        0, 0, Math.PI * 2,
      );
      c.fillStyle = `rgba(0,0,0,${0.42 - k * 0.08})`;
      c.fill();
    }
    // Zeminle temas yeri en koyu (ambient occlusion).
    c.beginPath();
    c.ellipse(cx + 3, yTop + h + 2, w / 2 - 2, 6, 0, 0, Math.PI * 2);
    c.fillStyle = "rgba(0,0,0,0.5)";
    c.fill();

    // ---- Renk paleti: her rün ailesine özel canlı renk ----
    const base = RUNE_COLORS[t.symbol];
    const pal = open
      ? {
          top1: shade(base, 58),
          top2: shade(base, 30),
          sideA: shade(base, -8),
          sideB: shade(base, -26),
          sideC: shade(base, -44),
          rim: shade(base, -24),
          sel: "#ffb020",
        }
      : {
          top1: shade(base, -50),
          top2: shade(base, -62),
          sideA: shade(base, -56),
          sideB: shade(base, -64),
          sideC: shade(base, -72),
          rim: shade(base, -72),
          sel: "#ffb020",
        };

    // ---- Sağ yan yüzey (gradyan: üstten ışık, alta koyulaşır) ----
    const rgSide = c.createLinearGradient(0, yTop + 3, 0, yTop + h + depth * 0.7);
    rgSide.addColorStop(0, pal.sideA);
    rgSide.addColorStop(0.5, pal.sideB);
    rgSide.addColorStop(1, pal.sideC);
    c.fillStyle = rgSide;
    c.beginPath();
    c.moveTo(x + w, yTop + 3);
    c.lineTo(x + w + depth, yTop + 3 + depth * 0.7);
    c.lineTo(x + w + depth, yTop + h + depth * 0.7);
    c.lineTo(x + w, yTop + h);
    c.closePath();
    c.fill();
    // Sağ yanın ışıklı üst kenarı (edge highlight).
    c.fillStyle = pal.sideA;
    c.beginPath();
    c.moveTo(x + w, yTop + 3);
    c.lineTo(x + w + depth, yTop + 3 + depth * 0.7);
    c.lineTo(x + w + depth, yTop + 3 + depth * 0.7 + 10);
    c.lineTo(x + w, yTop + 3 + 10);
    c.closePath();
    c.fill();

    // ---- Ön yan yüzey (gradyan) ----
    const fg = c.createLinearGradient(0, yTop + 3, 0, yTop + h + depth * 0.7);
    fg.addColorStop(0, pal.sideB);
    fg.addColorStop(1, pal.sideC);
    c.fillStyle = fg;
    c.beginPath();
    c.moveTo(x + 3, yTop + h);
    c.lineTo(x + 3 + depth, yTop + h + depth * 0.7);
    c.lineTo(x + w - 3 + depth, yTop + h + depth * 0.7);
    c.lineTo(x + w - 3, yTop + h);
    c.closePath();
    c.fill();
    // Ön yan köşe ışığı (sol alt).
    c.fillStyle = pal.sideB;
    c.beginPath();
    c.moveTo(x + 3, yTop + h);
    c.lineTo(x + 3 + 8, yTop + h);
    c.lineTo(x + 3 + depth - 6, yTop + h + depth * 0.7 - 4);
    c.lineTo(x + 3, yTop + h + depth * 0.7);
    c.closePath();
    c.fill();

    // ---- Üst yüzey: çok yönlü radyal ışık (bombeli) ----
    const rg = c.createRadialGradient(
      cx - w * 0.08, yTop + h * 0.18, h * 0.12,
      cx, yTop + h * 0.62, w * 0.8,
    );
    rg.addColorStop(0, shade(pal.top1, 12));
    rg.addColorStop(0.6, pal.top1);
    rg.addColorStop(1, pal.top2);
    c.fillStyle = rg;
    c.beginPath();
    c.roundRect(x, yTop, w, h, 7);
    c.fill();

    // Üst yüzeyin kenar profili: sol-üst aydınlık, sağ-alt kararır.
    c.save();
    c.clip();
    // koyu çevre (iç gölge).
    c.strokeStyle = "rgba(0,0,0,0.35)";
    c.lineWidth = 5;
    c.strokeRect(x - 2, yTop - 2, w + 4, h + 4);
    // sol-üst kenar ışığı.
    c.strokeStyle = "rgba(255,255,255,0.5)";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x + 2, yTop + h - 3);
    c.lineTo(x + 2, yTop + 5);
    c.lineTo(x + w - 5, yTop + 5);
    c.stroke();
    c.restore();
    // taşın ana çerçevesi.
    c.strokeStyle = "rgba(0,0,0,0.25)";
    c.lineWidth = 1.5;
    c.beginPath();
    c.roundRect(x, yTop, w, h, 7);
    c.stroke();

    // ---- Kapalı taş deseni: keyifli dokuma çizgileri ----
    if (!open) {
      c.save();
      c.globalAlpha = 0.18;
      c.strokeStyle = "#ffffff";
      c.lineWidth = 1;
      for (let i = -1; i < 4; i++) {
        const off = x + i * 12;
        c.beginPath();
        c.moveTo(off, yTop);
        c.lineTo(off + 10, yTop + h);
        c.stroke();
      }
      c.restore();
    } else {
      // ---- İç madalyon (renkli koyu panel): rünü öne çıkarır ----
      c.fillStyle = shade(base, -26);
      c.beginPath();
      c.roundRect(x + 8, yTop + 12, w - 16, h - 24, 12);
      c.fill();
      // Madalyon çerçevesi.
      c.strokeStyle = shade(base, -50);
      c.lineWidth = 1.5;
      c.beginPath();
      c.roundRect(x + 8, yTop + 12, w - 16, h - 24, 12);
      c.stroke();
      // Madalyon üst ışığı.
      c.strokeStyle = "rgba(255,255,255,0.18)";
      c.lineWidth = 1;
      c.beginPath();
      c.roundRect(x + 8, yTop + 12, w - 16, h - 24, 12);
      c.stroke();
    }

    // Üst yüzey parlak vurgu: yatay vernik şeridi.
    c.strokeStyle = "rgba(255,255,255,0.55)";
    c.lineWidth = 1.4;
    c.beginPath();
    c.roundRect(x + 5, yTop + 4, w - 10, 3.5, 2);
    c.stroke();
    // Speküler parlama noktası (sol-üst ışık yansıması).
    if (open) {
      const sg = c.createRadialGradient(
        x + w * 0.28, yTop + 9, 1,
        x + w * 0.28, yTop + 9, w * 0.22,
      );
      sg.addColorStop(0, "rgba(255,255,255,0.55)");
      sg.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = sg;
      c.beginPath();
      c.ellipse(x + w * 0.28, yTop + 9, w * 0.22, 7, 0, 0, Math.PI * 2);
      c.fill();
    }

    // ---- Kenar çizgisi ----
    c.strokeStyle = selected ? pal.sel : pal.rim;
    c.lineWidth = selected ? 4 : 2;
    c.beginPath();
    c.roundRect(x, yTop, w, h, 7);
    c.stroke();

    // ---- Rün ----
    if (open) {
      c.font = "bold 34px 'Segoe UI Historic','Noto Sans Old Turkic',serif";
      c.textAlign = "center";
      c.textBaseline = "alphabetic";
      // hafif gölge (madalyon üstünde)
      c.fillStyle = shade(base, -55);
      c.fillText(RUNES[t.symbol], t.sx + 1.5, t.sy + 2);
      // parlak beyaz rün
      c.fillStyle = "#ffffff";
      c.fillText(RUNES[t.symbol], t.sx, t.sy);
    } else {
      // Kapalı taşta rün gizli; çok silik bir ipucu kalır.
      c.font = "bold 24px serif";
      c.textAlign = "center";
      c.textBaseline = "alphabetic";
      c.fillStyle = "rgba(255,255,255,0.18)";
      c.fillText(RUNES[t.symbol], t.sx, t.sy);
    }

    // ---- Seçili vurgusu / açık parlama ----
    if (selected) {
      c.strokeStyle = "rgba(255,176,32,0.5)";
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(x - 5, yTop - 5, w + 10, h + 10, 11);
      c.stroke();
    } else if (open) {
      c.strokeStyle = "rgba(255,255,255,0.3)";
      c.lineWidth = 1;
      c.beginPath();
      c.roundRect(x - 4, yTop - 4, w + 8, h + 8, 11);
      c.stroke();
    }
  }
}
