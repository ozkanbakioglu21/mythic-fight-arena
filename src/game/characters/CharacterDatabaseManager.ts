import { Archetype, CharacterData, Pantheon } from "../types";
import { ALL_CHARACTERS } from "../data";

/**
 * CharacterDatabaseManager — 50 karakterin verisini hafızada tutan,
 * Panteon veya Sınıfa (Archetype) göre filtreleme yapabilen Singleton servis.
 *
 * Tek bir örneği (`.instance`) vardır; uygulama boyunca paylaşılır.
 */
export class CharacterDatabaseManager {
  private static _instance: CharacterDatabaseManager;
  private readonly characters: CharacterData[];

  static get instance(): CharacterDatabaseManager {
    if (!this._instance) this._instance = new CharacterDatabaseManager();
    return this._instance;
  }

  private constructor() {
    this.characters = ALL_CHARACTERS;
  }

  /** Tüm kadroyu döndürür. */
  getAll(): CharacterData[] {
    return this.characters;
  }

  /** Toplam karakter sayısı. */
  getCount(): number {
    return this.characters.length;
  }

  /** ID'ye göre tek karakter bulur. */
  getById(id: string): CharacterData | undefined {
    return this.characters.find((c) => c.id === id);
  }

  /** Panteona göre filtreler. */
  byPantheon(pantheon: Pantheon): CharacterData[] {
    return this.characters.filter((c) => c.pantheon === pantheon);
  }

  /** Sınıfa (archetype) göre filtreler. */
  byArchetype(archetype: Archetype): CharacterData[] {
    return this.characters.filter((c) => c.archetype === archetype);
  }

  /** Hem panteon hem archetype'a göre filtreler. */
  byPantheonAndArchetype(
    pantheon: Pantheon,
    archetype: Archetype,
  ): CharacterData[] {
    return this.characters.filter(
      (c) => c.pantheon === pantheon && c.archetype === archetype,
    );
  }

  /** İsme göre arama (case-insensitive, kısmi eşleşme). */
  searchByName(query: string): CharacterData[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.characters;
    return this.characters.filter((c) =>
      c.characterName.toLowerCase().includes(q),
    );
  }

  /** Tüm panteon kategorilerini döndürür (UI filtre çubuğu için). */
  getPantheons(): Pantheon[] {
    return [
      Pantheon.GREEK,
      Pantheon.EGYPTIAN,
      Pantheon.NORSE,
      Pantheon.TURKIC,
      Pantheon.JAPANESE,
    ];
  }
}
