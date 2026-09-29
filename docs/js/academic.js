import {
  rank, loadJSON, escapeHTML, matchClass, scoreText, debounce,
  readHashState, writeHashState, setupCopyLink, reloadOnExternalHashChange,
} from "./engine.js";
import { loadCountryData } from "./metrics.js";

const PAGE_SIZE = 20;
const IMPORTANCE_LEVELS = [["0", "Off"], ["3", "Low"], ["6", "Med"], ["10", "High"]];

const METRICS = {
  ranking:       { label: "Overall research ranking", type: "maximize", info: "Derived from the approximate ARWU rank: rank 1 scores 10, rank 500 scores about 4." },
  stipend:       { label: "PhD stipend (PPP)",        type: "maximize", info: "Rough estimate of doctoral stipends relative to local purchasing power, for the country." },
  visa_ease:     { label: "Visa ease",                type: "maximize", info: "10 minus the country's estimated visa difficulty." },
  work_life:     { label: "Work-life balance",        type: "maximize", info: "10 minus the country's estimated work-culture intensity." },
  affordability: { label: "Affordability",            type: "maximize", info: "10 minus the country's price level (World Bank, where available; otherwise an estimate)." },
  english:       { label: "English-friendliness",     type: "maximize", info: "10 minus the country's estimated language barrier without the local language." },
  safety:        { label: "Safety",                   type: "maximize", info: "Based on the country homicide rate (World Bank, where available; otherwise a rough estimate)." },
};
const METRIC_KEYS = Object.keys(METRICS);

// derived key -> [country metric key, invert?]
const COUNTRY_METRICS = {
  stipend:       ["phd_stipend_ppp", false],
  visa_ease:     ["visa_difficulty", true],
  work_life:     ["work_culture", true],
  affordability: ["cost_of_living", true],
  english:       ["english_barrier", true],
  safety:        ["safety", false],
};

// what the World Bank value measures, shown after the year
const WB_WHAT = { safety: "homicides, country-wide", cost_of_living: "price level, country-wide" };

const PERSONA_PRESETS = {
  undergrad:  { ranking: 6, stipend: 0, visa_ease: 3, work_life: 6, affordability: 10, english: 6, safety: 10 },
  phd:        { ranking: 6, stipend: 10, visa_ease: 6, work_life: 10, affordability: 6, english: 3, safety: 3 },
  researcher: { ranking: 10, stipend: 3, visa_ease: 6, work_life: 3, affordability: 3, english: 3, safety: 3 },
};

const $ = id => document.getElementById(id);
const form = $("preferences-form");
const prefList = $("preference-list");
const resultsList = $("results-list");
const resultsCount = $("results-count");
const detailsPanel = $("details-panel");
const searchInput = $("search-input");
const countryFilter = $("filter-country");

let universities = [];
let countriesById = new Map();
let rankings = [];
let activeId = null;
let visibleCount = PAGE_SIZE;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1 = v => Math.round(v * 10) / 10;

function rankingScore(arwuRank) {
  return round1(clamp(10 - 2.2 * Math.log10(arwuRank), 0, 10));
}

// Returns { metrics, sources, hostNote } for a university. Missing values are left out.
function universityProfile(uni) {
  const metrics = { ranking: rankingScore(uni.arwuRank) };
  const sources = { ranking: "Derived from approximate ARWU rank" };
  const raw = uni.countryId ? countriesById.get(uni.countryId) : null;
  if (!raw) {
    return { metrics, sources, hostNote: "No country estimates are available for this location, so only the ranking metric is scored." };
  }
  const country = raw; // already template-resolved, with sources
  const estimateText = country.quality === "template" ? "Country template estimate (rough)" : "Country estimate";
  for (const [key, [cKey, invert]] of Object.entries(COUNTRY_METRICS)) {
    const v = country.metrics ? country.metrics[cKey] : undefined;
    if (v == null) continue;
    metrics[key] = invert ? 10 - v : v;
    const src = country.sources?.[cKey];
    if (src?.kind === "worldbank") {
      const what = WB_WHAT[cKey];
      sources[key] = `World Bank ${src.year}${what ? ` (${what})` : ""}`;
    } else {
      sources[key] = estimateText;
    }
  }
  return { metrics, sources, hostNote: "" };
}

