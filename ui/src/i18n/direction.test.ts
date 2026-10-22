import { describe, expect, it } from "vitest";
import { parseDirectionPreference, resolveDirection } from "./direction";

describe("direction preferences", () => {
  it("keeps the default layout direction for missing or invalid cookies", () => {
    expect(parseDirectionPreference(undefined)).toBe("auto");
    expect(parseDirectionPreference("unexpected")).toBe("auto");
    expect(resolveDirection(parseDirectionPreference(undefined))).toBe("ltr");
    expect(resolveDirection(parseDirectionPreference("unexpected"))).toBe(
      "ltr",
    );
  });

  it("honors an explicit direction", () => {
    expect(parseDirectionPreference("ltr")).toBe("ltr");
    expect(resolveDirection("ltr")).toBe("ltr");
    expect(resolveDirection("rtl")).toBe("rtl");
    expect(resolveDirection("ltr", "ar")).toBe("ltr");
    expect(resolveDirection("auto", "ar")).toBe("rtl");
    expect(resolveDirection("auto", "ar-SA")).toBe("rtl");
    expect(resolveDirection("auto", "fr")).toBe("ltr");
  });
});
