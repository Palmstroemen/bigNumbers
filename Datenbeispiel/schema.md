# Schema

Dieses Schema ist bewusst einfach gehalten und soll den Kern des Datenmodells zeigen.

## 1. `entries`

Fachliche Eintraege fuer `Big Numbers`.

| Feld | Typ | Beschreibung |
| --- | --- | --- |
| `id` | string | stabile technische ID |
| `slug` | string | URL-freundige Kennung |
| `title` | string | Anzeigename des Eintrags |
| `value_original` | number | historischer oder fachlicher Originalwert |
| `unit_type` | string | z. B. `currency`, `length`, `count` |
| `unit` | string | z. B. `USD`, `EUR`, `m`, `people` |
| `year_original` | number | Bezugsjahr des Originalwertes |
| `country_code` | string | ISO-oder projektspezifischer Laendercode |
| `index_id` | string/null | Referenz auf verwendeten Index |
| `short_description` | string | kurzer Anreisser |
| `long_description` | string | laengerer Beschreibungstext |
| `source_url` | string | primaere Quelle |
| `source_title` | string | Titel der primaeren Quelle |
| `source2_url` | string/null | optionale zweite Quelle |
| `source2_title` | string/null | Titel der zweiten Quelle |
| `confidence_level` | number | einfacher Pruefstatus, z. B. `0-7` |
| `status` | string | z. B. `draft`, `reviewed`, `published` |

## 2. `lists`

Versionierte Listen, in denen Eintraege gruppiert oder publiziert werden.

| Feld | Typ | Beschreibung |
| --- | --- | --- |
| `id` | string | Listen-ID |
| `name` | string | Anzeigename |
| `version` | string | z. B. `v1` |
| `country_code` | string/null | Landeskontext oder `null` fuer global |
| `description` | string | Kurzbeschreibung der Liste |
| `icon` | string/null | optionale Icon-Referenz |

## 3. `list_entries`

Zuordnungstabelle zwischen Listen und Eintraegen.

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
| `country_code` | string | Laendercode |
| `base_year` | number/null | Basisjahr des Index |
| `source_url` | string | Quellenlink |
| `source_title` | string | Quellentitel |
| `notes` | string | redaktionelle Erklaerung |

## 5. `mean2me_contexts`

Kontexte fuer persoenliche Umrechnungen.

| Feld | Typ | Beschreibung |
| --- | --- | --- |
| `id` | string | Kontext-ID |
| `title` | string | Anzeigename |
| `country_code` | string | Land oder Region |
| `factor_source` | string | Quelle des Divisors |
| `factor_value` | number | Divisor fuer die Umrechnung |
| `unit_label` | string | z. B. `pro Einwohner` |
| `icon` | string/null | optionale Icon-Referenz |
| `is_default` | boolean | Standardkontext fuer das Land |
| `notes` | string | Hinweise zur Interpretation |

## Beziehungsidee

- Ein `entry` kann in mehreren `lists` vorkommen.
- Ein `entry` verweist optional auf genau einen Standard-`index`.
- Ein `mean2me_context` gehoert zu einem Land oder Markt.
- Nutzerwerte wie "heute in EUR" oder "pro Einwohner fuer den aktuellen Nutzer" werden spaeter aus diesen Stammdaten abgeleitet.
