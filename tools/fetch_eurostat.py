"""Fetch the base facts of all EU countries from Eurostat, plus rates and price indices.

For every country in Daten/countries.json with an `eurostat_geo` code this script
takes the latest value of each dataset below and writes it as an entry
(entries.json, list "Länder", quote = the Eurostat observation). It fills a fact of
the country only when the fact is empty or was filled by this script before, so
hand-researched national figures (e.g. for Austria) stay. It also adds ECB rates
and Eurostat HICP series for currencies that are still missing.

    python3 tools/fetch_eurostat.py && python3 tools/build_lists.py
"""
import json
import urllib.parse
import urllib.request
from pathlib import Path

DATEN = Path(__file__).resolve().parent.parent / "Daten"
API = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
UA = {"User-Agent": "BigNumbersPrototype/0.1 (https://github.com/Palmstroemen/bigNumbers)"}
LIST_ID = "list_laender_v1"

# fact -> dataset, filters, factor to base unit, unit_type, unit (None = national currency), title, label
DATASETS = {
    "population": ("tps00001", {}, 1, "count", "people",
                   "Einwohner {in}", "Bevölkerung am 1. Januar"),
    "households": ("lfst_hhnhtych", {"phhcomp": "TOTAL", "agechild": "TOTAL", "n_child": "TOTAL", "unit": "THS_HH"},
                   1000, "count", "households", "Privathaushalte {in}", "Privathaushalte (Arbeitskräfteerhebung)"),
    "median_net_income_year": ("ilc_di03", {"statinfo": "MED_EI", "unit": "NAC", "age": "TOTAL", "sex": "T"},
                               1, "currency", None, "Medianes Nettoäquivalenzeinkommen {in}",
                               "Medianes Äquivalenzeinkommen pro Jahr"),
    "gdp": ("nama_10_gdp", {"unit": "CP_MNAC", "na_item": "B1GQ"}, 1e6, "currency", None,
            "Bruttoinlandsprodukt {gen}", "Bruttoinlandsprodukt zu Marktpreisen"),
    "government_expenditure": ("gov_10a_main", {"unit": "MIO_NAC", "sector": "S13", "na_item": "TE"}, 1e6,
                               "currency", None, "Staatsausgaben {gen} (Gesamtstaat)",
                               "Gesamtausgaben des Staates (Sektor S13)"),
    "capital_population": ("urb_cpop1", {"indic_ur": "DE1001V"}, 1, "count", "people",
                           "Einwohner {capital}", "Bevölkerung am 1. Januar, Stadt"),
}
INDEX_OF = {"USD": "idx_us_cpi", "EUR": "idx_eurozone_hicp", "GBP": "idx_uk_cpi", "CHF": "idx_ch_cpi",
            "HUF": "idx_hu_cpi", "CZK": "idx_cz_cpi"}


def get(dataset, params):
    query = urllib.parse.urlencode(params, doseq=True)
    with urllib.request.urlopen(urllib.request.Request(f"{API}{dataset}?format=JSON&lang=en&{query}", headers=UA),
                                timeout=60) as res:
        return json.load(res)


def observations(d, geo_dim="geo"):
    """All observations as (geo, year, value, status)."""
    dims, sizes = d["id"], d["size"]
    index = {dim: {i: code for code, i in d["dimension"][dim]["category"]["index"].items()} for dim in dims}
    status = d.get("status", {})
    for key, value in d["value"].items():
        flat, pos = int(key), {}
        for dim, size in zip(reversed(dims), reversed(sizes)):
            pos[dim] = index[dim][flat % size]
            flat //= size
        yield pos[geo_dim], int(pos["time"]), value, status.get(key)


def fmt(n):
    """The observation as Eurostat shows it, with thin thousands groups: 9 539 502 or 85 123.4."""
    return f"{n:,}".replace(",", " ") if n != int(n) else f"{int(n):,}".replace(",", " ")


