function screenNames() {
  const rows = state.names.map((name, i) => `
    <div class="name-row">
      <input id="name-${i}" value="${escapeName(name)}" placeholder="Name von ${setupAdventure().player} ${i + 1}"
             autocomplete="off" autocapitalize="words" enterkeyhint="next"
             oninput="state.names[${i}] = this.value; validateNames()" onkeydown="nameKey(event, ${i})">
      <button class="remove" aria-label="Spieler entfernen" onclick="removeName(${i})"
              ${state.names.length <= RULES.minPlayers ? "disabled" : ""}>×</button>
    </div>`).join("");

  return `
    <h2>${setupAdventure().question}</h2>
    <p class="muted">${RULES.minPlayers} bis ${maxPlayers()} ${setupAdventure().plural}. Die Namen sind Beispiele, überschreibe sie einfach.</p>
    <div class="names">${rows}</div>
    ${state.names.length < maxPlayers()
      ? `<button class="btn-quiet" onclick="addName()">+ ${setupAdventure().player} hinzufügen</button>` : ""}
    <p class="muted" id="names-error"></p>
    ${modeCard()}
    ${drinkingCard()}
    ${materialCard()}
    <button class="btn" id="deal-btn" onclick="dealRoles()">${settings.roles !== false ? "Rollen geheim verteilen" : "Abenteuer beginnen"}</button>
  `;
}

// Roles on or off for the next game, with what that means; "Ändern" opens the settings at this section.
function modeCard() {
  const on = settings.roles !== false;
  const rerolls = rerollSetting();
  const facts = on
    ? [`Jeder bekommt heimlich eine Rolle mit Fähigkeit${hasTasks(setupAdventure()) ? " und geheimer Aufgabe" : ""}.`,
       rerolls ? `Gefällt die Rolle nicht, darf jeder sie ${rerolls === 1 ? "einmal" : `bis zu ${rerolls}-mal`} weglegen und neu ziehen.` : "Neu ziehen ist ausgeschaltet: Jeder behält seine erste Rolle."]
    : ["Kein Raten, keine Fähigkeiten, keine geheimen Aufgaben.", `Jeder startet mit ${coinsText(RULES.startingCoinsFallback)}, am Ende zählen nur die Münzen.`];
  return `
    <section class="mode-card" aria-label="Geheime Rollen">
      <div class="mode-head">
        <span class="mode-icon">${icon(on ? "roles" : "coin")}</span>
        <span class="mode-title"><span class="label">Spielart</span><strong>${on ? "Mit geheimen Rollen" : "Ohne Rollen"}</strong></span>
        <button class="mode-change" onclick="openSettingsAt('roles')">Ändern</button>
      </div>
      <ul class="mode-facts">${facts.map(f => `<li>${f}</li>`).join("")}</ul>
      <p class="mode-warning" id="reroll-note" hidden></p>
    </section>`;
}

// Drinking game on or off, only for adventures with drinking cards or drinking minigames.
function drinkingCard() {
  const a = setupAdventure();
  if (!hasDrinkingCards(a)) return "";
  const on = drinkingOn();
  const cards = a.events.filter(e => !e.deleted && !e.retired && e.drinking).length;
  const games = a.minigames.filter(m => !m.deleted && m.drinking).length;
  const what = [cards ? `${cards} ${cards === 1 ? "Ereigniskarte" : "Ereigniskarten"}` : "", games ? `${games} ${games === 1 ? "Minispiel" : "Minispiele"}` : ""]
    .filter(Boolean).join(" und ") + " rund ums Trinken";
  return `
    <section class="mode-card" aria-label="Trinkspiel">
      <div class="mode-head">
        <span class="mode-icon">${icon("mug")}</span>
        <span class="mode-title"><span class="label">Trinkspiel</span><strong>${on ? "Mit Trinkspiel" : "Ohne Trinkspiel"}</strong></span>
        <button class="mode-change" onclick="openSettingsAt('drinking')">Ändern</button>
      </div>
      <ul class="mode-facts"><li>${on ? `${what} sind dabei. Wasser oder Saft zählen genauso.` : `${what} bleiben draußen.`}</li></ul>
    </section>`;
}

// How often each player may draw a new role. A role that was put back is never shown to anyone
// else, so only the spare roles (roles minus players) can be drawn. If they are enough for everyone,
// everyone gets the same number; if not even one each, each may draw once until they run out (short).
function rerollPlan(players, roles, wanted) {
  const spare = Math.max(0, roles - players);
  if (!wanted || !spare || !players) return { limit: 0, spare, short: false };
  const even = Math.floor(spare / players);
  if (even >= 1) return { limit: Math.min(wanted, even), spare, short: false };
  return { limit: 1, spare, short: true };
}

