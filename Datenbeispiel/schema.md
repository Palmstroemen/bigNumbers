# Schema

Dieses Schema ist bewusst einfach gehalten und soll den Kern des Datenmodells zeigen.

## 1. `entries`

Fachliche Einträge für `Big Numbers`.

| Feld | Typ | Beschreibung |
| --- | --- | --- |
| `id` | string | stabile technische ID |
| `slug` | string | URL-freundige Kennung |
| `title` | string | Anzeigename des Eintrags |
| `value_original` | number | historischer oder fachlicher Originalwert |
| `unit_type` | string | z. B. `currency`, `length`, `count` |
| `unit` | string | z. B. `USD`, `EUR`, `m`, `people` |
| `year_original` | number | Bezugsjahr des Originalwertes |
| `country_code` | string | ISO-oder projektspezifischer Ländercode |
| `index_id` | string/null | Referenz auf verwendeten Index |
| `short_description` | string | kurzer Anreißer |
| `long_description` | string | längerer Beschreibungstext |
| `source_url` | string | primäre Quelle |
| `source_title` | string | Titel der primären Quelle |
| `source2_url` | string/null | optionale zweite Quelle |
| `source2_title` | string/null | Titel der zweiten Quelle |
| `confidence_level` | number | einfacher Prüfstatus, z. B. `0-7` |
| `status` | string | z. B. `draft`, `reviewed`, `published` |
| `image` | object/null | optionales Bild für die Detailansicht: `src`, `width`, `height`, `alt`, `credit` (Urheber), `license` (z. B. `CC BY-SA 4.0`), `source_url`. Nur Lizenzen, die kommerzielle Nutzung erlauben. |

## 2. `lists`

Versionierte Listen, in denen Einträge gruppiert oder publiziert werden.

| Feld | Typ | Beschreibung |
| --- | --- | --- |
| `id` | string | Listen-ID |
| `name` | string | Anzeigename |
| `version` | string | z. B. `v1` |
| `country_code` | string/null | Landeskontext oder `null` für global |
| `description` | string | Kurzbeschreibung der Liste |
| `icon` | string/null | Name des Liniensymbols der Liste (`government`, `arch`, `health`, `energy`, `chart`, `moon`) |
| `color` | string/null | Kennfarbe der Liste im hellen Modus (Hex) |
| `color_dark` | string/null | Kennfarbe der Liste im dunklen Modus (Hex) |
| `image` | object/null | Ersatzbild für Einträge ohne eigenes Bild, Aufbau wie `entries.image` |

## 3. `list_entries`

Zuordnungstabelle zwischen Listen und Einträgen.

| Feld | Typ | Beschreibung |
| --- | --- | --- |
| `id` | string | ID der Zuordnung |
| `list_id` | string | Referenz auf eine Liste |
| `entry_id` | string | Referenz auf einen Eintrag |
| `sort_value` | number | numerischer Sortierwert |
| `sort_order` | number | Reihenfolge innerhalb einer Liste |
| `note` | string/null | optionale redaktionelle Notiz |

## 4. `indices`

Referenzierte Preis- und Kostenindizes.

| Feld | Typ | Beschreibung |
| --- | --- | --- |
| `id` | string | Index-ID |
| `name` | string | Anzeigename |
| `type` | string | z. B. `cpi`, `construction_cost`, `energy_price` |
| `country_code` | string | Ländercode |
| `base_year` | number/null | Basisjahr des Index |
| `source_url` | string | Quellenlink |
| `source_title` | string | Quellentitel |
| `notes` | string | redaktionelle Erklärung |

## 5. `mean2me_contexts`

Bezugsgrößen für „Für mich“. In `Daten/` sind sie Vorlagen: Ein Kontext mit `country_code: "*"` wird für jedes Land in `countries.json` erzeugt, das die Grundgröße aus `basis` hat. `tools/build_lists.py` setzt dabei `{country}`, `{country_in}`, `{country_genitive}` und `{capital}` im Titel ein.

| Feld | Typ | Beschreibung |
| --- | --- | --- |
| `id` | string | Kontext-ID (beim Erzeugen um den Ländercode ergänzt) |
| `country_code` | string | `*` für eine Ländervorlage, `GLOBAL` für länderunabhängige Kontexte |
| `basis` | string/null | Name der Grundgröße in `countries.facts`, z. B. `population`, `gdp` |
| `kind` | string | `divide` (Zahl ÷ Bezug) oder `share` (Anteil am Bezug in Prozent) |
| `title` | string | Anzeigename, bei Vorlagen mit Platzhaltern |
| `factor_entry_id` | string/null | nur `GLOBAL`: Eintrag, der den Bezugswert liefert |
| `factor_value` | number/null | nur `GLOBAL`: fester Bezugswert, z. B. 365 Tage |
| `factor_source` | string/null | Beschreibung des festen Bezugswerts |
| `result_unit` | string/null | Einheit des Ergebnisses, z. B. `Jahre`; leer = Währung der Zahl |
| `only_currency` | boolean | nur zeigen, wenn die Zahl eine Währung hat |
| `notes` | string | Hinweise zur Interpretation |

## 6. `countries`

Länder für „Für mich“. Mit dem Land kommen seine Grunddaten; jede Grundgröße verweist auf einen belegten Eintrag in `entries.json`.

| Feld | Typ | Beschreibung |
| --- | --- | --- |
| `code` | string | ISO-Ländercode |
| `name` / `name_in` / `name_genitive` | string | Name, z. B. `Schweiz` / `in der Schweiz` / `der Schweiz` |
| `flag` | string | Flaggen-Emoji für die Länderwahl |
| `currency` | string | Landeswährung, wird beim Wechsel vorausgewählt |
| `capital` | string | Hauptstadt |
| `locales` / `timezones` | string[] | Browser-Sprachen und Zeitzonen für die automatische Vorauswahl |
| `facts` | object | Grundgrößen → Eintrags-ID oder `null`: `population`, `capital_population`, `households`, `median_income_year`, `median_wage_month`, `median_net_income_year`, `gdp`, `federal_budget`, `government_expenditure`, `income_tax_revenue` (Lohn- und Einkommensteuer aller Privatpersonen; Grundlage für „Dein Anteil“) |

Eigene Bezugsgrößen der Nutzerin oder des Nutzers (z. B. „Autofahrer in Österreich“) speichert die App nur auf dem Gerät, im selben Aufbau wie ein Kontext mit `factor_value`.

## Beziehungsidee

- Ein `entry` kann in mehreren `lists` vorkommen.
- Ein `entry` verweist optional auf genau einen Standard-`index`.
- Ein `mean2me_context` gehört zu einem Land oder Markt.
- Nutzerwerte wie "heute in EUR" oder "pro Einwohner für den aktuellen Nutzer" werden später aus diesen Stammdaten abgeleitet.
