/** Ortak oyun tipleri ve enum sabitleri. */

export enum FighterState {
  IDLE = "IDLE",
  MOVING = "MOVING",
  ATTACKING = "ATTACKING",
  BLOCKING = "BLOCKING",
  PARRYING = "PARRYING",
  HITSTUN = "HITSTUN",
  LAUNCHED = "LAUNCHED",
  DASHING = "DASHING",
  KNOCKDOWN = "KNOCKDOWN",
  DEFEATED = "DEFEATED",
}

/** Öncelik hiyerarşisi — düşük değer, yüksek öncelik (ilk işlenir). */
export enum InputPriority {
  ULTIMATE = 0,
  PARRY = 1,
  SPECIAL = 2,
  HEAVY = 3,
  LIGHT = 4,
  MOVEMENT = 5,
}

export enum InputAction {
  ULTIMATE = "ULTIMATE",
  PARRY = "PARRY",
  SPECIAL = "SPECIAL",
  HEAVY = "HEAVY",
  LIGHT = "LIGHT",
  MOVE_LEFT = "MOVE_LEFT",
  MOVE_RIGHT = "MOVE_RIGHT",
  MOVE_UP = "MOVE_UP",
  MOVE_DOWN = "MOVE_DOWN",
  JUMP = "JUMP",
  DASH = "DASH",
  BLOCK = "BLOCK",
}

export const ACTION_PRIORITY: Record<InputAction, InputPriority> = {
  [InputAction.ULTIMATE]: InputPriority.ULTIMATE,
  [InputAction.PARRY]: InputPriority.PARRY,
  [InputAction.SPECIAL]: InputPriority.SPECIAL,
  [InputAction.HEAVY]: InputPriority.HEAVY,
  [InputAction.LIGHT]: InputPriority.LIGHT,
  [InputAction.MOVE_LEFT]: InputPriority.MOVEMENT,
  [InputAction.MOVE_RIGHT]: InputPriority.MOVEMENT,
  [InputAction.MOVE_UP]: InputPriority.MOVEMENT,
  [InputAction.MOVE_DOWN]: InputPriority.MOVEMENT,
  [InputAction.JUMP]: InputPriority.MOVEMENT,
  [InputAction.DASH]: InputPriority.MOVEMENT,
  [InputAction.BLOCK]: InputPriority.MOVEMENT,
};

export type Vec2 = { x: number; y: number };

export interface FrameData {
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  knockback: Vec2;
  hitstunFrames: number;
  launch?: boolean;
  blockDamage?: number;
  /** Saldırı sırasında kesintiye uğramaz (super armor). */
  armor?: boolean;
  /** Parry ile yakalanabilir mi. */
  parryable?: boolean;
}

export interface Hitbox {
  offset: Vec2;
  size: Vec2; // genişlik, yükseklik
}

export interface AttackDef {
  id: string;
  name: string;
  frames: FrameData;
  hitbox: Hitbox;
  meterCost?: number;
  /** Özel efekt türü (Mjölnir, yıldırım vb.). */
  effect?: string;
}

export interface CharacterDef {
  id: string;
  name: string;
  classLabel: string;
  maxHp: number;
  maxMeter: number;
  speed: number;
  armor: number; // 0-1 hasar azaltma
  hurtbox: Vec2; // genişlik, yükseklik
  groundLevel: number;
  attacks: Record<string, AttackDef>;
  /** Görsel kimlik (varsa). */
  palette?: { body: string; head: string; accent: string };
  /** Kaynak CharacterData (veri şemasına bağlantı). */
  characterData?: CharacterData;
}

/** 6 frame input buffer girişi. */
export interface BufferedInput {
  action: InputAction;
  age: number; // frame cinsinden kaç kare önce basıldı
  priority: InputPriority;
}

// ---------------------------------------------------------------------------
// Karakter kadrosu veri yapısı
// ---------------------------------------------------------------------------

/** Karakterin bağlı olduğu mitoloji panteonu. */
export enum Pantheon {
  GREEK = "GREEK",
  EGYPTIAN = "EGYPTIAN",
  NORSE = "NORSE",
  TURKIC = "TURKIC",
  JAPANESE = "JAPANESE",
}

/** Oynanış sınıfı / archetype. */
export enum Archetype {
  RUSHDOWN = "RUSHDOWN",
  ZONER = "ZONER",
  GRAPPLER = "GRAPPLER",
  BRAWLER = "BRAWLER",
  CROWD_CONTROL = "CROWD_CONTROL",
  AERIAL = "AERIAL",
  STANCE = "STANCE",
  BEAST = "BEAST",
  TANK = "TANK",
  NECROMANCER = "NECROMANCER",
}

/** Temel stat bloğu. */
export interface BaseStats {
  hp: number;
  attackPower: number;
  movementSpeed: number;
  armor: number; // 0-1 arası hasar azaltma yüzdesi
}

/** Pasif / Ultimate yetenek tanımı. */
export interface AbilityDef {
  name: string;
  description: string;
}

/**
 * CharacterData — kullanıcı tarafından istenen 5 ana alanı içeren
 * ve oyuna bağlı oynanabilirlik alanlarıyla genişletilmiş karakter şeması.
 */
export interface CharacterData {
  /** Benzersiz tanımlayıcı (e.g. "achilles"). */
  id: string;
  characterName: string;
  pantheon: Pantheon;
  archetype: Archetype;
  passiveAbilityName: string;
  passiveDescription: string;
  ultimateName: string;
  ultimateDescription: string;
  baseStats: BaseStats;
  /** Oynanabilirlik: kit şablonu ve görsel kimlik. */
  kitId: string;
  palette: { body: string; head: string; accent: string };
  /** Oynanabilir frame data seti (CharacterDef'e bağlanır). */
  moveSet: Record<string, AttackDef>;
}
