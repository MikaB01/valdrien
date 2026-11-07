function startAdventure() {
  state.running = true;
  state.gameTimeUp = false;
  const limit = Number(settings.gameMinutes) || 0;
  state.gameClock = limit ? { limit: limit * 60000, used: 0, since: Date.now() } : null;
  resetTimer();
  show("overview");
}

// Optional time limit of the whole game (settings "Spieldauer"). It stands still while the event clock is paused.
// state.gameClock = { limit, used, since } in ms; since = null while paused.
function gameLeftMs() {
  const c = state.gameClock;
  if (!c) return Infinity;
  return c.limit - c.used - (c.since ? Date.now() - c.since : 0);
}
function gameEndAt() {
  const c = state.gameClock;
  return c && c.since ? c.since + c.limit - c.used : 0;
}
function gameClockRun(on) {
  const c = state.gameClock;
  if (!c) return;
  if (!on && c.since) { c.used += Date.now() - c.since; c.since = null; }
  if (on && !c.since) c.since = Date.now();
}
function gameLeftText(ms) {
  const minutes = Math.max(0, Math.ceil(ms / 60000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")} h` : `${minutes} Min.`;
}
function gameLeftLine() {
  if (!state.gameClock) return "";
  return ` · noch <span id="game-left">${gameLeftText(gameLeftMs())}</span>`;
}

// Time is up: the game ends with the adventure's own scoring (coins, or keys in the Henkersmahl).
function gameTimeUp() {
  state.gameTimeUp = true;
  gameClockRun(false);
  try { if (navigator.vibrate) navigator.vibrate([300, 150, 300]); } catch (e) {}
  playChime();
  finishAdventure();
}
function timeUpKicker() { return state.gameTimeUp ? `<p class="kicker">Die Spielzeit ist um!</p>` : ""; }

// state.timerEnd is a timestamp, so the countdown survives a locked phone or reload.
// While paused, state.timerPaused holds the remaining milliseconds instead.
function resetTimer() {
  state.timerEnd = null;
  state.timerPaused = null;
  state.timerDuration = null;
  state.timerWindow = null;
}

function nextInterval() {
  if (settings.timerMode !== "random") return minutes() * 60000;
  const [lo, hi] = randomRange();
  return Math.round((lo + Math.random() * (hi - lo)) * 60) * 1000;
}

function startRound() {
  state.timerDuration = nextInterval();
  state.timerWindow = settings.timerMode === "random" ? randomRange() : null;
  state.timerEnd = Date.now() + state.timerDuration;
  state.timerPaused = null;
}

function timerPaused() { return state.timerPaused !== null && state.timerPaused !== undefined; }

function remainingMs() {
  if (timerPaused()) return state.timerPaused;
  return Math.max(0, (state.timerEnd || 0) - Date.now());
}

function roundMs() { return state.timerDuration || minutes() * 60000; }

function toggleTimer() {
  if (timerPaused()) {
    state.timerEnd = Date.now() + state.timerPaused;
    state.timerPaused = null;
    gameClockRun(true);
  } else if (state.timerEnd) {
    state.timerPaused = remainingMs();
    gameClockRun(false);
  }
  save();
  render();
}

function timeText(ms) {
  const seconds = Math.ceil(ms / 1000);
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}

function intervalText() {
  if (settings.timerMode !== "random") return `Alle ${minutes()} Minuten`;
  const [lo, hi] = randomRange();
  return lo === hi ? `Alle ${lo} Minuten` : `Alle ${lo} bis ${hi} Minuten`;
}

// A hidden timer never shows any time: random mode only says "bald …", fixed mode that the clock runs.
function windowText() {
  return state.timerWindow ? "bald …" : "läuft";
}

const PAUSE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>`;
const PLAY_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>`;

// Compact clock in the corner of the main screen; the whole thing is the pause/play button.
function timerButton() {
  if (!state.running || !state.timerEnd) return "";
  const paused = timerPaused();
  const visible = settings.showTimer !== false;
  const left = Math.min(1, remainingMs() / roundMs());
  return `
    <button class="timer-button ${paused ? "paused" : ""}" onclick="toggleTimer()"
            aria-label="${paused ? "Uhr ist angehalten. Weiterlaufen lassen" : "Zeit bis zum nächsten Ereignis. Uhr anhalten"}">
      <span class="timer-ring" id="timer-ring" style="--left:${visible ? left : 1}">${paused ? PLAY_ICON : PAUSE_ICON}</span>
      <span class="timer-text">
        ${visible ? `<span class="timer-time" id="remaining">${timeText(remainingMs())}</span>`
          : `<span class="timer-time timer-window" id="timer-window">${windowText()}</span>`}
        <span class="timer-caption" aria-hidden="true"><span class="${paused ? "off" : ""}">anhalten</span><span class="${paused ? "" : "off"}">fortsetzen</span></span>
      </span>
    </button>`;
}

const INTERRUPTIBLE = ["overview", "coins", "rules", "quickGuide", "roles", "settings", "admin"];
function tick() {
  if (!state.running) return;
  if (state.gameClock) {
    const left = document.getElementById("game-left");
    if (left) left.textContent = gameLeftText(gameLeftMs());
    if (gameLeftMs() <= 0 && INTERRUPTIBLE.includes(state.screen) && !sheet) { gameTimeUp(); return; }
  }
  if (!state.timerEnd || timerPaused()) return;
  const remaining = remainingMs();

  const display = document.getElementById("remaining");
  if (display) {
    display.textContent = timeText(remaining);
    document.getElementById("timer-ring").style.setProperty("--left", Math.min(1, remaining / roundMs()));
  }

  minigameTimerTick(remaining);
  if (remaining === 0) {
    // never interrupt a minigame or a running flow; the card comes once the overview is shown again
    const interruptible = INTERRUPTIBLE.includes(state.screen);
    if (interruptible && !sheet && !canDrawTimed()) { // everything played: start a new round quietly, the overview offers reshuffling
      startRound();
      save();
      if (state.screen === "overview") render();
    } else if (interruptible && !sheet) {
      try { if (navigator.vibrate) navigator.vibrate([300, 150, 300]); } catch (e) {}
      drawTimedCard();
      playChime();
    }
  }
}
