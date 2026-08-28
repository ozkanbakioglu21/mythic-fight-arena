import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GameCanvas, type RoundResult } from "@/components/GameCanvas";
import { LEVELS, TOTAL_LEVELS } from "@/game/levels";
import {
  defaultSettings,
  defaultStats,
  loadSettings,
  loadStats,
  resetStats,
  saveSettings,
  saveStats,
  type ArcherySettings,
  type ArcheryStats,
} from "@/game/storage";
import { playSfx, setSoundEnabled } from "@/game/audio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Klasik Okçu — Geleneksel Okçuluk Mini Oyunu" },
      {
        name: "description",
        content:
          "Bozkırda geleneksel yayla nişan al, rüzgarı hesapla ve 10 bölümde hedefleri vur. Tarayıcıda oynanan ücretsiz okçuluk oyunu.",
      },
      { property: "og:title", content: "Klasik Okçu — Geleneksel Okçuluk Mini Oyunu" },
      {
        property: "og:description",
        content: "Yayı ger, rüzgarı hesapla, hedefi 12'den vur. 10 bölümlük klasik okçuluk oyunu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Screen = "menu" | "playing" | "result" | "scores" | "settings";

function Index() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [levelIndex, setLevelIndex] = useState(0);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [newRecord, setNewRecord] = useState(false);
  const [stats, setStats] = useState<ArcheryStats>(defaultStats);
  const [settings, setSettings] = useState<ArcherySettings>(defaultSettings);

  useEffect(() => {
    const s = loadStats();
    const cfg = loadSettings();
    setStats(s);
    setSettings(cfg);
    setSoundEnabled(cfg.sound);
  }, []);

  const accuracy = stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0;

  const handleFinish = (r: RoundResult) => {
    setResult(r);
    const next: ArcheryStats = {
      highScore: Math.max(stats.highScore, r.score),
      totalScore: stats.totalScore + r.score,
      shots: stats.shots + r.shots,
      hits: stats.hits + r.hits,
      levelsCleared: r.cleared
        ? Math.max(stats.levelsCleared, r.levelIndex + 1)
        : stats.levelsCleared,
    };
    setNewRecord(r.score > stats.highScore);
    setStats(next);
    saveStats(next);
    setScreen("result");
  };

  const updateSettings = (patch: Partial<ArcherySettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    setSoundEnabled(next.sound);
  };

  return (
    <main className="min-h-screen bg-gradient-steppe px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-5xl">
        {screen === "menu" && (
          <Menu
            onStart={() => {
              playSfx("draw");
              setScreen("playing");
            }}
            onScores={() => setScreen("scores")}
            onSettings={() => setScreen("settings")}
            levelIndex={levelIndex}
            setLevelIndex={setLevelIndex}
            unlocked={Math.min(TOTAL_LEVELS - 1, stats.levelsCleared)}
          />
        )}

        {screen === "playing" && (
          <GameCanvas
            key={levelIndex}
            levelIndex={levelIndex}
            showTrajectory={settings.showTrajectory}
            onFinish={handleFinish}
            onExit={() => setScreen("menu")}
          />
        )}

        {screen === "result" && result && (
          <ResultScreen
            result={result}
            newRecord={newRecord}
            onReplay={() => setScreen("playing")}
            onNext={() => {
              setLevelIndex((i) => Math.min(TOTAL_LEVELS - 1, i + 1));
              setScreen("playing");
            }}
            onMenu={() => setScreen("menu")}
          />
        )}

        {screen === "scores" && (
          <Panel title="Skorlar" onBack={() => setScreen("menu")}>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="En Yüksek Skor" value={stats.highScore} />
              <Stat label="Toplam Puan" value={stats.totalScore} />
              <Stat label="Atış Sayısı" value={stats.shots} />
              <Stat label="İsabet" value={stats.hits} />
              <Stat label="İsabet Oranı" value={`%${accuracy}`} />
              <Stat label="Geçilen Bölüm" value={`${stats.levelsCleared}/${TOTAL_LEVELS}`} />
            </dl>
            <button
              className="btn-archer mt-6"
              onClick={() => {
                resetStats();
                setStats(defaultStats);
              }}
            >
              Kayıtları Sıfırla
            </button>
          </Panel>
        )}

        {screen === "settings" && (
          <Panel title="Ayarlar" onBack={() => setScreen("menu")}>
            <div className="space-y-3">
              <Toggle
                label="Ses efektleri"
                checked={settings.sound}
                onChange={(v) => updateSettings({ sound: v })}
              />
              <Toggle
                label="Menü müziği atmosferi"
                checked={settings.music}
                onChange={(v) => updateSettings({ music: v })}
              />
              <Toggle
                label="Yörünge yardımı"
                checked={settings.showTrajectory}
                onChange={(v) => updateSettings({ showTrajectory: v })}
              />
            </div>
          </Panel>
        )}
      </div>
    </main>
  );
}

