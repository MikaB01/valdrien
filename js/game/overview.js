// Most coins first.
function scoreBoard() {
  const values = state.players.map(s => s.coins);
  const order = state.players.map((_, i) => i).sort((a, b) => values[b] - values[a]);
  const rows = order.map(i => {
    const s = state.players[i];
    const chips = [];
    if (s.revealed && !s.abilityUsed) chips.push(`<span class="chip chip-forest">Fähigkeit bereit</span>`);
    else if (s.revealed) chips.push(`<span class="chip">enttarnt</span>`);
    return `
      <div class="score-row">
        <span class="score-name"><span class="player-name">${escapeName(s.name)}</span> ${chips.join("")}</span>
        <span class="score-coins">${s.coins}<span class="coin-icon" aria-hidden="true"></span></span>
      </div>`;
  }).join("");
  return `<div class="score-list">${rows}</div>`;
}

function screenOverview() {
  const ready = state.players.filter(s => s.revealed && !s.abilityUsed).length;
  return `
    <div class="overview-head">
      <span class="eyebrow">${currentAdventure().title}</span>
      <h2>Das Abenteuer</h2>
      ${timerButton()}
    </div>
    ${reshuffleBox() || `<div class="scene-banner">${adventureArt(currentAdventure().id, true)}</div>`}
    ${lastingNote() ? `<p class="note">${lastingNote()}</p>` : ""}
    ${tableRuleNotes().map(n => `<p class="note">${n}</p>`).join("")}
    ${state.winBonus ? `<p class="note">Gewinnt ${playerName(state.winBonus.player)} das nächste Minispiel, gibt es ${state.winBonus.amount} Münzen extra.</p>` : ""}
    ${tipNote()}
    ${pauseNote()}
    ${openTasks().length ? `<p class="note">Offene geheime ${openTasks().length === 1 ? "Aufgabe" : "Aufgaben"}: ${playerNames([...new Set(openTasks().map(x => x.i))])}. Bestätigen über den Geldbeutel unten in der Mitte.</p>` : ""}
    <div class="tiles">
      ${rolesOn() ? `
      <button class="tile ${keysGoal() ? "tile-compact" : ""}" onclick="startGuess()">
        ${icon("guess")}
        <span class="tile-title">Raten</span>
        <span class="tile-text">${guessCost() ? `Kostet ${coinsText(guessCost())}` : "Gerade kostenlos"}, Treffer bringt ${hitReward()}</span>
      </button>
      <button class="tile ${ready ? "tile-ready" : ""} ${keysGoal() ? "tile-compact" : ""}" onclick="startAbility()">
        ${icon("ability")}
        <span class="tile-title">Fähigkeit</span>
        <span class="tile-text">${ready ? `${ready} ${ready === 1 ? "Person kann" : "Personen können"} jetzt` : "Frei, sobald eine Rolle erraten ist"}</span>
      </button>` : ""}
      ${keysGoal() ? `
      <button class="tile tile-wide tile-keys" onclick="startBuyKey()">
        <span class="key-icons" aria-hidden="true">${RULES.keys.map(k => `<img src="${k.image}" alt="">`).join("")}</span>
        <span class="tile-body">
          <span class="tile-title">Schlüssel kaufen</span>
          <span class="tile-text">${coinsText(keyPrice())} · Eisen, Silber oder Knochen</span>
        </span>
      </button>` : ""}
      <button class="tile ${rolesOn() || keysGoal() ? "tile-compact" : ""}" onclick="startBuyCard()">
        ${icon("event")}
        <span class="tile-title">Geheimkarte</span>
        <span class="tile-text">Für ${coinsText(privateCardCost())} kaufen</span>
      </button>
      <button class="tile ${rolesOn() || keysGoal() ? "tile-compact" : ""}" onclick="startMyRole()">
        ${icon("secret")}
        <span class="tile-title">Nachsehen${unseenCount() ? ` <span class="chip chip-gold">${unseenCount()} neu</span>` : ""}</span>
        <span class="tile-text">${keysGoal() ? (rolesOn() ? "Rolle, Schlüssel, Geheimes" : "Schlüssel, Geheimes") : rolesOn() ? "Rolle, Münzen, Geheimes" : "Münzen, Geheimes"}</span>
      </button>
    </div>
  `;
}

