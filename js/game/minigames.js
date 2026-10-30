function screenMinigame() {
  const m = state.minigame;
  const mg = m && MINIGAMES[m.index];
  if (!mg) return screenOverview();

  const kicker = minigameAbilities()
    + (m.automatic ? `<p class="kicker">Die Zeit ist um! Ein Minispiel beginnt …</p>` : `<p class="muted" style="text-align:center">Minispiel</p>`);
  const card = `
    <article class="card drawn-card speakable">
      ${speakButton()}
      <div class="title">
        <span class="label">${CATEGORY_NAMES[mg.category]}</span>
        <div class="card-name">${mg.title}</div>
      </div>
      <p class="narrative">${mg.text}</p>
      <p class="coin-line">${m.stakes === "half" ? "Einsatz: Der Sieger erhält die Hälfte der Münzen des Verlierers (aufgerundet)." : rewardText(mg)}</p>
    </article>`;
  const notes = cardNotes(m.card) + pauseControls();

  if (mg.category === "duel" && m.opponent === undefined) {
    return kicker + lineup("Wer spielt mit?", [{ label: "Fordert heraus", players: [m.challenger] }], m.byAbility ? "" : coinReason(m.challenger, m.pool, "fewest")) + card + notes + `
      <div class="action-group">
        <span class="label">Wen fordert ${playerName(m.challenger)} heraus?</span>
        ${(m.pool || state.players.map((_, i) => i)).map(i => i === m.challenger ? "" :
          `<button class="action" onclick="chooseOpponent(${i})">${playerName(i)}</button>`).join("")}
      </div>`;
  }

  return kicker + minigameLineup() + card + notes + `
    <div class="action-group">
      <span class="label">Wie ist es ausgegangen?</span>
      ${minigameOutcomes().map((e, k) =>
        `<button class="action" onclick="scoreMinigame(${k})">${e.text}</button>`).join("")}
    </div>`;
}

// Who plays, shown prominently above the card; says why the app picked someone (and when it was a tie).
function minigameLineup() {
  const m = state.minigame;
  const mg = MINIGAMES[m.index];
  const all = m.pool || state.players.map((_, i) => i);
  const why = (i, kind) => m.byAbility ? "" : coinReason(i, all, kind);
  switch (mg.category) {
    case "duel": return lineup("Wer spielt mit?", [
      { label: "Fordert heraus", players: [m.challenger] }, { versus: true }, { label: "Gegner", players: [m.opponent] }]);
    case "oneVsAll": return lineup("Wer spielt mit?", [
      { label: "Allein", players: [m.soloPlayer] }, { versus: true }, { label: "Gruppe", players: all.filter(i => i !== m.soloPlayer) }],
      why(m.soloPlayer, "most"));
    case "uneven": return lineup("Wer spielt mit?", [
      { label: mg.singleName, players: [m.singlePlayer] }, { versus: true }, { label: mg.pairName, players: m.pairPlayers }],
      m.byAbility ? "" : [coinReason(m.singlePlayer, all, "most"), pairReason(m.pairPlayers, all)].filter(Boolean).join(" "));
    case "team": return lineup("Wer spielt mit?", [
      { label: "Team 1", players: m.teams[0] }, { versus: true }, { label: "Team 2", players: m.teams[1] }], "Die App hat die Teams ausgelost.");
    case "all": return lineup("Wer spielt mit?", mg.judge
      ? [{ label: "Alle gegen alle", players: all.filter(i => i !== m.judge) }, { label: "Richter", players: [m.judge] }]
      : [{ label: "Alle gegen alle", players: all }], mg.judge ? why(m.judge, "fewest") : "");
  }
  return "";
}

// Why the app picked player i: most or fewest coins in pool, or drawn by lot on a tie.
function coinReason(i, pool, kind) {
  const coins = (pool || state.players.map((_, k) => k)).map(k => state.players[k].coins);
  const target = kind === "most" ? Math.max(...coins) : Math.min(...coins);
  const tied = coins.filter(c => c === target).length;
  const name = playerName(i);
  if (tied === coins.length) return `Alle haben gleich viele Münzen, darum hat die App ${name} ausgelost.`;
  if (tied > 1) return `Gleichstand bei den ${kind === "most" ? "meisten" : "wenigsten"} Münzen, die App hat ${name} ausgelost.`;
  return `${name} hat die ${kind === "most" ? "meisten" : "wenigsten"} Münzen.`;
}

function pairReason(pair, pool) {
  const coins = pool.map(k => state.players[k].coins).sort((a, b) => a - b);
  const pairCoins = pair.map(k => state.players[k].coins);
  const clear = coins.length < 3 || Math.max(...pairCoins) < coins[2];
  return clear ? `${playerNames(pair)} haben die wenigsten Münzen.` : `${playerNames(pair)}: die wenigsten Münzen, bei Gleichstand ausgelost.`;
}

// Menu entry "Anderes Minispiel ziehen": discards the open minigame (after confirming in the menu).
function openMinigame() {
  const m = state.minigame;
  return m && !m.done && MINIGAMES[m.index] ? m : null;
}

function redrawMinigame() {
  const m = openMinigame();
  if (!m) return;
  const r = m.request || {};
  drawMinigame(r.category || null, r.player === null || r.player === undefined ? undefined : r.player, true);
  // abilities announced for the discarded minigame carry over to the new one
  ["stakes", "tournament", "loadedDice"].forEach(key => { if (m[key] !== undefined && state.minigame) state.minigame[key] = m[key]; });
  save();
  render();
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
function drawMinigame(category, player, again) {
  const open = state.minigame;
  const resume = !again && open && !open.done && !open.byAbility && !category && player === undefined;
  if (resume) { show("minigame"); return; }
  if (player === undefined && !again) cardDrawn("minigame");
  state.tip = null; // Trinkgeld lasts until a minigame is drawn
  state.tableRule = null;
  let options = remainingMinigames(category);
  // an ability still needs its minigame, even if all of that kind were played
  if (!options.length && (category || player !== undefined)) {
    options = activeIndices(MINIGAMES).filter(i => !category || MINIGAMES[i].category === category);
  }
  if (!options.length) { show("overview"); return; }
  if (options.length > 1 && state.minigame) options = options.filter(i => i !== state.minigame.index);
  const index = options[Math.floor(Math.random() * options.length)];
  startMinigame(index, player);
  state.minigame.request = { category: category || null, player: player === undefined ? null : player };
  save();
}

function startMinigame(index, player) {
  const mg = MINIGAMES[index];
  const m = { index: index, card: state.cardCount || 0 };

  // the app decides who plays, based on coins; a player on Pinkelpause sits out unless an ability calls him
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

  state.minigame = m;
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
