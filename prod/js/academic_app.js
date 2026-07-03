// -*- coding: utf-8 -*-
/**
 * Academic & Research Group Explorer - Front-End Logic
 */

// Metric types matching engine_academic.py
const ALL_METRIC_KEYS = [
  "academic_reputation", "research_funding", "undergrad_experience", "phd_stipend_ppp",
  "research_freedom", "work_life_balance", "publication_output", "industry_collaboration",
  "local_infrastructure", "visa_ease_academic"
];

// Presets Configurations
const PERSONA_PRESETS = {
  undergrad: {
    metrics: {
      "academic_reputation": { importance: 10 },
      "undergrad_experience": { importance: 10 },
      "work_life_balance": { importance: 10 },
      "local_infrastructure": { importance: 6 }
    }
  },
  phd: {
    metrics: {
      "phd_stipend_ppp": { importance: 10 },
      "research_funding": { importance: 10 },
      "publication_output": { importance: 10 },
      "local_infrastructure": { importance: 6 },
      "academic_reputation": { importance: 6 }
    }
  },
  researcher: {
    metrics: {
      "research_freedom": { importance: 10 },
      "research_funding": { importance: 10 },
      "academic_reputation": { importance: 10 },
      "publication_output": { importance: 10 },
      "local_infrastructure": { importance: 6 }
    }
  }
};

// Application State
let activeLocationId = null; // References university or group ID
let currentRankings = [];    // Universities and groups returned by backend
let rankingMode = "university"; // "university" or "group"
let visibleCount = 15;
let activePersona = "custom";
let updateTimeout = null;

// DOM Elements
const form = document.getElementById("preferences-form");
const resultsList = document.getElementById("results-list");
const resultsCount = document.getElementById("results-count");
const detailsPanel = document.getElementById("details-panel");
const searchInput = document.getElementById("search-country");
const scoreFilter = document.getElementById("filter-score"); // Used for Discipline Filter on Academic page
const tabCountry = document.getElementById("tab-country");   // Used for "Universities" tab
const tabCity = document.getElementById("tab-city");         // Used for "Research Groups" tab
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

// Load academic domain hierarchy for adaptive quiz and discipline filter
let academicDomains = {};
let academicDomainsLoaded = false;

// Emoji icons for each discipline in the full domain list
const DISCIPLINE_ICONS = {
  'Mathematics': '🧮', 'Physics': '⚛️', 'Chemistry': '🧪', 'Earth Sciences': '🌍',
  'Geography': '🗺️', 'Ecology': '🌿', 'Oceanography': '🌊', 'Atmospheric Science': '🌤️',
  'Computer Science & Engineering': '💻', 'Electrical & Electronic Engineering': '⚡',
  'Mechanical Engineering': '⚙️', 'Materials Science': '🔩', 'Civil & Structural Engineering': '🏗️',
  'Chemical Engineering': '🏭', 'Energy Science': '🔋', 'Environmental Engineering': '♻️',
  'Biological Sciences': '🧬', 'Human Biological Sciences': '🫀', 'Agricultural Sciences': '🌾',
  'Veterinary Sciences': '🐾', 'Clinical Medicine': '🩺', 'Public Health': '🏥',
  'Pharmacy & Pharmaceutical Sciences': '💊', 'Dentistry & Oral Sciences': '🦷', 'Nursing': '👩‍⚕️',
  'Medical Technology': '🔬', 'Economics & Finance': '📊', 'Psychology': '🧠',
  'Political Sciences': '🏛️', 'Law': '⚖️', 'Sociology': '👥',
  'Business & Management': '💼', 'Education': '📖', 'Communication': '📡',
  'Library & Information Science': '📚', 'Languages & Linguistics': '🗣️', 'History': '📜',
  'Philosophy': '💭', 'Literature': '✍️', 'Fine Arts': '🎨', 'Performing Arts': '🎭',
  'Architecture & Design': '🏛️', 'Theology & Religious Studies': '✝️'
};

