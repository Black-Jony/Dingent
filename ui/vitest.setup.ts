import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  const messages = (await import("./messages/en.json")).default as Record<
    string,
    unknown
  >;

  return {
    ...actual,
    useLocale: () => "en",
    useTranslations:
      (namespace?: string) =>
      (key: string, values?: Record<string, unknown>) => {
        const path = [namespace, key].filter(Boolean).join(".");
        const message = path.split(".").reduce<unknown>((value, segment) => {
          if (!value || typeof value !== "object") return undefined;
          return (value as Record<string, unknown>)[segment];
        }, messages);

        if (typeof message !== "string") return path;
        return message.replace(/\{(\w+)\}/g, (match, name) =>
          values?.[name] == null ? match : String(values[name]),
        );
      },
  };
});
