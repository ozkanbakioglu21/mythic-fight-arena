import { CharacterData, Pantheon, Archetype, BaseStats, AbilityDef } from "../types";
import { KITS, KitKey } from "../moves/archetypeKits";

/** Panteon dosyalarında kullanılan ham karakter girişi. */
export interface RosterEntry {
  id: string;
  name: string;
  archetype: Archetype;
  passive: AbilityDef;
  ultimate: AbilityDef;
  stats: BaseStats;
  kit: KitKey;
  palette: { body: string; head: string; accent: string };
}

/** Ham girişleri CharacterData şemasına çevirir (moveSet = archetype kiti). */
export function buildRoster(
  list: RosterEntry[],
  pantheon: Pantheon,
): CharacterData[] {
  return list.map((e) => ({
    id: e.id,
    characterName: e.name,
    pantheon,
    archetype: e.archetype,
    passiveAbilityName: e.passive.name,
    passiveDescription: e.passive.description,
    ultimateName: e.ultimate.name,
    ultimateDescription: e.ultimate.description,
    baseStats: e.stats,
    kitId: e.kit,
    palette: e.palette,
    moveSet: KITS[e.kit],
  }));
}
