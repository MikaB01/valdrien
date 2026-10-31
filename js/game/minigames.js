// Minigames: drawing, line-ups, the app's help while a minigame is played (MINIGAME_TOOLS, field "tool")
// and booking the result (field "scoring", default = the category's own reward fields).
// state.minigame: { index, card, pool, byAbility, duel, challenger, opponent, soloPlayer, singlePlayer, pairPlayers, judge,
//   teams, opener, run (tool state), pick (selections before booking), points (perPoint rounds), timeUp, stakes, ... }

// A duel: a minigame of the category duel, or one played by two because an ability asked for a duel.
function isDuel(m) { return Boolean(m.duel) || MINIGAMES[m.index].category === "duel"; }
// Minigames an ability duel may draw: duels and minigames that also work for two, never drinking games.
function duelReady(i) { const mg = MINIGAMES[i]; return !mg.drinking && (mg.category === "duel" || mg.twoPlayer); }
function fitsRequest(i, category) {
  return !category || (category === "duel" ? duelReady(i) : MINIGAMES[i].category === category);
}

function screenMinigame() {
  const m = state.minigame;
  const mg = m && MINIGAMES[m.index];
  if (!mg) return screenOverview();
  // games saved before minigames had tools and selections
  m.pool = m.pool || state.players.map((_, i) => i);
  if (!m.done && lineupComplete(m) && !m.pick) prepareMinigame(m);

  const kicker = minigameAbilities()
    + (m.automatic ? `<p class="kicker">Die Zeit ist um! Ein Minispiel beginnt …</p>` : `<p class="muted" style="text-align:center">Minispiel${mg.drinking ? " · Trinkspiel" : ""}</p>`);
  const card = `
    <article class="card drawn-card speakable">
      ${speakButton()}
      <div class="title">
        <span class="label">${isDuel(m) && mg.category !== "duel" ? "Als Duell" : CATEGORY_NAMES[mg.category]}</span>
        <div class="card-name">${mg.title}</div>
      </div>
      <p class="narrative">${mg.text}</p>
      <p class="coin-line">${rewardText(mg, m)}</p>
    </article>`;
  const notes = cardNotes(m.card) + pauseControls();

  if (isDuel(m) && m.opponent === undefined) {
    return kicker + lineup("Wer spielt mit?", [{ label: "Fordert heraus", players: [m.challenger] }],
      m.byAbility ? "" : `Die App hat ${playerName(m.challenger)} ausgelost. ${playerName(m.challenger)} sucht sich einen Gegner aus.`) + card + notes + `
      <div class="action-group">
        <span class="label">Wen fordert ${playerName(m.challenger)} heraus?</span>
        ${m.pool.map(i => i === m.challenger ? "" :
          `<button class="action" onclick="chooseOpponent(${i})">${playerName(i)}</button>`).join("")}
      </div>`;
  }
  if (!isDuel(m) && mg.category === "oneVsAll" && m.soloPlayer === undefined) {
    return kicker + card + notes + `
      <div class="action-group">
        <span class="label">Wen hat die Gruppe gewählt?</span>
        ${m.pool.map(i => `<button class="action" onclick="chooseSolo(${i})">${playerName(i)}</button>`).join("")}
      </div>`;
  }

  const tool = MINIGAME_TOOLS[mg.tool];
  // while one player has the phone (drawing, stopping, voting) only the tool is shown
  if (tool && tool.focus && tool.focus(m)) return `<section class="minigame-tool">${tool.html(m, mg)}</section>`;
  const ready = !tool || !tool.ready || tool.ready(m, mg);
  return kicker + minigameLineup() + card + duelNote(m, mg) + notes
    + (tool ? `<section class="minigame-tool">${tool.html(m, mg)}</section>` : "")
    + (ready ? outcomeHtml(m, mg) : "");
}

function duelNote(m, mg) {
  if (!m.duel) return "";
  const roles = mg.category === "oneVsAll"
    ? ` ${playerName(m.opponent)} übernimmt den Part des Einzelnen, ${playerName(m.challenger)} den der Gruppe.` : "";
  return `<p class="note">Herausforderung: Ihr spielt dieses Minispiel zu zweit.${roles} Endet es unentschieden, spielt ihr es noch einmal.</p>`;
}

