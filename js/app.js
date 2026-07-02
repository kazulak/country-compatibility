/**
 * Country Compatibility Explorer - UI Controller
 * Binds DOM events, makes POST requests to the Python analytics backend,
 * and renders the matching reports with search filters, tabs, and pagination.
 */

// Define mapping of advanced metrics to their section toggles
const ADVANCED_METRIC_SECTIONS = {
  // Climate & Nature advanced metrics
  "humidity_level": "toggle-climate_nature",
  "air_quality": "toggle-climate_nature",
  "sunshine_hours": "toggle-climate_nature",

  // Cost & Visas advanced metrics
  "childcare_education_cost": "toggle-cost_visas",
  "dining_food_cost": "toggle-cost_visas",
  "childcare_quality": "toggle-cost_visas",

  // Society & Lifestyle advanced metrics
  "social_tolerance": "toggle-society_lifestyle",
  "bureaucracy_difficulty": "toggle-society_lifestyle",
  "foreigner_friendliness": "toggle-society_lifestyle",
  "happiness_index": "toggle-society_lifestyle",

  // Infrastructure & Work advanced metrics
  "road_quality": "toggle-infrastructure_work",
  "local_job_market": "toggle-infrastructure_work",
  "ease_of_doing_business": "toggle-infrastructure_work",

  // Academia & Research advanced metrics
  "phd_stipend_ppp": "toggle-academia_research",
  "academic_satisfaction": "toggle-academia_research"
};

// Define all 31 metrics and their type
const ALL_METRIC_TYPES = {
  "warm_weather": "preference",
  "seasonal_variety": "preference",
  "nature_mountains": "maximize",
  "nature_lakes_rivers": "maximize",
  "nature_sea_beaches": "maximize",
  "nature_forests_greenery": "maximize",
  "cost_of_living": "preference",
  "housing_affordability": "maximize",
  "tax_burden": "preference",
  "visa_difficulty": "maximize",
  "pace_of_life": "preference",
  "safety": "maximize",
  "healthcare_quality": "maximize",
  "english_barrier": "maximize",
  "walkability_transit": "maximize",
  "internet_speed": "maximize",
  "work_culture": "preference",
  "humidity_level": "preference",
  "air_quality": "maximize",
  "sunshine_hours": "maximize",
  "childcare_education_cost": "maximize",
  "dining_food_cost": "maximize",
  "social_tolerance": "maximize",
  "bureaucracy_difficulty": "maximize",
  "foreigner_friendliness": "maximize",
  "road_quality": "maximize",
  "local_job_market": "maximize",
  "phd_stipend_ppp": "maximize",
  "academic_satisfaction": "maximize",
  "happiness_index": "maximize",
  "ease_of_doing_business": "maximize",
  "childcare_quality": "maximize"
};

// Application State
let activeLocationId = null;
let currentRankings = []; // Countries and cities returned by Python server
let rankingMode = "country"; // "country" or "city"
let visibleCount = 15;     // Number of loaded countries to prevent scroll fatigue
let activePersona = "custom"; // "custom", "phd", "family", "entrepreneur", "nomad"
let updateTimeout = null;     // For debouncing API requests

// DOM Elements
const form = document.getElementById("preferences-form");
const resultsList = document.getElementById("results-list");
const resultsCount = document.getElementById("results-count");
const detailsPanel = document.getElementById("details-panel");
const searchInput = document.getElementById("search-country");
const scoreFilter = document.getElementById("filter-score");
const tabCountry = document.getElementById("tab-country");
const tabCity = document.getElementById("tab-city");
const rankingsTitle = document.getElementById("rankings-title");

// Quiz DOM Elements
const quizModal = document.getElementById("quiz-modal");
const openQuizBtn = document.getElementById("open-quiz-btn");
const closeQuizBtn = document.getElementById("close-quiz-btn");
const quizForm = document.getElementById("quiz-form");
const quizProgress = document.getElementById("quiz-progress");
const quizPrevBtn = document.getElementById("quiz-prev-btn");
const quizNextBtn = document.getElementById("quiz-next-btn");

let currentQuizSlide = 1;
const totalQuizSlides = 10;

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  updateCompatibility();
});

