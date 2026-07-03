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
const totalQuizSlides = 6;

let rawLocations = [];
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
      buildQuizSlides();
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
function updateCompatibility() {
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

// --- Quiz slides state & functions ---
let priorities = [
  { key: "cost_tax", label: "💰 Cost & Tax", desc: "Cost of living, housing costs, taxes" },
  { key: "climate_nature", label: "☀️ Climate & Nature", desc: "Temperatures, mountains, beaches, forests" },
  { key: "safety_health", label: "🛡️ Safety & Health", desc: "Crime rate, air quality, healthcare" },
  { key: "work_business", label: "💻 Work & Tech", desc: "Internet speed, local job market, business ease" },
  { key: "culture_lifestyle", label: "🗣️ Culture & Lifestyle", desc: "Pace of life, friendliness, English level" }
];

function buildQuizSlides() {
  const container = document.getElementById('quiz-slide-container');
  if (!container) return;
  container.innerHTML = '';

  // Slide 1: Role / Expat Persona
  container.insertAdjacentHTML('beforeend', `
    <div class="quiz-slide" id="quiz-slide-1">
      <h3 class="quiz-question">What is your primary objective or persona for moving abroad?</h3>
      <div class="quiz-options">
        <label class="quiz-option-card">
          <input type="radio" name="q-goal" value="nomad" checked>
          <div class="option-content">
            <span class="option-icon">💻</span>
            <div class="option-details">
              <strong>Digital Nomad / Remote Worker</strong>
              <span>I want affordable living, good internet, warm sun, and simple digital nomad visas.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-goal" value="family">
          <div class="option-content">
            <span class="option-icon">🏡</span>
            <div class="option-details">
              <strong>Family Relocation</strong>
              <span>I prioritize safety, healthcare, good schools, and stable long-term residency.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-goal" value="entrepreneur">
          <div class="option-content">
            <span class="option-icon">💼</span>
            <div class="option-details">
              <strong>Entrepreneur / Business Owner</strong>
              <span>I focus on startup ecosystems, ease of doing business, and tax burdens.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-goal" value="phd">
          <div class="option-content">
            <span class="option-icon">🎓</span>
            <div class="option-details">
              <strong>PhD Scholar / Researcher</strong>
              <span>I'm looking for academic stipends, research freedom, and university connections.</span>
            </div>
          </div>
        </label>
      </div>
    </div>
  `);

  // Slide 2: Current Location (with Search)
  // Retrieve countries from currentRankings
  const countries = Array.from(new Set(currentRankings
    .filter(item => item.location && item.location.type === 'country')
    .map(item => item.location.name)))
    .sort();

  let countryOptionsHTML = '';
  countries.forEach((country, idx) => {
    countryOptionsHTML += `
      <label class="quiz-option-card quiz-option-compact">
        <input type="radio" name="q-current-country" value="${country}" ${idx === 0 ? 'checked' : ''}>
        <div class="option-content">
          <span class="option-icon">📍</span>
          <div class="option-details">
            <strong>${country}</strong>
          </div>
        </div>
      </label>
    `;
  });

  if (!countryOptionsHTML) {
    // Fallback if currentRankings is empty
    countryOptionsHTML = `
      <label class="quiz-option-card quiz-option-compact">
        <input type="radio" name="q-current-country" value="United States" checked>
        <div class="option-content"><span class="option-icon">📍</span><div class="option-details"><strong>United States</strong></div></div>
      </label>
      <label class="quiz-option-card quiz-option-compact">
        <input type="radio" name="q-current-country" value="United Kingdom">
        <div class="option-content"><span class="option-icon">📍</span><div class="option-details"><strong>United Kingdom</strong></div></div>
      </label>
      <label class="quiz-option-card quiz-option-compact">
        <input type="radio" name="q-current-country" value="Germany">
        <div class="option-content"><span class="option-icon">📍</span><div class="option-details"><strong>Germany</strong></div></div>
      </label>
    `;
  }

  container.insertAdjacentHTML('beforeend', `
    <div class="quiz-slide" id="quiz-slide-2" hidden>
      <h3 class="quiz-question">Where do you live currently?</h3>
      <div class="quiz-disc-search-wrap">
        <input type="text" id="quiz-country-search" class="quiz-disc-search" placeholder="Search current country..." aria-label="Search countries">
      </div>
      <div class="quiz-options quiz-options-scrollable" id="quiz-country-options">
        ${countryOptionsHTML}
      </div>
    </div>
  `);

  // Slide 3: Priorities Ranking (Put in order of importance)
  container.insertAdjacentHTML('beforeend', `
    <div class="quiz-slide" id="quiz-slide-3" hidden>
      <h3 class="quiz-question">Rank the five pillars in order of importance to you (use ▲/▼ to sort):</h3>
      <div class="quiz-options" id="quiz-priorities-list" style="gap: 6px;">
        <!-- Populated dynamically via renderPrioritiesList() -->
      </div>
    </div>
  `);

  // Slide 4: Adaptive Financial / Climate Question
  container.insertAdjacentHTML('beforeend', `
    <div class="quiz-slide" id="quiz-slide-4" hidden>
      <!-- Populated dynamically by populateAdaptiveSlide4() -->
    </div>
  `);

  // Slide 5: Language & Integration
  container.insertAdjacentHTML('beforeend', `
    <div class="quiz-slide" id="quiz-slide-5" hidden>
      <h3 class="quiz-question">What are your local language expectations?</h3>
      <div class="quiz-options">
        <label class="quiz-option-card">
          <input type="radio" name="q-lang-pref" value="english_barrier" checked>
          <div class="option-content">
            <span class="option-icon">🇬🇧</span>
            <div class="option-details">
              <strong>English-Friendly Only</strong>
              <span>I want to live where English is extremely widely spoken; language barriers should be minimal.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-lang-pref" value="willing_basic">
          <div class="option-content">
            <span class="option-icon">🗣️</span>
            <div class="option-details">
              <strong>Willing to Learn the Basics</strong>
              <span>I can study the local language for daily transactions and polite interaction.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-lang-pref" value="immersion">
          <div class="option-content">
            <span class="option-icon">📚</span>
            <div class="option-details">
              <strong>Full Integration</strong>
              <span>I want to learn the local language fluently and fully immerse myself in the local culture.</span>
            </div>
          </div>
        </label>
      </div>
    </div>
  `);

  // Slide 6: Visa & Administrative path
  container.insertAdjacentHTML('beforeend', `
    <div class="quiz-slide" id="quiz-slide-6" hidden>
      <h3 class="quiz-question">How do you prefer to handle visas and paperwork?</h3>
      <div class="quiz-options">
        <label class="quiz-option-card">
          <input type="radio" name="q-visa-pref" value="nomad" checked>
          <div class="option-content">
            <span class="option-icon">✈️</span>
            <div class="option-details">
              <strong>Simple Digital Nomad Visas</strong>
              <span>Fast online visa entry paths for remote workers without local corporate entities.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-visa-pref" value="corporate">
          <div class="option-content">
            <span class="option-icon">💼</span>
            <div class="option-details">
              <strong>Employment Sponsorship</strong>
              <span>Residency tied to a local company employment visa.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-visa-pref" value="entrepreneur">
          <div class="option-content">
            <span class="option-icon">💻</span>
            <div class="option-details">
              <strong>Business Setup / Investment</strong>
              <span>Residency earned by opening a local corporate company or investment.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-visa-pref" value="family">
          <div class="option-content">
            <span class="option-icon">🏠</span>
            <div class="option-details">
              <strong>Long-term Family Resettlement</strong>
              <span>Stable pathways leading to permanent residency and future citizenship.</span>
            </div>
          </div>
        </label>
      </div>
    </div>
  `);

  attachCountrySearch();
}

function renderPrioritiesList() {
  const listContainer = document.getElementById('quiz-priorities-list');
  if (!listContainer) return;
  listContainer.innerHTML = '';

  priorities.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'option-content';
    card.style.display = 'flex';
    card.style.justifyContent = 'space-between';
    card.style.alignItems = 'center';
    card.style.padding = '10px 14px';
    card.style.border = '1.5px solid var(--border)';
    card.style.borderRadius = '8px';
    card.style.background = 'var(--bg)';
    
    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-weight: bold; color: var(--primary); font-size: 14px;">#${idx + 1}</span>
        <div style="display: flex; flex-direction: column;">
          <strong style="font-size: 13px; color: var(--text);">${item.label}</strong>
          <span style="font-size: 10px; color: var(--text-muted);">${item.desc}</span>
        </div>
      </div>
      <div style="display: flex; gap: 4px;">
        <button type="button" class="btn secondary btn-swap-up" style="padding: 4px 8px; font-size: 11px;" ${idx === 0 ? 'disabled' : ''}>▲</button>
        <button type="button" class="btn secondary btn-swap-down" style="padding: 4px 8px; font-size: 11px;" ${idx === priorities.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
    `;

    // Swap Up handler
    card.querySelector('.btn-swap-up').addEventListener('click', (e) => {
      e.stopPropagation();
      if (idx > 0) {
        const temp = priorities[idx];
        priorities[idx] = priorities[idx - 1];
        priorities[idx - 1] = temp;
        renderPrioritiesList();
      }
    });

    // Swap Down handler
    card.querySelector('.btn-swap-down').addEventListener('click', (e) => {
      e.stopPropagation();
      if (idx < priorities.length - 1) {
        const temp = priorities[idx];
        priorities[idx] = priorities[idx + 1];
        priorities[idx + 1] = temp;
        renderPrioritiesList();
      }
    });

    listContainer.appendChild(card);
  });
}

function populateAdaptiveSlide4() {
  const slide4 = document.getElementById('quiz-slide-4');
  if (!slide4) return;
  slide4.innerHTML = '';

  // Get current country selection
  const selectedCountryRadio = quizForm.querySelector('input[name="q-current-country"]:checked');
  const countryName = selectedCountryRadio ? selectedCountryRadio.value : "United States";
  
  // Find country metrics in currentRankings
  const countryData = currentRankings.find(item => item.location && item.location.name === countryName);
  
  let costOfLiving = 5;
  let warmWeather = 5;
  if (countryData && countryData.location && countryData.location.metrics) {
    const metrics = countryData.location.metrics;
    costOfLiving = metrics.cost_of_living !== undefined ? metrics.cost_of_living : 5;
    warmWeather = metrics.warm_weather !== undefined ? metrics.warm_weather : 5;
  }

  // Create adaptive question HTML based on selected country's metrics
  let questionHTML = '';
  if (costOfLiving >= 7) {
    questionHTML += `
      <h3 class="quiz-question">You currently live in ${countryName}, which has a relatively high cost of living. What is your priority for your next destination?</h3>
      <div class="quiz-options">
        <label class="quiz-option-card">
          <input type="radio" name="q-adaptive-financial" value="reduce_cost" checked>
          <div class="option-content">
            <span class="option-icon">📉</span>
            <div class="option-details">
              <strong>Drastically Reduce Costs</strong>
              <span>I want a much lower cost of living to boost my savings and purchasing power.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-adaptive-financial" value="infra_priority">
          <div class="option-content">
            <span class="option-icon">🏥</span>
            <div class="option-details">
              <strong>Quality Over Savings</strong>
              <span>I'm willing to pay for top-tier infrastructure, safety, and public services regardless of cost.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-adaptive-financial" value="tax_opt">
          <div class="option-content">
            <span class="option-icon">📊</span>
            <div class="option-details">
              <strong>Minimize Taxes Above All</strong>
              <span>My priority is a low tax burden and business-friendly regulations.</span>
            </div>
          </div>
        </label>
      </div>
    `;
  } else {
    questionHTML += `
      <h3 class="quiz-question">You live in ${countryName}, which is relatively affordable. What is your primary objective regarding finances?</h3>
      <div class="quiz-options">
        <label class="quiz-option-card">
          <input type="radio" name="q-adaptive-financial" value="keep_ultra_low" checked>
          <div class="option-content">
            <span class="option-icon">🪙</span>
            <div class="option-details">
              <strong>Keep Costs Ultra-Low</strong>
              <span>I want to live in the most budget-friendly countries possible.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-adaptive-financial" value="job_potential">
          <div class="option-content">
            <span class="option-icon">📈</span>
            <div class="option-details">
              <strong>Earning & Career Potential</strong>
              <span>I'm moving to access high-wage job markets and better corporate environments.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-adaptive-financial" value="balanced_life">
          <div class="option-content">
            <span class="option-icon">⚖️</span>
            <div class="option-details">
              <strong>Balanced Infrastructure</strong>
              <span>A moderate cost of living but with strong public healthcare, transit, and services.</span>
            </div>
          </div>
        </label>
      </div>
    `;
  }

  // Next, append climate adaptive question
  if (warmWeather >= 7) {
    questionHTML += `
      <h3 class="quiz-question" style="margin-top: 20px;">${countryName} is a warm climate country. What weather profile are you looking for next?</h3>
      <div class="quiz-options">
        <label class="quiz-option-card">
          <input type="radio" name="q-adaptive-climate" value="keep_warm" checked>
          <div class="option-content">
            <span class="option-icon">☀️</span>
            <div class="option-details">
              <strong>Keep it Warm / Sunny</strong>
              <span>I love warm climates and want to remain in a sunny, tropical or coastal setting.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-adaptive-climate" value="escape_heat">
          <div class="option-content">
            <span class="option-icon">❄️</span>
            <div class="option-details">
              <strong>Escape the Heat / Seasonal variety</strong>
              <span>I prefer distinct seasonal changes, cooler weather, or mountain snow.</span>
            </div>
          </div>
        </label>
      </div>
    `;
  } else {
    questionHTML += `
      <h3 class="quiz-question" style="margin-top: 20px;">${countryName} has a cool or seasonal climate. What weather profile do you prefer next?</h3>
      <div class="quiz-options">
        <label class="quiz-option-card">
          <input type="radio" name="q-adaptive-climate" value="escape_cold" checked>
          <div class="option-content">
            <span class="option-icon">☀️</span>
            <div class="option-details">
              <strong>Escape the Cold / Year-round Warmth</strong>
              <span>I want to move to a hot, sunny country with high sunshine hours and beaches.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-adaptive-climate" value="keep_cool">
          <div class="option-content">
            <span class="option-icon">⛰️</span>
            <div class="option-details">
              <strong>Enjoy Four Seasons / Mountain topographies</strong>
              <span>I enjoy mild weather, seasonal changes, or colder mountain/forest climates.</span>
            </div>
          </div>
        </label>
      </div>
    `;
  }

  slide4.innerHTML = questionHTML;
}

function attachCountrySearch() {
  const searchBox = document.getElementById('quiz-country-search');
  if (!searchBox) return;

  searchBox.addEventListener('input', () => {
    const query = searchBox.value.toLowerCase().trim();
    const cards = document.querySelectorAll('#quiz-country-options .quiz-option-card');
    cards.forEach(card => {
      const label = card.querySelector('strong')?.textContent?.toLowerCase() || '';
      const match = !query || label.includes(query);
      card.style.display = match ? '' : 'none';
    });
  });
}

function showQuizSlide(slideNumber) {
  console.log(`Navigating to quiz slide ${slideNumber}`);
  const slides = document.querySelectorAll(".quiz-slide");
  slides.forEach(slide => {
    slide.hidden = true;
  });

  const target = document.getElementById(`quiz-slide-${slideNumber}`);
  if (target) {
    target.hidden = false;
  }

  // Populate dynamic slides on entry
  if (slideNumber === 3) {
    renderPrioritiesList();
  } else if (slideNumber === 4) {
    populateAdaptiveSlide4();
  }

  const percent = (slideNumber / totalQuizSlides) * 100;
  quizProgress.style.width = `${percent}%`;

  quizPrevBtn.disabled = slideNumber === 1;
  quizNextBtn.textContent = slideNumber === totalQuizSlides ? "Finish" : "Next";
}

function finishQuizAndSetPersona() {
  const formData = new FormData(quizForm);

  const goal = formData.get("q-goal") || "nomad"; // nomad, family, entrepreneur, phd
  const currentCountry = formData.get("q-current-country") || "";
  const financialPref = formData.get("q-adaptive-financial") || "";
  const climatePref = formData.get("q-adaptive-climate") || "";
  const langPref = formData.get("q-lang-pref") || "english_barrier";
  const visaPref = formData.get("q-visa-pref") || "nomad";

  // 1. Apply base persona preset
  activePersona = goal;
  const preset = PERSONA_PRESETS[activePersona];
  if (!preset) {
    // Fallback: reset all to Custom defaults
    for (const key of Object.keys(ALL_METRIC_TYPES)) {
      const isAdvanced = key in ADVANCED_METRIC_SECTIONS;
      const targetImp = isAdvanced ? 0 : 6;
      const slider = document.getElementById(`pref-${key}`);
      if (slider) slider.value = 5;
      const radio = document.getElementById(`imp-${key}-${targetImp}`);
      if (radio) radio.checked = true;
    }
  } else {
    // Apply base preset values
    for (const [key, type] of Object.entries(ALL_METRIC_TYPES)) {
      const isAdvanced = key in ADVANCED_METRIC_SECTIONS;
      const slider = document.getElementById(`pref-${key}`);
      if (slider) {
        let val = 5;
        if (preset.metrics[key] && preset.metrics[key].value !== undefined) {
          val = preset.metrics[key].value;
        }
        slider.value = val;
        const display = document.getElementById(`val-${key}`);
        if (display) display.textContent = val;
      }
      let imp = isAdvanced ? 0 : 6;
      if (preset.metrics[key] && preset.metrics[key].importance !== undefined) {
        imp = preset.metrics[key].importance;
      }
      const radio = document.getElementById(`imp-${key}-${imp}`);
      if (radio) radio.checked = true;
    }
    // Set active section toggles
    for (const [toggleId, checked] of Object.entries(preset.toggles)) {
      const toggleEl = document.getElementById(toggleId);
      if (toggleEl) {
        toggleEl.checked = checked;
        const sectionId = toggleId.replace("toggle-", "adv-");
        const container = document.getElementById(sectionId);
        if (container) container.hidden = !checked;
      }
    }
  }

  // 2. Set Priorities based on the user's reordering (Slide 3)
  // Rank 1 & 2 -> High (10). Rank 3 -> Med (6). Rank 4 -> Low (3). Rank 5 -> Off (0).
  const priorityCategoryMetrics = {
    cost_tax: ["cost_of_living", "housing_affordability", "tax_burden", "childcare_education_cost", "dining_food_cost"],
    climate_nature: ["warm_weather", "seasonal_variety", "nature_mountains", "nature_lakes_rivers", "nature_sea_beaches", "nature_forests_greenery", "humidity_level", "air_quality", "sunshine_hours"],
    safety_health: ["safety", "healthcare_quality", "air_quality", "happiness_index"],
    work_business: ["internet_speed", "local_job_market", "ease_of_doing_business", "road_quality"],
    culture_lifestyle: ["pace_of_life", "english_barrier", "social_tolerance", "bureaucracy_difficulty", "foreigner_friendliness"]
  };

  const rankImportances = [10, 10, 6, 3, 0];
  priorities.forEach((priorityItem, index) => {
    const targetImp = rankImportances[index];
    const metricsToSet = priorityCategoryMetrics[priorityItem.key] || [];
    metricsToSet.forEach(metric => {
      // If setting an advanced metric to active (imp > 0), enable its advanced section toggle first!
      if (targetImp > 0 && metric in ADVANCED_METRIC_SECTIONS) {
        const toggleId = ADVANCED_METRIC_SECTIONS[metric];
        const toggleEl = document.getElementById(toggleId);
        if (toggleEl) {
          toggleEl.checked = true;
          const sectionId = toggleId.replace("toggle-", "adv-");
          const container = document.getElementById(sectionId);
          if (container) container.hidden = false;
        }
      }
      const radio = document.getElementById(`imp-${metric}-${targetImp}`);
      if (radio) {
        radio.checked = true;
      }
    });
  });

  // 3. Adaptive Financial Adjustments (Slide 4)
  if (financialPref === "reduce_cost") {
    const slider = document.getElementById("pref-cost_of_living");
    if (slider) {
      slider.value = 2; // low cost of living is good
      const display = document.getElementById("val-cost_of_living");
      if (display) display.textContent = 2;
    }
    const colRadio = document.getElementById("imp-cost_of_living-10");
    if (colRadio) colRadio.checked = true;
    const housingRadio = document.getElementById("imp-housing_affordability-10");
    if (housingRadio) housingRadio.checked = true;
  } else if (financialPref === "infra_priority") {
    const colRadio = document.getElementById("imp-cost_of_living-0");
    if (colRadio) colRadio.checked = true;
    const healthRadio = document.getElementById("imp-healthcare_quality-10");
    if (healthRadio) healthRadio.checked = true;
    const healthSlider = document.getElementById("pref-healthcare_quality");
    if (healthSlider) {
      healthSlider.value = 9;
      const display = document.getElementById("val-healthcare_quality");
      if (display) display.textContent = 9;
    }
  } else if (financialPref === "tax_opt") {
    const slider = document.getElementById("pref-tax_burden");
    if (slider) {
      slider.value = 2; // low tax burden
      const display = document.getElementById("val-tax_burden");
      if (display) display.textContent = 2;
    }
    const radio = document.getElementById("imp-tax_burden-10");
    if (radio) radio.checked = true;
  } else if (financialPref === "keep_ultra_low") {
    const slider = document.getElementById("pref-cost_of_living");
    if (slider) {
      slider.value = 1;
      const display = document.getElementById("val-cost_of_living");
      if (display) display.textContent = 1;
    }
    const radio = document.getElementById("imp-cost_of_living-10");
    if (radio) radio.checked = true;
  } else if (financialPref === "job_potential") {
    // Enable infrastructure_work advanced section if local_job_market is used
    const toggleEl = document.getElementById("toggle-infrastructure_work");
    if (toggleEl) {
      toggleEl.checked = true;
      const container = document.getElementById("adv-infrastructure_work");
      if (container) container.hidden = false;
    }
    const radio = document.getElementById("imp-local_job_market-10");
    if (radio) radio.checked = true;
    const slider = document.getElementById("pref-local_job_market");
    if (slider) {
      slider.value = 8;
      const display = document.getElementById("val-local_job_market");
      if (display) display.textContent = 8;
    }
  } else if (financialPref === "balanced_life") {
    const slider = document.getElementById("pref-cost_of_living");
    if (slider) {
      slider.value = 5;
      const display = document.getElementById("val-cost_of_living");
      if (display) display.textContent = 5;
    }
    const colRadio = document.getElementById("imp-cost_of_living-6");
    if (colRadio) colRadio.checked = true;
    const healthRadio = document.getElementById("imp-healthcare_quality-10");
    if (healthRadio) healthRadio.checked = true;
  }

  // 4. Adaptive Climate Adjustments (Slide 4)
  if (climatePref === "keep_warm" || climatePref === "escape_cold") {
    const slider = document.getElementById("pref-warm_weather");
    if (slider) {
      slider.value = 9;
      const display = document.getElementById("val-warm_weather");
      if (display) display.textContent = 9;
    }
    const radio = document.getElementById("imp-warm_weather-10");
    if (radio) radio.checked = true;
  } else if (climatePref === "escape_heat" || climatePref === "keep_cool") {
    const slider = document.getElementById("pref-warm_weather");
    if (slider) {
      slider.value = 2; // cool weather
      const display = document.getElementById("val-warm_weather");
      if (display) display.textContent = 2;
    }
    const radio = document.getElementById("imp-warm_weather-10");
    if (radio) radio.checked = true;
    const varietyRadio = document.getElementById("imp-seasonal_variety-10");
    if (varietyRadio) varietyRadio.checked = true;
  }

  // 5. Language Preference Adjustments (Slide 5)
  if (langPref === "english_barrier") {
    const slider = document.getElementById("pref-english_barrier");
    if (slider) {
      slider.value = 9; // High English level preferred
      const display = document.getElementById("val-english_barrier");
      if (display) display.textContent = 9;
    }
    const radio = document.getElementById("imp-english_barrier-10");
    if (radio) radio.checked = true;
  } else if (langPref === "willing_basic") {
    const slider = document.getElementById("pref-english_barrier");
    if (slider) {
      slider.value = 5;
      const display = document.getElementById("val-english_barrier");
      if (display) display.textContent = 5;
    }
    const radio = document.getElementById("imp-english_barrier-3");
    if (radio) radio.checked = true;
  } else if (langPref === "immersion") {
    const radio = document.getElementById("imp-english_barrier-0");
    if (radio) radio.checked = true;
  }

  // 6. Visa Preference Adjustments (Slide 6)
  if (visaPref === "nomad") {
    const radio = document.getElementById("imp-visa_difficulty-10");
    if (radio) radio.checked = true;
    const speedRadio = document.getElementById("imp-internet_speed-10");
    if (speedRadio) speedRadio.checked = true;
  } else if (visaPref === "corporate") {
    const radio = document.getElementById("imp-visa_difficulty-6");
    if (radio) radio.checked = true;
    // Enable infrastructure_work advanced section for local_job_market
    const toggleEl = document.getElementById("toggle-infrastructure_work");
    if (toggleEl) {
      toggleEl.checked = true;
      const container = document.getElementById("adv-infrastructure_work");
      if (container) container.hidden = false;
    }
    const jobRadio = document.getElementById("imp-local_job_market-10");
    if (jobRadio) jobRadio.checked = true;
  } else if (visaPref === "entrepreneur") {
    // Enable infrastructure_work advanced section for ease_of_doing_business
    const toggleEl = document.getElementById("toggle-infrastructure_work");
    if (toggleEl) {
      toggleEl.checked = true;
      const container = document.getElementById("adv-infrastructure_work");
      if (container) container.hidden = false;
    }
    const bizRadio = document.getElementById("imp-ease_of_doing_business-10");
    if (bizRadio) bizRadio.checked = true;
    const taxRadio = document.getElementById("imp-tax_burden-6");
    if (taxRadio) taxRadio.checked = true;
  } else if (visaPref === "family") {
    // Enable cost_visas advanced section for childcare_quality
    const toggleEl = document.getElementById("toggle-cost_visas");
    if (toggleEl) {
      toggleEl.checked = true;
      const container = document.getElementById("adv-cost_visas");
      if (container) container.hidden = false;
    }
    const childRadio = document.getElementById("imp-childcare_quality-10");
    if (childRadio) childRadio.checked = true;
    const safetyRadio = document.getElementById("imp-safety-10");
    if (safetyRadio) safetyRadio.checked = true;
  }

  // 7. Update presets button highlights & recalculate
  setActivePersonaButton(activePersona);
  updateCompatibility();
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
