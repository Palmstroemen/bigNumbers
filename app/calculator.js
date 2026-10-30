// The calculator behind the app's number pad. No DOM access, so it can be tested with node.

const GROUP = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

const MAX = 1e18;

function toPlain(n) {
  const rounded = Math.round(n * 1e10) / 1e10;
  if (Math.abs(rounded) >= 1e21) return String(MAX);
  return String(rounded);
}

/**
 * A simple calculator with operator precedence.
 * `cur` holds the operand being typed, internally with "." as decimal mark.
 */
export class Calculator {
  constructor() { this.clear(); }

  clear() {
    this.tokens = [];      // alternating numbers (as strings) and operators
    this.cur = "";
    this.fresh = false;    // true right after "=": the next digit starts a new number
  }

  setValue(n) {
    this.clear();
    this.cur = toPlain(n);
    this.fresh = true;
  }

  digit(d) {
    if (this.fresh) { this.cur = ""; this.fresh = false; }
    if (this.cur === "0") this.cur = "";
    if (this.cur.replace(".", "").length >= 18) return;
    this.cur += d;
  }

  /** The [000] key: one step of a thousand up (x1000), "1000" on an empty operand. */
  thousand() {
    this.fresh = false;
    const base = this.cur === "" || this.cur === "." ? 1 : Number(this.cur);
    this.cur = toPlain(Math.min(base * 1000, MAX));
  }

  comma() {
    if (this.fresh) { this.cur = ""; this.fresh = false; }
    if (this.cur.includes(".")) return;
    this.cur = (this.cur || "0") + ".";
  }

  op(o) {
    this.fresh = false;
    if (this.cur === "" ) {
      if (this.tokens.length) this.tokens[this.tokens.length - 1] = o;   // replace operator
      else if (o === "-") this.cur = "-";
      return;
    }
    if (this.cur === "-") return;
    this.tokens.push(this.cur, o);
    this.cur = "";
  }

  back() {
    this.fresh = false;
    if (this.cur) this.cur = this.cur.slice(0, -1);
    else if (this.tokens.length) { this.tokens.pop(); this.cur = this.tokens.pop() ?? ""; }
  }

  equals() {
    const v = this.value();
    if (Number.isFinite(v)) this.setValue(v);
  }

  /** Current result; a trailing operator is ignored. NaN on division by zero. */
  value() {
    const parts = [...this.tokens];
    if (this.cur && this.cur !== "-" && this.cur !== ".") parts.push(this.cur);
    else parts.pop();
    if (!parts.length) return 0;
    // first pass: x and /
    const sum = [Number(parts[0])];
    const ops = [];
    for (let i = 1; i < parts.length; i += 2) {
      const o = parts[i], n = Number(parts[i + 1]);
      if (o === "*") sum[sum.length - 1] *= n;
      else if (o === "/") sum[sum.length - 1] = n === 0 ? NaN : sum[sum.length - 1] / n;
      else { ops.push(o); sum.push(n); }
    }
    // second pass: + and -
    return sum.slice(1).reduce((acc, n, i) => (ops[i] === "+" ? acc + n : acc - n), sum[0]);
  }

  /** True while the input is more than a single number. */
  get isExpression() { return this.tokens.length > 0; }

  /** Display text, e.g. "18.000.000 + 4,5". */
  expressionText() {
    const sym = { "+": "+", "-": "−", "*": "×", "/": "÷" };
    const fmt = (s) => {
      if (s === "-" || s === "") return s;
      const [int, dec] = s.split(".");
      const neg = int.startsWith("-");
      const grouped = GROUP.format(Number(int.replace("-", "") || 0));
      return (neg ? "−" : "") + grouped + (dec !== undefined ? "," + dec : "");
    };
    const parts = this.tokens.map((t, i) => (i % 2 ? sym[t] : fmt(t)));
    if (this.cur) parts.push(fmt(this.cur));
    return parts.join(" ") || "0";
  }
}

