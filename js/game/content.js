const CATEGORY_NAMES = Object.fromEntries(Object.entries(CATALOG.categories).map(([id, k]) => [id, k.name]));

const ADVENTURES = {};
let WORLD = { name: "Valdrien", motto: "Ein Land voller Abenteuer, Geheimnisse und Gefährten, denen du nicht ganz trauen solltest." };
let lastContent = null;
let contentVersion = 0;
let contentSource = "builtin";

function convertRole(id, r) {
  return {
    id,
    name: escapeHtml(r.name || "Ohne Namen"),
    title: escapeHtml(r.title || ""),
    startingCoins: num(r.startingCoins, RULES.startingCoinsFallback),
    background: escapeHtml(r.background || ""),
    character: escapeHtml(r.character || ""),
    traits: (Array.isArray(r.traits) ? r.traits : []).map(escapeHtml),
    ability: {
      mechanic: r.ability?.mechanic || "",
      name: escapeHtml(r.ability?.name || "Fähigkeit"),
      text: escapeHtml(r.ability?.text || "")
    },
    task: {
      name: escapeHtml(r.task?.name || "Geheime Aufgabe"),
      text: escapeHtml(r.task?.text || ""),
      bonus: num(r.task?.bonus, 0)
    }
  };
}

function convertEvent(id, e) {
  return {
    id,
    title: escapeHtml(e.name || "Ohne Namen"),
    category: escapeHtml(e.category || ""),
    effect: e.effect || "calm",
    text: escapeHtml(e.description || ""),
    isPrivate: e.visibility === "private",
    requiresRoles: eventRequiresRoles(e),
    retired: eventRetired(e),
    privateType: e.privateType === "task" ? "task" : "instant",
    privateCoins: num(e.privateCoins, 0)
  };
}

function convertMinigame(id, m) {
  const b = m.reward || {};
  const category = CATEGORY_NAMES[m.category] ? m.category : "all";
  const mg = { id, title: escapeHtml(m.name || "Ohne Namen"), category, text: escapeHtml(m.description || "") };
  const fields = CATALOG.categories[category].fields.map(([field]) => field);
  fields.forEach(f => { if (typeof b[f] === "number") mg[f] = b[f]; });
  if (category === "duel" || category === "all") mg.winner = num(mg.winner, 0);
  if (category === "oneVsAll") mg.solo = num(mg.solo, 0);
  if (category === "team") mg.team = num(mg.team, 0);
  if (category === "uneven") {
    mg.single = num(mg.single, 0); mg.pair = num(mg.pair, 0);
    mg.singleName = escapeHtml(b.singleName || "Einzelner"); mg.pairName = escapeHtml(b.pairName || "Paar");
  }
  return mg;
}

function placeholder(kind, id) {
  if (kind === "roles") return convertRole(id, { name: "Gelöschte Rolle", startingCoins: 0 });
  if (kind === "events") return convertEvent(id, { name: "Gelöschtes Ereignis", effect: "calm" });
  return convertMinigame(id, { name: "Gelöschtes Minispiel", category: "all" });
}

// During a running game every entry keeps its slot (state stores indices):
// deleted entries stay as placeholders, new entries are appended.
function convertAdventure(id, a, before, slots) {
  const arrange = (kind, convert) => {
    const fresh = byPos(a[kind]);
    const freshById = new Map(fresh);
    const result = [];
    const seen = new Set();
    ((slots && slots[kind]) || []).forEach(entryId => {
      seen.add(entryId);
      if (freshById.has(entryId)) result.push(convert(entryId, freshById.get(entryId)));
      else {
        const old = before && before[kind] && before[kind].find(x => x.id === entryId);
        result.push(Object.assign({}, old || placeholder(kind, entryId), { deleted: true }));
      }
    });
    fresh.forEach(([entryId, w]) => { if (!seen.has(entryId)) result.push(convert(entryId, w)); });
    return result;
  };
  const g = a.story || {}, s = a.epilogue || {}, w = a.terms || {};
  const title = escapeHtml(s.title || "Das Abenteuer ist vorbei");
  const beforeText = (s.before || []).map(escapeHtml);
  const afterText = (s.after || []).map(escapeHtml);
  const adventure = {
    id,
    title: escapeHtml(a.name || "Neues Abenteuer"),
    setting: escapeHtml(a.setting || ""),
    goal: a.goal === "keys" ? "keys" : "coins",
    question: escapeHtml(w.question || "Wer spielt mit?"),
    player: escapeHtml(w.player || "Spieler"),
    plural: escapeHtml(w.plural || "Spieler"),
    dative: escapeHtml(w.dative || "Spielern"),
    finish: escapeHtml(w.finish || "Abenteuer beenden"),
    introTitle: escapeHtml(g.title || a.name || ""),
    intro: (g.paragraphs || []).map(escapeHtml),
    introEnd: escapeHtml(g.closing || ""),
    roles: arrange("roles", convertRole),
    events: arrange("events", convertEvent),
    minigames: arrange("minigames", convertMinigame),
    epilogue: (winner, several) => {
      const fill = p => p.split("{winner}").join(winner);
      return `
        <p class="ornament">✦ ✦ ✦</p>
        <h1>${title}</h1>
        ${beforeText.length ? `<div class="narrative">${beforeText.map(p => `<p>${fill(p)}</p>`).join("")}</div>` : ""}
        <p class="winner">${winner}</p>
        ${afterText.length ? `<div class="narrative">${afterText.map((p, i) => i === afterText.length - 1
          ? `<p class="closing">${fill(p)}</p>` : `<p>${fill(p)}</p>`).join("")}</div>` : ""}`;
    }
  };
  const activeRoles = adventure.roles.filter(r => !r.deleted).length;
  const activeEvents = adventure.events.filter(e => !e.deleted && !e.retired).length;
  const eventsWithoutRoles = adventure.events.filter(e => !e.deleted && !e.retired && !e.requiresRoles).length;
  adventure.playableWithRoles = activeRoles >= RULES.adventureMinRoles && activeEvents >= RULES.adventureMinEvents;
  adventure.playableWithoutRoles = eventsWithoutRoles >= RULES.adventureMinEvents;
  return adventure;
}

