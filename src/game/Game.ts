// Anubis'in Terazisi — dövüşsüz mitolojik bulmaca oyunu.
// 4 oda: baskı plakası, sembol hafızası, Sfenks bilmecesi, son bilmece.

export type SceneState = "intro" | "room" | "won";

export interface HudState {
  roomIndex: number;
  roomTotal: number;
  roomName: string;
  roomHint: string;
  scene: SceneState;
  platesDone: number;
}

const CANVAS_W = 1280;
const CANVAS_H = 720;
const GROUND = 600;

interface PlateDef {
  x: number;
  active: boolean;
}

interface SymbolPuzzle {
  sequence: string[];
  entered: string[];
  showIndex: number;
  showTimer: number;
  revealDone: boolean;
}

const SYMBOL_OPTIONS = ["ankh", "eye", "scarab", "falcon"];

const ROOMS = [
  {
    id: "plates",
    name: "Terazi Avlusu",
    hint: "Üç baskı taşını da bas, kapı açılsın.",
    type: "plates",
  },
  {
    id: "memory",
    name: "Hatıra Salonu",
    hint: "Sembol dizisini hatırla ve aynı sırayla tıklarla.",
    type: "memory",
  },
  {
    id: "riddle1",
    name: "Sfenks'in Fısıltısı",
    hint: "Sfenks bir soru sorar. Doğru cevabı seç.",
    type: "riddle",
    question: "Sabah dört, öğlen iki, akşam üç ayakla yürür. Bu nedir?",
    options: ["aslan", "insan", "kartal", "yılan"],
    answer: "insan",
    reward: "İlk Ana Hatıra kazandın!",
  },
  {
    id: "riddle2",
    name: "Anubis'in Hükmü",
    hint: "Son bilmece. Kalbin terazide tartılsın.",
    type: "riddle",
    question: "Konuştukça çoğalır, susunca azalır. Hiçbir ülke sınırsız sahip değildir. Nedir?",
    options: ["zaman", "para", "kelime", "müzik"],
    answer: "kelime",
    reward: "Nil Kristali kazandın! Yol tamamlandı.",
  },
];

export class Game {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private running = false;
  private last = 0;

  // Sahne durumu.
  scene: SceneState = "intro";
  roomIndex = 0;

  // Bulmaca durumları.
  private plates: PlateDef[] = [];
  private symbol: SymbolPuzzle = { sequence: [], entered: [], showIndex: 0, showTimer: 0, revealDone: false };

  // Fare etkileşimi.
  mouse: { x: number; y: number };

