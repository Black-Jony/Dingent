export const locales = ["en", "zh-CN", "fr", "ja", "ru", "ar", "es"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";
export const localeCookieName = "dingent-locale";

export function isAppLocale(value: string | undefined): value is AppLocale {
  return locales.some((locale) => locale === value);
}
