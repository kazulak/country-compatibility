# Country & University Compass

A small, just-for-fun static website: move a few sliders and it ranks countries (and a list of well-known universities) by how well they match your preferences.

**Live site:** https://kazulak.github.io/country-compatibility/

> **This is a toy, not a research tool.** The scores are subjective guesses written by hand, not measured data. Please read the [Limitations](#limitations) before taking anything here seriously.

## Pages

- **Country Compass** (`docs/index.html`): ranks countries on 32 lifestyle metrics (climate, cost, safety, visas, work culture…), with persona presets and a short quiz.
- **University Compass** (`docs/academic.html`): ranks 94 real universities using their approximate Shanghai (ARWU) rank plus the host country's scores.

## Limitations

**Country data**
- All scores are **subjective 0–10 estimates** made by hand for this project, not statistics from any official source. Labels such as "Happiness" or "Safety" do not correspond to any official index.
- Only **20 countries are "curated"**: their scores and text were written individually, around 2025. Visa and cost details may be out of date.
- The other **100 countries are "template" countries.** Each one copies the scores and text of a generic regional template (e.g. "Mediterranean", "Gulf / Desert"). All countries sharing a template get *identical* scores, and the templates fit some countries badly. They were not researched individually and do not reflect current events such as conflicts, travel advisories or sanctions. They are hidden by default and marked "Template" in the UI.
- Capitals, currencies and languages are real reference facts. City lists are just a few major cities. There are no city-level scores.

**University data**
- Only real universities are listed. There are **no research groups, departments or subject rankings**. An earlier version generated fictional research groups and universities; they have been removed.
- ARWU ranks are **approximate**, recalled from roughly the 2023 edition and not re-verified. Positions beyond 100 are shown as bands. Check [shanghairanking.com](https://www.shanghairanking.com/) for real figures.
- Every other university metric (stipend, visa ease, work-life balance, affordability, English, safety) is **copied from the host country's estimate**. Nothing describes the university itself. Hong Kong universities only use the rank, because there is no Hong Kong country entry.

**In general**
- The scoring model is a simple weighted average (see `docs/js/engine.js`). It isn't validated against anything.
- Use this for inspiration and fun. For real decisions, use official government visa portals, travel advisories and the institutions themselves.

## Project structure

```
docs/                    # the whole site (served by GitHub Pages from /docs)
├── index.html           # Country Compass
├── academic.html        # University Compass
├── style.css
├── js/
│   ├── engine.js        # shared scoring + helpers
│   ├── life.js          # country page
│   └── academic.js      # university page
└── data/
    ├── countries.json   # source of truth: 20 curated countries, 100 template countries, templates
    └── universities.json
tests/test_data.py       # data integrity checks
```

There is no build step and there are no dependencies. The JSON files *are* the data, so edit them directly.

## Running locally

The pages load JSON with `fetch`, so serve the folder over HTTP rather than opening the file directly:

```bash
python -m http.server 8000 -d docs
# open http://localhost:8000/
```

Run the data checks (Python 3.8+, standard library only):

```bash
python -m unittest discover tests
```

## Editing data

- **Improve a template country:** in `countries.json`, change its `"quality"` to `"curated"`, remove `"template"`, and add its own `summary`, `overview`, `visaInfo`, `pros`, `cons` and all 32 `metrics`. The tests check that nothing is missing.
- **Metric direction:** most metrics are "higher is better". `visa_difficulty`, `english_barrier` and `bureaucracy_difficulty` store *difficulty* (higher is worse). The page inverts them for display. `cost_of_living`, `tax_burden`, `work_culture`, `pace_of_life`, `warm_weather`, `seasonal_variety` and `humidity_level` are compared against your slider target rather than maximised.

## License

MIT, see [LICENSE](LICENSE).
