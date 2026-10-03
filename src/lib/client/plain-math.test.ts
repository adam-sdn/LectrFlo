import { describe, expect, it } from "vitest";
import { plainMath } from "./plain-math";

describe("plainMath", () => {
  it("leaves plain text alone", () => {
    expect(plainMath("The slope is 2x, costing $5")).toBe("The slope is 2x, costing $5");
  });

  it("converts the LaTeX Gemma produced in testing", () => {
    expect(plainMath("Plug it in: $\\frac{(x+h)^2 - x^2}{h}$")).toBe("Plug it in: ((x+h)² - x²) / (h)");
    expect(plainMath("By applying $\\lim_{h \\to 0}$, we")).toBe("By applying lim (h → 0), we");
    expect(plainMath("As $h$ goes to $0$, we get $2x$.")).toBe("As h goes to 0, we get 2x.");
    expect(plainMath("$\\frac{2xh + h^2}{h} = 2x + h$")).toBe("(2xh + h²) / (h) = 2x + h");
  });

  it("handles powers, roots and symbols", () => {
    expect(plainMath("$x^{n-1}$ and $\\sqrt{x}$ and $a \\cdot b \\le c$")).toBe("xⁿ⁻¹ and √(x) and a · b ≤ c");
    expect(plainMath("$x^{1/2}$")).toBe("x^(1/2)");
    expect(plainMath("$\\frac{dy}{dx}$")).toBe("dy/dx");
  });
});
