// Ötüken Mahjong Solitaire
// Kurallar: standart 144 taslik mahjong setinden ayni desene sahip iki AÇIK taşı seçip eşleştir, kaldır.
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
  symbol: string; // standart mahjong tas turu (b1-b9, c1-c9, w1-w9, E/S/W/N, DR/DG/DW, f1-f4, s1-s4)
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
  score: number;
  combo: number;
  stars: number;
  fates: string[];
  shuffles: number;
  cleanWin: boolean;
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
// Standart mahjong seti (144 tas):
//   Sayilar (108): bambu b1-b9, daire c1-c9, karakter w1-w9 (her turunden 4 adet)
//   Onur (28):     ruzgarlar E/S/W/N, ejderhalar DR/DG/DW (her birinden 4 adet)
//   Bonus (8):     cicekler f1-f4, mevsimler s1-s4 (cicekler aralarinda,
//                  mevsimler aralarinda eslesir)
const NUM_CH = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const WIND_CH: Record<string, string> = { E: "東", S: "南", W: "西", N: "北" };
const DRAGON_CH: Record<string, string> = { DR: "中", DG: "發", DW: "白" };
const FLOWER_CH = ["梅", "蘭", "菊", "竹"];
const SEASON_CH = ["春", "夏", "秋", "冬"];
const CJK_FONT = "'Segoe UI','Microsoft YaHei','Noto Sans CJK SC','Noto Sans SC',serif";

function tileColor(kind: string): string {
  if (kind[0] === "b") return "#2e8b57";
  if (kind[0] === "c") return "#1b5faa";
  if (kind[0] === "w") return "#c0392b";
  if (kind === "DR") return "#c0392b";
  if (kind === "DG") return "#2e8b57";
  if (kind === "DW") return "#3b6ea5";
  if (kind[0] === "f") return "#c2185b";
  if (kind[0] === "s") return "#b8860b";
  return "#203a63";
}

function faceLabel(kind: string): string {
  if (kind[0] === "b" || kind[0] === "c") return kind.slice(1);
  if (kind[0] === "w") return NUM_CH[Number(kind.slice(1)) - 1];
  if (kind in DRAGON_CH) return DRAGON_CH[kind];
  if (kind[0] === "f") return FLOWER_CH[Number(kind.slice(1)) - 1];
  if (kind[0] === "s") return SEASON_CH[Number(kind.slice(1)) - 1];
  return WIND_CH[kind];
}

function matchKey(kind: string): string {
  if (kind[0] === "f") return "flower";
  if (kind[0] === "s") return "season";
  return kind;
}

function buildPoolPairs(): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const su of ["b", "c", "w"])
    for (let n = 1; n <= 9; n++) {
      const k = su + n;
      pairs.push([k, k]);
      pairs.push([k, k]);
    }
  for (const k of ["E", "S", "W", "N", "DR", "DG", "DW"]) {
    pairs.push([k, k]);
    pairs.push([k, k]);
  }
  pairs.push(["f1", "f2"], ["f3", "f4"]);
  pairs.push(["s1", "s2"], ["s3", "s4"]);
  return pairs;
}

// Daire/bambu taslarinda 1-9 desen yerlesimleri (kutuya gore oranli koordinatlar).
const DOT_POS: Record<number, Array<[number, number]>> = {
  1: [[0, 0]],
  2: [[0, -0.55], [0, 0.55]],
  3: [[-0.62, -0.62], [0, 0], [0.62, 0.62]],
  4: [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]],
  5: [[-0.6, -0.6], [0.6, -0.6], [0, 0], [-0.6, 0.6], [0.6, 0.6]],
  6: [[-0.55, -0.6], [0.55, -0.6], [-0.55, 0], [0.55, 0], [-0.55, 0.6], [0.55, 0.6]],
  7: [[-0.62, -0.62], [0, -0.62], [0.62, -0.62], [-0.55, 0], [0.55, 0], [-0.55, 0.6], [0.55, 0.6]],
  8: [[-0.6, -0.6], [0, -0.6], [0.6, -0.6], [-0.6, 0], [0.6, 0], [-0.6, 0.6], [0, 0.6], [0.6, 0.6]],
  9: [[-0.6, -0.6], [0, -0.6], [0.6, -0.6], [-0.6, 0], [0, 0], [0.6, 0], [-0.6, 0.6], [0, 0.6], [0.6, 0.6]],
};

// Seviye dizimleri. Taşlar standart 144 taslik mahjong setinden dogrulanir;
// sembol atamasi kaldirma simulasyonu ile cozulebilirlik garantisi verir.
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
    { name: "Klasik 144", cells: turtleShape(), bg: ["#10241c", "#1c4530"] },
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

