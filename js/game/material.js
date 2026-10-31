// Preparation: everything the minigames and event cards of an adventure need on the table, following the settings
// (drinking game, roles) and the number of players. "Streichhölzer: 3 pro Spieler" is counted for the table.
// Ticks are a per-device convenience (localStorage), never part of the game.

// Before a game: the adventure and the names being set up; during a game: the dealt one.
function materialSetup() {
  const fromSetup = state.screen === "names" || (state.screen === "material" && (state.backTo || {}).material === "names");
  const running = !fromSetup && Boolean(state.running && state.players && state.players.length);
  return {
    adventure: running ? currentAdventure() : setupAdventure(),
    players: running ? state.players.length : state.names.filter(n => String(n).trim()).length || state.names.length,
    roles: running ? rolesOn() : settings.roles !== false
  };
}

function materialItems() {
  const { adventure: a, players, roles } = materialSetup();
  const items = new Map();
  const add = (line, source) => {
    const item = items.get(line) || { line, text: materialText(line, players), sources: [] };
    if (source && !item.sources.includes(source)) item.sources.push(source);
    items.set(line, item);
  };
  const general = [];
  general.push({ line: "Dieses Handy für den Spielleiter, aufgeladen", text: "Dieses Handy für den Spielleiter, aufgeladen", sources: [] });
  general.push({ line: "Wer mag: das eigene Handy für die QR-Seite", text: "Wer mag: das eigene Handy für die QR-Seite", sources: [] });
  if (drinkingOn() && hasDrinkingCards(a)) {
    const line = "Getränke: 1 pro Spieler (Wasser oder Saft zählen genauso)";
    general.push({ line, text: materialText(line, players), sources: [] });
  }
  a.minigames.forEach(m => { if (!m.deleted && (drinkingOn() || !m.drinking)) m.material.forEach(line => add(line, m.title)); });
  const minigames = [...items.values()];
  items.clear();
  a.events.forEach(e => {
    if (e.deleted || e.retired || (!roles && e.requiresRoles) || (!drinkingOn() && e.drinking)) return;
    e.material.forEach(line => add(line, e.title));
  });
  return { general, minigames, events: [...items.values()] };
}

function materialText(line, players) {
  const match = /^(.*?):\s*(\d+)\s+pro Spieler(.*)$/.exec(line);
  if (!match || !players) return line;
  const [, thing, each, rest] = match;
  return `${thing}: ${Number(each) * players} (${each} pro Spieler${rest})`;
}

function materialTicks() {
  try { return JSON.parse(localStorage.getItem("valdrien-material-" + materialSetup().adventure.id) || "[]"); } catch (e) { return []; }
}
function toggleMaterial(k) {
  const all = materialItems();
  const item = [...all.general, ...all.minigames, ...all.events][k];
  if (!item) return;
  const ticks = materialTicks();
  const next = ticks.includes(item.line) ? ticks.filter(x => x !== item.line) : ticks.concat(item.line);
  try { localStorage.setItem("valdrien-material-" + materialSetup().adventure.id, JSON.stringify(next)); } catch (e) {}
  render();
}

function screenMaterial() {
  const { adventure: a, players, roles } = materialSetup();
  const lists = materialItems();
  const ticks = materialTicks();
  let k = 0;
  const group = (title, list) => list.length ? `
    <span class="label">${title}</span>
    <div class="material-list">${list.map(item => {
      const done = ticks.includes(item.line);
      return `
      <label class="material-item ${done ? "done" : ""}">
        <input type="checkbox" ${done ? "checked" : ""} onchange="toggleMaterial(${k++})">
        <strong>${item.text}</strong>
        ${item.sources.length ? `<span class="muted">für ${item.sources.join(", ")}</span>` : ""}
      </label>`;
    }).join("")}</div>` : "";
  const facts = [`${players} ${players === 1 ? a.player : a.plural}`, roles ? "mit Rollen" : "ohne Rollen"];
  if (hasDrinkingCards(a)) facts.push(drinkingOn() ? "mit Trinkspiel" : "ohne Trinkspiel");
  return `
    <div class="heading"><span class="eyebrow">Vorbereitung</span><h2>Materialliste</h2></div>
    <p class="muted">Für ${a.title}: ${facts.join(", ")}. Die Liste folgt den Einstellungen; zum Abhaken einfach antippen.</p>
    ${group("Für jede Partie", lists.general)}
    ${group("Für die Minispiele", lists.minigames)}
    ${group("Für die Ereigniskarten", lists.events)}
    ${!lists.minigames.length && !lists.events.length ? `<p class="note">Die Minispiele und Ereigniskarten dieses Abenteuers brauchen kein Material.</p>` : ""}
    <button class="btn-quiet" onclick="openReference('settings')">Einstellungen ändern</button>`;
}

function materialCard() {
  const lists = materialItems();
  const count = lists.minigames.length + lists.events.length;
  return `
    <section class="mode-card" aria-label="Vorbereitung">
      <div class="mode-head">
        <span class="mode-icon">${icon("list")}</span>
        <span class="mode-title"><span class="label">Vorbereitung</span><strong>Materialliste</strong></span>
        <button class="mode-change" onclick="openReference('material')">Ansehen</button>
      </div>
      <ul class="mode-facts"><li>${count ? `${count} ${count === 1 ? "Sache" : "Sachen"} für Minispiele und Karten, passend zu euren Einstellungen.` : "Nichts Besonderes nötig, nur dieses Handy."}</li></ul>
    </section>`;
}

Object.assign(SCREENS, {
  material: screenMaterial
});
