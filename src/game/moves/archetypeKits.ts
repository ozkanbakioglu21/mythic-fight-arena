import { AttackDef } from "../types";

/**
 * Archetype kit şablonları.
 *
 * 10 archetype'ın her biri için ortak bir saldırı seti (light/heavy/special/
 * ultimate) tanımlar. Karakterlerin baseStats.attackPower bu değerleri
 * ölçeklendirir; böylece 50 karakter tek tabandan beslenir ve kolayca
 * genişletilebilir olur.
 */

export type KitKey =
  | "rushdown"
  | "zoner"
  | "grappler"
  | "brawler"
  | "crowd_control"
  | "aerial"
  | "stance"
  | "beast"
  | "tank"
  | "necromancer";

function def(
  id: string,
  name: string,
  startup: number,
  active: number,
  recovery: number,
  damage: number,
  knockbackX: number,
  hitstun: number,
  opts: Partial<AttackDef["frames"]> = {},
  extra: Partial<Omit<AttackDef, "frames" | "hitbox">> = {},
): AttackDef {
  return {
    id,
    name,
    frames: {
      startup,
      active,
      recovery,
      damage,
      knockback: { x: knockbackX, y: 0 },
      hitstunFrames: hitstun,
      parryable: true,
      ...opts,
    },
    hitbox: { offset: { x: 26, y: -36 }, size: { x: 32, y: 36 } },
    ...extra,
  };
}

export const KITS: Record<KitKey, Record<string, AttackDef>> = {
  rushdown: {
    light: def("light", "Hızlı Yumruk", 4, 3, 8, 6, 3, 10),
    heavy: def("heavy", "Sert Tekme", 8, 4, 12, 14, 7, 18),
    special: def("special", "Akın Tekmesi", 10, 4, 14, 16, 9, 20),
    ultimate: def("ultimate", "Kombo Darbesi", 12, 8, 24, 30, 10, 32, { launch: true }, { meterCost: 100 }),
  },
  zoner: {
    light: def("light", "Enerji Nabzı", 6, 4, 10, 7, 4, 12),
    heavy: def("heavy", "Patlayıcı Işın", 12, 5, 16, 15, 7, 18),
    special: def("special", "Kalkan Balonu", 14, 6, 18, 18, 5, 20),
    ultimate: def("ultimate", "Menzil Saldırısı", 16, 10, 30, 32, 9, 30, { launch: true }, { meterCost: 100 }),
  },
  grappler: {
    light: def("light", "Kapma", 7, 4, 10, 8, 2, 14),
    heavy: def("heavy", "Sırt Atışı", 10, 5, 14, 17, 6, 22, { armor: true }),
    special: def("special", "Command Grab", 8, 6, 16, 20, 4, 26, { blockDamage: 10 }),
    ultimate: def("ultimate", "Ezme", 14, 8, 26, 34, 10, 36, { launch: true, armor: true }, { meterCost: 100 }),
  },
  brawler: {
    light: def("light", "Yumruk", 6, 4, 9, 8, 3, 12),
    heavy: def("heavy", "Çekiç Vuruşu", 12, 5, 16, 18, 8, 22, { armor: true }),
    special: def("special", "Güç Darbesi", 13, 5, 18, 22, 9, 24),
    ultimate: def("ultimate", "Devasa Yumruk", 16, 9, 30, 38, 12, 40, { launch: true, armor: true }, { meterCost: 100 }),
  },
  crowd_control: {
    light: def("light", "Damar Vuruşu", 6, 4, 10, 7, 3, 14),
    heavy: def("heavy", "Baskın Darbesi", 12, 5, 16, 15, 6, 22),
    special: def("special", "Kontrol Darbesi", 13, 5, 18, 17, 7, 26, { hitstunFrames: 26 }),
    ultimate: def("ultimate", "Alan Fırtınası", 15, 9, 28, 33, 10, 38, { launch: true }, { meterCost: 100 }),
  },
  aerial: {
    light: def("light", "Havadan Vuruş", 5, 3, 8, 6, 3, 10, { knockback: { x: 2, y: -2 } }),
    heavy: def("heavy", "Dikine Çakılma", 10, 5, 14, 16, 6, 20, { knockback: { x: 0, y: -5 }, launch: true }),
    special: def("special", "Süzülme Darbesi", 11, 4, 14, 18, 7, 20),
    ultimate: def("ultimate", "Gökten İniş", 14, 8, 26, 36, 9, 36, { launch: true }, { meterCost: 100 }),
  },
  stance: {
    light: def("light", "Form Vuruşu", 6, 4, 10, 7, 3, 12),
    heavy: def("heavy", "Ağır Form", 11, 5, 16, 16, 7, 20, { armor: true }),
    special: def("special", "Form Değişikliği", 12, 4, 16, 16, 6, 20),
    ultimate: def("ultimate", "Ustalık Darbesi", 15, 8, 28, 34, 10, 36, { launch: true }, { meterCost: 100 }),
  },
  beast: {
    light: def("light", "Pençe", 5, 4, 9, 9, 4, 12, { blockDamage: 4 }),
    heavy: def("heavy", "Sıçrayan Isırık", 10, 5, 14, 18, 7, 24, { knockback: { x: 6, y: -3 }, launch: true }),
    special: def("special", "Saldırı", 12, 4, 16, 20, 8, 24, { armor: true }),
    ultimate: def("ultimate", "Canavarsı Darbe", 15, 9, 28, 36, 12, 40, { launch: true, armor: true }, { meterCost: 100 }),
  },
  tank: {
    light: def("light", "Ağır Yumruk", 8, 4, 12, 8, 3, 12),
    heavy: def("heavy", "Ezici Darbe", 14, 6, 18, 19, 8, 22, { armor: true }),
    special: def("special", "Kalkan Bindirmesi", 15, 5, 18, 21, 9, 24, { armor: true }),
    ultimate: def("ultimate", "Bölge Ezmesi", 18, 10, 32, 40, 12, 40, { launch: true, armor: true }, { meterCost: 100 }),
  },
  necromancer: {
    light: def("light", "Ruh Darbesi", 7, 4, 11, 8, 3, 12),
    heavy: def("heavy", "Kemik Fırlatma", 12, 5, 16, 16, 7, 20),
    special: def("special", "Ruh Eline", 13, 5, 18, 18, 7, 24),
    ultimate: def("ultimate", "Ölüler Ordusu", 16, 10, 30, 35, 10, 38, { launch: true }, { meterCost: 100 }),
  },
};
