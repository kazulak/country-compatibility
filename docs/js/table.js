import { loadJSON, escapeHTML, resolveCountry } from "./engine.js";
import { METRICS, countryMetrics } from "./metrics.js";

const $ = id => document.getElementById(id);

const QUALITY_LABEL = { curated: "Curated", template: "Template" };

// ---- generic sortable table ----
// columns: [{ id, label, title, numeric, sticky, get(row), cell(row) -> html, csv(row)?, csvLabel? }]
function createTable({ headEl, bodyEl, countEl, columns, rows, filter, defaultSort }) {
  let sort = { id: defaultSort, dir: "asc" };
  let view = [];

  function compare(a, b) {
    const col = columns.find(c => c.id === sort.id);
    const va = col.get(a);
    const vb = col.get(b);
    const aNull = va == null || va === "";
    const bNull = vb == null || vb === "";
    if (aNull || bNull) return aNull === bNull ? 0 : aNull ? 1 : -1; // empty values always last
    const r = col.numeric ? va - vb : String(va).localeCompare(String(vb));
    return sort.dir === "asc" ? r : -r;
  }

  function renderHead() {
    headEl.innerHTML = columns.map(c => {
      const state = c.id === sort.id ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
      const cls = c.sticky ? ' class="sticky-col"' : "";
      const title = c.title ? ` title="${escapeHTML(c.title)}"` : "";
      return `<th scope="col"${cls} aria-sort="${state}"><button type="button" data-col="${escapeHTML(c.id)}"${title}>${escapeHTML(c.label)}</button></th>`;
    }).join("");
  }

  function render() {
    view = rows.filter(filter).sort(compare);
    bodyEl.innerHTML = view.map(row =>
      `<tr>${columns.map(c => c.cell(row)).join("")}</tr>`
    ).join("");
    countEl.textContent = `${view.length} of ${rows.length} rows`;
    headEl.querySelectorAll("th").forEach((th, i) => {
      const c = columns[i];
      th.setAttribute("aria-sort", c.id === sort.id ? (sort.dir === "asc" ? "ascending" : "descending") : "none");
    });
  }

  headEl.addEventListener("click", e => {
    const btn = e.target.closest("button[data-col]");
    if (!btn) return;
    const id = btn.dataset.col;
    if (sort.id === id) sort.dir = sort.dir === "asc" ? "desc" : "asc";
    else sort = { id, dir: "asc" };
    render();
  });

  renderHead(); // built once so header buttons keep keyboard focus when re-sorting
  render();

  return {
    render,
    csv() {
      const lines = [columns.map(c => csvCell(c.csvLabel || c.label)).join(",")];
      for (const row of view) {
        lines.push(columns.map(c => csvCell(c.csv ? c.csv(row) : c.get(row))).join(","));
      }
      return lines.join("\r\n") + "\r\n";
    },
  };
}

