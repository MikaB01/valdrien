// Valdrien CMS: edit adventures, roles, minigames and events together and live (Supabase).
// Without values in connection.js it runs in preview mode and only saves to this browser.

const SECTIONS = [
  { id: "adventures",  name: "Abenteuer" },
  { id: "roles",     name: "Rollen",      list: true, singular: "Rolle" },
  { id: "minigames", name: "Minispiele",  list: true, singular: "Minispiel" },
  { id: "events", name: "Ereignisse",  list: true, singular: "Ereignis" },
  { id: "team",       name: "Team & Verlauf", bottom: true },
  { id: "file",      name: "JSON-Datei", bottom: true }
];

const CATEGORIES = CATALOG.categories;
const ABILITY_MECHANICS = CATALOG.abilities;
const EFFECT_MECHANICS = CATALOG.effects;

const CONNECTION = window.VALDRIEN_CONNECTION || {};
const PROJECT_URL = projectUrl(CONNECTION.url);
const ANON_KEY = String(CONNECTION.anonKey || "").trim();
const LIVE = Boolean(PROJECT_URL && ANON_KEY && window.supabase);
const sb = LIVE ? window.supabase.createClient(PROJECT_URL, ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;
const PREVIEW_KEY = "valdrien-cms-preview";

const cms = {
  phase: "loading",
  content: null,
  version: 0,
  adventure: null,
  section: "roles",
  entry: null,
  search: "",
  me: null,
  canEdit: !LIVE,
  present: [],
  team: [],
  history: [],
  dialog: null,
  status: "ready",
  statusText: "",
  message: "",
  importData: null
};

// pending changes per field path; each field is saved on its own after a short typing pause
const unsaved = {};
let presenceChannel = null;

const shortId = () => Math.random().toString(36).slice(2, 6);
function slug(s) {
  return String(s || "entry").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "entry";
}
function getPath(obj, path) { return path.reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function setLocal(path, value) {
  let o = cms.content;
  for (let i = 0; i < path.length - 1; i++) { if (o[path[i]] == null || typeof o[path[i]] !== "object") o[path[i]] = {}; o = o[path[i]]; }
  if (value === null) delete o[path[path.length - 1]]; else o[path[path.length - 1]] = value;
}
const currentAdventure = () => cms.content.adventures[cms.adventure];
const basePath = () => ["adventures", cms.adventure];
const initials = email => (email || "?").split("@")[0].split(/[._-]/).filter(Boolean).slice(0, 2).map(t => t[0]).join("") || "?";
const timeText = iso => {
  const d = new Date(iso), now = new Date();
  const clock = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === now.toDateString() ? clock : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) + " " + clock;
};

async function start() {
  if (!LIVE) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(PREVIEW_KEY) || "null"); } catch (e) {}
    takeContent(saved || structuredClone(window.VALDRIEN_INITIAL_CONTENT || { format: CONTENT_FORMAT, adventures: {} }), 1);
    cms.me = "preview";
    cms.phase = "working";
    render();
    return;
  }
  sb.auth.onAuthStateChange((event, session) => {
    const email = session?.user?.email || null;
    if (email && email !== cms.me) { cms.me = email; onSignedIn(); }
    if (!email && cms.me) { cms.me = null; cms.phase = "signin"; render(); }
  });
  const { data } = await sb.auth.getSession();
  if (data.session?.user?.email) { cms.me = data.session.user.email; onSignedIn(); }
  else { cms.phase = "signin"; render(); }
}

async function onSignedIn() {
  cms.phase = "loading"; render();
  const ok = await loadFromServer();
  if (!ok) return;
  const { data: allowed } = await sb.rpc("is_editor");
  cms.canEdit = allowed === true;
  // content still in the old German format 1: store the converted version once
  if (cms.canEdit && cms.needsUpgrade) {
    const { data: version, error } = await sb.rpc("content_replace", { data: cms.content });
    if (!error) { cms.version = version; cms.needsUpgrade = false; }
  }
  cms.phase = "working";
  subscribeLive();
  startPresence();
  if (cms.canEdit) loadTeam();
  render();
}

async function loadFromServer() {
  const { data, error } = await sb.from("content").select("data, version").eq("id", "valdrien").maybeSingle();
  if (error || !data) {
    cms.phase = "error";
    cms.message = error
      ? "Die Datenbank antwortet nicht: " + error.message
      : "Es gibt noch keinen Inhalt. Bitte führe die Datei database/setup.sql im SQL Editor von Supabase aus.";
    render();
    return false;
  }
  takeContent(data.data, data.version);
  return true;
}

// Take a new version from the server without losing own unsaved changes.
function takeContent(data, version) {
  cms.needsUpgrade = Boolean(data && data.format !== CONTENT_FORMAT);
  data = upgradeContent(data);
  cms.content = data;
  cms.version = version;
  Object.values(unsaved).forEach(o => setLocal(o.path, o.value));
  const ids = byPos(data.adventures).map(([id]) => id);
  if (!ids.includes(cms.adventure)) cms.adventure = ids[0] || null;
}

let reloadTimer = null;
function subscribeLive() {
  sb.channel("content-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "content" }, () => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(reloadLive, 250);
    })
    .subscribe();
}
async function reloadLive() {
  const { data } = await sb.from("content").select("data, version").eq("id", "valdrien").maybeSingle();
  if (!data || data.version <= cms.version) return;
  takeContent(data.data, data.version);
  softRefresh();
  if (cms.section === "team" && cms.canEdit) loadTeam();
}

function startPresence() {
  presenceChannel = sb.channel("cms-presence", { config: { presence: { key: cms.me } } });
  presenceChannel
    .on("presence", { event: "sync" }, () => {
      const presence = presenceChannel.presenceState();
      cms.present = Object.values(presence).map(list => list[list.length - 1]).filter(Boolean);
      renderTopbar();
      renderList();
      renderEditorNotice();
    })
    .subscribe(s => { if (s === "SUBSCRIBED") reportPlace(); });
}
function reportPlace() {
  if (!presenceChannel) return;
  presenceChannel.track({ email: cms.me, place: [cms.adventure, cms.section, cms.entry || ""].join("/") }).catch(() => {});
}
const othersHere = place => cms.present.filter(p => p.email !== cms.me && p.place === place);

function change(path, value, immediate) {
  setLocal(path, value);
  const key = path.join("\u0001");
  if (unsaved[key]) clearTimeout(unsaved[key].timer);
  unsaved[key] = { path, value, timer: setTimeout(() => save(key), immediate ? 0 : 700) };
  setStatus("saving");
}