function rerollNote(players) {
  const wanted = rerollSetting();
  if (settings.roles === false || !wanted || players < RULES.minPlayers) return "";
  const a = setupAdventure();
  const roles = roleCount(a);
  const plan = rerollPlan(players, roles, wanted);
  if (!plan.spare) return `Neue Rollen ziehen geht diesmal nicht: Es gibt ${roles} Rollen, und ihr seid ${players} ${a.plural}.`;
  if (plan.short) return `Neu ziehen geht, aber nicht für alle: Bei ${roles} Rollen und ${players} ${a.dative} ${plan.spare === 1 ? "bleibt nur 1 Rolle" : `bleiben nur ${plan.spare} Rollen`} übrig. Klärt vorher untereinander, wer neu ziehen darf.`;
  if (plan.limit < wanted) return `Bei ${roles} Rollen und ${players} ${a.dative} darf jeder höchstens ${plan.limit}× neu ziehen, damit es für alle gleich bleibt.`;
  return "";
}

function screenHandover() {
  const s = state.players[state.current];

  if (!state.cardVisible) {
    return `
      <div class="handover">
        <div class="dots" role="img" aria-label="Rolle ${state.current + 1} von ${state.players.length}">
          ${state.players.map((_, i) => `<span class="${i <= state.current ? "filled" : ""}"></span>`).join("")}
        </div>
        <p class="muted">Gib das Handy an</p>
        <p class="name-large">${escapeName(s.name)}</p>
        <p class="muted">Nur ${escapeName(s.name)} darf jetzt hinsehen. Halte das Handy so, dass niemand mitliest.</p>
        <button class="btn" onclick="state.cardVisible = true; render()">Ich bin ${escapeName(s.name)}, Rolle zeigen</button>
      </div>`;
  }

  const r = ROLES[s.role];
  const last = state.current === state.players.length - 1;
  return `
    <p class="muted" style="text-align:center">Deine geheime Rolle, ${escapeName(s.name)}</p>
    ${roleCard(r)}
    ${rerollBox(state.current)}
    ${qrSection(state.current)}
    <button class="btn" onclick="nextPlayer()">
      ${last ? "Karte verbergen und Abenteuer beginnen" : "Karte verbergen und weitergeben"}
    </button>
  `;
}

function roleCard(r) {
  return `
    <article class="card">
      <div class="title">
        <div class="card-name">${r.name}</div>
        <div class="role-title">${r.title}</div>
      </div>
      <p class="narrative">${r.background}</p>
      ${r.character ? `
      <div class="section">
        <span class="label">So spielst du die Rolle</span>
        ${characterHtml(r.character)}
      </div>` : ""}
      <div class="section">
        <span class="label">Erkennungsmerkmale</span>
        <ul>${r.traits.map(m => `<li>${m}</li>`).join("")}</ul>
      </div>
      <div class="section section-box">
        <span class="label">Fähigkeit</span>
        <strong class="section-name">${r.ability.name}</strong>
        <p>${r.ability.text}</p>
        <p class="muted">Wird freigeschaltet, sobald jemand deine Rolle errät.</p>
      </div>
      ${r.task ? `
      <div class="section section-box">
        <span class="label">Geheime Aufgabe</span>
        <strong class="section-name">${r.task.name}</strong>
        <p>${r.task.text}</p>
        ${r.task.bonus ? `<span class="chip chip-gold section-bonus">Bonus: +${r.task.bonus} Münzen</span>` : ""}
      </div>` : ""}
      <p class="coin-line">Startkapital: ${r.startingCoins} Münzen</p>
    </article>`;
}

// "Charakter und Verhalten" holds one point per line.
function characterHtml(text) {
  const lines = text.split("\n").map(l => l.replace(/^[-•·]\s*/, "").trim()).filter(Boolean);
  return lines.length > 1 ? `<ul class="character-list">${lines.map(l => `<li>${l}</li>`).join("")}</ul>` : `<p>${lines[0] || ""}</p>`;
}

function addName() {
  state.names.push("");
  render();
  document.getElementById("name-" + (state.names.length - 1)).focus();
}

function nameKey(event, i) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const nextInput = document.getElementById("name-" + (i + 1));
  if (nextInput) nextInput.focus();
  else if (state.names.length < maxPlayers()) addName();
  else event.target.blur();
}

function removeName(i) {
  state.names.splice(i, 1);
  render();
}

function validateNames() {
  const names = state.names.map(n => n.trim());
  let error = "";
  if (names.some(n => n === "")) error = `Bitte gib allen ${setupAdventure().dative} einen Namen.`;
  else if (new Set(names.map(n => n.toLowerCase())).size !== names.length) error = `Zwei ${setupAdventure().plural} haben denselben Namen.`;
  else if (names.length > maxPlayers()) error = settings.roles !== false
    ? `Es gibt nur ${maxPlayers()} Rollen. Entfernt ${names.length - maxPlayers() === 1 ? "einen Namen" : (names.length - maxPlayers()) + " Namen"} oder spielt ohne Rollen.`
    : `Höchstens ${maxPlayers()} ${setupAdventure().plural}.`;
  const note = document.getElementById("reroll-note");
  if (note) { note.textContent = error ? "" : rerollNote(names.length); note.hidden = !note.textContent; }
  document.getElementById("names-error").textContent = error;
  document.getElementById("deal-btn").disabled = error !== "";
  return error === "";
}