/**
 * Sets up listeners for sliders, radios, advanced toggles, filters, tabs, and info icons.
 */
function setupEventListeners() {
  // 1. Listen for value slider movements
  const sliders = form.querySelectorAll("input[type='range']");
  sliders.forEach(slider => {
    const metricId = slider.id.replace("pref-", "");
    const valDisplay = document.getElementById(`val-${metricId}`);

    slider.addEventListener("input", (e) => {
      if (valDisplay) {
        valDisplay.textContent = e.target.value;
      }
      activePersona = "custom";
      setActivePersonaButton("custom");
      debouncedUpdateCompatibility();
    });
  });

  // 2. Listen for importance changes (radios)
  const radios = form.querySelectorAll("input[type='radio']");
  radios.forEach(radio => {
    radio.addEventListener("change", () => {
      activePersona = "custom";
      setActivePersonaButton("custom");
      debouncedUpdateCompatibility();
    });
  });

  // 3. Listen for section Advanced toggles
  const advToggles = form.querySelectorAll(".advanced-toggle");
  advToggles.forEach(toggle => {
    const sectionId = toggle.id.replace("toggle-", "adv-");
    const container = document.getElementById(sectionId);

    toggle.addEventListener("change", (e) => {
      // Toggle container visibility
      if (container) {
        container.hidden = !e.target.checked;
      }
      activePersona = "custom";
      setActivePersonaButton("custom");
      debouncedUpdateCompatibility();
    });
  });

  // 4. Listen for info icon clicks (i)
  const infoBtns = form.querySelectorAll(".info-btn");
  infoBtns.forEach(btn => {
    const metricId = btn.getAttribute("data-info");
    const infoBox = document.getElementById(`info-${metricId}`);

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isCurrentlyHidden = infoBox.hidden;
      infoBox.hidden = !isCurrentlyHidden;
      btn.classList.toggle("active", isCurrentlyHidden);
    });
  });

  // 5. Search & Filter Input Listeners
  searchInput.addEventListener("input", () => {
    visibleCount = 15;
    renderRankingsList();
    autoSelectOnFilterChange();
  });

  scoreFilter.addEventListener("change", () => {
    visibleCount = 15;
    renderRankingsList();
    autoSelectOnFilterChange();
  });

  // 6. Tab Swapping Listeners (Countries vs Cities)
  tabCountry.addEventListener("click", () => {
    if (rankingMode !== "country") {
      rankingMode = "country";
      tabCountry.classList.add("active");
      tabCountry.setAttribute("aria-selected", "true");
      tabCity.classList.remove("active");
      tabCity.setAttribute("aria-selected", "false");
      rankingsTitle.textContent = "Country Rankings";
      searchInput.placeholder = "Search country by name...";
      visibleCount = 15;
      renderRankingsList();
      autoSelectOnFilterChange();
    }
  });

  tabCity.addEventListener("click", () => {
    if (rankingMode !== "city") {
      rankingMode = "city";
      tabCity.classList.add("active");
      tabCity.setAttribute("aria-selected", "true");
      tabCountry.classList.remove("active");
      tabCountry.setAttribute("aria-selected", "false");
      rankingsTitle.textContent = "City Rankings";
      searchInput.placeholder = "Search city by name...";
      visibleCount = 15;
      renderRankingsList();
      autoSelectOnFilterChange();
    }
  });

  // 7. Expat Persona Preset Listeners
  const personaBtns = document.querySelectorAll(".persona-btn");
  personaBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const persona = btn.getAttribute("data-persona");
      setActivePersonaButton(persona);
      applyPersonaPreset(persona);
    });
  });

  // 8. Quiz Modal Listeners
  if (openQuizBtn) {
    openQuizBtn.addEventListener("click", () => {
      currentQuizSlide = 1;
      showQuizSlide(1);
      quizModal.removeAttribute("hidden");
    });
  }

  if (closeQuizBtn) {
    closeQuizBtn.addEventListener("click", () => {
      quizModal.setAttribute("hidden", "true");
    });
  }

  if (quizModal) {
    // Close on backdrop click
    quizModal.addEventListener("click", (e) => {
      if (e.target === quizModal) {
        quizModal.setAttribute("hidden", "true");
      }
    });
  }

  // Close on Escape keypress
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && quizModal && !quizModal.hasAttribute("hidden")) {
      quizModal.setAttribute("hidden", "true");
    }
  });

  if (quizPrevBtn) {
    quizPrevBtn.addEventListener("click", () => {
      if (currentQuizSlide > 1) {
        currentQuizSlide--;
        showQuizSlide(currentQuizSlide);
      }
    });
  }

  if (quizNextBtn) {
    quizNextBtn.addEventListener("click", () => {
      if (currentQuizSlide < totalQuizSlides) {
        currentQuizSlide++;
        showQuizSlide(currentQuizSlide);
      } else {
        finishQuizAndSetPersona();
      }
    });
  }
}

