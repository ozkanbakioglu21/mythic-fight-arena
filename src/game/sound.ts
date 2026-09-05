/**
 * Otuken Mahjong — Basit Ses Yoneticisi.
 * Preload + cloneNode ile aninda calma.
 */

const MUTE_KEY = "otuken_mahjong_mute";
const VOL_KEY = "otuken_mahjong_vol";
let _muted = false;
let _volume = 0.7;
try { _muted = localStorage.getItem(MUTE_KEY) === "1"; } catch {}
try { const v = parseFloat(localStorage.getItem(VOL_KEY) ?? ""); if (!isNaN(v) && v >= 0 && v <= 1) _volume = v; } catch {}

// Preloaded kaynaklar
const tileClickSound = new Audio("/assets/sounds/tile_click.mp3");
const tileBreakSound = new Audio("/assets/sounds/tile_break.mp3");
const comboSound     = new Audio("/assets/sounds/combo.mp3");
tileClickSound.preload = "auto";
tileBreakSound.preload = "auto";
comboSound.preload = "auto";

// Autoplay kilidini ac
const unlock = () => {
  const s = tileClickSound.cloneNode() as HTMLAudioElement;
  s.volume = 0;
  s.play().catch(() => {});
  document.removeEventListener("click", unlock);
  document.removeEventListener("touchstart", unlock);
};
document.addEventListener("click", unlock, { once: true });
document.addEventListener("touchstart", unlock, { once: true });

function playSound(base: HTMLAudioElement, volumeScale = 0.7): void {
  if (_muted) return;
  const s = base.cloneNode() as HTMLAudioElement;
  s.volume = Math.min(1, _volume * volumeScale);
  s.currentTime = 0;
  s.play().catch(() => {});
}

function playSfx(name: string, comboLevel?: number): void {
  switch (name) {
    case "pick":
    case "tileclick":
    case "hint":
      playSound(tileClickSound, 0.5);
      break;
    case "match":
      playSound(tileBreakSound, 0.8);
      break;
    case "combo":
      playSound(comboSound, Math.min(0.7 + (comboLevel ?? 1) * 0.08, 1));
      break;
    case "lose":
    case "error":
      playSound(tileBreakSound, 0.4);
      break;
    case "win":
      playSound(comboSound, 1.0);
      break;
    case "undo":
      playSound(tileClickSound, 0.3);
      break;
    case "shuffle":
      playSound(tileBreakSound, 0.3);
      break;
  }
}

export const SoundEngine = {
  isMuted: () => _muted,
  setMuted: (v: boolean) => { _muted = v; try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch {} },
  toggleMute: () => { _muted = !_muted; try { localStorage.setItem(MUTE_KEY, _muted ? "1" : "0"); } catch {} return _muted; },
  setVolume: (v: number) => { _volume = Math.max(0, Math.min(1, v)); try { localStorage.setItem(VOL_KEY, _volume.toString()); } catch {} },
  getVolume: () => _volume,
  play: playSfx,
};
