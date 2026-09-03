import { useEffect, useRef, useState } from "react";
import { Game, HudState } from "./game/Game";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [levelCount, setLevelCount] = useState(12);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas);
    gameRef.current = game;
    game.onHud = setHud;
    setLevelCount(game.getLevelCount());
    game.start();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "n" || e.key === "N") {
        game.newGame();
      } else if (e.key === "u" || e.key === "U") {
        game.undo();
      } else if (e.key === "l" || e.key === "L") {
        game.nextLevel();
      } else if (e.key === "h" || e.key === "H") {
        game.hint();
      } else if (e.key === "s" || e.key === "S") {
        game.shuffle();
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
              Seviye {hud?.levelName}: {hud?.score} puanda, {hud?.moves}{" "}
              hamlede, {hud?.seconds} saniyede tüm taşları eşleştirdin.
            </div>
            <div
              className="win-stars"
              style={{ fontSize: 38, color: "#ffd75e", letterSpacing: 8 }}
            >
              {"★".repeat(hud?.stars ?? 0)}
              {"☆".repeat(Math.max(0, 3 - (hud?.stars ?? 0)))}
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
          {Array.from({ length: levelCount }, (_, i) => (
            <button
              key={i}
              className={`btn tbtn lvl ${hud?.level === i ? "active" : ""}`}
              onClick={() => gameRef.current?.goToLevel(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <button className="btn tbtn" onClick={() => gameRef.current?.newGame()}>
          Yeni Oyun (N)
        </button>
        <button className="btn tbtn" onClick={() => gameRef.current?.undo()}>
          Geri Al (U)
        </button>
        <button className="btn tbtn" onClick={() => gameRef.current?.hint()}>
          İpucu (H)
        </button>
        <button className="btn tbtn" disabled={!hud || hud.shuffles <= 0} onClick={() => gameRef.current?.shuffle()}>
          Karıştır ({hud?.shuffles ?? 0})
        </button>
        <button className="btn tbtn" onClick={() => gameRef.current?.nextLevel()}>
          Sonraki (L)
        </button>
      </div>
    </div>
  );
}
