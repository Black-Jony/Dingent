import { expect, it, vi } from "vitest";

import en from "../../messages/en.json";
import zhCN from "../../messages/zh-CN.json";
import { localeCookieName } from "./config";
import getRequestConfig from "./request";

const cookieStore = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("next-intl/server", () => ({
  getRequestConfig: <T>(configure: T) => configure,
}));

vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
}));

const params = { requestLocale: Promise.resolve(undefined) };

it.each([undefined, "unsupported"])(
  "defaults to Simplified Chinese without a valid language preference (%s)",
  async (value) => {
    cookieStore.get.mockReturnValue(value ? { value } : undefined);
    await expect(getRequestConfig(params)).resolves.toEqual({
      locale: "zh-CN",
      messages: zhCN,
    });
  },
);

it("uses the saved English preference instead of the Chinese default", async () => {
  cookieStore.get.mockReturnValue({ value: "en" });
  await expect(getRequestConfig(params)).resolves.toEqual({
    locale: "en",
    messages: en,
  });
  expect(cookieStore.get).toHaveBeenCalledWith(localeCookieName);
});
