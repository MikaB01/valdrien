// Menu › Spielleitung: the game master steps in during play (coins, a new role, the clocks).
function screenAdmin() {
  const timer = state.timerEnd && state.running;
  const clock = state.gameClock;
  const left = clock ? Math.max(0, gameLeftMs()) : 0;
  return `
    <div class="heading"><span class="eyebrow">${currentAdventure().title}</span><h2>Spielleitung</h2></div>
    <p class="muted">Hier greifst du ein, wenn am Tisch etwas schiefgelaufen ist.</p>
    <div class="rules">
      <section>
        <h3>Münzen und Status</h3>
        <button class="btn-quiet" onclick="openReference('coins')">Münzen von Hand ändern</button>
      </section>
      ${rolesOn() ? `
      <section>
        <h3>Rolle neu ziehen</h3>
        <p class="muted">Nur für Rollen, die noch nicht erraten sind. Die neue Rolle sieht nur dieser Spieler, Münzen ändern sich um den Unterschied beim Startkapital.</p>
        ${adminRerollHtml()}
      </section>` : ""}
      ${timer ? `
      <section>
        <h3>Nächste Karte</h3>
        <p class="slider-value"><span>${timerPaused() ? "Uhr angehalten" : "Kommt in"}</span><span>${timeText(remainingMs())}</span></p>
        <div class="action-row">
          <button class="action" onclick="shiftTimer(-60000)" ${remainingMs() <= 60000 ? "disabled" : ""}>− 1 Min.</button>
          <button class="action" onclick="shiftTimer(60000)">+ 1 Min.</button>
        </div>
      </section>` : ""}
      <section>
        <h3>Spieldauer</h3>
        ${clock ? `
          <p class="slider-value"><span>Spielende in</span><span>${gameLeftText(left)}</span></p>
          <div class="action-row">
            <button class="action" onclick="shiftGameClock(-15)" ${left <= 15 * 60000 ? "disabled" : ""}>− 15 Min.</button>
            <button class="action" onclick="shiftGameClock(15)">+ 15 Min.</button>
          </div>
          <button class="link-button" onclick="setGameLimit(0)">Zeitlimit aufheben</button>` : `
          <p class="muted">Kein Zeitlimit. Mit einem Limit endet das Spiel von selbst, gewertet nach den Regeln des Abenteuers.</p>
          <div class="action-row">
            ${RULES.gameMinuteOptions.filter(Boolean).map(n => `<button class="action" onclick="setGameLimit(${n})">${n} Min.</button>`).join("")}
          </div>`}
      </section>
    </div>`;
}

function adminRerollHtml() {
  const pool = rerollPool().length;
  if (!pool) return `<p class="note">Es ist keine Rolle mehr übrig, die noch niemand gesehen hat.</p>`;
  const i = adminConfirm;
  if (i !== null && state.players[i] && !state.players[i].revealed) return `
    <div class="confirm" role="alertdialog" aria-labelledby="admin-reroll-title">
      <strong id="admin-reroll-title">Neue Rolle für ${playerName(i)}?</strong>
      <p class="muted">Die alte Rolle kommt aus dem Spiel. Danach gibst du ${playerName(i)} das Handy, damit nur ${playerName(i)} die neue Rolle sieht.</p>
      <button class="btn" onclick="adminReroll(${i})">Ja, neu ziehen</button>
      <button class="link-button" onclick="adminConfirm = null; keepScroll(render)">Abbrechen</button>
    </div>`;
  return `<div class="choices">${state.players.map((s, k) => `
    <button class="choice" onclick="adminConfirm = ${k}; keepScroll(render)" ${s.revealed ? "disabled" : ""}>
      <span>${escapeName(s.name)}</span><span class="muted">${s.revealed ? "schon erraten" : "›"}</span>
    </button>`).join("")}</div>`;
}

function adminReroll(i) {
  const s = state.players[i];
  const pool = rerollPool();
  if (!s || s.revealed || !pool.length) return;
  adminConfirm = null;
  state.discardedRoles = (state.discardedRoles || []).concat(s.role);
  switchRole(i, pool[Math.floor(Math.random() * pool.length)]);
  startMyRole(i);
}

function shiftTimer(ms) {
  if (timerPaused()) state.timerPaused = Math.max(1000, state.timerPaused + ms);
  else if (state.timerEnd) state.timerEnd = Math.max(Date.now() + 1000, state.timerEnd + ms);
  state.timerDuration = Math.max(state.timerDuration || 0, remainingMs());
  save();
  keepScroll(render);
}

function shiftGameClock(minutes) {
  const c = state.gameClock;
  if (!c) return;
  c.limit = Math.max(c.used + (c.since ? Date.now() - c.since : 0) + 60000, c.limit + minutes * 60000);
  save();
  keepScroll(render);
}

// A limit set during play counts from now.
function setGameLimit(minutes) {
  state.gameClock = minutes ? { limit: minutes * 60000, used: 0, since: timerPaused() ? null : Date.now() } : null;
  save();
  keepScroll(render);
}

Object.assign(SCREENS, { admin: screenAdmin });
