// Money values across currencies and years: exchange rates and price indices.

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

// --- Inflation ---

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

