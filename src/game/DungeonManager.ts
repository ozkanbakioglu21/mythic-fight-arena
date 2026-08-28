import { MONSTERS } from "./moves/frameData";
import { AI } from "./AI";
import { CombatEngine } from "./CombatEngine";
import { Fighter } from "./Fighter";
import { HitboxManager } from "./HitboxManager";

export interface MonsterSlot {
  fighter: Fighter;
  ai: AI | null;
  /** Canavar öldüğünde kaç puan. */
  scoreValue: number;
  alive: boolean;
}

export interface DungeonState {
  wave: number;
  remaining: number;
  totalWaves: number;
  score: number;
  multiplier: number;
  /** Multiplier sıfırlanmadan önceki canavar öldürme sayacı. */
  streak: number;
  spawnTimer: number;
  waveActive: boolean;
  gameOver: boolean;
}

/**
 * DungeonManager — "Realm of Beasts" survival modu için canavar dalgalarını
 * (wave spawner) ve skor çarpanlarını (multiplier) yönetir.
 *
 * Dalga kuralları: Her yeni dalgada canavar zorluğu ve skor değeri artar.
 * Streak arttıkça skor çarpanı yükselir; hasar alınca streak ve çarpan sıfırlanır.
 */
export class DungeonManager {
  static readonly SPAWN_POINTS = [120, 620, 1120];

  private monsters: MonsterSlot[] = [];
  private state: DungeonState = {
    wave: 0,
    remaining: 0,
    totalWaves: 10,
    score: 0,
    multiplier: 1,
    streak: 0,
    spawnTimer: 0,
    waveActive: false,
    gameOver: false,
  };

  constructor(
    private engine: CombatEngine,
    private hitboxes: HitboxManager,
    private player: Fighter,
    private groundY: number,
  ) {}

  getState(): Readonly<DungeonState> {
    return this.state;
  }

  getMonsters(): readonly MonsterSlot[] {
    return this.monsters;
  }

  start(): void {
    this.state.wave = 0;
    this.state.score = 0;
    this.state.multiplier = 1;
    this.state.streak = 0;
    this.state.gameOver = false;
    this.monsters = [];
    this.startNextWave();
  }

  startNextWave(): void {
    this.state.wave++;
    this.waveSize = 2 + this.state.wave * 2; // dalga başına canavar sayısı artar
    this.state.remaining = this.waveSize;
    this.state.spawnTimer = 30; // canavarlar kademeli gelir
    this.state.waveActive = true;
    this.monsters = [];
  }

  /** Her frame çağrılır. */
  update(frames = 1): void {
    if (this.state.gameOver) return;
    for (let i = 0; i < frames; i++) this.tick();
  }

  private tick(): void {
    const s = this.state;
    if (!s.waveActive) return;

    // Kalan canavar varsa kademeli spawn et.
    if (s.remaining > 0) {
      s.spawnTimer--;
      if (s.spawnTimer <= 0) {
        s.spawnTimer = 18;
        this.spawnMonster();
      }
    }

    // Ölü canavarları listeden temizle.
    this.monsters = this.monsters.filter((m) => m.alive);
    const knownWaveSize = this.waveSize;

    // Tüm canavarlar spawn oldu ve tümü öldüyse dalga biter.
    if (s.remaining <= 0 && this.monsters.length === 0 && knownWaveSize > 0) {
      if (s.wave >= s.totalWaves) {
        s.gameOver = true; // tüm dalgalar bitti (zafer)
        return;
      }
      s.waveActive = false;
    }
  }

  private waveSize = 0;

  private spawnMonster(): void {
    const s = this.state;
    // Dalga büyüdükçe zor canavarlar gelir (Orc, ardından dev).
    const pool: string[] = monsterPoolForWave(s.wave);
    const defId = pool[Math.floor(Math.random() * pool.length)];
    const def = MONSTERS[defId];
    if (!def) return;

    const spawnX = this.randomSpawnX();
    const fighter = new Fighter(def, this.engine, this.hitboxes, spawnX);
    // Yer seviyesini ayarla.
    fighter.position.y = this.groundY;
    fighter.def.groundLevel = 0;

    const slot: MonsterSlot = {
      fighter,
      ai: null,
      scoreValue: 50 + s.wave * 25,
      alive: true,
    };
    this.monsters.push(slot);
    s.remaining--;
  }

  private randomSpawnX(): number {
    const playerX = this.player.position.x;
    const candidates = DungeonManager.SPAWN_POINTS.filter(
      (x) => Math.abs(x - playerX) > 250,
    );
    if (candidates.length === 0) candidates.push(DungeonManager.SPAWN_POINTS[2]);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * Oyuncu bir canavara hasar verdiğinde/öldürdüğünde çağrılır.
   * @param killed canavar öldürüldü mü.
   */
  onMonsterDown(monster: MonsterSlot, killed: boolean): void {
    if (!killed) return;
    monster.alive = false;
    this.state.streak++;
    // Streak artınca çarpan yükselir (max x5).
    this.state.multiplier = Math.min(5, 1 + Math.floor(this.state.streak / 3));
    const gained = Math.round(monster.scoreValue * this.state.multiplier);
    this.state.score += gained;
  }

  /** Oyuncu hasar aldığında çağrılır: streak ve çarpan sıfırlanır. */
  onPlayerHit(): void {
    this.state.streak = 0;
    this.state.multiplier = 1;
  }

  /** Canavarların AI'sını bağlar (oyuncuya göre). */
  bindMonsterAI(): void {
    for (const m of this.monsters) {
      m.ai = new AI(m.fighter, this.player);
    }
  }

  isWaveComplete(): boolean {
    return (
      !this.state.waveActive &&
      !this.state.gameOver &&
      this.monsters.filter((m) => m.alive).length === 0
    );
  }
}

function monsterPoolForWave(wave: number): string[] {
  if (wave <= 2) return ["goblin", "goblin", "orc"];
  if (wave <= 4) return ["goblin", "orc", "skeleton"];
  if (wave <= 6) return ["orc", "skeleton", "troll"];
  if (wave <= 8) return ["orc", "troll", "troll"];
  return ["troll", "giant"];
}
