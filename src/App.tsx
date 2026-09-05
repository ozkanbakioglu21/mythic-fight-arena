import { useEffect, useRef, useState } from "react";
import { Game, HudState } from "./game/Game";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [levelCount, setLevelCount] = useState(12);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas);
    gameRef.current = game;
    game.onHud = setHud;
    setLevelCount(game.getLevelCount());
    setMuted(game.isMuted());
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

  const handleMute = () => {
    const newMuted = gameRef.current?.toggleMute() ?? false;
    setMuted(newMuted);
  };

  return (
    <div className="game-shell">
      <div className="arena">
        <canvas ref={canvasRef} className="arena-canvas" />
        {/* Hoparlör butonu */}
        <button className="mute-btn" onClick={handleMute} title={muted ? "Sesi Aç" : "Sesi Kapat"}>
          {muted ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
        </button>
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
        <button className="btn tbtn power-btn" onClick={() => gameRef.current?.undo()}>
          <span>⏪</span><span>Geri</span>
        </button>
        <button className="btn tbtn power-btn" onClick={() => gameRef.current?.hint()}>
          <span>👁️</span><span>İpucu</span>
        </button>
        <button className="btn tbtn power-btn" disabled={!hud || hud.shuffles <= 0} onClick={() => gameRef.current?.shuffle()}>
          <span>🔀</span><span>Karıştır</span>
          {hud && hud.shuffles > 0 && <span className="badge">{hud.shuffles}</span>}
        </button>
        <button className="btn tbtn" onClick={() => gameRef.current?.nextLevel()}>
          Sonraki (L)
        </button>
      </div>
    </div>
  );
}
