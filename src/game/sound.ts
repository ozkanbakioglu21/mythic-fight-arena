/**
 * Otuken Mahjong — Basit Ses Yoneticisi.
 * Her cagrimda yeni Audio() olustur, play().catch() ile engelleri yut.
 */

const MUTE_KEY = "otuken_mahjong_mute";
const VOL_KEY = "otuken_mahjong_vol";
let _muted = false;
let _volume = 0.7;
try { _muted = localStorage.getItem(MUTE_KEY) === "1"; } catch {}
try { const v = parseFloat(localStorage.getItem(VOL_KEY) ?? ""); if (!isNaN(v) && v >= 0 && v <= 1) _volume = v; } catch {}

// Autoplay kilidini ac: ilk click/touch'ta bos bir ses cal
const unlock = () => {
  const silent = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAgAQAAAAZGF0YQ==");
  silent.volume = 0;
  silent.play().catch(() => {});
  document.removeEventListener("click", unlock);
  document.removeEventListener("touchstart", unlock);
};
document.addEventListener("click", unlock, { once: true });
document.addEventListener("touchstart", unlock, { once: true });

// Ses dosyalari yollari
const SFX = {
  tileClick: "/assets/sounds/tile_click.mp3",
  tileBreak: "/assets/sounds/tile_break.mp3",
  combo:     "/assets/sounds/combo.mp3",
};

function playSound(path: string, volumeScale = 0.7): void {
  if (_muted) return;
  const sound = new Audio(path);
  sound.volume = Math.min(1, _volume * volumeScale);
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

function playSfx(name: string, comboLevel?: number): void {
  switch (name) {
    case "pick":
    case "tileclick":
    case "hint":
      playSound(SFX.tileClick, 0.5);
      break;
    case "match":
      playSound(SFX.tileBreak, 0.8);
      break;
    case "combo":
      playSound(SFX.combo, Math.min(0.7 + (comboLevel ?? 1) * 0.08, 1));
      break;
    case "lose":
    case "error":
      playSound(SFX.tileBreak, 0.4);
      break;
    case "win":
      playSound(SFX.combo, 1.0);
      break;
    case "undo":
      playSound(SFX.tileClick, 0.3);
      break;
    case "shuffle":
      playSound(SFX.tileBreak, 0.3);
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
