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
  const random = settings.timerMode === "random";
  const visible = settings.showTimer !== false;
  const [lo, hi] = randomRange();
  const segment = (pressed, action, text) => `<button aria-pressed="${pressed}" onclick="${action}">${text}</button>`;
  const stepper = (key, label, value) => `
    <div class="stepper">
      <span class="stepper-label">${label}</span>
      <div class="counter">
        <button aria-label="${label}: eine Minute weniger" onclick="stepRandom('${key}', -1)">−</button>
        <span class="count">${value}</span>
        <button aria-label="${label}: eine Minute mehr" onclick="stepRandom('${key}', 1)">+</button>
      </div>
      <span class="muted">Min.</span>
    </div>`;
  return `
    <h2>Einstellungen</h2>
    <div class="rules">
      <section>
        <h3>Zeit zwischen zwei Ereignissen</h3>
        <div class="segmented" role="group" aria-label="Art der Ereignis-Uhr">
          ${segment(!random, "setSetting('timerMode', 'fixed')", "Feste Zeit")}
          ${segment(random, "setSetting('timerMode', 'random')", "Zufällige Zeit")}
        </div>
        ${random ? `
          ${stepper("randomMin", "Frühestens nach", lo)}
          ${stepper("randomMax", "Spätestens nach", hi)}
          <p class="hint">Nach jeder neu gezogenen Ereigniskarte würfelt die App eine neue Zeit zwischen ${lo} und ${hi} Minuten aus. So weiß niemand genau, wann das nächste Ereignis kommt. Besonders spannend mit verborgener Uhr. Gilt ab der nächsten Karte.</p>` : `
          <div class="options" role="group" aria-label="Minuten zwischen zwei Ereignissen">
            ${RULES.eventMinuteOptions.map(m => `<button id="minutes-${m}" aria-pressed="${minutes() === m}" onclick="setSetting('minutes', ${m})">${m} Min.</button>`).join("")}
          </div>
          <p class="hint">Beim Wandern passen 15 Minuten gut, am Tisch eher 10.</p>`}
      </section>
      <section>
        <h3>Uhr auf der Hauptseite</h3>
        <div class="segmented" role="group" aria-label="Uhr auf der Hauptseite">
          ${segment(visible, "setSetting('showTimer', true)", "Anzeigen")}
          ${segment(!visible, "setSetting('showTimer', false)", "Verbergen")}
        </div>
        <p class="hint">${visible
          ? "Die Restzeit bis zum nächsten Ereignis steht oben auf der Hauptseite."
          : "Die Restzeit bleibt geheim. Anhalten und Weiterlaufen geht trotzdem über den kleinen Knopf."}</p>
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
        <p class="closing">${a.introEnd}</p>
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
