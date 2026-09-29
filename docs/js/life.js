/**
 * Country Compass - UI controller.
 * Reads sliders/importance pills, ranks countries with the shared engine, renders cards + details,
 * and runs the persona quiz. All data comes from data/countries.json (hand-made, subjective scores).
 */
import { rank, loadJSON, escapeHTML, matchClass, debounce, resolveCountry } from "./engine.js";

// One metric table. type: "preference" = closest to your target wins, "maximize" = higher is better.
const METRICS = {
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
const INVERTED = ["visa_difficulty", "english_barrier", "bureaucracy_difficulty"];

function getMetrics(country) {
  const m = { ...country.metrics };
  for (const key of INVERTED) if (m[key] != null) m[key] = 10 - m[key];
  return m;
}

// Advanced metrics: hidden behind a section toggle, ignored (importance 0) while it is off.
const ADVANCED_METRIC_SECTIONS = {
  humidity_level: "toggle-climate_nature",
  air_quality: "toggle-climate_nature",
  sunshine_hours: "toggle-climate_nature",
  childcare_education_cost: "toggle-cost_visas",
  dining_food_cost: "toggle-cost_visas",
  childcare_quality: "toggle-cost_visas",
  social_tolerance: "toggle-society_lifestyle",
  bureaucracy_difficulty: "toggle-society_lifestyle",
  foreigner_friendliness: "toggle-society_lifestyle",
  happiness_index: "toggle-society_lifestyle",
  road_quality: "toggle-infrastructure_work",
  local_job_market: "toggle-infrastructure_work",
  ease_of_doing_business: "toggle-infrastructure_work",
  phd_stipend_ppp: "toggle-academia_research",
  academic_satisfaction: "toggle-academia_research",
};
const ALL_TOGGLES = [...new Set(Object.values(ADVANCED_METRIC_SECTIONS))];
const PAGE_SIZE = 15;

const PERSONA_LABELS = {
  phd: "🎓 PhD Perspective",
  family: "🏡 Family Perspective",
  entrepreneur: "💼 Entrepreneur Perspective",
  nomad: "💻 Digital Nomad Perspective",
};

const PERSONA_PRESETS = {
  custom: { toggles: {}, metrics: {} },
  phd: {
    toggles: { "toggle-academia_research": true },
    metrics: {
      phd_stipend_ppp: { importance: 10 },
      academic_satisfaction: { importance: 10 },
      cost_of_living: { importance: 6, value: 4 },
      internet_speed: { importance: 6 },
    },
  },
  family: {
    toggles: { "toggle-society_lifestyle": true, "toggle-cost_visas": true },
    metrics: {
      safety: { importance: 10 },
      healthcare_quality: { importance: 10 },
      childcare_quality: { importance: 10 },
      childcare_education_cost: { importance: 10 },
      happiness_index: { importance: 6 },
      air_quality: { importance: 6 },
      cost_of_living: { importance: 6, value: 5 },
      housing_affordability: { importance: 6 },
    },
  },
  entrepreneur: {
    toggles: { "toggle-infrastructure_work": true, "toggle-society_lifestyle": true },
    metrics: {
      ease_of_doing_business: { importance: 10 },
      internet_speed: { importance: 10 },
      tax_burden: { importance: 10, value: 2 },
      bureaucracy_difficulty: { importance: 10 },
      local_job_market: { importance: 6 },
    },
  },
  nomad: {
    toggles: { "toggle-society_lifestyle": true, "toggle-cost_visas": true },
    metrics: {
      internet_speed: { importance: 10 },
      cost_of_living: { importance: 10, value: 3 },
      dining_food_cost: { importance: 10 },
      visa_difficulty: { importance: 10 },
      bureaucracy_difficulty: { importance: 6 },
      social_tolerance: { importance: 6 },
      foreigner_friendliness: { importance: 6 },
      english_barrier: { importance: 6 },
    },
  },
};

// ---------- State & DOM ----------
let allCountries = [];
let meta = {};
let rankings = [];          // [{item, score, breakdown}] for the current pool
let activeId = null;
let visibleCount = PAGE_SIZE;
let activePersona = "custom";

const $ = (id) => document.getElementById(id);
const form = $("preferences-form");
const resultsList = $("results-list");
const resultsCount = $("results-count");
const detailsPanel = $("details-panel");
const searchInput = $("search-country");
const scoreFilter = $("filter-score");
const includeTemplates = $("include-templates");

const qualityBadge = (c) => c.quality === "template"
  ? `<span class="quality-badge template">Template</span>`
  : `<span class="quality-badge">Curated</span>`;

// ---------- Form <-> preferences ----------
function setSliderValue(key, value) {
  const slider = $(`pref-${key}`);
  if (!slider) return;
  slider.value = value;
  const display = $(`val-${key}`);
  if (display) display.textContent = value;
}

function setToggle(toggleId, checked) {
  const toggle = $(toggleId);
  if (!toggle) return;
  toggle.checked = checked;
  $(toggleId.replace("toggle-", "adv-")).hidden = !checked;
}

// Set a slider target and/or importance (0/3/6/10) for one metric; opens its advanced section if needed.
function setPref(key, value, importance) {
  if (value != null) setSliderValue(key, value);
  if (importance == null) return;
  if (importance > 0 && ADVANCED_METRIC_SECTIONS[key]) setToggle(ADVANCED_METRIC_SECTIONS[key], true);
  const radio = $(`imp-${key}-${importance}`);
  if (radio) radio.checked = true;
}

function getPreferences() {
  const prefs = {};
  for (const key of Object.keys(METRICS)) {
    const toggle = ADVANCED_METRIC_SECTIONS[key] && $(ADVANCED_METRIC_SECTIONS[key]);
    const active = !toggle || toggle.checked;
    const slider = $(`pref-${key}`);
    const radio = form.querySelector(`input[name="imp-${key}"]:checked`);
    prefs[key] = {
      value: slider ? Number(slider.value) : 5,
      importance: active && radio ? Number(radio.value) : 0,
    };
  }
  return prefs;
}

function applyPreset(persona) {
  activePersona = persona;
  const preset = PERSONA_PRESETS[persona];
  for (const id of ALL_TOGGLES) setToggle(id, !!preset.toggles[id]);
  for (const key of Object.keys(METRICS)) {
    const p = preset.metrics[key] || {};
    setSliderValue(key, p.value ?? 5);
    const radio = $(`imp-${key}-${p.importance ?? (ADVANCED_METRIC_SECTIONS[key] ? 0 : 6)}`);
    if (radio) radio.checked = true;
  }
}

function setActivePersonaButton(persona) {
  document.querySelectorAll(".persona-btn").forEach(btn => {
    const active = btn.dataset.persona === persona;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
}

function markCustom() {
  activePersona = "custom";
  setActivePersonaButton("custom");
  updateCompatibility();
}

// ---------- Ranking & list ----------
function updateCompatibility() {
  const pool = allCountries.filter(c => includeTemplates.checked || c.quality === "curated");
  rankings = rank(pool, getMetrics, METRICS, getPreferences());
  visibleCount = PAGE_SIZE;
  renderRankingsList();
  const filtered = getFilteredRankings();
  if (!filtered.some(r => r.item.id === activeId) && filtered.length) activeId = filtered[0].item.id;
  renderDetails();
}

function getFilteredRankings() {
  const term = searchInput.value.toLowerCase().trim();
  const minScore = Number(scoreFilter.value) || 0;
  return rankings.filter(r => r.score >= minScore && (!term || r.item.name.toLowerCase().includes(term)));
}

function onFilterChange() {
  visibleCount = PAGE_SIZE;
  renderRankingsList();
  const filtered = getFilteredRankings();
  if (filtered.length && !filtered.some(r => r.item.id === activeId)) selectCountry(filtered[0].item.id);
}

function onActivate(el, handler) {
  el.addEventListener("click", handler);
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handler();
    }
  });
}

