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
    return () => {
      game.stop();
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="game-shell">
      <div className="arena">
        <canvas ref={canvasRef} className="arena-canvas" />
        {hud && hud.scene === "room" && (
          <div className="hud">
            <div className="hud-room">{hud.roomName}</div>
            <div className="hud-progress">
              Oda {hud.roomIndex + 1} / {hud.roomTotal}
            </div>
            <div className="hud-hint">{hud.roomHint}</div>
          </div>
        )}
      </div>
      <div className="footnote">
        Fare ile oyna · Plakalara bas, sembolleri takip et, bilmeceleri çöz
      </div>
    </div>
  );
}