// Rules that last until the next minigame (event card "untilMinigame", hand card "tableRule"): [{ title, player? }]
function addTableRule(rule) { state.tableRules = (state.tableRules || []).concat(rule); }
function tableRuleNotes() {
  return (state.tableRules || []).map(r => `${r.title}${r.player !== undefined && state.players[r.player] ? ` (${playerName(r.player)})` : ""}: Gilt bis zum nächsten Minispiel.`);
}

// Shown instead of the picture once all event cards or all minigames are played; each button mixes only its own kind back in.
function eventsUsedUp() { return playableEvents().some(eventReady) && !drawableEvents().length; }
function minigamesUsedUp() { return activeIndices(MINIGAMES).length > 0 && !remainingMinigames().length; }

function reshuffleBox() {
  const events = eventsUsedUp(), minigames = minigamesUsedUp();
  if (!events && !minigames) return "";
  const text = events && minigames ? "Alle Ereigniskarten und Minispiele sind gespielt."
    : events ? `Alle Ereigniskarten sind gespielt.${activeIndices(MINIGAMES).length ? " Es kommen nur noch Minispiele." : ""}`
    : "Alle Minispiele sind gespielt. Es kommen nur noch Ereigniskarten.";
  return `
    <div class="reshuffle note">
      <p>${text}</p>
      ${events ? `<button class="btn-quiet" onclick="reshuffleEvents()">${minigames ? "Ereignisse" : "Ereignisse neu"} einmischen</button>` : ""}
      ${minigames ? `<button class="btn-quiet" onclick="reshuffleMinigames()">${events ? "Minispiele" : "Minispiele neu"} einmischen</button>` : ""}
    </div>`;
}

function unseenCount() {
  return (state.players || []).reduce((n, s) => n + (s.secrets || []).filter(p => !p.seen).length, 0);
}

function startMyRole(player) {
  state.peekRole = { player: player === undefined ? null : player, open: false };
  show("myRole");
}

function openMyRole() {
  const m = state.peekRole;
  const s = state.players[m.player];
  m.fresh = (s.secrets || []).filter(p => !p.seen).map(p => p.id);
  (s.secrets || []).forEach(p => { p.seen = true; });
  m.open = true;
  save();
  render();
  window.scrollTo(0, 0);
}

function closeMyRole() {
  state.peekRole = null;
  show("overview");
}

function statusChips(s) {
  return !s.revealed ? `<span class="chip">noch nicht erraten</span>`
    : s.abilityUsed ? `<span class="chip">erraten</span><span class="chip">Fähigkeit benutzt</span>`
    : `<span class="chip">erraten</span><span class="chip chip-forest">Fähigkeit bereit</span>`;
}

function secretEntries(i, fresh) {
  const s = state.players[i];
  const list = (s.secrets || []).slice().reverse();
  if (!list.length) return `<p class="muted" style="text-align:center">Noch keine geheimen Ereignisse.</p>`;
  return `
    <section class="secret-list" aria-label="Geheime Ereignisse">
      ${list.map(p => {
        const isNew = fresh.includes(p.id);
        return `
          <article class="secret-card ${isNew ? "new" : ""}">
            ${isNew ? `<span class="chip chip-gold">Neu</span>` : ""}
            <strong class="secret-title">${escapeName(p.title || "")}</strong>
            <p>${escapeName(p.text || "")}</p>
            ${secretOutcome(p, i)}
            ${handCardControl(i, p)}
          </article>`;
      }).join("")}
    </section>`;
}

