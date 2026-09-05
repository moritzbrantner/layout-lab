import {describe, expect, test} from "bun:test";
import {normalizeWebsiteUrl} from "./website-rearranger";

describe("normalizeWebsiteUrl", () => {
  test("adds https when the user enters a bare host", () => {
    expect(normalizeWebsiteUrl("example.com/demo")).toBe("https://example.com/demo");
  });

  test("preserves explicit http URLs for local or development pages", () => {
    expect(normalizeWebsiteUrl("http://localhost:3000/page")).toBe("http://localhost:3000/page");
  });

  test("rejects non-web protocols", () => {
    expect(() => normalizeWebsiteUrl("file:///tmp/page.html")).toThrow("Only HTTP and HTTPS websites can be imported.");
  });

  test("rejects empty input", () => {
    expect(() => normalizeWebsiteUrl("   ")).toThrow("Enter a website URL.");
  });
});
