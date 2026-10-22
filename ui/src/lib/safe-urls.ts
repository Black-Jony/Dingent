import { defaultUrlTransform } from "react-markdown";

const BASE_PATH = "/dingent-resource";

/** Return an app-relative path suitable for Next.js navigation. */
export function getSafeReturnPath(value: string | null): string {
  if (!value?.startsWith("/") || /[\\\x00-\x20]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://dingent.invalid");
    if (url.origin !== "https://dingent.invalid") return "/";
    const pathname =
      url.pathname === BASE_PATH || url.pathname.startsWith(`${BASE_PATH}/`)
        ? url.pathname.slice(BASE_PATH.length) || "/"
        : url.pathname;
    return `${pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

/** Keep inline raster charts without allowing data URLs in links. */
export function transformMarkdownUrl(value: string, key: string): string {
  if (
    key === "src" &&
    /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value)
  ) {
    return value;
  }
  return defaultUrlTransform(value);
}