function turtleShape(): Array<[number, number]> {
  // Klasik kaplumbaganin taban katmani (87 tas). Ust katmanlar
  // (36 + 16 + 4 + 1) buildLayout icinde eklenir; toplam 144 tas.
  const out: Array<[number, number]> = [];
  const rowSpan = (r: number, c0: number, c1: number) => {
    for (let c = c0; c <= c1; c++) out.push([c, r]);
  };
  rowSpan(0, 2, 11);
  rowSpan(1, 1, 13);
  rowSpan(2, 1, 13);
  rowSpan(3, 0, 14);
  rowSpan(4, 1, 13);
  rowSpan(5, 1, 13);
  rowSpan(6, 2, 11);
  return out;
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
  private tray: Array<{ id: number; symbol: string }> = []; // hazneye düşen eşlenen taşlar (max 4)
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
  private pops: Array<{ x: number; y: number; life: number; max: number; symbol: string; open: boolean }> = [];
  private time = 0;
  private score = 0;
  private combo = 0;
  private comboTimer = 0;
  private fates: string[] = [];
  private shuffleCount = 0;
  private maxShuffles = 3;
  private hintIds: number[] = [];
  private audio: AudioContext | null = null;
  private tw = 72;
  private th = 100;
  private gap = 10;

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
      const mixedBg = ["#2f3b1c", "#4a5b2a"] as [string, string];
      const bg = special === "mixed" ? mixedBg : RANDOM_BG[this.levelIndex % RANDOM_BG.length];
      const name =
        this.levelIndex < LEVELS.length
          ? LEVELS[this.levelIndex].name
          : special === "mixed"
            ? "Vahşi Bozkır"
            : `Rastgele #${this.levelIndex + 1}`;
      this.currentLevel = { name, cells, bg };
    }
    return this.currentLevel;
  }


  private buildLayout(): void {
    const def = this.level();
    const cells = def.cells;
    const isTurtle = def.name === "Klasik 144";

    let cols = 0;
    let rows = 0;
    for (const [c, r] of cells) {
      if (c > cols) cols = c;
      if (r > rows) rows = r;
    }
    this.layoutCols = cols + 1;
    this.layoutRows = rows + 1;

    // Dinamik tas boyutu: tahta tuvale sigmayacak kadar genis/yuksekse kucult.
    const maxW = CANVAS_W - 40;
    const maxH = CANVAS_H - 330;
    let tw = 72;
    const ar = 100 / 72;
    const gp = (w: number) => Math.max(3, Math.round(w * 0.14));
    while (tw > 24 && (cols * (tw + gp(tw)) > maxW || rows * (tw * ar + gp(tw)) > maxH)) tw -= 2;
    this.tw = tw;
    this.th = Math.round(tw * ar);
    this.gap = gp(tw);

    // Katmanlar: kaplumbagada acik katman disari; digerlerinde kademeli kule.
    let layers: Array<Array<[number, number]>>;
    if (isTurtle) {
      const has = (c: number, r: number) => cells.some(([cc, rr]) => cc === c && rr === r);
      const rect = (c0: number, c1: number, r0: number, r1: number) => {
        const out: Array<[number, number]> = [];
        for (let r = r0; r <= r1; r++)
          for (let c = c0; c <= c1; c++) if (has(c, r)) out.push([c, r]);
        return out;
      };
      layers = [cells.slice(), rect(4, 9, 1, 6), rect(5, 8, 2, 5), rect(6, 7, 3, 4), [[6, 3]]];
    } else {
      // Kademeli platform derinligi: kenar 1 kat, orta 2 kat, merkez kule 2-4 kat.
      const coreDepth = this.levelIndex >= 49 ? 4 : this.levelIndex >= 9 ? 3 : 2;
      const cMn = Math.max(0, Math.floor((cols + 1) / 3));
      const cMx = Math.min(cols, cols - 1 - Math.floor((cols + 1) / 3));
      const rMn = Math.max(0, Math.floor((rows + 1) / 3));
      const rMx = Math.min(rows, rows - 1 - Math.floor((rows + 1) / 3));
      const isCore = (c: number, r: number) => c >= cMn && c <= cMx && r >= rMn && r <= rMx;
      const isRing = (c: number, r: number) => c === 0 || r === 0 || c === cols || r === rows;
      const midCount = cells.filter(([c, r]) => !isRing(c, r)).length;
      const depthOf = (c: number, r: number) => {
        if (isCore(c, r)) return coreDepth;
        if (isRing(c, r) && midCount >= 4) return 1;
        return 2;
      };
      const even = <T,>(a: T[]): T[] => (a.length % 2 === 0 ? a : a.slice(0, -1));
      layers = [];
      for (let L = 0; L < coreDepth; L++) {
        layers.push(even(cells.filter(([c, r]) => depthOf(c, r) >= L + 1)));
      }
    }

    // Tum yerlesim hucreleri (katmanli).
    const slots: Array<{ c: number; r: number; L: number }> = [];
    for (let L = 0; L < layers.length; L++)
      for (const [c, r] of layers[L]) slots.push({ c, r, L });
    if (slots.length % 2 === 1) slots.pop();

    // Sembol atamasi: kaldirma simulasyonu ile cozulebilirlik garantisi.
    const pairsNeeded = Math.floor(slots.length / 2);
    let assigned: string[] | null = null;
    for (let attempt = 0; attempt < 60 && !assigned; attempt++) {
      const pool = buildPoolPairs();
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      assigned = this.assignSolvable(slots, pool.slice(0, pairsNeeded));
    }
    if (!assigned) {
      // Son care: sirayla ikiz cift (eslesme garantili, cozum sirasi garanti degil).
      assigned = [];
      const pool = buildPoolPairs();
      for (let i = 0; i < pairsNeeded; i++) assigned.push(pool[i][0], pool[i][1]);
    }
    for (let i = 0; i < slots.length; i++) {
      const sl = slots[i];
      this.tiles.push(this.makeTile(assigned[i], sl.c, sl.r, sl.L));
    }
  }

  /** Kaldirma sirasini simule eder: her adimda acik bir cift secip havada
   *  kaldirir. Basarili olursa donen dizinin her adimi oynanabilir oldugu
   *  icin seviye garantili cozulebilir olur. */
  private assignSolvable(
    slots: Array<{ c: number; r: number; L: number }>,
    pool: Array<[string, string]>,
  ): string[] | null {
    const n = slots.length;
    const alive = new Array<boolean>(n).fill(true);
    const out: string[] = new Array<string>(n);
    const above: number[][] = new Array(n);
    const lft: number[][] = new Array(n);
    const rgt: number[][] = new Array(n);
    for (let i = 0; i < n; i++) {
      above[i] = [];
      lft[i] = [];
      rgt[i] = [];
    }
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const a = slots[i];
        const b = slots[j];
        if (a.c === b.c && a.r === b.r && b.L > a.L) above[i].push(j);
        if (a.r === b.r && b.L >= a.L) {
          if (b.c === a.c - 1) lft[i].push(j);
          else if (b.c === a.c + 1) rgt[i].push(j);
        }
      }
    const isFree = (i: number): boolean => {
      for (const j of above[i]) if (alive[j]) return false;
      const L = lft[i].some((j) => alive[j]);
      const R = rgt[i].some((j) => alive[j]);
      return !L || !R;
    };
    for (let p = 0; p < pool.length; p++) {
      const free: number[] = [];
      for (let i = 0; i < n; i++) if (alive[i] && isFree(i)) free.push(i);
      if (free.length < 2) return null;
      const a = free[Math.floor(Math.random() * free.length)];
      let b = a;
      while (b === a) b = free[Math.floor(Math.random() * free.length)];
      alive[a] = false;
      alive[b] = false;
      out[a] = pool[p][0];
      out[b] = pool[p][1];
    }
    return out;
  }
  private layoutCols = 4;
  private layoutRows = 4;

  /** Sağ panelin sol kenarına göre, tahtanın ortalanacağı x merkezi. */
  private boardOriginX(): number {
    return CANVAS_W / 2;
  }

  private makeTile(symbol: string, col: number, row: number, layer: number): Tile {
    // Üst katman aynı hücrenin üzerine hafifçe kayarak biner (mahjong hissi).
    const tw = this.tw;
    const th = this.th;
    const gap = this.gap;
    const ox = layer * tw * 0.17;
    const oy = layer * -th * 0.14;
    const boardW = this.layoutCols * (tw + gap);
    const boardH = this.layoutRows * (th + gap);
    const sx0 = this.boardOriginX() - boardW / 2;
    const sy0 = (CANVAS_H - boardH) / 2 + 30;
    const sx = sx0 + col * (tw + gap) + ox;
    const sy = sy0 + row * (th + gap) + oy;
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
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.shards = [];
    this.shuffleCount = 0;
    this.hintIds = [];
    this.fates = this.rollFates();
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
    this.sfx("undo");
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
      const halfW = this.tw / 2;
      const halfH = this.th / 2;
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

    // Haznede aynı desenden 2 varsa -> kır (eşleşme).
    const lastIdx = this.tray.length - 1;
    let pairIdx = -1;
    for (let i = 0; i < lastIdx; i++) {
      if (matchKey(this.tray[i].symbol) === matchKey(target.symbol)) {
        pairIdx = i;
        break;
      }
    }
    if (pairIdx !== -1) {
      this.breakPair(pairIdx, lastIdx);
    } else if (this.tray.length >= this.maxTray()) {
      // Hazne doldu: oyuncu kaybeder.
      this.lost = true;
      this.sfx("lose");
    } else {
      this.sfx("pick");
    }

    // Kazanma.
    if (this.tiles.every((t) => t.removed)) {
      this.won = true;
      this.sfx("win");
      this.recordProgress();
      if (this.shuffleCount === 0) {
        this.score += 500;
        this.floats.push({ x: CANVAS_W / 2, y: CANVAS_H / 2 - 40, life: 1.4, max: 1.4, text: "Temiz Zafer! +500", color: "#ffd75e" });
      }
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
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
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
    this.sfx("match");
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
          this.bursts.push({ x: bt.sx, y: bt.sy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 60, life: 0.7, max: 1, color: tileColor(bt.symbol), r: 3 + Math.random() * 6 });
        }
        this.bursts.push({ x: bt.sx, y: bt.sy, vx: 0, vy: -40, life: 0.35, max: 0.35, color: "#ffffff", r: 26 });
      }
      this.floats.push({ x: (btA!.sx + btB!.sx) / 2, y: (btA!.sy + btB!.sy) / 2 - 10, life: 1.0, max: 1.0, text: "+2", color: "#ffd75e" });
    }
    const shard = (slot: number, sym: string) => {
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
          color: tileColor(sym),
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
    this.combo++;
    this.comboTimer = this.comboDuration();
    this.score += Math.round(100 * Math.min(this.combo, 10) * this.scoreMult());
  }

  shuffle(): void {
    if (this.shuffleCount >= this.maxShuffles || this.won || this.lost) return;
    const remaining = this.tiles.filter((t) => !t.removed);
    const syms = remaining.map((t) => t.symbol);
    for (let i = syms.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [syms[i], syms[j]] = [syms[j], syms[i]];
    }
    remaining.forEach((t, i) => (t.symbol = syms[i]));
    this.shuffleCount++;
    this.sfx("shuffle");
    this.hintIds = [];
    this.emitHud();
  }

  hint(): void {
    if (this.won || this.lost) return;
    this.sfx("hint");
    this.hintIds = [];
    const usable = (t: Tile) => !t.removed && this.isOpen(t) && this.sideFree(t);
    // Once haznedeki tek tasa karsi acik esi var mi? (en dogrudan hamle)
    for (const te of this.tray) {
      const e = this.tiles.find((t) => usable(t) && matchKey(t.symbol) === matchKey(te.symbol) && t.id !== te.id);
      if (e) {
        this.hintIds = [e.id];
        this.emitHud();
        return;
      }
    }
    // Yoksa tahtada ayni desende iki acik tasa bak.
    const seen = new Map<string, Tile>();
    for (const o of this.tiles) {
      if (!usable(o)) continue;
      const mk = matchKey(o.symbol);
      if (seen.has(mk)) {
        this.hintIds = [seen.get(mk)!.id, o.id];
        this.emitHud();
        return;
      }
      seen.set(mk, o);
    }
    this.emitHud();
  }

  private drawHint(c: CanvasRenderingContext2D): void {
    for (const id of this.hintIds) {
      const t = this.tiles.find((x) => x.id === id);
      if (!t || t.removed) continue;
      const p = 0.5 + 0.5 * Math.sin(this.time * 6);
      c.save();
      c.strokeStyle = "rgba(255,220,80," + (0.5 + 0.4 * p) + ")";
      c.lineWidth = 4;
      c.shadowColor = "rgba(255,220,80,0.9)";
      c.shadowBlur = 12 + 8 * p;
      c.beginPath();
      c.roundRect(t.sx - this.tw / 2 - 5, t.sy - this.th / 2 - 5, this.tw + 10, this.th + 10, 12);
      c.stroke();
      c.restore();
    }
  }

  private ensureAudio(): AudioContext | null {
    if (!this.audio) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.audio = new AC();
    }
    if (this.audio.state === "suspended") void this.audio.resume();
    return this.audio;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol = 0.2, slideTo?: number): void {
    const ac = this.audio || this.ensureAudio();
    if (!ac) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + dur + 0.03);
  }

  private sfx(name: string): void {
    this.audio || this.ensureAudio();
    switch (name) {
      case "pick": this.tone(540, 0.08, "triangle", 0.12); break;
      case "undo": this.tone(320, 0.14, "triangle", 0.12, 200); break;
      case "hint": this.tone(880, 0.12, "sine", 0.14, 1240); break;
      case "shuffle":
        this.tone(180, 0.16, "sawtooth", 0.1, 120);
        setTimeout(() => this.tone(230, 0.12, "sawtooth", 0.08), 120);
        break;
      case "lose": this.tone(320, 0.5, "sawtooth", 0.12, 130); break;
      case "match":
        this.tone(660, 0.22, "sine", 0.18, 990);
        this.tone(330, 0.14, "triangle", 0.09, 440);
        break;
      case "win":
        [523, 659, 784, 1046].forEach((f, i) =>
          setTimeout(() => this.tone(f, 0.28, "triangle", 0.18), i * 110),
        );
        break;
    }
  }

  private rollFates(): string[] {
    const bonus = ["alp", "iron", "wolf"];
    const lanet = ["shadow", "limited", "heavy"];
    const out: string[] = [];
    if (Math.random() < 0.5) {
      out.push(bonus[Math.floor(Math.random() * bonus.length)]);
    } else {
      out.push(lanet[Math.floor(Math.random() * lanet.length)]);
    }
    if (Math.random() < 0.25) {
      const hasBonus = out.every((id) => bonus.includes(id));
      const pool = hasBonus ? lanet : bonus;
      out.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return out;
  }

  private comboDuration(): number {
    let d = 5;
    if (this.fates.includes("alp")) d += 2;
    if (this.fates.includes("shadow")) d -= 2;
    return Math.max(2, d);
  }

  private maxTray(): number {
    let m = 4;
    if (this.fates.includes("iron")) m += 1;
    if (this.fates.includes("limited")) m -= 1;
    return Math.max(2, m);
  }

  private scoreMult(): number {
    let m = 1;
    if (this.fates.includes("wolf")) m *= 1.25;
    if (this.fates.includes("heavy")) m *= 0.8;
    return m;
  }

  private drawFates(c: CanvasRenderingContext2D): void {
    if (this.fates.length === 0) return;
    const labels: Record<string, string> = {
      alp: "Alp Rünü +2sn",
      iron: "Hazne +1",
      wolf: "Puan x1.25",
      shadow: "Combo -2sn",
      limited: "Hazne -1",
      heavy: "Puan x0.8",
    };
    const bonus = ["alp", "iron", "wolf"];
    const y = 172;
    c.font = "bold 13px Georgia";
    c.textBaseline = "middle";
    const widths = this.fates.map((id) => c.measureText(labels[id]).width + 22);
    const total = widths.reduce((a, b) => a + b, 0) + 8 * (this.fates.length - 1);
    let x = CANVAS_W / 2 - total / 2;
    for (let i = 0; i < this.fates.length; i++) {
      const id = this.fates[i];
      const isB = bonus.includes(id);
      c.fillStyle = isB ? "rgba(212,175,55,0.26)" : "rgba(170,90,70,0.30)";
      c.beginPath();
      c.roundRect(x, y - 10, widths[i], 20, 8);
      c.fill();
      c.strokeStyle = isB ? "rgba(212,175,55,0.7)" : "rgba(200,120,90,0.7)";
      c.lineWidth = 1.2;
      c.beginPath();
      c.roundRect(x, y - 10, widths[i], 20, 8);
      c.stroke();
      c.fillStyle = isB ? "#ffe9a8" : "#e8b8a6";
      c.fillText(labels[id], x + widths[i] / 2, y + 1);
      x += widths[i] + 8;
    }
  }

  private recordProgress(): void {
    try {
      const stars = this.calcStars();
      const sec = Math.floor(this.seconds);
      const skey = 'otuken_' + this.levelIndex + '_stars';
      const bkey = 'otuken_' + this.levelIndex + '_best';
      const prevStars = Number(localStorage.getItem(skey) || '0');
      const prevBest = Number(localStorage.getItem(bkey) || '0');
      if (stars > prevStars) localStorage.setItem(skey, String(stars));
      if (prevBest === 0 || sec < prevBest) localStorage.setItem(bkey, String(sec));
    } catch {
      /* storage unavailable */
    }
  }

  private calcStars(): number {
    const pairs = Math.max(1, this.tiles.length / 2);
    const t = this.seconds;
    if (t <= pairs * 4) return 3;
    if (t <= pairs * 7) return 2;
    return 1;
  }

  private emitHud(): void {
    const remaining = this.tiles.filter((t) => !t.removed).length;
    let stuck = false;
    if (remaining > 0) {
      // Çözülebilir mi? (basit: açık eşleşme var mı)
      const opens = this.tiles.filter((t) => this.isOpen(t));
      const seen = new Set<string>();
      stuck = true;
      for (const o of opens) {
        const mk = matchKey(o.symbol);
        if (seen.has(mk)) {
          stuck = false;
          break;
        }
        seen.add(mk);
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
      score: this.score,
      combo: this.combo,
      stars: this.won ? this.calcStars() : 0,
      fates: this.fates,
      shuffles: this.maxShuffles - this.shuffleCount,
      cleanWin: this.won && this.shuffleCount === 0,
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
      // Keskin cok katmanli uzak dag sirtlari (iki harmonik uzerine biner).
      const ridge = (baseY: number, amp: number, seed: number, sharp: number) => {
        m.beginPath();
        m.moveTo(0, baseY + 60);
        for (let x = 0; x <= CANVAS_W; x += 20) {
          const w = (x + seed) * 0.006;
          const y = baseY - Math.abs(Math.sin(w)) * amp - Math.abs(Math.sin(w * 2.3 + 1.7)) * amp * sharp;
          m.lineTo(x, y);
        }
        m.lineTo(CANVAS_W, CANVAS_H);
        m.lineTo(0, CANVAS_H);
        m.closePath();
        m.fill();
      };
      m.save();
      m.globalAlpha = 0.55;
      m.fillStyle = "rgba(150,175,200,0.16)";
      ridge(398, 76, 40, 0.6);
      m.fillStyle = "rgba(130,160,185,0.20)";
      ridge(508, 58, 130, 0.5);
      m.fillStyle = "rgba(110,140,165,0.24)";
      ridge(618, 48, 210, 0.45);
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

      // ---- Bozkır çimenleri (rüzgârda eğilen ot demetleri) ----
      m.save();
      m.globalAlpha = 0.4;
      m.lineWidth = 1.6;
      m.strokeStyle = "rgba(120,145,95,0.45)";
      const grass = (bx: number, baseY: number) => {
        for (let k = 0; k < 6; k++) {
          m.beginPath();
          const gx = bx + (k - 2.5) * 9;
          m.moveTo(gx, baseY);
          m.quadraticCurveTo(gx + 3, baseY - 9, gx + 1 + (k % 2) * 2, baseY - 15 - (k % 3) * 3);
          m.stroke();
        }
      };
      for (let i = 0; i < 6; i++) grass(60 + i * 28, 1216 + (i % 2) * 6);
      for (let i = 0; i < 6; i++) grass(CANVAS_W - 210 + i * 28, 1210 + (i % 2) * 8);
      m.restore();

      // ---- Gökyüzünde süzülen Göktürk kartalı (kanat açık) ----
      m.save();
      m.globalAlpha = 0.5;
      m.fillStyle = "rgba(22,28,40,0.45)";
      const eagle = (cx: number, cy: number, su: number) => {
        m.beginPath();
        m.moveTo(cx, cy - 14 * su);
        m.quadraticCurveTo(cx + 3 * su, cy - 8 * su, cx + 9 * su, cy - 3 * su);
        m.lineTo(cx + 7 * su, cy + 3 * su);
        m.lineTo(cx + 11 * su, cy + 12 * su);
        m.lineTo(cx + 4 * su, cy + 8 * su);
        m.lineTo(cx, cy + 10 * su);
        m.lineTo(cx - 4 * su, cy + 8 * su);
        m.lineTo(cx - 11 * su, cy + 12 * su);
        m.lineTo(cx - 7 * su, cy + 3 * su);
        m.lineTo(cx - 9 * su, cy - 3 * su);
        m.closePath();
        m.fill();
        m.beginPath();
        m.moveTo(cx - 7 * su, cy - 4 * su);
        m.quadraticCurveTo(cx - 30 * su, cy - 24 * su, cx - 42 * su, cy - 10 * su);
        m.quadraticCurveTo(cx - 27 * su, cy - 7 * su, cx - 9 * su, cy + 1 * su);
        m.closePath();
        m.fill();
        m.beginPath();
        m.moveTo(cx + 7 * su, cy - 4 * su);
        m.quadraticCurveTo(cx + 30 * su, cy - 24 * su, cx + 42 * su, cy - 10 * su);
        m.quadraticCurveTo(cx + 27 * su, cy - 7 * su, cx + 9 * su, cy + 1 * su);
        m.closePath();
        m.fill();
      };
      eagle(CANVAS_W - 150, 210, 1);
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
    this.drawFates(c);

    // Yerleşimin çerçevesi (taş alanına göre).
    const boxW = this.layoutCols * (this.tw + this.gap) + this.gap;
    const boxH = this.layoutRows * (this.th + this.gap) + this.gap;
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
    this.drawHint(c);

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
      c.strokeStyle = tileColor(pp.symbol);
      c.lineWidth = 3;
      const rr = (1 - k) * 46 + 8;
      c.beginPath();
      c.arc(pp.x, pp.y, rr, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = a * 0.55;
      c.fillStyle = tileColor(pp.symbol);
      c.font = "bold 30px " + CJK_FONT;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(faceLabel(pp.symbol), pp.x, pp.y);
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
        c.fillStyle = tileColor(this.tray[i].symbol);
        c.font = "bold 26px " + CJK_FONT;
        c.textBaseline = "middle";
        c.fillText(faceLabel(this.tray[i].symbol), sx + slotW / 2, trayY - 8);
      }
    }
    c.textBaseline = "alphabetic";


    // Üst şerit: istatistik (portrede üstte ortalanmış).
    const remaining = this.tiles.filter((t) => !t.removed).length;
    const total = this.tiles.length;
    c.fillStyle = "#ffd75e";
    c.font = "bold 18px Georgia";
    c.textAlign = "center";
    let topLine = `Puan: ${this.score}`;
    if (this.combo > 1 && this.comboTimer > 0) topLine += `   Combo ×${this.combo}`;
    c.fillText(topLine, CANVAS_W / 2, 116);
    c.fillStyle = "#d4e8f2";
    c.fillText(`Kalan: ${remaining}/${total}   Hamle: ${this.moves}   Süre: ${Math.floor(this.seconds)} sn   Karıştır: ${this.maxShuffles - this.shuffleCount}`, CANVAS_W / 2, 144);

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
      c.font = "bold 34px Georgia";
      c.fillStyle = "#ffd75e";
      const starCount = this.calcStars();
      c.fillText("★".repeat(starCount) + "☆".repeat(3 - starCount), CANVAS_W / 2, CANVAS_H / 2 - 18);
      c.font = "bold 19px Georgia";
      c.fillStyle = "#9fd0e0";
      c.fillText(`Puan: ${this.score}   Hamle: ${this.moves}   Süre: ${Math.floor(this.seconds)} sn`, CANVAS_W / 2, CANVAS_H / 2 + 24);
      c.font = "bold 20px Georgia";
      c.fillText("[Sonraki Seviye] L    [Yeniden Oyna] N", CANVAS_W / 2, CANVAS_H / 2 + 60);
      let bestLine = "";
      try {
        const b = localStorage.getItem("otuken_" + this.levelIndex + "_best");
        const st = localStorage.getItem("otuken_" + this.levelIndex + "_stars");
        if (b) {
          bestLine = "En iyi: " + b + " sn" + (st ? "  \u2605".repeat(Number(st)) : "");
        }
      } catch { /* ignore */ }
      if (bestLine) {
        c.font = "bold 17px Georgia";
        c.fillStyle = "#ffd75e";
        c.fillText(bestLine, CANVAS_W / 2, CANVAS_H / 2 + 92);
      }
    }
  }

  private specialArt(): "mixed" | "none" {
    return this.levelIndex >= 100 ? "mixed" : "none";
  }

  private drawFace(c: CanvasRenderingContext2D, t: Tile, open: boolean, canTake: boolean): void {
    const w = this.tw;
    const h = this.th;
    const bx = t.sx;
    const by = t.sy;
    const kind = t.symbol;
    const rc = tileColor(kind);
    c.save();
    if (!open) c.globalAlpha = 0.55;
    else if (!canTake) c.globalAlpha = 0.85;

    // Alinabilir taslarda hafif iltihap.
    if (open && canTake) {
      const glow = c.createRadialGradient(bx, by, 2, bx, by, w * 0.5);
      glow.addColorStop(0, rc);
      glow.addColorStop(1, "transparent");
      c.globalAlpha = 0.22;
      c.fillStyle = glow;
      c.beginPath();
      c.arc(bx, by, w * 0.5, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = open ? 1 : 0.55;
    }

    const fx = w * 0.3;
    const fy = h * 0.28;
    const text = (ch: string, dy: number, size: number, color: string, stroke = true) => {
      c.font = "bold " + Math.round(size) + "px " + CJK_FONT;
      c.textAlign = "center";
      c.textBaseline = "middle";
      if (stroke) {
        c.lineJoin = "round";
        c.lineWidth = Math.max(2, size * 0.12);
        c.strokeStyle = "rgba(30,20,10,0.55)";
        c.strokeText(ch, bx, by + dy);
      }
      c.fillStyle = color;
      c.fillText(ch, bx, by + dy);
    };

    if (kind[0] === "b" || kind[0] === "c") {
      const n = Number(kind.slice(1));
      const pos = DOT_POS[n] || DOT_POS[1];
      if (kind[0] === "c") {
        // Daire (Tong): mavi halkalar
        const r = n === 1 ? fy * 0.55 : n <= 2 ? fy * 0.34 : n <= 4 ? fy * 0.28 : fy * 0.24;
        for (const [px, py] of pos) {
          const cx = bx + px * fx;
          const cy = by + py * fy;
          c.beginPath();
          c.arc(cx, cy, r, 0, Math.PI * 2);
          c.fillStyle = n === 1 ? "#c0392b" : "#1b5faa";
          c.fill();
          c.lineWidth = Math.max(1, r * 0.25);
          c.strokeStyle = "#f6ecd4";
          c.stroke();
          c.beginPath();
          c.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
          c.fillStyle = n === 1 ? "#f2e3c0" : "#1b5faa";
          c.fill();
        }
      } else {
        // Bambu (Tia): yasi baglar
        const sw = n === 1 ? fx * 0.34 : fx * 0.24;
        const shh = n === 1 ? fy * 1.1 : fy * 0.62;
        for (const [px, py] of pos) {
          this.bambooStick(c, bx + px * fx, by + py * fy, sw, shh);
        }
      }
    } else if (kind[0] === "w") {
      // Karakter (Wan): lacivert sayi + kirmizi wan
      text(NUM_CH[Number(kind.slice(1)) - 1], -h * 0.11, h * 0.34, "#17457c");
      text("萬", h * 0.16, h * 0.3, "#c0392b");
    } else if (kind === "E" || kind === "S" || kind === "W" || kind === "N") {
      text(WIND_CH[kind], 0, h * 0.46, "#203a63");
    } else if (kind === "DR") {
      text("中", 0, h * 0.5, "#c0392b");
    } else if (kind === "DG") {
      text("發", 0, h * 0.5, "#2e8b57");
    } else if (kind === "DW") {
      // Beyaz ejderha: mavi cerceve
      c.lineWidth = Math.max(2, w * 0.045);
      c.strokeStyle = "#3b6ea5";
      c.beginPath();
      c.roundRect(bx - w * 0.22, by - h * 0.26, w * 0.44, h * 0.52, 4);
      c.stroke();
      c.lineWidth = Math.max(1, w * 0.02);
      c.strokeStyle = "rgba(59,110,165,0.6)";
      c.beginPath();
      c.roundRect(bx - w * 0.15, by - h * 0.19, w * 0.3, h * 0.38, 3);
      c.stroke();
    } else if (kind[0] === "f") {
      // Cicekler: kirmizi cicek karakteri + altin numarasi
      text(FLOWER_CH[Number(kind.slice(1)) - 1], -h * 0.05, h * 0.4, "#c2185b");
      text(kind.slice(1), h * 0.24, h * 0.16, "#b8860b", false);
    } else if (kind[0] === "s") {
      // Mevsimler: altin mevsim karakteri + numarasi
      text(SEASON_CH[Number(kind.slice(1)) - 1], -h * 0.05, h * 0.4, "#b8860b");
      text(kind.slice(1), h * 0.24, h * 0.16, "#b8860b", false);
    }
    c.restore();
  }

  private bambooStick(c: CanvasRenderingContext2D, cx: number, cy: number, sw: number, shh: number): void {
    const x = cx - sw / 2;
    const y = cy - shh / 2;
    c.save();
    c.fillStyle = "#2e8b57";
    c.beginPath();
    c.roundRect(x, y, sw, shh, sw * 0.45);
    c.fill();
    c.strokeStyle = "rgba(20,60,35,0.8)";
    c.lineWidth = Math.max(1, sw * 0.14);
    c.stroke();
    c.strokeStyle = "rgba(253,243,218,0.9)";
    c.lineWidth = Math.max(1, sw * 0.16);
    for (const f of [0.3, 0.7]) {
      c.beginPath();
      c.moveTo(x + sw * 0.1, y + shh * f);
      c.lineTo(x + sw * 0.9, y + shh * f);
      c.stroke();
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
    const w = this.tw;
    const h = this.th;
    const x = t.sx - w / 2;
    const yTop = t.sy - h / 2;
    const R = Math.max(4, Math.round(w * 0.125));

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
    bg.addColorStop(0.45, shade(open ? "#f7ecd2" : face, open ? -3 : 3));
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
      c.roundRect(x + w * 0.1, yTop + h * 0.09, w - w * 0.2, h - h * 0.18, R - 2);
      c.fill();
      // Ic gogei (ustte hafif kucuk)
      const sh = c.createLinearGradient(0, yTop + h * 0.09, 0, yTop + h * 0.34);
      sh.addColorStop(0, "rgba(0,0,0,0.06)");
      sh.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = sh;
      c.beginPath();
      c.roundRect(x + w * 0.1, yTop + h * 0.09, w - w * 0.2, h * 0.25, R - 2);
      c.fill();
      // Ust kenar parlaklik cizgisi (madalyon)
      c.strokeStyle = "rgba(255,255,255,0.55)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x + w * 0.14, yTop + h * 0.11);
      c.lineTo(x + w - w * 0.14, yTop + h * 0.11);
      c.stroke();
    } else {
      c.save();
      c.globalAlpha = 0.16;
      c.strokeStyle = "#ffffff";
      c.lineWidth = 1.2;
      for (let i = -1; i < 5; i++) {
        const off = x + i * w * 0.17;
        c.beginPath();
        c.moveTo(off, yTop);
        c.lineTo(off + w * 0.16, yTop + h);
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

    // ---- Tas yuzu: standart mahjong deseni (bambu / daire / karakter /
    //      ruzgar / ejderha / cicek / mevsim) ----
    this.drawFace(c, t, open, canTake);

    // ---- Taş yüzü sanatsal ışıklandırma (cam vurgusu + iç gölge) ----
    if (open) {
      c.save();
      const gA = c.createRadialGradient(
        x + w * 0.36,
        yTop + h * 0.28,
        2,
        x + w * 0.36,
        yTop + h * 0.28,
        w * 0.95,
      );
      gA.addColorStop(0, "rgba(255,255,255,0.16)");
      gA.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = gA;
      c.beginPath();
      c.roundRect(x + 2, yTop + 2, w - 4, h - 4, R - 1);
      c.fill();
      c.restore();
      c.save();
      const gB = c.createLinearGradient(0, yTop + h * 0.45, 0, yTop + h);
      gB.addColorStop(0, "rgba(120,80,20,0)");
      gB.addColorStop(1, "rgba(120,80,20,0.13)");
      c.fillStyle = gB;
      c.beginPath();
      c.roundRect(x + 2, yTop + 2, w - 4, h - 4, R - 1);
      c.fill();
      c.restore();
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