// Category icons for collapsible headers
const CATEGORY_ICONS = {
  'Natural Sciences': '🔬', 'Engineering & Technology': '⚙️', 'Life Sciences': '🧬',
  'Medical Sciences': '🩺', 'Social Sciences': '📊', 'Arts & Humanities (Extended Domain)': '🎨'
};

fetch('data/academic_domains.json')
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
}

/**
 * Populate the discipline filter dropdown with all disciplines from academic_domains.json
 */
function populateDisciplineFilter() {
  if (!scoreFilter || !academicDomainsLoaded) return;
  // Keep the "Show all disciplines" option, clear the rest
  const allOption = scoreFilter.querySelector('option[value="all"]');
  scoreFilter.innerHTML = '';
  scoreFilter.appendChild(allOption);

  for (const [category, disciplines] of Object.entries(academicDomains)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = category;
    for (const discName of Object.keys(disciplines)) {
      const opt = document.createElement('option');
      opt.value = discName;
      opt.textContent = discName;
      optgroup.appendChild(opt);
    }
    scoreFilter.appendChild(optgroup);
  }
}

/**
 * Build all 6 quiz slides dynamically into the container.
 */
function buildQuizSlides() {
  const container = document.getElementById('quiz-slide-container');
  if (!container) return;
  container.innerHTML = '';

  // --- Slide 1: Career Level ---
  container.insertAdjacentHTML('beforeend', `
    <div class="quiz-slide" id="quiz-slide-1">
      <h3 class="quiz-question">What is your academic career level?</h3>
      <div class="quiz-options">
        <label class="quiz-option-card">
          <input type="radio" name="q-level" value="undergrad" checked>
          <div class="option-content">
            <span class="option-icon">🎓</span>
            <div class="option-details">
              <strong>Undergrad / Master's Student</strong>
              <span>I want high teaching quality, good classes, and lively student activities.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-level" value="phd">
          <div class="option-content">
            <span class="option-icon">🔬</span>
            <div class="option-details">
              <strong>PhD Candidate</strong>
              <span>I want good stipends, solid lab funding, and high publication output.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-level" value="researcher">
          <div class="option-content">
            <span class="option-icon">🧠</span>
            <div class="option-details">
              <strong>Postdoc / Senior Researcher</strong>
              <span>I seek high academic reputation, research freedom, and lab resources.</span>
            </div>
          </div>
        </label>
      </div>
    </div>
  `);

  // --- Slide 2: Primary Discipline (full list from domains JSON, organized by category) ---
  let disciplineHTML = '';
  let firstDisc = true;
  for (const [category, disciplines] of Object.entries(academicDomains)) {
    const catIcon = CATEGORY_ICONS[category] || '📂';
    const catId = category.replace(/[^a-zA-Z0-9]/g, '_');
    disciplineHTML += `
      <div class="quiz-category-group">
        <button type="button" class="quiz-category-header" data-cat="${catId}" aria-expanded="true">
          <span>${catIcon} ${category}</span>
          <span class="quiz-cat-chevron">▾</span>
        </button>
        <div class="quiz-category-items" id="quiz-cat-${catId}">
    `;
    for (const discName of Object.keys(disciplines)) {
      const icon = DISCIPLINE_ICONS[discName] || '📄';
      const subCount = disciplines[discName].length;
      disciplineHTML += `
        <label class="quiz-option-card quiz-option-compact">
          <input type="radio" name="q-disc" value="${discName}" ${firstDisc ? 'checked' : ''}>
          <div class="option-content">
            <span class="option-icon">${icon}</span>
            <div class="option-details">
              <strong>${discName}</strong>
              <span>${subCount} sub-domain${subCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </label>
      `;
      firstDisc = false;
    }
    disciplineHTML += `</div></div>`;
  }

  container.insertAdjacentHTML('beforeend', `
    <div class="quiz-slide" id="quiz-slide-2" hidden>
      <h3 class="quiz-question">What is your primary discipline?</h3>
      <div class="quiz-disc-search-wrap">
        <input type="text" id="quiz-disc-search" class="quiz-disc-search" placeholder="Search disciplines..." aria-label="Search disciplines">
      </div>
      <div class="quiz-options quiz-options-scrollable">
        ${disciplineHTML}
      </div>
    </div>
  `);

  // --- Slide 3: Sub-Domain (dynamically populated) ---
  container.insertAdjacentHTML('beforeend', `
    <div class="quiz-slide" id="quiz-slide-3" hidden>
      <h3 class="quiz-question">Which sub-domain interests you most?</h3>
      <div class="quiz-options quiz-options-scrollable" id="quiz-subdomain-options">
        <!-- Populated dynamically based on slide 2 selection -->
      </div>
    </div>
  `);

  // --- Slide 4: What matters most? ---
  container.insertAdjacentHTML('beforeend', `
    <div class="quiz-slide" id="quiz-slide-4" hidden>
      <h3 class="quiz-question">What matters most to you in a research environment?</h3>
      <div class="quiz-options">
        <label class="quiz-option-card">
          <input type="radio" name="q-priority" value="funding" checked>
          <div class="option-content">
            <span class="option-icon">💰</span>
            <div class="option-details">
              <strong>Research Funding</strong>
              <span>Large grants, lab budgets, and well-funded positions.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-priority" value="freedom">
          <div class="option-content">
            <span class="option-icon">🗽</span>
            <div class="option-details">
              <strong>Academic Freedom</strong>
              <span>Autonomy to choose topics and explore without micromanagement.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-priority" value="prestige">
          <div class="option-content">
            <span class="option-icon">🏆</span>
            <div class="option-details">
              <strong>University Prestige</strong>
              <span>Top-ranked institutions with strong global reputation.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-priority" value="balance">
          <div class="option-content">
            <span class="option-icon">⚖️</span>
            <div class="option-details">
              <strong>Work-Life Balance</strong>
              <span>Reasonable hours, low stress, and a healthy research culture.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-priority" value="publications">
          <div class="option-content">
            <span class="option-icon">📄</span>
            <div class="option-details">
              <strong>Publication Output</strong>
              <span>High-impact journals and strong publishing track record.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-priority" value="industry">
          <div class="option-content">
            <span class="option-icon">🏢</span>
            <div class="option-details">
              <strong>Industry Connections</strong>
              <span>Patents, spin-offs, and collaborative corporate research.</span>
            </div>
          </div>
        </label>
      </div>
    </div>
  `);

  // --- Slide 5: Geographic Preference ---
  container.insertAdjacentHTML('beforeend', `
    <div class="quiz-slide" id="quiz-slide-5" hidden>
      <h3 class="quiz-question">Do you have a geographic preference?</h3>
      <div class="quiz-options">
        <label class="quiz-option-card">
          <input type="radio" name="q-geo" value="any" checked>
          <div class="option-content">
            <span class="option-icon">🌍</span>
            <div class="option-details">
              <strong>Open to Anywhere</strong>
              <span>I'll go wherever the best opportunity is.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-geo" value="europe">
          <div class="option-content">
            <span class="option-icon">🇪🇺</span>
            <div class="option-details">
              <strong>Prefer Europe</strong>
              <span>EU funding, Erasmus networks, and strong public universities.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-geo" value="north_america">
          <div class="option-content">
            <span class="option-icon">🇺🇸</span>
            <div class="option-details">
              <strong>Prefer North America</strong>
              <span>NSF/NIH grants, Ivy League, and top research universities.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-geo" value="asia_pacific">
          <div class="option-content">
            <span class="option-icon">🌏</span>
            <div class="option-details">
              <strong>Prefer Asia-Pacific</strong>
              <span>Rising research powerhouses in China, Japan, South Korea, and Australia.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-geo" value="stay_region">
          <div class="option-content">
            <span class="option-icon">🏠</span>
            <div class="option-details">
              <strong>Prefer Staying in My Region</strong>
              <span>I'd like to remain close to home for personal reasons.</span>
            </div>
          </div>
        </label>
      </div>
    </div>
  `);

  // --- Slide 6: Visa Importance ---
  container.insertAdjacentHTML('beforeend', `
    <div class="quiz-slide" id="quiz-slide-6" hidden>
      <h3 class="quiz-question">How important is visa ease for your move?</h3>
      <div class="quiz-options">
        <label class="quiz-option-card">
          <input type="radio" name="q-visa" value="critical" checked>
          <div class="option-content">
            <span class="option-icon">🛂</span>
            <div class="option-details">
              <strong>Critical — I need easy visa processing</strong>
              <span>I'm an international applicant and visa complexity is a major concern.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-visa" value="important">
          <div class="option-content">
            <span class="option-icon">📋</span>
            <div class="option-details">
              <strong>Important but Not a Dealbreaker</strong>
              <span>I'd prefer easy processing but will manage complex cases.</span>
            </div>
          </div>
        </label>
        <label class="quiz-option-card">
          <input type="radio" name="q-visa" value="not_concern">
          <div class="option-content">
            <span class="option-icon">✅</span>
            <div class="option-details">
              <strong>Not a Concern</strong>
              <span>I'm a domestic applicant or have no visa issues.</span>
            </div>
          </div>
        </label>
      </div>
    </div>
  `);

  // Attach category collapse/expand handlers for slide 2
  attachCategoryToggles();
  // Attach discipline search handler for slide 2
  attachDisciplineSearch();
}