function applyContent(data, source) {
  data = upgradeContent(data);
  if (!data || typeof data.adventures !== "object" || !Object.keys(data.adventures).length) return false;
  const running = Boolean(state && state.players && state.players.length && state.adventure);
  const before = Object.assign({}, ADVENTURES);
  Object.keys(ADVENTURES).forEach(k => delete ADVENTURES[k]);
  for (const [id, a] of byPos(data.adventures)) {
    const slots = running && state.slots && state.slots.adventure === id ? state.slots : null;
    ADVENTURES[id] = convertAdventure(id, a, before[id], slots);
  }
  if (running && !ADVENTURES[state.adventure] && before[state.adventure]) {
    ADVENTURES[state.adventure] = Object.assign(before[state.adventure], { hidden: true });
  }
  if (data.world) WORLD = { name: escapeHtml(data.world.name || "Valdrien"), motto: escapeHtml(data.world.motto || "") };
  lastContent = data;
  contentSource = source;
  selectAdventureData(state.adventure);
  if (running) {
    rememberSlots();
    if (Array.isArray(state.eventDeck)) syncEventDeck();
  }
  return true;
}

function rememberSlots() {
  state.slots = {
    adventure: state.adventure,
    roles: ROLES.map(r => r.id),
    events: EVENTS.map(e => e.id),
    minigames: MINIGAMES.map(m => m.id)
  };
}

function activeIndices(list) { return list.map((_, i) => i).filter(i => !list[i].deleted); }
// Event cards that may be drawn in this game: without roles, role events stay out; so do events with a retired effect.
function playableEvents() { return activeIndices(EVENTS).filter(i => !EVENTS[i].retired && (rolesOn() || !EVENTS[i].requiresRoles)); }

let ROLES = [];
let EVENTS = [];
let MINIGAMES = [];

function firstAdventure() { return ADVENTURES[Object.keys(ADVENTURES)[0]]; }

function selectAdventureData(id) {
  const a = ADVENTURES[id] || firstAdventure();
  if (!a) return;
  ROLES = a.roles;
  EVENTS = a.events;
  MINIGAMES = a.minigames;
}

function currentAdventure() { return ADVENTURES[state.adventure] || firstAdventure(); }
// The adventure picked for the next game (adventure choice, names screen). state.adventure and ROLES/EVENTS/MINIGAMES
// stay with the dealt game until the new one is dealt, so browsing the choice never touches a game in progress.
function setupAdventure() { return ADVENTURES[state.setupAdventure] || currentAdventure(); }

function roleCount(a = currentAdventure()) { return a ? a.roles.filter(r => !r.deleted).length : 0; }
// Before dealing, the settings decide whether roles are dealt.
function maxPlayers() { return settings.roles !== false ? roleCount(setupAdventure()) : RULES.maxPlayersWithoutRoles; }
function playable(a) { return settings.roles !== false ? a.playableWithRoles : a.playableWithoutRoles; }

function afterContentUpdate() {
  if (own) { renderOwn(); return; }
  if (state.screen === "names") return;
  render();
}

async function fetchContent() {
  if (!PROJECT_URL || !PROJECT_KEY) return;
  try {
    const response = await fetch(`${PROJECT_URL}/rest/v1/content?id=eq.valdrien&select=data,version`,
      { headers: { apikey: PROJECT_KEY }, cache: "no-store" });
    if (!response.ok) return;
    const rows = await response.json();
    const row = rows && rows[0];
    if (!row || (row.version === contentVersion && contentSource === "live")) return;
    if (!applyContent(row.data, "live")) return;
    contentVersion = row.version;
    try { localStorage.setItem("valdrien-content", JSON.stringify({ version: row.version, data: row.data })); } catch (e) {}
    save();
    afterContentUpdate();
  } catch (e) { /* offline: keep the current content */ }
}

function subscribeContent() {
  let pending = null;
  const soon = () => { clearTimeout(pending); pending = setTimeout(fetchContent, 300); };
  if (window.supabase && PROJECT_URL && PROJECT_KEY) {
    try {
      window.supabase.createClient(PROJECT_URL, PROJECT_KEY, { auth: { persistSession: false } })
        .channel("game-content")
        .on("postgres_changes", { event: "*", schema: "public", table: "content" }, soon)
        .subscribe();
    } catch (e) {}
  }
  setInterval(fetchContent, 120000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) fetchContent(); });
  window.addEventListener("online", fetchContent);
}
