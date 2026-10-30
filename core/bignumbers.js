// The Big Numbers dataset and everything computed from it: comparisons, money in
// today's prices, Mean2Me breakdowns. No DOM and no storage, so the app, an embed
// widget, a browser extension or a node script can all use it.

import { formatShort, formatFull, formatPercent, unitLabel } from "./format.js";
import { makeConverter, makeInflator } from "./money.js";
import { windowAround } from "./compare.js";

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

/**
 * Load the dataset from the first of `bases` (folder URLs ending in "/") that serves
 * listen/index.json. `load(url)` fetches one JSON file; pass your own in node.
 */
export async function openBigNumbers({ bases = ["Daten/"], load = fetchJson } = {}) {
  let base, catalog;
  for (const b of bases) {
    try { catalog = await load(b + "listen/index.json"); base = b; break; } catch { /* try next base */ }
  }
  if (!catalog) throw new Error("listen/index.json nicht gefunden");
  const [m2m, rates, indices, indexValues] = await Promise.all(
    ["listen/mean2me.json", "exchange_rates.json", "indices.json", "index_values.json"].map((n) => load(base + n)));
  return new BigNumbers({ base, load, catalog, m2m, rates, indices, indexValues });
}

export class BigNumbers {
  constructor({ base, load, catalog, m2m, rates, indices, indexValues }) {
    this.base = base;              // folder the data came from; image paths in the data are relative to it
    this.load = load;
    this.lists = catalog.lists;
    this.packages = new Map();     // list id -> loaded list file
    this.contexts = m2m.contexts;
    this.countries = m2m.countries;
    this.rateOf = new Map(rates.map((r) => [r.currency, r]));
    this.convert = makeConverter(rates);
    this.inflate = makeInflator(indexValues);
    this.indexOf = new Map(indices.map((i) => [i.id, i]));
    this.priceYear = Math.max(...indexValues.map((r) => r.year));
  }

  // --- Lists ---

  /** Ids of the lists a new user sees: all free ones. */
  get defaultLists() {
    return this.lists.filter((l) => l.access === "free").map((l) => l.id);
  }

  /** Load the files of the given lists that are not loaded yet. */
  async loadLists(ids) {
    const want = new Set(ids);
    await Promise.all(this.lists
      .filter((l) => want.has(l.id) && !this.packages.has(l.id))
      .map(async (l) => this.packages.set(l.id, await this.load(this.base + "listen/" + l.file))));
  }

  /** Entries of the given (loaded) lists, merged; an entry in several lists appears once, marked with the first. */
  entries(ids) {
    const want = new Set(ids);
    const seen = new Map();
    for (const l of this.lists) {
      if (!want.has(l.id)) continue;
      for (const e of this.packages.get(l.id)?.entries ?? []) if (!seen.has(e.id)) seen.set(e.id, { ...e, list: l });
    }
    return [...seen.values()];
  }

  /** URL of a picture from the data (relative paths are relative to the data folder). */
  imageSrc(img) {
    return /^https?:/.test(img.src) ? img.src : this.base + img.src;
  }

  // --- Money ---

  /**
   * Money in today's prices and in `unit`: first adjusted for inflation in its own
   * currency, then converted at the current rate. Null for entries that are not
   * money, or when no currency is chosen.
   */
  money(e, unit) {
    if (!unit || !this.convert.isCurrency(e.unit)) return null;
    const infl = this.inflate(e.index_id, e.year_original);
    const value = this.convert(e.value_original * (infl?.factor ?? 1), e.unit, unit);
    const changed = e.unit !== unit || (infl !== null && infl.factor !== 1);
    return { value, infl, changed };
  }

  /** Value used to sort and compare. */
  compareValue(e, unit) {
    return this.money(e, unit)?.value ?? e.value_original;
  }