/**
 * Wire up collapsible category headers in the discipline slide
 */
function attachCategoryToggles() {
  const headers = document.querySelectorAll('.quiz-category-header');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const catId = header.getAttribute('data-cat');
      const items = document.getElementById(`quiz-cat-${catId}`);
      const isExpanded = header.getAttribute('aria-expanded') === 'true';
      header.setAttribute('aria-expanded', !isExpanded);
      items.hidden = isExpanded;
      header.querySelector('.quiz-cat-chevron').textContent = isExpanded ? '▸' : '▾';
    });
  });
}

/**
 * Wire up the discipline search box for live filtering
 */
function attachDisciplineSearch() {
  const searchBox = document.getElementById('quiz-disc-search');
  if (!searchBox) return;
  searchBox.addEventListener('input', () => {
    const query = searchBox.value.toLowerCase().trim();
    const groups = document.querySelectorAll('.quiz-category-group');
    groups.forEach(group => {
      const header = group.querySelector('.quiz-category-header');
      const items = group.querySelectorAll('.quiz-option-compact');
      let anyVisible = false;
      items.forEach(item => {
        const label = item.querySelector('strong')?.textContent?.toLowerCase() || '';
        const match = !query || label.includes(query);
        item.style.display = match ? '' : 'none';
        if (match) anyVisible = true;
      });
      group.style.display = anyVisible ? '' : 'none';
      // Auto-expand categories that match when searching
      if (query && anyVisible) {
        header.setAttribute('aria-expanded', 'true');
        const catId = header.getAttribute('data-cat');
        const container = document.getElementById(`quiz-cat-${catId}`);
        if (container) container.hidden = false;
        header.querySelector('.quiz-cat-chevron').textContent = '▾';
      }
    });
  });
}

