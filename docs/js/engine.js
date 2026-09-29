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
