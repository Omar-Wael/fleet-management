declare module 'arabic-persian-reshaper' {
  interface Shaper {
    /** Converts Arabic letters in `input` to their correct joined presentation-form glyphs. */
    convertArabic(input: string): string;
  }

  export const ArabicShaper: Shaper;
  export const PersianShaper: Shaper;
}
