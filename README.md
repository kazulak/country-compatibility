# Country Compatibility Explorer (Python Backend Edition)

An interactive, high-fidelity, and modular single-page web application to check your compatibility with a country for moving. The tool evaluates 70 of the most popular expat and digital nomad destinations across 26 granular, high-quality metrics.

All business logic, database queries, and compatibility calculations are written in **Python**. The frontend uses a minimal, easy-to-read Javascript layer solely to fetch calculations from Python and render the user interface.

## ✨ New Features
1. **Interactive Tooltips**: Click the `(i)` icon next to any metric to instantly display a callout box explaining the scoring scope and criteria.
2. **Advanced Section Toggles**: Each section features a toggle switch. When turned **off**, advanced metrics are hidden and ignored by the engine (their weight defaults to 0). Turning it **on** enables micro-customization for precise alignment.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.8 or higher. No external libraries (like Flask or FastAPI) are required — it runs purely on Python's built-in libraries.

### 1. Set Up the Virtual Environment
Create and activate a Python virtual environment to isolate dependencies:
```bash
# Create the virtual environment
python3 -m venv .venv

# Activate the virtual environment
source .venv/bin/activate
```

### 2. Initialize the Database
Build and seed the SQLite database file `country_compat.db` with 70 countries and 26 metrics:
```bash
# Make sure virtualenv is active, then seed:
python3 init_db.py
```

### 3. Launch the Server
Start the Python web server in the virtual environment:
```bash
# Start the server
python3 app.py
```
Or run directly without active activation:
```bash
.venv/bin/python3 app.py
```

This will spin up the server at: **[http://localhost:3000/](http://localhost:3000/)**

### 4. Run Validation Tests
To run schema checks on the database and verify the accuracy of the matching engine:
```bash
python3 test.py
```
Or:
```bash
.venv/bin/python3 test.py
```

---

## 🏗️ Code Architecture

```
├── .venv/           # Python isolated virtual environment
├── index.html       # Minimalist semantic markup and sidebar controls
├── style.css        # Premium, Swiss-style dark mode styling
├── app.py           # Zero-dependency Python server (serves static files & handles POST /api/rank)
├── init_db.py       # SQL Schema creator and database seeder (for 70 countries)
├── db_sqlite.py     # SQLite data access layer querying country_compat.db
├── country_compat.db# Generated SQLite database file
├── engine.py        # Python matching algorithm & calculations formulas
├── test.py          # Database and compatibility engine validation test runner
└── js/
    └── app.js       # Minimalist client controller (gathers inputs, fetches /api/rank, renders DOM)
```

- **[db_sqlite.py](file:///home/tom/repos/country-compatibility/db_sqlite.py)**: SQLite interface query module. Rebuilds location dictionary trees dynamically on requests.
- **[engine.py](file:///home/tom/repos/country-compatibility/engine.py)**: Evaluates user preferences. Separates metrics into **Maximize** metrics (e.g. safety, healthcare) and **Match-Preference** metrics (e.g. temperature, cost of living), computing weighted compatibility averages.
- **[js/app.js](file:///home/tom/repos/country-compatibility/js/app.js)**: Reads sliders, turns off advanced weights when section toggles are off, posts to `/api/rank`, and renders rankings.

---

## 📐 Compatibility Engine Algorithm

For a set of user preferences with weights $w_m$ and preferred targets $t_m$:

- **Maximize Metrics**: The compatibility score $s_{l, m}$ evaluates to:
  $$s_{l, m} = \frac{C_{l, m}}{10}$$
- **Preference Metrics**: The compatibility score $s_{l, m}$ evaluates to:
  $$s_{l, m} = 1 - \frac{|t_m - C_{l, m}|}{10}$$
- **Overall Compatibility Score**:
  $$S_l = \left( \frac{\sum_{m} w_m \cdot s_{l, m}}{\sum_{m} w_m} \right) \times 100\%$$