function screenMyRole() {
  const m = state.peekRole || { player: null, open: false };
  if (m.player === null || !state.players[m.player]) {
    return `
      <div class="heading"><span class="eyebrow">Geheim</span><h2>Wer möchte nachsehen?</h2></div>
      <p class="muted">${rolesOn() ? "Rolle, Münzen" : "Münzen"} und geheime Ereignisse. Danach sieht nur diese Person aufs Handy.</p>
      <div class="choices">
        ${state.players.map((s, i) => {
          const unseen = (s.secrets || []).filter(p => !p.seen).length;
          return `
          <button class="choice" onclick="state.peekRole = { player: ${i}, open: false }; render()">
            <span>${escapeName(s.name)}</span>
            ${unseen ? `<span class="chip chip-gold">${unseen} neu</span>` : `<span class="muted">›</span>`}
          </button>`;
        }).join("")}
      </div>`;
  }
  const i = m.player;
  const s = state.players[i];
  if (!m.open) {
    return `
      <div class="handover">
        <p class="muted">Gib das Handy an</p>
        <p class="name-large">${escapeName(s.name)}</p>
        <p class="muted">Nur ${escapeName(s.name)} darf jetzt hinsehen.</p>
        <button class="btn" onclick="openMyRole()">Ich bin ${escapeName(s.name)}, zeigen</button>
      </div>`;
  }
  const notes = seatData(s).notes.map(n => `<p class="note">${escapeName(n)}</p>`).join("");
  return `
    <div class="own-header"><span class="eyebrow">Nur für dich</span><h1>${escapeName(s.name)}</h1></div>
    <div class="own-coins">
      <span class="own-count">${s.coins}<span class="coin-icon" aria-hidden="true"></span></span>
      ${rolesOn() ? `<div class="chips">${statusChips(s)}</div>` : ""}
    </div>
    ${notes}
    ${keysGoal() ? `<span class="label">Deine Schlüssel</span>${keyStrip(keysOf(i))}` : ""}
    <span class="label">Geheime Ereignisse</span>
    ${secretEntries(i, m.fresh || [])}
    ${rolesOn() ? `<span class="label">Deine Rolle</span>
    ${roleCard(ROLES[s.role])}
    ${taskCashIn(i)}` : ""}
    ${qrSection(i)}
    <button class="btn" onclick="closeMyRole()">Verbergen und zurückgeben</button>`;
}

function screenRoles() {
  const revealed = {};
  state.players.forEach(s => { if (s.revealed) revealed[s.role] = s.name; });
  const playerCount = state.players.length;
  return `
    <div class="heading"><span class="eyebrow">${currentAdventure().title}</span><h2>Rollen</h2></div>
    <button class="btn" onclick="startMyRole()">Geheim nachsehen</button>
    <p class="muted">Diese ${roleCount()} Rollen gibt es in diesem Abenteuer. ${playerCount < roleCount()
      ? `Ihr seid ${playerCount}, also sind nicht alle im Spiel.`
      : "Jede Rolle ist vergeben."} ${hasTasks() ? "Fähigkeiten und Aufgaben bleiben" : "Die Fähigkeiten bleiben"} geheim.</p>
    <div class="role-list">
      ${ROLES.map((r, k) => r.deleted ? "" : `
        <article class="role-entry">
          <div class="role-header">
            <span class="tile-title">${r.name}, ${r.title}</span>
            ${revealed[k] !== undefined ? `<span class="chip chip-gold">erraten: ${escapeName(revealed[k])}</span>` : ""}
          </div>
          <ul>${r.traits.map(x => `<li>${x}</li>`).join("")}</ul>
        </article>`).join("")}
    </div>`;
}

function screenCoins() {
  const list = state.players.map((s, i) => `
    <div class="player-row">
      <span class="name">${escapeName(s.name)}</span>
      <div class="counter">
        <button aria-label="Eine Münze weniger für ${escapeName(s.name)}" onclick="changeCoins(${i}, -1)">−</button>
        <span class="count">${s.coins}</span>
        <button aria-label="Eine Münze mehr für ${escapeName(s.name)}" onclick="changeCoins(${i}, 1)">+</button>
      </div>
      ${rolesOn() ? `
      <div class="status-toggles" role="group" aria-label="Status von ${escapeName(s.name)}">
        ${statusToggle(i, "revealed", "Rolle erraten", s.revealed)}
        ${statusToggle(i, "abilityUsed", "Fähigkeit benutzt", s.abilityUsed, !s.revealed && !s.abilityUsed)}
      </div>` : ""}
    </div>`).join("");

  return `
    <h2>Münzen von Hand ändern</h2>
    <p class="muted">Die App bucht ${rolesOn() ? "Münzen und Status" : "Münzen"} selbst. Stimmt etwas nicht, korrigiert ihr es hier.</p>
    <div class="player-list">${list}</div>
  `;
}

function statusToggle(i, key, text, on, disabled) {
  return `
    <button class="status-toggle" aria-pressed="${on}" ${disabled ? "disabled" : ""} onclick="toggleStatus(${i}, '${key}')">
      <span class="status-mark" aria-hidden="true"></span>${text}
    </button>`;
}

function toggleStatus(i, key) {
  state.players[i][key] = !state.players[i][key];
  save();
  render();
}

function changeCoins(i, delta) {
  const s = state.players[i];
  s.coins = Math.max(0, s.coins + delta);
  save();
  render();
}

Object.assign(SCREENS, {
  overview: screenOverview,
  myRole: screenMyRole,
  roles: screenRoles,
  coins: screenCoins
});