function buildPreferenceControls() {
  prefList.innerHTML = METRIC_KEYS.map(key => {
    const m = METRICS[key];
    const pills = IMPORTANCE_LEVELS.map(([val, text]) => `
        <input type="radio" id="imp-${key}-${val}" name="imp-${key}" value="${val}" ${val === "6" ? "checked" : ""}>
        <label for="imp-${key}-${val}" class="importance-pill" style="flex: 1;">${text}</label>`).join("");
    return `
      <div class="preference-item">
        <div class="pref-label-row">
          <span class="pref-name" id="label-${key}">
            ${escapeHTML(m.label)}
            <button type="button" class="info-btn" data-info="${key}" aria-label="About ${escapeHTML(m.label)}" aria-expanded="false">i</button>
          </span>
        </div>
        <div class="metric-info-box" id="info-${key}" hidden>${escapeHTML(m.info)}</div>
        <div class="pref-controls">
          <div class="importance-select" style="width: 100%;">${pills}
          </div>
        </div>
      </div>`;
  }).join("");

  prefList.querySelectorAll(".info-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const box = $(`info-${btn.dataset.info}`);
      box.hidden = !box.hidden;
      btn.classList.toggle("active", !box.hidden);
      btn.setAttribute("aria-expanded", String(!box.hidden));
    });
  });
}

function readPrefs() {
  const prefs = {};
  for (const key of METRIC_KEYS) {
    const checked = form.querySelector(`input[name="imp-${key}"]:checked`);
    prefs[key] = { value: 10, importance: checked ? Number(checked.value) : 0 };
  }
  return prefs;
}

function setPersonaButton(persona) {
  document.querySelectorAll(".persona-btn").forEach(btn => {
    const active = btn.dataset.persona === persona;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function activePersona() {
  return document.querySelector(".persona-btn.active")?.dataset.persona || "custom";
}

// Keep the URL in sync so the current setup can be shared as a link.
function syncHash() {
  const persona = activePersona();
  writeHashState(METRICS, readPrefs(), { p: persona === "custom" ? null : persona, sel: activeId });
}

function applySharedState() {
  const shared = readHashState(METRICS);
  if (!shared) return;
  for (const key of METRIC_KEYS) {
    const radio = $(`imp-${key}-${shared.prefs[key].importance}`);
    if (radio) radio.checked = true;
  }
  const persona = shared.params.get("p");
  setPersonaButton(PERSONA_PRESETS[persona] ? persona : "custom");
  activeId = shared.params.get("sel");
}

function applyPreset(persona) {
  const preset = PERSONA_PRESETS[persona];
  for (const key of METRIC_KEYS) {
    const radio = $(`imp-${key}-${preset ? preset[key] : 6}`);
    if (radio) radio.checked = true;
  }
}

function recompute() {
  rankings = rank(universities, u => universityProfile(u).metrics, METRICS, readPrefs());
  refreshSelection();
}

// Keep the selection if it is still listed, otherwise pick the top match (or none), then redraw.
function refreshSelection() {
  const filtered = filteredRankings();
  if (!filtered.some(r => r.item.id === activeId)) activeId = filtered.length ? filtered[0].item.id : null;
  renderList();
  renderDetails(activeId);
  syncHash();
}

function filteredRankings() {
  const q = searchInput.value.trim().toLowerCase();
  const country = countryFilter.value;
  return rankings.filter(({ item }) => {
    if (country !== "all" && item.country !== country) return false;
    if (!q) return true;
    return [item.name, item.city, item.country].some(s => String(s).toLowerCase().includes(q));
  });
}

// "#14" -> "≈ #14"; bands such as "101–150" stay as they are.
function bandLabel(uni) {
  return /^#/.test(uni.arwuBand) ? `≈ ${uni.arwuBand}` : uni.arwuBand;
}

function renderList() {
  const filtered = filteredRankings();
  resultsCount.textContent = `Matches: ${filtered.length} / ${universities.length}`;
  resultsList.innerHTML = "";

  if (filtered.length === 0) {
    resultsList.innerHTML = `<div class="empty-state"><p>No universities match your search.</p></div>`;
    return;
  }

  filtered.slice(0, visibleCount).forEach(({ item, score }, index) => {
    const active = item.id === activeId;
    const card = document.createElement("article");
    card.className = `country-card${active ? " active" : ""}`;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    if (active) card.setAttribute("aria-current", "true");
    const cls = matchClass(score);
    card.innerHTML = `
      <div class="card-header-row">
        <div class="card-rank-name">
          <span class="card-rank">#${index + 1}</span>
          <h3 class="card-name">${escapeHTML(item.name)}</h3>
        </div>
        <span class="card-match-badge ${cls}">${scoreText(score)}</span>
      </div>
      <p class="card-summary">${escapeHTML(item.city)}, ${escapeHTML(item.country)} · ARWU ${escapeHTML(bandLabel(item))}</p>
      <div class="match-bar-bg"><div class="match-bar-fill ${cls}" style="width: ${score ?? 0}%;"></div></div>`;
    card.addEventListener("click", () => selectUniversity(item.id));
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectUniversity(item.id);
      }
    });
    resultsList.appendChild(card);
  });

  if (filtered.length > visibleCount) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "load-more-card";
    more.textContent = `Show more (+${filtered.length - visibleCount})`;
    more.addEventListener("click", () => {
      const firstNew = visibleCount;
      visibleCount += PAGE_SIZE;
      renderList();
      resultsList.children[firstNew]?.focus();
    });
    resultsList.appendChild(more);
  }
}