function renderRankingsList() {
  resultsList.innerHTML = "";
  const filtered = getFilteredRankings();
  resultsCount.textContent = `Matches: ${filtered.length} / ${rankings.length}`;

  filtered.slice(0, visibleCount).forEach(({ item: country, score }, index) => {
    const active = country.id === activeId;
    const cls = matchClass(score);
    const card = document.createElement("article");
    card.className = `country-card ${active ? "active" : ""}`;
    card.tabIndex = 0;
    card.setAttribute("aria-selected", String(active));
    card.innerHTML = `
      <div class="card-header-row">
        <div class="card-rank-name">
          <span class="card-rank">#${index + 1}</span>
          <h3 class="card-name">${escapeHTML(country.name)}</h3>
          ${qualityBadge(country)}
        </div>
        <span class="card-match-badge ${cls}">${score}%</span>
      </div>
      <p class="card-summary">${escapeHTML(country.summary)}</p>
      <div class="match-bar-bg"><div class="match-bar-fill ${cls}" style="width: ${score}%;"></div></div>
    `;
    onActivate(card, () => selectCountry(country.id));
    resultsList.appendChild(card);
  });

  if (filtered.length > visibleCount) {
    const more = document.createElement("div");
    more.className = "load-more-card";
    more.textContent = `Show More Matches (+${filtered.length - visibleCount})`;
    more.setAttribute("role", "button");
    more.tabIndex = 0;
    onActivate(more, () => {
      visibleCount += PAGE_SIZE;
      renderRankingsList();
    });
    resultsList.appendChild(more);
  }
}

