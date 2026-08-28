import { useEffect, useRef, useState } from "react";
import { Battle, BattleMode, HudState } from "./game/Battle";
import { CharacterDef } from "./game/types";
import { toCharacterDef } from "./game/characters/toCharacterDef";
import { CharacterDatabaseManager } from "./game/characters/CharacterDatabaseManager";
import { TitleScreen } from "./ui/TitleScreen";
import { CharacterSelectScreen } from "./ui/CharacterSelect";
import { BattleHud } from "./ui/BattleHud";
import { ResultsOverlay } from "./ui/ResultsOverlay";

type Screen =
  | { kind: "title" }
  | { kind: "select"; mode: BattleMode }
  | { kind: "battle"; mode: BattleMode; p1Def: CharacterDef; p2Def: CharacterDef | null };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "title" });
  const [hud, setHud] = useState<HudState | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const battleRef = useRef<Battle | null>(null);

  useEffect(() => {
    if (screen.kind !== "battle") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const battle = new Battle(canvas, screen.mode, screen.p1Def, screen.p2Def ?? undefined);
    battleRef.current = battle;
    battle.setHudListener(setHud);
    battle.setMatchEndListener((w) => setWinner(w));
    battle.start();

    return () => {
      battle.stop();
      battleRef.current = null;
      setHud(null);
      setWinner(null);
    };
  }, [screen]);

  const handleStartBattle = (p1Id: string, p2Id: string) => {
    if (screen.kind !== "select") return;
    const db = CharacterDatabaseManager.instance;
    const d1 = db.getById(p1Id);
    const d2 = db.getById(p2Id);
    if (!d1) return;
    const p1Def = toCharacterDef(d1);
    const p2Def = d2 ? toCharacterDef(d2) : null;
    setScreen({ kind: "battle", mode: screen.mode, p1Def, p2Def });
  };

  const handleRematch = () => {
    setWinner(null);
    setHud(null);
    setScreen((s) => (s.kind === "battle" ? { ...s } : s));
  };

  const handleExit = () => {
    setScreen({ kind: "title" });
  };

  if (screen.kind === "title") {
    return (
      <TitleScreen
        onSelect={(mode) => setScreen({ kind: "select", mode })}
      />
    );
  }

  if (screen.kind === "select") {
    return (
      <CharacterSelectScreen
        onSelect={handleStartBattle}
        onBack={() => setScreen({ kind: "title" })}
      />
    );
  }

  return (
    <div className="game-shell">
      <div className="arena">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="arena-canvas"
        />
        {hud && <BattleHud hud={hud} />}
        {winner && (
          <ResultsOverlay
            winner={winner}
            score={hud?.dungeon?.score}
            onRematch={handleRematch}
            onExit={handleExit}
          />
        )}
      </div>
    </div>
  );
}