/**
 * Populate sub-domain options for slide 3 based on the selected discipline from slide 2
 */
function populateSubDomainSlide() {
  const selectedDisc = quizForm.querySelector('input[name="q-disc"]:checked');
  if (!selectedDisc) return;
  const discName = selectedDisc.value;
  const container = document.getElementById('quiz-subdomain-options');
  if (!container) return;
  container.innerHTML = '';

  // Find the sub-domains for the selected discipline
  let subDomains = [];
  for (const [_category, disciplines] of Object.entries(academicDomains)) {
    if (disciplines[discName]) {
      subDomains = disciplines[discName];
      break;
    }
  }

  if (subDomains.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">No sub-domains available for this discipline.</p>';
    return;
  }

  subDomains.forEach((sub, idx) => {
    container.insertAdjacentHTML('beforeend', `
      <label class="quiz-option-card quiz-option-compact">
        <input type="radio" name="q-sub" value="${sub}" ${idx === 0 ? 'checked' : ''}>
        <div class="option-content">
          <span class="option-icon">🔬</span>
          <div class="option-details">
            <strong>${sub}</strong>
            <span>Specialised interest in ${sub.toLowerCase()}.</span>
          </div>
        </div>
      </label>
    `);
  });
}

let academicEntities = [];
let academicEntitiesLoaded = false;

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
});

