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

* `app/` – first prototype of the mobile web app (plain HTML/CSS/JS, no build step). Run `python3 -m http.server` in the repository root and open http://localhost:8000/app/.
* `Daten/` – the current dataset (JSON), see below.
* `Datenbeispiel/` – a small example of the data model, including `mean2me_contexts`. `schema.md` describes all fields.
* `Altbestand/` – the original material from 2013: `BigNumbers.ods` (first collection of lists) and `Designdokument.odt` (first app design).

## Dataset

`Daten/` currently holds 145 entries in 6 lists:

| List | Entries |
| --- | --- |
| Budget und Steuern | 39 |
| Ruestung und Grossprojekte | 32 |
| Wirtschaft und Alltag | 25 |
| Natur und Weltraum | 17 |
| Gesundheit | 16 |
| Energie und Klima | 16 |

The values range from about 10³ to 10¹⁶, with most entries between 10 million and 1 trillion.
The focus is on Austria, Germany and the EU, complemented by global values.

Files:

* `entries.json` – one record per value: title, `value_original`, `unit`, `year_original`, `country_code`, descriptions, source.
* `lists.json` – the lists. An entry can belong to several lists.
* `list_entries.json` – assigns entries to lists, sorted by value.
* `indices.json` – price indices (CPI, HICP, ...) used to convert historic money values into today's values.
* `index_values.json` – one value per index and year (annual averages from BLS, Eurostat and the World Bank).
* `exchange_rates.json` – exchange rates (ECB reference rates, annual average) used to compare money values in different currencies.
* `source_quotes.json` – for each researched entry, the literal quote from the source page that contains the number.

Texts are written in German with real umlauts and ß. Literal quotes in `source_quotes.json` stay exactly as on the source page.

## Status and quality

All entries are `draft`. Nothing has been reviewed by a human yet.

* `confidence_level: 2` – value seen on the source page and backed by a quote in `source_quotes.json`.
* `confidence_level: 1` – estimate, lower bound, forecast, contradictory sources or old data. These entries carry a note in `list_entries.json`.
  All 15 entries from the 2013 collection have been checked against their sources (October 2026). Six remain at this level: two derived monthly values, two F-16 costs whose official source could not be opened, and two Eurofighter averages computed by Wikipedia.

Workflow for an entry: `draft` → `reviewed` (value, source and description checked by a person) → `published`.

## Rules for new entries

* Every value needs a source that can be opened and actually contains the number.
* Store the value as it appears in the source, in its base unit (e.g. `5900000000`, not `5,9 Mrd.`). No own conversions.
* Descriptions may only contain facts that are backed by the source.
* Mark uncertain values with `confidence_level: 1` and a note.

## License

Not decided yet.
