import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { getErrorMessage } from "./utils";

describe("API error messages", () => {
  it("uses a FastAPI detail instead of a generic Axios status message", () => {
    const error = Object.assign(
      new AxiosError("Request failed with status code 503"),
      { response: { data: { detail: "Save rejected" } } },
    );
    expect(getErrorMessage(error)).toBe("Save rejected");
  });
  it("formats validation messages without displaying object placeholders", () => {
    const error = Object.assign(new AxiosError("Request failed"), {
      response: {
        data: { detail: [{ msg: "Field required" }, { msg: "Invalid model" }] },
      },
    });
    expect(getErrorMessage(error)).toBe("Field required; Invalid model");
  });
  it("preserves normal errors and falls back for missing details", () => {
    expect(getErrorMessage(new Error("Network failed"))).toBe("Network failed");
    expect(getErrorMessage(new AxiosError("Network failed"))).toBe(
      "Network failed",
    );
    expect(getErrorMessage(null, "Fallback")).toBe("Fallback");
  });
});