/**
 * Extracts inputs from the UI.
 * 
 * @returns {Object} Preferences map structured for the Python engine
 */
function getPreferences() {
  const preferences = {};

  for (const [key, type] of Object.entries(ALL_METRIC_TYPES)) {
    let isActive = true;
    if (key in ADVANCED_METRIC_SECTIONS) {
      const toggleId = ADVANCED_METRIC_SECTIONS[key];
      const toggleElement = document.getElementById(toggleId);
      if (toggleElement && !toggleElement.checked) {
        isActive = false;
      }
    }

    let value = 5;
    const slider = document.getElementById(`pref-${key}`);
    if (slider) {
      value = Number(slider.value);
    }

    let importance = 0;
    if (isActive) {
      const checkedRadio = form.querySelector(`input[name="imp-${key}"]:checked`);
      if (checkedRadio) {
        importance = Number(checkedRadio.value);
      }
    }

    preferences[key] = { value, importance };
  }

  return preferences;
}

/**
 * Sends preferences to the Python backend and updates the UI rankings.
 */
async function updateCompatibility() {
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
}

/**
 * Filters the current rankings list client-side based on tabs, search, and min score.
 * @returns {Array} Filtered list
 */
function getFilteredRankings() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const minScore = Number(scoreFilter.value) || 0;

  return currentRankings.filter(item => {
    // Filter by active type (country vs city)
    if (item.location.type !== rankingMode) return false;

    // Score check
    if (item.score < minScore) return false;

    // Search check
    if (searchTerm) {
      const name = item.location.name.toLowerCase();
      const fullName = item.location.fullName.toLowerCase();
      if (!name.includes(searchTerm) && !fullName.includes(searchTerm)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Auto-selects the top country if the current selection is hidden by filter terms.
 */
function autoSelectOnFilterChange() {
  const filtered = getFilteredRankings();
  const stillVisible = filtered.some(item => item.location.id === activeLocationId);
  if (!stillVisible && filtered.length > 0) {
    selectLocation(filtered[0].location.id);
  }
}

/**
 * Renders the sidebar rankings using sliced results to prevent page bloat.
 */
function renderRankingsList() {
  resultsList.innerHTML = "";
  
  const filtered = getFilteredRankings();
  const totalInDb = currentRankings.filter(item => item.location.type === rankingMode).length;
  resultsCount.textContent = `Matches: ${filtered.length} / ${totalInDb}`;

  const itemsToRender = filtered.slice(0, visibleCount);

  itemsToRender.forEach((item, index) => {
    const loc = item.location;
    const rank = index + 1;
    const score = item.score;
    const isActive = loc.id === activeLocationId;

    const card = document.createElement("article");
    card.className = `country-card ${isActive ? "active" : ""}`;
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-selected", isActive ? "true" : "false");
    
    let matchClass = "match-low";
    if (score >= 80) matchClass = "match-high";
    else if (score >= 55) matchClass = "match-medium";

    card.innerHTML = `
      <div class="card-header-row">
        <div class="card-rank-name">
          <span class="card-rank">#${rank}</span>
          <h3 class="card-name">${loc.name}</h3>
        </div>
        <span class="card-match-badge ${matchClass}">${score}%</span>
      </div>
      <p class="card-summary">${loc.summary}</p>
      <div class="match-bar-bg">
        <div class="match-bar-fill ${matchClass}" style="width: ${score}%;"></div>
      </div>
    `;

    card.addEventListener("click", () => {
      selectLocation(loc.id);
    });

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectLocation(loc.id);
      }
    });

    resultsList.appendChild(card);
  });

  // Render "Load More" Card if more countries remain in filtered results
  if (filtered.length > visibleCount) {
    const remaining = filtered.length - visibleCount;
    const loadMoreButton = document.createElement("div");
    loadMoreButton.className = "load-more-card";
    loadMoreButton.textContent = `Show More Matches (+${remaining})`;
    loadMoreButton.setAttribute("role", "button");
    loadMoreButton.setAttribute("tabindex", "0");

    const loadMore = () => {
      visibleCount += 15;
      renderRankingsList();
    };

    loadMoreButton.addEventListener("click", loadMore);
    loadMoreButton.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        loadMore();
      }
    });

    resultsList.appendChild(loadMoreButton);
  }
}

