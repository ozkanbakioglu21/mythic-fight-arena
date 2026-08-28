export interface ArcheryStats {
  highScore: number;
  totalScore: number;
  shots: number;
  hits: number;
  levelsCleared: number;
}

export interface ArcherySettings {
  sound: boolean;
  music: boolean;
  showTrajectory: boolean;
}

const STATS_KEY = "klasik-okcu:stats";
const SETTINGS_KEY = "klasik-okcu:settings";

export const defaultStats: ArcheryStats = {
  highScore: 0,
  totalScore: 0,
  shots: 0,
  hits: 0,
  levelsCleared: 0,
};

export const defaultSettings: ArcherySettings = {
  sound: true,
  music: false,
  showTrajectory: true,
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const loadStats = () => read(STATS_KEY, defaultStats);
export const saveStats = (s: ArcheryStats) => write(STATS_KEY, s);
export const loadSettings = () => read(SETTINGS_KEY, defaultSettings);
export const saveSettings = (s: ArcherySettings) => write(SETTINGS_KEY, s);
export const resetStats = () => saveStats(defaultStats);
