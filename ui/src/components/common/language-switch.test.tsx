import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageSwitch } from "./language-switch";

const controls = vi.hoisted(() => ({
  locale: "en",
  setLocale: vi.fn().mockResolvedValue(undefined),
  refresh: vi.fn(),
}));
vi.mock("next-intl", () => ({
  useLocale: () => controls.locale,
  useTranslations: () => () => "Change language",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: controls.refresh }),
}));
vi.mock("@/app/actions/locale", () => ({ setUserLocale: controls.setLocale }));

afterEach(() => {
  cleanup();
  controls.locale = "en";
  vi.clearAllMocks();
});

describe("chat language selector", () => {
  it("shows the selected language and persists a new choice before refreshing", async () => {
    const view = render(<LanguageSwitch showLabel />);
    expect(screen.getByText("English")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Change language" }), {
      key: "Enter",
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: "日本語" }));
    await waitFor(() => expect(controls.setLocale).toHaveBeenCalledWith("ja"));
    await waitFor(() => expect(controls.refresh).toHaveBeenCalledOnce());

    controls.locale = "ja";
    view.rerender(<LanguageSwitch showLabel />);
    expect(screen.queryByText("English")).not.toBeInTheDocument();
    expect(screen.getAllByText("日本語").length).toBeGreaterThan(0);
  });

  it("does not refresh when the current language is selected again", async () => {
    render(<LanguageSwitch showLabel />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Change language" }), {
      key: "Enter",
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: "English" }));
    expect(controls.setLocale).not.toHaveBeenCalled();
    expect(controls.refresh).not.toHaveBeenCalled();
  });
});
