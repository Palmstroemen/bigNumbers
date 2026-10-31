# bigNumbers
The aim of this project is to put big numbers from the news into context. It answers two questions:

1. **Big Numbers:** *"18 billion – what is that comparable to?"*
   A sorted list of real-world values of similar size (a budget, a price, a population, a distance, ...), each with year, unit and source.
2. **Mean2Me:** *"What does this number mean to me?"*
   The same number broken down per citizen, per taxpayer, per household, ...

Mean2Me is an integrated feature of this project. The former separate repository https://github.com/Palmstroemen/mean2me is archived.

## Concept

Mobile first. Three views side by side:

| Left | Center | Right |
| --- | --- | --- |
| Big Numbers | Number pad / paste field (start view) | Mean2Me |

Enter or paste a number in the center, then swipe sideways: the comparisons are on the left, the personal perspective on the right.

## Folders

* `app/` – first prototype of the mobile web app (plain HTML/CSS/JS, no build step). It holds only the user interface and the calculator; everything else comes from `core/`. Run `python3 -m http.server` in the repository root and open http://localhost:8000/app/.
* `core/` – the core shared by every form of Big Numbers (app, and later an embed widget, a browser extension, generated pages or an API): loading the dataset, comparisons, inflation and currency adjustment, Mean2Me breakdowns, number formatting and parsing. Plain ES modules without DOM or storage access, so they also run in node. Entry point `core/index.js`; `openBigNumbers({ bases, load })` loads the data from a folder URL, or from disk with your own `load` function (see `tests/data.test.mjs`).
* `embed/` – the script for articles: `means2me.js` turns `<span data-means2me='…'>38 Mio. Euro</span>` into a marked number that shows the breakdowns a newsroom chose (tooltip on desktop, sheet on phones). The values are frozen in the page (`BigNumbers.snapshot()` in the core), so reading an article makes no request to us. A snapshot can also hold comparisons: the entries closest to the number (at most ten times larger or smaller) from the lists a newsroom chose, shown under “Vergleich mit anderen Zahlen”. `demo.html` is a sample article. `lesezeichen.html` installs a preview bookmarklet (`preview.js`): on any news page it marks the money amounts from 1 million on, computed on the spot with the core (`findAmounts()`), leaving numbers the newsroom marked itself as they are.
* `wordpress/means2me/` – WordPress plugin. In the block editor a toolbar button marks the selected amount (or the amount under the cursor) and lets the author tick breakdowns and comparison lists; the result is stored as the same frozen `data-means2me` span. On the site it loads `means2me.js` from the plugin itself, only on pages with marks. `tools/build_wordpress.sh` copies core, the embed script and the data into `vendor/` and writes `dist/means2me.zip`; run it after every data update.
* `android/` – Android app (package `de.means2me.app`), a Trusted Web Activity made with Bubblewrap: a thin shell that opens https://means2me.de/app/ full screen, so every push to the site reaches the app without a store release. The app proves it belongs to the domain through `.well-known/assetlinks.json`. Build the signed bundle with `npx @bubblewrap/cli@1.27.0 build --skipPwaValidation` in `android/`; the upload key lives outside the repo.
* `tests/` – `node tests/core.test.mjs` (formatting, parsing, calculator, conversion) and `node tests/data.test.mjs` (the core with the real dataset).
* `Daten/` – the current dataset (JSON), see below.
* `tools/fetch_eurostat.py` – fetches the base facts of all EU countries and Switzerland from Eurostat (population, households, median net income, GDP, government expenditure, income tax revenue, capital), plus ECB rates and HICP series for their currencies. Run it to update, then `tools/build_lists.py`; `tools/fetch_eurostat.py income_tax_revenue` fetches only the named facts.
* `tools/build_lists.py` – builds the list packages in `Daten/listen/` from the master data. Run it after every data change; `--check` reports whether the packages are up to date.
* `Datenbeispiel/` – a small example of the data model, including `mean2me_contexts`. `schema.md` describes all fields.
* `Altbestand/` – the original material from 2013: `BigNumbers.ods` (first collection of lists) and `Designdokument.odt` (first app design).

