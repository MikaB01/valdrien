function screenNames() {
  const rows = state.names.map((name, i) => `
    <div class="name-row">
      <input id="name-${i}" value="${escapeName(name)}" placeholder="Name von ${currentAdventure().player} ${i + 1}"
             autocomplete="off" autocapitalize="words" enterkeyhint="next"
             oninput="state.names[${i}] = this.value; validateNames()" onkeydown="nameKey(event, ${i})">
      <button class="remove" aria-label="Spieler entfernen" onclick="removeName(${i})"
              ${state.names.length <= RULES.minPlayers ? "disabled" : ""}>×</button>
    </div>`).join("");

  return `
    <h2>${currentAdventure().question}</h2>
    <p class="muted">${RULES.minPlayers} bis ${maxPlayers()} ${currentAdventure().plural}. Die Namen sind Beispiele, überschreibe sie einfach.</p>
    <div class="names">${rows}</div>
    ${state.names.length < maxPlayers()
      ? `<button class="btn-quiet" onclick="addName()">+ ${currentAdventure().player} hinzufügen</button>` : ""}
    <p class="muted" id="names-error"></p>
    <button class="btn" id="deal-btn" onclick="dealRoles()">Rollen geheim verteilen</button>
  `;
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
        <p>${r.character}</p>
      </div>` : ""}
      <div class="section">
        <span class="label">Erkennungsmerkmale</span>
        <ul>${r.traits.map(m => `<li>${m}</li>`).join("")}</ul>
      </div>
      <div class="section">
        <span class="label">Fähigkeit · ${r.ability.name}</span>
        <p>${r.ability.text}</p>
        <p class="muted">Wird freigeschaltet, sobald jemand deine Rolle errät.</p>
      </div>
      <div class="section">
        <span class="label">Geheime Aufgabe · ${r.task.name} · +${r.task.bonus} Münzen</span>
        <p>${r.task.text}</p>
      </div>
      <p class="coin-line">Startkapital: ${r.startingCoins} Münzen</p>
    </article>`;
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
  if (names.some(n => n === "")) error = `Bitte gib allen ${currentAdventure().dative} einen Namen.`;
  else if (new Set(names.map(n => n.toLowerCase())).size !== names.length) error = `Zwei ${currentAdventure().plural} haben denselben Namen.`;
  document.getElementById("names-error").textContent = error;
  document.getElementById("deal-btn").disabled = error !== "";
  return error === "";
}

function dealRoles() {
  if (!validateNames()) return;
  resetSeats();
  // new game: forget deleted entries and assign fresh slots
  state.players = [];
  state.slots = null;
  if (lastContent) applyContent(lastContent, contentSource);
  selectAdventureData(state.adventure);
  const shuffled = shuffle(activeIndices(ROLES));
  state.players = state.names.map((name, i) => ({
    name: name.trim(),
    role: shuffled[i],
    coins: ROLES[shuffled[i]].startingCoins,
    revealed: false, abilityUsed: false, taskDone: false,
    accessCode: randomCode()
  }));
  rememberSlots();
  state.current = 0;
  state.cardVisible = false;
  state.eventDeck = [];
  state.seersNight = false;
  state.winBonus = null;
  state.freeGuesses = false;
  state.lastWinnings = {};
  state.lastParticipants = [];
  show("handover");
}

function nextPlayer() {
  state.cardVisible = false;
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
