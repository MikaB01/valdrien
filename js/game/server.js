const CONNECTION = window.VALDRIEN_CONNECTION || {};

const PROJECT_URL = projectUrl(CONNECTION.url);
const PROJECT_KEY = String(CONNECTION.anonKey || "").trim();

async function rpc(fn, values) {
  if (!PROJECT_URL || !PROJECT_KEY) throw new Error("no Supabase connection configured");
  const response = await fetch(`${PROJECT_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: PROJECT_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(values),
    cache: "no-store"
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
