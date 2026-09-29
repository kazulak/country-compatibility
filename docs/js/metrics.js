/*
 * Country metric definitions and data loading shared by the country page, map, data table
 * and university page.
 * type: "preference" = closest to your target wins, "maximize" = higher is better.
 */
import { loadJSON, resolveCountry } from "./engine.js";

export const METRICS = {
  warm_weather: { label: "Warm Weather", type: "preference" },
  seasonal_variety: { label: "Seasonal Variety", type: "preference" },
  nature_mountains: { label: "Mountains & Alpine hiking", type: "maximize" },
  nature_lakes_rivers: { label: "Lakes & Rivers", type: "maximize" },
  nature_sea_beaches: { label: "Sea & Beaches", type: "maximize" },
  nature_forests_greenery: { label: "Forest Cover", type: "maximize" },
  humidity_level: { label: "Humidity Level", type: "preference" },
  air_quality: { label: "Air Quality (PM2.5)", type: "maximize" },
  sunshine_hours: { label: "Sunshine Hours", type: "maximize" },
  cost_of_living: { label: "Cost of Living (price level)", type: "preference" },
  housing_affordability: { label: "Housing Affordability", type: "maximize" },
  tax_burden: { label: "Tax Burden", type: "preference" },
  visa_difficulty: { label: "Visa & Residency Ease", type: "maximize" },
  childcare_education_cost: { label: "Childcare & School Affordability", type: "maximize" },
  dining_food_cost: { label: "Cheap Food & Dining Costs", type: "maximize" },
  pace_of_life: { label: "Pace of Life", type: "preference" },
  safety: { label: "Safety (low homicide rate)", type: "maximize" },
  healthcare_quality: { label: "Health (life expectancy)", type: "maximize" },
  english_barrier: { label: "English-Friendly (No local language needed)", type: "maximize" },
  social_tolerance: { label: "Social Tolerance & Progressiveness", type: "maximize" },
  bureaucracy_difficulty: { label: "Bureaucracy Ease (Digital/Simple)", type: "maximize" },
  foreigner_friendliness: { label: "Friendliness to Foreigners", type: "maximize" },
  walkability_transit: { label: "Walkability & Public Transit", type: "maximize" },
  internet_speed: { label: "Internet Access", type: "maximize" },
  work_culture: { label: "Work Culture", type: "preference" },
  road_quality: { label: "Road & Infrastructure Quality", type: "maximize" },
  local_job_market: { label: "Income Level (GDP per capita)", type: "maximize" },
  phd_stipend_ppp: { label: "PhD Stipend Value (PPP)", type: "maximize" },
  academic_satisfaction: { label: "Academic & Research Satisfaction", type: "maximize" },
  happiness_index: { label: "Happiness (subjective estimate)", type: "maximize" },
  ease_of_doing_business: { label: "Ease of Doing Business (estimate)", type: "maximize" },
  childcare_quality: { label: "Childcare & Schooling Quality", type: "maximize" },
};

// The data stores these as DIFFICULTY (high = worse) but the UI labels/maximizes them as EASE.
export const INVERTED = ["visa_difficulty", "english_barrier", "bureaucracy_difficulty"];

export function countryMetrics(country) {
  const m = { ...country.metrics };
  for (const key of INVERTED) if (m[key] != null) m[key] = 10 - m[key];
  return m;
}

// Loads countries.json and overlays the real World Bank scores from worldbank.json.
// Every country gets `sources[key]`:
//   { kind: "worldbank", year, raw, estimate } for real data (estimate = the old hand/template value), or
//   { kind: "estimate" | "template" } for hand-made numbers.
// If worldbank.json fails to load, the site still works on estimates alone.
export async function loadCountryData() {
  const [data, wb] = await Promise.all([
    loadJSON("data/countries.json"),
    loadJSON("data/worldbank.json").catch(err => {
      console.warn("World Bank data unavailable, using estimates only:", err);
      return null;
    }),
  ]);
  const countries = data.countries.map(raw => withWorldBank(resolveCountry(raw, data.templates), wb));
  return { meta: data.meta, templates: data.templates, worldBank: wb ? wb.meta : null, countries };
}

function withWorldBank(country, wb) {
  const real = wb?.countries[country.id];
  const kind = country.quality === "template" ? "template" : "estimate";
  const metrics = { ...country.metrics };
  const sources = Object.fromEntries(Object.keys(metrics).map(key => [key, { kind }]));
  for (const [key, v] of Object.entries(real?.metrics || {})) {
    sources[key] = { kind: "worldbank", year: v.year, raw: v.raw, estimate: metrics[key] };
    metrics[key] = v.score;
  }
  return { ...country, metrics, sources, worldBankFacts: real?.facts || {} };
}

// Short provenance text for one metric of one country, e.g. "World Bank 2023: 0.72 per 100k".
export function describeSource(country, key, worldBankMeta) {
  const src = country.sources?.[key];
  if (!src) return "No data";
  if (src.kind === "worldbank") {
    const unit = worldBankMeta?.metrics[key]?.unit || "";
    return `World Bank ${src.year}: ${formatNumber(src.raw)} ${unit}`.trim();
  }
  return src.kind === "template" ? `Template estimate ("${country.templateLabel}")` : "Hand-made estimate (~2025)";
}

export function formatNumber(n) {
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString("en-US");
  return String(Math.round(n * 100) / 100);
}
