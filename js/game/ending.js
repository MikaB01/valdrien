function screenTasks() {
  const list = state.players.map((s, i) => {
    const r = ROLES[s.role];
    return `
      <label class="task-check">
        <input type="checkbox" id="task-${i}" ${s.taskDone ? "checked" : ""}
               onchange="state.players[${i}].taskDone = this.checked; save()">
        <span><span class="player-name">${escapeName(s.name)}</span><br>als ${r.name}, ${r.title}<br>
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
  if (keysGoal()) return screenKeysEnd();
  const result = state.players.map((s, i) => ({
    name: s.name,
    total: s.coins + (s.taskDone && roleOf(i) ? roleOf(i).task.bonus : 0)
  })).sort((a, b) => b.total - a.total);

  const best = result[0].total;
  const winner = result.filter(e => e.total === best).map(e => escapeName(e.name));
  const winnerText = winner.join(" & ");

  return `
    <div class="speakable epilogue">${speakButton()}${currentAdventure().epilogue(winnerText, winner.length > 1)}</div>
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
  resetTimer();
  show(rolesOn() && !keysGoal() ? "tasks" : "end");
}

function resumeAdventure() {
  if (state.escaped !== undefined && state.escaped !== null) return;
  state.running = true;
  resetTimer();
  show("overview");
}

function playAgain() {
  state.running = false;
  state.escaped = null;
  resetTimer();
  state.players = [];
  show("names");
}

function newGame() {
  state.running = false;
  state.escaped = null;
  resetTimer();
  state.players = [];
  show("start");
}

Object.assign(SCREENS, {
  tasks: screenTasks,
  end: screenEnd
});
