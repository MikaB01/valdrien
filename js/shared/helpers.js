function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, z => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));
}
function num(value, fallback) { return typeof value === "number" && isFinite(value) ? value : fallback; }
function byPos(obj) {
  return Object.entries(obj || {}).sort((a, b) => (a[1].pos ?? 0) - (b[1].pos ?? 0) || a[0].localeCompare(b[0]));
}

function projectUrl(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  const dashboard = /supabase\.com\/dashboard\/project\/([a-z0-9]+)/i.exec(text);
  if (dashboard) return `https://${dashboard[1]}.supabase.co`;
  try { return new URL(/^https?:\/\//i.test(text) ? text : "https://" + text).origin; } catch (e) { return ""; }
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function escapeName(text) {
  return String(text).replace(/[&<>"]/g, z => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[z]));
}

function signed(n) { return (n > 0 ? "+" : "−") + Math.abs(n); }

function coinWord(n) { return Math.abs(n) === 1 ? "Münze" : "Münzen"; }

function coinsText(n) { return n + " " + coinWord(n); }

function randomCode() {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  const numbers = new Uint32Array(12);
  try { crypto.getRandomValues(numbers); } catch (e) { numbers.forEach((_, i) => numbers[i] = Math.floor(Math.random() * 1e9)); }
  return Array.from(numbers, z => chars[z % chars.length]).join("");
}
