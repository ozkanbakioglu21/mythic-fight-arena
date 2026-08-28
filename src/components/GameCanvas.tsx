import { useCallback, useEffect, useRef, useState } from "react";
import { LEVELS, TOTAL_LEVELS, type LevelConfig } from "@/game/levels";
import {
  createArrow,
  solveSpeedForTarget,
  predictPath,
  randomWind,
  stepArrow,
  type Arrow,
} from "@/game/physics";
import { createTarget, evaluateHit, stepTarget, type Target } from "@/game/targets";
import { playSfx } from "@/game/audio";

export interface RoundResult {
  levelIndex: number;
  score: number;
  shots: number;
  hits: number;
  cleared: boolean;
}

interface Props {
  levelIndex: number; // 0-based
  showTrajectory: boolean;
  onFinish: (r: RoundResult) => void;
  onExit: () => void;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
}

const BASE_W = 1200;
const BASE_H = 675;

export function GameCanvas({ levelIndex, showTrajectory, onFinish, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const level: LevelConfig = LEVELS[Math.min(levelIndex, TOTAL_LEVELS - 1)] as LevelConfig;

  const [hud, setHud] = useState({
    score: 0,
    shots: 0,
    hits: 0,
    arrowsLeft: level.arrows,
    wind: 0,
    power: 0,
    drawing: false,
    message: "",
  });

  const state = useRef({
    target: null as Target | null,
    arrows: [] as Arrow[],
    floaters: [] as Floater[],
    aim: { x: BASE_W * 0.6, y: BASE_H * 0.4 },
    drawing: false,
    drawStart: 0,
    power: 0,
    wind: 0,
    score: 0,
    shots: 0,
    hits: 0,
    arrowsLeft: level.arrows,
    finished: false,
    bowRecoil: 0,
    time: 0,
  });

  const origin = { x: 150, y: BASE_H - 210 };
  const groundY = BASE_H - 120;

  const finish = useCallback(() => {
    const s = state.current;
    if (s.finished) return;
    s.finished = true;
    playSfx(s.hits > 0 ? "success" : "miss");
    onFinish({
      levelIndex,
      score: s.score,
      shots: s.shots,
      hits: s.hits,
      cleared: s.hits >= Math.ceil(level.arrows / 2),
    });
  }, [levelIndex, level.arrows, onFinish]);

  useEffect(() => {
    const s = state.current;
    s.target = createTarget(level, BASE_W, groundY);
    s.arrows = [];
    s.floaters = [];
    s.score = 0;
    s.shots = 0;
    s.hits = 0;
    s.arrowsLeft = level.arrows;
    s.finished = false;
    s.wind = randomWind(level.windMax);
    setHud((h) => ({
      ...h,
      score: 0,
      shots: 0,
      hits: 0,
      arrowsLeft: level.arrows,
      wind: s.wind,
      message: "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelIndex]);

  // ---- input ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toLocal = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((clientX - r.left) / r.width) * BASE_W,
        y: ((clientY - r.top) / r.height) * BASE_H,
      };
    };

    const down = (x: number, y: number) => {
      const s = state.current;
      if (s.finished || s.arrowsLeft <= 0) return;
      s.aim = toLocal(x, y);
      s.drawing = true;
      s.drawStart = performance.now();
      playSfx("draw");
    };
    const move = (x: number, y: number) => {
      state.current.aim = toLocal(x, y);
    };
    const up = () => {
      const s = state.current;
      if (!s.drawing) return;
      s.drawing = false;
      const angle = Math.atan2(s.aim.y - origin.y, s.aim.x - origin.x);
      const base = s.target
        ? solveSpeedForTarget(origin, angle, { x: s.target.x, y: s.target.y })
        : null;
      s.arrows.push(createArrow(origin, angle, Math.max(0.15, s.power), base ?? undefined));
      s.shots += 1;
      s.arrowsLeft -= 1;
      s.bowRecoil = 1;
      s.power = 0;
      playSfx("release");
      setHud((h) => ({ ...h, shots: s.shots, arrowsLeft: s.arrowsLeft, drawing: false, power: 0 }));
    };

    const onMouseDown = (e: MouseEvent) => down(e.clientX, e.clientY);
    const onMouseMove = (e: MouseEvent) => move(e.clientX, e.clientY);
    const onMouseUp = () => up();
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) down(t.clientX, t.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) move(t.clientX, t.clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      up();
    };

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [origin.x, origin.y]);

  // ---- loop ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let hudTick = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = BASE_W * dpr;
      canvas.height = BASE_H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const s = state.current;
      s.time += dt;

      if (s.drawing) s.power = Math.min(1, (now - s.drawStart) / 1100);
      if (s.bowRecoil > 0) s.bowRecoil = Math.max(0, s.bowRecoil - dt * 4);
      if (s.target) stepTarget(s.target, dt);

      for (const a of s.arrows) {
        if (!a.alive || a.stuck) continue;
        stepArrow(a, dt, s.wind);
        if (s.target) {
          const t = s.target;
          // hit test on the target face plane (x = t.x), not the outer circle edge
          if (a.prev.x < t.x && a.pos.x >= t.x) {
            const dx = a.pos.x - a.prev.x;
            const k = dx === 0 ? 0 : (t.x - a.prev.x) / dx;
            const hitY = a.prev.y + (a.pos.y - a.prev.y) * k;
            if (Math.abs(hitY - t.y) <= t.radius) {
              const res = evaluateHit(t, t.x, hitY);
              a.stuck = true;
              a.pos.x = t.x;
              a.pos.y = hitY;
              if (res.score > 0) {
                s.score += res.score;
                s.hits += 1;
                playSfx("hit");
                s.floaters.push({ x: t.x, y: t.y - t.radius - 10, text: `+${res.score} ${res.label}`, life: 1.4 });
              } else {
                playSfx("miss");
              }
              setHud((h) => ({ ...h, score: s.score, hits: s.hits, message: res.label }));
            }
          }
        }

        if (a.pos.y >= groundY) {
          a.pos.y = groundY;
          a.stuck = true;
          playSfx("miss");
          s.floaters.push({ x: a.pos.x, y: groundY - 30, text: "Iska", life: 1 });
          setHud((h) => ({ ...h, message: "Iskaladın" }));
        }
        if (a.pos.x > BASE_W + 100 || a.life > 12) a.alive = false;
      }

      s.floaters = s.floaters.filter((f) => (f.life -= dt) > 0);

      const settled =
        s.arrowsLeft <= 0 && s.arrows.every((a) => a.stuck || !a.alive) && !s.finished;
      if (settled) window.setTimeout(finish, 700);

      draw(ctx, s, level, origin, groundY, showTrajectory);

      hudTick += dt;
      if (s.drawing && hudTick > 0.05) {
        hudTick = 0;
        setHud((h) => ({ ...h, power: s.power, drawing: true }));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [level, showTrajectory, finish, origin.x, origin.y]);

  const accuracy = hud.shots ? Math.round((hud.hits / hud.shots) * 100) : 0;

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        className="w-full rounded-xl border border-border shadow-deep touch-none select-none"
        style={{ aspectRatio: `${BASE_W} / ${BASE_H}` }}
      />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-lg bg-surface/85 px-3 py-2 text-xs backdrop-blur sm:text-sm">
            <div className="font-display tracking-wide text-accent">{level.name}</div>
            <div className="text-foreground">Skor: {hud.score}</div>
            <div className="text-muted-foreground">
              Ok: {hud.arrowsLeft}/{level.arrows} · İsabet: %{accuracy}
            </div>
          </div>
          <div className="rounded-lg bg-surface/85 px-3 py-2 text-right text-xs backdrop-blur sm:text-sm">
            <div className="text-muted-foreground">Rüzgar</div>
            <div className="font-display text-accent">
              {hud.wind === 0 ? "Sakin" : `${Math.abs(hud.wind).toFixed(1)} m/s ${hud.wind > 0 ? "→" : "←"}`}
            </div>
            <div className="text-muted-foreground">{level.distanceMeters} m</div>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <button
            onClick={onExit}
            className="pointer-events-auto rounded-md border border-border bg-surface/85 px-3 py-1.5 text-xs text-foreground backdrop-blur transition-colors hover:bg-surface sm:text-sm"
          >
            Ana Menü
          </button>
          <div className="w-40 sm:w-64">
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Tam isabet: orta güç</span>
              <span>Güç</span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-surface/85">
              <div
                className="h-full rounded-full bg-gradient-power transition-[width] duration-75"
                style={{ width: `${Math.round(hud.power * 100)}%` }}
              />
              <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-foreground/70" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ---------------- rendering ---------------- */

type S = {
  target: Target | null;
  arrows: Arrow[];
  floaters: Floater[];
  aim: { x: number; y: number };
  drawing: boolean;
  power: number;
  wind: number;
  bowRecoil: number;
  time: number;
};

function draw(
  ctx: CanvasRenderingContext2D,
  s: S,
  level: LevelConfig,
  origin: { x: number; y: number },
  groundY: number,
  showTrajectory: boolean,
) {
  const W = BASE_W;
  const H = BASE_H;

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, "#d9c79a");
  sky.addColorStop(0.55, "#e6d5ad");
  sky.addColorStop(1, "#cfc08f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // sun
  ctx.fillStyle = "rgba(214,178,84,0.35)";
  ctx.beginPath();
  ctx.arc(W * 0.78, 120, 70, 0, Math.PI * 2);
  ctx.fill();

  // hills
  const hill = (yOff: number, color: string, amp: number, freq: number, phase: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 12) {
      ctx.lineTo(x, groundY - yOff + Math.sin(x * freq + phase) * amp);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  };
  hill(120, "#a9a173", 26, 0.004, 1.1);
  hill(70, "#8f8a5c", 18, 0.006, 2.6);

  // ground
  const g = ctx.createLinearGradient(0, groundY - 20, 0, H);
  g.addColorStop(0, "#7d7a48");
  g.addColorStop(1, "#5a5330");
  ctx.fillStyle = g;
  ctx.fillRect(0, groundY, W, H - groundY);

  // grass tufts (wind-swayed)
  ctx.strokeStyle = "rgba(60,72,36,0.5)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 70; i++) {
    const x = (i * 137) % W;
    const sway = Math.sin(s.time * 2 + i) * (2 + Math.abs(s.wind));
    const y = groundY + ((i * 53) % (H - groundY - 10));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + sway, y - 12);
    ctx.stroke();
  }

  if (s.target) drawTarget(ctx, s.target, groundY);

  // trajectory guide
  if (showTrajectory && s.drawing) {
    const angle = Math.atan2(s.aim.y - origin.y, s.aim.x - origin.x);
    const base = s.target
      ? solveSpeedForTarget(origin, angle, { x: s.target.x, y: s.target.y })
      : null;
    const pts = predictPath(origin, angle, Math.max(0.15, s.power), s.wind, 18, 0.05, base ?? undefined);
    ctx.fillStyle = "rgba(60,45,25,0.35)";
    pts.forEach((p, i) => {
      if (p.y > groundY) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 - i * 0.1, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawArcher(ctx, s, origin, groundY);

  // arrows
  for (const a of s.arrows) {
    if (!a.alive) continue;
    if (!a.stuck && a.trail.length > 1) {
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.trail[0]!.x, a.trail[0]!.y);
      for (const p of a.trail) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    drawArrow(ctx, a.pos.x, a.pos.y, a.angle);
  }

  // floaters
  ctx.textAlign = "center";
  for (const f of s.floaters) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = "#3a2c16";
    ctx.font = "bold 22px Georgia, serif";
    ctx.fillText(f.text, f.x, f.y - (1.4 - f.life) * 26);
    ctx.globalAlpha = 1;
  }

  // wind streaks
  if (Math.abs(s.wind) > 0.2) {
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const y = 60 + i * 42;
      const x = ((s.time * s.wind * 40 + i * 190) % (W + 200)) - 100;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 40 * Math.sign(s.wind || 1), y);
      ctx.stroke();
    }
  }
  void level;
}

function drawTarget(ctx: CanvasRenderingContext2D, t: Target, groundY: number) {
  // stand
  ctx.strokeStyle = "#6b4a25";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(t.x - 16, groundY);
  ctx.lineTo(t.x, t.y + t.radius * 0.5);
  ctx.moveTo(t.x + 16, groundY);
  ctx.lineTo(t.x, t.y + t.radius * 0.5);
  ctx.stroke();

  // wooden backing
  ctx.fillStyle = "#7a5227";
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.radius * 1.12, 0, Math.PI * 2);
  ctx.fill();

  const rings: [number, string][] = [
    [1.0, "#efe3c4"],
    [0.72, "#2f2a1c"],
    [0.46, "#3f6b3a"],
    [0.22, "#c9a227"],
  ];
  for (const [r, color] of rings) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.radius * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = "#4a3418";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-46, 0);
  ctx.lineTo(0, 0);
  ctx.stroke();
  ctx.fillStyle = "#d8d2c2";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-10, -4);
  ctx.lineTo(-10, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#8c3b2a";
  ctx.beginPath();
  ctx.moveTo(-46, 0);
  ctx.lineTo(-58, -6);
  ctx.lineTo(-40, 0);
  ctx.lineTo(-58, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawArcher(
  ctx: CanvasRenderingContext2D,
  s: S,
  origin: { x: number; y: number },
  groundY: number,
) {
  const angle = Math.atan2(s.aim.y - origin.y, s.aim.x - origin.x);
  const pull = s.drawing ? s.power * 26 : s.bowRecoil * 10;
  const hipX = origin.x - 26;
  const hipY = origin.y + 66;

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(hipX, groundY + 6, 46, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // legs
  ctx.strokeStyle = "#4a3a24";
  ctx.lineWidth = 11;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(hipX - 26, groundY);
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(hipX + 22, groundY);
  ctx.stroke();

  // torso (leather armour)
  ctx.fillStyle = "#6b4a2a";
  ctx.beginPath();
  ctx.moveTo(hipX - 16, hipY);
  ctx.lineTo(hipX + 16, hipY);
  ctx.lineTo(hipX + 13, hipY - 62);
  ctx.lineTo(hipX - 13, hipY - 62);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(201,162,39,0.55)";
  ctx.fillRect(hipX - 16, hipY - 34, 32, 6);

  // head + cap
  const headY = hipY - 78;
  ctx.fillStyle = "#c99b6b";
  ctx.beginPath();
  ctx.arc(hipX + 2, headY, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5a3a1e";
  ctx.beginPath();
  ctx.arc(hipX + 2, headY - 4, 14, Math.PI, 0);
  ctx.fill();

  // quiver
  ctx.save();
  ctx.translate(hipX - 18, hipY - 40);
  ctx.rotate(-0.35);
  ctx.fillStyle = "#4a3218";
  ctx.fillRect(-8, -6, 16, 46);
  ctx.strokeStyle = "#8c3b2a";
  ctx.lineWidth = 3;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 5, -6);
    ctx.lineTo(i * 5 - 3, -22);
    ctx.stroke();
  }
  ctx.restore();

  // bow arm + bow
  const bowX = origin.x + Math.cos(angle) * 34;
  const bowY = origin.y + Math.sin(angle) * 34;
  ctx.strokeStyle = "#c99b6b";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(hipX + 6, hipY - 52);
  ctx.lineTo(bowX, bowY);
  ctx.stroke();

  ctx.save();
  ctx.translate(bowX, bowY);
  ctx.rotate(angle);
  // traditional recurve limbs
  ctx.strokeStyle = "#7a4b1f";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, -58);
  ctx.quadraticCurveTo(26, -30, 8, 0);
  ctx.quadraticCurveTo(26, 30, 0, 58);
  ctx.stroke();
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -58);
  ctx.lineTo(0, 58);
  ctx.stroke();
  // string pulled back
  ctx.strokeStyle = "#efe3c4";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -58);
  ctx.lineTo(-pull - 4, 0);
  ctx.lineTo(0, 58);
  ctx.stroke();
  // nocked arrow while drawing
  if (s.drawing) {
    ctx.strokeStyle = "#4a3418";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-pull - 4, 0);
    ctx.lineTo(44, 0);
    ctx.stroke();
  }
  // draw hand
  ctx.fillStyle = "#c99b6b";
  ctx.beginPath();
  ctx.arc(-pull - 6, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
