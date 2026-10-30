// The core with the real dataset, loaded from disk instead of over HTTP.
//     node tests/data.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { openBigNumbers } from "../core/index.js";

const DATEN = new URL("../Daten/", import.meta.url);
const load = async (path) => JSON.parse(await readFile(new URL(path, DATEN), "utf8"));

let fails = 0;
const t = async (name, fn) => {
  try { await fn(); console.log("ok  ", name); } catch (e) { fails++; console.log("FAIL", name, "-", e.message); }
};

const bn = await openBigNumbers({ bases: ["missing/", ""], load });

await t("zweite Basis wird genommen", () => assert.equal(bn.base, ""));
await t("Katalog hat Listen, alle kostenlos als Standard", () => {
  assert.ok(bn.lists.length >= 7);
  assert.deepEqual(bn.defaultLists, bn.lists.map((l) => l.id));
});

await bn.loadLists(bn.defaultLists);
const all = bn.entries(bn.defaultLists);
await t("Einträge zusammengeführt, ohne Doppelte", () => {
  assert.ok(all.length > 400);
  assert.equal(new Set(all.map((e) => e.id)).size, all.length);
  assert.ok(all.every((e) => e.list?.id));
});

await t("18 Mrd. €: 8 kleinere und 8 größere, sortiert", () => {
  const w = bn.compare(18e9, { lists: bn.defaultLists, unit: "EUR" });
  assert.equal(w.smaller.length, 8);
  assert.equal(w.larger.length, 8);
  const vals = [...w.smaller, ...w.larger].map((e) => bn.compareValue(e, "EUR"));
  assert.deepEqual(vals, [...vals].sort((a, b) => a - b));
  assert.ok(vals[7] < 18e9 && vals[8] >= 18e9);
});

await t("Geld in Dollar: Kurs und Inflation erklärt", () => {
  const e = all.find((x) => x.unit === "USD" && x.year_original < 2000);
  const m = bn.money(e, "EUR");
  assert.ok(m.changed && m.infl.factor > 1);
  const text = bn.explainMoney(e, m, "EUR").join("\n");
  assert.match(text, /Inflation \d{4}–\d{4}/);
  assert.match(text, /Kurs: 1 \$ = /);
});

await t("keine Einheit: Geldwerte unverändert", () => {
  const e = all.find((x) => x.unit === "USD");
  assert.equal(bn.money(e, ""), null);
  assert.equal(bn.compareValue(e, ""), e.value_original);
});

await t("Land erraten: gespeichert, Zeitzone, Sprache", () => {
  assert.equal(bn.guessCountry({ saved: "CZ", timeZone: "Europe/Vienna" }), "CZ");
  assert.equal(bn.guessCountry({ saved: "XX", timeZone: "Europe/Berlin" }), "DE");
  assert.equal(bn.guessCountry({ timeZone: "Asia/Tokyo", languages: ["hu-HU"] }), "HU");
});

await t("Für mich in Österreich: pro Einwohner plausibel, eigene Bezugsgröße", () => {
  const items = bn.mean2me(18e9, { country: "AT", unit: "EUR", custom: [{ id: "own_1", title: "Pro Autofahrer", value: 5e6 }] });
  const perHead = items.find((m) => m.id === "m2m_population_at");
  assert.ok(perHead.result > 1500 && perHead.result < 2500, perHead.result);
  assert.match(perHead.text, /€$/);
  const own = items.at(-1);
  assert.deepEqual([own.custom, own.result, own.text], [true, 3600, "3.600 €"]);
  assert.ok(items.some((m) => m.id.startsWith("m2m_gdp_share") && m.text.endsWith("%")));
});

await t("ohne Einheit fallen reine Geld-Bezugsgrößen weg", () => {
  const items = bn.mean2me(1e6, { country: "AT", unit: "" });
  assert.ok(items.length > 0);
  assert.ok(!items.some((m) => m.id.startsWith("m2m_gdp_share")));
});

await t("Snapshot für einen Artikel: Auswahl in Reihenfolge, Datenstand", () => {
  const s = bn.snapshot(38e6, { country: "AT", unit: "EUR", pick: ["m2m_per_day", "m2m_households_at"], date: new Date("2026-10-30") });
  assert.deepEqual([s.v, s.n, s.label, s.asOf, s.items.length], [1, 38e6, "38 Mio. €", "2026-10-30", 2]);
  assert.deepEqual(s.items[1], { text: "9,09 €", label: "Pro Haushalt in Österreich" });
  assert.throws(() => bn.snapshot(1, { country: "AT", unit: "EUR", pick: ["gibt_es_nicht"] }), /gibt es für AT nicht/);
});

console.log(fails ? `${fails} Fehler` : "alle Tests bestanden");
process.exitCode = fails ? 1 : 0;