function selectCountry(id) {
  activeId = id;
  renderRankingsList();
  renderDetails();
  detailsPanel.scrollTop = 0;
}

// ---------- Details ----------
function listHTML(items) {
  return (items || []).map(t => `<div class="pro-con-item">${escapeHTML(t)}</div>`).join("");
}

function dataNoteHTML(c) {
  if (c.quality === "template") {
    return `<div class="data-note"><strong>Template data.</strong> The scores and text on this page come from the generic
      "${escapeHTML(c.templateLabel)}" template. They are identical for every country using that template and were not
      researched for ${escapeHTML(c.name)}. They may not reflect current events (conflict, travel advisories, sanctions).</div>`;
  }
  return `<div class="data-note">Scores are subjective hand-written estimates (~2025). Visa details may be outdated; check official sources.</div>`;
}

function renderDetails() {
  const entry = rankings.find(r => r.item.id === activeId);
  if (!entry) return;
  const { item: c, score, breakdown } = entry;
  const isTemplate = c.quality === "template";
  const persona = activePersona !== "custom" && c.personas?.[activePersona];
  const { summary, overview, pros, cons } = persona || c;
  const tag = isTemplate ? ` <span class="quality-badge template">Generic template text</span>` : "";
  const cls = matchClass(score);

  const breakdownHTML = breakdown.map(b => {
    const bc = matchClass(b.metricScore);
    const rating = b.type === "preference" ? `Target: ${b.target} | Rating: ${b.value}` : `Rating: ${b.value}/10`;
    return `
      <div class="breakdown-card">
        <span class="breakdown-card-label">${escapeHTML(b.label)}</span>
        <div class="breakdown-card-score-row">
          <span class="breakdown-card-score ${bc}">${b.metricScore}%</span>
          <span class="breakdown-card-percent">match</span>
        </div>
        <div class="breakdown-bar-bg"><div class="breakdown-bar-fill ${bc}" style="width: ${b.metricScore}%;"></div></div>
        <div class="breakdown-details"><span>${rating}</span><span>Imp: ${b.importance}</span></div>
      </div>`;
  }).join("");

  const facts = [["Capital City", c.facts?.capital], ["Official Language(s)", c.facts?.languages], ["Currency", c.facts?.currency]]
    .filter(([, v]) => v)
    .map(([label, v]) => `
      <div class="demographic-card">
        <span class="demographic-label">${label}</span>
        <span class="demographic-value">${escapeHTML(v)}</span>
      </div>`).join("");
  const citiesLine = c.cities?.length
    ? `<p class="overview-text"><strong>Major cities:</strong> ${c.cities.map(escapeHTML).join(", ")}</p>` : "";

  const icon = (d) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

  detailsPanel.innerHTML = `
    <header class="details-header">
      <div class="details-title">
        <h2>${escapeHTML(c.name)} ${qualityBadge(c)}</h2>
        ${persona ? `<span class="perspective-badge">${PERSONA_LABELS[activePersona]}</span>` : ""}
        <p class="subtitle">${escapeHTML(summary)}</p>
      </div>
      <div class="details-score-box">
        <span class="details-percentage ${cls}">${score}%</span>
        <span class="details-score-label">Compatibility Match</span>
      </div>
    </header>

    ${dataNoteHTML(c)}

    <section class="detail-section" aria-labelledby="detail-title-overview">
      <h3 class="detail-section-title" id="detail-title-overview">Overview${tag}</h3>
      <p class="overview-text">${escapeHTML(overview)}</p>
    </section>

    <section class="detail-section" aria-labelledby="detail-title-facts">
      <h3 class="detail-section-title" id="detail-title-facts">Quick Facts</h3>
      <div class="demographics-grid">${facts}</div>
      ${citiesLine}
      <p class="card-summary">${escapeHTML(meta.facts)}</p>
    </section>

    <section class="detail-section" aria-labelledby="detail-title-proscons">
      <h3 class="detail-section-title" id="detail-title-proscons">Key Tradeoffs${tag}</h3>
      <div class="pros-cons-grid">
        <div class="pros-list">
          <h4 class="pro-con-header pro">${icon('<polyline points="20 6 9 17 4 12"></polyline>')} Pros</h4>
          ${listHTML(pros)}
        </div>
        <div class="cons-list">
          <h4 class="pro-con-header con">${icon('<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>')} Cons</h4>
          ${listHTML(cons)}
        </div>
      </div>
    </section>

    <section class="detail-section" aria-labelledby="detail-title-visa">
      <h3 class="detail-section-title" id="detail-title-visa">Residency &amp; Visas${tag}</h3>
      <div class="visa-box"><p>${escapeHTML(c.visaInfo)}</p></div>
    </section>

    <section class="detail-section" aria-labelledby="detail-title-breakdown">
      <h3 class="detail-section-title" id="detail-title-breakdown">Metric-by-Metric Compatibility</h3>
      <div class="breakdown-grid">${breakdownHTML}</div>
    </section>
  `;
}

