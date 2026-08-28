import { Archetype, CharacterData, Pantheon } from "../types";
import { CharacterDatabaseManager } from "./CharacterDatabaseManager";
import { toCharacterDef } from "./toCharacterDef";

/** Karakter seçim tarafı (P1 / P2). */
export enum SelectSide {
  P1 = "P1",
  P2 = "P2",
}

/** Her tarafın seçim durumu. */
export interface SelectionState {
  side: SelectSide;
  selectedId: string | null; // seçilen karakterin kaynağı (veri tabanı id'si)
  confirmed: boolean;
}

/**
 * CharacterSelectController — Karakter seçim ekranının UI mantığı ve
 * P1 / P2 seçim durumlarını yönetir.
 *
 * - Görünür liste, panteon/sınıf filtresi ve arama uygular.
 * - Her iki tarafın seçim & onay durumunu tutar.
 * - Seçilen karakteri oyunda kullanılabilir CharacterDef'e dönüştürür.
 */
export class CharacterSelectController {
  private db = CharacterDatabaseManager.instance;

  private pantheonFilter: Pantheon | "ALL" = "ALL";
  private archetypeFilter: Archetype | "ALL" = "ALL";
  private searchQuery = "";

  private states: Record<SelectSide, SelectionState> = {
    [SelectSide.P1]: { side: SelectSide.P1, selectedId: null, confirmed: false },
    [SelectSide.P2]: { side: SelectSide.P2, selectedId: null, confirmed: false },
  };

  /** Mevcut filtrelere göre görünür karakter listesi. */
  getVisibleCharacters(): CharacterData[] {
    let result = this.db.getAll();
    if (this.pantheonFilter !== "ALL") {
      result = result.filter((c) => c.pantheon === this.pantheonFilter);
    }
    if (this.archetypeFilter !== "ALL") {
      result = result.filter((c) => c.archetype === this.archetypeFilter);
    }
    if (this.searchQuery.trim()) {
      result = this.db.searchByName(this.searchQuery);
    }
    return result;
  }

  setPantheonFilter(p: Pantheon | "ALL"): void {
    this.pantheonFilter = p;
  }
  setArchetypeFilter(a: Archetype | "ALL"): void {
    this.archetypeFilter = a;
  }
  setSearch(q: string): void {
    this.searchQuery = q;
  }

  getPantheonFilter(): Pantheon | "ALL" {
    return this.pantheonFilter;
  }
  getArchetypeFilter(): Archetype | "ALL" {
    return this.archetypeFilter;
  }

  /** Bir taraf için karakter seçer. */
  select(side: SelectSide, characterId: string): void {
    this.states[side].selectedId = characterId;
    this.states[side].confirmed = false;
  }

  /** Seçimi onaylar (kilitleme). */
  confirm(side: SelectSide): boolean {
    if (!this.states[side].selectedId) return false;
    this.states[side].confirmed = true;
    return true;
  }

  getSelection(side: SelectSide): SelectionState {
    return this.states[side];
  }

  /** Her iki taraf da onayladı mı. */
  isReady(): boolean {
    return this.states[SelectSide.P1].confirmed && this.states[SelectSide.P2].confirmed;
  }

  /** Veritabanından ID çözümleyip CharacterDef'e çevirir. */
  resolveDefForSide(side: SelectSide) {
    const sel = this.states[side].selectedId;
    if (!sel) {
      // Varsayılan: ilk karakter.
      const fallback = this.db.getById("thor") ?? this.db.getAll()[0];
      return fallback ? toCharacterDef(fallback) : undefined;
    }
    const data = this.db.getById(sel);
    return data ? toCharacterDef(data) : undefined;
  }

  /** Seçilebilir tüm karakterlerin kısa listesi (grid için). */
  getAllForGrid(): CharacterData[] {
    return this.db.getAll();
  }

  resetSelectors(): void {
    this.states[SelectSide.P1] = { side: SelectSide.P1, selectedId: null, confirmed: false };
    this.states[SelectSide.P2] = { side: SelectSide.P2, selectedId: null, confirmed: false };
  }
}
