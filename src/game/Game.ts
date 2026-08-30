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
}

// Göktürk rünleri (Orhun alfabesi). Her biri bir "aile" = 4 taş.
const RUNES = ["𐰀", "𐰆", "𐰉", "𐰒", "𐰤", "𐰞", "𐰱", "𐰾"];
const RUNE_COLORS = [
  "#e05a3a",
  "#d4af37",
  "#3a7be0",
  "#37b06a",
  "#a85c8c",
  "#e07a3a",
  "#5c8ca8",
  "#7a5cc8",
];

const TILE_W = 58;
const TILE_H = 94;
const GAP = 8;

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
  private buildLayout(): void {
    // 4x4 hücre, her hücrede 2 katman taş -> 32 taş.
    // Her sembol 4 taş (2 üst, 2 alt). Üst katmandaki 16 açık taş 8 çift
    // oluşturur; hepsi eşleştirilince alttakiler açılır -> her zaman çözülebilir.
    const symbols: number[] = [];
    for (let s = 0; s < RUNES.length; s++) {
      for (let k = 0; k < 4; k++) symbols.push(s);
    }
    for (let i = symbols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [symbols[i], symbols[j]] = [symbols[j], symbols[i]];
    }

    let idx = 0;
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        // Katman 0 (alt), Katman 1 (üst).
        const s0 = symbols[idx++];
        const s1 = symbols[idx++];
        this.tiles.push(this.makeTile(s0, col, row, 0));
        this.tiles.push(this.makeTile(s1, col, row, 1));
      }
    }
  }

  private makeTile(symbol: number, col: number, row: number, layer: number): Tile {
    // Üst katman aynı hücrenin üzerine hafifçe kayarak biner (mahjong hissi).
    const ox = layer * 12;
    const oy = layer * -14;
    const cols = 4;
    const boardW = cols * (TILE_W + GAP);
    const sx0 = (CANVAS_W - boardW) / 2;
    const sx = sx0 + col * (TILE_W + GAP) + ox;
    const sy = 120 + row * (TILE_H + GAP) + oy;
    return {
      id: col * 100 + row * 10 + layer,
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
    });
  }

  // ---- Render ----
  private render(): void {
    const c = this.ctx;
    // Arka plan: buz + Göktürk tonu.
    const g = c.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, "#0e2433");
    g.addColorStop(1, "#16384a");
    c.fillStyle = g;
    c.fillRect(0, 0, 1280, 720);

    // Başlık.
    c.fillStyle = "#d4e8f2";
    c.textAlign = "center";
    c.font = "bold 40px Georgia";
    c.fillText("Göktürk Mahjong", 400, 60);

    // Yerleşimin çerçevesi.
    c.strokeStyle = "rgba(255,255,255,0.08)";
    c.lineWidth = 2;
    c.strokeRect(90, 80, 700, 560);

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
    c.fillStyle = "#d4e8f2";
    c.font = "18px Georgia";
    c.textAlign = "left";
    c.fillText(`Kalan: ${remaining}`, 900, 180);
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

    // Domino ayırıcı çizgi (üst yüzey ortasında dikey).
    c.strokeStyle = open ? "rgba(60,90,110,0.5)" : "rgba(30,50,70,0.45)";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(t.sx + 6, yTop + 16);
    c.lineTo(t.sx + 6, yTop + TILE_H - 20);
    c.stroke();

    // Rün (üst yüzeyde, oyma hissi için önce hafif gölge sonra net rün).
    if (open) {
      c.font = "bold 30px 'Segoe UI Historic','Noto Sans Old Turkic',serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = "rgba(0,0,0,0.18)";
      c.fillText(RUNES[t.symbol], t.sx - 8, t.sy - 2);
      c.fillStyle = RUNE_COLORS[t.symbol];
      c.fillText(RUNES[t.symbol], t.sx - 8, t.sy - 3);
      c.textBaseline = "alphabetic";
    } else {
      c.fillStyle = "rgba(14,36,52,0.55)";
      c.font = "bold 26px serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(RUNES[t.symbol], t.sx - 8, t.sy - 3);
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