function selectUniversity(id) {
  activeId = id;
  renderList();
  renderDetails(id);
  syncHash();
}

function renderDetails(id) {
  const entry = rankings.find(r => r.item.id === id);
  if (!entry) {
    detailsPanel.innerHTML = `<div class="empty-state"><p>No university matches your search.</p></div>`;
    return;
  }
  const { item, score, breakdown } = entry;
  const profile = universityProfile(item);
  const prefs = readPrefs();

  const cards = breakdown.map(b => `
      <div class="breakdown-card">
        <span class="breakdown-card-label">${escapeHTML(b.label)}</span>
        <div class="breakdown-card-score-row">
          <span class="breakdown-card-score ${matchClass(b.metricScore)}">${b.metricScore}%</span>
          <span class="breakdown-card-percent">match</span>
        </div>
        <div class="breakdown-bar-bg">
          <div class="breakdown-bar-fill ${matchClass(b.metricScore)}" style="width: ${b.metricScore}%;"></div>
        </div>
        <div class="breakdown-details">
          <span>Value: ${b.value}/10</span>
          <span>Imp: ${b.importance}</span>
        </div>
        <span class="metric-source">${escapeHTML(profile.sources[b.key] || "")}</span>
      </div>`).join("");

  const skipped = METRIC_KEYS.filter(k => profile.metrics[k] == null && prefs[k].importance > 0);
  const skippedNote = skipped.length
    ? `<div class="data-note">Not scored (no data): ${skipped.map(k => escapeHTML(METRICS[k].label)).join(", ")}. ${escapeHTML(profile.hostNote)}</div>`
    : "";

  detailsPanel.innerHTML = `
    <header class="details-header">
      <div class="details-title">
        <h2>${escapeHTML(item.name)}</h2>
        <p class="subtitle">${escapeHTML(item.city)}, ${escapeHTML(item.country)}</p>
        <p class="subtitle">Shanghai (ARWU) rank: ${escapeHTML(bandLabel(item))} (approximate, ~2023)</p>
      </div>
      <div class="details-score-box">
        <span class="details-percentage ${matchClass(score)}">${scoreText(score)}</span>
        <span class="details-score-label">Match</span>
      </div>
    </header>

    <div class="data-note">This score is a weighted average of the factors you rated as important. Only the ranking factor is specific to this university, and it comes from an approximate rank. The other factors are country-level values (safety and price level from World Bank data, the rest hand-made estimates) shared by every university in the same country. It says nothing about any department, supervisor or research group.</div>
    ${skippedNote}

    <section class="detail-section" aria-labelledby="detail-title-breakdown">
      <h3 class="detail-section-title" id="detail-title-breakdown">Score breakdown</h3>
      <div class="breakdown-grid">${cards}</div>
    </section>

    <p class="detail-links"><a href="https://www.google.com/search?q=${encodeURIComponent(item.name)}" target="_blank" rel="noopener noreferrer">Search official site</a></p>`;
}

function populateCountryFilter() {
  const names = [...new Set(universities.map(u => u.country))].sort((a, b) => a.localeCompare(b));
  countryFilter.insertAdjacentHTML(
    "beforeend",
    names.map(n => `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`).join("")
  );
}

function resetAndRender() {
  visibleCount = PAGE_SIZE;
  refreshSelection();
}

async function init() {
  try {
    const [uniData, countryData] = await Promise.all([
      loadJSON("data/universities.json"),
      loadCountryData(),
    ]);
    universities = uniData.universities;
    countriesById = new Map(countryData.countries.map(c => [c.id, c]));
  } catch (err) {
    console.error(err);
    resultsCount.textContent = "Error loading data.";
    return;
  }

  buildPreferenceControls();
  populateCountryFilter();
  applySharedState();
  setupCopyLink($("copy-link-btn"));
  reloadOnExternalHashChange();

  const debouncedRecompute = debounce(recompute, 100);
  form.addEventListener("change", () => {
    setPersonaButton("custom");
    debouncedRecompute();
  });
  document.querySelectorAll(".persona-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      setPersonaButton(btn.dataset.persona);
      applyPreset(btn.dataset.persona);
      recompute();
    });
  });
  searchInput.addEventListener("input", debounce(resetAndRender, 150));
  countryFilter.addEventListener("change", resetAndRender);

  recompute();
}

init();
