import { HudState } from "../game/Battle";

function HealthBar({
  hp,
  maxHp,
  align,
  label,
}: {
  hp: number;
  maxHp: number;
  align: "left" | "right";
  label: string;
}) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  return (
    <div className={`health-block ${align}`}>
      <div className="health-label">{label}</div>
      <div className="health-track">
        <div
          className="health-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="hp-num">{Math.ceil(hp)} / {maxHp}</div>
    </div>
  );
}

function MeterBar({ meter, maxMeter }: { meter: number; maxMeter: number }) {
  const pct = Math.max(0, Math.min(100, (meter / maxMeter) * 100));
  return (
    <div className="meter-track">
      <div className="meter-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function BattleHud({ hud }: { hud: HudState }) {
  const d = hud.dungeon;
  return (
    <>
      <div className="hud-top">
        <HealthBar
          hp={hud.p1.hp}
          maxHp={hud.p1.maxHp}
          align="left"
          label={hud.p1.state}
        />
        <div className="vs">VS</div>
        {hud.p2 ? (
          <HealthBar
            hp={hud.p2.hp}
            maxHp={hud.p2.maxHp}
            align="right"
            label={hud.p2.state}
          />
        ) : (
          <div className="health-block right placeholder" />
        )}
      </div>

      <div className="hud-meter-player">
        <MeterBar meter={hud.p1.meter} maxMeter={hud.p1.maxMeter} />
        <span className="meter-label">ULT</span>
      </div>

      {d && (
        <div className="dungeon-panel">
          <div className="dungeon-wave">Dalga {d.wave}</div>
          <div className="dungeon-score">Skor: {d.score}</div>
          <div className="dungeon-mult">Çarpan x{d.multiplier}</div>
          <div className="dungeon-streak">Seri: {d.streak}</div>
        </div>
      )}
    </>
  );
}
