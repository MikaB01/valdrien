function scoreBoard() {
  const values = state.players.map(s => s.coins);
  const max = Math.max(...values), min = Math.min(...values);
  const order = state.players.map((_, i) => i).sort((a, b) => values[b] - values[a]);
  const rows = order.map(i => {
    const s = state.players[i];
    const chips = [];
    if (max !== min && s.coins === max) chips.push(`<span class="chip chip-gold">meiste</span>`);
    if (max !== min && s.coins === min) chips.push(`<span class="chip">wenigste</span>`);
    if (s.revealed && !s.abilityUsed) chips.push(`<span class="chip chip-forest">Fähigkeit bereit</span>`);
    else if (s.revealed) chips.push(`<span class="chip">enttarnt</span>`);
    return `
      <div class="score-row">
        <span class="score-name">${escapeName(s.name)} ${chips.join("")}</span>
        <span class="score-coins">${s.coins}<span class="coin-icon" aria-hidden="true"></span></span>
      </div>`;
  }).join("");
  return `<div class="score-list">${rows}</div>`;
}

function screenOverview() {
  const ready = state.players.filter(s => s.revealed && !s.abilityUsed).length;
  const total = minutes() * 60000;
  return `
    <div class="heading"><span class="eyebrow">${currentAdventure().title}</span><h2>Das Abenteuer</h2></div>
    ${state.running && state.timerEnd ? `
      <div class="timer" role="timer">
        <span class="label">Nächstes Ereignis in</span>
        <span class="time" id="remaining">${timeText(remainingMs())}</span>
        <div class="progress"><div id="progress-fill" style="width:${Math.min(100, 100 * remainingMs() / total)}%"></div></div>
      </div>` : ""}
    ${state.seersNight ? `<p class="note">Die Nacht der Seher: Bis zum nächsten Ereignis bringt ein Treffer beim Raten ${RULES.hitRewardSeers} Münzen.</p>` : ""}
    ${state.winBonus ? `<p class="note">Gewinnt ${playerName(state.winBonus.player)} das nächste Minispiel, gibt es ${state.winBonus.amount} Münzen extra.</p>` : ""}
    ${state.freeGuesses ? `<p class="note">Lose Zungen: Bis zum nächsten Ereignis kostet Raten keine Münze.</p>` : ""}
    ${openTasks().length ? `<p class="note">Offene geheime ${openTasks().length === 1 ? "Aufgabe" : "Aufgaben"}: ${playerNames([...new Set(openTasks().map(x => x.i))])}. Bestätigen über den Geldbeutel unten rechts.</p>` : ""}
    <div class="tiles">
      <button class="tile tile-wide" onclick="startGuess()">
        ${icon("guess")}
        <span class="tile-body">
          <span class="tile-title">Auf eine Rolle raten</span>
          <span class="tile-text">${state.freeGuesses ? "Raten kostet gerade nichts" : `Ein Tipp kostet ${coinsText(RULES.guessCost)}`}, ein Treffer bringt ${hitReward()}</span>
        </span>
      </button>
      <button class="tile tile-wide" onclick="startAbility()" ${ready ? "" : 'style="border-color: var(--line)"'}>
        ${icon("ability")}
        <span class="tile-body">
          <span class="tile-title">Besondere Fähigkeit einsetzen</span>
          <span class="tile-text">${ready
            ? `${ready} ${ready === 1 ? "Person kann" : "Personen können"} jetzt eine Fähigkeit einsetzen`
            : "Wird frei, sobald eine Rolle erraten ist"}</span>
        </span>
      </button>
      <button class="tile" onclick="drawMinigame(null, false)">
        ${icon("minigame")}
        <span class="tile-title">Minispiel</span>
        <span class="tile-text">Eine kurze Herausforderung</span>
      </button>
      <button class="tile" onclick="show('roles')">
        ${icon("roles")}
        <span class="tile-title">Rollen</span>
        <span class="tile-text">Meine Rolle und alle anderen</span>
      </button>
    </div>
  `;
}