async function save(key) {
  const entry = unsaved[key];
  if (!entry) return;
  const { path, value } = entry;

  if (!LIVE) {
    delete unsaved[key];
    try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(cms.content)); } catch (e) {}
    setStatus(Object.keys(unsaved).length ? "saving" : "ready");
    return;
  }

  const response = value === null
    ? await sb.rpc("content_delete", { path })
    : await sb.rpc("content_set", { path, value });

  if (unsaved[key] === entry) delete unsaved[key];
  if (response.error) {
    setStatus("error", response.error.message);
    reloadLive();
    return;
  }
  if (typeof response.data === "number") cms.version = Math.max(cms.version, response.data);
  setStatus(Object.keys(unsaved).length ? "saving" : "ready");
}

function setStatus(status, text) {
  cms.status = status;
  cms.statusText = text || "";
  const el = document.getElementById("status");
  if (el) { el.className = "status" + (status === "error" ? " error" : ""); el.textContent = statusLabel(); }
  document.querySelectorAll(".field[data-key]").forEach(f => f.classList.toggle("pending", Boolean(unsaved[f.dataset.key])));
}
function statusLabel() {
  if (cms.status === "saving") return "Speichert …";
  if (cms.status === "error") return "Nicht gespeichert: " + cms.statusText;
  return LIVE ? "Alles gespeichert" : "Vorschau: nur in diesem Browser";
}

window.addEventListener("beforeunload", e => { if (Object.keys(unsaved).length) { e.preventDefault(); e.returnValue = ""; } });

function render() {
  const app = document.getElementById("app");
  if (cms.phase === "loading") { app.innerHTML = `<div class="signin"><p class="quiet">Lade Inhalte …</p></div>`; return; }
  if (cms.phase === "signin" || cms.phase === "link-sent") { app.innerHTML = signInHtml(); return; }
  if (cms.phase === "error") {
    app.innerHTML = `<div class="signin"><div class="signin-card"><h1>Valdrien</h1><div class="message error">${escapeHtml(cms.message)}</div>
      <button class="btn" onclick="location.reload()">Erneut versuchen</button></div></div>`;
    return;
  }
  const b = SECTIONS.find(x => x.id === cms.section);
  const withList = Boolean(b?.list);
  app.innerHTML = `
    <header class="topbar" id="topbar"></header>
    ${!LIVE ? `<div class="banner">Vorschau-Modus: Änderungen bleiben nur in diesem Browser. Trage in <strong>connection.js</strong> deine Supabase-Daten ein, um gemeinsam live zu arbeiten.</div>` : ""}
    ${LIVE && !cms.canEdit ? `<div class="banner">Du kannst alles ansehen, aber noch nicht bearbeiten. Bitte jemanden aus dem Team, deine Adresse <strong>${escapeHtml(cms.me)}</strong> unter „Team &amp; Verlauf“ hinzuzufügen.</div>` : ""}
    <div class="workspace ${withList ? "" : "single-column"} ${cms.entry ? "shows-editor" : ""}" id="workspace">
      <nav class="sections" id="sections" aria-label="Bereiche"></nav>
      ${withList ? `<section class="list" id="list" aria-label="${escapeHtml(b.name)}"></section>` : ""}
      <section class="editor" id="editor"></section>
    </div>`;
  renderTopbar();
  renderSections();
  if (withList) renderList();
  renderEditor();
}

// After a live update: refresh what changed without disturbing the field being typed in.
function softRefresh() {
  if (cms.phase !== "working") return;
  if (!cms.content.adventures[cms.adventure]) { render(); return; }
  renderTopbar();
  renderSections();
  renderList();
  const editor = document.getElementById("editor");
  const currentSignature = editorSignature();
  if (!editor || editor.dataset.signature !== currentSignature) {
    if (editor && editor.contains(document.activeElement) && editor.dataset.signature?.split("|")[0] === currentSignature.split("|")[0]) {
      refreshFields();
    } else {
      renderEditor();
    }
  } else {
    refreshFields();
  }
}

function refreshFields() {
  document.querySelectorAll("[data-path]").forEach(el => {
    const key = el.dataset.path;
    if (el === document.activeElement || unsaved[key]) return;
    const value = getPath(cms.content, key.split("\u0001"));
    if (el.type === "radio" && value == null) return;
    const display = valueToText(value, el.dataset.type);
    if (el.type === "radio") el.checked = el.value === display;
    else if (el.value !== display) el.value = display;
  });
  const title = document.getElementById("editor-title");
  const e = currentEntry();
  if (title && e) title.textContent = e.name || "Ohne Namen";
}

function editorSignature() {
  const e = currentEntry();
  return [cms.adventure, cms.section, cms.entry || "", e ? "present" : "gone", e?.category || "", e?.visibility || "",
    e?.effect || "", String(e?.requiresRoles === true),
    cms.dialog ? JSON.stringify(cms.dialog) : ""].join("|");
}

function renderTopbar() {
  const el = document.getElementById("topbar");
  if (!el) return;
  const other = cms.present.filter(p => p.email !== cms.me);
  el.innerHTML = `
    <div class="brand"><b>Valdrien</b><span>Redaktion</span></div>
    <select id="adventure-select" class="adventure-select" aria-label="Abenteuer wählen" onchange="chooseAdventure(this.value)">
      ${byPos(cms.content.adventures).map(([id, a]) => `<option value="${escapeHtml(id)}" ${id === cms.adventure ? "selected" : ""}>${escapeHtml(a.name || "Ohne Namen")}</option>`).join("")}
      ${cms.canEdit ? `<option value="__new">+ Neues Abenteuer</option>` : ""}
    </select>
    <div class="topbar-right">
      <span id="status" class="status${cms.status === "error" ? " error" : ""}" role="status">${escapeHtml(statusLabel())}</span>
      ${other.length ? `<div class="people" title="Gerade auch im CMS">${other.map(p => `<span class="person" title="${escapeHtml(p.email)}">${escapeHtml(initials(p.email))}</span>`).join("")}</div>` : ""}
      ${LIVE ? `<button class="account" onclick="logout()" title="Abmelden"><span class="account-email">${escapeHtml(cms.me)} · </span>Abmelden</button>` : ""}
    </div>`;
}

function renderSections() {
  const el = document.getElementById("sections");
  if (!el) return;
  const a = currentAdventure();
  const count = id => a && a[id] ? Object.keys(a[id]).length : 0;
  const button = b => `
    <button class="section-btn" aria-current="${b.id === cms.section}" onclick="chooseSection('${b.id}')">
      <span>${escapeHtml(b.name)}</span>${b.list ? `<span class="count">${count(b.id)}</span>` : ""}
    </button>`;
  el.innerHTML = SECTIONS.filter(b => !b.bottom).map(button).join("") + `<hr>` + SECTIONS.filter(b => b.bottom).map(button).join("");
}

