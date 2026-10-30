# Datenbeispiel

Dieser Ordner enthält ein kleines Beispiel für ein mögliches Datenmodell von `Big Numbers` mit integriertem `Mean2Me`.

Ziel des Beispiels:

- Stammdaten von Laufzeitwerten trennen
- Listen und Listenversionen separat modellieren
- Indizes als eigene Entitäten führen
- persönliche `Mean2Me`-Kontexte getrennt halten

## Dateien

- `schema.md`: erklärt die vorgeschlagenen Tabellen und ihre Beziehungen
- `entries.json`: Beispiel-Einträge für `Big Numbers`
- `lists.json`: versionierte Listen
- `list_entries.json`: Zuordnung zwischen Listen und Einträgen
- `indices.json`: Preis- und Kostenindizes
- `mean2me_contexts.json`: persönliche Kontexte für `Mean2Me`

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

- heutiger Nutzerwert in Zielwährung
- persönliche Umrechnung für `Mean2Me`
- Cache-Werte für schnelle Auslieferung

Sie werden später zur Laufzeit berechnet oder zwischengespeichert.

### Listen statt starre Kategorie

Ein Eintrag kann in mehreren Listen vorkommen. Deshalb gibt es kein starres Einzelfeld `category`, sondern:

- `lists`
- `list_entries`

### Indizes als Referenzen

Damit nicht dieselben Index-Informationen vielfach kopiert werden, verweist jeder Eintrag über `index_id` auf einen Datensatz in `indices.json`.
