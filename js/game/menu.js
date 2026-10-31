function screenStart() {
  const running = state.running && state.players && state.players.length;
  return `
    <div class="menu">
      <div class="title-sign">
        <p class="menu-kicker">Unterwegs in</p>
        <h1 class="menu-title">${WORLD.name}</h1>
      </div>
      <p class="menu-motto">${WORLD.motto}</p>
      <div class="menu-actions">
        ${running ? `
          <button class="btn btn-large" onclick="show('overview')">Partie fortsetzen</button>
          <p class="muted">${currentAdventure().title} · ${state.players.length} ${currentAdventure().plural}</p>
          <button class="btn-quiet" onclick="show('adventures')">Neues Spiel starten</button>` : `
          <button class="btn btn-large" onclick="show('adventures')">Spiel starten</button>`}
        <div class="btn-row">
          <button class="btn-quiet" onclick="openReference('rules')">Spielregeln</button>
          <button class="btn-quiet" onclick="openReference('settings')">Einstellungen</button>
        </div>
      </div>
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
    document.getElementById("hint-time").textContent = randomHint();
  } else {
    track.style.setProperty("--to", sliderFraction(value, range));
  }
  document.getElementById("time-value").textContent = timeLabel();
}

function mixLabel() {
  const minigames = Math.round(100 * (settings.minigameShare ?? RULES.minigameShareDefault));
  return `${100 - minigames} % Ereignisse · ${minigames} % Minispiele`;
}

function slideMix(input) {
  settings.minigameShare = 1 - Number(input.value) / 100;
  document.getElementById("mix-range").style.setProperty("--to", input.value / 100);
  document.getElementById("mix-value").textContent = mixLabel();
}

function slideVolume(input) {
  setMusicVolume(input.value);
  document.getElementById("volume-range").style.setProperty("--to", input.value / 100);
  document.getElementById("volume-value").textContent = input.value + " %";
}

// Opens the settings with one section marked (e.g. "Ändern" on the names screen); the mark stays until another screen opens.
let settingsFocus = null;
function openSettingsAt(id) {
  openReference("settings");
  settingsFocus = id;
  openHints.add(id);
  render();
  const section = document.getElementById("settings-" + id);
  if (section) section.scrollIntoView({ block: "center" });
}

// Settings explanations stay folded behind an (i) button; toggled in place without a render.
const openHints = new Set();
function sectionHead(id, title) {
  return `<div class="section-head"><h3>${title}</h3><button class="info" aria-label="Erklärung: ${title}" aria-expanded="${openHints.has(id)}"
    onclick="toggleHint('${id}', this)">i</button></div>`;
}
function hint(id, text) { return `<p class="hint" id="hint-${id}" ${openHints.has(id) ? "" : "hidden"}>${text}</p>`; }
function toggleHint(id, button) {
  const open = !openHints.has(id);
  if (open) openHints.add(id); else openHints.delete(id);
  document.getElementById("hint-" + id).hidden = !open;
  button.setAttribute("aria-expanded", open);
}

function randomHint() {
  const [lo, hi] = randomRange();
  return `Nach jeder neu gezogenen Ereigniskarte würfelt die App eine neue Zeit zwischen ${lo} und ${hi} Minuten aus. So weiß niemand genau, wann das nächste Ereignis kommt. Gilt ab der nächsten Karte.`;
}

function rolesSection(segment) {
  const on = settings.roles !== false;
  const rerolls = rerollSetting();
  const inGame = state.running && state.players && state.players.length;
  return `
      <section id="settings-roles" class="${settingsFocus === "roles" ? "focus" : ""}">
        ${sectionHead("roles", "Geheime Rollen")}
        ${hint("roles", on
          ? `Jeder bekommt heimlich eine Rolle mit Fähigkeit und, je nach Abenteuer, geheimer Aufgabe. Gefällt sie nicht, darf man beim Verteilen eine neue ziehen, so oft wie hier eingestellt. Eine weggelegte Rolle bekommt niemand sonst zu sehen. Gibt es zu wenige Rollen, damit jeder gleich oft neu ziehen kann, senkt die App die Zahl für alle gleich.`
          : `Ohne Rollen gibt es kein Raten, keine Fähigkeiten und keine geheimen Aufgaben. Ereigniskarten, die Rollen brauchen, bleiben aus dem Stapel. Jeder startet mit ${coinsText(RULES.startingCoinsFallback)}, am Ende zählen nur die Münzen.`)}
        <div class="segmented" role="group" aria-label="Geheime Rollen verteilen">
          ${segment(on, "setSetting('roles', true)", "Mit Rollen")}
          ${segment(!on, "setSetting('roles', false)", "Ohne Rollen")}
        </div>
        ${on ? `
          <p class="slider-value"><span>Neue Rolle ziehen</span> <span>${rerolls ? `bis zu ${rerolls}× pro Spieler` : "nicht erlaubt"}</span></p>
          <div class="segmented" role="group" aria-label="Wie oft darf jeder eine neue Rolle ziehen?">
            ${RULES.rerollOptions.map(n => segment(rerolls === n, `setSetting('rerolls', ${n})`, n ? n + "×" : "Nie")).join("")}
          </div>` : ""}
        ${inGame ? `<p class="muted">Gilt ab dem nächsten Spiel. Die laufende Partie wird ${rolesOn() ? "mit" : "ohne"} Rollen gespielt.</p>` : ""}
      </section>`;
}

// Only offered while an adventure has drinking cards (the Henkersmahl). Unlike the roles it applies at once.
function drinkingSection(segment) {
  if (!Object.values(ADVENTURES).some(hasDrinkingCards)) return "";
  const on = drinkingOn();
  return `
      <section id="settings-drinking" class="${settingsFocus === "drinking" ? "focus" : ""}">
        ${sectionHead("drinking", "Trinkspiel")}
        ${hint("drinking", on
          ? "Ereigniskarten, geheime Karten und Minispiele mit Trinkrunden und Trinkregeln sind dabei. Alkohol ist trotzdem nie Pflicht: Wasser oder Saft zählen genauso. Gilt sofort, auch in einer laufenden Partie."
          : "Ereigniskarten, geheime Karten und Minispiele mit Trinkrunden und Trinkregeln bleiben draußen, ihr spielt ganz normal. Gilt sofort, auch in einer laufenden Partie.")}
        <div class="segmented" role="group" aria-label="Trinkspiel">
          ${segment(on, "setSetting('drinking', true)", "Mit Trinkspiel")}
          ${segment(!on, "setSetting('drinking', false)", "Ohne")}
        </div>
      </section>`;
}

function screenSettings() {
  const random = settings.timerMode === "random";
  const visible = settings.showTimer !== false;
  const musicOn = settings.music !== false;
  const [lo, hi] = randomRange();
  const range = RULES.eventMinuteRange;
  const volume = Math.round(100 * (settings.musicVolume ?? 0.5));
  const eventShare = Math.round(100 * (1 - (settings.minigameShare ?? RULES.minigameShareDefault)));
  const segment = (pressed, action, text) => `<button aria-pressed="${pressed}" onclick="${action}">${text}</button>`;
  const slider = (key, value, label) => `<input type="range" min="${range[0]}" max="${range[1]}" step="1" value="${value}" aria-label="${label}"
    oninput="slideTime('${key}', this)" onchange="saveSettings()">`;
  const theme = settings.theme === "light" || settings.theme === "dark" ? settings.theme : "auto";
  return `
    <h2>Einstellungen</h2>
    <div class="rules">
      <section>
        ${sectionHead("theme", "Darstellung")}
        ${hint("theme", theme === "auto"
          ? "Valdrien folgt der Einstellung deines Handys und wird abends dunkel, wenn das Handy es auch wird."
          : "Gilt nur auf diesem Handy, egal wie das Handy selbst eingestellt ist.")}
        <div class="segmented" role="group" aria-label="Darstellung">
          ${segment(theme === "auto", "setSetting('theme', 'auto')", "Automatisch")}
          ${segment(theme === "light", "setSetting('theme', 'light')", "Hell")}
          ${segment(theme === "dark", "setSetting('theme', 'dark')", "Dunkel")}
        </div>
      </section>
      ${rolesSection(segment)}
      ${drinkingSection(segment)}
      <section>
        ${sectionHead("time", "Zeit bis zum Ereignis")}
        ${hint("time", random ? randomHint() : "Nach Ablauf der Zeit deckt die App automatisch eine Ereigniskarte auf. Beim Wandern passen 15 Minuten gut, am Tisch eher 10.")}
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
      </section>
      <section>
        ${sectionHead("mix", "Ereignisse und Minispiele")}
        ${hint("mix", "Ist die Zeit um, zieht die App zufällig eine Ereigniskarte oder ein Minispiel. Eine Ereigniskarte löst nie selbst ein Minispiel aus.")}
        <p class="slider-value" id="mix-value">${mixLabel()}</p>
        <div class="range" id="mix-range" style="--from:0; --to:${eventShare / 100}">
          <input type="range" min="0" max="100" step="10" value="${eventShare}" aria-label="Anteil der Ereigniskarten in Prozent"
                 oninput="slideMix(this)" onchange="saveSettings()">
        </div>
        <div class="range-scale"><span>Nur Minispiele</span><span>Nur Ereignisse</span></div>
      </section>
      <section>
        ${sectionHead("clock", "Uhr auf der Hauptseite")}
        ${hint("clock", visible
          ? "Die Restzeit bis zum nächsten Ereignis steht oben rechts auf der Hauptseite. Ein Tipp darauf hält die Uhr an."
          : random
            ? "Die genaue Zeit bleibt geheim. Die Uhr oben rechts zeigt nur, in wie vielen Minuten das nächste Ereignis ungefähr kommt. Anhalten und Weiterlaufen geht trotzdem mit einem Tipp darauf."
            : "Die Restzeit bleibt geheim. Anhalten und Weiterlaufen geht trotzdem mit einem Tipp auf die Uhr oben rechts.")}
        <div class="segmented" role="group" aria-label="Uhr auf der Hauptseite">
          ${segment(visible, "setSetting('showTimer', true)", "Anzeigen")}
          ${segment(!visible, "setSetting('showTimer', false)", "Verbergen")}
        </div>
      </section>
      <section>
        ${sectionHead("speech", "Vorlesen")}
        ${hint("speech", speech.supported
          ? "Geschichten, Ereignisse, Minispiele und das Regelwerk bekommen einen Lautsprecher-Knopf. Rollen und geheime Ereignisse werden nie vorgelesen. Die Stimme kommt kostenlos vom Handy selbst. Auf dem iPhone klingt sie besser, wenn unter Einstellungen › Bedienungshilfen › Gesprochene Inhalte › Stimmen eine deutsche Stimme in verbesserter Qualität geladen ist."
          : "Dieser Browser kann leider nicht vorlesen.")}
        <div class="segmented" role="group" aria-label="Vorlesen">
          ${segment(settings.speech !== false, "setSetting('speech', true)", "An")}
          ${segment(settings.speech === false, "setSetting('speech', false)", "Aus")}
        </div>
      </section>
      <section>
        ${sectionHead("music", "Musik")}
        ${hint("music", "Solange die Ereignis-Uhr läuft, spielt hin und wieder düstere Musik passend zum Abenteuer: Harfe, Flöte und Wind im Wald bei Dämmerung, Laute und Trommel in der Sturmnacht, ein langsamer Totentanz mit Grabglocke und Knochenxylophon im Verlies. Die Musik entsteht live in der App, ganz ohne Dateien und Lizenzkosten. Beim iPhone muss der Stummschalter aus sein.")}
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
      </section>
      <section>
        ${sectionHead("sound", "Signalton")}
        ${hint("sound", "Ist die Zeit um, erklingt kurz ein passender Ton, sobald die neue Karte erscheint: eine dunkle Harfe im Wald, Laute und Glocke in der Taverne, Totenglocke und Schlüsselbund im Verlies. Im Verlies klirrt auch der Schlüsselbund beim Kaufen.")}
        <div class="segmented" role="group" aria-label="Signalton">
          ${segment(settings.sound !== false, "setSetting('sound', true)", "An")}
          ${segment(settings.sound === false, "setSetting('sound', false)", "Aus")}
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
        <button class="adventure-card" ${playable(a) ? `onclick="chooseAdventure('${a.id}')"` : "disabled"}>
          ${adventureArt(a.id, true)}
          <span class="adventure-text">
            <span class="tile-title">${a.title}</span>
            <span class="tile-text">${playable(a) ? a.setting : unplayableText()}</span>
          </span>
        </button>`).join("")}
    </div>
    ${contentSource === "builtin" ? `<p class="muted" style="text-align:center">Ohne Verbindung: Es werden die eingebauten Inhalte gezeigt.</p>` : ""}
  `;
}

function unplayableText() {
  const events = `${RULES.adventureMinEvents} ${RULES.adventureMinEvents === 1 ? "Ereignis" : "Ereignisse"}`;
  return settings.roles !== false
    ? `In Arbeit: braucht mindestens ${RULES.adventureMinRoles} Rollen und ${events}`
    : `Ohne Rollen nicht spielbar: braucht mindestens ${events}, das keine Rollen voraussetzt`;
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
  state.setupAdventure = id;
  if (!(state.players && state.players.length)) {
    state.adventure = id;
    selectAdventureData(id);
  }
  state.names = state.names.slice(0, Math.max(RULES.minPlayers, maxPlayers()));
  show("names");
}

Object.assign(SCREENS, {
  start: screenStart,
  adventures: screenAdventures,
  intro: screenIntro,
  settings: screenSettings
});