/**
 * Sets active selection.
 */
function selectLocation(locationId) {
  activeLocationId = locationId;
  renderRankingsList();
  renderDetails(locationId);
  detailsPanel.scrollTop = 0;
}

/**
 * Renders details report for the active location.
 */
function renderDetails(locationId) {
  const rankingItem = currentRankings.find(item => item.location.id === locationId);
  if (!rankingItem) return;

  const loc = rankingItem.location;
  const score = rankingItem.score;
  const breakdown = rankingItem.breakdown;

  // Resolve persona perspective overrides
  let summary = loc.summary;
  let overview = loc.description.overview;
  let pros = loc.description.pros;
  let cons = loc.description.cons;
  let perspectiveBadgeHTML = "";

  if (activePersona && activePersona !== "custom" && loc.personaData && loc.personaData[activePersona]) {
    summary = loc.personaData[activePersona].summary;
    overview = loc.personaData[activePersona].overview;
    pros = loc.personaPros[activePersona] || [];
    cons = loc.personaCons[activePersona] || [];
    
    const labelMap = {
      phd: "🎓 PhD Perspective",
      family: "🏡 Family Perspective",
      entrepreneur: "💼 Entrepreneur Perspective",
      nomad: "💻 Digital Nomad Perspective"
    };
    perspectiveBadgeHTML = `<span class="perspective-badge">${labelMap[activePersona]}</span>`;
  }

  let matchClass = "match-low";
  if (score >= 80) matchClass = "match-high";
  else if (score >= 55) matchClass = "match-medium";

  // Render child cities listing if active location is a country
  let citiesHTML = "";
  if (loc.type === "country") {
    const childCities = currentRankings.filter(item => 
      item.location.type === "city" && item.location.parentId === locationId
    );

    if (childCities.length > 0) {
      const cityRows = childCities.map(item => `
        <div class="detail-city-row" data-city-id="${item.location.id}" role="button" tabindex="0">
          <span class="detail-city-name">${item.location.name}</span>
          <span class="detail-city-badge">${item.score}% Match</span>
        </div>
      `).join("");

      citiesHTML = `
        <section class="detail-section" aria-labelledby="detail-title-cities">
          <h3 class="detail-section-title" id="detail-title-cities">Popular Cities &amp; Regions</h3>
          <div class="detail-cities-list">
            ${cityRows}
          </div>
        </section>
      `;
    }
  }

  // Build metrics breakdown cards
  const breakdownCardsHTML = breakdown.map(item => {
    let scoreColor = "match-low";
    if (item.metricScore >= 80) scoreColor = "match-high";
    else if (item.metricScore >= 55) scoreColor = "match-medium";

    let labelString = "";
    if (item.type === "preference") {
      labelString = `Target: ${item.userTarget} | Rating: ${item.locationValue}`;
    } else {
      labelString = `Rating: ${item.locationValue}/10`;
    }

    return `
      <div class="breakdown-card">
        <span class="breakdown-card-label">${item.label}</span>
        <div class="breakdown-card-score-row">
          <span class="breakdown-card-score ${scoreColor}">${item.metricScore}%</span>
          <span class="breakdown-card-percent">match</span>
        </div>
        <div class="breakdown-bar-bg">
          <div class="breakdown-bar-fill ${scoreColor}" style="width: ${item.metricScore}%;"></div>
        </div>
        <div class="breakdown-details">
          <span>${labelString}</span>
          <span>Imp: ${item.importance}</span>
        </div>
      </div>
    `;
  }).join("");

  const prosHTML = pros.map(pro => `
    <div class="pro-con-item">${pro}</div>
  `).join("");

  const consHTML = cons.map(con => `
    <div class="pro-con-item">${con}</div>
  `).join("");

  // Build Demographics / Basic Data Grid
  let factsHTML = "";
  if (loc.basicData) {
    const data = loc.basicData;
    let cards = "";
    if (loc.type === "country") {
      cards = `
        <div class="demographic-card">
          <span class="demographic-label">Capital City</span>
          <span class="demographic-value">${data.capital || "N/A"}</span>
        </div>
        <div class="demographic-card">
          <span class="demographic-label">Official Language</span>
          <span class="demographic-value">${data.language || "N/A"}</span>
        </div>
        <div class="demographic-card">
          <span class="demographic-label">Currency</span>
          <span class="demographic-value">${data.currency || "N/A"}</span>
        </div>
        <div class="demographic-card">
          <span class="demographic-label">Total Population</span>
          <span class="demographic-value">${data.population || "N/A"}</span>
        </div>
      `;
    } else {
      cards = `
        <div class="demographic-card">
          <span class="demographic-label">Urban Population</span>
          <span class="demographic-value">${data.population || "N/A"}</span>
        </div>
        <div class="demographic-card">
          <span class="demographic-label">Local Timezone</span>
          <span class="demographic-value">${data.timezone || "N/A"}</span>
        </div>
        <div class="demographic-card">
          <span class="demographic-label">Elevation</span>
          <span class="demographic-value">${data.elevation || "N/A"}</span>
        </div>
        <div class="demographic-card">
          <span class="demographic-label">Country</span>
          <span class="demographic-value">${loc.fullName.split(", ").slice(-1)[0] || "N/A"}</span>
        </div>
      `;
    }

    factsHTML = `
      <section class="detail-section" aria-labelledby="detail-title-facts">
        <h3 class="detail-section-title" id="detail-title-facts">Quick Facts &amp; Demographics</h3>
        <div class="demographics-grid">
          ${cards}
        </div>
      </section>
    `;
  }

  detailsPanel.innerHTML = `
    <header class="details-header">
      <div class="details-title">
        <h2>${loc.fullName}</h2>
        ${perspectiveBadgeHTML}
        <p class="subtitle">${summary}</p>
      </div>
      <div class="details-score-box">
        <span class="details-percentage ${matchClass}">${score}%</span>
        <span class="details-score-label">Compatibility Match</span>
      </div>
    </header>

    <section class="detail-section" aria-labelledby="detail-title-overview">
      <h3 class="detail-section-title" id="detail-title-overview">Overview</h3>
      <p class="overview-text">${overview}</p>
    </section>

    ${factsHTML}

    <!-- Nested cities checklist (for Countries only) -->
    ${citiesHTML}

    <section class="detail-section" aria-labelledby="detail-title-proscons">
      <h3 class="detail-section-title" id="detail-title-proscons">Key Tradeoffs</h3>
      <div class="pros-cons-grid">
        <div class="pros-list">
          <h4 class="pro-con-header pro">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Pros
          </h4>
          ${prosHTML}
        </div>
        <div class="cons-list">
          <h4 class="pro-con-header con">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            Cons
          </h4>
          ${consHTML}
        </div>
      </div>
    </section>

    <section class="detail-section" aria-labelledby="detail-title-visa">
      <h3 class="detail-section-title" id="detail-title-visa">Residency &amp; Visas</h3>
      <div class="visa-box">
        <p>${loc.description.visaInfo}</p>
      </div>
    </section>

    <section class="detail-section" aria-labelledby="detail-title-breakdown">
      <h3 class="detail-section-title" id="detail-title-breakdown">Metric-by-Metric Compatibility</h3>
      <div class="breakdown-grid">
        ${breakdownCardsHTML}
      </div>
    </section>
  `;

  // Attach click listeners to child city row triggers
  if (loc.type === "country") {
    const rows = detailsPanel.querySelectorAll(".detail-city-row");
    rows.forEach(row => {
      const cityId = row.getAttribute("data-city-id");
      
      const navigateToCity = () => {
        // Swap sidebar tab state to cities
        rankingMode = "city";
        tabCity.classList.add("active");
        tabCity.setAttribute("aria-selected", "true");
        tabCountry.classList.remove("active");
        tabCountry.setAttribute("aria-selected", "false");
        rankingsTitle.textContent = "City Rankings";
        searchInput.placeholder = "Search city by name...";
        
        selectLocation(cityId);
      };

      row.addEventListener("click", navigateToCity);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigateToCity();
        }
      });
    });
  }
}

