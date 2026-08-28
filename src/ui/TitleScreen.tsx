import { BattleMode } from "../game/Battle";

interface Props {
  onSelect: (mode: BattleMode) => void;
  regenRematchKey?: number;
}

export function TitleScreen({ onSelect }: Props) {
  return (
    <div className="title-screen">
      <div className="title-logo">
        <h1>MYTHIC FIGHT ARENA</h1>
        <p className="subtitle">Realm of Beasts</p>
      </div>

      <div className="menu">
        <button className="menu-btn" onClick={() => onSelect(BattleMode.PVE)}>
          <span className="btn-title">PvE — Vs AI</span>
          <span className="btn-desc">Mitoloji karakterinle bilgisayara karşı dövüş</span>
        </button>
        <button className="menu-btn" onClick={() => onSelect(BattleMode.PVP)}>
          <span className="btn-title">PvP — Çevrimiçi</span>
          <span className="btn-desc">Rollback netcode ile 1v1</span>
          <span className="badge">Rollback</span>
        </button>
        <button className="menu-btn" onClick={() => onSelect(BattleMode.DUNGEON)}>
          <span className="btn-title">Survival — Realm of Beasts</span>
          <span className="btn-desc">Dalga dalga canavarları temizle ve skor topla</span>
        </button>
      </div>

      <div className="controls-hint">
        <b>Kontroller:</b> A/D hareket · J Hafif · K Ağır · L Özel · I Ultimate · G Parry · Shift Blok · Space Dash
      </div>
    </div>
  );
}
