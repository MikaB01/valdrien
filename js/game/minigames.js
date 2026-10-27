function screenMinigame() {
  const m = state.minigame;
  const mg = m && MINIGAMES[m.index];
  if (!mg) return screenOverview();

  const cheat = state.players.map((_, i) => i).find(i => ROLES[state.players[i].role].ability.mechanic === "loadedDice"
    && state.players[i].revealed && !state.players[i].abilityUsed);
  const loadedDice = m.loadedDice !== undefined
    ? `<p class="note">${playerName(m.loadedDice)} setzt »Gezinkt« ein und darf den verlorenen Versuch wiederholen.</p>`
    : cheat !== undefined
      ? `<button class="btn-quiet" onclick="useLoadedDice(${cheat})">${playerName(cheat)}: »Gezinkt« einsetzen und Versuch wiederholen</button>`
      : "";

  const header = loadedDice + `
    <p class="muted" style="text-align:center">${m.fromEvent ? "Ausgelöst durch die Ereigniskarte" : "Minispiel"}</p>
    <article class="card drawn-card speakable">
      ${speakButton()}
      <div class="title">
        <span class="label">${CATEGORY_NAMES[mg.category]}</span>
        <div class="card-name">${mg.title}</div>
      </div>
      <p class="narrative">${mg.text}</p>
      <p class="coin-line">${m.fromEvent ? "Die Belohnung bestimmt die Ereigniskarte." : rewardText(mg)}</p>
    </article>`;

  if (m.fromEvent) {
    return header + `<button class="btn" onclick="show('event')">Ergebnis eintragen</button>`;
  }


  if (mg.category === "duel" && m.opponent === undefined) {
    return header + `
      <div class="action-group">
        <span class="label">${playerName(m.challenger)} ${m.byAbility ? "" : "hat die wenigsten Münzen und "}fordert heraus. Wen?</span>
        ${state.players.map((s, i) => i === m.challenger ? "" :
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

// player: set when an ability makes this player the challenger or solo player
function drawMinigame(category, fromEvent, player) {
  let options = activeIndices(MINIGAMES).filter(i => !category || MINIGAMES[i].category === category);
  if (options.length > 1 && state.minigame) options = options.filter(i => i !== state.minigame.index);
  const index = options[Math.floor(Math.random() * options.length)];
  startMinigame(index, fromEvent, player);
}

function startMinigame(index, fromEvent, player) {
  const mg = MINIGAMES[index];
  const m = { index: index, fromEvent: Boolean(fromEvent) };

  // drawn freely: the app decides who plays, based on coins
  if (!fromEvent) {
    const order = byCoins();
    const byAbility = player !== undefined;
    if (mg.category === "duel") m.challenger = byAbility ? player : order[0];
    if (mg.category === "oneVsAll") m.soloPlayer = byAbility ? player : order[order.length - 1];
    if (mg.category === "uneven") {
      m.singlePlayer = byAbility ? player : order[order.length - 1];
      m.pairPlayers = order.filter(i => i !== m.singlePlayer).slice(0, 2);
    }
    if (mg.category === "all" && mg.judge) m.judge = order.find(i => i !== player);
    m.byAbility = byAbility;
    if (mg.category === "team") {
      const shuffled = shuffle(state.players.map((_, i) => i));
      const half = Math.ceil(shuffled.length / 2);
      m.teams = [shuffled.slice(0, half), shuffled.slice(half)];
    }
  }

  state.minigame = m;
  if (fromEvent) state.event.minigameIndex = index;
  show("minigame");
}

// fewest coins first, ties in random order
function byCoins() {
  return shuffle(state.players.map((_, i) => i))
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
  const all = state.players.map((_, i) => i);

  switch (mg.category) {
    case "duel": {
      const pair = [m.challenger, m.opponent];
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
  show("overview");
}

function minigameFinished(winners, before, participants) {
  state.lastParticipants = participants || state.players.map((_, i) => i);
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
  const all = state.players.map((_, i) => i);
  if (mg.category === "duel") return [m.challenger, m.opponent];
  if (mg.category === "uneven") return [m.singlePlayer, ...m.pairPlayers];
  if (mg.category === "all" && mg.judge) return all.filter(i => i !== m.judge);
  return all;
}

Object.assign(SCREENS, {
  minigame: screenMinigame
});
