/**
 * Otuken Mahjong — Yerel Ses Motoru (Web Audio API Synthesizer).
 * Harici dosya gerektirmez, tamamen JavaScript ile sentezlenir.
 */

const MUTE_KEY = "otuken_mahjong_mute";

const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

// Autoplay fix: ilk etkileşimde ctx'i baslat
const unlock = () => {
  if (audioCtx.state === "suspended") audioCtx.resume();
  document.removeEventListener("click", unlock);
  document.removeEventListener("touchstart", unlock);
};
document.addEventListener("click", unlock, { once: true });
document.addEventListener("touchstart", unlock, { once: true });

let _muted = false;
try { _muted = localStorage.getItem(MUTE_KEY) === "1"; } catch { /* ignore */ }

function isMuted(): boolean { return _muted; }
function setMuted(v: boolean) {
  _muted = v;
  try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch { /* ignore */ }
}
function toggleMute(): boolean { setMuted(!_muted); return _muted; }

// ------------------------------------------------------------------
// 1. TAŞ ÇARPIŞMA SESİ — Tile Clack Synthesizer
//    İki katman: gürültü darbesi + kemik rezonans çınlaması
// ------------------------------------------------------------------
function playWoodClick(): void {
  if (_muted) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const t = audioCtx.currentTime;
  const humanize = () => 1 + (Math.random() * 0.10 - 0.05); // ±5%

  // ---- Katman 1: Noise Burst (Gürültü Darbesi) ----
  // 12ms beyaz gürültü → lowpass 1200Hz → çok hızlı sönümleme
  const bufLen = Math.floor(audioCtx.sampleRate * 0.015); // 15ms
  const noiseBuf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

  const noiseSrc = audioCtx.createBufferSource();
  noiseSrc.buffer = noiseBuf;

  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 1200 * humanize();
  noiseFilter.Q.value = 0.7;

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.75, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.012);

  noiseSrc.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);
  noiseSrc.start(t);
  noiseSrc.stop(t + 0.015);
  noiseSrc.onended = () => { noiseSrc.disconnect(); noiseFilter.disconnect(); noiseGain.disconnect(); };

  // ---- Katman 2: Resonance Click (Kemik Rezonans) ----
  // İki triangle osilatör: 1800Hz + 2400Hz, 30ms sönümleme
  for (const baseFreq of [1800, 2400]) {
    const osc = audioCtx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = baseFreq * humanize();

    const oscGain = audioCtx.createGain();
    oscGain.gain.setValueAtTime(0.18, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(oscGain);
    oscGain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.035);
    osc.onended = () => { osc.disconnect(); oscGain.disconnect(); };
  }
}

// ------------------------------------------------------------------
// 2. TAŞI ZEMİNE OTURTMA SESİ (Tok Pürüzsüz Vuruş)
// ------------------------------------------------------------------
function playPlace(): void {
  if (_muted) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(140, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.08);

  gain.gain.setValueAtTime(0.9, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.08);
}

// ------------------------------------------------------------------
// 3. ODA TAMAMLAMA / CİLA EFEKTİ (Yumuşak Ksilofon / Çan)
// ------------------------------------------------------------------
function playSuccess(): void {
  if (_muted) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const notes = [261.63, 329.63, 392.00, 523.25]; // C E G C
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.value = freq;

    const startTime = audioCtx.currentTime + i * 0.09;
    gain.gain.setValueAtTime(0.3, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.4);
  });
}

// ------------------------------------------------------------------
// 4. KOMBO SESİ (Yukselen ton)
// ------------------------------------------------------------------
function playCombo(level: number): void {
  if (_muted) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const freq = 440 * Math.pow(1.2, Math.min(level, 12));
  const t = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.12);

  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.16);
}

// ------------------------------------------------------------------
// 5. HATA SESİ (Tok sawtooth)
// ------------------------------------------------------------------
function playError(): void {
  if (_muted) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const t = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = 100;

  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.14, t);
  g.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.12);
}

// ------------------------------------------------------------------
// Geriye donuk uyumluluk: eski sfx() switch'ini destekler
// ------------------------------------------------------------------
function play(name: string, comboLevel?: number): void {
  switch (name) {
    case "pick":
    case "tileclick":
      playWoodClick();
      break;
    case "match":
      playWoodClick();
      break;
    case "combo":
      playCombo(comboLevel ?? 1);
      break;
    case "lose":
      playError();
      break;
    case "win":
      playSuccess();
      break;
    case "undo":
      playPlace();
      break;
    case "hint":
      playWoodClick();
      break;
    case "shuffle":
      playPlace();
      break;
  }
}

export const SoundEngine = {
  isMuted,
  setMuted,
  toggleMute,
  play,
  playWoodClick,
  playPlace,
  playSuccess,
  playCombo,
  playError,
};
