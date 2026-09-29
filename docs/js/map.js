/**
 * Country Compass - interactive world map (D3 + world-atlas).
 * All D3 code lives here. D3/topojson/atlas are fetched lazily (dynamic import) so a CDN failure
 * only breaks the map, never the rest of the page.
 *
 * API: createWorldMap(container, { countries, onSelect }) -> { update(rows, { activeId }), resetView() }
 *   countries: every dataset country (needs id, name, mapId, quality)
 *   rows:      [{ country, score }] for the countries currently ranked
 *   onSelect:  called with country.id when a dataset country is clicked
 */
const D3_URL = "https://cdn.jsdelivr.net/npm/d3@7/+esm";
const TOPOJSON_URL = "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";
const ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";

const SCORE_MIN = 30;
const SCORE_MAX = 100;
const MICROSTATE_AREA_PX = 20;
const FILL_NOT_INCLUDED = "#4a4a56";
const FILL_NO_DATA = "#222226";
const ACTIVE_STROKE = "#ffffff";

// Cached across map instances: { d3, topojson, features }.
let libsPromise = null;
function loadLibs() {
  if (!libsPromise) {
    libsPromise = (async () => {
      const [d3, topojson, topo] = await Promise.all([
        import(D3_URL),
        import(TOPOJSON_URL),
        fetch(ATLAS_URL).then(r => {
          if (!r.ok) throw new Error(`Map data: HTTP ${r.status}`);
          return r.json();
        }),
      ]);
      const features = topojson.feature(topo, topo.objects.countries).features
        .filter(f => f.properties?.name !== "Antarctica");
      return { d3, features };
    })();
    libsPromise.catch(() => { libsPromise = null; }); // allow retry on next map creation
  }
  return libsPromise;
}

const featureKey = (f) => f.id ?? f.properties?.name;