// ==========================================
// EXPAT PERSONA PRESETS SYSTEM
// ==========================================

const PERSONA_PRESETS = {
  custom: null,
  
  phd: {
    toggles: {
      "toggle-academia_research": true,
      "toggle-infrastructure_work": false,
      "toggle-society_lifestyle": false,
      "toggle-cost_visas": false,
      "toggle-climate_nature": false
    },
    metrics: {
      "phd_stipend_ppp": { importance: 10 },
      "academic_satisfaction": { importance: 10 },
      "cost_of_living": { importance: 6, value: 4 },
      "internet_speed": { importance: 6 }
    }
  },
  
  family: {
    toggles: {
      "toggle-academia_research": false,
      "toggle-infrastructure_work": false,
      "toggle-society_lifestyle": true,
      "toggle-cost_visas": true,
      "toggle-climate_nature": false
    },
    metrics: {
      "safety": { importance: 10 },
      "healthcare_quality": { importance: 10 },
      "childcare_quality": { importance: 10 },
      "childcare_education_cost": { importance: 10 },
      "happiness_index": { importance: 6 },
      "air_quality": { importance: 6 },
      "cost_of_living": { importance: 6, value: 5 },
      "housing_affordability": { importance: 6 }
    }
  },
  
  entrepreneur: {
    toggles: {
      "toggle-academia_research": false,
      "toggle-infrastructure_work": true,
      "toggle-society_lifestyle": true,
      "toggle-cost_visas": false,
      "toggle-climate_nature": false
    },
    metrics: {
      "ease_of_doing_business": { importance: 10 },
      "internet_speed": { importance: 10 },
      "tax_burden": { importance: 10, value: 2 },
      "bureaucracy_difficulty": { importance: 10 },
      "local_job_market": { importance: 6 }
    }
  },
  
  nomad: {
    toggles: {
      "toggle-academia_research": false,
      "toggle-infrastructure_work": false,
      "toggle-society_lifestyle": true,
      "toggle-cost_visas": true,
      "toggle-climate_nature": false
    },
    metrics: {
      "internet_speed": { importance: 10 },
      "cost_of_living": { importance: 10, value: 3 },
      "dining_food_cost": { importance: 10 },
      "visa_difficulty": { importance: 10 },
      "bureaucracy_difficulty": { importance: 6 },
      "social_tolerance": { importance: 6 },
      "foreigner_friendliness": { importance: 6 },
      "english_barrier": { importance: 6 }
    }
  }
};

