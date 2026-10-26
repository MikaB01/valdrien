function startAdventure() {
  state.running = true;
  state.timerEnd = null;
  show("overview");
}

// state.timerEnd is a timestamp, so the countdown survives a locked phone or reload.
function remainingMs() {
  return Math.max(0, (state.timerEnd || 0) - Date.now());
}

function timeText(ms) {
  const seconds = Math.ceil(ms / 1000);
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}

function tick() {
  if (!state.running || !state.timerEnd) return;
  const remaining = remainingMs();

  const display = document.getElementById("remaining");
  if (display) {
    display.textContent = timeText(remaining);
    document.getElementById("progress-fill").style.width = Math.min(100, 100 * remaining / (minutes() * 60000)) + "%";
  }

  if (remaining === 0) {
    // never interrupt a minigame or a running flow; the card comes once the overview is shown again
    const interruptible = ["overview", "coins", "rules", "quickGuide", "roles", "settings"].includes(state.screen);
    if (interruptible) {
      try { if (navigator.vibrate) navigator.vibrate([300, 150, 300]); } catch (e) {}
      drawEvent(true);
    }
  }
}