// Who plays, shown prominently above the card; says why the app picked someone (and when it was a tie).
function minigameLineup() {
  const m = state.minigame;
  const mg = MINIGAMES[m.index];
  const all = m.pool;
  const why = (i, kind) => m.byAbility ? "" : coinReason(i, all, kind);
  const opener = m.opener !== undefined ? `${coinReason(m.opener, minigameParticipants(), "most")} ${playerName(m.opener)} beginnt.` : "";
  const reason = (...parts) => parts.filter(Boolean).join(" ");
  if (isDuel(m)) return lineup("Wer spielt mit?", [
    { label: "Fordert heraus", players: [m.challenger] }, { versus: true }, { label: "Gegner", players: [m.opponent] }],
    reason(m.byAbility ? "" : `Die App hat ${playerName(m.challenger)} ausgelost.`, opener));
  switch (mg.category) {
    case "oneVsAll": return lineup("Wer spielt mit?", [
      { label: "Allein", players: [m.soloPlayer] }, { versus: true }, { label: "Gruppe", players: all.filter(i => i !== m.soloPlayer) }],
      reason(mg.alone === "vote" ? "Von der Gruppe gewählt." : why(m.soloPlayer, mg.alone === "fewest" ? "fewest" : "most"), opener));
    case "uneven": return lineup("Wer spielt mit?", [
      { label: mg.singleName, players: [m.singlePlayer] }, { versus: true }, { label: mg.pairName, players: m.pairPlayers }],
      m.byAbility ? "" : [coinReason(m.singlePlayer, all, "most"), pairReason(m.pairPlayers, all)].filter(Boolean).join(" "));
    case "team": return lineup("Wer spielt mit?", [
      { label: "Team 1", players: m.teams[0] }, { versus: true }, { label: "Team 2", players: m.teams[1] }], "Die App hat die Teams ausgelost.");
    case "all": return lineup("Wer spielt mit?", mg.judge
      ? [{ label: "Alle gegen alle", players: all.filter(i => i !== m.judge) }, { label: "Richter", players: [m.judge] }]
      : [{ label: "Alle gegen alle", players: all }], reason(mg.judge ? why(m.judge, "fewest") : "", opener));
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
// category "duel" also takes the minigames that work for two (an ability duel).
function remainingMinigames(category) {
  const played = new Set(state.playedMinigames || []);
  return playableMinigames().filter(i => !played.has(i) && fitsRequest(i, category));
}

function markMinigamePlayed() {
  const m = state.minigame;
  if (!m) return;
  m.done = true;
  if (m.run && m.run.images) m.run = null; // drawings are not kept once the result is in
  state.playedMinigames = (state.playedMinigames || []).filter(i => i !== m.index).concat(m.index);
}

function reshuffleMinigames() {
  state.playedMinigames = [];
  show("overview");
}

// player: set when an ability makes this player the challenger or solo player.
// An open minigame is shown again instead of drawing a new one; again = true draws anew (confirmed redraw).
// Returns whether a minigame was started.
function drawMinigame(category, player, again) {
  const open = state.minigame;
  const resume = !again && open && !open.done && !open.byAbility && !category && player === undefined;
  if (resume) { show("minigame"); return true; }
  if (player === undefined && !again) cardDrawn("minigame");
  state.tip = null; // Trinkgeld lasts until a minigame is drawn
  state.tableRules = [];
  let options = remainingMinigames(category);
  // an ability still needs its minigame, even if all of that kind were played
  if (!options.length && (category || player !== undefined)) options = playableMinigames().filter(i => fitsRequest(i, category));
  if (!options.length) { show("overview"); return false; }
  if (options.length > 1 && state.minigame) options = options.filter(i => i !== state.minigame.index);
  const index = options[Math.floor(Math.random() * options.length)];
  startMinigame(index, player, category === "duel");
  state.minigame.request = { category: category || null, player: player === undefined ? null : player };
  save();
  return true;
}

function startMinigame(index, player, duel) {
  const mg = MINIGAMES[index];
  const m = { index: index, card: state.cardCount || 0 };

  // the app decides who plays; a player on Pinkelpause sits out unless an ability calls him
  const byAbility = player !== undefined;
  m.pool = byAbility ? state.players.map((_, i) => i) : inPlay();
  m.byAbility = byAbility;
  if (duel && mg.category !== "duel") m.duel = true;
  const order = byCoins(m.pool);
  if (isDuel(m)) m.challenger = byAbility ? player : m.pool[Math.floor(Math.random() * m.pool.length)];
  else if (mg.category === "oneVsAll") {
    if (byAbility) m.soloPlayer = player;
    else if (mg.alone === "fewest") m.soloPlayer = order[0];
    else if (mg.alone !== "vote") m.soloPlayer = order[order.length - 1];
  }
  if (!isDuel(m) && mg.category === "uneven") {
    m.singlePlayer = byAbility ? player : order[order.length - 1];
    m.pairPlayers = order.filter(i => i !== m.singlePlayer).slice(0, 2);
  }
  if (!isDuel(m) && mg.category === "all" && mg.judge) m.judge = order.find(i => i !== player);
  if (!isDuel(m) && mg.category === "team") {
    const shuffled = shuffle(m.pool);
    const half = Math.ceil(shuffled.length / 2);
    m.teams = [shuffled.slice(0, half), shuffled.slice(half)];
  }

  state.minigame = m;
  if (lineupComplete(m)) prepareMinigame(m);
  show("minigame");
}

function lineupComplete(m) {
  if (isDuel(m)) return m.opponent !== undefined;
  return MINIGAMES[m.index].category !== "oneVsAll" || m.soloPlayer !== undefined;
}

// Once everybody is known: who starts, and the tool's own preparation (target time, terms, questions).
function prepareMinigame(m) {
  const mg = MINIGAMES[m.index];
  m.run = null;
  m.pick = {};
  m.points = [];
  m.timeUp = false;
  if (mg.opener === "most") { const order = byCoins(minigameParticipants()); m.opener = order[order.length - 1]; }
  const tool = MINIGAME_TOOLS[mg.tool];
  if (tool && tool.prepare) tool.prepare(m, mg);
}

// fewest coins first, ties in random order
function byCoins(pool) {
  return shuffle(pool || state.players.map((_, i) => i))
    .sort((a, b) => state.players[a].coins - state.players[b].coins);
}

function rewardText(mg, m) {
  if (m && m.stakes === "half") return "Einsatz: Der Sieger erhält die Hälfte der Münzen des Verlierers (aufgerundet).";
  switch (mg.scoring) {
    case "fromLoser": return `Der Verlierer zahlt dem Sieger ${coinsText(mg.fromLoser)}`;
    case "winners": return `Jeder Sieger: ${signed(mg.winner)}`;
    case "shown": return "Sieger: so viele Münzen, wie er zeigt";
    case "worstToBest": return `Wer am weitesten danebenliegt, zahlt dem Besten ${coinsText(mg.worstToBest)}`;
    case "firstOutToWinner": return `Wer zuerst raus ist, zahlt dem Sieger ${coinsText(mg.firstOutToWinner)}`;
    case "perPoint": return `${mg.rounds} Runden · je Punkt ${signed(mg.perPoint)}`;
    case "perCorrect": return `Jeder, der richtig liegt: ${signed(mg.perCorrect)} · Keiner richtig: Einzelner ${signed(mg.solo)}`;
    case "none": return "Hier gibt es keine Münzen";
  }
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

// A payment between players; whatever the payer lacks, the bank adds.
function payWithBank(from, to, n) {
  const paid = transfer(from, to, n);
  if (paid < n) addCoins([to], n - paid);
}

/* --- Booking the result --- */

// Results that are booked with one tap: { text, apply, winners }.
function minigameOutcomes() {
  const m = state.minigame;
  const mg = MINIGAMES[m.index];
  const all = m.pool;

  if (isDuel(m)) {
    const pair = [m.challenger, m.opponent];
    return pair.map((winner, k) => {
      const loser = pair[1 - k];
      if (m.stakes === "half") {
        const amount = Math.ceil(state.players[loser].coins / 2);
        return { text: `${playerName(winner)} gewinnt und erhält ${coinsText(amount)} von ${playerName(loser)}`, apply: () => transfer(loser, winner, amount), winners: [winner] };
      }
      if (mg.scoring === "fromLoser") {
        return { text: `${playerName(winner)} gewinnt, ${playerName(loser)} zahlt ${coinsText(mg.fromLoser)}`, apply: () => payWithBank(loser, winner, mg.fromLoser), winners: [winner] };
      }
      const won = num(mg.winner, 0), lost = num(mg.loser, 0);
      return {
        text: `${playerName(winner)} gewinnt (${signed(won)}${lost ? `, ${playerName(loser)} ${signed(lost)}` : ""})`,
        apply: () => { addCoins([winner], won); if (lost) addCoins([loser], lost); },
        winners: [winner]
      };
    });
  }
  if (mg.scoring === "none") return [{ text: "Gespielt, weiter", apply: () => {}, winners: [] }];

  switch (mg.category) {
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

// Scorings that need more than one tap: the table first marks players (state.minigame.pick), then books.
//   html(m, mg)   the selection and the booking button
//   book(m, mg)   { apply, winners } once the selection is complete, otherwise null
const SCORINGS = {};

function outcomeHtml(m, mg) {
  const scoring = !isDuel(m) && SCORINGS[mg.scoring];
  if (scoring) return scoring.html(m, mg);
  return `
    <div class="action-group">
      <span class="label">${mg.scoring === "none" && !isDuel(m) ? "Fertig gespielt?" : "Wie ist es ausgegangen?"}</span>
      ${minigameOutcomes().map((e, k) => `<button class="action" onclick="scoreMinigame(${k})">${e.text}</button>`).join("")}
    </div>`;
}

function pickButtons(key, players, single, disabled = []) {
  const picked = (state.minigame.pick || {})[key];
  const on = i => single ? picked === i : (picked || []).includes(i);
  return players.map(i => `
    <button class="action toggle ${on(i) ? "chosen" : ""}" aria-pressed="${on(i)}" onclick="pickPlayer('${key}', ${i}, ${single})"
      ${disabled.includes(i) && !on(i) ? "disabled" : ""}>${on(i) ? "✓ " : ""}${playerName(i)}</button>`).join("");
}

function pickPlayer(key, i, single) {
  const m = openMinigame();
  if (!m) return;
  m.pick = m.pick || {};
  if (single) m.pick[key] = m.pick[key] === i ? undefined : i;
  else { const list = m.pick[key] || []; m.pick[key] = list.includes(i) ? list.filter(j => j !== i) : list.concat(i); }
  save();
  render();
}

function pickGroup(title, key, players, single, disabled) {
  return `<div class="action-group"><span class="label">${title}</span>${pickButtons(key, players, single, disabled)}</div>`;
}

function bookButton(text, ready) {
  return `<button class="btn" onclick="bookPicked()" ${ready ? "" : "disabled"}>${text}</button>`;
}

function bookPicked(arg) {
  const m = openMinigame();
  const mg = m && MINIGAMES[m.index];
  const scoring = mg && SCORINGS[mg.scoring];
  const result = scoring && scoring.book(m, mg, arg);
  if (result) bookMinigame(result.apply, result.winners);
}

SCORINGS.winners = {
  html: (m, mg) => {
    const chosen = m.pick.winners || [];
    return pickGroup(mg.tool === "untilTimer" ? "Wer hat gewonnen? Bei abgelaufener Uhr alle, die noch dabei sind" : "Wer hat gewonnen? Bei Gleichstand alle Gleichplatzierten",
      "winners", minigameParticipants(), false)
      + bookButton(chosen.length ? `${playerNames(chosen)} ${verb(chosen, "erhält", "erhalten je")} ${coinsText(mg.winner)}` : "Sieger antippen", chosen.length);
  },
  book: (m, mg) => {
    const winners = (m.pick.winners || []).filter(i => minigameParticipants().includes(i));
    return winners.length ? { apply: () => addCoins(winners, mg.winner), winners } : null;
  }
};

SCORINGS.shown = {
  html: (m, mg) => {
    const w = m.pick.winner;
    return pickGroup("Wer hat gewonnen?", "winner", minigameParticipants(), true) + (w === undefined ? "" : `
      <div class="action-group">
        <span class="label">Welche Zahl hat ${playerName(w)} gezeigt?</span>
        <div class="number-row number-row-wide">${Array.from({ length: mg.maxShown }, (_, k) => k + 1)
          .map(n => `<button class="action" onclick="bookPicked(${n})">${n}</button>`).join("")}</div>
      </div>`);
  },
  book: (m, mg, n) => {
    const w = m.pick.winner;
    if (w === undefined || !(n >= 1 && n <= mg.maxShown)) return null;
    return { apply: () => addCoins([w], n), winners: [w] };
  }
};

// Closest and farthest: from the app's own stopwatch when it was used, otherwise tapped by the table.
SCORINGS.worstToBest = {
  html: (m, mg) => {
    const auto = toolRanking(m);
    if (auto) {
      const [best, worst] = [auto[0], auto[auto.length - 1]];
      return bookButton(`Verbuchen: ${playerName(worst)} zahlt ${playerName(best)} ${coinsText(mg.worstToBest)}`, true);
    }
    const { best, worst } = m.pick;
    const players = minigameParticipants();
    return pickGroup("Wer liegt am nächsten dran?", "best", players, true, worst === undefined ? [] : [worst])
      + pickGroup("Wer liegt am weitesten daneben?", "worst", players, true, best === undefined ? [] : [best])
      + bookButton(best !== undefined && worst !== undefined ? `${playerName(worst)} zahlt ${playerName(best)} ${coinsText(mg.worstToBest)}` : "Beide antippen",
        best !== undefined && worst !== undefined);
  },
  book: (m, mg) => {
    const auto = toolRanking(m);
    const best = auto ? auto[0] : m.pick.best, worst = auto ? auto[auto.length - 1] : m.pick.worst;
    if (best === undefined || worst === undefined || best === worst) return null;
    return { apply: () => payWithBank(worst, best, mg.worstToBest), winners: [best] };
  }
};

SCORINGS.firstOutToWinner = {
  html: (m, mg) => {
    const { winner, first } = m.pick;
    const players = minigameParticipants();
    return pickGroup("Wer hat am längsten durchgehalten?", "winner", players, true, first === undefined ? [] : [first])
      + pickGroup("Wer war als Erster raus?", "first", players, true, winner === undefined ? [] : [winner])
      + bookButton(winner !== undefined && first !== undefined ? `${playerName(first)} zahlt ${playerName(winner)} ${coinsText(mg.firstOutToWinner)}` : "Beide antippen",
        winner !== undefined && first !== undefined);
  },
  book: (m, mg) => {
    const { winner, first } = m.pick;
    if (winner === undefined || first === undefined || winner === first) return null;
    return { apply: () => payWithBank(first, winner, mg.firstOutToWinner), winners: [winner] };
  }
};

// Points over several rounds, entered round by round; booked together at the end.
SCORINGS.perPoint = {
  html: (m, mg) => {
    const players = minigameParticipants();
    const totals = pointTotals(m, players);
    const done = m.points.length >= mg.rounds;
    const standings = m.points.length ? `
      <div class="tally">${players.slice().sort((a, b) => totals[b] - totals[a]).map(i => `
        <div class="tally-row"><span class="player-name">${playerName(i)}</span><span>${totals[i]} ${totals[i] === 1 ? "Punkt" : "Punkte"}${done && totals[i] ? ` · ${signed(totals[i] * mg.perPoint)}` : ""}</span></div>`).join("")}
      </div>
      <button class="link-button" onclick="undoRound()">Runde ${m.points.length} korrigieren</button>` : "";
    if (done) return `<span class="label">Nach ${mg.rounds} Runden</span>${standings}` + bookButton("Münzen verbuchen", true);
    const r = m.points.length + 1;
    return standings + pickGroup(`Runde ${r} von ${mg.rounds}: Wer bekommt einen Punkt?`, "round", players, false)
      + `<button class="btn" onclick="enterRound()">Runde ${r} eintragen</button>`;
  },
  book: (m, mg) => {
    if (m.points.length < mg.rounds) return null;
    const players = minigameParticipants();
    const totals = pointTotals(m, players);
    const best = Math.max(...players.map(i => totals[i]));
    return {
      apply: () => players.forEach(i => { if (totals[i]) addCoins([i], totals[i] * mg.perPoint); }),
      winners: best > 0 ? players.filter(i => totals[i] === best) : []
    };
  }
};
function pointTotals(m, players) {
  const totals = Object.fromEntries(players.map(i => [i, 0]));
  m.points.forEach(round => round.forEach(i => { if (i in totals) totals[i]++; }));
  return totals;
}
function enterRound() {
  const m = openMinigame();
  if (!m || m.points.length >= MINIGAMES[m.index].rounds) return;
  m.points.push(m.pick.round || []);
  m.pick.round = [];
  save();
  render();
}
function undoRound() {
  const m = openMinigame();
  if (!m || !m.points.length) return;
  m.pick.round = m.points.pop();
  save();
  render();
}

SCORINGS.perCorrect = {
  html: (m, mg) => {
    const right = m.pick.right || [];
    return pickGroup("Wer lag richtig?", "right", m.pool.filter(i => i !== m.soloPlayer), false)
      + bookButton(right.length ? `${playerNames(right)} ${verb(right, "erhält", "erhalten je")} ${coinsText(mg.perCorrect)}`
        : `Keiner lag richtig: ${playerName(m.soloPlayer)} erhält ${coinsText(mg.solo)}`, true);
  },
  book: (m, mg) => {
    const right = (m.pick.right || []).filter(i => i !== m.soloPlayer);
    return right.length ? { apply: () => addCoins(right, mg.perCorrect), winners: right }
      : { apply: () => addCoins([m.soloPlayer], mg.solo), winners: [m.soloPlayer] };
  }
};

function chooseOpponent(i) {
  const m = openMinigame();
  if (!m || !isDuel(m) || m.opponent !== undefined || i === m.challenger) return;
  m.opponent = i;
  if (MINIGAMES[m.index].category === "oneVsAll") m.soloPlayer = i;
  prepareMinigame(m);
  save();
  render();
}

function chooseSolo(i) {
  const m = openMinigame();
  if (!m || m.soloPlayer !== undefined) return;
  m.soloPlayer = i;
  prepareMinigame(m);
  save();
  render();
}

function scoreMinigame(k) {
  const result = minigameOutcomes()[k];
  if (result) bookMinigame(result.apply, result.winners || []);
}

function bookMinigame(apply, winners) {
  const m = openMinigame();
  if (!m) return;
  const before = state.players.map(s => s.coins);
  apply();
  minigameFinished(winners, before, minigameParticipants());
  noteLosses(before, "minigame", MINIGAMES[m.index].title);
  markMinigamePlayed();
  show("overview");
}

function minigameFinished(winners, before, participants) {
  state.lastParticipants = participants || state.players.map((_, i) => i);
  tournamentPayout(winners, state.lastParticipants);
  state.lastWinnings = {};
  state.lastWinningsCard = state.cardCount || 0;
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
  if (isDuel(m)) return [m.challenger, m.opponent].filter(i => i !== undefined);
  if (mg.category === "uneven") return [m.singlePlayer, ...m.pairPlayers];
  if (mg.category === "all" && mg.judge) return all.filter(i => i !== m.judge);
  return all;
}

/* --- The app's help while playing ---
   MINIGAME_TOOLS[tool]: prepare(m, mg) once the line-up is complete, html(m, mg) shown below the card,
   ready(m, mg) whether the result can be entered yet (default: always), mounted(m, mg) after rendering (canvas),
   focus(m) true while one player has the phone: then the screen shows nothing but the tool. */
const MINIGAME_TOOLS = {};

function randomInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
function secondsText(ms) { return (ms / 1000).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }

// After a turn the next player's handover sits below the card: bring it into view.
function scrollToTool() {
  const tool = document.querySelector(".minigame-tool");
  if (tool) tool.scrollIntoView({ block: "start" });
}

function toolBox(label, value) {
  return `<div class="tool-box"><span class="label">${label}</span><span class="tool-value">${value}</span></div>`;
}

// Plays until the event timer runs out; whoever is still in then wins (Stellt euch tot).
MINIGAME_TOOLS.untilTimer = {
  prepare: () => { if (state.running && !state.timerEnd) startRound(); },
  html: m => {
    if (m.timeUp) return `<p class="kicker">Die Uhr ist abgelaufen! Alle, die noch dabei sind, haben gewonnen.</p>`;
    if (!state.timerEnd) return "";
    const clock = settings.showTimer !== false ? ` Noch <strong id="mg-clock">${timeText(remainingMs())}</strong>.` : "";
    return `<p class="note">Das Minispiel läuft, bis die Uhr abläuft und die nächste Karte kommt.${clock} Ist vorher nur noch einer übrig, gewinnt er allein.</p>
      ${timerPaused() ? `<button class="btn-quiet" onclick="toggleTimer()">Die Uhr ist angehalten: weiterlaufen lassen</button>` : ""}`;
  }
};
// Called by tick() every second while the event timer runs.
function minigameTimerTick(remaining) {
  const m = openMinigame();
  if (state.screen !== "minigame" || !m || MINIGAMES[m.index].tool !== "untilTimer") return;
  const clock = document.getElementById("mg-clock");
  if (clock) clock.textContent = timeText(remaining);
  if (remaining > 0 || m.timeUp || !lineupComplete(m)) return;
  m.timeUp = true;
  try { if (navigator.vibrate) navigator.vibrate([300, 150, 300]); } catch (e) {}
  playChime();
  save();
  render();
}

MINIGAME_TOOLS.countdown = {
  html: (m, mg) => {
    const r = m.run || {};
    if (!r.end) return `<button class="btn" onclick="startCountdown()">Countdown starten (${mg.seconds} Sekunden)</button>`;
    if (!r.done) return `<div class="countdown" id="mg-countdown" aria-live="off">${Math.max(1, Math.ceil((r.end - Date.now()) / 1000))}</div>`;
    return `<div class="countdown countdown-done">Jetzt!</div>
      <button class="link-button" onclick="startCountdown()">Countdown noch einmal</button>`;
  }
};
function startCountdown() {
  const m = openMinigame();
  if (!m) return;
  unlockAudio();
  m.run = { end: Date.now() + MINIGAMES[m.index].seconds * 1000 };
  save();
  render();
  scrollToTool();
}

// Blind stopwatch in turns; the results stay hidden until everyone has stopped (Die Sanduhr des Henkers).
MINIGAME_TOOLS.hourglass = {
  prepare: (m, mg) => { m.run = { target: randomInt(mg.min, mg.max), order: minigameParticipants(), times: {}, turn: 0, started: null }; },
  ready: m => Boolean(m.run) && m.run.turn >= m.run.order.length,
  focus: m => Boolean(m.run) && m.run.started !== null,
  html: m => {
    const r = m.run;
    const target = toolBox("Zielzeit", `${r.target} Sekunden`);
    if (r.turn < r.order.length) {
      const p = playerName(r.order[r.turn]);
      const before = r.turn ? `<p class="muted">${playerName(r.order[r.turn - 1])} hat gestoppt. Die Zeit bleibt geheim, bis alle dran waren.</p>` : "";
      if (r.started === null) return target + before + `
        <div class="handover handover-small">
          <p class="muted">Dran ist</p>
          <p class="name-large">${p}</p>
          <p class="muted">Tippe auf Start und zähle im Kopf. Stoppe, wenn du glaubst, dass ${r.target} Sekunden um sind.</p>
          <button class="btn" onclick="hourglassStart()">Start</button>
        </div>`;
      return target + `
        <button class="stop-button" onclick="hourglassStop()"><span>Stopp</span><small>${p}, die Zeit läuft …</small></button>`;
    }
    return target + rankingHtml(m, i => `${secondsText(r.times[i])} s`, i => {
      const d = r.times[i] - r.target * 1000;
      return `${d >= 0 ? "+" : "−"}${secondsText(Math.abs(d))} s`;
    });
  }
};
function hourglassStart() {
  const m = openMinigame();
  if (!m || !m.run || m.run.started !== null) return;
  m.run.started = Date.now();
  save();
  render();
  window.scrollTo(0, 0);
}
function hourglassStop() {
  const m = openMinigame();
  const r = m && m.run;
  if (!r || r.started === null) return;
  r.times[r.order[r.turn]] = Date.now() - r.started;
  r.started = null;
  r.turn++;
  save();
  render();
  scrollToTool();
}

// Players ranked by the app's own measurement (closest first), or null when the tool measured nothing.
function toolRanking(m) {
  const r = m.run;
  if (!r || !r.times || r.turn < r.order.length) return null;
  const off = i => Math.abs(r.times[i] - r.target * 1000);
  return r.order.slice().sort((a, b) => off(a) - off(b) || Math.random() - 0.5);
}
function rankingHtml(m, value, detail) {
  const ranked = toolRanking(m);
  return `<div class="tally">${ranked.map((i, k) => `
    <div class="tally-row ${k === 0 ? "best" : k === ranked.length - 1 ? "worst" : ""}">
      <span class="player-name">${playerName(i)}</span><span>${value(i)} · ${detail(i)}${k === 0 ? " · am nächsten" : k === ranked.length - 1 ? " · am weitesten" : ""}</span>
    </div>`).join("")}</div>`;
}

MINIGAME_TOOLS.length = {
  prepare: (m, mg) => { m.run = { cm: randomInt(mg.min, mg.max) }; },
  html: m => toolBox("So lang soll der Strick werden", `${m.run.cm} cm`)
};

// Drawing in turns: each player sees only his own term, then the app shows every picture (Das Phantombild).
MINIGAME_TOOLS.sketch = {
  prepare: (m, mg) => {
    const order = minigameParticipants();
    let pool = [];
    const terms = {};
    order.forEach(i => {
      if (!pool.length) pool = shuffle(mg.prompts.length ? mg.prompts : ["Etwas Gruseliges"]);
      terms[i] = pool.pop();
    });
    m.run = { order, terms, turn: 0, started: null, current: null, images: {}, phase: "draw", view: 0 };
  },
  ready: m => Boolean(m.run) && m.run.phase === "solution",
  focus: m => Boolean(m.run) && (m.run.started !== null || m.run.phase === "gallery"),
  html: (m, mg) => {
    const r = m.run;
    if (r.phase === "draw" && r.turn < r.order.length) {
      const p = playerName(r.order[r.turn]);
      if (r.started === null) return `
        <div class="handover handover-small">
          <p class="muted">Bild ${r.turn + 1} von ${r.order.length}. Gib das Handy an</p>
          <p class="name-large">${p}</p>
          <p class="muted">Nur ${p} schaut jetzt aufs Handy: ${mg.seconds} Sekunden für deinen Begriff.</p>
          <button class="btn" onclick="sketchStart()">Ich bin ${p}, Begriff zeigen</button>
        </div>`;
      const over = sketchTimeLeft(m) <= 0;
      return `
        <div class="sketch-head">
          <span><span class="label">Dein Begriff</span><strong class="sketch-term">${r.terms[r.order[r.turn]]}</strong></span>
          <span class="sketch-clock ${over ? "over" : ""}" id="mg-countdown">${over ? "Zeit um" : Math.ceil(sketchTimeLeft(m))}</span>
        </div>
        <canvas class="sketch-canvas ${over ? "locked" : ""}" id="sketch-canvas" width="600" height="600" aria-label="Zeichenfläche"></canvas>
        <button class="btn" onclick="sketchDone()">${over ? "Fertig, Handy weitergeben" : "Schon fertig"}</button>`;
    }
    if (r.phase === "draw") return `
      <p class="note">Alle haben gemalt. Jetzt zeigt die App die Bilder nacheinander. Jeder schreibt zu jedem Bild seinen Tipp auf seinen Zettel.</p>
      <button class="btn" onclick="sketchGallery()">Bilder zeigen</button>`;
    if (r.phase === "gallery") {
      const i = r.order[r.view];
      const last = r.view === r.order.length - 1;
      return `
        <span class="label">Bild ${r.view + 1} von ${r.order.length}</span>
        ${sketchImage(r, i)}
        <div class="action-row">
          <button class="action" onclick="sketchView(-1)" ${r.view ? "" : "disabled"}>Zurück</button>
          ${last ? `<button class="action" onclick="sketchSolution()">Auflösung</button>` : `<button class="action" onclick="sketchView(1)">Nächstes Bild</button>`}
        </div>`;
    }
    return `
      <span class="label">Auflösung</span>
      <div class="sketch-grid">${r.order.map((i, k) => `
        <figure>${sketchImage(r, i)}<figcaption><strong>${k + 1}. ${r.terms[i]}</strong> von ${playerName(i)}</figcaption></figure>`).join("")}
      </div>
      <p class="note">Je richtiger Tipp 1 Punkt, und jeder Maler bekommt 1 Punkt für jeden, der sein Bild erraten hat.</p>
      <button class="link-button" onclick="sketchView(0)">Bilder noch einmal zeigen</button>`;
  },
  mounted: m => mountCanvas(m)
};
function sketchImage(r, i) {
  return r.images[i] ? `<img class="sketch-image" src="${r.images[i]}" alt="Bild von ${playerName(i)}">` : `<div class="sketch-image sketch-empty">Leer gelassen</div>`;
}
function sketchTimeLeft(m) {
  const r = m.run;
  return r.started === null ? MINIGAMES[m.index].seconds : MINIGAMES[m.index].seconds - (Date.now() - r.started) / 1000;
}
function sketchStart() {
  const m = openMinigame();
  if (!m || !m.run || m.run.started !== null) return;
  m.run.started = Date.now();
  m.run.current = null;
  save();
  render();
  window.scrollTo(0, 0);
}
function sketchDone() {
  const m = openMinigame();
  const r = m && m.run;
  if (!r || r.started === null) return;
  r.images[r.order[r.turn]] = r.current;
  r.current = null;
  r.started = null;
  r.turn++;
  save();
  render();
  scrollToTool();
}
function sketchGallery() { const r = openMinigame().run; r.phase = "gallery"; r.view = 0; save(); render(); window.scrollTo(0, 0); }
function sketchView(step) {
  const r = openMinigame().run;
  if (step === 0) { r.phase = "gallery"; r.view = 0; }
  else r.view = Math.max(0, Math.min(r.order.length - 1, r.view + step));
  save();
  render();
}
function sketchSolution() { openMinigame().run.phase = "solution"; save(); render(); }

// The drawing survives a re-render (live content updates): every stroke is kept in run.current.
function mountCanvas(m) {
  const canvas = document.getElementById("sketch-canvas");
  if (!canvas) return;
  const r = m.run;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f7f0e1";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (r.current) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = r.current; }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#2b1d12";
  let last = null;
  const at = e => {
    const box = canvas.getBoundingClientRect();
    return [(e.clientX - box.left) * canvas.width / box.width, (e.clientY - box.top) * canvas.height / box.height];
  };
  const open = () => r.started !== null && sketchTimeLeft(m) > 0;
  canvas.addEventListener("pointerdown", e => {
    if (!open()) return;
    canvas.setPointerCapture(e.pointerId);
    last = at(e);
    ctx.beginPath(); ctx.arc(last[0], last[1], ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
  });
  canvas.addEventListener("pointermove", e => {
    if (!last || !open()) return;
    const p = at(e);
    ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
    last = p;
  });
  const end = () => {
    if (!last) return;
    last = null;
    r.current = canvas.toDataURL("image/png");
    save();
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
}

// Secret vote in turns; the app shows only how often each player was chosen (Wer würde eher …?).
MINIGAME_TOOLS.vote = {
  prepare: (m, mg) => {
    const prompts = shuffle(mg.prompts).slice(0, mg.rounds);
    m.run = { prompts: prompts.length ? prompts : ["Wer würde eher …? Denkt euch selbst eine Frage aus."], order: minigameParticipants(), round: 0, turn: 0, open: false, votes: [{}] };
  },
  ready: m => Boolean(m.run) && m.run.round === m.run.prompts.length - 1 && m.run.turn >= m.run.order.length,
  focus: m => Boolean(m.run) && m.run.open,
  html: m => {
    const r = m.run;
    const question = `<span class="label">Frage ${r.round + 1} von ${r.prompts.length}</span><p class="vote-question">${r.prompts[r.round]}</p>`;
    if (r.turn < r.order.length) {
      const v = playerName(r.order[r.turn]);
      if (!r.open) return question + `
        <div class="handover handover-small">
          <p class="muted">${r.turn ? "Stimme abgegeben. " : ""}Gib das Handy an</p>
          <p class="name-large">${v}</p>
          <button class="btn" onclick="voteOpen()">Ich bin ${v}, abstimmen</button>
        </div>`;
      return question + `
        <div class="action-group">
          <span class="label">${v}, wen wählst du? Niemand sieht deine Stimme</span>
          ${r.order.map(j => `<button class="action" onclick="castVote(${j})">${playerName(j)}</button>`).join("")}
        </div>`;
    }
    const counts = {};
    Object.values(r.votes[r.round]).forEach(j => { counts[j] = (counts[j] || 0) + 1; });
    const max = Math.max(...Object.values(counts));
    const top = r.order.filter(j => counts[j] === max);
    return question + `
      <div class="tally">${r.order.filter(j => counts[j]).sort((a, b) => counts[b] - counts[a]).map(j => `
        <div class="tally-row ${counts[j] === max ? "worst" : ""}"><span class="player-name">${playerName(j)}</span><span>${counts[j]} ${counts[j] === 1 ? "Stimme" : "Stimmen"}</span></div>`).join("")}
      </div>
      <p class="kicker">${playerNames(top)} ${verb(top, "trinkt", "trinken")} einen Shot.</p>
      ${r.round < r.prompts.length - 1 ? `<button class="btn" onclick="nextVoteRound()">Nächste Frage</button>` : ""}`;
  }
};
function voteOpen() { const r = openMinigame().run; r.open = true; save(); render(); window.scrollTo(0, 0); }
function castVote(j) {
  const m = openMinigame();
  const r = m && m.run;
  if (!r || !r.open || r.turn >= r.order.length) return;
  r.votes[r.round][r.order[r.turn]] = j;
  r.turn++;
  r.open = false;
  save();
  render();
  scrollToTool();
}
function nextVoteRound() {
  const r = openMinigame().run;
  if (r.round >= r.prompts.length - 1 || r.turn < r.order.length) return;
  r.round++;
  r.turn = 0;
  r.votes.push({});
  save();
  render();
  scrollToTool();
}

// Live displays (countdown, drawing time): a short interval while such a screen is open.
let minigameClock = null;
function minigameMounted() {
  clearInterval(minigameClock);
  minigameClock = null;
  const m = openMinigame();
  if (state.screen !== "minigame" || !m) return;
  const tool = MINIGAME_TOOLS[MINIGAMES[m.index].tool];
  if (tool && tool.mounted) tool.mounted(m, MINIGAMES[m.index]);
  if (document.getElementById("mg-countdown")) minigameClock = setInterval(minigameClockTick, 200);
}
function minigameClockTick() {
  const m = openMinigame();
  const field = document.getElementById("mg-countdown");
  if (!m || !field || state.screen !== "minigame") { clearInterval(minigameClock); minigameClock = null; return; }
  const r = m.run || {};
  const tool = MINIGAMES[m.index].tool;
  if (tool === "countdown" && r.end && !r.done) {
    const left = Math.ceil((r.end - Date.now()) / 1000);
    if (left > 0) { field.textContent = left; return; }
    r.done = true;
    playSignal();
    try { if (navigator.vibrate) navigator.vibrate(500); } catch (e) {}
    save();
    render();
  }
  if (tool === "sketch" && r.started !== null) {
    const left = sketchTimeLeft(m);
    if (left > 0) { field.textContent = Math.ceil(left); return; }
    clearInterval(minigameClock);
    minigameClock = null;
    try { if (navigator.vibrate) navigator.vibrate(300); } catch (e) {}
    playSignal();
    render();
  }
}

Object.assign(SCREENS, {
  minigame: screenMinigame
});
