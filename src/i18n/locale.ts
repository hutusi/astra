export const LOCALES = ["zh", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "zh";

// Request-time locale comes from this cookie. It is synced from the user's
// profile preference at login and in settings, so i18n never hits the DB.
export const LOCALE_COOKIE = "astra_locale";

export function asLocale(value: string | undefined): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}
