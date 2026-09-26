import type { FontSizeSetting, PageLanguage } from '../shared/types.js';

export const FONT_SIZES: Record<FontSizeSetting, number> = { small: 12, medium: 16, large: 20, xlarge: 24 };

export const DEFAULT_ZOOM_FACTORS = [0.8, 0.9, 1, 1.1, 1.25, 1.5] as const;

export function fontPreferences(setting: FontSizeSetting): { defaultFontSize: number; defaultMonospaceFontSize: number } {
  const size = FONT_SIZES[setting];
  return { defaultFontSize: size, defaultMonospaceFontSize: Math.round((size * 13) / 16) };
}

export function acceptLanguages(language: PageLanguage): string {
  return language === 'en' ? 'en-US,en,tr-TR,tr' : 'tr-TR,tr,en-US,en';
}

export function spellCheckerLanguages(language: PageLanguage): string[] {
  return language === 'en' ? ['en-US', 'tr'] : ['tr', 'en-US'];
}
