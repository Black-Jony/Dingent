export type Direction = "ltr" | "rtl";
export type DirectionPreference = "auto" | Direction;

export const directionCookieName = "dingent-direction";

export function parseDirectionPreference(
  value: string | undefined,
): DirectionPreference {
  return value === "ltr" || value === "rtl" ? value : "auto";
}

export function resolveDirection(
  preference: DirectionPreference,
  locale = "en",
): Direction {
  return preference === "auto"
    ? locale.split("-")[0] === "ar"
      ? "rtl"
      : "ltr"
    : preference;
}
