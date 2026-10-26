function screenStart() {
  const running = state.running && state.players && state.players.length;
  return `
    <div class="menu">
      ${forestArt(7)}
      <p class="menu-kicker">Unterwegs in</p>
      <h1 class="menu-title">${WORLD.name}</h1>
      <p class="menu-motto">${WORLD.motto}</p>
      ${running ? `
        <button class="btn btn-large" onclick="show('overview')">Partie fortsetzen</button>
        <p class="muted" style="text-align:center; margin-top:-10px">${currentAdventure().title} · ${state.players.length} ${currentAdventure().plural}</p>
        <button class="btn-quiet" onclick="show('adventures')">Neues Spiel starten</button>` : `
        <button class="btn btn-large" onclick="show('adventures')">Spiel starten</button>`}
    </div>
  `;
}

function screenSettings() {
  const options = RULES.eventMinuteOptions;
  return `
    <h2>Einstellungen</h2>
    <div class="rules">
      <section>
        <h3>Zeit zwischen zwei Ereignissen</h3>
        <p class="muted">Beim Wandern passen 15 Minuten gut, am Tisch eher 10.</p>
        <div class="options" role="group" aria-label="Minuten zwischen zwei Ereignissen">
          ${options.map(m => `<button id="minutes-${m}" aria-pressed="${minutes() === m}" onclick="setSetting('minutes', ${m})">${m} Min.</button>`).join("")}
        </div>
      </section>
    </div>
  `;
}

function screenAdventures() {
  const list = Object.values(ADVENTURES).filter(a => !a.hidden);
  return `
    <h2>Wähle ein Abenteuer</h2>
    <div class="adventure-list">
      ${list.map(a => `
        <button class="adventure-card" ${a.playable ? `onclick="chooseAdventure('${a.id}')"` : "disabled"}>
          ${adventureArt(a.id, true)}
          <span class="adventure-text">
            <span class="tile-title">${a.title}</span>
            <span class="tile-text">${a.playable ? a.setting : `In Arbeit: braucht mindestens ${RULES.adventureMinRoles} Rollen und ${RULES.adventureMinEvents} ${RULES.adventureMinEvents === 1 ? "Ereignis" : "Ereignisse"}`}</span>
          </span>
        </button>`).join("")}
    </div>
    ${contentSource === "builtin" ? `<p class="muted" style="text-align:center">Ohne Verbindung: Es werden die eingebauten Inhalte gezeigt.</p>` : ""}
  `;
}

function screenIntro() {
  const a = currentAdventure();
  const top = currentAdventure().id === "forest" ? `<div class="art-spacer"></div>` : adventureArt(currentAdventure().id, false);
  return `
    ${top}
    <div class="panel">
      <p class="ornament">✦ ✦ ✦</p>
      <h1>${a.introTitle}</h1>
      <div class="narrative">
        ${a.intro.map(paragraph => `<p>${paragraph}</p>`).join("")}
        <p><em>${a.introEnd}</em></p>
      </div>
      <button class="btn" onclick="startAdventure()">Abenteuer bestreiten</button>
    </div>
  `;
}

function chooseAdventure(id) {
  state.adventure = id;
  selectAdventureData(id);
  state.names = state.names.slice(0, maxPlayers());
  show("names");
}

Object.assign(SCREENS, {
  start: screenStart,
  adventures: screenAdventures,
  intro: screenIntro,
  settings: screenSettings
});
