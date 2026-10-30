// Finding a number in pasted text.

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


// --- Finding all money amounts in a text, with their position ---

const NUM = String.raw`\d{1,3}(?:[.,   ']\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?`;
const SCALE = String.raw`Billiarden?|Billionen|Billion|Milliarden?|Millionen|Million|Tausend|Brd\.|Bio\.|Mrd\.|Mia\.|Mio\.|Tsd\.|trillions?|billions?|millions?|bn|mn`;
const CUR = String.raw`US-Dollar|Dollar|Euro|Franken|Pfund|EUR|USD|CHF|GBP|€|\$|£`;
const CURRENCIES = [
  [/^(Euro|EUR|€)$/, "EUR"], [/^(US-Dollar|Dollar|USD|\$)$/, "USD"], [/^(Franken|CHF)$/, "CHF"], [/^(Pfund|GBP|£)$/, "GBP"],
];
// "38 Mio. Euro", "1,2 Mrd. €", "500.000 €" or "€ 38 Mio.", "$5.3 trillion"
const AMOUNT = new RegExp(
  String.raw`(?<![\p{L}\d.,])(?:(${NUM})[\s  ]*(?:(${SCALE})[\s  ]*)?(${CUR})` +
  String.raw`|(${CUR})[\s  ]*(${NUM})(?:[\s  ]*(${SCALE}))?)(?![\p{L}\d])`, "gu");

/**
 * All money amounts in a text, in order: { index, length, value, currency }.
 * Only amounts with a currency count; a bare "38 Mio." could be people or tonnes.
 */
export function findAmounts(text) {
  const found = [];
  for (const m of text.matchAll(AMOUNT)) {
    const [digits, word, cur] = m[1] ? [m[1], m[2], m[3]] : [m[5], m[6], m[4]];
    const hit = word && WORD_FACTORS.find(([pattern]) => pattern.test(word));
    let value = parseDigits(digits, hit && WORD_FACTORS.indexOf(hit) < 5);
    if (!Number.isFinite(value)) continue;
    if (hit) value = Number((value * hit[1]).toPrecision(12));
    const currency = CURRENCIES.find(([pattern]) => pattern.test(cur))[1];
    found.push({ index: m.index, length: m[0].length, value, currency });
  }
  return found;
}
