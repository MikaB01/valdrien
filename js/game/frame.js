const REFERENCE_SCREENS = ["rules", "settings", "quickGuide", "coins", "material"];

// from: where the back button leads, when a reference screen links to another one (rules -> quick guide)
function openReference(target, from) {
  state.backTo = state.backTo || {};
  const here = state.screen;
  if (here !== target) {
    state.backTo[target] = from || (REFERENCE_SCREENS.includes(here) ? (state.backTo[here] || "start") : here);
  }
  state.cardVisible = false;
  if (state.peekRole) state.peekRole.open = false;
  show(target);
}

function backAction() {
  const go = target => () => show(target);
  const s = state.screen;
  if (REFERENCE_SCREENS.includes(s)) {
    const target = (state.backTo || {})[s] || (state.running ? "overview" : "start");
    return go(target);
  }
  switch (s) {
    case "adventures": return go("start");
    case "names": return go("adventures");
    case "overview": return go("start");
    case "roles": return go("overview");
    case "myRole": {
      const m = state.peekRole;
      if (!m || m.player === null) return go("overview");
      if (!m.open) return () => startMyRole();
      return closeMyRole;
    }
    case "guess": {
      const r = state.guess || {};
      if (r.step === "who" || r.step === "wrong" || r.step === "right") return go("overview");
      if (r.step === "stake") return startGuess;
      return null;
    }
    case "ability": {
      const f = state.ability || {};
      if (f.step === "who") return go("overview");
      if (f.step === "peek") return null;
      return state.players[f.player] && state.players[f.player].abilityUsed ? go("overview") : startAbility;
    }
    case "event": return eventPending() ? null : go("overview");
    case "minigame": return go("overview");
    case "buyCard": return state.buyCard && state.buyCard.player !== null
      ? () => { state.buyCard.player = null; render(); } : go("overview");
    case "tasks": return resumeAdventure;
    case "end":
      if (keysGoal()) return state.escaped !== undefined && state.escaped !== null ? null : resumeAdventure;
      return rolesOn() ? go("tasks") : resumeAdventure;
    case "keyGlimpse": return () => { state.keyGlimpse = null; show("overview"); };
    case "handCard": return state.handCard && state.handCard.played ? finishHandCard : backToSecrets;
    case "buyKey": {
      const b = state.buyKey || {};
      if (b.step === "handover") return () => { state.buyKey = { step: "who", player: null }; render(); };
      if (b.step === "result") return b.player !== undefined && hasAllKeys(b.player) ? null : () => { state.buyKey = null; show("overview"); };
      return go("overview");
    }
  }
  return null;
}

function goBack() {
  if (sheet) { closeSheet(); return; }
  const back = backAction();
  if (back) back();
}

function renderFrame() {
  const back = document.getElementById("btn-back");
  const purse = document.getElementById("btn-purse");
  if (back) back.hidden = !sheet && !backAction();
  const noPurse = ["start", "adventures", "names", "handover", "intro"];
  if (purse) purse.hidden = !(state.players && state.players.length) || noPurse.includes(state.screen);
  const layer = document.getElementById("sheet");
  if (!layer) return;
  layer.hidden = !sheet;
  layer.innerHTML = sheet === "menu" ? menuSheet() : sheet === "purse" ? purseSheet() : "";
}

function openSheet(which) { sheet = sheet === which ? null : which; confirmFinish = false; confirmRedraw = false; taskPick = null; renderFrame(); }
function closeSheet() { sheet = null; confirmFinish = false; confirmRedraw = false; taskPick = null; renderFrame(); }
document.addEventListener("keydown", e => { if (e.key === "Escape" && sheet) closeSheet(); });

