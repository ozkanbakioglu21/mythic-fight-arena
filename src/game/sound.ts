/**
 * Otuken Mahjong — Stüdyo Kalitesinde Ses Motoru.
 * Base64 WAV AudioBuffer ile sıfır gecikme, playback rate humanization.
 */
import { TILE_CLICK_WAV, TILE_MATCH_WAV, COMBO_WAV, ERROR_WAV, UNDO_WAV } from "./sounds-data";

const MUTE_KEY = "otuken_mahjong_mute";

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let _muted = false;
let _volume = 0.75; // 0..1
let buffers: Map<string, AudioBuffer[]> = new Map();

function ensureCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = _volume;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function ensureBuffers(): Map<string, AudioBuffer[]> {
  if (buffers.size > 0) return buffers;
  const ctx = ensureCtx();

  // Pre-decode all sounds
  const decodeAll = async (key: string, wavArr: string[]) => {
    const decoded: AudioBuffer[] = [];
    for (const wav of wavArr) {
      const base64 = wav.split(",")[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const ab = bytes.buffer;
      try {
        const audioBuf = await ctx.decodeAudioData(ab);
        decoded.push(audioBuf);
      } catch { /* skip bad buffer */ }
    }
    buffers.set(key, decoded);
  };

  // Fire all decode promises — they resolve before first user click typically
  decodeAll("tileclick", TILE_CLICK_WAV);
  decodeAll("match", TILE_MATCH_WAV);
  decodeAll("combo", COMBO_WAV);
  decodeAll("error", ERROR_WAV);
  decodeAll("undo", UNDO_WAV);

  return buffers;
}

function playBuffer(key: string, volumeScale = 1.0): void {
  if (_muted) return;
  const ctx = ensureCtx();
  const bufs = ensureBuffers().get(key);
  if (!bufs || bufs.length === 0) return;

  const buf = bufs[Math.floor(Math.random() * bufs.length)];
  const src = ctx.createBufferSource();
  src.buffer = buf;

  // Humanization: ±5% playback rate
  src.playbackRate.value = 0.95 + Math.random() * 0.10;

  const gain = ctx.createGain();
  gain.gain.value = volumeScale;

  src.connect(gain);
  gain.connect(masterGain!);
  src.start();

  // Auto-disconnect for polyphony
  src.onended = () => { src.disconnect(); gain.disconnect(); };
}

// ------------------------------------------------------------------
// Autoplay fix
// ------------------------------------------------------------------
const unlock = () => {
  ensureCtx();
  document.removeEventListener("click", unlock);
  document.removeEventListener("touchstart", unlock);
};
document.addEventListener("click", unlock, { once: true });
document.addEventListener("touchstart", unlock, { once: true });

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------
function isMuted(): boolean { return _muted; }

function setMuted(v: boolean) {
  _muted = v;
  try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch { /* ignore */ }
}

function toggleMute(): boolean { setMuted(!_muted); return _muted; }

function setVolume(v: number) {
  _volume = Math.max(0, Math.min(1, v));
  if (masterGain) masterGain.gain.value = _volume;
}

function getVolume(): number { return _volume; }

function play(name: string, comboLevel?: number): void {
  switch (name) {
    case "pick":
    case "tileclick":
      playBuffer("tileclick");
      break;
    case "match":
      playBuffer("match", 1.0);
      break;
    case "combo":
      playBuffer("combo", 0.7 + Math.min((comboLevel ?? 1) * 0.08, 0.3));
      break;
    case "lose":
      playBuffer("error");
      break;
    case "win":
      playBuffer("combo", 1.0);
      break;
    case "undo":
      playBuffer("undo");
      break;
    case "hint":
      playBuffer("tileclick", 0.6);
      break;
    case "shuffle":
      playBuffer("match", 0.5);
      break;
  }
}

// Load mute state from localStorage
try { _muted = localStorage.getItem(MUTE_KEY) === "1"; } catch { /* ignore */ }

export const SoundEngine = {
  isMuted,
  setMuted,
  toggleMute,
  play,
  setVolume,
  getVolume,
  ensureBuffers,
};
