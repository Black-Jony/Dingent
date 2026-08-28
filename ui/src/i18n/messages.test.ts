import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import zhCN from "../../messages/zh-CN.json";
import ja from "../../messages/ja.json";

type Messages = Record<string, unknown>;

function flattenMessages(value: Messages, prefix = ""): Record<string, string> {
  return Object.entries(value).reduce<Record<string, string>>(
    (result, [key, entry]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof entry === "string") {
        result[path] = entry;
      } else if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        Object.assign(result, flattenMessages(entry as Messages, path));
      }
      return result;
    },
    {},
  );
}

function messageVariables(value: string): string[] {
  return [
    ...value.matchAll(/\{\s*([A-Za-z_][\w.-]*)\s*(?:,|\})/g),
  ]
    .map((match) => match[1])
    .sort();
}

describe("locale messages", () => {
  const locales = { en, "zh-CN": zhCN, ja };
  const englishKeys = Object.keys(flattenMessages(en)).sort();

  it.each(Object.entries(locales))(
    "%s matches the English message structure",
    (_, messages) => {
      expect(Object.keys(flattenMessages(messages)).sort()).toEqual(
        englishKeys,
      );
    },
  );

  it.each(Object.entries(locales))(
    "%s has no empty translations",
    (_, messages) => {
      for (const [key, value] of Object.entries(flattenMessages(messages))) {
        expect(value.trim(), key).not.toBe("");
      }
    },
  );

  it.each(Object.entries(locales).filter(([locale]) => locale !== "en"))(
    "%s preserves English message variables",
    (_, messages) => {
      const englishMessages = flattenMessages(en);
      const localizedMessages = flattenMessages(messages);

      for (const [key, value] of Object.entries(englishMessages)) {
        expect(messageVariables(localizedMessages[key]), key).toEqual(
          messageVariables(value),
        );
      }
    },
  );
});