function csvCell(value) {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(filename, text) {
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function matches(query, ...fields) {
  const q = query.trim().toLowerCase();
  return !q || fields.some(f => String(f ?? "").toLowerCase().includes(q));
}

// ---- countries ----
function metricCell(value) {
  if (value == null) return '<td class="num na" title="No data">&mdash;</td>';
  const alpha = (0.05 + (Math.max(0, Math.min(10, value)) / 10) * 0.5).toFixed(2);
  return `<td class="num" style="background: rgba(59, 130, 246, ${alpha})">${escapeHTML(value)}</td>`;
}

function badgeCell(row) {
  const cls = row.quality === "template" ? "quality-badge template" : "quality-badge";
  return `<td><span class="${cls}">${escapeHTML(QUALITY_LABEL[row.quality] || row.quality)}</span></td>`;
}

function setupCountries(data) {
  const templates = data.templates;
  const rows = data.countries.map(raw => {
    const resolved = resolveCountry(raw, templates);
    return {
      name: raw.name,
      quality: raw.quality,
      templateLabel: raw.quality === "template" ? (resolved.templateLabel || raw.template) : "",
      metrics: countryMetrics(resolved),
    };
  });

  const columns = [
    { id: "name", label: "Country", sticky: true, get: r => r.name,
      cell: r => `<td class="sticky-col">${escapeHTML(r.name)}</td>` },
    { id: "quality", label: "Quality", get: r => QUALITY_LABEL[r.quality] || r.quality, cell: badgeCell },
    { id: "template", label: "Template", get: r => r.templateLabel,
      cell: r => r.templateLabel ? `<td>${escapeHTML(r.templateLabel)}</td>` : '<td class="na">&mdash;</td>' },
    ...Object.entries(METRICS).map(([key, def]) => ({
      id: key,
      label: def.label.replace(/\s*\(.*\)\s*$/, ""),
      csvLabel: key,
      title: def.label,
      numeric: true,
      get: r => r.metrics[key],
      cell: r => metricCell(r.metrics[key]),
    })),
  ];

  const search = $("country-search");
  const filterSel = $("country-filter");
  const table = createTable({
    headEl: $("country-head"),
    bodyEl: $("country-body"),
    countEl: $("country-count"),
    columns,
    rows,
    defaultSort: "name",
    filter: r => (filterSel.value !== "curated" || r.quality === "curated")
      && matches(search.value, r.name, r.templateLabel),
  });
  search.addEventListener("input", table.render);
  filterSel.addEventListener("change", table.render);
  $("country-csv").addEventListener("click", () => download("countries.csv", table.csv()));
}

// ---- universities ----
function setupUniversities(uniData, countries) {
  const byId = new Map(countries.map(c => [c.id, c]));
  const rows = uniData.universities.map(u => {
    const host = u.countryId ? byId.get(u.countryId) : null;
    const isNum = /^#\d+$/.test(u.arwuBand || "");
    return {
      name: u.name,
      city: u.city,
      country: u.country,
      rank: u.arwuRank,
      band: isNum ? `≈ ${u.arwuBand}` : (u.arwuBand || ""),
      hostQuality: host ? host.quality : null,
      quality: host ? (QUALITY_LABEL[host.quality] || host.quality) : "None",
    };
  });

  const textCol = (id, label, key) => ({
    id, label, get: r => r[key],
    cell: r => `<td>${escapeHTML(r[key])}</td>`,
  });
  const columns = [
    { id: "name", label: "Name", sticky: true, get: r => r.name,
      cell: r => `<td class="sticky-col">${escapeHTML(r.name)}</td>` },
    textCol("city", "City", "city"),
    textCol("country", "Country", "country"),
    { id: "band", label: "ARWU band", title: "Approximate Shanghai (ARWU) rank; sorts by rank",
      numeric: true, get: r => r.rank,
      cell: r => `<td>${escapeHTML(r.band)}</td>`, csv: r => r.band },
    { id: "quality", label: "Host-country data", title: "Quality of the host country's data used for this university",
      get: r => r.quality,
      cell: r => r.hostQuality ? badgeCell({ quality: r.hostQuality }) : '<td class="na">None</td>' },
  ];

  const search = $("uni-search");
  const table = createTable({
    headEl: $("uni-head"),
    bodyEl: $("uni-body"),
    countEl: $("uni-count"),
    columns,
    rows,
    defaultSort: "band",
    filter: r => matches(search.value, r.name, r.city, r.country),
  });
  search.addEventListener("input", table.render);
  $("uni-csv").addEventListener("click", () => download("universities.csv", table.csv()));
}

// ---- tabs ----
function setupTabs() {
  const tabs = { countries: $("tab-countries"), universities: $("tab-universities") };
  const panels = { countries: $("panel-countries"), universities: $("panel-universities") };
  function show(name) {
    for (const key of Object.keys(tabs)) {
      tabs[key].setAttribute("aria-selected", key === name ? "true" : "false");
      panels[key].hidden = key !== name;
    }
  }
  for (const [name, btn] of Object.entries(tabs)) btn.addEventListener("click", () => show(name));
  if (location.hash === "#universities") show("universities");
}

async function init() {
  setupTabs();
  try {
    const [countryData, uniData] = await Promise.all([
      loadJSON("data/countries.json"),
      loadJSON("data/universities.json"),
    ]);
    setupCountries(countryData);
    setupUniversities(uniData, countryData.countries);
  } catch (err) {
    const box = $("load-error");
    box.textContent = `Could not load data: ${err.message}. Serve the docs folder over HTTP (for example python -m http.server) instead of opening the file directly.`;
    box.hidden = false;
  }
}

init();
