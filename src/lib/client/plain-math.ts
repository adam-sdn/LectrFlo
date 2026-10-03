const SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  n: "ⁿ", "-": "⁻", "+": "⁺",
};
const SYMBOLS: Record<string, string> = {
  to: "→", rightarrow: "→", Rightarrow: "⇒", implies: "⇒", cdot: "·", times: "×", div: "÷", pm: "±",
  infty: "∞", Delta: "Δ", delta: "δ", pi: "π", theta: "θ", le: "≤", leq: "≤", ge: "≥", geq: "≥",
  neq: "≠", approx: "≈", prime: "′", ldots: "…", dots: "…",
};

const superscript = (s: string) =>
  [...s].every((c) => c in SUPERSCRIPTS) ? [...s].map((c) => SUPERSCRIPTS[c]).join("") : `^(${s})`;

/** Turns common inline LaTeX (which some models emit despite instructions) into readable plain text. */
export function plainMath(text: string): string {
  if (!/[$\\]/.test(text)) return text;
  let out = text.replace(/\$\$?([^$]+)\$\$?/g, "$1");
  for (let i = 0; i < 3; i++) {
    out = out
      .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1) / ($2)")
      .replace(/\\sqrt\{([^{}]*)\}/g, "√($1)")
      .replace(/\\(?:text|mathrm|mathbf|operatorname)\{([^{}]*)\}/g, "$1");
  }
  return out
    .replace(/\\lim_\{([^{}]*)\}/g, "lim ($1)")
    .replace(/\\(left|right|,|;|!|quad)/g, "")
    .replace(/\\([A-Za-z]+)/g, (m, name: string) => SYMBOLS[name] ?? (name === "lim" ? "lim" : m))
    .replace(/\^\{([^{}]*)\}/g, (_, exp: string) => superscript(exp))
    .replace(/\^([0-9n])/g, (_, exp: string) => superscript(exp))
    .replace(/_\{([^{}]*)\}/g, "_$1")
    .replace(/\(([A-Za-z0-9]+)\) \/ \(([A-Za-z0-9]+)\)/g, "$1/$2");
}
