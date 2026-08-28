import { useEffect, useRef, useState } from "react";
import { Battle, BattleMode, HudState } from "./game/Battle";
import { TitleScreen } from "./ui/TitleScreen";
import { BattleHud } from "./ui/BattleHud";
import { ResultsOverlay } from "./ui/ResultsOverlay";

type Screen =
  | { kind: "title" }
  | { kind: "battle"; mode: BattleMode };

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

    const battle = new Battle(canvas, screen.mode);
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

  const handleRematch = () => {
    setWinner(null);
    setHud(null);
    // Ekranı aynı modda yeniden kur.
    setScreen((s) => (s.kind === "battle" ? { ...s } : s));
  };

  const handleExit = () => {
    setScreen({ kind: "title" });
  };

  if (screen.kind === "title") {
    return (
      <TitleScreen
        onSelect={(mode) => setScreen({ kind: "battle", mode })}
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
