# Country & Academic Compatibility Explorer

An interactive, high-fidelity, and modular single-page web application to check moving compatibility with countries and academic groups/universities.

The repository is structured into two separate environments:
1.  **`dev/` (Development Environment)**: Runs a zero-dependency Python server with SQLite databases (`country_compat.db` and `academic.db`) and Python compatibility calculation engines.
2.  **`docs/` (Production Environment - Static Option B)**: A 100% static, client-side serverless build. The SQLite databases are exported to structured static JSON files, and the calculations are run directly in the browser's JavaScript engine. **Perfect for free hosting on GitHub Pages, Netlify, or Vercel.**

---

## 🏗️ Folder Structure

```
├── dev/              # Development environment (Python + SQLite)
│   ├── data/         # Academic domains JSON schema
│   ├── js/           # Frontend controller scripts (making backend fetch requests)
│   ├── app.py        # Development Python server (Port 3000)
│   ├── init_db.py    # Database seeder (creates country_compat.db)
│   ├── db_sqlite.py  # SQLite Data Access Object for expat data
│   ├── engine.py     # Python matching engine for expat data
│   ├── test.py       # Expat engine test runner
│   ├── init_db_academic.py # Academic database seeder (creates academic.db)
│   ├── db_sqlite_academic.py # Academic Data Access Object
│   ├── engine_academic.py # Python matching engine for academic data
│   └── test_academic.py # Academic test runner
│
├── docs/             # Production static environment (100% Serverless / GitHub Pages target)
│   ├── data/         # Static JSON database exports
│   ├── js/           # Client-side compiled JavaScript calculators
│   ├── life.html     # Expat Compass UI
│   ├── academic.html # Academic Compass UI
│   └── style.css     # CSS Stylesheet
│
├── build_prod.py     # Build script to compile dev/ into docs/
├── app_prod.py       # Production testing server (Port 3001)
├── Makefile          # Utility tasks
├── LICENSE           # Project License
└── README.md         # This documentation
```

---

## 🚀 Getting Started

### 1. Set Up the Virtual Environment
Create and activate a Python virtual environment to isolate python dependencies:
```bash
# Create the virtual environment
python3 -m venv .venv

# Activate the virtual environment
source .venv/bin/activate
```

---

## 🛠️ Development Workflow (`dev/`)

The development environment allows you to easily edit data schemas, database contents, and algorithms in Python.

### 1. Seed Databases
If you want to re-seed or rebuild the SQLite databases, run:
```bash
cd dev
python3 init_db.py           # Seeds 120 countries and 2400 cities
python3 init_db_academic.py  # Seeds 200+ universities and 300+ research groups
```

### 2. Run the Development Server
Start the development server (runs calculations on the Python backend):
```bash
cd dev
python3 app.py
```
This runs the development site at: **[http://localhost:3000/](http://localhost:3000/)**

### 3. Run Validation Tests
Verify the database schema checks and engine calculation rules:
```bash
cd dev
python3 test.py
python3 test_academic.py
```

---

## 📦 Production Static Build (`docs/`)

To compile the Python + SQLite environment into a 100% client-side serverless build:

### 1. Run the Build Script
Run the automated builder from the root directory:
```bash
python3 build_prod.py
```
This script will:
*   Export raw data from SQLite databases to static JSON files in `docs/data/`.
*   Copy HTML and CSS files.
*   Inject the compatibility engines (`engine.py` / `engine_academic.py`) directly into the production JavaScript files (`docs/js/app.js` and `docs/js/academic_app.js`) to run calculations in the browser.

### 2. Test the Production Build Locally
Run the production test server on Port 3001:
```bash
python3 app_prod.py
```
Open **[http://localhost:3001/](http://localhost:3001/)** to verify the static build. Every slider change and quiz choice will recalculate instantly in the browser.

### 3. Deploy to the Internet
To host it on the internet via **GitHub Pages**, simply commit and push the repository to GitHub. Go to your repository settings -> Pages, and choose to build/deploy from the `/docs` folder of the `main` branch. It will host the site completely for free.
