import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { defaultLocale, isAppLocale, localeCookieName } from "./config";

type Messages = Record<string, unknown>;

function mergeMessages(base: Messages, localized: Messages): Messages {
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => {
      const localizedValue = localized[key];

      if (
        value &&
        localizedValue &&
        typeof value === "object" &&
        typeof localizedValue === "object" &&
        !Array.isArray(value) &&
        !Array.isArray(localizedValue)
      ) {
        return [
          key,
          mergeMessages(value as Messages, localizedValue as Messages),
        ];
      }

      return [key, localizedValue ?? value];
    }),
  );
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const storedLocale = cookieStore.get(localeCookieName)?.value;
  const locale = isAppLocale(storedLocale) ? storedLocale : defaultLocale;
  const englishMessages = (await import("../../messages/en.json"))
    .default as Messages;
  const localizedMessages = (await import(`../../messages/${locale}.json`))
    .default as Messages;

  return {
    locale,
    messages:
      locale === defaultLocale
        ? englishMessages
        : mergeMessages(englishMessages, localizedMessages),
  };
});
