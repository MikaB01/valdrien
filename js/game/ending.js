function screenTasks() {
  const list = state.players.map((s, i) => {
    const r = ROLES[s.role];
    return `
      <label class="task-check">
        <input type="checkbox" id="task-${i}" ${s.taskDone ? "checked" : ""}
               onchange="state.players[${i}].taskDone = this.checked; save()">
        <span><strong>${escapeName(s.name)}</strong> als ${r.name}, ${r.title}<br>
        <span class="muted">${r.task.name}: ${r.task.text} (+${r.task.bonus})</span></span>
      </label>`;
  }).join("");

  return `
    <h2>Die geheimen Aufgaben</h2>
    <p class="muted">Jetzt werden alle Rollen enthüllt. Hakt ab, wer seine Aufgabe nachweisen kann.</p>
    <div>${list}</div>
    <button class="btn" onclick="show('end')">Münzen zählen</button>
  `;
}

function screenEnd() {
  const result = state.players.map(s => ({
    name: s.name,
    total: s.coins + (s.taskDone ? ROLES[s.role].task.bonus : 0)
  })).sort((a, b) => b.total - a.total);

  const best = result[0].total;
  const winner = result.filter(e => e.total === best).map(e => escapeName(e.name));
  const winnerText = winner.join(" & ");

  return `
    ${currentAdventure().epilogue(winnerText, winner.length > 1)}
    ${winner.length > 1 ? `<p class="muted" style="text-align:center">Gleichstand! Die Regel dafür legt ihr noch fest.</p>` : ""}
    <div class="ranking">
      ${result.map(e => `<div><span>${escapeName(e.name)}</span><strong>${e.total} Münzen</strong></div>`).join("")}
    </div>
    <button class="btn" onclick="playAgain()">Nochmal mit derselben Runde</button>
    <button class="btn-quiet" onclick="newGame()">Zum Hauptmenü</button>
  `;
}

function finishAdventure() {
  state.running = false;
  state.timerEnd = null;
  show("tasks");
}

function resumeAdventure() {
  state.running = true;
  state.timerEnd = null;
  show("overview");
}

function playAgain() {
  state.running = false;
  state.timerEnd = null;
  state.players = [];
  show("names");
}

function newGame() {
  state.running = false;
  state.timerEnd = null;
  state.players = [];
  show("start");
}

Object.assign(SCREENS, {
  tasks: screenTasks,
  end: screenEnd
});