## Dataset

`Daten/` currently holds 591 entries in 7 lists:

| List | Entries |
| --- | --- |
| Länder (generated from Eurostat, plus Hungary, Czechia, USA) | 180 |
| Budget und Steuern | 103 |
| Wirtschaft und Alltag | 100 |
| Rüstung und Großprojekte | 72 |
| Natur und Weltraum | 40 |
| Gesundheit | 48 |
| Energie und Klima | 48 |

The values range from single euros (a monthly ticket) to 10¹⁸ (the water on Earth in m³), with most entries between 1 million and 1 trillion.
The focus is on Austria, Germany and the EU, complemented by global values.

Files:

* `entries.json` – one record per value: title, `value_original`, `unit`, `year_original`, `country_code`, descriptions, source.
* `lists.json` – the lists. An entry can belong to several lists.
* `list_entries.json` – assigns entries to lists, sorted by value.
* `indices.json` – price indices (CPI, HICP, ...) used to convert historic money values into today's values.
* `index_values.json` – one value per index and year (annual averages from BLS, Eurostat and the World Bank). US values go back to 1913. For the other indices, years before the official series are estimates (flag `estimated`), back to 1945; `indices.json` describes the method in `estimate_note`.
* `countries.json` – the countries for “Für mich”: all 27 EU countries, Switzerland and the USA, with flag, currency, capital, time zones and their base facts, each pointing to a sourced entry. Hand-researched national figures (Austria, Germany, Switzerland, Hungary, Czechia, USA) take precedence over the Eurostat figures. `income_tax_revenue` (all personal income tax, Eurostat D51A_C1; for the USA federal individual income taxes from the Treasury) lets “Für mich” show the user's own share: value × own income tax ÷ all income tax. The own tax stays on the device.
* `mean2me_contexts.json` – the “Für mich” calculations; most are templates that `tools/build_lists.py` expands for every country.
* `exchange_rates.json` – exchange rates (ECB reference rates, annual average) used to compare money values in different currencies.
* `source_quotes.json` – for each researched entry, the literal quote from the source page that contains the number. For entries fetched from Eurostat it is the dataset observation (dataset, country, year, value, status flag).
* `bilder/` – pictures for the detail view (800 px JPEGs from Wikimedia Commons). Each entry names its picture in `image` with author, license and source page; only licenses that allow commercial use (CC BY, CC BY-SA, public domain).
* `listen/` – generated by `tools/build_lists.py`, do not edit by hand. One self-contained file per list, a catalog `index.json` (name, description, number of entries, version, access) and `mean2me.json`. The app loads only the lists the user has switched on and merges them. This is the basis for list packages that can later be sold separately.

Texts are written in German with real umlauts and ß. Literal quotes in `source_quotes.json` stay exactly as on the source page.

## Status and quality

All entries are `draft`. Nothing has been reviewed by a human yet.

* `confidence_level: 2` – value seen on the source page and backed by a quote in `source_quotes.json`.
* `confidence_level: 1` – estimate, lower bound, forecast, contradictory sources or old data. These entries carry a note in `list_entries.json`.
  All entries were checked against their sources in October 2026. Of the 591 entries, 101 are at this level (25 of them Eurostat values flagged as provisional, estimated or with a break in series), each with a note saying why.
  All 15 entries from the 2013 collection have been checked against their sources (October 2026). Four remain at this level: two derived monthly values and two Eurofighter averages computed by Wikipedia.

Workflow for an entry: `draft` → `reviewed` (value, source and description checked by a person) → `published`.

## Rules for new entries

* Every value needs a source that can be opened and actually contains the number.
* Store the value as it appears in the source, in its base unit (e.g. `5900000000`, not `5,9 Mrd.`). No own conversions.
* Descriptions may only contain facts that are backed by the source.
* Mark uncertain values with `confidence_level: 1` and a note.

## License

* Code (`app/`, `core/`, `tools/`, `tests/`): [MIT](LICENSE).
* Data (`Daten/`, `Datenbeispiel/`): [CC BY 4.0](Daten/LICENSE.md). Pictures and literal source quotes keep their own licenses, see there.
