# -*- coding: utf-8 -*-
"""
Country Compatibility Explorer - Production Build Script
Exports SQLite data to static JSON and compiles static client-side JS/HTML/CSS to prod/ folder.
"""

import os
import sys
import json
import shutil

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    dev_dir = os.path.join(root_dir, "dev")
    prod_dir = os.path.join(root_dir, "docs")
    
    # 1. Add dev_dir to sys.path so we can import from database modules
    sys.path.insert(0, dev_dir)
    
    try:
        from db_sqlite import get_locations
        from db_sqlite_academic import get_academic_entities
    except ImportError as e:
        print(f"Error importing dev database modules: {e}")
        sys.exit(1)
        
    print("📦 Exporting SQLite databases to static JSON files...")
    
    # 2. Export Life locations database
    try:
        locations = get_locations()
        dest_locations = os.path.join(prod_dir, "data", "locations.json")
        with open(dest_locations, "w", encoding="utf-8") as f:
            json.dump(locations, f, ensure_ascii=False, indent=2)
        print(f"   - Exported {len(locations)} locations to {dest_locations}")
    except Exception as e:
        print(f"Error exporting locations: {e}")
        sys.exit(1)
        
    # 3. Export Academic entities database
    try:
        academic_entities = get_academic_entities()
        dest_academic = os.path.join(prod_dir, "data", "academic_entities.json")
        with open(dest_academic, "w", encoding="utf-8") as f:
            json.dump(academic_entities, f, ensure_ascii=False, indent=2)
        print(f"   - Exported {len(academic_entities)} academic entities to {dest_academic}")
    except Exception as e:
        print(f"Error exporting academic entities: {e}")
        sys.exit(1)
        
    # 4. Copy academic_domains.json
    try:
        shutil.copy2(
            os.path.join(dev_dir, "data", "academic_domains.json"),
            os.path.join(prod_dir, "data", "academic_domains.json")
        )
        print("✅ Copied academic_domains.json")
    except Exception as e:
        print(f"Error copying academic domains: {e}")
        sys.exit(1)
        
    # 5. Copy HTML/CSS files
    try:
        shutil.copy2(os.path.join(dev_dir, "life.html"), os.path.join(prod_dir, "life.html"))
        shutil.copy2(os.path.join(dev_dir, "life.html"), os.path.join(prod_dir, "index.html"))
        shutil.copy2(os.path.join(dev_dir, "academic.html"), os.path.join(prod_dir, "academic.html"))
        shutil.copy2(os.path.join(dev_dir, "style.css"), os.path.join(prod_dir, "style.css"))
        print("✅ Copied life.html (and as index.html), academic.html, and style.css")
    except Exception as e:
        print(f"Error copying HTML/CSS: {e}")
        sys.exit(1)

    print("⚙️ Compiling serverless client-side JS files...")

    # 6. Read and compile dev/js/app.js -> docs/js/app.js
    try:
        with open(os.path.join(dev_dir, "js", "app.js"), "r", encoding="utf-8") as f:
            app_js_content = f.read()

        # Replace DOMContentLoaded block
        old_dom = """document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  updateCompatibility();
});"""
        new_dom = """let rawLocations = [];
let databaseLoaded = false;

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  fetch('data/locations.json')
    .then(res => res.json())
    .then(data => {
      rawLocations = data;
      databaseLoaded = true;
      console.log("Locations database loaded successfully.");
      updateCompatibility();
    })
    .catch(err => {
      console.error("Failed to load locations database:", err);
      const resultsCountEl = document.getElementById("results-count");
      if (resultsCountEl) resultsCountEl.textContent = "Error loading database.";
    });
});"""
        if old_dom in app_js_content:
            app_js_content = app_js_content.replace(old_dom, new_dom)
        else:
            # Fallback if whitespace differs
            print("⚠️ Warning: DOMContentLoaded signature not matched exactly in app.js. Trying generic replace.")
            app_js_content = app_js_content.replace('setupEventListeners();\n  updateCompatibility();', 'setupEventListeners();\n  // fetch logic here')

        # Replace updateCompatibility block
        old_calc = """async function updateCompatibility() {
  const preferences = getPreferences();

  try {
    const response = await fetch("/api/rank", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(preferences)
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    currentRankings = await response.json();
    visibleCount = 15;

    // Render list
    renderRankingsList();

    // Auto-select first matching location if nothing is selected or if previous selection was filtered out
    const filtered = getFilteredRankings();
    const stillExists = filtered.some(item => item.location.id === activeLocationId);
    if ((!activeLocationId || !stillExists) && filtered.length > 0) {
      activeLocationId = filtered[0].location.id;
    }
    
    if (activeLocationId) {
      renderDetails(activeLocationId);
    }
  } catch (error) {
    console.error("Failed to fetch compatibility rankings:", error);
    resultsCount.textContent = "Error calculating scores.";
  }
}"""
        new_calc = """function updateCompatibility() {
  if (!databaseLoaded) return;
  const preferences = getPreferences();

  try {
    currentRankings = rankLocations(rawLocations, preferences);
    visibleCount = 15;

    // Render list
    renderRankingsList();

    // Auto-select first matching location if nothing is selected or if previous selection was filtered out
    const filtered = getFilteredRankings();
    const stillExists = filtered.some(item => item.location.id === activeLocationId);
    if ((!activeLocationId || !stillExists) && filtered.length > 0) {
      activeLocationId = filtered[0].location.id;
    }
    
    if (activeLocationId) {
      renderDetails(activeLocationId);
    }
  } catch (error) {
    console.error("Failed to calculate compatibility rankings:", error);
    resultsCount.textContent = "Error calculating scores.";
  }
}"""
        app_js_content = app_js_content.replace(old_calc, new_calc)

        # Append Life matching engine
        engine_js = """
// ==========================================
// Client-side Matching Engine (Option B)
// ==========================================
const METRIC_TYPES = {
  "warm_weather": {"type": "preference", "label": "Warm Weather"},
  "seasonal_variety": {"type": "preference", "label": "Seasonal Variety"},
  "nature_mountains": {"type": "maximize", "label": "Mountains & Alpine hiking"},
  "nature_lakes_rivers": {"type": "maximize", "label": "Lakes & Rivers"},
  "nature_sea_beaches": {"type": "maximize", "label": "Sea & Beaches"},
  "nature_forests_greenery": {"type": "maximize", "label": "Forests & Greenery"},
  "humidity_level": {"type": "preference", "label": "Humidity Level"},
  "air_quality": {"type": "maximize", "label": "Air Quality"},
  "sunshine_hours": {"type": "maximize", "label": "Sunshine Hours"},
  "cost_of_living": {"type": "preference", "label": "Cost of Living"},
  "housing_affordability": {"type": "maximize", "label": "Housing Affordability"},
  "tax_burden": {"type": "preference", "label": "Tax Burden"},
  "visa_difficulty": {"type": "maximize", "label": "Visa & Residency Ease"},
  "childcare_education_cost": {"type": "maximize", "label": "Childcare & School Affordability"},
  "dining_food_cost": {"type": "maximize", "label": "Cheap Food & Dining Costs"},
  "pace_of_life": {"type": "preference", "label": "Pace of Life"},
  "safety": {"type": "maximize", "label": "Safety & Low Crime"},
  "healthcare_quality": {"type": "maximize", "label": "Healthcare Quality"},
  "english_barrier": {"type": "maximize", "label": "English-Friendly (No local language needed)"},
  "social_tolerance": {"type": "maximize", "label": "Social Tolerance & Progressiveness"},
  "bureaucracy_difficulty": {"type": "maximize", "label": "Bureaucracy Ease (Digital/Simple)"},
  "foreigner_friendliness": {"type": "maximize", "label": "Friendliness to Foreigners"},
  "walkability_transit": {"type": "maximize", "label": "Walkability & Public Transit"},
  "internet_speed": {"type": "maximize", "label": "Internet Speed & Connectivity"},
  "work_culture": {"type": "preference", "label": "Work Culture"},
  "road_quality": {"type": "maximize", "label": "Road & Infrastructure Quality"},
  "local_job_market": {"type": "maximize", "label": "Local Job Market Strength"},
  "phd_stipend_ppp": {"type": "maximize", "label": "PhD Stipend Value (PPP)"},
  "academic_satisfaction": {"type": "maximize", "label": "Academic & Research Satisfaction"},
  "happiness_index": {"type": "maximize", "label": "World Happiness Index"},
  "ease_of_doing_business": {"type": "maximize", "label": "Ease of Doing Business"},
  "childcare_quality": {"type": "maximize", "label": "Childcare & Schooling Quality"}
};

function calculateLocationCompatibility(location, preferences) {
  let totalWeightedScore = 0.0;
  let totalWeight = 0.0;
  const breakdown = [];

  for (const [key, config] of Object.entries(METRIC_TYPES)) {
    const pref = preferences[key] || { value: 5, importance: 0 };
    const weight = parseFloat(pref.importance || 0);

    if (weight === 0.0) {
      continue;
    }

    let locationValue = parseFloat(location.metrics[key] !== undefined ? location.metrics[key] : 5);
    
    if (key === "visa_difficulty") {
      locationValue = 10.0 - locationValue;
    } else if (key === "english_barrier") {
      locationValue = 10.0 - locationValue;
    }

    let metricScore = 0.0;
    if (config.type === "maximize") {
      metricScore = locationValue / 10.0;
    } else {
      const targetValue = parseFloat(pref.value !== undefined ? pref.value : 5);
      const distance = Math.abs(targetValue - locationValue);
      metricScore = 1.0 - (distance / 10.0);
    }

    totalWeightedScore += metricScore * weight;
    totalWeight += weight;

    breakdown.push({
      key: key,
      label: config.label,
      type: config.type,
      locationValue: locationValue,
      userTarget: config.type === "preference" ? (pref.value !== undefined ? Number(pref.value) : 5) : 10,
      importance: Number(weight),
      metricScore: Math.round(metricScore * 100)
    });
  }

  const compatibilityScore = totalWeight > 0.0 ? Math.round((totalWeightedScore / totalWeight) * 100) : 100;
  breakdown.sort((a, b) => b.metricScore - a.metricScore);

  return {
    locationId: location.id,
    score: compatibilityScore,
    breakdown: breakdown
  };
}

function rankLocations(locationsList, preferences) {
  const results = [];
  for (const loc of locationsList) {
    const compat = calculateLocationCompatibility(loc, preferences);
    results.push({
      location: loc,
      score: compat.score,
      breakdown: compat.breakdown
    });
  }
  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.location.name.localeCompare(b.location.name);
  });
  return results;
}
"""
        app_js_content += engine_js
        with open(os.path.join(prod_dir, "js", "app.js"), "w", encoding="utf-8") as f:
            f.write(app_js_content)
        print("✅ Compiled docs/js/app.js")
    except Exception as e:
        print(f"Error compiling docs/js/app.js: {e}")
        sys.exit(1)

    # 7. Read and compile dev/js/academic_app.js -> docs/js/academic_app.js
    try:
        with open(os.path.join(dev_dir, "js", "academic_app.js"), "r", encoding="utf-8") as f:
            acad_js_content = f.read()

        # Replace DOMContentLoaded block
        old_acad_dom = """document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  updateCompatibility();
});"""
        new_acad_dom = """let academicEntities = [];
let academicEntitiesLoaded = false;

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
});"""
        acad_js_content = acad_js_content.replace(old_acad_dom, new_acad_dom)

        # Replace Domains fetch with dual loader
        old_domains_fetch = """fetch('data/academic_domains.json')
  .then(res => res.json())
  .then(data => { 
    academicDomains = data; 
    academicDomainsLoaded = true;
    console.log('Academic domains loaded successfully.');
    populateDisciplineFilter();
  })
  .catch(err => console.error('Failed to load academic domains:', err));"""
        
        new_domains_fetch = """fetch('data/academic_domains.json')
  .then(res => res.json())
  .then(data => { 
    academicDomains = data; 
    academicDomainsLoaded = true;
    console.log('Academic domains loaded successfully.');
    populateDisciplineFilter();
    checkAllDataLoaded();
  })
  .catch(err => console.error('Failed to load academic domains:', err));

fetch('data/academic_entities.json')
  .then(res => res.json())
  .then(data => {
    academicEntities = data;
    academicEntitiesLoaded = true;
    console.log('Academic entities loaded successfully.');
    checkAllDataLoaded();
  })
  .catch(err => console.error('Failed to load academic entities:', err));

function checkAllDataLoaded() {
  if (academicDomainsLoaded && academicEntitiesLoaded) {
    updateCompatibility();
  }
}"""
        acad_js_content = acad_js_content.replace(old_domains_fetch, new_domains_fetch)

        # Replace updateCompatibility block
        old_acad_calc = """async function updateCompatibility() {
  const preferences = getPreferences();

  try {
    const response = await fetch("/api/rank/academic", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(preferences)
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    currentRankings = await response.json();
    visibleCount = 15;

    renderRankingsList();

    const filtered = getFilteredRankings();
    const stillExists = filtered.some(item => item.location.id === activeLocationId);
    if ((!activeLocationId || !stillExists) && filtered.length > 0) {
      activeLocationId = filtered[0].location.id;
    }
    
    if (activeLocationId) {
      renderDetails(activeLocationId);
    }
  } catch (error) {
    console.error("Failed to fetch academic rankings:", error);
    resultsCount.textContent = "Error calculating scores.";
  }
}"""
        new_acad_calc = """function updateCompatibility() {
  if (!academicEntitiesLoaded) return;
  const preferences = getPreferences();

  try {
    currentRankings = rankEntities(academicEntities, preferences);
    visibleCount = 15;

    renderRankingsList();

    const filtered = getFilteredRankings();
    const stillExists = filtered.some(item => item.location.id === activeLocationId);
    if ((!activeLocationId || !stillExists) && filtered.length > 0) {
      activeLocationId = filtered[0].location.id;
    }
    
    if (activeLocationId) {
      renderDetails(activeLocationId);
    }
  } catch (error) {
    console.error("Failed to calculate academic compatibility rankings:", error);
    resultsCount.textContent = "Error calculating scores.";
  }
}"""
        acad_js_content = acad_js_content.replace(old_acad_calc, new_acad_calc)

        # Append Academic matching engine
        engine_acad_js = """
// ==========================================
// Client-side Academic Matching Engine (Option B)
// ==========================================
const ACADEMIC_METRIC_TYPES = {
  "academic_reputation": {"type": "maximize", "label": "Academic Reputation (Shanghai Rank)"},
  "research_funding": {"type": "maximize", "label": "Research Lab Funding"},
  "undergrad_experience": {"type": "maximize", "label": "Undergrad Teaching Quality"},
  "phd_stipend_ppp": {"type": "maximize", "label": "PhD Stipend relative to PPP"},
  "research_freedom": {"type": "maximize", "label": "Research Freedom & Autonomy"},
  "work_life_balance": {"type": "maximize", "label": "Work-Life Balance (low stress)"},
  "publication_output": {"type": "maximize", "label": "Publication Output in Top Journals"},
  "industry_collaboration": {"type": "maximize", "label": "Industry Collaboration & Spin-offs"},
  "local_infrastructure": {"type": "maximize", "label": "Local Lab Infrastructure"},
  "visa_ease_academic": {"type": "maximize", "label": "Academic Visa & Travel Ease"}
};

function calculateEntityCompatibility(entity, preferences) {
  let totalWeightedScore = 0.0;
  let totalWeight = 0.0;
  const breakdown = [];

  for (const [key, config] of Object.entries(ACADEMIC_METRIC_TYPES)) {
    const pref = preferences[key] || { value: 5, importance: 0 };
    const weight = parseFloat(pref.importance || 0);

    if (weight === 0.0) {
      continue;
    }

    const locationValue = parseFloat(entity.metrics[key] !== undefined ? entity.metrics[key] : 5.0);
    const metricScore = locationValue / 10.0;

    totalWeightedScore += metricScore * weight;
    totalWeight += weight;

    breakdown.push({
      key: key,
      label: config.label,
      type: config.type,
      locationValue: locationValue,
      userTarget: 10,
      importance: Number(weight),
      metricScore: Math.round(metricScore * 100)
    });
  }

  const compatibilityScore = totalWeight > 0.0 ? Math.round((totalWeightedScore / totalWeight) * 100) : 100;
  breakdown.sort((a, b) => b.metricScore - a.metricScore);

  return {
    entityId: entity.id,
    score: compatibilityScore,
    breakdown: breakdown
  };
}

function rankEntities(entitiesList, preferences) {
  const results = [];
  for (const ent of entitiesList) {
    const compat = calculateEntityCompatibility(ent, preferences);
    results.push({
      location: ent,
      score: compat.score,
      breakdown: compat.breakdown
    });
  }
  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.location.name.localeCompare(b.location.name);
  });
  return results;
}
"""
        acad_js_content += engine_acad_js
        with open(os.path.join(prod_dir, "js", "academic_app.js"), "w", encoding="utf-8") as f:
            f.write(acad_js_content)
        print("✅ Compiled docs/js/academic_app.js")
    except Exception as e:
        print(f"Error compiling docs/js/academic_app.js: {e}")
        sys.exit(1)

    print("\n🎉 Build successful! Production files are ready in docs/ directory.")

if __name__ == "__main__":
    main()
