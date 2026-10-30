// Pure logic for the Big Numbers app: number formatting, text parsing, calculator.
// No DOM access here, so it can be tested with node.

const GROUP = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

const SCALES = [
  { exp: 15, short: "Brd.", one: "Billiarde", many: "Billiarden" },
  { exp: 12, short: "Bio.", one: "Billion", many: "Billionen" },
  { exp: 9, short: "Mrd.", one: "Milliarde", many: "Milliarden" },
  { exp: 6, short: "Mio.", one: "Million", many: "Millionen" },
];

/** Format with at most `digits` significant digits, German decimal comma. */
function significant(value, digits = 3) {
  if (value === 0) return "0";
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const decimals = Math.max(0, digits - 1 - magnitude);
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: decimals }).format(value);
}

/** "18 Mrd." for big values, "38.043" below one million, "0,42" for small ones. */
export function formatShort(value) {
  if (!Number.isFinite(value)) return "–";
  const abs = Math.abs(value);
  for (const s of SCALES) {
    if (abs >= 10 ** s.exp) return `${significant(value / 10 ** s.exp)} ${s.short}`;
  }
  if (abs >= 1000) return GROUP.format(value);
  return significant(value, 3);
}

/** "18 Milliarden"; empty string below one million. */
export function formatWords(value) {
  const abs = Math.abs(value);
  for (const s of SCALES) {
    if (abs >= 10 ** s.exp) {
      const n = value / 10 ** s.exp;
      return `${significant(n)} ${n === 1 ? s.one : s.many}`;
    }
  }
  if (abs >= 1000) return `${significant(value / 1000)} Tausend`;
  return "";
}

/** Full number with thousands separators, up to 2 decimals. */
export function formatFull(value) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value);
}

const UNIT_LABELS = {
  EUR: "€", USD: "$", GBP: "£", CHF: "CHF", people: "Personen", items: "Stück", cells: "Zellen",
  m: "m", m2: "m²", m3: "m³", t: "t", kWh: "kWh", W: "W", barrel: "Barrel", years: "Jahre",
  seats: "Plätze", subscriptions: "Abos", kg: "kg", "overnight stays": "Nächtigungen", species: "Arten",
  animals: "Tiere", households: "Haushalte",
};
export const unitLabel = (unit) => UNIT_LABELS[unit] ?? unit;

// --- Finding a number in pasted text -----------------------------------------

const WORD_FACTORS = [
  // German words are capitalised; English "billion" (10^9) is written lower case.
  [/^(Billiarden?|Brd\.?)$/, 1e15],
  [/^(Billionen|Billion|Bio\.?)$/, 1e12],
  [/^(Milliarden?|Mrd\.?|Mia\.?)$/i, 1e9],
  [/^(Millionen|Million|Mio\.?)$/i, 1e6],
  [/^(Tausend|Tsd\.?)$/i, 1e3],
  [/^trillions?$/i, 1e12],
  [/^(billions?|bn\.?)$/, 1e9],
  [/^(millions?|mn\.?)$/i, 1e6],
  [/^(thousand|k)$/i, 1e3],
];

/**
 * Interpret "1.234.567", "4,2", "5.3", "1,234,567" with German/English heuristics.
 * `germanWord`: followed by "Mio.", "Milliarden", ... so a single comma is a decimal comma.
 */
function parseDigits(raw, germanWord) {
  const s = raw.replace(/[\s  ']/g, "");
  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;
  let normalized = s;
  if (dots && commas) {
    // the later separator is the decimal mark
    normalized = s.lastIndexOf(",") > s.lastIndexOf(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(/,/g, "");
  } else if (dots) {
    normalized = dots > 1 || /\.\d{3}$/.test(s) ? s.replace(/\./g, "") : s;
  } else if (commas) {
    const thousands = commas > 1 || (/,\d{3}$/.test(s) && !/^0,/.test(s) && !germanWord);
    normalized = thousands ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  return Number(normalized);
}

/**
 * Find the most relevant number in a text such as
 * "sind 700 Millionen verschwunden" or "US spending reached $5.3 trillion".
 * Returns the largest number found (big numbers are what we are after), or null.
 */
export function parseNumberFromText(text) {
  if (!text) return null;
  const re = /(\d{1,3}(?:[.,\s  ']\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?:\s*([A-Za-zäöü]+\.?))?/g;
  let best = null;
  for (const m of text.matchAll(re)) {
    const word = m[2];
    const hit = word && WORD_FACTORS.find(([pattern]) => pattern.test(word));
    const german = hit && WORD_FACTORS.indexOf(hit) < 5;
    let value = parseDigits(m[1], german);
    if (!Number.isFinite(value)) continue;
    if (hit) value = Number((value * hit[1]).toPrecision(12));
    if (best === null || value > best) best = value;
  }
  return best;
}

// --- Calculator ----------------------------------------------------------------

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

// --- Currency conversion -----------------------------------------------------------

/**
 * Converter from rows like { base_currency: "EUR", currency: "USD", rate: 1.13 }
 * (1 EUR = 1.13 USD). Returns a function (value, from, to) that gives the converted
 * value, or null if one of the currencies is unknown.
 */
export function makeConverter(rates) {
  const perEur = new Map([["EUR", 1]]);
  for (const r of rates) if (r.base_currency === "EUR") perEur.set(r.currency, r.rate);
  const convert = (value, from, to) => {
    if (from === to) return value;
    if (!perEur.has(from) || !perEur.has(to)) return null;
    return value / perEur.get(from) * perEur.get(to);
  };
  convert.isCurrency = (unit) => perEur.has(unit);
  return convert;
}

// --- Inflation -----------------------------------------------------------------------

/**
 * Inflation adjustment from rows like { index_id, year, value }.
 * `adjust(indexId, year)` returns { factor, from, to } to bring a value from `year`
 * to the latest year of that index, or null if the index has no value for `year`.
 * Values from the latest year or later are taken as they are (factor 1).
 * `estimated` is true when the index value for `year` is an estimate (row flag `estimated`).
 */
export function makeInflator(rows) {
  const series = new Map();
  const estimated = new Set();
  for (const r of rows) {
    if (!series.has(r.index_id)) series.set(r.index_id, new Map());
    series.get(r.index_id).set(r.year, r.value);
    if (r.estimated) estimated.add(`${r.index_id}/${r.year}`);
  }
  const latest = new Map([...series].map(([id, s]) => [id, Math.max(...s.keys())]));
  return (indexId, year) => {
    const s = series.get(indexId);
    if (!s) return null;
    const to = latest.get(indexId);
    if (year >= to) return { factor: 1, from: year, to: year, estimated: false };
    if (!s.has(year)) return null;
    return { factor: s.get(to) / s.get(year), from: year, to, estimated: estimated.has(`${indexId}/${year}`) };
  };
}

// --- Big Numbers list ------------------------------------------------------------

/**
 * Entries sorted ascending by value; returns `below` smaller entries and `above`
 * larger entries around `value`, plus whether more exist on either side.
 * `key` reads the value to compare (e.g. a converted amount).
 */
export function windowAround(sorted, value, below, above, key = (e) => e.value_original) {
  let i = 0;
  while (i < sorted.length && key(sorted[i]) < value) i++;
  const start = Math.max(0, i - below);
  const end = Math.min(sorted.length, i + above);
  return {
    smaller: sorted.slice(start, i),
    larger: sorted.slice(i, end),
    moreSmaller: start > 0,
    moreLarger: end < sorted.length,
  };
}
