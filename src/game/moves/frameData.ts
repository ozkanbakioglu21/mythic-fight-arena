import { AttackDef, CharacterDef } from "../types";

/**
 * Karakter ve canavar frame data tanımları.
 * Her saldırı: startup / active / recovery kareleri, hasar, itme,
 * hitstun ve opsiyonel efektler içerir.
 */

// ---------------------------------------------------------------------------
// THOR — İskandinav Heavy Brawler
// ---------------------------------------------------------------------------
export const THOR_ATTACKS: Record<string, AttackDef> = {
  light: {
    id: "thor_light",
    name: "Yumruk Yayılımı",
    frames: {
      startup: 6,
      active: 4,
      recovery: 8,
      damage: 8,
      knockback: { x: 3, y: 0 },
      hitstunFrames: 12,
      parryable: true,
    },
    hitbox: { offset: { x: 26, y: -34 }, size: { x: 30, y: 34 } },
  },
  heavy: {
    id: "thor_heavy",
    name: "Yıldırım Çekici",
    frames: {
      startup: 12,
      active: 5,
      recovery: 16,
      damage: 18,
      knockback: { x: 7, y: 0 },
      hitstunFrames: 20,
      parryable: true,
    },
    hitbox: { offset: { x: 30, y: -38 }, size: { x: 34, y: 40 } },
  },
  // Özel Yetenek: Mjölnir Fırlatma — rakibi kendine çekip yıldırım alan hasarı verir.
  special: {
    id: "thor_mjolnir",
    name: "Mjölnir Fırlatma",
    frames: {
      startup: 14,
      active: 6,
      recovery: 20,
      damage: 14,
      knockback: { x: -6, y: 0 }, // negatif x: rakibi çeker
      hitstunFrames: 24,
      parryable: true,
    },
    hitbox: { offset: { x: 40, y: -40 }, size: { x: 50, y: 22 } },
    meterCost: 25,
    effect: "mjolnir",
  },
  // Ultimate: Kıyamet Yıldırımı — yüksek hasar + gökten inen yıldırım alanı.
  ultimate: {
    id: "thor_rapture",
    name: "Kıyamet Yıldırımı",
    frames: {
      startup: 18,
      active: 10,
      recovery: 30,
      damage: 38,
      knockback: { x: 12, y: -6 },
      hitstunFrames: 40,
      launch: true,
    },
    hitbox: { offset: { x: 20, y: -60 }, size: { x: 90, y: 70 } },
    meterCost: 100,
    effect: "rapture",
  },
};

export const THOR: CharacterDef = {
  id: "thor",
  name: "Thor",
  classLabel: "Heavy Brawler",
  maxHp: 250,
  maxMeter: 100,
  speed: 3.2,
  hurtbox: { x: 44, y: 84 },
  groundLevel: 0, // dinamik olarak sahne ayarlar
  attacks: THOR_ATTACKS,
};

// ---------------------------------------------------------------------------
// ORC — Dungeon canavarı (Super Armor Brawler)
// ---------------------------------------------------------------------------
export const ORC_ATTACKS: Record<string, AttackDef> = {
  light: {
    id: "orc_claw",
    name: "Pençe",
    frames: {
      startup: 7,
      active: 4,
      recovery: 10,
      damage: 9,
      knockback: { x: 3, y: 0 },
      hitstunFrames: 12,
      parryable: true,
      armor: true,
    },
    hitbox: { offset: { x: 24, y: -32 }, size: { x: 28, y: 32 } },
  },
  heavy: {
    id: "orc_smash",
    name: "Yer Sarsıntısı",
    frames: {
      startup: 14,
      active: 6,
      recovery: 22,
      damage: 20,
      knockback: { x: 8, y: 0 },
      hitstunFrames: 22,
      parryable: true,
      armor: true,
    },
    hitbox: { offset: { x: 28, y: -30 }, size: { x: 36, y: 30 } },
  },
  special: {
    id: "orc_charge",
    name: "Öfkeli Hücum",
    frames: {
      startup: 16,
      active: 8,
      recovery: 24,
      damage: 24,
      knockback: { x: 14, y: 0 },
      hitstunFrames: 26,
      armor: true,
    },
    hitbox: { offset: { x: 34, y: -34 }, size: { x: 44, y: 34 } },
    effect: "charge",
  },
};

export const ORC: CharacterDef = {
  id: "orc",
  name: "Orc",
  classLabel: "Super Armor Brawler",
  maxHp: 180,
  maxMeter: 100,
  speed: 2.2,
  hurtbox: { x: 52, y: 90 },
  groundLevel: 0,
  attacks: ORC_ATTACKS,
};

// ---------------------------------------------------------------------------
// DUNGEON CANAVARLARI — Realm of Beasts
// Her canavar ORC saldırı setini paylaşır; yalnızca statlar ve gösterim farklıdır.
// ---------------------------------------------------------------------------
const goblin = {
  id: "goblin",
  name: "Goblin",
  classLabel: "Zayıf Sürü Hayvanı",
  maxHp: 80,
  speed: 3.4,
  hurtbox: { x: 36, y: 60 },
};

const skeleton = {
  id: "skeleton",
  name: "İskelet Asker",
  classLabel: "Hızlı Kılıçlı",
  maxHp: 120,
  speed: 3.0,
  hurtbox: { x: 40, y: 76 },
};

const troll = {
  id: "troll",
  name: "Troll",
  classLabel: "Ağır Hasar",
  maxHp: 260,
  speed: 1.7,
  hurtbox: { x: 60, y: 96 },
};

const giant = {
  id: "giant",
  name: "Dev",
  classLabel: "Boss Sınıfı",
  maxHp: 420,
  speed: 1.3,
  hurtbox: { x: 74, y: 120 },
};

export const MONSTERS: Record<string, CharacterDef> = {
  goblin: { ...goblin, maxMeter: 100, groundLevel: 0, attacks: ORC_ATTACKS },
  skeleton: {
    ...skeleton,
    maxMeter: 100,
    groundLevel: 0,
    attacks: ORC_ATTACKS,
  },
  troll: { ...troll, maxMeter: 100, groundLevel: 0, attacks: ORC_ATTACKS },
  giant: { ...giant, maxMeter: 100, groundLevel: 0, attacks: ORC_ATTACKS },
};

export const ALL_FIGHTERS: Record<string, CharacterDef> = {
  thor: THOR,
  ...MONSTERS,
};