export function createWorldMap(container, { countries = [], onSelect = () => {} } = {}) {
  const byKey = new Map(countries.filter(c => c.mapId).map(c => [String(c.mapId), c]));
  let scores = new Map();   // country.id -> score
  let activeId = null;
  let api = null;           // filled once the map is drawn

  container.classList.add("world-map");
  container.innerHTML = `<div class="map-status" role="status">Loading map…</div>`;

  const ready = loadLibs().then(({ d3, features }) => {
    api = draw(d3, features);
    api.update();
  }).catch(err => {
    console.error("Map failed to load:", err);
    container.innerHTML = `<div class="map-status map-error" role="alert">Could not load the map (${String(err.message || err)}).
      The country list still works. <button type="button" class="btn secondary map-retry">Retry</button></div>`;
    container.querySelector(".map-retry")?.addEventListener("click", () => {
      const fresh = createWorldMap(container, { countries, onSelect });
      Object.assign(handle, fresh);
      fresh.update([...scores].map(([id, score]) => ({ country: countries.find(c => c.id === id), score })), { activeId });
    });
  });

  function draw(d3, features) {
    container.innerHTML = "";
    const svg = d3.select(container).append("svg")
      .attr("class", "map-svg")
      .attr("role", "img")
      .attr("aria-label", "World map of country match scores. Use the ranked list to browse countries with a keyboard.");

    svg.append("defs").html(`
      <pattern id="map-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="5" stroke="rgba(0,0,0,0.55)" stroke-width="1.6"></line>
      </pattern>`);

    const zoomLayer = svg.append("g");
    const sphere = zoomLayer.append("path").attr("class", "map-sphere").datum({ type: "Sphere" });
    const landG = zoomLayer.append("g").attr("class", "map-land");
    const hatchG = zoomLayer.append("g").attr("class", "map-hatch-layer");
    const activeG = zoomLayer.append("g").attr("class", "map-active-layer");
    const dotG = zoomLayer.append("g").attr("class", "map-dots");

    const projection = d3.geoNaturalEarth1();
    const path = d3.geoPath(projection);
    const color = d3.scaleSequential(t => d3.interpolateViridis(0.15 + 0.85 * t)).domain([SCORE_MIN, SCORE_MAX]).clamp(true);

    const tooltip = d3.select(container).append("div").attr("class", "map-tooltip").attr("role", "tooltip").attr("hidden", true);

    // ---- country state ----
    const countryOf = (f) => byKey.get(String(featureKey(f)));
    const fillOf = (f) => {
      const c = countryOf(f);
      if (!c) return FILL_NO_DATA;
      return scores.has(c.id) ? color(scores.get(c.id)) : FILL_NOT_INCLUDED;
    };

    const paths = landG.selectAll("path").data(features).join("path")
      .attr("class", f => countryOf(f) ? "map-country has-data" : "map-country");
    const templateFeatures = features.filter(f => countryOf(f)?.quality === "template");
    const hatch = hatchG.selectAll("path").data(templateFeatures).join("path").attr("class", "map-template");
    const activePath = activeG.append("path").attr("class", "map-active-outline");

    let microstates = []; // [{ f, c, x, y }]
    let dotSel = dotG.selectAll("circle");

    // ---- tooltip / events ----
    function tooltipHTML(f) {
      const c = countryOf(f);
      const esc = (s) => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
      if (!c) return `<strong>${esc(f.properties?.name ?? "Unknown")}</strong><span>No data</span>`;
      const label = c.quality === "template" ? "Template" : "Curated";
      const match = scores.has(c.id)
        ? `Match: ${scores.get(c.id)}%`
        : "Not included, enable template countries";
      return `<strong>${esc(c.name)}</strong><span>${match}</span><em>${label}</em>`;
    }
    function showTip(event, f) {
      tooltip.html(tooltipHTML(f)).attr("hidden", null);
      const [x, y] = d3.pointer(event, container);
      const node = tooltip.node();
      const w = node.offsetWidth, h = node.offsetHeight;
      const left = Math.min(Math.max(8, x + 14), Math.max(8, container.clientWidth - w - 8));
      const top = y + 16 + h > container.clientHeight ? Math.max(8, y - h - 12) : y + 16;
      tooltip.style("left", `${left}px`).style("top", `${top}px`);
    }
    const hideTip = () => tooltip.attr("hidden", true);

    function bind(sel) {
      sel.on("mouseenter mousemove", (e, f) => showTip(e, f))
        .on("mouseleave", hideTip)
        .on("click", (e, f) => {
          const c = countryOf(f);
          hideTip();
          if (c) onSelect(c.id);
        });
    }
    bind(paths);

    // ---- zoom ----
    let k = 1;
    const zoom = d3.zoom().scaleExtent([1, 12]).on("zoom", (e) => {
      k = e.transform.k;
      zoomLayer.attr("transform", e.transform);
      dotSel.attr("r", dotRadius());
      hideTip();
    });
    svg.call(zoom).on("dblclick.zoom", null);
    const dotRadius = () => Math.max(1.5, 4 / k);

    // ---- layout (re)computation ----
    let width = 0, height = 0;
    function layout() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w < 10 || h < 10) return false;
      // Re-projecting every path is expensive; skip resize callbacks that don't change the size.
      if (w === width && h === height) return true;
      width = w;
      height = h;
      svg.attr("viewBox", `0 0 ${width} ${height}`);
      projection.fitExtent([[6, 6], [width - 6, height - 6]], { type: "Sphere" });
      zoom.extent([[0, 0], [width, height]]).translateExtent([[0, 0], [width, height]]);
      sphere.attr("d", path);
      paths.attr("d", path);
      hatch.attr("d", path);

      microstates = [];
      for (const f of features) {
        const c = countryOf(f);
        if (c && path.area(f) < MICROSTATE_AREA_PX) {
          const [x, y] = path.centroid(f);
          if (Number.isFinite(x) && Number.isFinite(y)) microstates.push({ f, c, x, y });
        }
      }
      dotSel = dotG.selectAll("circle").data(microstates, d => d.c.id)
        .join("circle").attr("class", "map-dot")
        .attr("cx", d => d.x).attr("cy", d => d.y).attr("r", dotRadius());
      dotSel.on("mouseenter mousemove", (e, d) => showTip(e, d.f))
        .on("mouseleave", hideTip)
        .on("click", (e, d) => { hideTip(); onSelect(d.c.id); });
      paintActive();
      paint();
      return true;
    }

    function paint() {
      paths.attr("fill", fillOf);
      dotSel.attr("fill", d => fillOf(d.f));
    }
    function paintActive() {
      const f = features.find(ft => countryOf(ft)?.id === activeId);
      activePath.attr("d", f ? path(f) : null).attr("hidden", f ? null : true);
      dotSel.classed("is-active", d => d.c.id === activeId);
    }

    new ResizeObserver(() => layout()).observe(container);
    layout();

    // ---- controls & legend ----
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "map-reset-btn";
    reset.textContent = "Reset view";
    reset.addEventListener("click", resetView);
    container.appendChild(reset);

    const stops = d3.range(0, 1.001, 0.1).map(t => color(SCORE_MIN + t * (SCORE_MAX - SCORE_MIN))).join(", ");
    const legend = document.createElement("div");
    legend.className = "map-legend";
    legend.innerHTML = `
      <div class="map-legend-ramp">
        <span class="map-legend-title">Match %</span>
        <div class="map-legend-bar" style="background: linear-gradient(to right, ${stops});"></div>
        <div class="map-legend-ticks"><span>30%</span><span>65%</span><span>100%</span></div>
      </div>
      <div class="map-legend-item"><span class="map-swatch map-swatch-template"></span>Template estimate (hatched)</div>
      <div class="map-legend-item"><span class="map-swatch" style="background:${FILL_NOT_INCLUDED}"></span>Not included</div>
      <div class="map-legend-item"><span class="map-swatch" style="background:${FILL_NO_DATA}"></span>No data</div>`;
    container.appendChild(legend);

    function resetView() {
      svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
    }

    return {
      update() { paintActive(); paint(); },
      resetView,
    };
  }

  const handle = {
    update(rows, opts = {}) {
      scores = new Map(rows.map(r => [r.country.id, r.score]));
      activeId = opts.activeId ?? null;
      if (api) api.update();
    },
    resetView() { api?.resetView(); },
    ready,
  };
  return handle;
}