/**
 * Sets up event listeners.
 */
function setupEventListeners() {
  // 1. Listen for importance change on radios
  const radios = form.querySelectorAll("input[type='radio']");
  radios.forEach(radio => {
    radio.addEventListener("change", () => {
      activePersona = "custom";
      setActivePersonaButton("custom");
      debouncedUpdateCompatibility();
    });
  });

  // 2. Search and Filter input listeners
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

  // 3. Tab Swapping (Universities vs Research Groups)
  tabCountry.addEventListener("click", () => {
    if (rankingMode !== "university") {
      rankingMode = "university";
      tabCountry.classList.add("active");
      tabCountry.setAttribute("aria-selected", "true");
      tabCity.classList.remove("active");
      tabCity.setAttribute("aria-selected", "false");
      rankingsTitle.textContent = "University Rankings";
      visibleCount = 15;
      renderRankingsList();
      autoSelectOnFilterChange();
    }
  });

  tabCity.addEventListener("click", () => {
    if (rankingMode !== "group") {
      rankingMode = "group";
      tabCity.classList.add("active");
      tabCity.setAttribute("aria-selected", "true");
      tabCountry.classList.remove("active");
      tabCountry.setAttribute("aria-selected", "false");
      rankingsTitle.textContent = "Research Group Rankings";
      visibleCount = 15;
      renderRankingsList();
      autoSelectOnFilterChange();
    }
  });

  // 4. Presets buttons
  const personaBtns = document.querySelectorAll(".persona-btn");
  personaBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const persona = btn.getAttribute("data-persona");
      setActivePersonaButton(persona);
      applyPersonaPreset(persona);
    });
  });

  // 5. Info help boxes
  const infoBtns = form.querySelectorAll(".info-btn");
  infoBtns.forEach(btn => {
    const metricId = btn.getAttribute("data-info");
    const infoBox = document.getElementById(`info-${metricId}`);

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = infoBox.hidden;
      infoBox.hidden = !isHidden;
      btn.classList.toggle("active", isHidden);
    });
  });

  // 6. Quiz Trigger & Controls
  if (openQuizBtn) {
    openQuizBtn.addEventListener("click", () => {
      if (!academicDomainsLoaded) {
        console.warn('Domains not loaded yet, retrying in 300ms...');
        setTimeout(() => openQuizBtn.click(), 300);
        return;
      }
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
    quizModal.addEventListener("click", (e) => {
      if (e.target === quizModal) {
        quizModal.setAttribute("hidden", "true");
      }
    });
  }

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
 * Extracts inputs from form.
 */
function getPreferences() {
  const preferences = {};
  for (const key of ALL_METRIC_KEYS) {
    let importance = 0;
    const checkedRadio = form.querySelector(`input[name="imp-${key}"]:checked`);
    if (checkedRadio) {
      importance = Number(checkedRadio.value);
    }
    // All are maximize metrics, value is set to 10
    preferences[key] = { value: 10, importance };
  }
  return preferences;
}

/**
 * Fetch rankings from backend.
 */
function updateCompatibility() {
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
}

/**
 * Filter rankings list based on search, tabs, and discipline.
 */
function getFilteredRankings() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const discFilter = scoreFilter.value; // Dropdown value: "all", "Physics", "Mathematics", etc.

  return currentRankings.filter(item => {
    const ent = item.location;
    if (ent.type !== rankingMode) return false;

    // Search query check
    if (searchTerm) {
      const name = ent.name.toLowerCase();
      const fullName = ent.fullName.toLowerCase();
      if (!name.includes(searchTerm) && !fullName.includes(searchTerm)) {
        return false;
      }
    }

    // Discipline Filter check
    if (discFilter !== "all") {
      if (rankingMode === "group") {
        if (ent.discipline !== discFilter) return false;
      } else {
        // University mode: show only universities hosting a group of that discipline
        const hasMatchingGroup = currentRankings.some(other => 
          other.location.type === "group" && 
          other.location.parentId === ent.id && 
          other.location.discipline === discFilter
        );
        if (!hasMatchingGroup) return false;
      }
    }

    return true;
  });
}

function autoSelectOnFilterChange() {
  const filtered = getFilteredRankings();
  const stillVisible = filtered.some(item => item.location.id === activeLocationId);
  if (!stillVisible && filtered.length > 0) {
    selectLocation(filtered[0].location.id);
  }
}

function selectLocation(locationId) {
  activeLocationId = locationId;
  renderRankingsList();
  renderDetails(locationId);
  detailsPanel.scrollTop = 0;
}

/**
 * Renders rankings in the sidebar.
 */
function renderRankingsList() {
  resultsList.innerHTML = "";
  
  const filtered = getFilteredRankings();
  const totalInMode = currentRankings.filter(item => item.location.type === rankingMode).length;
  resultsCount.textContent = `Matches: ${filtered.length} / ${totalInMode}`;

  const itemsToRender = filtered.slice(0, visibleCount);

  itemsToRender.forEach((item, index) => {
    const ent = item.location;
    const rank = index + 1;
    const score = item.score;
    const isActive = ent.id === activeLocationId;

    const card = document.createElement("article");
    card.className = `country-card ${isActive ? "active" : ""}`;
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-selected", isActive ? "true" : "false");
    
    let matchClass = "match-low";
    if (score >= 80) matchClass = "match-high";
    else if (score >= 55) matchClass = "match-medium";

    card.innerHTML = `
      <div class="card-rank">${rank}</div>
      <div class="card-info">
        <h3 class="card-name">${ent.name}</h3>
        <p class="card-meta">${ent.cityName}, ${ent.countryName}</p>
        ${ent.type === "group" ? `<span class="city-indicator">${ent.discipline} | ${ent.subDomain}</span>` : ""}
      </div>
      <div class="card-score-box">
        <span class="card-score ${matchClass}">${score}%</span>
        <span class="card-score-label">Match</span>
      </div>
    `;

    card.addEventListener("click", () => selectLocation(ent.id));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectLocation(ent.id);
      }
    });

    resultsList.appendChild(card);
  });

  // Endless scroll handler
  if (filtered.length > visibleCount) {
    const loadMoreBtn = document.createElement("button");
    loadMoreBtn.className = "load-more-btn";
    loadMoreBtn.textContent = "Show More Institutions";
    loadMoreBtn.addEventListener("click", () => {
      visibleCount += 15;
      renderRankingsList();
    });
    resultsList.appendChild(loadMoreBtn);
  }
}