// ---------- Quiz ----------
const quizModal = $("quiz-modal");
const quizForm = $("quiz-form");
const quizProgress = $("quiz-progress");
const quizPrevBtn = $("quiz-prev-btn");
const quizNextBtn = $("quiz-next-btn");
const TOTAL_QUIZ_SLIDES = 6;
let currentQuizSlide = 1;

const priorities = [
  { key: "cost_tax", label: "💰 Cost & Tax", desc: "Cost of living, housing costs, taxes" },
  { key: "climate_nature", label: "☀️ Climate & Nature", desc: "Temperatures, mountains, beaches, forests" },
  { key: "safety_health", label: "🛡️ Safety & Health", desc: "Crime rate, air quality, healthcare" },
  { key: "work_business", label: "💻 Work & Tech", desc: "Internet speed, local job market, business ease" },
  { key: "culture_lifestyle", label: "🗣️ Culture & Lifestyle", desc: "Pace of life, friendliness, English level" },
];

const PRIORITY_METRICS = {
  cost_tax: ["cost_of_living", "housing_affordability", "tax_burden", "childcare_education_cost", "dining_food_cost"],
  climate_nature: ["warm_weather", "seasonal_variety", "nature_mountains", "nature_lakes_rivers", "nature_sea_beaches", "nature_forests_greenery", "humidity_level", "air_quality", "sunshine_hours"],
  safety_health: ["safety", "healthcare_quality", "air_quality", "happiness_index"],
  work_business: ["internet_speed", "local_job_market", "ease_of_doing_business", "road_quality"],
  culture_lifestyle: ["pace_of_life", "english_barrier", "social_tolerance", "bureaucracy_difficulty", "foreigner_friendliness"],
};

// option = [value, icon, title, description]
function optionCards(name, options, { compact = false, checkFirst = true } = {}) {
  return options.map(([value, icon, title, desc], i) => `
    <label class="quiz-option-card${compact ? " quiz-option-compact" : ""}">
      <input type="radio" name="${name}" value="${escapeHTML(value)}"${checkFirst && i === 0 ? " checked" : ""}>
      <div class="option-content">
        <span class="option-icon">${icon}</span>
        <div class="option-details"><strong>${escapeHTML(title)}</strong>${desc ? `<span>${escapeHTML(desc)}</span>` : ""}</div>
      </div>
    </label>`).join("");
}

const quizQuestion = (text, style = "") => `<h3 class="quiz-question"${style ? ` style="${style}"` : ""}>${escapeHTML(text)}</h3>`;

