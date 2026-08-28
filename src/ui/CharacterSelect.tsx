import { useMemo, useState } from "react";
import { CharacterData, Pantheon, Archetype } from "../game/types";
import { CharacterDatabaseManager } from "../game/characters/CharacterDatabaseManager";

const PANTHON_LABEL: Record<Pantheon, string> = {
  GREEK: "Yunan",
  EGYPTIAN: "Mısır",
  NORSE: "İskandinav",
  TURKIC: "Türk",
  JAPANESE: "Japon",
};

const ARCHETYPE_LABEL: Record<Archetype, string> = {
  RUSHDOWN: "Rushdown",
  ZONER: "Zoner",
  GRAPPLER: "Grappler",
  BRAWLER: "Brawler",
  CROWD_CONTROL: "Kontrol",
  AERIAL: "Havacı",
  STANCE: "Stance",
  BEAST: "Canavar",
  TANK: "Tank",
  NECROMANCER: "Nekromancer",
};

interface Props {
  onSelect: (p1Id: string, p2Id: string) => void;
  onBack: () => void;
}

type Slot = "p1" | "p2";

export function CharacterSelectScreen({ onSelect, onBack }: Props) {
  const db = CharacterDatabaseManager.instance;
  const [pantheon, setPantheon] = useState<Pantheon | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [slot, setSlot] = useState<Slot>("p1");
  const [p1Id, setP1Id] = useState<string>("thor");
  const [p2Id, setP2Id] = useState<string>("anubis");

  const list = useMemo(() => {
    let result = db.getAll();
    if (pantheon !== "ALL") result = result.filter((c) => c.pantheon === pantheon);
    if (search.trim()) result = db.searchByName(search);
    return result;
  }, [db, pantheon, search]);

  const current = slot === "p1" ? p1Id : p2Id;
  const currentData = db.getById(current);
  const opponentData = db.getById(slot === "p1" ? p2Id : p1Id);

  const pick = (data: CharacterData) => {
    if (slot === "p1") setP1Id(data.id);
    else setP2Id(data.id);
  };

  return (
    <div className="select-screen">
      <div className="select-header">
        <button className="back-btn" onClick={onBack}>← Geri</button>
        <h1>Karakter Seç</h1>
        <div className="slot-tabs">
          <button
            className={`slot-tab ${slot === "p1" ? "active" : ""}`}
            onClick={() => setSlot("p1")}
          >
            P1: {currentData?.characterName ?? "-"}
          </button>
          <button
            className={`slot-tab ${slot === "p2" ? "active" : ""}`}
            onClick={() => setSlot("p2")}
          >
            P2: {opponentData?.characterName ?? "-"}
          </button>
        </div>
      </div>

      <div className="select-filters">
        <button
          className={`filter-chip ${pantheon === "ALL" ? "active" : ""}`}
          onClick={() => setPantheon("ALL")}
        >
          Tümü
        </button>
        {(Object.keys(PANTHON_LABEL) as Pantheon[]).map((p) => (
          <button
            key={p}
            className={`filter-chip ${pantheon === p ? "active" : ""}`}
            onClick={() => setPantheon(p)}
          >
            {PANTHON_LABEL[p]}
          </button>
        ))}
        <input
          className="select-search"
          placeholder="Karakter ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="select-body">
        <div className="char-grid">
          {list.map((c) => (
            <button
              key={c.id}
              className={`char-card ${current === c.id ? "selected" : ""}`}
              onClick={() => pick(c)}
            >
              <div
                className="char-avatar"
                style={{ background: c.palette.body }}
              >
                <span style={{ color: c.palette.accent }}>{c.characterName[0]}</span>
              </div>
              <div className="char-name">{c.characterName}</div>
              <div className="char-meta">
                {PANTHON_LABEL[c.pantheon]} · {ARCHETYPE_LABEL[c.archetype]}
              </div>
            </button>
          ))}
        </div>

        <div className="char-detail">
          {currentData && (
            <>
              <div
                className="detail-avatar"
                style={{ background: currentData.palette.body }}
              >
                <span style={{ color: currentData.palette.accent }}>
                  {currentData.characterName[0]}
                </span>
              </div>
              <h2>{currentData.characterName}</h2>
              <div className="detail-type">
                {PANTHON_LABEL[currentData.pantheon]} ·{" "}
                {ARCHETYPE_LABEL[currentData.archetype]}
              </div>

              <div className="detail-stats">
                <StatBar label="HP" value={currentData.baseStats.hp} max={300} />
                <StatBar
                  label="Saldırı"
                  value={currentData.baseStats.attackPower}
                  max={130}
                />
                <StatBar
                  label="Hız"
                  value={currentData.baseStats.movementSpeed}
                  max={4}
                />
                <StatBar
                  label="Zırh"
                  value={currentData.baseStats.armor}
                  max={0.3}
                  pct
                />
              </div>

              <div className="ability-block">
                <div className="ability-label">Pasif — {currentData.passiveAbilityName}</div>
                <p>{currentData.passiveDescription}</p>
              </div>
              <div className="ability-block ult">
                <div className="ability-label">Ultimate — {currentData.ultimateName}</div>
                <p>{currentData.ultimateDescription}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="select-footer">
        <button className="menu-btn start" onClick={() => onSelect(p1Id, p2Id)}>
          Dövüşe Başla
        </button>
      </div>
    </div>
  );
}

function StatBar({
  label,
  value,
  max,
  pct,
}: {
  label: string;
  value: number;
  max: number;
  pct?: boolean;
}) {
  const norm = pct ? value / max : Math.min(1, value / max);
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <div className="stat-track">
        <div className="stat-fill" style={{ width: `${norm * 100}%` }} />
      </div>
      <span className="stat-val">{pct ? `${Math.round(value * 100)}%` : value}</span>
    </div>
  );
}
