/*
 * Shared scoring engine and helpers for both pages.
 *
 * metricDefs: { key: { label, type: "maximize" | "preference" } }
 *   - maximize:   score = value / 10
 *   - preference: score = 1 - |target - value| / 10
 * prefs:      { key: { value, importance } }   (importance 0 = ignored)
 * metrics:    { key: number 0-10 }             (missing keys are skipped, not guessed)
 */

export function scoreMetrics(metrics, metricDefs, prefs) {
  let weighted = 0;
  let totalWeight = 0;
  const breakdown = [];

  for (const [key, def] of Object.entries(metricDefs)) {
    const pref = prefs[key] || { value: 5, importance: 0 };
    const weight = Number(pref.importance) || 0;
    const value = metrics[key];
    if (weight === 0 || value == null) continue;

    const target = def.type === "preference" ? Number(pref.value) : 10;
    const metricScore = def.type === "preference"
      ? 1 - Math.abs(target - value) / 10
      : value / 10;

    weighted += metricScore * weight;
    totalWeight += weight;
    breakdown.push({
      key,
      label: def.label,
      type: def.type,
      value,
      target,
      importance: weight,
      metricScore: Math.round(metricScore * 100),
    });
  }

  breakdown.sort((a, b) => b.metricScore - a.metricScore);
  const score = totalWeight > 0 ? Math.round((weighted / totalWeight) * 100) : 100;
  return { score, breakdown };
}

// Returns [{ item, score, breakdown }] sorted by score desc, then name asc.
export function rank(items, getMetrics, metricDefs, prefs) {
  return items
    .map(item => ({ item, ...scoreMetrics(getMetrics(item), metricDefs, prefs) }))
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
}

export async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

export function escapeHTML(text) {
  return String(text ?? "").replace(/[&<>"']/g, ch => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

export function matchClass(score) {
  return score >= 75 ? "match-high" : score >= 50 ? "match-medium" : "match-low";
}

export function debounce(fn, ms = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Countries using a template get the template's text and scores; the country's own fields win.
export function resolveCountry(country, templates) {
  if (country.quality !== "template") return country;
  const t = templates[country.template];
  return { ...t, templateLabel: t.label, ...country };
}

// Shareable state in the URL hash: #w=safety.10,warm_weather.6.7&sel=portugal
// w lists metric.importance[.target] for every metric that counts; anything not listed is off.
const IMPORTANCES = [0, 3, 6, 10];

export function writeHashState(metricDefs, prefs, extra = {}) {
  const weights = Object.entries(prefs)
    .filter(([key, p]) => metricDefs[key] && p.importance > 0)
    .map(([key, p]) => (metricDefs[key].type === "preference" ? `${key}.${p.importance}.${p.value}` : `${key}.${p.importance}`));
  const params = new URLSearchParams({ w: weights.join(",") || "none" });
  for (const [k, v] of Object.entries(extra)) {
    if (v != null && v !== false && v !== "") params.set(k, v === true ? "1" : v);
  }
  history.replaceState(null, "", `#${params.toString().replace(/%2C/g, ",")}`);
}

// Returns { prefs, params } from the URL hash, or null when the URL carries no shared state.
// prefs[key] = { importance, value? }; value is only present when the link set a target.
export function readHashState(metricDefs) {
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.has("w")) return null;
  const prefs = Object.fromEntries(Object.keys(metricDefs).map(key => [key, { importance: 0 }]));
  for (const part of params.get("w").split(",")) {
    const [key, imp, target] = part.split(".");
    const importance = Number(imp);
    if (!metricDefs[key] || !IMPORTANCES.includes(importance)) continue;
    prefs[key] = { importance };
    const value = Number(target);
    if (target != null && Number.isInteger(value) && value >= 0 && value <= 10) prefs[key].value = value;
  }
  return { prefs, params };
}

// Wires a "copy link" button: copies the current URL (which always holds the live state).
export function setupCopyLink(button) {
  if (!button) return;
  const label = button.textContent;
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      button.textContent = "✓ Link copied";
    } catch {
      button.textContent = "Copy the address bar URL";
    }
    setTimeout(() => { button.textContent = label; }, 2000);
  });
}