const QUIZ_GOALS = [
  ["nomad", "💻", "Digital Nomad / Remote Worker", "I want affordable living, good internet, warm sun, and simple digital nomad visas."],
  ["family", "🏡", "Family Relocation", "I prioritize safety, healthcare, good schools, and stable long-term residency."],
  ["entrepreneur", "💼", "Entrepreneur / Business Owner", "I focus on startup ecosystems, ease of doing business, and tax burdens."],
  ["phd", "🎓", "PhD Scholar / Researcher", "I'm looking for academic stipends, research freedom, and university connections."],
];
const QUIZ_LANG = [
  ["english_barrier", "🇬🇧", "English-Friendly Only", "I want to live where English is extremely widely spoken; language barriers should be minimal."],
  ["willing_basic", "🗣️", "Willing to Learn the Basics", "I can study the local language for daily transactions and polite interaction."],
  ["immersion", "📚", "Full Integration", "I want to learn the local language fluently and fully immerse myself in the local culture."],
];
const QUIZ_VISA = [
  ["nomad", "✈️", "Simple Digital Nomad Visas", "Fast online visa entry paths for remote workers without local corporate entities."],
  ["corporate", "💼", "Employment Sponsorship", "Residency tied to a local company employment visa."],
  ["entrepreneur", "💻", "Business Setup / Investment", "Residency earned by opening a local corporate company or investment."],
  ["family", "🏠", "Long-term Family Resettlement", "Stable pathways leading to permanent residency and future citizenship."],
];
const QUIZ_COST_HIGH = [
  ["reduce_cost", "📉", "Drastically Reduce Costs", "I want a much lower cost of living to boost my savings and purchasing power."],
  ["infra_priority", "🏥", "Quality Over Savings", "I'm willing to pay for top-tier infrastructure, safety, and public services regardless of cost."],
  ["tax_opt", "📊", "Minimize Taxes Above All", "My priority is a low tax burden and business-friendly regulations."],
];
const QUIZ_COST_LOW = [
  ["keep_ultra_low", "🪙", "Keep Costs Ultra-Low", "I want to live in the most budget-friendly countries possible."],
  ["job_potential", "📈", "Earning & Career Potential", "I'm moving to access high-wage job markets and better corporate environments."],
  ["balanced_life", "⚖️", "Balanced Infrastructure", "A moderate cost of living but with strong public healthcare, transit, and services."],
];
const QUIZ_CLIMATE_WARM = [
  ["keep_warm", "☀️", "Keep it Warm / Sunny", "I love warm climates and want to remain in a sunny, tropical or coastal setting."],
  ["escape_heat", "❄️", "Escape the Heat / Seasonal variety", "I prefer distinct seasonal changes, cooler weather, or mountain snow."],
];
const QUIZ_CLIMATE_COOL = [
  ["escape_cold", "☀️", "Escape the Cold / Year-round Warmth", "I want to move to a hot, sunny country with high sunshine hours and beaches."],
  ["keep_cool", "⛰️", "Enjoy Four Seasons / Mountain topographies", "I enjoy mild weather, seasonal changes, or colder mountain/forest climates."],
];

function buildQuizSlides() {
  const names = [...new Set(allCountries.map(c => c.name))].sort();
  const slide = (n, inner) => `<div class="quiz-slide" id="quiz-slide-${n}"${n > 1 ? " hidden" : ""}>${inner}</div>`;
  $("quiz-slide-container").innerHTML = [
    slide(1, `${quizQuestion("What is your primary objective or persona for moving abroad?")}
      <div class="quiz-options">${optionCards("q-goal", QUIZ_GOALS)}</div>`),
    slide(2, `${quizQuestion("Where do you live currently?")}
      <div class="quiz-disc-search-wrap">
        <input type="text" id="quiz-country-search" class="quiz-disc-search" placeholder="Search current country..." aria-label="Search countries">
      </div>
      <div class="quiz-options quiz-options-scrollable" id="quiz-country-options">
        ${optionCards("q-current-country", names.map(n => [n, "📍", n]), { compact: true })}
      </div>`),
    slide(3, `${quizQuestion("Rank the five pillars in order of importance to you (use ▲/▼ to sort):")}
      <div class="quiz-options" id="quiz-priorities-list" style="gap: 6px;"></div>`),
    slide(4, ""), // filled on entry by populateAdaptiveSlide4()
    slide(5, `${quizQuestion("What are your local language expectations?")}
      <div class="quiz-options">${optionCards("q-lang-pref", QUIZ_LANG)}</div>`),
    slide(6, `${quizQuestion("How do you prefer to handle visas and paperwork?")}
      <div class="quiz-options">${optionCards("q-visa-pref", QUIZ_VISA)}</div>`),
  ].join("");

  $("quiz-country-search").addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    document.querySelectorAll("#quiz-country-options .quiz-option-card").forEach(card => {
      card.style.display = card.textContent.toLowerCase().includes(query) ? "" : "none";
    });
  });
}

