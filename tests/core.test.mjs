import assert from "node:assert/strict";
import { parseNumberFromText as p, formatShort, formatWords, windowAround, makeConverter, makeInflator } from "../core/index.js";
import { Calculator } from "../app/calculator.js";

const run = (keys) => { const c = new Calculator(); for (const k of keys) {
  if (/^\d$/.test(k)) c.digit(k); else if (k === "000") c.thousand(); else if (k === ",") c.comma();
  else if (k === "=") c.equals(); else if (k === "back") c.back(); else c.op(k); } return c; };
let fails = 0; const t = (name, fn) => { try { fn(); console.log("ok  ", name); } catch (e) { fails++; console.log("FAIL", name, "-", e.message); } };

t("000 auf leerer Eingabe = 1000", () => assert.equal(run(["000"]).value(), 1000));
t("18 000 000 000 = 18 Mrd.", () => assert.equal(run(["1","8","000","000","000"]).value(), 18e9));
t("4,2 000 = 4200", () => assert.equal(run(["4",",","2","000"]).value(), 4200));
t("Punkt vor Strich: 2+3*4 = 14", () => assert.equal(run(["2","+","3","*","4"]).value(), 14));
t("18 Mrd / 9 Mio", () => assert.equal(run(["1","8","000","000","000","/","9","000","000"]).value(), 2000));
t("Division durch 0 = NaN", () => assert.ok(Number.isNaN(run(["5","/","0"]).value())));
t("Operator am Ende ignoriert", () => assert.equal(run(["7","+"]).value(), 7));
t("Operator ersetzen", () => assert.equal(run(["7","+","*","2"]).value(), 14));
t("nach = beginnt Ziffer neu", () => assert.equal(run(["2","+","2","=","5"]).value(), 5));
t("nach = rechnet Operator weiter", () => assert.equal(run(["2","+","2","=","*","3"]).value(), 12));
t("Backspace über Operator", () => assert.equal(run(["1","2","+","back","back"]).value(), 1));
t("Anzeige mit Gruppierung", () => assert.equal(run(["1","8","000","000","+","4",",","5"]).expressionText(), "18.000.000 + 4,5"));
t("negativer Start", () => assert.equal(run(["-","5","+","8"]).value(), 3));

const cases = [
  ["sind 700 Millionen verschwunden", 7e8], ["18 Mrd.", 18e9], ["4,2 Mio. Euro", 4.2e6],
  ["1.234.567 Euro", 1234567], ["US spending reached $5.3 trillion", 5.3e12], ["18 billion dollars", 18e9],
  ["eine Billion Euro, also 1 Billion", 1e12], ["Kosten: 1,263 Milliarden Euro", 1.263e9],
  ["Im Jahr 2024 wurden 66,6 Mio. Tonnen", 66.6e6], ["Der Preis: 21.290,00 €", 21290],
  ["keine Zahl hier", null], ["3,04 trillion trees", 3.04e12], ["1,234,567 people", 1234567],
  ["über 5,1 MW", 5.1],
];
for (const [text, want] of cases) t(`Text: "${text}"`, () => assert.equal(p(text), want));

t("formatShort 18e9", () => assert.equal(formatShort(18e9), "18 Mrd."));
t("formatShort 1,953", () => assert.equal(formatShort(1953.4), "1.953"));
t("formatShort 0,000125", () => assert.equal(formatShort(0.000125), "0,000125"));
t("formatWords 1 Mrd.", () => assert.equal(formatWords(1e9), "1 Milliarde"));
t("formatWords 2,5 Mio.", () => assert.equal(formatWords(2.5e6), "2,5 Millionen"));
const s = [1, 2, 3, 4, 5].map((v) => ({ value_original: v }));
t("windowAround Mitte", () => { const w = windowAround(s, 3, 1, 1); assert.deepEqual([w.smaller.map(e=>e.value_original), w.larger.map(e=>e.value_original), w.moreSmaller, w.moreLarger], [[2],[3],true,true]); });
const fx = makeConverter([{ base_currency: "EUR", currency: "USD", rate: 1.13 }, { base_currency: "EUR", currency: "CHF", rate: 0.937 }]);
t("USD -> EUR", () => assert.ok(Math.abs(fx(113, "USD", "EUR") - 100) < 1e-9));
t("EUR -> USD", () => assert.ok(Math.abs(fx(100, "EUR", "USD") - 113) < 1e-9));
t("USD -> CHF über EUR", () => assert.ok(Math.abs(fx(113, "USD", "CHF") - 93.7) < 1e-9));
t("gleiche Währung unverändert", () => assert.equal(fx(5, "GBP", "GBP"), 5));
t("unbekannte Einheit = null", () => assert.equal(fx(5, "people", "EUR"), null));
t("isCurrency", () => assert.deepEqual([fx.isCurrency("USD"), fx.isCurrency("people")], [true, false]));
t("windowAround mit key", () => { const w = windowAround(s, 6, 1, 1, (e) => e.value_original * 2); assert.deepEqual(w.smaller.map(e=>e.value_original), [2]); });
const infl = makeInflator([{ index_id: "i", year: 1990, value: 40, estimated: true }, { index_id: "i", year: 2000, value: 50 }, { index_id: "i", year: 2010, value: 80 }, { index_id: "i", year: 2025, value: 100 }]);
t("Inflation 2000 -> 2025", () => assert.deepEqual(infl("i", 2000), { factor: 2, from: 2000, to: 2025, estimated: false }));
t("Inflation 2010 -> 2025", () => assert.equal(infl("i", 2010).factor, 1.25));
t("aktuelles Jahr unverändert", () => assert.equal(infl("i", 2025).factor, 1));
t("Jahr nach letztem Indexwert unverändert", () => assert.equal(infl("i", 2026).factor, 1));
t("geschätzter Indexwert markiert", () => assert.deepEqual([infl("i", 1990).factor, infl("i", 1990).estimated], [2.5, true]));
t("Jahr ohne Indexwert = null", () => assert.equal(infl("i", 1980), null));
t("unbekannter Index = null", () => assert.equal(infl("x", 2000), null));
console.log(fails ? `${fails} Fehler` : "alle Tests bestanden");
process.exitCode = fails ? 1 : 0;
