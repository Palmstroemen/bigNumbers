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

Kontexte für persönliche Umrechnungen.

| Feld | Typ | Beschreibung |
| --- | --- | --- |
| `id` | string | Kontext-ID |
| `title` | string | Anzeigename |
| `country_code` | string | Land oder Region |
| `factor_source` | string | Quelle des Divisors |
| `factor_value` | number | Divisor für die Umrechnung |
| `unit_label` | string | z. B. `pro Einwohner` |
| `icon` | string/null | optionale Icon-Referenz |
| `is_default` | boolean | Standardkontext für das Land |
| `notes` | string | Hinweise zur Interpretation |

## Beziehungsidee

- Ein `entry` kann in mehreren `lists` vorkommen.
- Ein `entry` verweist optional auf genau einen Standard-`index`.
- Ein `mean2me_context` gehört zu einem Land oder Markt.
- Nutzerwerte wie "heute in EUR" oder "pro Einwohner für den aktuellen Nutzer" werden später aus diesen Stammdaten abgeleitet.