function menuSheet() {
  const entry = (iconSvg, text, action) => `<button class="menu-item" onclick="${action}">${iconSvg}<span>${text}</span></button>`;
  const inGame = state.running && state.players && state.players.length;
  return `
    <div class="sheet-panel" role="dialog" aria-modal="true" aria-label="Menü">
      <div class="sheet-header"><h2>Menü</h2></div>
      <div class="menu-list">
        ${entry(icon("rules"), "Regelwerk", "openReference('rules')")}
        ${entry(icon("lightning"), "In einer Minute erklärt", "openReference('quickGuide')")}
        ${entry(icon("settings"), "Einstellungen", "openReference('settings')")}
        ${inGame || ["names", "intro"].includes(state.screen) ? entry(icon("list"), "Materialliste", "openReference('material')") : ""}
      </div>
      ${inGame ? `
        <span class="menu-divider">Dieses Abenteuer</span>
        <div class="menu-list">
          ${entry(icon("secret"), "Geheim nachsehen", "startMyRole()")}
          ${minigamesUsedUp() && !openMinigame()
            ? entry(icon("minigame"), "Minispiele neu einmischen", "sheet = null; reshuffleMinigames()")
            : (openMinigame()
              ? entry(icon("minigame"), "Offenes Minispiel ansehen", "show('minigame')")
              : entry(icon("minigame"), "Minispiel ziehen", "sheet = null; drawMinigame()"))}
          ${openMinigame() && !confirmRedraw ? entry(icon("redraw"), "Anderes Minispiel ziehen", "confirmRedraw = true; renderFrame()") : ""}
          ${openMinigame() && confirmRedraw ? `
            <div class="confirm" role="alertdialog" aria-labelledby="redraw-title">
              <strong id="redraw-title">Wirklich ein anderes Minispiel ziehen?</strong>
              <p class="muted">»${MINIGAMES[openMinigame().index].title}« wird verworfen.</p>
              <button class="btn" onclick="sheet = null; confirmRedraw = false; redrawMinigame()">Ja, neu ziehen</button>
              <button class="link-button" onclick="confirmRedraw = false; renderFrame()">Abbrechen</button>
            </div>` : ""}
          ${rolesOn() ? entry(icon("roles"), "Alle Rollen ansehen", "show('roles')") : ""}
          ${eventsUsedUp()
            ? entry(icon("event"), "Ereignisse neu einmischen", "sheet = null; reshuffleEvents()")
            : entry(icon("event"), "Ereigniskarte jetzt ziehen", "sheet = null; drawEvent(false)")}
          ${confirmFinish ? "" : entry(icon("flag"), currentAdventure().finish, "confirmFinish = true; renderFrame()")}
        </div>
        ${confirmFinish ? `
          <div class="confirm" role="alertdialog" aria-labelledby="confirm-title">
            <strong id="confirm-title">${currentAdventure().finish}?</strong>
            <p class="muted">${rolesOn() ? "Danach werden alle Rollen aufgedeckt und die Münzen gezählt." : "Danach werden die Münzen gezählt."}</p>
            <button class="btn" onclick="finishAdventure()">Ja, jetzt beenden</button>
          </div>` : ""}` : ""}
    </div>`;
}

function purseSheet() {
  return `
    <div class="sheet-panel" role="dialog" aria-modal="true" aria-label="Münzen">
      <div class="sheet-header"><h2>Münzen</h2></div>
      ${scoreBoard()}
      ${openTasks().length ? `
        <span class="label">Geheime Aufgaben</span>
        ${openTasks().map(({ i, p }) => `
          <div class="confirm">
            <strong style="font-size:1.1rem">${playerName(i)} hat eine geheime Aufgabe</strong>
            ${taskPick && taskPick.id === p.id ? taskPickHtml() : `
            <p class="muted">${playerName(i)} sagt dir, ob es geklappt hat. Den Inhalt kennt nur ${playerName(i)}.</p>
            <button class="btn" onclick="resolveTask(${i}, '${p.id}', true)">Geschafft (${signed(p.coins)})</button>
            <button class="btn-quiet" onclick="resolveTask(${i}, '${p.id}', false)">Nicht geschafft</button>`}
          </div>`).join("")}` : ""}
      <button class="btn-quiet" onclick="openReference('coins')">Münzen von Hand ändern</button>
    </div>`;
}

// Who a card or minigame is about: rows of { label, players } or { versus: true }, plus an optional reason line.
function lineup(title, rows, reason) {
  return `
    <section class="lineup" aria-label="${title}">
      <span class="label">${title}</span>
      ${rows.map(r => r.versus ? `<span class="versus">gegen</span>` : `
        <div class="lineup-row">
          ${r.label ? `<span class="lineup-label">${r.label}</span>` : ""}
          <div class="lineup-names">${r.players.map(i => `<span class="name-chip">${playerName(i)}</span>`).join("")}</div>
        </div>`).join("")}
      ${reason ? `<p class="lineup-reason">${reason}</p>` : ""}
    </section>`;
}

function show(screen) {
  state.screen = screen;
  settingsFocus = null;
  confirmFinish = false;
  confirmRedraw = false;
  confirmReroll = false;
  taskPick = null;
  sheet = null;
  closeCardFullscreen();
  if (screen === "overview" && state.running && !state.timerEnd) startRound();
  save();
  render();
  window.scrollTo(0, 0);
}

// Each adventure may bring its own look: a backdrop class and data-adventure on <html> (colors in game.css).
function backdropClass(id) { return id === "tavern" || id === "dungeon" ? id : ""; }
function setAdventureLook(id) {
  const root = document.documentElement;
  if (id === "dungeon") root.dataset.adventure = id; else delete root.dataset.adventure;
}

// Each screen file registers its render functions here: Object.assign(SCREENS, { name: fn }).
const SCREENS = {};
function render() {
  const fn = SCREENS[state.screen] || screenStart;
  stopSpeaking();
  document.getElementById("app").innerHTML = fn();
  document.body.dataset.screen = state.screen;
  const inAdventure = !["start", "adventures"].includes(state.screen);
  const id = inAdventure ? (state.screen === "names" ? setupAdventure() : state.screen === "material" ? materialSetup().adventure : currentAdventure()).id : null;
  const look = backdropClass(id);
  document.getElementById("backdrop").className = look === "tavern" ? look : [look, state.screen === "intro" ? "intro" : ""].join(" ").trim();
  setAdventureLook(id);
  if (state.screen === "names") validateNames();
  minigameMounted();
  renderFrame();
  updateMusic();
}
