# Datenbeispiel

Dieser Ordner enthaelt ein kleines Beispiel fuer ein moegliches Datenmodell von `Big Numbers` mit integriertem `Mean2Me`.

Ziel des Beispiels:

- Stammdaten von Laufzeitwerten trennen
- Listen und Listenversionen separat modellieren
- Indizes als eigene Entitaeten fuehren
- persoenliche `Mean2Me`-Kontexte getrennt halten

## Dateien

- `schema.md`: erklaert die vorgeschlagenen Tabellen und ihre Beziehungen
- `entries.json`: Beispiel-Eintraege fuer `Big Numbers`
- `lists.json`: versionierte Listen
- `list_entries.json`: Zuordnung zwischen Listen und Eintraegen
- `indices.json`: Preis- und Kostenindizes
- `mean2me_contexts.json`: persoenliche Kontexte fuer `Mean2Me`

## Grundprinzipien

### Stammdaten

In `entries.json` stehen nur relativ stabile Stammdaten wie:

- `id`
- `title`
- `value_original`
- `unit`
- `unit_type`
- `year_original`
- `country_code`
- `index_id`
- `short_description`
- `long_description`
- Quellenangaben

### Nicht im Stammdatensatz gespeichert

Diese Werte werden nicht direkt im Datensatz abgelegt:

- heutiger Nutzerwert in Zielwaehrung
- persoenliche Umrechnung fuer `Mean2Me`
- Cache-Werte fuer schnelle Auslieferung

Sie werden spaeter zur Laufzeit berechnet oder zwischengespeichert.

### Listen statt starre Kategorie

Ein Eintrag kann in mehreren Listen vorkommen. Deshalb gibt es kein starres Einzelfeld `category`, sondern:

- `lists`
- `list_entries`

### Indizes als Referenzen

Damit nicht dieselben Index-Informationen vielfach kopiert werden, verweist jeder Eintrag ueber `index_id` auf einen Datensatz in `indices.json`.
