function startAdventure() {
  state.running = true;
  resetTimer();
  show("overview");
}

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
  } else if (state.timerEnd) {
    state.timerPaused = remainingMs();
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

// With a hidden random timer only the remaining window is shown, e.g. "in 3 bis 13 Minuten".
function windowText() {
  const w = state.timerWindow;
  if (!w) return "Nächstes Ereignis kommt bald";
  const elapsed = roundMs() - remainingMs();
  const lo = Math.max(0, Math.ceil((w[0] * 60000 - elapsed) / 60000));
  const hi = Math.max(0, Math.ceil((w[1] * 60000 - elapsed) / 60000));
  if (hi <= 1) return "Nächstes Ereignis kommt gleich";
  if (lo <= 0) return `Nächstes Ereignis kommt in höchstens ${hi} Minuten`;
  if (lo === hi) return `Nächstes Ereignis kommt in ${hi} Minuten`;
  return `Nächstes Ereignis kommt in ${lo} bis ${hi} Minuten`;
}

const PAUSE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>`;
const PLAY_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>`;

function timerBar() {
  if (!state.running || !state.timerEnd) return "";
  const paused = timerPaused();
  const visible = settings.showTimer !== false;
  const percent = Math.min(100, 100 * remainingMs() / roundMs());
  return `
    <div class="timer-bar ${paused ? "paused" : ""}" role="timer">
      <button class="timer-toggle" onclick="toggleTimer()" aria-label="${paused ? "Uhr weiterlaufen lassen" : "Uhr anhalten"}">${paused ? PLAY_ICON : PAUSE_ICON}</button>
      <div class="timer-body">
        <div class="timer-line">
          ${paused ? `<span class="timer-label">Uhr angehalten</span>` : visible
            ? `<span class="timer-label">Nächstes Ereignis</span>`
            : `<span class="timer-label timer-window" id="timer-window">${windowText()}</span>`}
          ${visible ? `<span class="timer-time" id="remaining">${timeText(remainingMs())}</span>` : ""}
        </div>
        ${visible ? `<div class="progress"><div id="progress-fill" style="width:${percent}%"></div></div>` : ""}
      </div>
    </div>`;
}

function tick() {
  if (!state.running || !state.timerEnd || timerPaused()) return;
  const remaining = remainingMs();

  const windowField = document.getElementById("timer-window");
  if (windowField) windowField.textContent = windowText();
  const display = document.getElementById("remaining");
  if (display) {
    display.textContent = timeText(remaining);
    document.getElementById("progress-fill").style.width = Math.min(100, 100 * remaining / roundMs()) + "%";
  }

  if (remaining === 0) {
    // never interrupt a minigame or a running flow; the card comes once the overview is shown again
    const interruptible = ["overview", "coins", "rules", "quickGuide", "roles", "settings"].includes(state.screen);
    if (interruptible && !sheet) {
      try { if (navigator.vibrate) navigator.vibrate([300, 150, 300]); } catch (e) {}
      drawTimedCard();
      playChime();
    }
  }
}
