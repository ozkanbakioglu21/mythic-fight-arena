import { CharacterData, Pantheon, Archetype } from "../types";
import { buildRoster, RosterEntry } from "./buildKit";

/**
 * Yunan Pantheonu (GREEK) karakterleri.
 * Kullanıcı talebindeki 10 karakter, tanımlanan CharacterData şemasına uygun.
 */

type Entry = RosterEntry;

const LIST: Entry[] = [
  {
    id: "achilles",
    name: "Achilles",
    archetype: Archetype.RUSHDOWN,
    passive: { name: "Topuk Zafiyeti", description: "Önden hızlı, arkadan %30 fazla hasar alır." },
    ultimate: { name: "Troya Öfkesi", description: "8'li kombo." },
    stats: { hp: 240, attackPower: 120, movementSpeed: 3.6, armor: 0.1 },
    kit: "rushdown",
    palette: { body: "#c9a24a", head: "#8a6d2a", accent: "#e8c061" },
  },
  {
    id: "medusa",
    name: "Medusa",
    archetype: Archetype.CROWD_CONTROL,
    passive: { name: "Gorgon Bakışı", description: "1.5sn Stun verir." },
    ultimate: { name: "Yılan Yuvası", description: "Zehir alanı." },
    stats: { hp: 210, attackPower: 100, movementSpeed: 3.0, armor: 0.08 },
    kit: "crowd_control",
    palette: { body: "#4d8f5a", head: "#2c5a34", accent: "#7fd18a" },
  },
  {
    id: "zeus",
    name: "Zeus",
    archetype: Archetype.ZONER,
    passive: { name: "Statik Şok", description: "3 birikimde sersemletir." },
    ultimate: { name: "Olympos Gazabı", description: "Yıldırım sütunu." },
    stats: { hp: 220, attackPower: 115, movementSpeed: 2.9, armor: 0.12 },
    kit: "zoner",
    palette: { body: "#3a6ea9", head: "#e0e8f2", accent: "#9ec9ff" },
  },
  {
    id: "minotaur",
    name: "Minotaur",
    archetype: Archetype.GRAPPLER,
    passive: { name: "Labirent Boğası", description: "Command Grab." },
    ultimate: { name: "Yıkıcı Ezme", description: "Bloklanamaz darbe." },
    stats: { hp: 290, attackPower: 110, movementSpeed: 2.6, armor: 0.18 },
    kit: "grappler",
    palette: { body: "#8a4a3a", head: "#c96a55", accent: "#e0a090" },
  },
  {
    id: "hades",
    name: "Hades",
    archetype: Archetype.NECROMANCER,
    passive: { name: "Ruh Suyu", description: "Yeraltı elleri." },
    ultimate: { name: "Styx Katliamı", description: "Ölüler ordusu." },
    stats: { hp: 240, attackPower: 118, movementSpeed: 2.8, armor: 0.14 },
    kit: "necromancer",
    palette: { body: "#3a2f4d", head: "#5a4d7a", accent: "#9a7ad0" },
  },
  {
    id: "hercules",
    name: "Hercules",
    archetype: Archetype.BRAWLER,
    passive: { name: "Nemea Derisi", description: "Super Armor." },
    ultimate: { name: "12 Görev Vuruşu", description: "Devasa yumruk." },
    stats: { hp: 280, attackPower: 125, movementSpeed: 2.7, armor: 0.2 },
    kit: "brawler",
    palette: { body: "#6a5a3a", head: "#8a7a55", accent: "#c9b06a" },
  },
  {
    id: "artemis",
    name: "Artemis",
    archetype: Archetype.ZONER,
    passive: { name: "Ay Tuzağı", description: "Sabitleme." },
    ultimate: { name: "Gümüş Ok Yağmuru", description: "Ok sağanağı." },
    stats: { hp: 200, attackPower: 105, movementSpeed: 3.3, armor: 0.06 },
    kit: "zoner",
    palette: { body: "#4a5a7a", head: "#c9d0c0", accent: "#a8b8d8" },
  },
  {
    id: "ares",
    name: "Ares",
    archetype: Archetype.RUSHDOWN,
    passive: { name: "Savaş Hırsı", description: "Can düştükçe +%40 hız ve hasar." },
    ultimate: { name: "Kanlı Katliam", description: "Döner fırtına." },
    stats: { hp: 250, attackPower: 122, movementSpeed: 3.4, armor: 0.15 },
    kit: "rushdown",
    palette: { body: "#a03a2a", head: "#7a2a20", accent: "#e06050" },
  },
  {
    id: "poseidon",
    name: "Poseidon",
    archetype: Archetype.CROWD_CONTROL,
    passive: { name: "Tsunami Dalgası", description: "Wall Bounce." },
    ultimate: { name: "Deprem & Okyanus", description: "Sualtı alanı." },
    stats: { hp: 235, attackPower: 108, movementSpeed: 2.8, armor: 0.13 },
    kit: "crowd_control",
    palette: { body: "#2a6a7a", head: "#4a9aaa", accent: "#7fd5e0" },
  },
  {
    id: "cerberus",
    name: "Cerberus",
    archetype: Archetype.BEAST,
    passive: { name: "Üçlü Nefes", description: "Ateş/Zehir/Buz geçişi." },
    ultimate: { name: "Yeraltı Avı", description: "Yeraltına sürükler." },
    stats: { hp: 250, attackPower: 115, movementSpeed: 3.1, armor: 0.16 },
    kit: "beast",
    palette: { body: "#5a3a3a", head: "#8a5a55", accent: "#d98a6a" },
  },
];

export const GREEK_CHARACTERS: CharacterData[] = buildRoster(LIST, Pantheon.GREEK);
