/*
 * Country metric definitions shared by the country page, map and data table.
 * type: "preference" = closest to your target wins, "maximize" = higher is better.
 */
export const METRICS = {
  warm_weather: { label: "Warm Weather", type: "preference" },
  seasonal_variety: { label: "Seasonal Variety", type: "preference" },
  nature_mountains: { label: "Mountains & Alpine hiking", type: "maximize" },
  nature_lakes_rivers: { label: "Lakes & Rivers", type: "maximize" },
  nature_sea_beaches: { label: "Sea & Beaches", type: "maximize" },
  nature_forests_greenery: { label: "Forests & Greenery", type: "maximize" },
  humidity_level: { label: "Humidity Level", type: "preference" },
  air_quality: { label: "Air Quality", type: "maximize" },
  sunshine_hours: { label: "Sunshine Hours", type: "maximize" },
  cost_of_living: { label: "Cost of Living", type: "preference" },
  housing_affordability: { label: "Housing Affordability", type: "maximize" },
  tax_burden: { label: "Tax Burden", type: "preference" },
  visa_difficulty: { label: "Visa & Residency Ease", type: "maximize" },
  childcare_education_cost: { label: "Childcare & School Affordability", type: "maximize" },
  dining_food_cost: { label: "Cheap Food & Dining Costs", type: "maximize" },
  pace_of_life: { label: "Pace of Life", type: "preference" },
  safety: { label: "Safety & Low Crime", type: "maximize" },
  healthcare_quality: { label: "Healthcare Quality", type: "maximize" },
  english_barrier: { label: "English-Friendly (No local language needed)", type: "maximize" },
  social_tolerance: { label: "Social Tolerance & Progressiveness", type: "maximize" },
  bureaucracy_difficulty: { label: "Bureaucracy Ease (Digital/Simple)", type: "maximize" },
  foreigner_friendliness: { label: "Friendliness to Foreigners", type: "maximize" },
  walkability_transit: { label: "Walkability & Public Transit", type: "maximize" },
  internet_speed: { label: "Internet Speed & Connectivity", type: "maximize" },
  work_culture: { label: "Work Culture", type: "preference" },
  road_quality: { label: "Road & Infrastructure Quality", type: "maximize" },
  local_job_market: { label: "Local Job Market Strength", type: "maximize" },
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
