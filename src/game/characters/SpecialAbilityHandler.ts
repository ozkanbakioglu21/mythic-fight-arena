import { CharacterData } from "../types";
import { Fighter } from "../Fighter";

/**
 * SpecialAbilityHandler — karakterlerin Pasif ve Ultimate yetenek
 * tetiklemelerini yöneten mekanik sınıfı.
 *
 * Herfighter için pasif ve ultimate davranışlarını, dövüş olaylarına
 * (isabet verdi, hasar aldı, blokladı, parryledi, öldürdü, canı düşükken,
 * ultimate attı) bağlar. Özel efektler `AbilityContext` üzerinden uygulanır.
 *
 * Bu sınıf, isim tabanlı yetenekleri eşleyip modüler hook'lar olarak
 * düzenler; yeni karakterler eklerken yalnızca isim + davranış eklenir.
 */

interface AbilityContext {
  self: Fighter;
  opponent?: Fighter;
  amount: number; // isabet hasarı vb.
  frames: number; // olay kareleri
}

type Effect = (ctx: AbilityContext) => void;

/**
 * Build-time yapılandırılmış pasif / ultimate davranışları.
 * İsim -> davranış eşlemesi; tanınmayan isimler no-op olur.
 */
export class SpecialAbilityHandler {
  /** Pasif davranışlar için hook tablosu. */
  private passiveEffects = new Map<string, Effect>();
  /** Ultimate davranışlar için hook tablosu. */
  private ultimateEffects = new Map<string, Effect>();
  /** Karakter verisi (pasif/ultimate isimleri için). */
  private data: CharacterData | null = null;

  constructor(_owner: Fighter) {
    this.registerDefaults();
  }

  /** Bu handler'a ait karakterin kaynak verisi. */
  setup(data: CharacterData): void {
    this.data = data;
  }

  getData(): CharacterData | null {
    return this.data;
  }

  /** Pasif adının tanımlı olup olmadığı. */
  hasPassive(name: string): boolean {
    return this.passiveEffects.has(name);
  }

  /** Ultimate adının tanımlı olup olmadığı. */
  hasUltimate(name: string): boolean {
    return this.ultimateEffects.has(name);
  }

  /** Pasif davranışını tetikler (karakterin kayıtlı pasif adıyla). */
  triggerPassive(ctx: AbilityContext): void {
    const name = this.data?.passiveAbilityName;
    if (!name) return;
    this.passiveEffects.get(name)?.(ctx);
  }

  /** Ultimate davranışını tetikler. */
  triggerUltimate(ctx: AbilityContext): void {
    const name = this.data?.ultimateName;
    if (!name) return;
    this.ultimateEffects.get(name)?.(ctx);
  }

  /** Karakterin pasif/ultimate ismine göre tip kontrolü. */
  getPassiveName(): string {
    return this.data?.passiveAbilityName ?? "";
  }
  getUltimateName(): string {
    return this.data?.ultimateName ?? "";
  }

