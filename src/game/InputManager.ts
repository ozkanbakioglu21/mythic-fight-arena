import {
  ACTION_PRIORITY,
  BufferedInput,
  InputAction,
  InputPriority,
} from "./types";

/**
 * InputManager — 6-frame input buffering ve öncelik sıralamasını yönetir.
 *
 * - Her frame oyuncudan gelen ham girdiyi 6 karelik tampona yazar.
 * - Tampondaki girdiler öncelik hiyerarşisine göre çözülür:
 *   Ultimate > Parry > Special > Heavy > Light > Movement.
 * - Movement girdileri birleşik yön vektörüne çevrilir.
 */
export class InputManager {
  /** Maksimum tampon ömrü (frame). */
  static readonly BUFFER_FRAMES = 6;

  private buffer: BufferedInput[] = [];
  /** Bu frame için oyuncu girdisi (booleans + yönlü eksenler). */
  private held = new Set<InputAction>();
  private moveX = 0;
  private moveY = 0;

  /** Yeni frame başlangıcında çağrılır: tampon yaşlandırma. */
  beginFrame(): void {
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      this.buffer[i].age++;
      if (this.buffer[i].age > InputManager.BUFFER_FRAMES) {
        this.buffer.splice(i, 1);
      }
    }
    this.moveX = 0;
    this.moveY = 0;
  }

  /** Realtime aktif basılı tuşları ilet (yönler, blok, dash). */
  setHeld(actions: Set<InputAction>, moveX: number, moveY: number): void {
    this.held = actions;
    this.moveX = moveX;
    this.moveY = moveY;
  }

  /** Anlık basılan aksiyon tuşu (light/heavy/special/parry/ultimate). */
  press(action: InputAction): void {
    this.buffer.push({
      action,
      age: 0,
      priority: ACTION_PRIORITY[action],
    });
    // Aynı frame içinde en düşük (en yüksek öncelikli) öne gelsin.
    this.buffer.sort((a, b) => a.priority - b.priority);
    if (this.buffer.length > InputManager.BUFFER_FRAMES * 2) {
      this.buffer.length = InputManager.BUFFER_FRAMES * 2;
    }
  }

  clear(): void {
    this.buffer.length = 0;
    this.held.clear();
  }

  getBuffered(): readonly BufferedInput[] {
    return this.buffer;
  }

  getMoveX(): number {
    return this.moveX;
  }

  getMoveY(): number {
    return this.moveY;
  }

  isHeld(action: InputAction): boolean {
    return this.held.has(action);
  }

  /**
   * En yüksek öncelikli ve geçerli girdiyi döndürür.
   * Movement tek başına buffer'da tutulmaz; yön vektörü ile ifade edilir.
   */
  resolveHighest(): {
    action: InputAction;
    priority: InputPriority;
  } | null {
    for (const entry of this.buffer) {
      if (entry.action === InputAction.ULTIMATE) return entry;
      if (entry.action === InputAction.PARRY) return entry;
      if (entry.action === InputAction.SPECIAL) return entry;
      if (entry.action === InputAction.HEAVY) return entry;
      if (entry.action === InputAction.LIGHT) return entry;
    }
    return null;
  }

  /** Verilen aksiyonun tamponda olup olmadığını kontrol eder (ve isteğe bağlı tüketir). */
  consume(action: InputAction, consume = true): boolean {
    const idx = this.buffer.findIndex((e) => e.action === action);
    if (idx === -1) return false;
    if (consume) this.buffer.splice(idx, 1);
    return true;
  }
}