function setActivePersonaButton(persona) {
  const buttons = document.querySelectorAll(".persona-btn");
  buttons.forEach(btn => {
    const active = btn.getAttribute("data-persona") === persona;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function applyPersonaPreset(persona) {
  activePersona = persona;
  const preset = PERSONA_PRESETS[persona];
  if (!preset) {
    // Reset all advanced sections to collapsed for custom defaults
    for (const [key, toggleId] of Object.entries(ADVANCED_METRIC_SECTIONS)) {
      const toggleEl = document.getElementById(toggleId);
      if (toggleEl) {
        toggleEl.checked = false;
        const sectionId = toggleId.replace("toggle-", "adv-");
        const container = document.getElementById(sectionId);
        if (container) container.hidden = true;
      }
    }
    // Set all metrics back to default (Medium for core, Off for advanced)
    for (const [key, type] of Object.entries(ALL_METRIC_TYPES)) {
      const isAdvanced = key in ADVANCED_METRIC_SECTIONS;
      const targetImp = isAdvanced ? 0 : 6;
      const slider = document.getElementById(`pref-${key}`);
      const valDisplay = document.getElementById(`val-${key}`);
      if (slider) {
        slider.value = 5;
        if (valDisplay) valDisplay.textContent = 5;
      }
      const radioEl = document.getElementById(`imp-${key}-${targetImp}`);
      if (radioEl) radioEl.checked = true;
    }
    updateCompatibility();
    return;
  }

  // 1. Apply Advanced Section Toggles
  for (const [toggleId, checked] of Object.entries(preset.toggles)) {
    const toggleEl = document.getElementById(toggleId);
    if (toggleEl) {
      toggleEl.checked = checked;
      const sectionId = toggleId.replace("toggle-", "adv-");
      const container = document.getElementById(sectionId);
      if (container) {
        container.hidden = !checked;
      }
    }
  }

  // 2. Set all metric importance and values
  for (const [key, type] of Object.entries(ALL_METRIC_TYPES)) {
    const isAdvanced = key in ADVANCED_METRIC_SECTIONS;
    
    // Set Slider value (if preference type)
    const slider = document.getElementById(`pref-${key}`);
    const valDisplay = document.getElementById(`val-${key}`);
    
    if (slider) {
      let targetVal = 5;
      if (preset.metrics[key] && preset.metrics[key].value !== undefined) {
        targetVal = preset.metrics[key].value;
      }
      slider.value = targetVal;
      if (valDisplay) valDisplay.textContent = targetVal;
    }

    // Set Importance
    let targetImp = isAdvanced ? 0 : 6; // default 0 for advanced, 6 for core
    if (preset.metrics[key] && preset.metrics[key].importance !== undefined) {
      targetImp = preset.metrics[key].importance;
    }
    
    const radioEl = document.getElementById(`imp-${key}-${targetImp}`);
    if (radioEl) {
      radioEl.checked = true;
    }
  }

  updateCompatibility();
}

function showQuizSlide(slideNumber) {
  const slides = document.querySelectorAll(".quiz-slide");
  slides.forEach(slide => {
    slide.hidden = true;
  });

  const target = document.getElementById(`quiz-slide-${slideNumber}`);
  if (target) {
    target.hidden = false;
  }

  const percent = (slideNumber / totalQuizSlides) * 100;
  quizProgress.style.width = `${percent}%`;

  quizPrevBtn.disabled = slideNumber === 1;
  quizNextBtn.textContent = slideNumber === totalQuizSlides ? "Finish" : "Next";
}

function finishQuizAndSetPersona() {
  const formData = new FormData(quizForm);
  const keys = [
    "q-goal",
    "q-funding",
    "q-climate",
    "q-nature",
    "q-financial",
    "q-visa",
    "q-language",
    "q-transit",
    "q-healthcare",
    "q-safety"
  ];

  const tallies = { phd: 0, family: 0, entrepreneur: 0, nomad: 0 };
  const goal = formData.get("q-goal");

  // Tally answers across all 10 questions
  keys.forEach(key => {
    const val = formData.get(key);
    if (val && val in tallies) {
      tallies[val]++;
    }
  });

  let bestPersona = "phd";
  let maxVotes = -1;

  for (const [pers, votes] of Object.entries(tallies)) {
    if (votes > maxVotes) {
      maxVotes = votes;
      bestPersona = pers;
    } else if (votes === maxVotes) {
      // Tie-breaker goes to primary goal choice
      if (pers === goal) {
        bestPersona = pers;
      }
    }
  }

  activePersona = bestPersona;
  setActivePersonaButton(activePersona);
  applyPersonaPreset(activePersona);
  quizModal.setAttribute("hidden", "true");
}

function debouncedUpdateCompatibility() {
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }
  updateTimeout = setTimeout(() => {
    updateCompatibility();
  }, 180);
}