function Menu({
  onStart,
  onScores,
  onSettings,
  levelIndex,
  setLevelIndex,
  unlocked,
}: {
  onStart: () => void;
  onScores: () => void;
  onSettings: () => void;
  levelIndex: number;
  setLevelIndex: (i: number) => void;
  unlocked: number;
}) {
  const level = LEVELS[levelIndex];
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-surface/70 p-6 shadow-deep sm:p-12">
      <MenuBackdrop />
      <div className="relative">
        <p className="font-display text-sm uppercase tracking-[0.35em] text-accent">Bozkır Meydanı</p>
        <h1 className="mt-3 text-5xl text-foreground sm:text-7xl">Klasik Okçu</h1>
        <p className="mt-4 max-w-md text-sm text-muted-foreground sm:text-base">
          Geleneksel yayı ger, rüzgarı oku, hedefi tam merkezinden vur. On bölüm, artan mesafe ve
          küçülen hedefler seni bekliyor.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:max-w-xs">
          <button className="btn-archer btn-archer-primary" onClick={onStart}>
            Oyuna Başla
          </button>
          <button className="btn-archer" onClick={onScores}>
            Skorlar
          </button>
          <button className="btn-archer" onClick={onSettings}>
            Ayarlar
          </button>
        </div>

        <div className="mt-8">
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
            Bölüm seç {level ? `— ${level.distanceMeters} m` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((l, i) => {
              const locked = i > unlocked;
              return (
                <button
                  key={l.index}
                  disabled={locked}
                  onClick={() => setLevelIndex(i)}
                  className={`h-10 w-10 rounded-md border font-display text-sm transition-colors ${
                    i === levelIndex
                      ? "border-accent bg-primary text-primary-foreground"
                      : "border-border bg-surface text-foreground hover:border-accent"
                  } ${locked ? "cursor-not-allowed opacity-35" : ""}`}
                >
                  {l.index}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function MenuBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70">
      <div className="absolute right-6 top-1/2 h-40 w-40 -translate-y-1/2 animate-pulse rounded-full border-[14px] border-accent/70 sm:h-64 sm:w-64">
        <div className="absolute inset-6 rounded-full border-[12px] border-secondary/70">
          <div className="absolute inset-5 rounded-full bg-primary/70" />
        </div>
      </div>
      <svg
        viewBox="0 0 120 200"
        className="absolute bottom-0 left-2 h-44 w-28 fill-foreground/25 sm:h-72 sm:w-44"
      >
        <circle cx="52" cy="26" r="15" />
        <path d="M40 42h26l8 56H34z" />
        <path d="M38 96l-12 84h14l10-56 10 56h14l-12-84z" />
        <path d="M66 60l30-34" strokeWidth="5" className="stroke-accent/50" fill="none" />
        <path
          d="M104 6c-16 22-16 52 0 74"
          className="stroke-accent/60"
          strokeWidth="6"
          fill="none"
        />
      </svg>
    </div>
  );
}

function ResultScreen({
  result,
  newRecord,
  onReplay,
  onNext,
  onMenu,
}: {
  result: RoundResult;
  newRecord: boolean;
  onReplay: () => void;
  onNext: () => void;
  onMenu: () => void;
}) {
  const accuracy = useMemo(
    () => (result.shots ? Math.round((result.hits / result.shots) * 100) : 0),
    [result],
  );
  const hasNext = result.levelIndex + 1 < TOTAL_LEVELS && result.cleared;

  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-border bg-surface/80 p-8 text-center shadow-deep">
      <h2 className="text-3xl text-foreground">Atış Tamamlandı</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {LEVELS[result.levelIndex]?.name} · {LEVELS[result.levelIndex]?.distanceMeters} m
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Puan" value={result.score} />
        <Stat label="İsabet Oranı" value={`%${accuracy}`} />
        <Stat label="İsabet" value={`${result.hits}/${result.shots}`} />
      </div>

      {newRecord && (
        <p className="mt-5 font-display text-accent">Yeni rekor! Ustalığın konuşuyor.</p>
      )}
      {!result.cleared && (
        <p className="mt-5 text-sm text-muted-foreground">
          Bölümü geçmek için atışların en az yarısını hedefe indirmelisin.
        </p>
      )}

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button className="btn-archer btn-archer-primary" onClick={onReplay}>
          Tekrar Oyna
        </button>
        {hasNext && (
          <button className="btn-archer" onClick={onNext}>
            Sonraki Bölüm
          </button>
        )}
        <button className="btn-archer" onClick={onMenu}>
          Ana Menü
        </button>
      </div>
    </section>
  );
}

function Panel({
  title,
  children,
  onBack,
}: {
  title: string;
  children: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-border bg-surface/80 p-8 shadow-deep">
      <h2 className="text-3xl text-foreground">{title}</h2>
      <div className="mt-6">{children}</div>
      <button className="btn-archer mt-8" onClick={onBack}>
        Geri
      </button>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card/70 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl text-accent">{value}</div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg border border-border bg-card/70 px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-accent"
    >
      <span>{label}</span>
      <span
        className={`h-6 w-11 rounded-full p-1 transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-foreground transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </span>
    </button>
  );
}
