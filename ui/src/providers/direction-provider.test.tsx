import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DirectionProvider, useDirection } from "./direction-provider";

function DirectionControls() {
  const { dir, preference, resetDir, setDir } = useDirection();
  return (
    <>
      <output data-testid="direction">{dir}</output>
      <output data-testid="preference">{preference}</output>
      <button onClick={() => setDir("ltr")}>Set LTR</button>
      <button onClick={() => setDir("rtl")}>Set RTL</button>
      <button onClick={resetDir}>Reset</button>
    </>
  );
}

afterEach(() => {
  cleanup();
  document.cookie = "dir=; path=/; max-age=0";
  document.cookie = "dingent-direction=; path=/; max-age=0";
});

describe("DirectionProvider", () => {
  it("keeps the default layout until the user explicitly changes direction", () => {
    render(
      <DirectionProvider initialPreference="auto">
        <DirectionControls />
      </DirectionProvider>,
    );
    expect(screen.getByTestId("direction")).toHaveTextContent("ltr");

    fireEvent.click(screen.getByRole("button", { name: "Set RTL" }));
    expect(screen.getByTestId("direction")).toHaveTextContent("rtl");
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
    expect(document.cookie).toContain("dingent-direction=rtl");

    fireEvent.click(screen.getByRole("button", { name: "Set LTR" }));
    expect(screen.getByTestId("direction")).toHaveTextContent("ltr");
    expect(screen.getByTestId("preference")).toHaveTextContent("ltr");
    expect(document.cookie).toContain("dingent-direction=ltr");

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByTestId("direction")).toHaveTextContent("ltr");
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
    expect(screen.getByTestId("preference")).toHaveTextContent("auto");
    expect(document.cookie).not.toContain("dingent-direction=");
  });

  it("ignores the legacy direction cookie", () => {
    document.cookie = "dir=ltr; path=/";
    render(
      <DirectionProvider initialPreference="auto">
        <DirectionControls />
      </DirectionProvider>,
    );
    expect(screen.getByTestId("direction")).toHaveTextContent("ltr");
  });
});
