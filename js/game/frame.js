const REFERENCE_SCREENS = ["rules", "settings", "quickGuide", "coins"];

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
    case "minigame": return state.minigame && state.minigame.fromEvent ? go("event") : go("overview");
    case "buyCard": return state.buyCard && state.buyCard.player !== null
      ? () => { state.buyCard.player = null; render(); } : go("overview");
    case "tasks": return resumeAdventure;
    case "end": return go("tasks");
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

function openSheet(which) { sheet = sheet === which ? null : which; confirmFinish = false; renderFrame(); }
function closeSheet() { sheet = null; confirmFinish = false; renderFrame(); }
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
        ${entry(icon("gear"), "Einstellungen", "openReference('settings')")}
      </div>
      ${inGame ? `
        <span class="menu-divider">Dieses Abenteuer</span>
        <div class="menu-list">
          ${entry(icon("secret"), "Geheim nachsehen", "startMyRole()")}
          ${entry(icon("minigame"), "Minispiel ziehen", "sheet = null; drawMinigame(null, false)")}
          ${entry(icon("roles"), "Alle Rollen ansehen", "show('roles')")}
          ${entry(icon("event"), "Ereigniskarte jetzt ziehen", "sheet = null; drawEvent(false)")}
          ${confirmFinish ? "" : entry(icon("flag"), currentAdventure().finish, "confirmFinish = true; renderFrame()")}
        </div>
        ${confirmFinish ? `
          <div class="confirm" role="alertdialog" aria-labelledby="confirm-title">
            <strong id="confirm-title">${currentAdventure().finish}?</strong>
            <p class="muted">Danach werden alle Rollen aufgedeckt und die Münzen gezählt.</p>
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
            <p class="muted">${playerName(i)} sagt dir, ob es geklappt hat. Den Inhalt kennt nur ${playerName(i)}.</p>
            <button class="btn" onclick="resolveTask(${i}, '${p.id}', true)">Geschafft (${signed(p.coins)})</button>
            <button class="btn-quiet" onclick="resolveTask(${i}, '${p.id}', false)">Nicht geschafft</button>
          </div>`).join("")}` : ""}
      <button class="btn-quiet" onclick="openReference('coins')">Münzen von Hand ändern</button>
    </div>`;
}

function show(screen) {
  state.screen = screen;
  confirmFinish = false;
  confirmRedraw = false;
  sheet = null;
  if (screen === "overview" && state.running && !state.timerEnd) startRound();
  save();
  render();
  window.scrollTo(0, 0);
}

// Each screen file registers its render functions here: Object.assign(SCREENS, { name: fn }).
const SCREENS = {};
function render() {
  const fn = SCREENS[state.screen] || screenStart;
  stopSpeaking();
  document.getElementById("app").innerHTML = fn();
  document.body.dataset.screen = state.screen;
  const tavern = currentAdventure().id === "tavern" && !["start", "adventures"].includes(state.screen);
  document.getElementById("backdrop").className = tavern ? "tavern" : state.screen === "intro" ? "intro" : "";
  if (state.screen === "names") validateNames();
  renderFrame();
  updateMusic();
}
