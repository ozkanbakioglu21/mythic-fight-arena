// Göktürk Mahjong Solitaire
// Kurallar: aynı Göktürk rününe sahip iki AÇIK taşı seçip eşleştir, kaldır.
// Tüm taşlar kalkınca oyunu kazanırsın.

const CANVAS_W = 1280;
const CANVAS_H = 720;

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
const RUNES = ["𐰀", "𐰆", "𐰉", "𐰒", "𐰤", "𐰞", "𐰱", "𐰾", "𐰋", "𐰑", "𐰚", "𐰃"];
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
];

const TILE_W = 58;
const TILE_H = 94;
const GAP = 8;

// Seviye dizimleri. Her hücre 2 katman taş (üst açık, alt kapalı) alır,
// böylece her seviye her zaman çözülebilir. Hücre sayısı = rün sayısı * 2.
const LEVELS: Array<{ name: string; cells: Array<[number, number]>; bg: [string, string] }> =
  [
    { name: "Başlangıç", cells: rectShape(2, 4), bg: ["#0e2433", "#16384a"] },
    { name: "Çerçeve", cells: frameShape(4, 4), bg: ["#14233d", "#20314f"] },
    { name: "Kare", cells: rectShape(4, 4), bg: ["#0d2e33", "#1a4650"] },
    { name: "Geniş Alan", cells: rectShape(5, 4), bg: ["#271f3f", "#3a2a53"] },
    { name: "Zirve", cells: rectShape(6, 4), bg: ["#3a1f2b", "#542d3d"] },
  ];

function rectShape(cols: number, rows: number): Array<[number, number]> {
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
    return LEVELS[this.levelIndex % LEVELS.length];
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

  private makeTile(symbol: number, col: number, row: number, layer: number): Tile {
    // Üst katman aynı hücrenin üzerine hafifçe kayarak biner (mahjong hissi).
    const ox = layer * 12;
    const oy = layer * -14;
    const boardW = this.layoutCols * (TILE_W + GAP);
    const boardH = this.layoutRows * (TILE_H + GAP);
    const sx0 = (CANVAS_W - boardW) / 2;
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

  /** Bir sonraki seviyeye geçer; son seviyeden sonra başa döner. */
  nextLevel(): void {
    this.levelIndex = (this.levelIndex + 1) % LEVELS.length;
    this.newGame();
  }

  goToLevel(i: number): void {
    this.levelIndex = ((i % LEVELS.length) + LEVELS.length) % LEVELS.length;
    this.newGame();
  }

  getLevelIndex(): number {
    return this.levelIndex;
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
      level: this.levelIndex % LEVELS.length,
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
    c.fillText(`Seviye ${this.levelIndex % LEVELS.length + 1} · ${def.name}`, 90, 84);

    // Yerleşimin çerçevesi (taş alanına göre).
    const boxW = this.layoutCols * (TILE_W + GAP) + GAP;
    const boxH = this.layoutRows * (TILE_H + GAP) + GAP;
    const bx = (CANVAS_W - boxW) / 2;
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
    const depth = 16; // taş kalınlığı (3B derinlik)
    const x = t.sx - w / 2;
    const yTop = t.sy - TILE_H / 2; // üst yüzey üst kenarı

    // Yerdeki gölge.
    c.fillStyle = open ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.3)";
    c.beginPath();
    c.ellipse(t.sx + 3, yTop + TILE_H - 6 + depth, w / 2 + 6, 14, 0, 0, Math.PI * 2);
    c.fill();

    // Renk temel tonları (açık -> kapalı ayırır).
    const top = open ? "#f4fbff" : "#a7c4d6";
    const topShade = open ? "#d6eaf5" : "#89abbf";
    const front = open ? "#8fb0c4" : "#5f7f96";
    const right = open ? "#6f92a8" : "#4c6b82";
    const rim = selected ? "#ffd24a" : open ? "#5c8ca8" : "#48677a";

    // Sağ yan yüzey (derinlik).
    c.fillStyle = right;
    c.beginPath();
    c.moveTo(x + w, yTop + 4);
    c.lineTo(x + w + depth, yTop + 4 + depth * 0.7);
    c.lineTo(x + w + depth, yTop + TILE_H - 4 + depth * 0.7);
    c.lineTo(x + w, yTop + TILE_H - 4);
    c.closePath();
    c.fill();

    // Ön yan yüzey (derinlik).
    c.fillStyle = front;
    c.beginPath();
    c.moveTo(x + 4, yTop + TILE_H - 4);
    c.lineTo(x + 4 + depth, yTop + TILE_H - 4 + depth * 0.7);
    c.lineTo(x + w - 4 + depth, yTop + TILE_H - 4 + depth * 0.7);
    c.lineTo(x + w - 4, yTop + TILE_H - 4);
    c.closePath();
    c.fill();

    // Üst yüzey (gradyan: üstten ışık).
    const g = c.createLinearGradient(x, yTop, x, yTop + TILE_H);
    g.addColorStop(0, top);
    g.addColorStop(1, topShade);
    c.fillStyle = g;
    c.beginPath();
    c.roundRect(x, yTop, w, TILE_H - 4, 8);
    c.fill();
    // Üst yüzey ince ışık çizgisi.
    c.fillStyle = "rgba(255,255,255,0.55)";
    c.beginPath();
    c.roundRect(x + 4, yTop + 3, w - 8, 4, 3);
    c.fill();

    // Kenar çizgisi.
    c.strokeStyle = rim;
    c.lineWidth = selected ? 4 : 2;
    c.beginPath();
    c.roundRect(x, yTop, w, TILE_H - 4, 8);
    c.stroke();

    // Rün (üst yüzeyde, oyma hissi için önce hafif gölge sonra net rün).
    if (open) {
      c.font = "bold 30px 'Segoe UI Historic','Noto Sans Old Turkic',serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = "rgba(0,0,0,0.18)";
      c.fillText(RUNES[t.symbol], t.sx, t.sy);
      c.fillStyle = RUNE_COLORS[t.symbol];
      c.fillText(RUNES[t.symbol], t.sx, t.sy - 1);
      c.textBaseline = "alphabetic";
    } else {
      c.fillStyle = "rgba(14,36,52,0.55)";
      c.font = "bold 26px serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(RUNES[t.symbol], t.sx, t.sy - 1);
      c.textBaseline = "alphabetic";
    }

    // Açık ve seçili değilse üstte parlak parlama.
    if (open && !selected) {
      c.strokeStyle = "rgba(255,255,255,0.45)";
      c.lineWidth = 1;
      c.beginPath();
      c.roundRect(x - 4, yTop - 4, w + 8, TILE_H - 4 + 8, 12);
      c.stroke();
    }
  }
}
