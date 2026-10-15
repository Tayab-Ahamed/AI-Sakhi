import { describe, expect, it } from "vitest";
import katex from "katex";

describe("patched math rendering compatibility", () => {
  it.each([String.raw`\frac{1}{2}`, String.raw`\sqrt{x^2 + y^2}`, String.raw`\int_0^1 x\,dx`])("renders school mathematics: %s", (formula) => {
    const html = katex.renderToString(formula, { trust: false, throwOnError: true });
    expect(html).toContain("MathML");
    expect(html).not.toContain("katex-error");
  });
  it("does not trust links in model-provided formulas", () => {
    const html = katex.renderToString(String.raw`\href{javascript:alert(1)}{click}`, { trust: false, throwOnError: false, strict: "ignore" });
    expect(html).not.toContain('<a href="javascript:');
  });
});
