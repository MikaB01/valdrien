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

// Slider position as a fraction 0..1, for the filled part of the track.
function sliderFraction(value, [min, max]) { return (value - min) / (max - min); }

function timeLabel() {
  const [lo, hi] = randomRange();
  return settings.timerMode === "random" ? (lo === hi ? `Nach ${lo} Minuten` : `Zufällig nach ${lo} bis ${hi} Minuten`) : `Alle ${minutes()} Minuten`;
}

// Live update while dragging; a full render would interrupt the drag.
function slideTime(key, input) {
  let value = Number(input.value);
  const [lo, hi] = randomRange();
  if (key === "randomMin") value = Math.min(value, hi);
  if (key === "randomMax") value = Math.max(value, lo);
  input.value = value;
  settings[key] = value;
  const range = RULES.eventMinuteRange;
  const track = document.getElementById("time-range");
  if (settings.timerMode === "random") {
    const [a, b] = randomRange();
    track.style.setProperty("--from", sliderFraction(a, range));
    track.style.setProperty("--to", sliderFraction(b, range));
    document.getElementById("time-hint").textContent = randomHint();
  } else {
    track.style.setProperty("--to", sliderFraction(value, range));
  }
  document.getElementById("time-value").textContent = timeLabel();
}

function slideVolume(input) {
  setMusicVolume(input.value);
  document.getElementById("volume-range").style.setProperty("--to", input.value / 100);
  document.getElementById("volume-value").textContent = input.value + " %";
}

function randomHint() {
  const [lo, hi] = randomRange();
  return `Nach jeder neu gezogenen Ereigniskarte würfelt die App eine neue Zeit zwischen ${lo} und ${hi} Minuten aus. So weiß niemand genau, wann das nächste Ereignis kommt. Gilt ab der nächsten Karte.`;
}

function screenSettings() {
  const random = settings.timerMode === "random";
  const visible = settings.showTimer !== false;
  const musicOn = settings.music !== false;
  const [lo, hi] = randomRange();
  const range = RULES.eventMinuteRange;
  const volume = Math.round(100 * (settings.musicVolume ?? 0.5));
  const segment = (pressed, action, text) => `<button aria-pressed="${pressed}" onclick="${action}">${text}</button>`;
  const slider = (key, value, label) => `<input type="range" min="${range[0]}" max="${range[1]}" step="1" value="${value}" aria-label="${label}"
    oninput="slideTime('${key}', this)" onchange="saveSettings()">`;
  const theme = settings.theme === "light" || settings.theme === "dark" ? settings.theme : "auto";
  return `
    <h2>Einstellungen</h2>
    <div class="rules">
      <section>
        <h3>Darstellung</h3>
        <div class="segmented" role="group" aria-label="Darstellung">
          ${segment(theme === "auto", "setSetting('theme', 'auto')", "Automatisch")}
          ${segment(theme === "light", "setSetting('theme', 'light')", "Hell")}
          ${segment(theme === "dark", "setSetting('theme', 'dark')", "Dunkel")}
        </div>
        <p class="hint">${theme === "auto"
          ? "Valdrien folgt der Einstellung deines Handys und wird abends dunkel, wenn das Handy es auch wird."
          : "Gilt nur auf diesem Handy, egal wie das Handy selbst eingestellt ist."}</p>
      </section>
      <section>
        <h3>Zeit zwischen zwei Ereignissen</h3>
        <div class="segmented" role="group" aria-label="Art der Ereignis-Uhr">
          ${segment(!random, "setSetting('timerMode', 'fixed')", "Feste Zeit")}
          ${segment(random, "setSetting('timerMode', 'random')", "Zufällige Zeit")}
        </div>
        <p class="slider-value" id="time-value">${timeLabel()}</p>
        <div class="range ${random ? "dual" : ""}" id="time-range"
             style="--from:${random ? sliderFraction(lo, range) : 0}; --to:${sliderFraction(random ? hi : minutes(), range)}">
          ${random
            ? slider("randomMin", lo, "Frühestens nach Minuten") + slider("randomMax", hi, "Spätestens nach Minuten")
            : slider("minutes", minutes(), "Minuten zwischen zwei Ereignissen")}
        </div>
        <div class="range-scale"><span>${range[0]} Min.</span><span>${range[1]} Min.</span></div>
        <p class="hint" id="time-hint">${random ? randomHint() : "Beim Wandern passen 15 Minuten gut, am Tisch eher 10."}</p>
      </section>
      <section>
        <h3>Uhr auf der Hauptseite</h3>
        <div class="segmented" role="group" aria-label="Uhr auf der Hauptseite">
          ${segment(visible, "setSetting('showTimer', true)", "Anzeigen")}
          ${segment(!visible, "setSetting('showTimer', false)", "Verbergen")}
        </div>
        <p class="hint">${visible
          ? "Die Restzeit bis zum nächsten Ereignis steht oben auf der Hauptseite."
          : random
            ? "Die genaue Zeit bleibt geheim. Die Hauptseite zeigt nur, in wie vielen Minuten das nächste Ereignis ungefähr kommt. Anhalten und Weiterlaufen geht trotzdem."
            : "Die Restzeit bleibt geheim. Anhalten und Weiterlaufen geht trotzdem über den kleinen Knopf."}</p>
      </section>
      <section>
        <h3>Vorlesen</h3>
        <div class="segmented" role="group" aria-label="Vorlesen">
          ${segment(settings.speech !== false, "setSetting('speech', true)", "An")}
          ${segment(settings.speech === false, "setSetting('speech', false)", "Aus")}
        </div>
        <p class="hint">${speech.supported
          ? "Geschichten, Ereignisse, Minispiele und das Regelwerk bekommen einen Lautsprecher-Knopf. Rollen und geheime Ereignisse werden nie vorgelesen. Die Stimme kommt kostenlos vom Handy selbst. Auf dem iPhone klingt sie besser, wenn unter Einstellungen › Bedienungshilfen › Gesprochene Inhalte › Stimmen eine deutsche Stimme in verbesserter Qualität geladen ist."
          : "Dieser Browser kann leider nicht vorlesen."}</p>
      </section>
      <section>
        <h3>Musik</h3>
        <div class="segmented" role="group" aria-label="Musik">
          ${segment(musicOn, "setSetting('music', true)", "An")}
          ${segment(!musicOn, "setSetting('music', false)", "Aus")}
        </div>
        ${musicOn ? `
          <p class="slider-value"><span>Lautstärke</span> <span id="volume-value">${volume} %</span></p>
          <div class="range" id="volume-range" style="--from:0; --to:${volume / 100}">
            <input type="range" min="0" max="100" step="5" value="${volume}" aria-label="Lautstärke der Musik"
                   oninput="slideVolume(this)" onchange="saveSettings()">
          </div>` : ""}
        <p class="hint">Solange die Ereignis-Uhr läuft, spielt hin und wieder ruhige Musik passend zum Abenteuer: Harfe und Flöte im Wald, Laute und Trommel in der Taverne. Die Musik entsteht live in der App, ganz ohne Dateien und Lizenzkosten. Beim iPhone muss der Stummschalter aus sein.</p>
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
    <div class="panel speakable">
      ${speakButton()}
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