  /** "1 € = 1,13 $ (EZB-Referenzkurs, Jahresdurchschnitt 2025)" for converting `from` into `unit`. */
  rateText(from, unit) {
    const r = this.rateOf.get(from === "EUR" ? unit : from) ?? this.rateOf.get(unit);
    const fmt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 4 });
    return `1 ${unitLabel(from)} = ${fmt.format(this.convert(1, from, unit))} ${unitLabel(unit)}` +
      ` (EZB-Referenzkurs, Jahresdurchschnitt ${r.year})`;
  }

  /** Lines that explain how a money value was brought to today's prices and to `unit`. */
  explainMoney(e, money, unit) {
    const lines = [];
    if (money.changed) {
      lines.push(`In Preisen von ${money.infl?.to ?? this.priceYear}: ${formatFull(Math.round(money.value))} ${unitLabel(unit)}`);
    }
    if (!money.infl) {
      lines.push(`Nicht inflationsbereinigt: Für ${e.year_original} gibt es keinen Indexwert.`);
    } else if (money.infl.factor !== 1) {
      const pct = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0, signDisplay: "always" })
        .format((money.infl.factor - 1) * 100);
      const index = this.indexOf.get(e.index_id);
      lines.push(`Inflation ${money.infl.from}–${money.infl.to}: ${pct} % laut ${index?.name ?? e.index_id}` +
        (money.infl.estimated ? " (geschätzt)" : ""));
      if (money.infl.estimated && index?.estimate_note) lines.push(`Geschätzt: ${index.estimate_note}`);
    }
    if (e.unit !== unit) lines.push(`Kurs: ${this.rateText(e.unit, unit)}`);
    return lines;
  }

  // --- Big Numbers: comparisons ---

  /**
   * Entries of the given lists around `value` (in `unit`): `below` smaller and
   * `above` larger ones, ascending, plus whether more exist on either side.
   */
  compare(value, { lists, unit, below = 8, above = 8, filter = () => true }) {
    const key = (e) => this.compareValue(e, unit);
    const pool = this.entries(lists).filter(filter).sort((a, b) => key(a) - key(b));
    return windowAround(pool, Number.isFinite(value) ? value : 0, below, above, key);
  }

  // --- Mean2Me ---

  country(code) {
    return this.countries.find((c) => c.code === code) ?? this.countries[0];
  }

  /**
   * First guess of the user's country: `saved` if known, else by time zone, else by
   * the preferred languages (e.g. navigator.languages).
   */
  guessCountry({ saved = null, timeZone = null, languages = [] } = {}) {
    const cs = this.countries;
    if (cs.some((c) => c.code === saved)) return saved;
    const byTz = cs.find((c) => c.timezones.includes(timeZone));
    if (byTz) return byTz.code;
    for (const lang of languages) {
      const hit = cs.find((c) => c.locales.includes(lang));
      if (hit) return hit.code;
    }
    return cs[0].code;
  }

  /**
   * `value` broken down for a country: per citizen, per household, share of GDP, ...
   * plus the global ones and the user's own divisors ({ id, title, value }).
   * Each item: { id, title, custom, result, text, basis }.
   */
  mean2me(value, { country, unit, custom = [] }) {
    const sym = unit ? unitLabel(unit) : "";
    const own = custom.map((c) => ({
      id: c.id, title: c.title, kind: "divide", factor_value: c.value, factor_source: "Eigene Angabe", custom: true,
    }));
    return [...this.contexts.filter((c) => c.country_code === country || c.country_code === "GLOBAL"), ...own]
      .filter((c) => unit || !c.only_currency)
      .map((c) => {
        const source = c.factor_entry ?? null;
        const money = source ? this.money(source, unit) : null;
        const factor = money ? money.value : source ? source.value_original : c.factor_value;
        const share = c.kind === "share";
        const result = share ? value / factor * 100 : value / factor;
        const text = !Number.isFinite(result) ? "–"
          : share ? formatPercent(result) : `${formatShort(result)} ${c.result_unit ?? sym}`.trim();
        const basis = source
          ? `Bezug: ${formatFull(source.value_original)} ${unitLabel(source.unit)}` +
            (money?.changed ? ` (≈ ${formatShort(factor)} ${unitLabel(unit)} in Preisen von ${money.infl?.to ?? this.priceYear})` : "") +
            ` · ${source.source_title} (${source.year_original})`
          : `Bezug: ${c.factor_source}${c.custom ? ` (${formatFull(c.factor_value)})` : ""}`;
        return { id: c.id, title: c.title, custom: !!c.custom, result, text, basis };
      });
  }

  /**
   * What an article embeds for `value` (see embed/means2me.js): the Mean2Me items
   * with the ids in `pick`, in that order, frozen with today's data so the text a
   * newsroom approved never changes by itself.
   * `compare: { lists, below, above, exclude }` adds the neighbouring entries of
   * those (loaded) lists; for a money value only money entries, in today's prices.
   */
  snapshot(value, { country, unit, pick, custom = [], compare = null, date = new Date() }) {
    const all = this.mean2me(value, { country, unit, custom });
    const items = pick.map((id) => {
      const m = all.find((x) => x.id === id);
      if (!m) throw new Error(`Means2Me: ${id} gibt es für ${country}${unit ? "" : " ohne Einheit"} nicht`);
      return { text: m.text, label: m.title };
    });
    const out = {
      v: 1, n: value, unit, country,
      label: `${formatShort(value)} ${unit ? unitLabel(unit) : ""}`.trim(),
      items, asOf: date.toISOString().slice(0, 10),
    };
    if (compare) out.compare = this.frozenComparison(value, unit, compare);
    return out;
  }

  /** The neighbours of `value` as plain text: { note, smaller, larger }, each row { title, year, text, source }. */
  frozenComparison(value, unit, { lists, below = 3, above = 3, exclude = [] }) {
    const money = !!unit && this.convert.isCurrency(unit);
    const skip = new Set(exclude);
    const w = this.compare(value, {
      lists, unit, below, above,
      filter: (e) => !skip.has(e.id) && (!money || this.convert.isCurrency(e.unit)),
    });
    const row = (e) => {
      const m = this.money(e, unit);
      return {
        id: e.id,
        title: e.title,
        year: e.title.includes(String(e.year_original)) ? null : e.year_original,
        text: m?.changed ? `≈ ${formatShort(m.value)} ${unitLabel(unit)}` : `${formatShort(e.value_original)} ${unitLabel(e.unit)}`,
        source: e.source_url,
      };
    };
    return {
      note: money ? `Geldbeträge in Preisen von ${this.priceYear}, umgerechnet in ${unitLabel(unit)}.` : "",
      smaller: w.smaller.map(row),
      larger: w.larger.map(row),
    };
  }
}
