# bigNumbers
(There is a companion-repository for the app software: https://github.com/Palmstroemen/mean2me)

The aim of this repository is to build a well investigated, sourced collection of big numbers.
It answers the question: *"18 billion – what is that comparable to?"*

Each entry is a real-world value (a budget, a price, a population, a distance, ...) with year, unit and source.
Sorted by value, the entries put any big number from the news into context.
The companion project mean2me adds the second perspective: *"What does this number mean to me?"*
(e.g. per citizen, per taxpayer, per household).

## Folders

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
* `source_quotes.json` – for each researched entry, the literal quote from the source page that contains the number.

Texts are written in German, umlauts as `ae`, `oe`, `ue`, `ss`.

## Status and quality

All entries are `draft`. Nothing has been reviewed by a human yet.

* `confidence_level: 2` – value seen on the source page and backed by a quote in `source_quotes.json`.
* `confidence_level: 1` – estimate, lower bound, forecast, contradictory sources or old data. These entries carry a note in `list_entries.json`.
  The 15 entries from the 2013 collection are all at this level.

Workflow for an entry: `draft` → `reviewed` (value, source and description checked by a person) → `published`.

## Rules for new entries

* Every value needs a source that can be opened and actually contains the number.
* Store the value as it appears in the source, in its base unit (e.g. `5900000000`, not `5,9 Mrd.`). No own conversions.
* Descriptions may only contain facts that are backed by the source.
* Mark uncertain values with `confidence_level: 1` and a note.

## License

Not decided yet.
