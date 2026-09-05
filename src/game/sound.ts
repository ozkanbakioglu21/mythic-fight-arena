/**
 * Otuken Mahjong — Basit Ses Motoru (HTML5 Audio).
 * Preload + cloneNode ile sıfır gecikme, havuz yok.
 */

const MUTE_KEY = "otuken_mahjong_mute";
const VOL_KEY = "otuken_mahjong_vol";

let _muted = false;
let _volume = 0.6;

try { _muted = localStorage.getItem(MUTE_KEY) === "1"; } catch {}
try {
  const v = parseFloat(localStorage.getItem(VOL_KEY) ?? "");
  if (!isNaN(v) && v >= 0 && v <= 1) _volume = v;
} catch {}

// Preloaded kaynaklar
const clickSound = new Audio("/sfx/click.wav");  clickSound.preload = "auto";
const matchSound = new Audio("/sfx/match.wav");  matchSound.preload = "auto";
const comboSound = new Audio("/sfx/combo.wav");  comboSound.preload = "auto";
const errorSound = new Audio("/sfx/error.wav");  errorSound.preload = "auto";
const undoSound  = new Audio("/sfx/undo.wav");   undoSound.preload  = "auto";
const winSound   = new Audio("/sfx/win.wav");    winSound.preload   = "auto";

function playClick() {
  if (_muted) return;
  const s = clickSound.cloneNode() as HTMLAudioElement;
  s.volume = _volume * 0.6;
  s.play().catch(() => {});
}

function playMatch() {
  if (_muted) return;
  const s = matchSound.cloneNode() as HTMLAudioElement;
  s.volume = _volume;
  s.play().catch(() => {});
}

function playCombo(level = 1) {
  if (_muted) return;
  const s = comboSound.cloneNode() as HTMLAudioElement;
  s.volume = _volume * Math.min(0.7 + level * 0.08, 1);
  s.play().catch(() => {});
}

function playError() {
  if (_muted) return;
  const s = errorSound.cloneNode() as HTMLAudioElement;
  s.volume = _volume;
  s.play().catch(() => {});
}

function playUndo() {
  if (_muted) return;
  const s = undoSound.cloneNode() as HTMLAudioElement;
  s.volume = _volume;
  s.play().catch(() => {});
}

function playWin() {
  if (_muted) return;
  const s = winSound.cloneNode() as HTMLAudioElement;
  s.volume = _volume;
  s.play().catch(() => {});
}

function playSfx(name: string, comboLevel?: number): void {
  switch (name) {
    case "pick":
    case "tileclick":
    case "hint":
      playClick(); break;
    case "match":
      playMatch(); break;
    case "combo":
      playCombo(comboLevel); break;
    case "lose":
    case "error":
      playError(); break;
    case "win":
      playWin(); break;
    case "undo":
      playUndo(); break;
    case "shuffle":
      playMatch(); break;
  }
}

function isMuted(): boolean { return _muted; }

function setMuted(v: boolean) {
  _muted = v;
  try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch {}
}

function toggleMute(): boolean { setMuted(!_muted); return _muted; }

function setVolume(v: number) {
  _volume = Math.max(0, Math.min(1, v));
  try { localStorage.setItem(VOL_KEY, _volume.toString()); } catch {}
}

function getVolume(): number { return _volume; }

export const SoundEngine = {
  isMuted,
  setMuted,
  toggleMute,
  setVolume,
  getVolume,
  play: playSfx,
};