function renderPrioritiesList() {
  const list = $("quiz-priorities-list");
  list.innerHTML = "";
  const swap = (a, b) => {
    [priorities[a], priorities[b]] = [priorities[b], priorities[a]];
    renderPrioritiesList();
  };
  priorities.forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "option-content";
    card.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;background:var(--bg);";
    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-weight: bold; color: var(--primary); font-size: 14px;">#${idx + 1}</span>
        <div style="display: flex; flex-direction: column;">
          <strong style="font-size: 13px; color: var(--text);">${item.label}</strong>
          <span style="font-size: 10px; color: var(--text-muted);">${item.desc}</span>
        </div>
      </div>
      <div style="display: flex; gap: 4px;">
        <button type="button" class="btn secondary btn-swap-up" style="padding: 4px 8px; font-size: 11px;" ${idx === 0 ? "disabled" : ""}>▲</button>
        <button type="button" class="btn secondary btn-swap-down" style="padding: 4px 8px; font-size: 11px;" ${idx === priorities.length - 1 ? "disabled" : ""}>▼</button>
      </div>`;
    card.querySelector(".btn-swap-up").addEventListener("click", () => swap(idx, idx - 1));
    card.querySelector(".btn-swap-down").addEventListener("click", () => swap(idx, idx + 1));
    list.appendChild(card);
  });
}

function populateAdaptiveSlide4() {
  const checked = quizForm.querySelector('input[name="q-current-country"]:checked');
  const name = checked ? checked.value : "your country";
  const country = allCountries.find(c => c.name === name);
  const cost = country?.metrics?.cost_of_living ?? 5;
  const warm = country?.metrics?.warm_weather ?? 5;

  $("quiz-slide-4").innerHTML = `
    ${quizQuestion(cost >= 7
      ? `You currently live in ${name}, which is rated as relatively expensive here. What is your priority for your next destination?`
      : `You live in ${name}, which is rated as relatively affordable here. What is your primary objective regarding finances?`)}
    <div class="quiz-options">${optionCards("q-adaptive-financial", cost >= 7 ? QUIZ_COST_HIGH : QUIZ_COST_LOW)}</div>
    ${quizQuestion(warm >= 7
      ? `${name} is rated as a warm climate. What weather profile are you looking for next?`
      : `${name} is rated as a cool or seasonal climate. What weather profile do you prefer next?`, "margin-top: 20px;")}
    <div class="quiz-options">${optionCards("q-adaptive-climate", warm >= 7 ? QUIZ_CLIMATE_WARM : QUIZ_CLIMATE_COOL)}</div>`;
}

function showQuizSlide(n) {
  if (n === 3) renderPrioritiesList();
  if (n === 4) populateAdaptiveSlide4();
  document.querySelectorAll(".quiz-slide").forEach(s => { s.hidden = s.id !== `quiz-slide-${n}`; });
  quizProgress.style.width = `${(n / TOTAL_QUIZ_SLIDES) * 100}%`;
  quizPrevBtn.disabled = n === 1;
  quizNextBtn.textContent = n === TOTAL_QUIZ_SLIDES ? "Finish" : "Next";
}

// Each answer nudges [metric, sliderValue|null, importance|null] entries on top of the base persona preset.
const QUIZ_ADJUSTMENTS = {
  reduce_cost: [["cost_of_living", 2, 10], ["housing_affordability", null, 10]],
  infra_priority: [["cost_of_living", null, 0], ["healthcare_quality", null, 10]],
  tax_opt: [["tax_burden", 2, 10]],
  keep_ultra_low: [["cost_of_living", 1, 10]],
  job_potential: [["local_job_market", null, 10]],
  balanced_life: [["cost_of_living", 5, 6], ["healthcare_quality", null, 10]],
  keep_warm: [["warm_weather", 9, 10]],
  escape_cold: [["warm_weather", 9, 10]],
  escape_heat: [["warm_weather", 2, 10], ["seasonal_variety", null, 10]],
  keep_cool: [["warm_weather", 2, 10], ["seasonal_variety", null, 10]],
  english_barrier: [["english_barrier", null, 10]],
  willing_basic: [["english_barrier", null, 3]],
  immersion: [["english_barrier", null, 0]],
  nomad: [["visa_difficulty", null, 10], ["internet_speed", null, 10]],
  corporate: [["visa_difficulty", null, 6], ["local_job_market", null, 10]],
  entrepreneur: [["ease_of_doing_business", null, 10], ["tax_burden", null, 6]],
  family: [["childcare_quality", null, 10], ["safety", null, 10]],
};

function finishQuiz() {
  const answers = new FormData(quizForm);
  applyPreset(answers.get("q-goal") || "nomad");

  // Priority order: rank 1-2 high, 3 medium, 4 low, 5 off.
  const rankImportance = [10, 10, 6, 3, 0];
  priorities.forEach((p, i) => {
    for (const key of PRIORITY_METRICS[p.key]) setPref(key, null, rankImportance[i]);
  });

  for (const name of ["q-adaptive-financial", "q-adaptive-climate", "q-lang-pref", "q-visa-pref"]) {
    for (const [key, value, importance] of QUIZ_ADJUSTMENTS[answers.get(name)] || []) setPref(key, value, importance);
  }

  setActivePersonaButton(activePersona);
  updateCompatibility();
  quizModal.hidden = true;
}

// ---------- Event wiring ----------
function setupEventListeners() {
  const onPrefChange = debounce(markCustom, 180);

  form.querySelectorAll("input[type='range']").forEach(slider => {
    const display = $(`val-${slider.id.replace("pref-", "")}`);
    slider.addEventListener("input", () => {
      if (display) display.textContent = slider.value;
      onPrefChange();
    });
  });
  form.querySelectorAll("input[type='radio']").forEach(r => r.addEventListener("change", onPrefChange));
  form.querySelectorAll(".advanced-toggle").forEach(toggle => {
    toggle.addEventListener("change", () => {
      $(toggle.id.replace("toggle-", "adv-")).hidden = !toggle.checked;
      onPrefChange();
    });
  });
  form.querySelectorAll(".info-btn").forEach(btn => {
    const box = $(`info-${btn.dataset.info}`);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      box.hidden = !box.hidden;
      btn.classList.toggle("active", !box.hidden);
    });
  });

  searchInput.addEventListener("input", onFilterChange);
  scoreFilter.addEventListener("change", onFilterChange);
  includeTemplates.addEventListener("change", updateCompatibility);

  document.querySelectorAll(".persona-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      setActivePersonaButton(btn.dataset.persona);
      applyPreset(btn.dataset.persona);
      updateCompatibility();
    });
  });

  $("open-quiz-btn").addEventListener("click", () => {
    buildQuizSlides();
    currentQuizSlide = 1;
    showQuizSlide(1);
    quizModal.hidden = false;
  });
  $("close-quiz-btn").addEventListener("click", () => { quizModal.hidden = true; });
  quizModal.addEventListener("click", (e) => { if (e.target === quizModal) quizModal.hidden = true; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") quizModal.hidden = true; });
  quizPrevBtn.addEventListener("click", () => {
    if (currentQuizSlide > 1) showQuizSlide(--currentQuizSlide);
  });
  quizNextBtn.addEventListener("click", () => {
    if (currentQuizSlide < TOTAL_QUIZ_SLIDES) showQuizSlide(++currentQuizSlide);
    else finishQuiz();
  });
}

setupEventListeners();
loadJSON("data/countries.json")
  .then(data => {
    meta = data.meta;
    allCountries = data.countries.map(c => resolveCountry(c, data.templates));
    updateCompatibility();
  })
  .catch(err => {
    console.error("Failed to load countries.json:", err);
    resultsCount.textContent = "Error loading data.";
  });
