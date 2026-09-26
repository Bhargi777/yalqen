import type { FontSizeSetting, PageLanguage } from '../shared/types.js';

/** Default font size in CSS pixels, as in Chromium's settings. */
export const FONT_SIZES: Record<FontSizeSetting, number> = { small: 12, medium: 16, large: 20, xlarge: 24 };

/** Default zoom factors offered in the settings. */
export const DEFAULT_ZOOM_FACTORS = [0.8, 0.9, 1, 1.1, 1.25, 1.5] as const;

/** Font preferences for new pages; monospace text keeps Chromium's 13 to 16 ratio. */
export function fontPreferences(setting: FontSizeSetting): { defaultFontSize: number; defaultMonospaceFontSize: number } {
  const size = FONT_SIZES[setting];
  return { defaultFontSize: size, defaultMonospaceFontSize: Math.round((size * 13) / 16) };
}

/** Languages for the Accept-Language header, most preferred first; Chromium adds the weights. */
export function acceptLanguages(language: PageLanguage): string {
  return language === 'en' ? 'en-US,en,tr-TR,tr' : 'tr-TR,tr,en-US,en';
}

/** Spell checker dictionaries in order of preference. */
export function spellCheckerLanguages(language: PageLanguage): string[] {
  return language === 'en' ? ['en-US', 'tr'] : ['tr', 'en-US'];
}
