function screenMinigame() {
  return minigameBody() + redrawBlock();
}

function redrawBlock() {
  const m = state.minigame;
  if (!m || m.done || !MINIGAMES[m.index]) return "";
  return confirmRedraw ? `
    <div class="confirm" role="alertdialog" aria-labelledby="redraw-title">
      <strong id="redraw-title">Wirklich ein anderes Minispiel ziehen?</strong>
      <p class="muted">Das aktuelle Minispiel wird verworfen.</p>
      <button class="btn" onclick="redrawMinigame()">Ja, neu ziehen</button>
      <button class="link-button" onclick="confirmRedraw = false; render()">Abbrechen</button>
    </div>` : `<button class="link-button" onclick="confirmRedraw = true; render()">Anderes Minispiel ziehen</button>`;
}

function redrawMinigame() {
  const m = state.minigame;
  const r = m.request || {};
  confirmRedraw = false;
  drawMinigame(r.category || null, m.fromEvent, r.player === null || r.player === undefined ? undefined : r.player, true);
  // abilities announced for the discarded minigame carry over to the new one
  ["stakes", "tournament", "loadedDice"].forEach(key => { if (m[key] !== undefined && state.minigame) state.minigame[key] = m[key]; });
  save();
  render();
}

function minigameBody() {
  const m = state.minigame;
  const mg = m && MINIGAMES[m.index];
  if (!mg) return screenOverview();

  const header = minigameAbilities() + `
    ${m.automatic ? `<p class="kicker">Die Zeit ist um! Ein Minispiel beginnt …</p>`
      : `<p class="muted" style="text-align:center">${m.fromEvent ? "Ausgelöst durch die Ereigniskarte" : "Minispiel"}</p>`}
    <article class="card drawn-card speakable">
      ${speakButton()}
      <div class="title">
        <span class="label">${CATEGORY_NAMES[mg.category]}</span>
        <div class="card-name">${mg.title}</div>
      </div>
      <p class="narrative">${mg.text}</p>
      <p class="coin-line">${m.fromEvent ? "Die Belohnung bestimmt die Ereigniskarte." : m.stakes === "half" ? "Einsatz: Der Sieger erhält die Hälfte der Münzen des Verlierers (aufgerundet)." : rewardText(mg)}</p>
    </article>
    ${m.fromEvent ? "" : cardNotes(m.card) + pauseControls()}`;

  if (m.fromEvent) {
    return header + `<button class="btn" onclick="show('event')">Ergebnis eintragen</button>`;
  }


  if (mg.category === "duel" && m.opponent === undefined) {
    return header + `
      <div class="action-group">
        <span class="label">${playerName(m.challenger)} ${m.byAbility ? "" : "hat die wenigsten Münzen und "}fordert heraus. Wen?</span>
        ${(m.pool || state.players.map((_, i) => i)).map(i => i === m.challenger ? "" :
          `<button class="action" onclick="chooseOpponent(${i})">${playerName(i)}</button>`).join("")}
      </div>`;
  }

  let lineup = "";
  if (mg.category === "duel") lineup = `Es treten an: ${playerName(m.challenger)} gegen ${playerName(m.opponent)}`;
  if (mg.category === "oneVsAll") lineup = `Der Einzelne ist ${playerName(m.soloPlayer)}${m.byAbility ? "" : " (die meisten Münzen)"}`;
  if (mg.category === "uneven") lineup = `${mg.singleName}: ${playerName(m.singlePlayer)} · ${mg.pairName}: ${playerNames(m.pairPlayers)}`;
  if (mg.category === "team") lineup = `Team 1: ${playerNames(m.teams[0])}<br>Team 2: ${playerNames(m.teams[1])}`;
  if (mg.category === "all" && mg.judge) lineup = `Richter: ${playerName(m.judge)} (die wenigsten Münzen)`;

  return header + `
    ${lineup ? `<p class="note">${lineup}</p>` : ""}
    <div class="action-group">
      <span class="label">Wie ist es ausgegangen?</span>
      ${minigameOutcomes().map((e, k) =>
        `<button class="action" onclick="scoreMinigame(${k})">${e.text}</button>`).join("")}
    </div>`;
}

