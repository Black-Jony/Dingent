"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DirectionProvider as RdxDirProvider } from "@radix-ui/react-direction";
import { useLocale } from "next-intl";
import { setCookie, removeCookie } from "@/lib/cookies";
import {
  directionCookieName,
  resolveDirection,
  type Direction,
  type DirectionPreference,
} from "@/i18n/direction";

const DIRECTION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

type DirectionContextType = {
  defaultDir: Direction;
  dir: Direction;
  preference: DirectionPreference;
  setDir: (preference: DirectionPreference) => void;
  resetDir: () => void;
};

const DirectionContext = createContext<DirectionContextType | null>(null);

export function DirectionProvider({
  children,
  initialPreference,
}: {
  children: React.ReactNode;
  initialPreference: DirectionPreference;
}) {
  const locale = useLocale();
  const defaultDir = resolveDirection("auto", locale);
  const [preference, setPreference] = useState(initialPreference);
  const dir = resolveDirection(preference, locale);

  useEffect(() => {
    const htmlElement = document.documentElement;
    htmlElement.setAttribute("dir", dir);
  }, [dir]);

  const setDir = (value: DirectionPreference) => {
    setPreference(value);
    if (value === "auto") {
      removeCookie(directionCookieName);
    } else {
      setCookie(directionCookieName, value, DIRECTION_COOKIE_MAX_AGE);
    }
    removeCookie("dir");
  };

  const resetDir = () => setDir("auto");

  return (
    <DirectionContext
      value={{
        defaultDir,
        dir,
        preference,
        setDir,
        resetDir,
      }}
    >
      <RdxDirProvider dir={dir}>{children}</RdxDirProvider>
    </DirectionContext>
  );
}

export function useDirection() {
  const context = useContext(DirectionContext);
  if (!context) {
    throw new Error("useDirection must be used within a DirectionProvider");
  }
  return context;
}