  // -------------------------------------------------------------------------
  // Davranış kayıtları (yeni yetenek eklemek için buraya satır eklenir).
  // -------------------------------------------------------------------------
  private registerDefaults(): void {
    // --- YUNAN ---
    this.passiveEffects.set("Topuk Zafiyeti", () => {}); // arkadan hasar modifiye Battle'da
    this.passiveEffects.set("Gorgon Bakışı", () => {}); // stun — Battle hook
    this.passiveEffects.set("Statik Şok", () => {});
    this.passiveEffects.set("Labirent Boğası", () => {});
    this.passiveEffects.set("Ruh Suyu", () => {});
    this.passiveEffects.set("Nemea Derisi", (ctx) => {
      // Super armor: saldırı sırasında kesintiye uğramaz (zaten kit'te armor var).
      if (ctx.self.getPose().attacking) {
        ctx.self.velocity.x = 0;
      }
    });
    this.passiveEffects.set("Ay Tuzağı", () => {});
    this.passiveEffects.set("Savaş Hırsı", () => {}); // low HP bonus — Battle hook
    this.passiveEffects.set("Tsunami Dalgası", () => {});
    this.passiveEffects.set("Üçlü Nefes", () => {});

    // --- MISIR ---
    this.passiveEffects.set("Ruh Çalma", () => {}); // lifesteal — Battle hook
    this.passiveEffects.set("Kan Susuzluğu", () => {});
    this.passiveEffects.set("Güneş Körlüğü", () => {});
    this.passiveEffects.set("Timsah Derisi", () => {}); // armor zaten stat'ta
    this.passiveEffects.set("Solar Lazer", () => {});
    this.passiveEffects.set("Duvar Sıçraması", () => {});
    this.passiveEffects.set("Kaos Fırtınası", () => {});
    this.passiveEffects.set("Kutsal Kayıt", () => {});
    this.passiveEffects.set("Çift Form", () => {});
    this.passiveEffects.set("Asit Havuzu", () => {});

    // --- İSKANDİNAV ---
    this.passiveEffects.set("Mjölnir Fırlatma", () => {}); // çekme — Battle hook
    this.passiveEffects.set("Gölge Klon", () => {});
    this.passiveEffects.set("Ruh Kılıçları", () => {});
    this.passiveEffects.set("Vahşi Isırık", () => {}); // bleed — Battle hook
    this.passiveEffects.set("Kuzgun Gözü", () => {});
    this.passiveEffects.set("Işık & Çürüme", () => {});
    this.passiveEffects.set("Alev İzleri", () => {});
    this.passiveEffects.set("Zehirli Sarma", () => {});
    this.passiveEffects.set("Gjallarhorn İkazı", () => {});
    this.passiveEffects.set("Buz Kayması", () => {});

    // --- TÜRK ---
    this.passiveEffects.set("Körmös Çağrısı", () => {});
    this.passiveEffects.set("Kutsal Yıldırım", () => {});
    this.passiveEffects.set("Zehirli Sarmal", () => {});
    this.passiveEffects.set("Al Basması", () => {});
    this.passiveEffects.set("Rüzgar Atılması", () => {});
    this.passiveEffects.set("Mistik Göz Işını", () => {});
    this.passiveEffects.set("Ak Koruma", () => {});
    this.passiveEffects.set("Kutsal Kükreme", () => {});
    this.passiveEffects.set("Volkanik Ateş", () => {});
    this.passiveEffects.set("Yeraltı Yutuşu", () => {});

    // --- JAPON ---
    this.passiveEffects.set("Ruyi Jingu Bang", () => {});
    this.passiveEffects.set("Taiko Davulu", () => {});
    this.passiveEffects.set("Rüzgar Çekimi", () => {});
    this.passiveEffects.set("Mavi Ateş", () => {});
    this.passiveEffects.set("Iaijutsu", () => {});
    this.passiveEffects.set("Kutsal Ayna", () => {});
    this.passiveEffects.set("Çoklu Saldırı", () => {});
    this.passiveEffects.set("Rüzgar Süzülmesi", () => {});
    this.passiveEffects.set("Yomi Elleri", () => {});
    this.passiveEffects.set("Zırh Kırıcı", () => {});

    // --- ULTIMATE (tüm panteonlar) ---
    const ultimates = [
      "Troya Öfkesi", "Yılan Yuvası", "Olympos Gazabı", "Yıkıcı Ezme",
      "Styx Katliamı", "12 Görev Vuruşu", "Gümüş Ok Yağmuru", "Kanlı Katliam",
      "Deprem & Okyanus", "Yeraltı Avı", "Mumyalama", "Aslan Gazabı",
      "Göklerin Hakimi", "Ölüm Dönüşü", "Süpernova", "Görünmez Kedi",
      "Kum Yutumu", "Zaman Mührü", "Nil'in Dirilişi", "Karanlık Yutuş",
      "Kıyamet Yıldırımı", "Hilekarın Ağı", "Valhalla Çağrısı",
      "Ragnarök Yırtıcısı", "Asla Iskamayan Mızrak", "Helheim Zindanı",
      "Muspelheim Yangını", "Okyanus Sıkıştırması", "Bifröst Işını",
      "Dondurucu Tipi", "Dokuz Kat Yeraltı", "Altın Dağ Işığı",
      "Yılanların Şahı", "Gece Kabusu", "Gök Gürültüsü Koşusu",
      "Dev Sopası Ezmesi", "Kutsal Ruh Gazabı", "Ejderha Kasırgası",
      "Magma Patlaması", "Karanlık Yutuculuk", "100 Klon Vuruşu",
      "Yıldırım Senfonisi", "Kasırga Sıkıştırması", "9 Kuyruk Büyüsü",
      "Orochi Kesişi", "Güneş Doğuşu", "8 Başlı Gazap", "Fırtına Yelpazesi",
      "Ölüler Diyarı Kapısı", "İblis Ezmesi",
    ];
    for (const name of ultimates) {
      this.ultimateEffects.set(name, (ctx) => {
        // Ultimate standart davranışı: kit'te zaten büyük hasar sağlar.
        // Burada ekstra efektler için placeholder.
        void ctx;
      });
    }
  }
}
