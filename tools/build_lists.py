"""Build the list packages the app loads from the editorial data in Daten/.

Daten/entries.json, lists.json, list_entries.json and mean2me_contexts.json stay the
master data. This script writes one self-contained file per list to Daten/listen/,
a catalog (index.json) and the Mean2Me contexts with their reference entries.

    python3 tools/build_lists.py          # write the files
    python3 tools/build_lists.py --check  # fail if the files are out of date
"""
import json
import sys
from pathlib import Path

DATEN = Path(__file__).resolve().parent.parent / "Daten"
OUT = DATEN / "listen"

# Fields of an entry the app needs; source quotes and editorial fields stay in Daten/.
ENTRY_FIELDS = [
    "id", "title", "value_original", "unit_type", "unit", "year_original", "country_code", "index_id",
    "short_description", "long_description", "source_url", "source_title", "source2_url", "source2_title",
    "confidence_level", "status", "image",
]
# Fields of a list that the catalog and each package carry.
LIST_FIELDS = ["id", "name", "version", "description", "icon", "color", "color_dark", "image"]


def load(name):
    return json.loads((DATEN / name).read_text(encoding="utf-8"))


def entry_for_app(e, note=None):
    out = {k: e.get(k) for k in ENTRY_FIELDS if k != "image" or e.get(k)}
    if note:
        out["note"] = note
    return out


def build():
    entries = {e["id"]: e for e in load("entries.json")}
    lists = load("lists.json")
    list_entries = load("list_entries.json")
    files = {}
    catalog = []
    for lst in lists:
        rows = sorted((le for le in list_entries if le["list_id"] == lst["id"]), key=lambda le: le["sort_order"])
        package = {k: lst.get(k) for k in LIST_FIELDS}
        package["entries"] = [entry_for_app(entries[le["entry_id"]], le.get("note")) for le in rows]
        file = f"{lst['id']}.json"
        files[file] = package
        catalog.append({
            **{k: lst.get(k) for k in LIST_FIELDS}, "country_code": lst.get("country_code"),
            "count": len(rows), "file": file,
            "access": lst.get("access", "free"),
        })
    files["index.json"] = {"lists": catalog}
    files["mean2me.json"] = build_mean2me(entries)
    return {name: json.dumps(data, indent=2, ensure_ascii=False) + "\n" for name, data in files.items()}


def build_mean2me(entries):
    """Countries with their facts, and the Mean2Me contexts expanded per country.

    A context with country_code "*" is a template: it becomes one context per country
    that has the fact named in `basis`; {country}, {country_in}, {country_genitive} and {capital}
    in the title are filled in. GLOBAL contexts are taken as they are.
    """
    countries, contexts = [], []
    templates = load("mean2me_contexts.json")
    for c in load("countries.json"):
        facts = {k: entry_for_app(entries[v]) for k, v in c["facts"].items() if v}
        countries.append({**{k: v for k, v in c.items() if k != "facts"}, "facts": facts})
        for t in templates:
            if t["country_code"] != "*" or t["basis"] not in facts:
                continue
            title = (t["title"].replace("{country_genitive}", c["name_genitive"]).replace("{country_in}", c["name_in"])
                     .replace("{country}", c["name"]).replace("{capital}", c["capital"]))
            contexts.append({**t, "id": f"{t['id']}_{c['code'].lower()}", "country_code": c["code"],
                             "title": title, "factor_entry": facts[t["basis"]]})
    for t in templates:
        if t["country_code"] == "*":
            continue
        t = dict(t)
        if t.get("factor_entry_id"):
            t["factor_entry"] = entry_for_app(entries[t["factor_entry_id"]])
        contexts.append(t)
    return {"countries": countries, "contexts": contexts}


def main():
    files = build()
    if "--check" in sys.argv:
        stale = [n for n, text in files.items()
                 if not (OUT / n).exists() or (OUT / n).read_text(encoding="utf-8") != text]
        extra = [p.name for p in OUT.glob("*.json") if p.name not in files] if OUT.exists() else []
        if stale or extra:
            print("veraltet:", ", ".join(stale + extra))
            sys.exit(1)
        print("Daten/listen ist aktuell")
        return
    OUT.mkdir(exist_ok=True)
    for p in OUT.glob("*.json"):
        if p.name not in files:
            p.unlink()
    for name, text in files.items():
        (OUT / name).write_text(text, encoding="utf-8")
    print(f"{len(files)} Dateien in {OUT.relative_to(DATEN.parent)} geschrieben")


if __name__ == "__main__":
    main()
