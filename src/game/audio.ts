/** Minimal WebAudio synth — no asset files needed. */
type SfxName = "draw" | "release" | "hit" | "miss" | "success";

let ctx: AudioContext | null = null;
let enabled = true;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.15, slideTo?: number) {
  const c = getCtx();
  if (!c || !enabled) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + dur);
}

function noise(dur: number, gain = 0.2) {
  const c = getCtx();
  if (!c || !enabled) return;
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, c.currentTime);
  src.connect(g).connect(c.destination);
  src.start();
}

export function playSfx(name: SfxName) {
  switch (name) {
    case "draw":
      tone(160, 0.25, "sawtooth", 0.05, 260);
      break;
    case "release":
      noise(0.18, 0.18);
      tone(520, 0.12, "triangle", 0.08, 180);
      break;
    case "hit":
      tone(240, 0.12, "square", 0.1, 90);
      noise(0.08, 0.1);
      break;
    case "miss":
      noise(0.12, 0.08);
      break;
    case "success":
      tone(523, 0.14, "triangle", 0.1);
      window.setTimeout(() => tone(784, 0.22, "triangle", 0.1), 130);
      break;
  }
}