function dealRoles() {
  if (!validateNames()) return;
  if (ADVENTURES[state.setupAdventure]) state.adventure = state.setupAdventure;
  resetSeats();
  // new game: forget deleted entries and assign fresh slots
  state.players = [];
  state.slots = null;
  if (lastContent) applyContent(lastContent, contentSource);
  selectAdventureData(state.adventure);
  state.roles = settings.roles !== false;
  const shuffled = state.roles ? shuffle(activeIndices(ROLES)) : [];
  state.players = state.names.map((name, i) => ({
    name: name.trim(),
    role: state.roles ? shuffled[i] : null,
    coins: state.roles ? ROLES[shuffled[i]].startingCoins : RULES.startingCoinsFallback,
    revealed: false, abilityUsed: false, taskDone: false, rerolls: 0, keys: {},
    accessCode: randomCode()
  }));
  const plan = rerollPlan(state.players.length, roleCount(), state.roles ? rerollSetting() : 0);
  state.rerollLimit = plan.limit;
  state.rerollShort = plan.short;
  state.discardedRoles = [];
  state.retiredCodes = [];
  rememberSlots();
  state.current = 0;
  state.cardVisible = false;
  state.eventDeck = [];
  state.playedEvents = [];
  state.playedMinigames = [];
  // nothing from the last game stays open (indices may point past the new players)
  state.event = null;
  state.minigame = null;
  state.guess = null;
  state.ability = null;
  state.buyCard = null;
  state.lasting = null;
  state.tableRules = [];
  state.handCard = null;
  state.keyGlimpse = null;
  state.recentLoss = {};
  state.winBonus = null;
  state.lastWinnings = {};
  state.lastParticipants = [];
  state.escaped = null;
  state.buyKey = null;
  state.tip = null;
  state.pause = null;
  state.curiosity = null;
  state.jailerDrinks = 0;
  state.cardCount = 0;
  show(state.roles ? "handover" : "intro");
}

// Roles nobody holds and nobody has seen yet.
function rerollPool() {
  const taken = new Set(state.players.map(s => s.role).concat(state.discardedRoles || []));
  return activeIndices(ROLES).filter(k => !taken.has(k));
}

function rerollBox(i) {
  const s = state.players[i];
  const limit = state.rerollLimit || 0;
  if (!limit) return "";
  const used = s.rerolls || 0;
  const pool = rerollPool().length;
  if (used >= limit) return `<p class="muted reroll-line">Du hast schon ${used === 1 ? "einmal" : used + "-mal"} neu gezogen. Diese Rolle bleibt.</p>`;
  if (!pool) return `<p class="muted reroll-line">Es ist keine Rolle mehr übrig, die du neu ziehen könntest.</p>`;
  const left = limit - used === 1 ? "Noch einmal möglich" : `Noch ${limit - used}-mal möglich`;
  const short = state.rerollShort ? ` Achtung: Es gibt nicht für alle eine zweite Rolle, übrig ${pool === 1 ? "ist nur noch eine" : `sind noch ${pool}`}.` : "";
  if (confirmReroll) {
    return `
    <div class="confirm reroll-confirm" role="alertdialog" aria-labelledby="reroll-title">
      <strong id="reroll-title">Wirklich eine neue Rolle ziehen?</strong>
      <p class="muted">${ROLES[s.role].name} legst du dann endgültig weg, zurück geht es nicht. Die neue Rolle ist Zufall.${short}</p>
      <button class="btn" onclick="rerollRole()">Ja, neue Rolle ziehen</button>
      <button class="link-button" onclick="confirmReroll = false; render()">Nein, ${ROLES[s.role].name} behalten</button>
    </div>`;
  }
  return `
    <div class="reroll">
      <button class="btn-quiet" onclick="confirmReroll = true; render()">Rolle weglegen und neu ziehen</button>
      <p class="muted">${left}. Die weggelegte Rolle bekommt niemand mehr zu sehen.${short}</p>
    </div>`;
}

function rerollRole() {
  const s = state.players[state.current];
  const pool = rerollPool();
  if (!confirmReroll || !s || !state.cardVisible || !pool.length || (s.rerolls || 0) >= (state.rerollLimit || 0)) return;
  confirmReroll = false;
  state.discardedRoles = (state.discardedRoles || []).concat(s.role);
  s.role = pool[Math.floor(Math.random() * pool.length)];
  s.coins = ROLES[s.role].startingCoins;
  s.rerolls = (s.rerolls || 0) + 1;
  // the QR link names the role: retire the old link, its page tells the player to scan again
  state.retiredCodes = (state.retiredCodes || []).concat(s.accessCode);
  s.accessCode = randomCode();
  save();
  render();
  window.scrollTo(0, 0);
}

function nextPlayer() {
  state.cardVisible = false;
  confirmReroll = false;
  if (state.current < state.players.length - 1) {
    state.current++;
    show("handover");
  } else {
    show("intro");
  }
}

Object.assign(SCREENS, {
  names: screenNames,
  handover: screenHandover
});
