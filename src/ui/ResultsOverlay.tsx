interface Props {
  winner: string;
  score?: number;
  onRematch: () => void;
  onExit: () => void;
}

export function ResultsOverlay({ winner, score, onRematch, onExit }: Props) {
  return (
    <div className="results-overlay">
      <div className="results-card">
        <h2>{winner} Kazandı!</h2>
        {typeof score === "number" && (
          <div className="results-score">Toplam Skor: {score}</div>
        )}
        <div className="results-actions">
          <button className="menu-btn" onClick={onRematch}>
            Tekrar Oyna
          </button>
          <button className="menu-btn" onClick={onExit}>
            Ana Menü
          </button>
        </div>
      </div>
    </div>
  );
}
