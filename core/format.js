// Number formatting for German readers: "18 Mrd.", "18 Milliarden", "18.000.000.000".

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
  EUR: "€", USD: "$", GBP: "£", CHF: "CHF", HUF: "Ft", CZK: "Kč", PLN: "zł", RON: "lei", DKK: "DKK", SEK: "SEK", people: "Personen", items: "Stück", cells: "Zellen",
  m: "m", m2: "m²", m3: "m³", t: "t", kWh: "kWh", W: "W", barrel: "Barrel", years: "Jahre",
  seats: "Plätze", subscriptions: "Abos", kg: "kg", "overnight stays": "Nächtigungen", species: "Arten",
  animals: "Tiere", households: "Haushalte",
};
export const unitLabel = (unit) => UNIT_LABELS[unit] ?? unit;

/** "1,9 %"; very small shares keep three significant digits ("0,00423 %"). */
export const formatPercent = (p) => `${formatShort(p)} %`;
