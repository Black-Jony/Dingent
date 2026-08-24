"use server";

import { cookies } from "next/headers";

import { type AppLocale, isAppLocale, localeCookieName } from "@/i18n/config";

const oneYearInSeconds = 60 * 60 * 24 * 365;

export async function setUserLocale(locale: AppLocale) {
  if (!isAppLocale(locale)) {
    throw new Error("Unsupported locale");
  }

  const cookieStore = await cookies();
  cookieStore.set(localeCookieName, locale, {
    path: "/",
    maxAge: oneYearInSeconds,
    sameSite: "lax",
  });
}