function startMyRole() {
  state.peekRole = { player: null, open: false };
  show("myRole");
}

function screenMyRole() {
  const m = state.peekRole || { player: null, open: false };
  if (m.player === null || !state.players[m.player]) {
    return `
      <div class="heading"><span class="eyebrow">Geheim</span><h2>Meine Rolle ansehen</h2></div>
      <p class="muted">Wer möchte nachsehen? Danach sieht nur diese Person aufs Handy.</p>
      <div class="choices">
        ${state.players.map((s, i) => `
          <button class="choice" onclick="state.peekRole = { player: ${i}, open: false }; render()">
            <span>${escapeName(s.name)}</span><span class="muted">›</span>
          </button>`).join("")}
      </div>`;
  }
  const s = state.players[m.player];
  if (!m.open) {
    return `
      <div class="handover">
        <p class="muted">Gib das Handy an</p>
        <p class="name-large">${escapeName(s.name)}</p>
        <p class="muted">Nur ${escapeName(s.name)} darf jetzt hinsehen.</p>
        <button class="btn" onclick="state.peekRole.open = true; render()">Ich bin ${escapeName(s.name)}, Rolle zeigen</button>
      </div>`;
  }
  const status = !s.revealed
    ? `<span class="chip">noch nicht erraten</span>`
    : s.abilityUsed
      ? `<span class="chip">erraten</span><span class="chip">Fähigkeit benutzt</span>`
      : `<span class="chip">erraten</span><span class="chip chip-forest">Fähigkeit bereit</span>`;
  return `
    <p class="muted" style="text-align:center">Deine geheime Rolle, ${escapeName(s.name)}</p>
    <div class="chips">${status}</div>
    ${roleCard(ROLES[s.role])}
    ${qrSection(m.player)}
    <button class="btn" onclick="state.peekRole = null; show('overview')">Karte verbergen und zurück</button>`;
}

function screenRoles() {
  const revealed = {};
  state.players.forEach(s => { if (s.revealed) revealed[s.role] = s.name; });
  const playerCount = state.players.length;
  return `
    <div class="heading"><span class="eyebrow">${currentAdventure().title}</span><h2>Rollen</h2></div>
    <button class="btn" onclick="startMyRole()">Meine Rolle heimlich ansehen</button>
    <p class="muted">Diese ${maxPlayers()} Rollen gibt es in diesem Abenteuer. ${playerCount < maxPlayers()
      ? `Ihr seid ${playerCount}, also sind nicht alle im Spiel.`
      : "Jede Rolle ist vergeben."} Fähigkeiten und Aufgaben bleiben geheim.</p>
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
      <div class="ability-status">
        ${!s.revealed ? `<span class="chip">noch nicht erraten</span>`
          : s.abilityUsed ? `<span class="chip">erraten</span><span class="chip">Fähigkeit benutzt</span>`
          : `<span class="chip">erraten</span><span class="chip chip-forest">Fähigkeit bereit</span>`}
      </div>
    </div>`).join("");

  const corrections = state.players.map((s, i) => `
    <div class="correction-row">
      <strong>${escapeName(s.name)}</strong>
      <label><input type="checkbox" id="revealed-${i}" ${s.revealed ? "checked" : ""}
             onchange="state.players[${i}].revealed = this.checked; save(); render()"> Rolle erraten</label>
      <label><input type="checkbox" id="used-${i}" ${s.abilityUsed ? "checked" : ""}
             onchange="state.players[${i}].abilityUsed = this.checked; save(); render()"> Fähigkeit benutzt</label>
    </div>`).join("");

  return `
    <h2>Münzen von Hand ändern</h2>
    <p class="muted">Die App bucht Münzen selbst. Hier korrigiert ihr, falls etwas nicht stimmt.</p>
    <div class="player-list">${list}</div>
    <details class="corrections" ${correctionsOpen ? "open" : ""} ontoggle="correctionsOpen = this.open">
      <summary>Status von Hand korrigieren</summary>
      ${corrections}
    </details>
  `;
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
