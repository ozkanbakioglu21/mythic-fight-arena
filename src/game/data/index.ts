import { CharacterData } from "../types";
import { GREEK_CHARACTERS } from "./greek";
import { EGYPTIAN_CHARACTERS } from "./egyptian";
import { NORSE_CHARACTERS } from "./norse";
import { TURKIC_CHARACTERS } from "./turkic";
import { JAPANESE_CHARACTERS } from "./japanese";

/** 50 karakterlik tam mitolojik kadro. */
export const ALL_CHARACTERS: CharacterData[] = [
  ...GREEK_CHARACTERS,
  ...EGYPTIAN_CHARACTERS,
  ...NORSE_CHARACTERS,
  ...TURKIC_CHARACTERS,
  ...JAPANESE_CHARACTERS,
];

export { GREEK_CHARACTERS, EGYPTIAN_CHARACTERS, NORSE_CHARACTERS, TURKIC_CHARACTERS, JAPANESE_CHARACTERS };
