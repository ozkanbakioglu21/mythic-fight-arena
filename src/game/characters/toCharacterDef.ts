import { CharacterData, CharacterDef, AttackDef } from "../types";

/**
 * CharacterData -> CharacterDef dönüştürücüsü.
 *
 * Karakterin baseStats.attackPower'ı kit şablonundaki hasar değerlerini
 * ölçeklendirir (100 taban kabul edilir). Böylece her karakterin temel
 * saldırı seti ortak şablondan beslenip kişiselleştirilmiş olur.
 */
export function toCharacterDef(data: CharacterData): CharacterDef {
  const scale = data.baseStats.attackPower / 100;

  const attacks = Object.fromEntries(
    Object.entries(data.moveSet).map(([key, atk]) => {
      const scaled: AttackDef = {
        ...atk,
        frames: {
          ...atk.frames,
          damage: Math.round(atk.frames.damage * scale),
        },
      };
      return [key, scaled];
    }),
  ) as Record<string, AttackDef>;

  return {
    id: data.id,
    name: data.characterName,
    classLabel: data.archetype,
    maxHp: data.baseStats.hp,
    maxMeter: 100,
    speed: data.baseStats.movementSpeed,
    armor: data.baseStats.armor,
    hurtbox: { x: 44, y: 84 },
    groundLevel: 0,
    attacks,
    palette: data.palette,
    characterData: data,
  };
}
