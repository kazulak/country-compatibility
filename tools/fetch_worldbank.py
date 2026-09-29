"""Fetch real indicators from the World Bank and write docs/data/worldbank.json.

Usage:  python tools/fetch_worldbank.py
Needs internet access; standard library only. Re-run any time to refresh the data.

Each scored metric maps one World Bank indicator onto the site's 0-10 scale using
FIXED anchor points (not the min/max of the current data), so a country's score
only changes when its own number changes. Values older than MIN_YEAR are ignored,
and the site falls back to the hand-made estimate for that metric.
"""
import datetime
import json
import math
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
COUNTRIES = ROOT / "docs" / "data" / "countries.json"
OUTPUT = ROOT / "docs" / "data" / "worldbank.json"
API = "https://api.worldbank.org/v2/country/all/indicator/{code}?format=json&mrnev=1&per_page=20000"
MIN_YEAR = 2015


def clamp10(x):
    return round(min(10.0, max(0.0, x)), 1)


def linear(lo, hi):
    """lo maps to 0, hi maps to 10 (hi may be below lo for 'lower is better')."""
    return lambda v: clamp10(10 * (v - lo) / (hi - lo))


# metric key -> how to score it. "compute" builds the raw value from fetched indicators.
METRICS = {
    "safety": {
        "indicators": ["VC.IHR.PSRC.P5"],
        "measure": "Intentional homicides per 100,000 people",
        "unit": "per 100k",
        "transform": "Log scale: 0 homicides = 10, 50 or more = 0.",
        "score": lambda h: clamp10(10 * (1 - math.log10(1 + h) / math.log10(51))),
    },
    "air_quality": {
        "indicators": ["EN.ATM.PM25.MC.M3"],
        "measure": "PM2.5 air pollution, mean annual exposure",
        "unit": "µg/m³",
        "transform": "5 µg/m³ (WHO guideline) = 10, 50 or more = 0, linear.",
        "score": linear(50, 5),
    },
    "internet_speed": {
        "indicators": ["IT.NET.USER.ZS"],
        "measure": "Individuals using the internet",
        "unit": "% of population",
        "transform": "Share online divided by 10 (100% = 10). Measures access, not speed.",
        "score": lambda pct: clamp10(pct / 10),
    },
    # Unemployment was tried first but rewards large informal economies (Thailand, Mexico scored ~10),
    # so income level is the more honest proxy for "how well-paid can work be here".
    "local_job_market": {
        "indicators": ["NY.GDP.PCAP.PP.CD"],
        "measure": "GDP per capita, PPP (income level)",
        "unit": "international $",
        "transform": "Log scale: $2,000 = 0, $100,000 or more = 10. An economy-wide average, not wages for your job.",
        "score": lambda g: clamp10(10 * math.log(g / 2000) / math.log(50)),
    },
    "healthcare_quality": {
        "indicators": ["SP.DYN.LE00.IN"],
        "measure": "Life expectancy at birth",
        "unit": "years",
        "transform": "55 years = 0, 85 years = 10, linear. A health outcome, not a direct measure of healthcare.",
        "score": linear(55, 85),
    },
    "cost_of_living": {
        "indicators": ["PA.NUS.PPP", "PA.NUS.FCRF"],
        "measure": "Price level ratio (PPP conversion factor / market exchange rate; USA = 1)",
        "unit": "× US prices",
        "transform": "Log scale: 0.2 × US prices = 0 (cheap), 1.2 × = 10 (expensive).",
        # Both inputs must be within a year of each other, otherwise inflation distorts the ratio.
        "compute": lambda ppp, fx: (ppp[0] / fx[0], min(ppp[1], fx[1])) if abs(ppp[1] - fx[1]) <= 1 else None,
        "score": lambda r: clamp10(10 * math.log(r / 0.2) / math.log(6)),
    },
    "nature_forests_greenery": {
        "indicators": ["AG.LND.FRST.ZS"],
        "measure": "Forest area",
        "unit": "% of land area",
        "transform": "0% = 0, 60% or more = 10, linear. Counts forest only, not parks or farmland.",
        "score": linear(0, 60),
    },
}

FACTS = {
    "population": {"indicator": "SP.POP.TOTL", "measure": "Population"},
    "gdpPerCapitaPPP": {"indicator": "NY.GDP.PCAP.PP.CD", "measure": "GDP per capita, PPP (current international $)"},
}


def fetch(code):
    """Returns {iso3: (value, year)} with the most recent non-empty value per country."""
    with urllib.request.urlopen(API.format(code=code), timeout=120) as res:
        payload = json.load(res)
    if len(payload) < 2 or not payload[1]:
        raise RuntimeError(f"{code}: no data ({payload[0]})")
    return {
        row["countryiso3code"]: (row["value"], int(row["date"]))
        for row in payload[1]
        if row["value"] is not None and row["countryiso3code"]
    }


def main():
    countries = json.loads(COUNTRIES.read_text(encoding="utf-8"))["countries"]
    codes = {c for m in METRICS.values() for c in m["indicators"]} | {f["indicator"] for f in FACTS.values()}
    data = {}
    for code in sorted(codes):
        print(f"fetching {code}")
        data[code] = fetch(code)

    out_countries = {}
    for c in countries:
        iso = c["iso3"]
        metrics = {}
        for key, m in METRICS.items():
            inputs = [data[code].get(iso) for code in m["indicators"]]
            if any(i is None for i in inputs):
                continue
            raw = m["compute"](*inputs) if "compute" in m else inputs[0]
            if raw is None or raw[1] < MIN_YEAR:
                continue
            value, year = raw
            metrics[key] = {"raw": round(value, 2), "year": year, "score": m["score"](value)}
        facts = {}
        for key, f in FACTS.items():
            hit = data[f["indicator"]].get(iso)
            if hit and hit[1] >= MIN_YEAR:
                facts[key] = {"value": round(hit[0]), "year": hit[1]}
        if metrics or facts:
            out_countries[c["id"]] = {"metrics": metrics, "facts": facts}

    doc = {
        "meta": {
            "source": "World Bank, World Development Indicators",
            "sourceUrl": "https://data.worldbank.org/",
            "license": "CC BY 4.0",
            "retrieved": datetime.date.today().isoformat(),
            "minYear": MIN_YEAR,
            "note": "Most recent non-empty value per country; values older than minYear are dropped. Scores use fixed anchors, see transform.",
            "metrics": {
                key: {k: m[k] for k in ("indicators", "measure", "unit", "transform")}
                for key, m in METRICS.items()
            },
            "facts": FACTS,
        },
        "countries": out_countries,
    }
    OUTPUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    covered = sum(len(v["metrics"]) for v in out_countries.values())
    print(f"wrote {OUTPUT.relative_to(ROOT)}: {len(out_countries)} countries, {covered} of {len(countries) * len(METRICS)} metric values")
    missing = [c["name"] for c in countries if c["id"] not in out_countries]
    if missing:
        print("no World Bank data:", ", ".join(missing))


if __name__ == "__main__":
    main()
