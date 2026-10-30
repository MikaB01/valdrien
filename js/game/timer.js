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

// With a hidden timer only a rough window is shown ("3–13 Min."), or nothing but that the clock runs.
function windowText() {
  const w = state.timerWindow;
  if (!w) return "läuft";
  const elapsed = roundMs() - remainingMs();
  const lo = Math.max(0, Math.ceil((w[0] * 60000 - elapsed) / 60000));
  const hi = Math.max(0, Math.ceil((w[1] * 60000 - elapsed) / 60000));
  if (hi <= 1) return "bald …";
  if (lo <= 0) return `≤ ${hi} Min.`;
  if (lo === hi) return `${hi} Min.`;
  return `${lo}–${hi} Min.`;
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

function tick() {
  if (!state.running || !state.timerEnd || timerPaused()) return;
  const remaining = remainingMs();

  const windowField = document.getElementById("timer-window");
  if (windowField) windowField.textContent = windowText();
  const display = document.getElementById("remaining");
  if (display) {
    display.textContent = timeText(remaining);
    document.getElementById("timer-ring").style.setProperty("--left", Math.min(1, remaining / roundMs()));
  }

  if (remaining === 0) {
    // never interrupt a minigame or a running flow; the card comes once the overview is shown again
    const interruptible = ["overview", "coins", "rules", "quickGuide", "roles", "settings"].includes(state.screen);
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
