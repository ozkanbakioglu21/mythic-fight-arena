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
              {hud?.moves} hamlede, {hud?.seconds} saniyede tüm rünleri eşleştirdin.
            </div>
            <button
              className="btn"
              onClick={() => gameRef.current?.newGame()}
            >
              Yeni Oyun
            </button>
          </div>
        )}
      </div>
      <div className="toolbar">
        <button className="btn tbtn" onClick={() => gameRef.current?.newGame()}>
          Yeni Oyun (N)
        </button>
        <button className="btn tbtn" onClick={() => gameRef.current?.undo()}>
          Geri Al (U)
        </button>
      </div>
    </div>
  );
}