  onHud?: (h: HudState) => void;
  onWin?: () => void;

  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    this.ctx = canvas.getContext("2d")!;
    this.mouse = { x: 0, y: 0 };
    this.buildPlates();
  }

  start(): void {
    this.running = true;
    this.last = performance.now();
    canvasEvents.addEventListener("mousemove", this.onMouseMove);
    canvasEvents.addEventListener("mousedown", this.onMouseDown);
    this.raf = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    canvasEvents.removeEventListener("mousemove", this.onMouseMove);
    canvasEvents.removeEventListener("mousedown", this.onMouseDown);
  }

  private onMouseMove = (e: Event): void => {
    const m = e as MouseEvent;
    this.mouse = { x: m.clientX, y: m.clientY };
  };

  private onMouseDown = (e: Event): void => {
    const m = e as MouseEvent;
    const rect = this.canvas.getBoundingClientRect();
    const cx = (m.clientX - rect.left) * (CANVAS_W / rect.width);
    const cy = (m.clientY - rect.top) * (CANVAS_H / rect.height);
    this.handleClick(cx, cy);
  };

  private loop = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.04, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private buildPlates(): void {
    this.plates = [
      { x: 300, active: false },
      { x: 640, active: false },
      { x: 980, active: false },
    ];
  }

  // ---- Oda geçişleri ----
  beginRoom(index: number): void {
    this.roomIndex = index;
    this.scene = "room";
    if (this.room().type === "memory") {
      this.symbol = {
        sequence: this.pickSequence(),
        entered: [],
        showIndex: 0,
        showTimer: 0,
        revealDone: false,
      };
    }
    this.emitHud();
  }

  private pickSequence(): string[] {
    const pool = [...SYMBOL_OPTIONS];
    const seq: string[] = [];
    for (let i = 0; i < 4; i++) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      seq.push(pick);
    }
    return seq;
  }

  private room() {
    return ROOMS[this.roomIndex] ?? ROOMS[0];
  }

  // ---- Giriş ekranından başlat ----
  startGame(): void {
    this.scene = "intro";
    this.beginRoom(0);
  }

  // ---- Tıklama mantığı ----
  private handleClick(x: number, y: number): void {
    if (this.scene === "intro") {
      if (this.hit(x, y, 490, 430, 300, 70)) this.startGame();
      return;
    }
    if (this.scene === "won") {
      if (this.hit(x, y, 490, 470, 300, 70)) this.startGame();
      return;
    }

    const room = this.room();
    if (room.type === "plates") {
      for (const p of this.plates) {
        if (!p.active && this.hit(x, y, p.x - 55, GROUND - 30, 110, 30)) {
          p.active = true;
          if (this.plates.every((q) => q.active)) {
            // Oda tamamlandı.
            setTimeout(() => this.advance(), 600);
          }
        }
      }
    } else if (room.type === "memory") {
      // Sembol seçenekleri.
      if (this.symbol.revealDone && this.symbol.entered.length < this.symbol.sequence.length) {
        SYMBOL_OPTIONS.forEach((s, i) => {
          const sx = 320 + i * 220;
          if (this.hit(x, y, sx - 45, 335, 90, 90)) {
            this.pressSymbol(s);
          }
        });
      }
    } else if (room.type === "riddle") {
      (room.options ?? []).forEach((opt, i) => {
        const oy = 380 + i * 70;
        if (this.hit(x, y, 440, oy, 400, 54)) {
          this.answerRiddle(opt);
        }
      });
    }
  }

  private pressSymbol(s: string): void {
    const seq = this.symbol.sequence;
    const entered = this.symbol.entered;
    const expected = seq[entered.length];
    if (s === expected) {
      entered.push(s);
      if (entered.length >= seq.length) {
        setTimeout(() => this.advance(), 500);
      }
    } else {
      this.symbol.entered = [];
    }
  }

  private answerRiddle(opt: string): void {
    const room = this.room();
    if (room.type !== "riddle") return;
    if (opt === room.answer) {
      setTimeout(() => this.advance(), 700);
    }
  }

  private advance(): void {
    if (this.roomIndex >= ROOMS.length - 1) {
      this.scene = "won";
      this.onWin?.();
      this.emitHud();
      return;
    }
    this.beginRoom(this.roomIndex + 1);
  }

  private hit(x: number, y: number, rx: number, ry: number, rw: number, rh: number): boolean {
    return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
  }

  private update(dt: number): void {
    // Sembol gösterim aşaması.
    const room = this.room();
    if (room.type === "memory" && !this.symbol.revealDone) {
      this.symbol.showTimer -= dt;
      if (this.symbol.showTimer <= 0) {
        if (this.symbol.showIndex < this.symbol.sequence.length) {
          this.symbol.showTimer = 0.7;
          this.symbol.showIndex++;
        } else {
          this.symbol.revealDone = true;
        }
      }
    }
  }

  private emitHud(): void {
    this.onHud?.({
      roomIndex: this.roomIndex,
      roomTotal: ROOMS.length,
      roomName: this.room().name,
      roomHint: this.room().hint,
      scene: this.scene,
      platesDone: this.plates.filter((p) => p.active).length,
    });
  }

  // ================= RENDER =================
  private render(): void {
    const c = this.ctx;
    if (this.scene === "intro") return this.renderIntro(c);
    if (this.scene === "won") return this.renderWon(c);
    this.renderRoom(c);
  }

  private renderIntro(c: CanvasRenderingContext2D): void {
    // Tapınak fonu.
    c.fillStyle = "#0f1a24";
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    this.drawTempleBackdrop(c);
    // Başlık.
    c.fillStyle = "#ffd24a";
    c.textAlign = "center";
    c.font = "bold 64px Georgia";
    c.fillText("Anubis'in Terazisi", CANVAS_W / 2, 200);
    c.fillStyle = "#e8eefc";
    c.font = "22px Georgia";
    c.fillText("Dört odayı çöz, Nil Kristali'ni al.", CANVAS_W / 2, 250);
    this.drawButton(c, 490, 420, 300, 70, "Oyunu Başlat", this.mouse);
    // Anubis büstü.
    this.drawAnubis(c, 640, 300, 1.6);
  }

  private renderWon(c: CanvasRenderingContext2D): void {
    c.fillStyle = "#101a2a";
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    this.drawCrystal(c, CANVAS_W / 2, 260);
    c.fillStyle = "#7bed9f";
    c.textAlign = "center";
    c.font = "bold 58px Georgia";
    c.fillText("Yol Tamamlandı!", CANVAS_W / 2, 150);
    c.fillStyle = "#e8eefc";
    c.font = "24px Georgia";
    c.fillText("Nil'in terazisinde kalbin hafifledi, bilgelik senin.", CANVAS_W / 2, 350);
    this.drawButton(c, 490, 460, 300, 70, "Tekrar Oyna", this.mouse);
  }

  private renderRoom(c: CanvasRenderingContext2D): void {
    const room = this.room();
    // Duvarlar.
    this.drawTempleRoom(c, room);
    // Zemin.
    c.fillStyle = "#b08b45";
    c.fillRect(0, GROUND, CANVAS_W, CANVAS_H - GROUND);
    c.fillStyle = "rgba(255,255,255,0.1)";
    c.fillRect(0, GROUND, CANVAS_W, 4);

    if (room.type === "plates") this.drawPlatesRoom(c);
    else if (room.type === "memory") this.drawMemoryRoom(c);
    else if (room.type === "riddle") this.drawRiddleRoom(c, room);

    // Kapı (sağda).
    this.drawDoor(c, CANVAS_W - 40, room.type === "plates" ? this.plates.every((p) => p.active) : true);
  }

  private drawPlatesRoom(c: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.plates.length; i++) {
      const p = this.plates[i];
      c.fillStyle = p.active ? "#37e8c0" : "#d8b66a";
      c.beginPath();
      c.ellipse(p.x, GROUND, 50, 26, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "rgba(0,0,0,0.4)";
      c.lineWidth = 3;
      c.stroke();
      if (p.active) {
        c.fillStyle = "rgba(55,232,192,0.3)";
        c.beginPath();
        c.ellipse(p.x, GROUND, 60, 34, 0, 0, Math.PI * 2);
        c.fill();
      } else {
        // Sembol.
        c.fillStyle = "#5a3c1a";
        c.font = "bold 26px Georgia";
        c.textAlign = "center";
        c.fillText("☥", p.x, GROUND - 8);
      }
    }
    c.fillStyle = "#e8eefc";
    c.font = "18px Georgia";
    c.textAlign = "center";
    c.fillText(
      `Plakar: ${this.plates.filter((p) => p.active).length} / 3`,
      CANVAS_W / 2,
      120,
    );
  }

  private drawMemoryRoom(c: CanvasRenderingContext2D): void {
    const sym = this.symbol;
    // Gösterim aşaması.
    if (!sym.revealDone) {
      c.fillStyle = "#fff";
      c.font = "26px Georgia";
      c.textAlign = "center";
      c.fillText("Sembolleri izle...", CANVAS_W / 2, 180);
      const shown = Math.min(sym.showIndex, sym.sequence.length);
      const current = sym.sequence[shown - 1];
      if (current) {
        this.drawSymbol(c, current, CANVAS_W / 2, 280, 110);
        c.fillStyle = "#ffd24a";
        c.font = "18px Georgia";
        c.fillText(`Sıradaki: ${shown} / ${sym.sequence.length}`, CANVAS_W / 2, 360);
      }
      return;
    }
    // Seçim aşaması: seçenekler.
    c.fillStyle = "#fff";
    c.font = "24px Georgia";
    c.textAlign = "center";
    c.fillText(
      `Diziyi tekrarla (${sym.entered.length} / ${sym.sequence.length})`,
      CANVAS_W / 2,
      180,
    );
    SYMBOL_OPTIONS.forEach((s, i) => {
      const sx = 320 + i * 220;
      this.drawSymbol(c, s, sx, 380, 90);
      if (this.mouse.x > sx - 45) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = this.mouse.x;
        void rect;
        void mx;
      }
    });
    // Girilen diziyi göster.
    c.fillStyle = "#e8eefc";
    c.font = "20px Georgia";
    let tx = 400;
    for (const s of sym.entered) {
      this.drawSymbol(c, s, tx, 500, 40);
      tx += 70;
    }
  }

  private drawRiddleRoom(c: CanvasRenderingContext2D, room: (typeof ROOMS)[number]): void {
    // Sfenks/Anubis konuşmacısı.
    c.fillStyle = "#e8eefc";
    c.font = "bold 26px Georgia";
    c.textAlign = "center";
    c.fillText(room.question ?? "", CANVAS_W / 2, 220);

    c.font = "18px Georgia";
    c.fillStyle = "#b8c4d8";
    c.fillText("Cevabı seç:", CANVAS_W / 2, 300);

    (room.options ?? []).forEach((opt, i) => {
      const oy = 340 + i * 75;
      this.drawButton(c, 440, oy, 400, 56, opt, this.mouse);
    });
  }

  // ---- Ortak çizimler ----
  private drawButton(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, mouse: { x: number; y: number }): void {
    const hover = this.inCanvas(mouse.x, mouse.y, x, y, w, h);
    c.fillStyle = hover ? "#7ad0ff" : "#d4af37";
    c.beginPath();
    c.roundRect(x, y, w, h, 12);
    c.fill();
    c.fillStyle = hover ? "#0a1a26" : "#5a3c1a";
    c.font = "bold 22px Georgia";
    c.textAlign = "center";
    c.fillText(label, x + w / 2, y + h / 2 + 8);
  }

  private inCanvas(mx: number, my: number, x: number, y: number, w: number, h: number): boolean {
    // Fare koordinatları canvas uzayına dönüştür.
    const rect = this.canvas.getBoundingClientRect();
    const cx = (mx - rect.left) * (CANVAS_W / rect.width);
    const cy = (my - rect.top) * (CANVAS_H / rect.height);
    return cx >= x && cx <= x + w && cy >= y && cy <= y + h;
  }

  private drawTempleBackdrop(c: CanvasRenderingContext2D): void {
    // Piramitler.
    c.fillStyle = "#c8a24a";
    c.beginPath();
    c.moveTo(100, GROUND);
    c.lineTo(260, 320);
    c.lineTo(420, GROUND);
    c.fill();
    c.beginPath();
    c.moveTo(760, GROUND);
    c.lineTo(1000, 200);
    c.lineTo(1240, GROUND);
    c.fill();
  }

  private drawTempleRoom(c: CanvasRenderingContext2D, room: (typeof ROOMS)[number]): void {
    const g = c.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, "#18293c");
    g.addColorStop(1, "#2c3d52");
    c.fillStyle = g;
    c.fillRect(0, 0, CANVAS_W, GROUND);
    // Sütunlar.
    c.fillStyle = "#3a4a5c";
    for (let x = 60; x < CANVAS_W - 60; x += 200) {
      c.fillRect(x, 180, 40, GROUND - 180);
      c.fillStyle = "#ffd24a";
      c.beginPath();
      c.moveTo(x - 10, 180);
      c.lineTo(x + 50, 180);
      c.lineTo(x + 20, 200);
      c.fill();
    }
    // Oda adı.
    c.fillStyle = "#ffd24a";
    c.font = "bold 34px Georgia";
    c.textAlign = "center";
    c.fillText(room.name, CANVAS_W / 2, 70);
  }

  private drawDoor(c: CanvasRenderingContext2D, x: number, open: boolean): void {
    const w = 40, h = 120;
    c.fillStyle = open ? "#37e8c0" : "#3a2a1a";
    c.fillRect(x, GROUND - h, w, h);
    c.fillStyle = "rgba(255,255,255,0.3)";
    c.fillRect(x, GROUND - h, w, 8);
    if (open) {
      c.fillStyle = "rgba(55,232,192,0.35)";
      c.fillRect(x - 10, GROUND - h - 10, w + 20, h + 10);
    }
  }

  private drawAnubis(c: CanvasRenderingContext2D, cx: number, cy: number, scale: number): void {
    c.save();
    c.translate(cx, cy);
    c.scale(scale, scale);
    // Vücut.
    c.fillStyle = "#2f2f35";
    c.fillRect(-26, -30, 52, 110);
    c.strokeStyle = "#111";
    c.lineWidth = 2;
    c.strokeRect(-26, -30, 52, 110);
    // Baş (çakal).
    c.fillStyle = "#2f2f35";
    c.beginPath();
    c.moveTo(-30, -60);
    c.lineTo(-46, -30);
    c.lineTo(-30, -10);
    c.lineTo(30, -10);
    c.lineTo(-30, -10); // düz
    c.closePath();
    c.fill();
    // Kulaklar.
    c.fillStyle = "#2f2f35";
    c.fillRect(-24, -92, 10, 34);
    c.fillRect(14, -92, 10, 34);
    // Gözler.
    c.fillStyle = "#ffd24a";
    c.beginPath();
    c.arc(-16, -40, 3, 0, Math.PI * 2);
    c.fill();
    // Mankaf kalp.
    c.fillStyle = "#ffd24a";
    c.beginPath();
    c.arc(0, -70, 10, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#2f2f35";
    c.font = "bold 14px Georgia";
    c.textAlign = "center";
    c.fillText("☥", 0, -65);
    c.restore();
  }

  private drawSymbol(c: CanvasRenderingContext2D, sym: string, x: number, y: number, size: number): void {
    c.fillStyle = "#d4af37";
    c.fillRect(x - size / 2, y - size / 2, size, size);
    c.strokeStyle = "#5a3c1a";
    c.lineWidth = 3;
    c.strokeRect(x - size / 2, y - size / 2, size, size);
    c.fillStyle = "#3a2a1a";
    c.font = `bold ${size * 0.5}px Georgia`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    const glyph = sym === "ankh" ? "☥" : sym === "eye" ? "⊕" : sym === "scarab" ? "❂" : "🦅";
    c.fillText(glyph, x, y);
    c.textBaseline = "alphabetic";
  }

  private drawCrystal(c: CanvasRenderingContext2D, x: number, y: number): void {
    c.fillStyle = "#7bed9f";
    c.beginPath();
    c.moveTo(x, y - 60);
    c.lineTo(x + 30, y);
    c.lineTo(x, y + 60);
    c.lineTo(x - 30, y);
    c.closePath();
    c.fill();
    c.strokeStyle = "#fff";
    c.lineWidth = 3;
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.font = "bold 30px Georgia";
    c.textAlign = "center";
    c.fillText("✧", x, y + 10);
  }
}

// Modeldeki global event hedefi — canvas üzerindeki tıklamalar için.
const canvasEvents: EventTarget = typeof window !== "undefined" ? window : new EventTarget();