// Minigames count as played once their result is entered; only reshuffleMinigames() brings them back.
function remainingMinigames(category) {
  const played = new Set(state.playedMinigames || []);
  return activeIndices(MINIGAMES).filter(i => !played.has(i) && (!category || MINIGAMES[i].category === category));
}

function markMinigamePlayed() {
  const m = state.minigame;
  if (!m) return;
  m.done = true;
  state.playedMinigames = (state.playedMinigames || []).filter(i => i !== m.index).concat(m.index);
}

function reshuffleMinigames() {
  state.playedMinigames = [];
  show("overview");
}

// player: set when an ability makes this player the challenger or solo player.
// An open minigame is shown again instead of drawing a new one; again = true draws anew (confirmed redraw).
function drawMinigame(category, fromEvent, player, again) {
  const open = state.minigame;
  const resume = !again && open && (fromEvent
    ? open.fromEvent && state.event && state.event.minigameIndex === open.index
    : !open.done && !open.fromEvent && !open.byAbility && !category && player === undefined);
  if (resume) { show("minigame"); return; }
  if (!fromEvent && player === undefined && !again) cardDrawn("minigame");
  state.tip = null; // Trinkgeld lasts until a minigame is drawn
  let options = remainingMinigames(category);
  // an event card or ability still needs its minigame, even if all of that kind were played
  if (!options.length && (fromEvent || category || player !== undefined)) {
    options = activeIndices(MINIGAMES).filter(i => !category || MINIGAMES[i].category === category);
  }
  if (!options.length) { show("overview"); return; }
  if (options.length > 1 && state.minigame) options = options.filter(i => i !== state.minigame.index);
  const index = options[Math.floor(Math.random() * options.length)];
  startMinigame(index, fromEvent, player);
  state.minigame.request = { category: category || null, player: player === undefined ? null : player };
  save();
}

function startMinigame(index, fromEvent, player) {
  const mg = MINIGAMES[index];
  const m = { index: index, fromEvent: Boolean(fromEvent), card: state.cardCount || 0 };

  // drawn freely: the app decides who plays, based on coins; a player on Pinkelpause sits out unless an ability calls him
  if (!fromEvent) {
    const byAbility = player !== undefined;
    m.pool = byAbility ? state.players.map((_, i) => i) : inPlay();
    const order = byCoins(m.pool);
    if (mg.category === "duel") m.challenger = byAbility ? player : order[0];
    if (mg.category === "oneVsAll") m.soloPlayer = byAbility ? player : order[order.length - 1];
    if (mg.category === "uneven") {
      m.singlePlayer = byAbility ? player : order[order.length - 1];
      m.pairPlayers = order.filter(i => i !== m.singlePlayer).slice(0, 2);
    }
    if (mg.category === "all" && mg.judge) m.judge = order.find(i => i !== player);
    m.byAbility = byAbility;
    if (mg.category === "team") {
      const shuffled = shuffle(m.pool);
      const half = Math.ceil(shuffled.length / 2);
      m.teams = [shuffled.slice(0, half), shuffled.slice(half)];
    }
  }

  state.minigame = m;
  if (fromEvent) state.event.minigameIndex = index;
  show("minigame");
}

// fewest coins first, ties in random order
function byCoins(pool) {
  return shuffle(pool || state.players.map((_, i) => i))
    .sort((a, b) => state.players[a].coins - state.players[b].coins);
}

function rewardText(mg) {
  switch (mg.category) {
    case "duel": return `Sieger: ${signed(mg.winner)}` + (mg.loser ? ` · Verlierer: ${signed(mg.loser)}` : "");
    case "all": return `Sieger: ${signed(mg.winner)}` + (mg.judge ? ` · Richter: ${signed(mg.judge)}` : "");
    case "oneVsAll": return `Einzelner gewinnt: ${signed(mg.solo)}`
      + (mg.group ? ` · Gruppe gewinnt: je ${signed(mg.group)}` : "")
      + (mg.fail ? ` · Scheitert er: ${signed(mg.fail)}` : "");
    case "team": return `Siegerteam: je ${signed(mg.team)}`;
    case "uneven": return `${mg.singleName} gewinnt: ${signed(mg.single)} · ${mg.pairName} gewinnen: je ${signed(mg.pair)}`;
  }
  return "";
}

