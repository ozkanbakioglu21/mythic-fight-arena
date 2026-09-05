/**
 * Otuken Mahjong — Basit Ses Motoru (HTML5 Audio).
 * CDN/yerel MP3 dosyaları, preload + cloneNode pooling.
 */

const MUTE_KEY = "otuken_mahjong_mute";
const VOL_KEY = "otuken_mahjong_vol";

// MP3 dosya yollari (public/sfx/ altinda)
const SFX_BASE = "/sfx";
const SFX = {
  click:  `${SFX_BASE}/click.wav`,
  match:  `${SFX_BASE}/match.wav`,
  combo:  `${SFX_BASE}/combo.wav`,
  error:  `${SFX_BASE}/error.wav`,
  undo:   `${SFX_BASE}/undo.wav`,
  win:    `${SFX_BASE}/win.wav`,
} as const;

// Preloaded Audio havuzu
const pool: Map<string, HTMLAudioElement[]> = new Map();
const sources: Record<string, HTMLAudioElement> = {};

let _muted = false;
let _volume = 0.6;

// localStorage'dan mute/volume oku
try { _muted = localStorage.getItem(MUTE_KEY) === "1"; } catch {}
try {
  const v = parseFloat(localStorage.getItem(VOL_KEY) ?? "");
  if (!isNaN(v) && v >= 0 && v <= 1) _volume = v;
} catch {}

/** Tek bir ses dosyasini preload eder. */
function preload(key: string, url: string): HTMLAudioElement {
  const a = new Audio(url);
  a.preload = "auto";
  a.load();
  sources[key] = a;
  pool.set(key, []);
  return a;
}

/** Tum sesleri onceden yukle. */
function init(): void {
  for (const [key, url] of Object.entries(SFX)) {
    preload(key, url);
  }
}

/** Pool'dan bos bir Audio klonu al veya yeniden olustur. */
function borrow(key: string): HTMLAudioElement {
  const p = pool.get(key);
  if (p && p.length > 0) return p.pop()!;
  // Kaynak yoksa orijinali klonla
  const src = sources[key];
  if (!src) return new Audio();
  const clone = src.cloneNode(true) as HTMLAudioElement;
  return clone;
}

/** Kullanilan Audio'yu pool'a iade et (onended ile). */
function release(key: string, el: HTMLAudioElement): void {
  el.onended = null;
  el.onerror = null;
  const p = pool.get(key);
  if (p && p.length < 4) p.push(el); // max 4 havuzda tut
}

/** Temel caldirma fonksiyonu. */
function play(key: string, volumeScale = 1.0): void {
  if (_muted) return;
  const el = borrow(key);
  el.volume = Math.min(1, _volume * volumeScale);
  el.currentTime = 0;

  el.onended = () => release(key, el);
  el.onerror = () => release(key, el);

  el.play().catch(() => {
    // Autoplay restriction: sessizce yut
    release(key, el);
  });
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------
function isMuted(): boolean { return _muted; }

function setMuted(v: boolean) {
  _muted = v;
  try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch {}
}

function toggleMute(): boolean {
  setMuted(!_muted);
  return _muted;
}

function setVolume(v: number) {
  _volume = Math.max(0, Math.min(1, v));
  try { localStorage.setItem(VOL_KEY, _volume.toString()); } catch {}
}

function getVolume(): number { return _volume; }

function playSfx(name: string, comboLevel?: number): void {
  switch (name) {
    case "pick":
    case "tileclick":
    case "hint":
      play("click");
      break;
    case "match":
      play("match");
      break;
    case "combo":
      play("combo", 0.7 + Math.min((comboLevel ?? 1) * 0.08, 0.3));
      break;
    case "lose":
    case "error":
      play("error");
      break;
    case "win":
      play("win");
      break;
    case "undo":
      play("undo");
      break;
    case "shuffle":
      play("match", 0.5);
      break;
  }
}

export const SoundEngine = {
  init,
  isMuted,
  setMuted,
  toggleMute,
  setVolume,
  getVolume,
  play: playSfx,
};
