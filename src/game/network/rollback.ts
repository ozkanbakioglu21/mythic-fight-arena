import { Fighter, FighterSnapshot } from "../Fighter";

/**
 * RollbackNetcode — PvP modu için gecikme dayanıklı ağ simülasyonu altyapısı.
 *
 * Gerçek bir rollback sisteminin temel ilkelerini modeller:
 * - Her oyuncu girdisini zamansal bir kuyrukta (ring buffer) iletir.
 * - Bir giriş geciktiğinde, geçmiş frame'ler kaydedilen state'lerden
 *   geri yüklenerek (rollback) yeniden simüle edilir (input correction).
 *
 * Tam WAN uygulaması WebRTC/UDP soketleri gerektirir; bu sınıf deterministik
 * simülasyon ve state kayıt/geri yükleme çekirdeğini sağlar.
 */

export interface NetInput {
  frame: number;
  input: string; // normalize edilmiş girdi özeti
}

export interface FrameState {
  frame: number;
  states: FighterSnapshot[]; // oyuncu snapshot'ları
}

export class RollbackNetcode {
  /** Saklanacak maksimum geçmiş frame sayısı. */
  static readonly HISTORY_LEN = 7;

  private frame = 0;
  private history: FrameState[] = [];
  private inputQueue: NetInput[] = [];
  private simulatedLatency = 2; // frame cinsinden yapay gecikme

  constructor(private fighters: Fighter[]) {}

  /** Uzak rakibin girdisini kuyruğa ekler (ağ paketi). */
  receiveRemoteInput(input: NetInput): void {
    this.inputQueue.push(input);
  }

  /** Yapay gecikmeyi ayarlar (test / demo). */
  setLatency(frames: number): void {
    this.simulatedLatency = Math.max(0, frames);
  }

  /**
   * Her frame'de çağrılır. Girdi kuyruğundan "varmış" girişi işler;
   * deterministik simülasyonda adımı atar. Geçmişteki bir giriş gerçekleşirse
   * o frame'e geri dönüp yeniden simüle eder.
   */
  step(currentInput: NetInput): void {
    const now = this.frame + 1;
    // Kendi girdimizi enqueue et.
    this.inputQueue.push(currentInput);

    // Gecikmeli işle: yalnızca vadesi gelmiş girişleri uygula.
    const due = this.inputQueue.filter((i) => i.frame + this.simulatedLatency <= now);
    const stale = this.inputQueue.filter((i) => i.frame + this.simulatedLatency > now);

    // En eski state'i al ya da ilk kez boş başlat.
    const baseFrame = this.history.length
      ? this.history[0].frame
      : 0;

    // Rollback tespiti: gelen giriş zaten simüle edilmiş bir frame'e aitse.
    let needRollback = due.some((i) => this.appliedFrames.has(i.frame));
    let targetFrame = Math.min(...due.map((i) => i.frame), baseFrame);

    if (needRollback && this.history.length) {
      // O frame'in state'ine dön, sonra ileri simüle et.
      const toReplay = this.history.filter((h) => h.frame >= targetFrame);
      for (const h of toReplay) {
        this.restore(h);
      }
    }

    // Belirlenen frame'den itibaren simülasyonu oynat.
    const startFrame = Math.max(targetFrame, this.frameHistoryEnd());
    for (let f = startFrame; f < now; f++) {
      this.simulate(f);
    }

    this.inputQueue.length = 0;
    this.inputQueue.push(...stale);
    this.frame = now - 1;
  }

  private appliedFrames = new Set<number>();
  private frameHistoryEnd(): number {
    return this.history.length ? this.history[this.history.length - 1].frame + 1 : 0;
  }

  private simulate(frame: number): void {
    this.appliedFrames.add(frame);
    // Not: Gerçek simülasyon adımı Battle.dir'de yapılır; burada state kaydı.
    const states = this.fighters.map((f) => f.snapshot());
    this.history.push({ frame, states });
    if (this.history.length > RollbackNetcode.HISTORY_LEN) {
      this.history.shift();
    }
  }

  private restore(state: FrameState): void {
    state.states.forEach((s, i) => {
      this.fighters[i].applySnapshot(s);
    });
  }

  getFrame(): number {
    return this.frame;
  }

  reset(): void {
    this.history.length = 0;
    this.inputQueue.length = 0;
    this.appliedFrames.clear();
    this.frame = 0;
  }
}
