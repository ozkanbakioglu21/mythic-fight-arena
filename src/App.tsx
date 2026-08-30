import { useEffect, useRef, useState } from "react";
import { Game, HudState } from "./game/Game";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas);
    gameRef.current = game;
    game.onHud = setHud;
    game.start();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "n" || e.key === "N") {
        game.newGame();
      } else if (e.key === "u" || e.key === "U") {
        game.undo();
      } else if (e.key === "l" || e.key === "L") {
        game.nextLevel();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      game.stop();
      gameRef.current = null;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const won = hud?.won;

  return (
    <div className="game-shell">
      <div className="arena">
        <canvas ref={canvasRef} className="arena-canvas" />
        {won && (
          <div className="win-banner">
            <div className="win-title">Başardın!</div>
            <div className="win-sub">
              Seviye {hud?.levelName}: {hud?.moves} hamlede, {hud?.seconds}{" "}
              saniyede tüm rünleri eşleştirdin.
            </div>
            <div className="win-actions">
              <button className="btn" onClick={() => gameRef.current?.nextLevel()}>
                Sonraki Seviye
              </button>
              <button className="btn ghost" onClick={() => gameRef.current?.newGame()}>
                Tekrar Oyna
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="toolbar">
        <div className="level-picker">
          {["1", "2", "3", "4", "5"].map((label, i) => (
            <button
              key={i}
              className={`btn tbtn lvl ${hud?.level === i ? "active" : ""}`}
              onClick={() => gameRef.current?.goToLevel(i)}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="btn tbtn" onClick={() => gameRef.current?.newGame()}>
          Yeni Oyun (N)
        </button>
        <button className="btn tbtn" onClick={() => gameRef.current?.undo()}>
          Geri Al (U)
        </button>
        <button className="btn tbtn" onClick={() => gameRef.current?.nextLevel()}>
          Sonraki (L)
        </button>
      </div>
    </div>
  );
}