def main():
    countries = json.loads((DATEN / "countries.json").read_text())
    entries = json.loads((DATEN / "entries.json").read_text())
    list_entries = json.loads((DATEN / "list_entries.json").read_text())
    lists = json.loads((DATEN / "lists.json").read_text())
    quotes = json.loads((DATEN / "source_quotes.json").read_text())
    by_id = {e["id"]: e for e in entries}
    eu = [c for c in countries if c.get("eurostat_geo")]
    geos = [c["eurostat_geo"] for c in eu]

    if not any(l["id"] == LIST_ID for l in lists):
        lists.append({"id": LIST_ID, "name": "Länder", "version": "v1", "country_code": "EU",
                      "description": "Grunddaten der EU-Länder und der Schweiz: Einwohner, Haushalte, Einkommen, "
                                     "Wirtschaftsleistung und Staatsausgaben, automatisch aus Eurostat.",
                      "icon": "globe", "color": "#0e7490", "color_dark": "#67e8f9", "image": None})

    for fact, (ds, filters, factor, unit_type, unit, title, label) in DATASETS.items():
        params = {**filters, "sinceTimePeriod": 2015}
        if fact == "capital_population":
            params["cities"] = [f"{g}001C" for g in geos]
            d = get(ds, params)
            geo_dim, names = "cities", d["dimension"]["cities"]["category"]["label"]
        else:
            params["geo"] = geos
            d = get(ds, params)
            geo_dim, names = "geo", d["dimension"]["geo"]["category"]["label"]
        latest = {}
        for geo, year, value, status in observations(d, geo_dim):
            if value is not None and (geo not in latest or year > latest[geo][0]):
                latest[geo] = (year, value, status)
        for c in eu:
            key = f"{c['eurostat_geo']}001C" if fact == "capital_population" else c["eurostat_geo"]
            if key not in latest:
                continue
            year, value, status = latest[key]
            eid = f"entry_estat_{fact}_{c['code'].lower()}"
            # Eurostat's "city" for Valletta covers far more than the small capital itself
            if fact == "capital_population" and ("greater city" in names[key] or year < 2020 or c["code"] == "MT"):
                continue                      # a metropolitan area or an old count would mislead
            current = c["facts"].get(fact)
            if current and not current.startswith("entry_estat_"):
                continue                      # a hand-researched figure wins
            cur = unit or c["currency"]
            entry = {
                "id": eid, "slug": eid[6:].replace("_", "-"),
                "title": title.format(**{"in": c["name_in"], "gen": c["name_genitive"], "capital": c["capital"]}),
                "value_original": round(value * factor, 2) if factor == 1 else round(value * factor),
                "unit_type": unit_type, "unit": cur, "year_original": year, "country_code": c["code"],
                "index_id": INDEX_OF.get(cur, f"idx_hicp_{c['code'].lower()}") if unit_type == "currency" else None,
                "short_description": f"{label}: {c['name']}, {year} (Eurostat).",
                "long_description": f"Eurostat, Datensatz {ds}: {label}, {names[key]}, {year}.",
                "source_url": f"https://ec.europa.eu/eurostat/databrowser/view/{ds}/default/table",
                "source_title": f"Eurostat: Datensatz {ds} ({d.get('label', ds)})",
                "source2_url": None, "source2_title": None,
                "confidence_level": 1 if status else 2, "status": "draft",
            }
            if eid in by_id:
                by_id[eid].update(entry)
            else:
                entries.append(entry)
                by_id[eid] = entry
            raw = fmt(value)
            quotes[eid] = f"Eurostat {ds}, {names[key]}, {year}: {raw}" + (f" ({status})" if status else "") + \
                {1: "", 1000: " Tausend", 1e6: " Mio."}[factor]
            le = next((l for l in list_entries if l["entry_id"] == eid), None)
            if le is None:
                n = max(int("".join(ch for ch in l["id"] if ch.isdigit())) for l in list_entries) + 1
                le = {"id": f"le_{n:03d}", "list_id": LIST_ID, "entry_id": eid, "sort_value": 0, "sort_order": 0}
                list_entries.append(le)
            le["sort_value"] = entry["value_original"]
            if status:
                le["note"] = f"Eurostat kennzeichnet den Wert mit „{status}“ (z. B. vorläufig oder geschätzt)."
            else:
                le.pop("note", None)
            c["facts"][fact] = eid
        print(f"{fact}: {sum(1 for c in eu if (c['facts'].get(fact) or '').startswith('entry_estat_'))} Länder")

    # exchange rates and price indices for currencies that are still missing
    rates = json.loads((DATEN / "exchange_rates.json").read_text())
    indices = json.loads((DATEN / "indices.json").read_text())
    values = json.loads((DATEN / "index_values.json").read_text())
    have_rate = {r["currency"] for r in rates} | {"EUR"}
    have_index = {i["id"] for i in indices}
    for c in eu:
        cur = c["currency"]
        if cur not in have_rate:
            url = f"https://data-api.ecb.europa.eu/service/data/EXR/A.{cur}.EUR.SP00.A?format=jsondata&startPeriod=2025&endPeriod=2025"
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as res:
                obs = json.load(res)["dataSets"][0]["series"]["0:0:0:0:0"]["observations"]["0"][0]
            rates.append({"id": f"fx_ecb_{cur.lower()}_2025", "base_currency": "EUR", "currency": cur,
                          "rate": round(obs, 4), "year": 2025, "rate_type": "annual_average",
                          "source_url": f"https://data.ecb.europa.eu/data/datasets/EXR/EXR.A.{cur}.EUR.SP00.A",
                          "source_title": f"EZB Data Portal: Euro-Referenzkurs {cur}, Jahresdurchschnitt",
                          "notes": f"1 EUR = {str(round(obs, 4)).replace('.', ',')} {cur}. Jahresdurchschnitt 2025 der EZB-Referenzkurse."})
            have_rate.add(cur)
        iid = INDEX_OF.get(cur, f"idx_hicp_{c['code'].lower()}")
        if iid not in have_index:
            d = get("prc_hicp_aind", {"unit": "INX_A_AVG", "coicop": "CP00", "geo": c["eurostat_geo"]})
            series = sorted((y, v) for _, y, v, _ in observations(d) if v is not None)
            indices.append({"id": iid, "name": f"HICP {c['name']}", "type": "cpi", "country_code": c["code"],
                            "base_year": 2015, "source_url": "https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_aind/default/table",
                            "source_title": f"Eurostat: HICP – annual data (prc_hicp_aind), {c['name']}",
                            "notes": f"Harmonisierter Verbraucherpreisindex für historische {cur}-Werte, Jahresdurchschnitte "
                                     f"{series[0][0]}–{series[-1][0]}, Basis 2015 = 100."})
            values += [{"index_id": iid, "year": y, "value": v} for y, v in series]
            have_index.add(iid)

    # drop generated entries that no country uses any more (e.g. a capital now filtered out)
    used = {v for c in countries for v in c["facts"].values() if v}
    stale = {e["id"] for e in entries if e["id"].startswith("entry_estat_") and e["id"] not in used}
    for c in eu:
        for k, v in c["facts"].items():
            if v in stale:
                c["facts"][k] = None
    entries = [e for e in entries if e["id"] not in stale]
    list_entries = [l for l in list_entries if l["entry_id"] not in stale]
    for eid in stale:
        quotes.pop(eid, None)

    for lid in {l["list_id"] for l in list_entries}:
        rows = sorted((l for l in list_entries if l["list_id"] == lid), key=lambda l: (l["sort_value"], l["sort_order"]))
        for i, l in enumerate(rows):
            l["sort_order"] = (i + 1) * 10
    for name, data in [("countries", countries), ("entries", entries), ("list_entries", list_entries),
                       ("lists", lists), ("exchange_rates", rates), ("indices", indices)]:
        (DATEN / f"{name}.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    (DATEN / "index_values.json").write_text(json.dumps(values, indent=2) + "\n")
    (DATEN / "source_quotes.json").write_text(json.dumps(quotes, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