/**
 * Render details in report panel.
 */
function renderDetails(locationId) {
  const rankingItem = currentRankings.find(item => item.location.id === locationId);
  if (!rankingItem) return;

  const ent = rankingItem.location;
  const score = rankingItem.score;
  const breakdown = rankingItem.breakdown;

  // Resolve overrides based on activePersona
  let summary = ent.summary;
  let overview = ent.description.overview;
  let pros = ent.description.pros;
  let cons = ent.description.cons;
  let perspectiveBadgeHTML = "";

  if (activePersona && activePersona !== "custom" && ent.personaData && ent.personaData[activePersona]) {
    summary = ent.personaData[activePersona].summary;
    overview = ent.description.overview; // Maintain overview or load persona-specific
    if (ent.personaData[activePersona].overview) {
      overview = ent.personaData[activePersona].overview;
    }
    pros = ent.personaPros[activePersona] || [];
    cons = ent.personaCons[activePersona] || [];
    
    const labelMap = {
      undergrad: "🎓 Undergrad Perspective",
      phd: "🔬 PhD Perspective",
      researcher: "🧠 Researcher Perspective"
    };
    perspectiveBadgeHTML = `<span class="perspective-badge">${labelMap[activePersona]}</span>`;
  }

  let matchClass = "match-low";
  if (score >= 80) matchClass = "match-high";
  else if (score >= 55) matchClass = "match-medium";

  // Build child groups listing if entity is a university
  let groupsHTML = "";
  if (ent.type === "university") {
    const childGroups = currentRankings.filter(item => 
      item.location.type === "group" && item.location.parentId === locationId
    );

    if (childGroups.length > 0) {
      const groupRows = childGroups.map(item => `
        <div class="detail-city-row" data-group-id="${item.location.id}" role="button" tabindex="0">
          <span class="detail-city-name">${item.location.name} (${item.location.subDomain})</span>
          <span class="detail-city-badge">${item.score}% Match</span>
        </div>
      `).join("");

      groupsHTML = `
        <section class="detail-section" aria-labelledby="detail-title-cities">
          <h3 class="detail-section-title" id="detail-title-cities">Affiliated Research Groups</h3>
          <div class="detail-cities-list">
            ${groupRows}
          </div>
        </section>
      `;
    }
  }

  // Build metric cards
  const breakdownCardsHTML = breakdown.map(item => {
    let scoreColor = "match-low";
    if (item.metricScore >= 80) scoreColor = "match-high";
    else if (item.metricScore >= 55) scoreColor = "match-medium";

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
          <span>Rating: ${item.locationValue}/10</span>
          <span>Imp: ${item.importance}</span>
        </div>
      </div>
    `;
  }).join("");

  const prosHTML = pros.map(p => `<div class="pro-con-item">${p}</div>`).join("");
  const consHTML = cons.map(c => `<div class="pro-con-item">${c}</div>`).join("");

  detailsPanel.innerHTML = `
    <header class="details-header">
      <div class="details-title">
        <h2>${ent.fullName}</h2>
        ${perspectiveBadgeHTML}
        <p class="subtitle">${summary}</p>
        <p class="detail-meta">Shanghai Academic World Rank: #${ent.shanghaiRank}</p>
      </div>
      <div class="details-score-box">
        <span class="details-percentage ${matchClass}">${score}%</span>
        <span class="details-score-label">Academic Match</span>
      </div>
    </header>

    <section class="detail-section" aria-labelledby="detail-title-overview">
      <h3 class="detail-section-title" id="detail-title-overview">Overview</h3>
      <p class="overview-text">${overview}</p>
    </section>

    ${groupsHTML}

    <section class="detail-section" aria-labelledby="detail-title-proscons">
      <h3 class="detail-section-title" id="detail-title-proscons">Key Tradeoffs</h3>
      <div class="pros-cons-grid">
        <div class="pros-list">
          <h4 class="pro-con-header pro">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Strengths
          </h4>
          ${prosHTML}
        </div>
        <div class="cons-list">
          <h4 class="pro-con-header con">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            Considerations
          </h4>
          ${consHTML}
        </div>
      </div>
    </section>

    <section class="detail-section" aria-labelledby="detail-title-visa">
      <h3 class="detail-section-title" id="detail-title-visa">Academic Visa &amp; Registration</h3>
      <div class="visa-box">
        <p>${ent.description.visaInfo}</p>
      </div>
    </section>

    <section class="detail-section" aria-labelledby="detail-title-breakdown">
      <h3 class="detail-section-title" id="detail-title-breakdown">Detailed Metrics Breakdown</h3>
      <div class="breakdown-grid">
        ${breakdownCardsHTML}
      </div>
    </section>
  `;

  // Attach click listener for affiliated groups
  if (ent.type === "university") {
    const rows = detailsPanel.querySelectorAll(".detail-city-row");
    rows.forEach(row => {
      row.addEventListener("click", () => {
        const groupId = row.getAttribute("data-group-id");
        rankingMode = "group";
        tabCity.classList.add("active");
        tabCity.setAttribute("aria-selected", "true");
        tabCountry.classList.remove("active");
        tabCountry.setAttribute("aria-selected", "false");
        rankingsTitle.textContent = "Research Group Rankings";
        selectLocation(groupId);
      });
    });
  }
}

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
    // Reset all to Medium (6)
    for (const key of ALL_METRIC_KEYS) {
      const radioEl = document.getElementById(`imp-${key}-6`);
      if (radioEl) radioEl.checked = true;
    }
    updateCompatibility();
    return;
  }

  // Set metric importances
  for (const key of ALL_METRIC_KEYS) {
    let targetImp = 0; // default off for academic
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

/**
 * Show a specific quiz slide by number, hiding all others.
 * For slide 3 (sub-domain), dynamically populates options based on the discipline selected in slide 2.
 */
function showQuizSlide(slideNumber) {
  console.log(`Navigating to quiz slide ${slideNumber}`);
  const slides = document.querySelectorAll('.quiz-slide');
  slides.forEach(slide => {
    slide.hidden = true;
  });

  const target = document.getElementById(`quiz-slide-${slideNumber}`);
  if (target) {
    target.hidden = false;

    // If entering the sub-domain slide, populate options based on discipline selection
    if (slideNumber === 3) {
      populateSubDomainSlide();
    }
  }

  const percent = (slideNumber / totalQuizSlides) * 100;
  quizProgress.style.width = `${percent}%`;

  quizPrevBtn.disabled = slideNumber === 1;
  quizNextBtn.textContent = slideNumber === totalQuizSlides ? "Finish" : "Next";
}

/**
 * Map quiz answers intelligently to metric slider values and apply the result.
 * 
 * Logic:
 * - Career level (q-level) selects the base persona preset
 * - "What matters most" (q-priority) boosts the corresponding metric to High (10)
 * - Visa importance (q-visa) maps directly to visa_ease_academic importance
 * - Geographic preference and sub-domain are stored but don't directly affect sliders
 */
function finishQuizAndSetPersona() {
  const formData = new FormData(quizForm);

  const level = formData.get("q-level") || "undergrad";       // undergrad, phd, researcher
  const priority = formData.get("q-priority") || "funding";   // funding, freedom, prestige, balance, publications, industry
  const visa = formData.get("q-visa") || "important";         // critical, important, not_concern
  const geo = formData.get("q-geo") || "any";
  const disc = formData.get("q-disc") || "";
  const sub = formData.get("q-sub") || "";

  // 1. Start from the career level preset
  activePersona = level;
  const preset = PERSONA_PRESETS[level];
  if (!preset) {
    // Fallback: reset all to Medium
    for (const key of ALL_METRIC_KEYS) {
      const radioEl = document.getElementById(`imp-${key}-6`);
      if (radioEl) radioEl.checked = true;
    }
  } else {
    // Apply base preset importances
    for (const key of ALL_METRIC_KEYS) {
      let targetImp = 0;
      if (preset.metrics[key] && preset.metrics[key].importance !== undefined) {
        targetImp = preset.metrics[key].importance;
      }
      const radioEl = document.getElementById(`imp-${key}-${targetImp}`);
      if (radioEl) radioEl.checked = true;
    }
  }

  // 2. Boost metric corresponding to "what matters most"
  const priorityMetricMap = {
    funding: "research_funding",
    freedom: "research_freedom",
    prestige: "academic_reputation",
    balance: "work_life_balance",
    publications: "publication_output",
    industry: "industry_collaboration"
  };
  const boostedMetric = priorityMetricMap[priority];
  if (boostedMetric) {
    const radioEl = document.getElementById(`imp-${boostedMetric}-10`);
    if (radioEl) radioEl.checked = true;
  }

  // 3. Map visa importance
  const visaMap = { critical: 10, important: 6, not_concern: 0 };
  const visaImp = visaMap[visa] ?? 6;
  const visaRadio = document.getElementById(`imp-visa_ease_academic-${visaImp}`);
  if (visaRadio) visaRadio.checked = true;

  // 4. Set persona button and trigger recalculation
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
