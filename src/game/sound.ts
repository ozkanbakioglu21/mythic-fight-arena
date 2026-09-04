/**
 * Otuken Mahjong — Yerel Ses Motoru (Web Audio API Synthesizer).
 * Harici dosya gerektirmez, tamamen JavaScript ile sentezlenir.
 */

const MUTE_KEY = "otuken_mahjong_mute";

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private _muted = false;

  /** Autoplay fix: ilk etkileşimde ctx'i baslatir. */
  private ensureCtx(): AudioContext | null {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  constructor() {
    // Mute tercihini yukle
    try {
      this._muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch { /* ignore */ }

    // Autoplay fix: ilk click/touch'ta ctx'i hazirla
    const unlock = () => {
      this.ensureCtx();
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("touchstart", unlock, { once: true });
  }

  get muted(): boolean { return this._muted; }

  set muted(v: boolean) {
    this._muted = v;
    try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch { /* ignore */ }
  }

  toggleMute(): boolean {
    this.muted = !this._muted;
    return this._muted;
  }

  // ------------------------------------------------------------------
  // 1) Ahşap Tıkırtısı: 150→40Hz sinüs/triangle, 0.05sn decay
  // ------------------------------------------------------------------
  playWoodClick(): void {
    if (this._muted) return;
    const ac = this.ensureCtx();
    if (!ac) return;
    const t = ac.currentTime;

    const osc = ac.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.05);

    const g = ac.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);

    osc.connect(g);
    g.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.07);

    // Ahşap tınısı için kısa gürültü katmanı
    const len = Math.floor(ac.sampleRate * 0.02);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 800;
    bp.Q.value = 0.5;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.12, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(ac.destination);
    src.start(t);
  }

  // ------------------------------------------------------------------
  // 2) Eşleşme Tınısı: Pentatonik çift ton (C5+E5), 0.4sn rezonans
  // ------------------------------------------------------------------
  playMatchSuccess(): void {
    if (this._muted) return;
    const ac = this.ensureCtx();
    if (!ac) return;
    const t = ac.currentTime;

    // C5 (523.25 Hz) + E5 (659.25 Hz) — pentatonik harmoni
    const freqs = [523.25, 659.25];
    for (const f of freqs) {
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;

      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.15, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.08, t + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

      osc.connect(g);
      g.connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.42);
    }

    // Üst harmonik: G5 (783.99 Hz) — zenginlik
    const osc3 = ac.createOscillator();
    osc3.type = "sine";
    osc3.frequency.value = 783.99;
    const g3 = ac.createGain();
    g3.gain.setValueAtTime(0.0001, t);
    g3.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
    g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc3.connect(g3);
    g3.connect(ac.destination);
    osc3.start(t);
    osc3.stop(t + 0.32);

    // Yankı: filtrelenmiş gürültü
    const resLen = Math.floor(ac.sampleRate * 0.5);
    const resBuf = ac.createBuffer(1, resLen, ac.sampleRate);
    const resD = resBuf.getChannelData(0);
    for (let i = 0; i < resLen; i++) {
      resD[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / resLen, 4);
    }
    const resSrc = ac.createBufferSource();
    resSrc.buffer = resBuf;
    const resBp = ac.createBiquadFilter();
    resBp.type = "bandpass";
    resBp.frequency.value = 600;
    resBp.Q.value = 3;
    const resG = ac.createGain();
    resG.gain.setValueAtTime(0.04, t + 0.05);
    resG.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    resSrc.connect(resBp);
    resBp.connect(resG);
    resG.connect(ac.destination);
    resSrc.start(t + 0.05);
  }

  // ------------------------------------------------------------------
  // 3) Kombo Sesi: 440 × 1.2^level Hz, yükselen tonlu enerjik bitiş
  // ------------------------------------------------------------------
  playComboSound(level: number): void {
    if (this._muted) return;
    const ac = this.ensureCtx();
    if (!ac) return;
    const t = ac.currentTime;

    const baseFreq = 440 * Math.pow(1.2, Math.min(level, 12));
    const dur = 0.12 + level * 0.01;

    // Ana ton: yükselen frekans
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + dur);

    const g = ac.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);

    osc.connect(g);
    g.connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.06);

    // Üst harmonik: enerjik bitiş
    const osc2 = ac.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(baseFreq * 2, t + dur * 0.5);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 3, t + dur);

    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0.0001, t + dur * 0.5);
    g2.gain.exponentialRampToValueAtTime(0.08, t + dur * 0.7);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);

    osc2.connect(g2);
    g2.connect(ac.destination);
    osc2.start(t + dur * 0.5);
    osc2.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------------
  // 4) Hata Sesi: 100Hz sawtooth, 0.1sn tok titreşim
  // ------------------------------------------------------------------
  playErrorSound(): void {
    if (this._muted) return;
    const ac = this.ensureCtx();
    if (!ac) return;
    const t = ac.currentTime;

    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 100;

    const g = ac.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);

    osc.connect(g);
    g.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.12);

    // Alt harmonik: tokluk
    const osc2 = ac.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 60;
    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0.08, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc2.connect(g2);
    g2.connect(ac.destination);
    osc2.start(t);
    osc2.stop(t + 0.12);
  }

  // ------------------------------------------------------------------
  // Ek: Mermer carpma (konusma/ses motoru entegrasyonu icin)
  // ------------------------------------------------------------------
  playMarbleHit(): void {
    if (this._muted) return;
    const ac = this.ensureCtx();
    if (!ac) return;
    const t = ac.currentTime;

    // Sert carpma: yuksek frekansli gurultu
    const len = Math.floor(ac.sampleRate * 0.025);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 5);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3200;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    src.connect(hp);
    hp.connect(g);
    g.connect(ac.destination);
    src.start(t);

    // Tını
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2200, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.06);
    const og = ac.createGain();
    og.gain.setValueAtTime(0.12, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    osc.connect(og);
    og.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  /** Mermer kirilma sesi: cok katmanli, yuksek frekansli. */
  playMarbleBreak(): void {
    if (this._muted) return;
    const ac = this.ensureCtx();
    if (!ac) return;
    const t = ac.currentTime;

    // 1) Sert carpma
    const impactLen = Math.floor(ac.sampleRate * 0.025);
    const impactBuf = ac.createBuffer(1, impactLen, ac.sampleRate);
    const impactD = impactBuf.getChannelData(0);
    for (let i = 0; i < impactLen; i++) {
      impactD[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impactLen, 5);
    }
    const impactSrc = ac.createBufferSource();
    impactSrc.buffer = impactBuf;
    const impactHp = ac.createBiquadFilter();
    impactHp.type = "highpass";
    impactHp.frequency.value = 3200;
    const impactG = ac.createGain();
    impactG.gain.setValueAtTime(0.4, t);
    impactG.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    impactSrc.connect(impactHp);
    impactHp.connect(impactG);
    impactG.connect(ac.destination);
    impactSrc.start(t);

    // 2) Cam catirtisi: 3 square darbe
    for (let i = 0; i < 3; i++) {
      const delay = i * 0.018;
      const osc = ac.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(2400 - i * 400, t + delay);
      osc.frequency.exponentialRampToValueAtTime(800, t + delay + 0.025);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.14 - i * 0.03, t + delay);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.03);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.04);
    }

    // 3) Govde kirilmasi
    const bodyLen = Math.floor(ac.sampleRate * 0.1);
    const bodyBuf = ac.createBuffer(1, bodyLen, ac.sampleRate);
    const bodyD = bodyBuf.getChannelData(0);
    for (let i = 0; i < bodyLen; i++) {
      bodyD[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bodyLen, 2.5);
    }
    const bodySrc = ac.createBufferSource();
    bodySrc.buffer = bodyBuf;
    const bodyBp = ac.createBiquadFilter();
    bodyBp.type = "bandpass";
    bodyBp.frequency.setValueAtTime(2800, t + 0.01);
    bodyBp.frequency.exponentialRampToValueAtTime(900, t + 0.1);
    bodyBp.Q.value = 1.2;
    const bodyG = ac.createGain();
    bodyG.gain.setValueAtTime(0.2, t + 0.01);
    bodyG.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    bodySrc.connect(bodyBp);
    bodyBp.connect(bodyG);
    bodyG.connect(ac.destination);
    bodySrc.start(t + 0.01);

    const osc2 = ac.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1600, t + 0.01);
    osc2.frequency.exponentialRampToValueAtTime(400, t + 0.12);
    const osc2G = ac.createGain();
    osc2G.gain.setValueAtTime(0.1, t + 0.01);
    osc2G.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc2.connect(osc2G);
    osc2G.connect(ac.destination);
    osc2.start(t + 0.01);
    osc2.stop(t + 0.15);

    // 4) Rezonans
    const resLen = Math.floor(ac.sampleRate * 0.35);
    const resBuf = ac.createBuffer(1, resLen, ac.sampleRate);
    const resD = resBuf.getChannelData(0);
    for (let i = 0; i < resLen; i++) {
      resD[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / resLen, 2);
    }
    const resSrc = ac.createBufferSource();
    resSrc.buffer = resBuf;
    const resBp = ac.createBiquadFilter();
    resBp.type = "bandpass";
    resBp.frequency.value = 1800;
    resBp.Q.value = 3.5;
    const resG = ac.createGain();
    resG.gain.setValueAtTime(0.06, t + 0.03);
    resG.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    resSrc.connect(resBp);
    resBp.connect(resG);
    resG.connect(ac.destination);
    resSrc.start(t + 0.03);

    // 5) Parca sacilmasi
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this._marbleScatter(0.2 - i * 0.035), (40 + i * 55));
    }
  }

  private _marbleScatter(vol: number): void {
    if (this._muted || !this.ctx) return;
    const ac = this.ctx;
    const t = ac.currentTime;
    const len = Math.floor(ac.sampleRate * 0.03);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2800 + Math.random() * 1200;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    src.connect(hp);
    hp.connect(g);
    g.connect(ac.destination);
    src.start();
  }

  // ------------------------------------------------------------------
  // Geriye donuk uyumluluk: eski sfx() switch'ini destekler
  // ------------------------------------------------------------------
  play(name: string, comboLevel?: number): void {
    switch (name) {
      case "pick":
      case "tileclick":
        this.playWoodClick();
        break;
      case "match":
        this.playMarbleBreak();
        break;
      case "combo":
        this.playComboSound(comboLevel ?? 1);
        break;
      case "lose":
        this.playErrorSound();
        break;
      case "win":
        this._playWin();
        break;
      case "undo":
        this._playUndo();
        break;
      case "hint":
        this._playHint();
        break;
      case "shuffle":
        this._playShuffle();
        break;
    }
  }

  private _playWin(): void {
    if (this._muted) return;
    const ac = this.ensureCtx();
    if (!ac) return;
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => {
      setTimeout(() => {
        const t = ac.currentTime;
        const osc = ac.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = f;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        osc.connect(g);
        g.connect(ac.destination);
        osc.start(t);
        osc.stop(t + 0.3);
      }, i * 110);
    });
  }

  private _playUndo(): void {
    if (this._muted) return;
    const ac = this.ensureCtx();
    if (!ac) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.14);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  private _playHint(): void {
    if (this._muted) return;
    const ac = this.ensureCtx();
    if (!ac) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1240, t + 0.12);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  private _playShuffle(): void {
    if (this._muted) return;
    const ac = this.ensureCtx();
    if (!ac) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.16);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.18);
    setTimeout(() => {
      const t2 = ac.currentTime;
      const osc2 = ac.createOscillator();
      osc2.type = "sawtooth";
      osc2.frequency.value = 230;
      const g2 = ac.createGain();
      g2.gain.setValueAtTime(0.08, t2);
      g2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.12);
      osc2.connect(g2);
      g2.connect(ac.destination);
      osc2.start(t2);
      osc2.stop(t2 + 0.14);
    }, 120);
  }
}