function minigameOutcomes() {
  const m = state.minigame;
  const mg = MINIGAMES[m.index];
  const all = m.pool || state.players.map((_, i) => i);

  switch (mg.category) {
    case "duel": {
      const pair = [m.challenger, m.opponent];
      if (m.stakes === "half") return pair.map((winner, k) => {
        const loser = pair[1 - k];
        const amount = Math.ceil(state.players[loser].coins / 2);
        return {
          text: `${playerName(winner)} gewinnt und erhält ${coinsText(amount)} von ${playerName(loser)}`,
          apply: () => transfer(loser, winner, amount),
          winners: [winner]
        };
      });
      return pair.map((winner, k) => {
        const loser = pair[1 - k];
        return {
          text: `${playerName(winner)} gewinnt (${signed(mg.winner)}${mg.loser ? `, ${playerName(loser)} ${signed(mg.loser)}` : ""})`,
          apply: () => { addCoins([winner], mg.winner); if (mg.loser) addCoins([loser], mg.loser); },
          winners: [winner]
        };
      });
    }
    case "all":
      return all.filter(i => i !== m.judge).map(i => ({
        text: `${playerName(i)} gewinnt (${signed(mg.winner)})`,
        apply: () => { addCoins([i], mg.winner); if (mg.judge) addCoins([m.judge], mg.judge); },
        winners: [i]
      }));
    case "oneVsAll": {
      const group = all.filter(i => i !== m.soloPlayer);
      const list = [{ text: `${playerName(m.soloPlayer)} gewinnt (${signed(mg.solo)})`, apply: () => addCoins([m.soloPlayer], mg.solo), winners: [m.soloPlayer] }];
      if (mg.group) list.push({ text: `Die Gruppe gewinnt (je ${signed(mg.group)})`, apply: () => addCoins(group, mg.group), winners: group });
      if (mg.fail) list.push({ text: `${playerName(m.soloPlayer)} scheitert (${signed(mg.fail)})`, apply: () => addCoins([m.soloPlayer], mg.fail), winners: [] });
      return list;
    }
    case "team":
      return m.teams.map((team, k) => ({
        text: `Team ${k + 1} gewinnt (je ${signed(mg.team)})`,
        apply: () => addCoins(team, mg.team),
        winners: team
      }));
    case "uneven":
      return [
        { text: `${mg.singleName} ${playerName(m.singlePlayer)} gewinnt (${signed(mg.single)})`, apply: () => addCoins([m.singlePlayer], mg.single), winners: [m.singlePlayer] },
        { text: `Die ${mg.pairName} gewinnen (je ${signed(mg.pair)})`, apply: () => addCoins(m.pairPlayers, mg.pair), winners: m.pairPlayers }
      ];
  }
  return [];
}

function chooseOpponent(i) {
  state.minigame.opponent = i;
  save();
  render();
}

function scoreMinigame(k) {
  const result = minigameOutcomes()[k];
  if (!result) return;
  const before = state.players.map(s => s.coins);
  result.apply();
  minigameFinished(result.winners || [], before, minigameParticipants());
  markMinigamePlayed();
  show("overview");
}

function minigameFinished(winners, before, participants) {
  state.lastParticipants = participants || state.players.map((_, i) => i);
  tournamentPayout(winners, state.lastParticipants);
  state.lastWinnings = {};
  winners.forEach(i => {
    const gained = state.players[i].coins - before[i];
    if (gained > 0) state.lastWinnings[i] = gained;
  });
  const bonus = state.winBonus;
  state.winBonus = null;
  if (bonus && winners.includes(bonus.player)) addCoins([bonus.player], bonus.amount);
}

function minigameParticipants() {
  const m = state.minigame;
  const mg = MINIGAMES[m.index];
  const all = m.pool || state.players.map((_, i) => i);
  if (mg.category === "duel") return [m.challenger, m.opponent];
  if (mg.category === "uneven") return [m.singlePlayer, ...m.pairPlayers];
  if (mg.category === "all" && mg.judge) return all.filter(i => i !== m.judge);
  return all;
}

Object.assign(SCREENS, {
  minigame: screenMinigame
});
