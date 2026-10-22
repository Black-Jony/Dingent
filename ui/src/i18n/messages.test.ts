import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import zhCN from "../../messages/zh-CN.json";
import ja from "../../messages/ja.json";
import fr from "../../messages/fr.json";
import ru from "../../messages/ru.json";
import ar from "../../messages/ar.json";
import es from "../../messages/es.json";

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
  const locales = { en, "zh-CN": zhCN, fr, ja, ru, ar, es };
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

  it.each(Object.entries(locales))(
    "%s distinguishes sign-in from sign-up",
    (_, messages) => {
      const auth = messages.Auth;
      expect(auth.signIn).not.toBe(auth.signUp);
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

  it.each([
    ["fr", fr, "Déconnexion"],
    ["ru", ru, "Выйти"],
    ["ar", ar, "تسجيل الخروج"],
    ["es", es, "Cerrar sesión"],
  ])("%s uses a clear sign-out action", (_, messages, expected) => {
    expect(messages.Profile.signOut).toBe(expected);
    expect(messages.SignOut.title).toBe(expected);
    expect(messages.SignOut.confirm).toBe(expected);
    expect(messages.Workspace.signOut).toBe(expected);
    expect(messages.SignOut.confirm).not.toBe(messages.Auth.signUp);
  });

  it("keeps the status and action in reviewed Arabic messages", () => {
    expect(ar.Overview.assistantSummary).toContain("{inactive}");
    expect(ar.Overview.assistantSummary).toContain("غير النشط");
    expect(ar.Overview.activePercent).toContain("%");
    expect(ar.Overview.tools).toContain("أدوات");
    expect(ar.Settings.toast.guestDisabled).toContain("تعطيل");
    expect(ar.Common.save).toBe("حفظ");
    expect(ar.Common.error).toBe("خطأ");
  });

  it.each([
    ["fr", fr, "Effacer l'historique", "Réduire la barre latérale", "Plus ancien"],
    ["ru", ru, "Очистить историю", "Свернуть боковую панель", "Более ранние"],
    ["ar", ar, "مسح سجل المحادثات", "طي الشريط الجانبي", "الأقدم"],
    ["es", es, "Borrar historial", "Contraer barra lateral", "Anteriores"],
  ])("%s keeps chat sidebar actions and time groups distinct", (_, messages, clear, collapse, older) => {
    expect(messages.Chat.sidebar.clearHistory).toBe(clear);
    expect(messages.Chat.sidebar.collapse).toBe(collapse);
    expect(messages.Chat.sidebar.groups.older).toBe(older);
  });

  it.each(Object.entries(locales))("%s contains no machine-translation artifacts", (_, messages) => {
    for (const [key, value] of Object.entries(flattenMessages(messages))) {
      expect(value, key).not.toMatch(/&(quot|apos);|ZZZQ|\}ZZ/);
    }
  });
});