function renderList() {
  const el = document.getElementById("list");
  if (!el) return;
  const b = SECTIONS.find(x => x.id === cms.section);
  const search = cms.search.trim().toLowerCase();
  const entries = byPos(currentAdventure()[cms.section]).filter(([, e]) => !search || JSON.stringify(e).toLowerCase().includes(search));
  const hadFocus = document.activeElement && document.activeElement.id === "search";
  el.innerHTML = `
    <div class="list-header">
      <h2>${escapeHtml(b.name)}</h2>
      ${cms.canEdit ? `<button class="btn small" onclick="newEntry()">+ ${escapeHtml(b.singular)}</button>` : ""}
    </div>
    <input id="search" class="search" type="search" placeholder="Suchen …" value="${escapeHtml(cms.search)}" oninput="cms.search = this.value; renderList()" aria-label="${escapeHtml(b.name)} durchsuchen">
    <div class="entries">
      ${entries.length ? entries.map(([id, e]) => {
        const here = othersHere([cms.adventure, cms.section, id].join("/"));
        return `
        <button class="entry" aria-current="${id === cms.entry}" onclick="openEntry('${escapeHtml(id)}')">
          <span class="title">${escapeHtml(e.name || "Ohne Namen")}</span>
          <span class="sub">${escapeHtml(subtitle(e))}</span>
          <span class="right">
            ${cms.section === "events" && e.visibility === "private" ? `<span class="chip private">privat</span>` : ""}
            ${cms.section === "events" && eventRequiresRoles(e) ? `<span class="chip" title="Nur in Partien mit Rollen">Rollen</span>` : ""}
            ${here.map(p => `<span class="here-badge" title="${escapeHtml(p.email)} arbeitet hier">${escapeHtml(initials(p.email))}</span>`).join("")}
          </span>
        </button>`;
      }).join("") : `<p class="empty">${search ? "Nichts gefunden." : `Noch keine ${escapeHtml(b.name)}.`}</p>`}
    </div>`;
  if (hadFocus) { const s = document.getElementById("search"); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
}

function subtitle(e) {
  if (cms.section === "roles") return [e.title, (e.startingCoins ?? "?") + " Münzen"].filter(Boolean).join(" · ");
  if (cms.section === "minigames") return (CATEGORIES[e.category]?.name || "Ohne Kategorie") + rewardShort(e);
  if (cms.section === "events") return e.visibility === "private"
    ? [e.category, e.privateType === "task" ? "Aufgabe" : "", e.privateCoins ? (e.privateCoins > 0 ? "+" : "") + e.privateCoins : ""].filter(Boolean).join(" · ")
    : [e.category, EFFECT_MECHANICS[e.effect] ? "" : "ohne Wirkung"].filter(Boolean).join(" · ");
  return "";
}
function rewardShort(e) {
  const k = CATEGORIES[e.category];
  if (!k || !e.reward) return "";
  const first = k.fields.map(([f]) => e.reward[f]).find(w => typeof w === "number");
  return typeof first === "number" ? ` · ${first > 0 ? "+" : ""}${first}` : "";
}

function currentEntry() {
  const b = SECTIONS.find(x => x.id === cms.section);
  if (!b?.list || !cms.entry) return null;
  return currentAdventure()?.[cms.section]?.[cms.entry] || null;
}

function renderEditor() {
  const el = document.getElementById("editor");
  if (!el) return;
  el.dataset.signature = editorSignature();
  const b = SECTIONS.find(x => x.id === cms.section);
  let html = "";
  if (cms.section === "adventures") html = adventureEditor();
  else if (cms.section === "team") html = teamHtml();
  else if (cms.section === "file") html = fileHtml();
  else if (!cms.entry) html = `<p class="empty">Wähle links ${b.singular === "Rolle" ? "eine" : "ein"} ${escapeHtml(b.singular)} aus oder lege ${b.singular === "Rolle" ? "eine neue" : "ein neues"} an.</p>`;
  else if (!currentEntry()) html = `<div class="message warning">Diesen Eintrag gibt es nicht mehr. Vermutlich hat ihn gerade jemand gelöscht.</div>`;
  else html = entryEditor();
  el.innerHTML = html;
  if (!cms.canEdit) el.querySelectorAll("input, textarea, select").forEach(f => { if (f.id !== "search") f.disabled = true; });
  setStatus(cms.status, cms.statusText);
}

function renderEditorNotice() {
  const el = document.getElementById("others-here");
  if (!el) return;
  const here = othersHere([cms.adventure, cms.section, cms.entry || ""].join("/"));
  el.hidden = !here.length;
  el.textContent = here.length ? `${here.map(p => p.email.split("@")[0]).join(", ")} ${here.length === 1 ? "arbeitet" : "arbeiten"} gerade auch hier. Ihr seht eure Änderungen gegenseitig live.` : "";
}

function headerHtml(eyebrow, title, tools) {
  const b = SECTIONS.find(x => x.id === cms.section);
  return `
    ${b?.list ? `<button class="btn quiet small back-mobile" onclick="openEntry(null)">‹ Alle ${escapeHtml(b.name)}</button>` : ""}
    <div class="editor-header">
      <div><span class="eyebrow">${escapeHtml(eyebrow)}</span><h2 id="editor-title">${escapeHtml(title)}</h2></div>
      ${tools ? `<div class="tools">${tools}</div>` : ""}
    </div>
    <div class="message" id="others-here" hidden></div>
    ${cms.dialog ? confirmHtml() : ""}`;
}

// type: text | number | textarea | narrative | paragraphs | lines | select | segment | flag (segment with false/true)
function field(fullPath, label, type, options = {}) {
  const key = fullPath.join("\u0001");
  const id = "f-" + fullPath.map(slug).join("-");
  const value = getPath(cms.content, fullPath) ?? options.defaultValue;
  const text = valueToText(value, type);
  const attr = `id="${id}" data-path="${escapeHtml(key)}" data-type="${type}"`;
  let input;
  if (type === "number") input = `<input type="number" inputmode="numeric" step="1" ${attr} value="${escapeHtml(text)}">`;
  else if (type === "select") input = `<select ${attr}>${Object.entries(options.values).map(([w, n]) => `<option value="${escapeHtml(w)}" ${w === text ? "selected" : ""}>${escapeHtml(n)}</option>`).join("")}${!(text in options.values) ? `<option value="${escapeHtml(text)}" selected>${escapeHtml(text || "(leer)")}</option>` : ""}</select>`;
  else if (type === "segment" || type === "flag") input = `<div class="segment" role="radiogroup" aria-label="${escapeHtml(label)}">${Object.entries(options.values).map(([w, n]) => `<label><input type="radio" name="${id}" value="${escapeHtml(w)}" data-path="${escapeHtml(key)}" data-type="${type}" ${w === text ? "checked" : ""}>${escapeHtml(n)}</label>`).join("")}</div>`;
  else if (["textarea", "narrative", "paragraphs", "lines"].includes(type)) input = `<textarea ${attr} rows="${options.rows || 4}" class="${type === "narrative" || type === "paragraphs" ? "narrative" : ""}">${escapeHtml(text)}</textarea>`;
  else input = `<input type="text" ${attr} value="${escapeHtml(text)}" ${options.list ? `list="${options.list}"` : ""} autocomplete="off">`;
  return `
    <div class="field" data-key="${escapeHtml(key)}">
      ${type === "segment" || type === "flag" ? `<span class="label">${escapeHtml(label)}</span>` : `<label for="${id}">${escapeHtml(label)}</label>`}
      ${options.help ? `<span class="help">${escapeHtml(options.help)}</span>` : ""}
      ${input}
      ${options.after || ""}
    </div>`;
}

function valueToText(value, type) {
  if (value == null) return "";
  if (type === "paragraphs") return (Array.isArray(value) ? value : [value]).join("\n\n");
  if (type === "lines") return (Array.isArray(value) ? value : [value]).join("\n");
  return String(value);
}
function textToValue(text, type) {
  if (type === "number") { if (String(text).trim() === "") return null; const n = Number(text); return Number.isFinite(n) ? Math.round(n) : undefined; }
  if (type === "paragraphs") return String(text).split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  if (type === "lines") return String(text).split("\n").map(s => s.trim()).filter(Boolean);
  if (type === "flag") return text === "true";
  return String(text);
}

document.addEventListener("input", e => {
  const el = e.target;
  if (!el.dataset || !el.dataset.path || !cms.canEdit) return;
  const type = el.dataset.type;
  const value = textToValue(el.value, type);
  if (value === undefined) return;
  const path = el.dataset.path.split("\u0001");
  const structural = type === "select" || type === "segment" || type === "flag";
  const before = getPath(cms.content, path);
  change(path, value, structural);
  // an effect that needs roles marks the event, so the stored content says it too; switching away clears the mark again
  if (path[path.length - 1] === "effect") {
    const roleEffect = v => CATALOG.roleEffects.includes(v);
    if (roleEffect(value) !== roleEffect(before)) change([...path.slice(0, -1), "requiresRoles"], roleEffect(value), true);
  }
  if (path[path.length - 1] === "name") {
    const title = document.getElementById("editor-title");
    if (title && path.length >= 3) title.textContent = value || "Ohne Namen";
    if (path.length === 2) renderTopbar();
  }
  if (structural) { renderEditor(); renderList(); }
  else clearTimeout(listTimer), listTimer = setTimeout(() => { renderList(); renderSections(); }, 400);
});
let listTimer = null;

function adventureEditor() {
  const p = basePath();
  const a = currentAdventure();
  const count = Object.keys(cms.content.adventures).length;
  return `
    ${headerHtml("Abenteuer", a.name || "Ohne Namen",
      cms.canEdit && count > 1 ? `<button class="btn danger small" onclick="ask('delete-adventure')">Abenteuer löschen</button>` : "")}
    ${checkHtml()}
    <div class="group">
      <h3>Grunddaten</h3>
      ${field([...p, "name"], "Name", "text")}
      ${field([...p, "setting"], "Setting", "text", { help: "Wo und wie gespielt wird. Steht auf der Auswahlkarte, z. B. „Draußen · für Wanderungen“." })}
      ${field([...p, "goal"], "Spielziel", "select", { values: CATALOG.goals, defaultValue: "coins", help: "Beim Schlüssel-Ziel kauft man beim Kerkermeister zufällig Eisen-, Silber- oder Knochenschlüssel. Wer drei verschiedene hat, gewinnt sofort." })}
    </div>
    <div class="group">
      <h3>Geschichte</h3>
      ${field([...p, "story", "title"], "Überschrift", "text")}
      ${field([...p, "story", "paragraphs"], "Text", "paragraphs", { rows: 12, help: "Eine leere Zeile beginnt einen neuen Absatz." })}
      ${field([...p, "story", "closing"], "Letzter Satz (kursiv)", "text")}
    </div>
    <div class="group">
      <h3>Schlusstext</h3>
      ${field([...p, "epilogue", "title"], "Überschrift", "text")}
      ${field([...p, "epilogue", "before"], "Text vor dem Namen des Siegers", "paragraphs", { rows: 5 })}
      ${field([...p, "epilogue", "after"], "Text nach dem Namen des Siegers", "paragraphs", { rows: 6, help: "{winner} wird im Spiel durch den Namen ersetzt." })}
    </div>
    <details class="group">
      <summary>Begriffe im Spiel</summary>
      <div class="field-row">
        ${field([...p, "terms", "player"], "Ein Spieler heißt", "text", { help: "z. B. Anwärter, Gast" })}
        ${field([...p, "terms", "plural"], "Mehrere heißen", "text", { help: "z. B. Anwärter, Gäste" })}
        ${field([...p, "terms", "dative"], "„allen …“", "text", { help: "z. B. Anwärtern, Gästen" })}
      </div>
      ${field([...p, "terms", "question"], "Frage beim Namen-Eingeben", "text")}
      ${field([...p, "terms", "finish"], "Knopf zum Beenden", "text")}
    </details>`;
}

function checkHtml() {
  const a = currentAdventure();
  const roles = Object.values(a.roles || {});
  const minigameList = Object.values(a.minigames || {});
  const eventList = Object.values(a.events || {});
  const problems = [], notes = [];
  if (roles.length < 3) {
    const withoutRoles = eventList.filter(e => !eventRequiresRoles(e)).length;
    if (withoutRoles) notes.push(`Es gibt ${roles.length} Rollen. Mit Rollen braucht eine Partie mindestens 3, ohne Rollen ist das Abenteuer schon spielbar.`);
    else problems.push(`Es gibt ${roles.length} Rollen. Für eine Partie mit Rollen braucht es mindestens 3.`);
  }
  if (!eventList.length) problems.push("Es gibt noch keine Ereignisse.");
  Object.entries(CATEGORIES).forEach(([k, d]) => { if (!minigameList.some(m => m.category === k)) notes.push(`Kein Minispiel in der Kategorie „${d.name}“. Ereignisse oder Fähigkeiten, die so ein Minispiel brauchen, finden dann keins.`); });
  const withoutMechanic = roles.filter(r => !r.ability?.mechanic).map(r => r.name || "Ohne Namen");
  if (withoutMechanic.length) notes.push(`Ohne Spielmechanik (Münzen von Hand): ${withoutMechanic.join(", ")}.`);
  const privateCount = eventList.filter(e => e.visibility === "private").length;
  const roleEvents = eventList.filter(eventRequiresRoles).length;
  if (roleEvents && roleEvents === eventList.length) notes.push(`Alle Ereignisse brauchen Rollen. Ohne Rollen ist das Abenteuer nicht spielbar.`);
  else if (roleEvents) notes.push(`${roleEvents} ${roleEvents === 1 ? "Ereignis kommt" : "Ereignisse kommen"} nur in Partien mit Rollen vor. Ohne Rollen bleiben ${eventList.length - roleEvents}.`);
  if (privateCount) notes.push(`${privateCount} private ${privateCount === 1 ? "Ereignis geht" : "Ereignisse gehen"} jeweils an einen einzelnen Spieler auf seine QR-Seite.`);
  if (!problems.length && !notes.length) return `<div class="message">Spielbereit: ${roles.length} Rollen, ${minigameList.length} Minispiele, ${eventList.length} Ereignisse.</div>`;
  return `
    ${problems.length ? `<div class="message error"><strong>So ist das Abenteuer noch nicht spielbar</strong><ul>${problems.map(t => `<li>${escapeHtml(t)}</li>`).join("")}</ul></div>` : ""}
    ${notes.length ? `<div class="message warning"><strong>Gut zu wissen</strong> · ${roles.length} Rollen, ${minigameList.length} Minispiele, ${eventList.length} Ereignisse<ul>${notes.map(t => `<li>${escapeHtml(t)}</li>`).join("")}</ul></div>` : ""}`;
}

function entryEditor() {
  const e = currentEntry();
  const p = [...basePath(), cms.section, cms.entry];
  const b = SECTIONS.find(x => x.id === cms.section);
  const tools = cms.canEdit ? `
    <button class="btn quiet small" onclick="move(-1)" aria-label="Nach oben">↑</button>
    <button class="btn quiet small" onclick="move(1)" aria-label="Nach unten">↓</button>
    <button class="btn quiet small" onclick="duplicate()">Duplizieren</button>
    <button class="btn danger small" onclick="ask('delete-entry')">Löschen</button>` : "";
  let html = headerHtml(b.singular, e.name || "Ohne Namen", tools);

  if (cms.section === "roles") {
    html += `
      <div class="group">
        <div class="field-row">
          ${field([...p, "name"], "Name", "text")}
          ${field([...p, "title"], "Bezeichnung", "text", { help: "Gleicher Anfangsbuchstabe wie der Name, z. B. „der Mundschenk“." })}
          ${field([...p, "startingCoins"], "Startkapital", "number", { help: "Münzen zu Beginn" })}
        </div>
      </div>
      <div class="group">
        <h3>Wer ist das?</h3>
        ${field([...p, "background"], "Hintergrundgeschichte", "narrative", { rows: 5 })}
        ${field([...p, "character"], "Charakter und Verhalten", "textarea", { help: "Wie spielt man diese Rolle? Steht auf der eigenen Rollenkarte." })}
        ${field([...p, "traits"], "Erkennungsmerkmale", "lines", { rows: 4, help: "Ein Merkmal pro Zeile. Diese sehen alle in der Rollenübersicht." })}
      </div>
      <div class="group">
        <h3>Fähigkeit</h3>
        ${field([...p, "ability", "name"], "Name der Fähigkeit", "text")}
        ${field([...p, "ability", "text"], "Beschreibung", "textarea")}
        ${field([...p, "ability", "mechanic"], "Was die App dabei tut", "select", { values: ABILITY_MECHANICS, help: "Die App kann nur diese Mechaniken. Neue müssen programmiert werden." })}
      </div>
      <div class="group">
        <h3>Geheime Aufgabe</h3>
        <div class="field-row">
          ${field([...p, "task", "name"], "Name der Aufgabe", "text")}
          ${field([...p, "task", "bonus"], "Bonus am Ende", "number", { help: "Münzen, wenn erfüllt" })}
        </div>
        ${field([...p, "task", "text"], "Beschreibung", "textarea")}
      </div>`;
  }

  if (cms.section === "minigames") {
    const k = CATEGORIES[e.category];
    const categoryOptions = Object.fromEntries(Object.entries(CATEGORIES).map(([id, d]) => [id, d.name]));
    html += `
      <div class="group">
        <div class="field-row">
          ${field([...p, "name"], "Name", "text")}
          ${field([...p, "category"], "Kategorie", "select", { values: categoryOptions })}
        </div>
        ${field([...p, "description"], "Beschreibung", "textarea", { rows: 6, help: "So wird gespielt. Wird vorgelesen." })}
      </div>
      <div class="group">
        <h3>Belohnung</h3>
        ${k ? `<div class="field-row">${k.fields.map(([f, n]) => field([...p, "reward", f], n, "number")).join("")}</div>
          ${k.names ? `<div class="field-row">${k.names.map(([f, n]) => field([...p, "reward", f], n, "text")).join("")}</div>` : ""}`
        : `<p class="empty">Wähle zuerst eine Kategorie.</p>`}
      </div>`;
  }

  if (cms.section === "events") {
    const eventCategories = [...new Set(Object.values(cms.content.adventures).flatMap(a => Object.values(a.events || {}).map(x => x.category)).filter(Boolean))];
    html += `
      <datalist id="event-categories">${eventCategories.map(x => `<option value="${escapeHtml(x)}"></option>`).join("")}</datalist>
      <div class="group">
        <div class="field-row">
          ${field([...p, "name"], "Name", "text")}
          ${field([...p, "category"], "Kategorie", "text", { list: "event-categories", help: "z. B. Segen, Fluch, Duell, Ruhe" })}
        </div>
        ${field([...p, "visibility"], "Wer sieht das Ereignis?", "segment", { values: { public: "Öffentlich: alle", private: "Privat: ein Spieler" } })}
        <p class="explain">${e.visibility === "private"
          ? "Privat: Die App wählt einen Spieler aus, bevorzugt jemanden, der bisher wenige geheime Ereignisse hatte. Nur er sieht den Text auf seiner QR-Seite. Am Spielleiter-Handy steht nur „Geheimes Ereignis für …“."
          : "Öffentlich: Das Ereignis wird am Spielleiter-Handy für alle aufgedeckt."}</p>
        ${field([...p, "description"], e.visibility === "private" ? "Text für den Spieler" : "Beschreibung", "textarea", { rows: 5,
          help: e.visibility === "private" ? "Sprich den Spieler direkt an, z. B. „Bring jemanden dazu, das Wort Drache zu sagen.“" : "" })}
        ${e.visibility === "private" ? `
          ${field([...p, "privateType"], "Wann gibt es die Münzen?", "segment", { values: { instant: "Sofort", task: "Wenn die Aufgabe geschafft ist" }, defaultValue: "instant" })}
          <p class="explain">${(e.privateType || "instant") === "task"
            ? "Aufgabe: Der Spieler sagt dem Spielleiter, wenn er es geschafft hat. Der Spielleiter bestätigt das im Geldbeutel, dann bucht die App die Münzen."
            : "Sofort: Die App bucht die Münzen, sobald das Ereignis eintritt. Bei 0 ist es nur eine geheime Information."}</p>
          ${field([...p, "privateCoins"], "Münzen für den Spieler", "number", { help: "Minus heißt Verlust, z. B. −2" })}`
        : field([...p, "effect"], "Was die App dabei tut", "select", { values: EFFECT_MECHANICS, help: "Die App kann nur diese Wirkungen. Neue müssen programmiert werden." })}
      </div>
      <div class="group">
        <h3>Partien ohne Rollen</h3>
        ${e.visibility !== "private" && CATALOG.roleEffects.includes(e.effect)
          ? `<p class="explain">Diese Wirkung braucht Rollen (Raten, Erratene, Erkennungsmerkmale). Das Ereignis kommt deshalb nur in Partien mit Rollen vor.</p>`
          : `${field([...p, "requiresRoles"], "Wann kommt das Ereignis vor?", "flag", { values: { false: "Immer", true: "Nur mit Rollen" }, defaultValue: false })}
            <p class="explain">${e.requiresRoles === true
              ? "Nur mit Rollen: In Partien, die ohne Rollen gespielt werden, bleibt die Karte aus dem Stapel."
              : "Immer: Die Karte kommt auch in Partien ohne Rollen vor. Bezieht sich der Text auf Rollen, stell hier „Nur mit Rollen“ ein."}</p>`}
      </div>`;
  }
  return html;
}

function ask(kind) { cms.dialog = { kind }; renderEditor(); document.querySelector(".confirm .btn")?.focus(); }
function confirmHtml() {
  const f = cms.dialog;
  const cancelButton = `<button class="btn quiet small" onclick="cms.dialog = null; renderEditor()">Abbrechen</button>`;
  if (f.kind === "delete-entry") {
    const e = currentEntry();
    return `<div class="confirm" role="alertdialog"><p>„${escapeHtml(e?.name || "Ohne Namen")}“ für alle löschen? Das lässt sich nicht rückgängig machen.</p>
      <button class="btn danger solid small" onclick="deleteEntry()">Ja, löschen</button>${cancelButton}</div>`;
  }
  if (f.kind === "delete-adventure") {
    return `<div class="confirm" role="alertdialog"><p>Das ganze Abenteuer „${escapeHtml(currentAdventure().name)}“ mit allen Rollen, Minispielen und Ereignissen löschen?</p>
      <button class="btn danger solid small" onclick="deleteAdventure()">Ja, alles löschen</button>${cancelButton}</div>`;
  }
  if (f.kind === "import") {
    return `<div class="confirm" role="alertdialog"><p>Den gesamten Inhalt durch die Datei ersetzen? Alle aktuellen Inhalte werden überschrieben.</p>
      <button class="btn danger solid small" onclick="importContent()">Ja, ersetzen</button>${cancelButton}</div>`;
  }
  if (f.kind === "reset") {
    return `<div class="confirm" role="alertdialog"><p>Vorschau auf den Startinhalt zurücksetzen?</p>
      <button class="btn danger solid small" onclick="resetPreview()">Zurücksetzen</button>${cancelButton}</div>`;
  }
  return "";
}

async function loadTeam() {
  if (!LIVE) return;
  const [team, history] = await Promise.all([
    sb.from("editors").select("email, added_at").order("email"),
    sb.from("history").select("at, who, path, kind").order("id", { ascending: false }).limit(60)
  ]);
  cms.team = team.data || [];
  cms.history = history.data || [];
  if (cms.section === "team") renderEditor();
}

function teamHtml() {
  if (!LIVE) return headerHtml("Zusammenarbeit", "Team & Verlauf") + `<div class="message">Im Vorschau-Modus gibt es kein Team. Sobald du in <strong>connection.js</strong> deine Supabase-Daten einträgst, kannst du hier Leute einladen und siehst, wer was geändert hat.</div>`;
  if (!cms.canEdit) return headerHtml("Zusammenarbeit", "Team & Verlauf") + passwordHtml() + `<div class="message">Das Team und den Verlauf sieht nur, wer selbst im Team ist.</div>`;
  return `
    ${headerHtml("Zusammenarbeit", "Team & Verlauf")}
    ${passwordHtml()}
    <div class="group">
      <h3>Wer darf bearbeiten?</h3>
      <p class="explain">Wer hier steht, kann mitarbeiten. Schick der Person den Link zu diesem CMS. Sie meldet sich einmal per Anmeldelink an und legt dann hier ein eigenes Passwort fest.</p>
      <div class="table">
        ${cms.team.map(t => `
          <div class="table-row"><span>${escapeHtml(t.email)}${t.email === cms.me ? " (du)" : ""}</span>
            ${cms.team.length > 1 ? `<button class="btn danger small" onclick="removeMember('${escapeHtml(t.email)}')">Entfernen</button>` : ""}
          </div>`).join("")}
      </div>
      <form class="inline-form" onsubmit="event.preventDefault(); addMember(this.email.value); this.reset()">
        <input name="email" id="team-email" type="email" required placeholder="name@beispiel.de" aria-label="E-Mail-Adresse">
        <button class="btn" type="submit">Hinzufügen</button>
      </form>
    </div>
    <div class="group">
      <h3>Letzte Änderungen</h3>
      <div class="table">
        ${cms.history.length ? cms.history.map(v => `
          <div class="table-row"><span><strong>${escapeHtml((v.who || "?").split("@")[0])}</strong> ${escapeHtml(historyText(v))}</span><span class="history-time">${escapeHtml(timeText(v.at))}</span></div>`).join("")
          : `<p class="empty">Noch keine Änderungen.</p>`}
      </div>
    </div>`;
}

const FIELD_LABELS = { privateType: "Wann Münzen", privateCoins: "Münzen", name: "Name", startingCoins: "Startkapital", background: "Hintergrundgeschichte", character: "Charakter",
  traits: "Erkennungsmerkmale", ability: "Fähigkeit", task: "Geheime Aufgabe", text: "Beschreibung", mechanic: "Mechanik", bonus: "Bonus",
  category: "Kategorie", description: "Beschreibung", reward: "Belohnung", visibility: "Sichtbarkeit", effect: "Wirkung", setting: "Setting",
  requiresRoles: "Nur mit Rollen",
  story: "Geschichte", epilogue: "Schlusstext", terms: "Begriffe", title: "Überschrift", paragraphs: "Text", closing: "Letzter Satz",
  before: "Text vorher", after: "Text nachher", pos: "Reihenfolge" };
function historyText(v) {
  const p = v.path || [];
  if (v.kind === "imported") return "hat eine JSON-Datei importiert";
  if (p[0] === "team") return v.kind === "added" ? `hat ${p[1]} ins Team geholt` : `hat ${p[1]} aus dem Team entfernt`;
  const parts = [];
  const a = cms.content.adventures[p[1]];
  parts.push(a?.name || p[1]);
  const b = SECTIONS.find(x => x.id === p[2]);
  if (b && b.list) {
    parts.push(b.name);
    if (p[3]) parts.push(a?.[p[2]]?.[p[3]]?.name || p[3]);
    p.slice(4).forEach(t => parts.push(FIELD_LABELS[t] || t));
  } else p.slice(2).forEach(t => parts.push(FIELD_LABELS[t] || t));
  const verb = v.kind === "deleted" ? "hat gelöscht:" : (p.length === 4 || p.length === 2) ? "hat angelegt:" : "hat geändert:";
  return `${verb} ${parts.join(" › ")}`;
}

async function addMember(email) {
  const { error } = await sb.rpc("editor_add", { new_email: email });
  if (error) setStatus("error", error.message);
  loadTeam();
}
async function removeMember(email) {
  const { error } = await sb.rpc("editor_remove", { old_email: email });
  if (error) setStatus("error", error.message);
  loadTeam();
}

function fileHtml() {
  const address = LIVE ? `${PROJECT_URL}/rest/v1/content?id=eq.valdrien&select=data&apikey=${ANON_KEY}` : "";
  return `
    ${headerHtml("Inhalt als Datei", "JSON-Datei")}
    <div class="group">
      <h3>Herunterladen</h3>
      <p class="explain">Der gesamte Inhalt aller Abenteuer als eine JSON-Datei. Gut als Sicherung, bevor ihr Großes ändert.</p>
      <div><button class="btn" onclick="exportContent()">JSON-Datei herunterladen</button></div>
    </div>
    ${LIVE ? `
    <div class="group">
      <h3>Öffentliche Adresse</h3>
      <p class="explain">Unter dieser Adresse kann jeder den aktuellen Inhalt als JSON abrufen, auch ohne Konto. Das Spiel liest ihn von hier.</p>
      <code class="address">${escapeHtml(address)}</code>
    </div>` : ""}
    ${cms.canEdit ? `
    <div class="group">
      <h3>Hochladen und ersetzen</h3>
      <p class="explain">Ersetzt den gesamten Inhalt durch eine JSON-Datei, z. B. eine frühere Sicherung.</p>
      <input type="file" id="import-file" accept="application/json,.json" onchange="prepareImport(this.files[0])">
      ${cms.message ? `<div class="message error">${escapeHtml(cms.message)}</div>` : ""}
    </div>` : ""}
    ${!LIVE ? `
    <div class="group">
      <h3>Vorschau zurücksetzen</h3>
      <div><button class="btn danger" onclick="ask('reset')">Auf Startinhalt zurücksetzen</button></div>
    </div>` : ""}`;
}

function exportContent() {
  const blob = new Blob([JSON.stringify(cms.content, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `valdrien-content-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function prepareImport(file) {
  cms.message = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = upgradeContent(JSON.parse(reader.result));
      if (!data || typeof data.adventures !== "object" || !Object.keys(data.adventures).length) throw new Error("form");
      cms.importData = data;
      ask("import");
    } catch (e) {
      cms.message = "Diese Datei ist keine gültige Valdrien-Inhaltsdatei.";
      renderEditor();
    }
  };
  reader.readAsText(file);
}

async function importContent() {
  const content = cms.importData;
  cms.dialog = null; cms.importData = null;
  if (!content) return;
  if (!LIVE) {
    takeContent(content, cms.version + 1);
    try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(content)); } catch (e) {}
    render(); return;
  }
  setStatus("saving");
  const { data: version, error } = await sb.rpc("content_replace", { data: content });
  if (error) { setStatus("error", error.message); renderEditor(); return; }
  takeContent(content, version);
  setStatus("ready");
  render();
}

function resetPreview() {
  try { localStorage.removeItem(PREVIEW_KEY); } catch (e) {}
  cms.dialog = null;
  takeContent(structuredClone(window.VALDRIEN_INITIAL_CONTENT), 1);
  render();
}

function chooseAdventure(id) {
  if (id === "__new") { newAdventure(); return; }
  cms.adventure = id; cms.entry = null; cms.dialog = null; cms.search = "";
  render(); reportPlace();
}
function chooseSection(id) {
  cms.section = id; cms.entry = null; cms.dialog = null; cms.search = ""; cms.message = "";
  if (id === "team") loadTeam();
  render(); reportPlace();
}
function openEntry(id) {
  cms.entry = id; cms.dialog = null;
  render(); reportPlace();
  if (id && window.innerWidth <= 900) window.scrollTo(0, 0);
}

const TEMPLATES = {
  roles: () => ({ name: "Neue Rolle", title: "", startingCoins: 4, background: "", character: "", traits: [],
    ability: { name: "", text: "", mechanic: "" }, task: { name: "", text: "", bonus: 2 } }),
  minigames: () => ({ name: "Neues Minispiel", category: "all", description: "", reward: { winner: 2 } }),
  events: () => ({ name: "Neues Ereignis", category: "", visibility: "public", description: "", effect: "calm", requiresRoles: false })
};

function nextPos(collection) { return Math.max(0, ...Object.values(collection || {}).map(e => e.pos || 0)) + 10; }

function newEntry() {
  const collection = currentAdventure()[cms.section] || {};
  const fresh = Object.assign({ pos: nextPos(collection) }, TEMPLATES[cms.section]());
  const id = slug(fresh.name) + "-" + shortId();
  change([...basePath(), cms.section, id], fresh, true);
  openEntry(id);
  const nameInput = document.querySelector('[data-path$="\u0001name"]');
  if (nameInput) { nameInput.focus(); nameInput.select(); }
}

function duplicate() {
  const e = currentEntry();
  if (!e) return;
  const copy = structuredClone(e);
  copy.name = (e.name || "Eintrag") + " (Kopie)";
  copy.pos = (e.pos || 0) + 1;
  const id = slug(copy.name) + "-" + shortId();
  change([...basePath(), cms.section, id], copy, true);
  openEntry(id);
}

function deleteEntry() {
  change([...basePath(), cms.section, cms.entry], null, true);
  cms.dialog = null;
  openEntry(null);
}

function move(direction) {
  const list = byPos(currentAdventure()[cms.section]);
  const i = list.findIndex(([id]) => id === cms.entry);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return;
  const [idA, a] = list[i], [idB, b] = list[j];
  let posA = b.pos ?? j * 10, posB = a.pos ?? i * 10;
  if (posA === posB) posA += direction * 5;
  const p = [...basePath(), cms.section];
  change([...p, idA, "pos"], posA, true);
  change([...p, idB, "pos"], posB, true);
  renderList();
}

function newAdventure() {
  const id = "adventure-" + shortId();
  const fresh = {
    pos: nextPos(cms.content.adventures), name: "Neues Abenteuer", setting: "",
    story: { title: "", paragraphs: [], closing: "" },
    epilogue: { title: "", before: [], after: ["Herzlichen Glückwunsch, {winner}!"] },
    terms: { question: "Wer spielt mit?", player: "Spieler", plural: "Spieler", dative: "Spielern", finish: "Abenteuer beenden" },
    roles: {}, minigames: {}, events: {}
  };
  change(["adventures", id], fresh, true);
  cms.adventure = id; cms.section = "adventures"; cms.entry = null;
  render(); reportPlace();
  const nameInput = document.getElementById("f-adventures-" + slug(id) + "-name");
  if (nameInput) { nameInput.focus(); nameInput.select(); }
}

function deleteAdventure() {
  const id = cms.adventure;
  change(["adventures", id], null, true);
  cms.dialog = null;
  cms.adventure = byPos(cms.content.adventures)[0]?.[0] || null;
  cms.section = "adventures";
  render(); reportPlace();
}

function signInHtml() {
  if (cms.phase === "link-sent") return `
    <div class="signin"><div class="signin-card">
      <span class="eyebrow">Redaktion</span><h1>Schau in dein Postfach</h1>
      <p>Wir haben einen Anmeldelink an <strong>${escapeHtml(cms.signInEmail)}</strong> geschickt. Öffne ihn auf diesem Gerät, dann bist du drin.</p>
      <p class="explain">Keine Mail da? Schau im Spam-Ordner nach.</p>
      <button class="btn quiet" onclick="cms.phase = 'signin'; render()">Andere Adresse verwenden</button>
    </div></div>`;
  const withLink = cms.signInMethod === "link";
  return `
    <div class="signin"><div class="signin-card">
      <span class="eyebrow">Redaktion</span><h1>Valdrien</h1>
      ${withLink ? `
        <p>Du bekommst einen Anmeldelink per E-Mail, ein Klick genügt. Supabase schickt davon nur wenige pro Stunde.</p>
        <form onsubmit="event.preventDefault(); sendMagicLink(this.email.value)" style="display:flex; flex-direction:column; gap:10px">
          <input name="email" id="signin-email" type="email" required autocomplete="email" placeholder="name@beispiel.de" aria-label="E-Mail-Adresse" value="${escapeHtml(cms.signInEmail || "")}">
          <button class="btn" type="submit">Anmeldelink schicken</button>
        </form>
        <button class="btn quiet" onclick="cms.signInMethod = 'password'; cms.message = ''; render()">Mit Passwort anmelden</button>` : `
        <p>Melde dich mit deiner E-Mail-Adresse und deinem Passwort an. Danach bleibst du in diesem Browser angemeldet.</p>
        <form onsubmit="event.preventDefault(); passwordSignIn(this.email.value, this.password.value)" style="display:flex; flex-direction:column; gap:10px">
          <input name="email" id="signin-email" type="email" required autocomplete="username" placeholder="name@beispiel.de" aria-label="E-Mail-Adresse" value="${escapeHtml(cms.signInEmail || "")}">
          <input name="password" id="signin-password" type="password" required autocomplete="current-password" placeholder="Passwort" aria-label="Passwort">
          <button class="btn" type="submit">Anmelden</button>
        </form>
        <button class="btn quiet" onclick="cms.signInMethod = 'link'; cms.message = ''; render()">Noch kein Passwort? Anmeldelink per E-Mail</button>`}
      ${cms.message ? `<div class="message error">${escapeHtml(cms.message)}</div>` : ""}
    </div></div>`;
}

async function passwordSignIn(email, password) {
  cms.message = "";
  cms.signInEmail = email;
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    cms.message = /invalid login|invalid credentials/i.test(error.message)
      ? "E-Mail oder Passwort stimmt nicht. Noch kein Passwort? Melde dich einmal per Anmeldelink an und lege es dann unter „Team & Verlauf“ fest."
      : /not confirmed/i.test(error.message)
        ? "Diese E-Mail-Adresse ist noch nicht bestätigt. Bitte melde dich einmal per Anmeldelink an."
        : "Das hat nicht geklappt: " + error.message;
    render();
  }
}

async function setPassword(form) {
  const p1 = form.password.value, p2 = form.repeat.value;
  cms.passwordMessage = null;
  if (p1.length < 8) cms.passwordMessage = { error: true, text: "Bitte mindestens 8 Zeichen." };
  else if (p1 !== p2) cms.passwordMessage = { error: true, text: "Die beiden Passwörter sind nicht gleich." };
  else {
    const { error } = await sb.auth.updateUser({ password: p1 });
    cms.passwordMessage = error
      ? { error: true, text: "Das hat nicht geklappt: " + error.message }
      : { error: false, text: "Passwort gespeichert. Ab jetzt kannst du dich damit anmelden, auch auf anderen Geräten." };
  }
  renderEditor();
}

function passwordHtml() {
  if (!LIVE) return "";
  const m = cms.passwordMessage;
  return `
    <div class="group">
      <h3>Mein Passwort</h3>
      <p class="explain">Mit einem Passwort meldest du dich ohne Mail an. Angemeldet ist gerade: ${escapeHtml(cms.me)}.</p>
      <form class="inline-form" onsubmit="event.preventDefault(); setPassword(this)">
        <input type="email" name="username" value="${escapeHtml(cms.me)}" autocomplete="username" hidden>
        <input name="password" id="new-password" type="password" minlength="8" required autocomplete="new-password" placeholder="Neues Passwort" aria-label="Neues Passwort">
        <input name="repeat" id="password-repeat" type="password" minlength="8" required autocomplete="new-password" placeholder="Wiederholen" aria-label="Passwort wiederholen">
        <button class="btn" type="submit">Speichern</button>
      </form>
      ${m ? `<div class="message ${m.error ? "error" : ""}">${escapeHtml(m.text)}</div>` : ""}
    </div>`;
}

async function sendMagicLink(email) {
  cms.message = "";
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) {
    const pathError = /invalid path/i.test(error.message);
    cms.message = pathError
      ? `Die Projektadresse in connection.js stimmt nicht. Das CMS verwendet gerade: ${PROJECT_URL}. Sie muss so aussehen: https://abcdefgh.supabase.co`
      : /rate limit|too many/i.test(error.message)
        ? "Supabase hat gerade zu viele Anmeldemails verschickt. Bitte versuche es in einer Stunde noch einmal."
        : "Das hat nicht geklappt: " + error.message;
    render(); return;
  }
  cms.signInEmail = email;
  cms.phase = "link-sent";
  render();
}

async function logout() {
  if (presenceChannel) { await presenceChannel.untrack().catch(() => {}); }
  await sb.auth.signOut();
  location.reload();
}

start();
