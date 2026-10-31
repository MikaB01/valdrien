// Ability mechanics, keyed like CATALOG.abilities. A handler may define:
//   show(i, f, header)  HTML below the ability card (required); i = player, f = state.ability
//   apply(i)            books coins when "applyAbility()" is pressed
//   prepare(i, f)       runs when the player is chosen
//   peek: n             number of event cards revealed by "abilityPeek()"
// Handler-specific button actions are global functions defined right after each handler.
const ABILITIES = {};

function abilityButton(text, action) { return `<button class="action" onclick="${action}">${text}</button>`; }
function abilityNote(text) { return `<p class="note">${text}</p>`; }
function onlyYouLook(i) { return abilityNote(`Nur ${playerName(i)} schaut jetzt aufs Handy.`); }

function abilityHandler(i) {
  return ABILITIES[ROLES[state.players[i].role].ability.mechanic] || NO_MECHANIC;
}

const NO_MECHANIC = {
  show: (i, f, header) => header + abilityNote("Für diese Fähigkeit rechnet die App nichts aus. Münzen bucht ihr bei Bedarf von Hand über den Geldbeutel.")
    + abilityButton("Fähigkeit wurde eingesetzt", "applyAbility()")
};

function screenAbility() {
  const f = state.ability;
  if (!f) return screenOverview();

  if (f.step === "who") {
    const ready = state.players.map((_, i) => i).filter(i => state.players[i].revealed && !state.players[i].abilityUsed);
    return `
      <h2>Besondere Fähigkeit einsetzen</h2>
      <p class="muted">Wessen Rolle erraten wurde, darf seine Fähigkeit einmal pro Partie einsetzen.</p>
      ${ready.length
        ? `<div class="choices">${ready.map(i => `
            <button class="choice" onclick="chooseAbilityPlayer(${i})">
              <span>${playerName(i)}</span>
              <span class="muted">${ROLES[state.players[i].role].ability.name}</span>
            </button>`).join("")}</div>`
        : `<p class="note">Im Moment kann niemand eine Fähigkeit einsetzen. Zuerst muss eine Rolle erraten werden.</p>`}`;
  }

  const i = f.player;
  const role = ROLES[state.players[i].role];
  const ab = role.ability;
  const header = `
    <p class="muted" style="text-align:center">${playerName(i)} als ${role.name}, ${role.title}</p>
    <article class="card drawn-card">
      <div class="title">
        <span class="label">Besondere Fähigkeit</span>
        <div class="card-name">${ab.name}</div>
      </div>
      <p class="narrative">${ab.text}</p>
    </article>`;
  return abilityHandler(i).show(i, f, header);
}

function startAbility() {
  state.ability = { step: "who" };
  show("ability");
}

function chooseAbilityPlayer(i) {
  const s = state.players[i];
  if (!s.revealed || s.abilityUsed) return;
  state.ability = { step: "show", player: i };
  const handler = abilityHandler(i);
  if (handler.prepare) handler.prepare(i, state.ability);
  show("ability");
}

function applyAbility() {
  const i = state.ability.player;
  const handler = abilityHandler(i);
  if (handler.apply) handler.apply(i);
  state.players[i].abilityUsed = true;
  show("overview");
}

// Peeking needs enough event cards left; otherwise the ability waits until they are reshuffled.
function peekBlocked(i, header) {
  const n = abilityHandler(i).peek || 1;
  if (upcomingEvents(n).length >= n) return "";
  return header + abilityNote(`Im Stapel ${n === 1 ? "ist keine Ereigniskarte mehr" : `sind nicht mehr ${n} Ereigniskarten`}. Sobald die Ereignisse neu eingemischt sind, kann ${playerName(i)} die Fähigkeit einsetzen.`);
}

function abilityPeek() {
  const i = state.ability.player;
  if (peekBlocked(i, "")) return;
  upcomingEvents(abilityHandler(i).peek || 1);
  state.players[i].abilityUsed = true;
  state.ability.step = "peek";
  show("ability");
}

function eventPreview(index) {
  const card = EVENTS[index];
  return `
    <article class="card drawn-card">
      <div class="title">
        <span class="label">${card.category}</span>
        <div class="card-name">${card.title}</div>
      </div>
      <p class="narrative">${card.text}</p>
    </article>`;
}

function eventLoss(i) {
  const e = state.event;
  if (!e || !e.losses || (e.compensated && e.compensated[i])) return 0;
  return e.losses[i] || 0;
}

function markCompensated(i) {
  state.event.compensated = state.event.compensated || {};
  state.event.compensated[i] = true;
}

/* --- Forest guild --- */

ABILITIES.treasureHunter = {
  show: (i, f, header) => header + abilityButton(`${playerName(i)} erhält 3 Münzen`, "applyAbility()"),
  apply: i => addCoins([i], 3)
};

ABILITIES.luckBringer = {
  show: (i, f, header) => {
    const v = eventLoss(i);
    if (v > 0) return header + abilityButton(`Verlust aufheben: ${playerName(i)} erhält ${v} ${coinWord(v)} zurück`, "applyAbility()");
    return header + abilityNote(`Gerade droht ${playerName(i)} kein Verlust. Die Fähigkeit wirkt direkt, nachdem ${playerName(i)} durch ein Ereignis Münzen verloren hat.`);
  },
  apply: i => {
    addCoins([i], eventLoss(i));
    markCompensated(i);
  }
};

// Doubles the whole gain of the minigame just won.
ABILITIES.goldFinger = {
  show: (i, f, header) => {
    const extra = (state.lastWinnings || {})[i] || 0;
    if (extra > 0) return header + abilityButton(`Gewinn verdoppeln: ${playerName(i)} erhält ${extra} zusätzliche ${coinWord(extra)}`, "applyAbility()");
    return header + abilityNote(`${playerName(i)} hat das letzte Minispiel nicht gewonnen. Die Fähigkeit wirkt direkt nach einem gewonnenen Minispiel.`);
  },
  apply: i => {
    addCoins([i], (state.lastWinnings || {})[i] || 0);
    delete state.lastWinnings[i];
  }
};

// "Das Turnier": the button appears on every minigame this player takes part in (minigameAbilities).
ABILITIES.marksman = {
  show: (i, f, header) => header + abilityNote(`Diese Fähigkeit setzt ${playerName(i)} bei einem Minispiel ein, bei dem ${playerName(i)} mitspielt. Dort erscheint vor dem Start ein Knopf dafür.`)
};
function announceTournament(i) {
  const m = state.minigame;
  if (!m || m.done || state.players[i].abilityUsed) return;
  state.players[i].abilityUsed = true;
  m.tournament = i;
  save();
  render();
}
// Called with every minigame result: the announced winner gets 1 coin from each other participant.
function tournamentPayout(winners, participants) {
  const m = state.minigame;
  const i = m && m.tournament;
  if (i === undefined || i === null || m.tournamentPaid) return;
  m.tournamentPaid = true;
  if (!winners.includes(i)) return;
  participants.filter(j => j !== i).forEach(j => transfer(j, i, 1));
}

ABILITIES.pathfinder = {
  peek: 1,
  show: (i, f, header) => {
    if (f.step !== "peek") {
      return peekBlocked(i, header) || header + onlyYouLook(i) + abilityButton("Nächste Ereigniskarte ansehen", "abilityPeek()");
    }
    return eventPreview(upcomingEvents(1)[0]) + `
        <div class="action-group">
          ${abilityButton("Diese Karte jetzt spielen", "pathfinder(true)")}
          ${abilityButton("Unter den Stapel legen", "pathfinder(false)")}
        </div>`;
  }
};
function pathfinder(play) {
  if (play) { drawEvent(false); return; } // draws exactly the card just seen
  moveTopCardToBottom();
  show("overview");
}

ABILITIES.fateTurner = {
  peek: 2,
  show: (i, f, header) => {
    if (f.step !== "peek") {
      return peekBlocked(i, header) || header + onlyYouLook(i) + abilityButton("Zwei Ereigniskarten ziehen", "abilityPeek()");
    }
    const [a, b] = upcomingEvents(2);
    return `<p class="muted" style="text-align:center">Welche Karte soll gespielt werden? Die andere kommt unter den Stapel.</p>`
      + eventPreview(a) + abilityButton("Diese Karte spielen", `fate(${a}, ${b})`)
      + eventPreview(b) + abilityButton("Diese Karte spielen", `fate(${b}, ${a})`);
  }
};
function fate(chosen, other) {
  state.eventDeck = state.eventDeck.filter(index => index !== chosen && index !== other);
  state.eventDeck.unshift(other);
  drawEvent(false, chosen);
}

// Right: half of the richest other player's coins (rounded up). Wrong: all own coins go to the bank.
ABILITIES.luckyFairy = {
  show: (i, f, header) => {
    if (f.flip) {
      const intro = `
          <div class="coin-flip">${f.flip}</div>
          <p class="narrative" style="text-align:center">${playerName(i)} hat auf ${f.side} gesetzt, die Münze zeigt ${f.flip}.</p>`;
      if (!f.won) return header + intro + `<p class="result-number">Alles verloren</p>
          <p class="muted" style="text-align:center">${coinsText(f.lost)} gehen an die Spielbank.</p>
          <button class="btn" onclick="show('overview')">Weiter</button>`;
      if (f.victim === undefined) return header + intro + `
          <div class="action-group">
            <span class="label">Gleichstand: Wen erleichtert ${playerName(i)}?</span>
            ${f.candidates.map(j => abilityButton(`${playerName(j)} (${coinsText(state.players[j].coins)})`, `luckyFairyVictim(${j})`)).join("")}
          </div>`;
      return header + intro + `<p class="result-number">+${f.gain} ${coinWord(f.gain)}</p>
          <p class="muted" style="text-align:center">${playerName(i)} nimmt ${playerName(f.victim)} die Hälfte der Münzen weg.</p>
          <button class="btn" onclick="show('overview')">Weiter</button>`;
    }
    return header + `
        <div class="action-group">
          <span class="label">${playerName(i)} wählt</span>
          ${abilityButton("Kopf", "luckyFairy('Kopf')")}
          ${abilityButton("Zahl", "luckyFairy('Zahl')")}
        </div>`;
  }
};
function luckyFairy(side) {
  const f = state.ability;
  const i = f.player;
  if (f.flip || state.players[i].abilityUsed) return;
  f.side = side;
  f.flip = Math.random() < 0.5 ? "Kopf" : "Zahl";
  f.won = f.flip === side;
  state.players[i].abilityUsed = true;
  if (!f.won) {
    f.lost = state.players[i].coins;
    state.players[i].coins = 0;
  } else {
    const others = state.players.map((_, j) => j).filter(j => j !== i);
    const max = Math.max(...others.map(j => state.players[j].coins));
    f.candidates = others.filter(j => state.players[j].coins === max);
    if (f.candidates.length === 1) luckyFairyVictim(f.candidates[0], true);
  }
  save();
  render();
}
function luckyFairyVictim(j, quiet) {
  const f = state.ability;
  if (!f.won || f.victim !== undefined || !f.candidates.includes(j)) return;
  const before = state.players.map(s => s.coins);
  f.victim = j;
  f.gain = Math.ceil(state.players[j].coins / 2);
  transfer(j, f.player, f.gain);
  noteLosses(before, "ability", roleOf(f.player).ability.name, f.player);
  if (!quiet) { save(); render(); }
}

/* --- Golden tankard --- */

ABILITIES.houseRules = {
  peek: 1,
  show: (i, f, header) => {
    if (f.step !== "peek") {
      return peekBlocked(i, header) || header + onlyYouLook(i) + abilityButton("Nächste Ereigniskarte ansehen", "abilityPeek()");
    }
    return eventPreview(upcomingEvents(1)[0]) + `
        <div class="action-group">
          ${abilityButton(`Jetzt spielen, ${playerName(i)} erhält 1 Münze`, "houseRules(true)")}
          ${abilityButton("Ablegen, unter den Stapel", "houseRules(false)")}
        </div>`;
  }
};
function houseRules(play) {
  const i = state.ability.player;
  if (play) { addCoins([i], 1); drawEvent(false); return; }
  moveTopCardToBottom();
  show("overview");
}

// From now on 1 coin per event card that is not a minigame and per bought secret card, until a minigame is drawn.
ABILITIES.tip = {
  show: (i, f, header) => header + abilityButton(`Ab jetzt kassiert ${playerName(i)} Trinkgeld`, "applyAbility()"),
  apply: i => { state.tip = { player: i, earned: 0 }; }
};
function tipNote() {
  const t = state.tip;
  if (!t || !state.players[t.player]) return "";
  return `<p class="note">Trinkgeld: ${playerName(t.player)} erhält für jede Ereigniskarte und jede gekaufte Geheimkarte 1 Münze, bis ein Minispiel gezogen wird${t.earned ? ` (bisher +${t.earned})` : ""}.</p>`;
}

ABILITIES.foolsLuck = {
  show: (i, f, header) => {
    if (f.reward) {
      return header + `
          <p class="result-number">+${f.reward} ${coinWord(f.reward)}</p>
          <button class="btn" onclick="show('overview')">Weiter</button>`;
    }
    return header + abilityButton("Belohnung ziehen", "foolsLuck()");
  }
};
function foolsLuck() {
  const f = state.ability;
  if (f.reward) return;
  f.reward = 1 + Math.floor(Math.random() * 4);
  addCoins([f.player], f.reward);
  state.players[f.player].abilityUsed = true;
  save();
  render();
}

ABILITIES.heartySoup = {
  show: (i, f, header) => {
    if (eventLoss(i) > 0) return header + abilityButton(`${playerName(i)} erhält 3 Münzen`, "applyAbility()");
    return header + abilityNote(`Gerade hat ${playerName(i)} durch kein Ereignis Münzen verloren. Die Fähigkeit wirkt direkt nach so einem Verlust.`);
  },
  apply: i => {
    addCoins([i], 3);
    markCompensated(i);
  }
};

ABILITIES.encore = {
  prepare: (i, f) => {
    const fresh = shuffle(remainingMinigames());
    f.options = fresh.concat(shuffle(playableMinigames().filter(k => !fresh.includes(k)))).slice(0, 3);
  },
  show: (i, f, header) => header + `
        <div class="action-group">
          <span class="label">Welches Minispiel spielt ${playerName(i)}?</span>
          ${(f.options || []).map(index => abilityButton(`${MINIGAMES[index].title} · ${CATEGORY_NAMES[MINIGAMES[index].category]}`, `encore(${index})`)).join("")}
        </div>`
};
function encore(index) {
  const i = state.ability.player;
  state.winBonus = { player: i, amount: 2 };
  state.players[i].abilityUsed = true;
  startMinigame(index, i);
}

// The button for this ability appears on the minigame screen (minigameAbilities).
ABILITIES.loadedDice = {
  show: (i, f, header) => header + abilityNote(`Diese Fähigkeit setzt ${playerName(i)} bei einem Minispiel ein, auch ohne mitzuspielen. Dort erscheint ein Knopf dafür.`)
};
function useLoadedDice(i) {
  if (state.players[i].abilityUsed) return;
  state.players[i].abilityUsed = true;
  const m = state.minigame;
  m.loadedDice = i;
  if (lineupComplete(m)) prepareMinigame(m); // the first try does not count: the app's help starts over
  save();
  render();
}

ABILITIES.foresight = {
  peek: 2,
  show: (i, f, header) => {
    if (f.step !== "peek") {
      return peekBlocked(i, header) || header + onlyYouLook(i) + abilityButton("Zwei Ereigniskarten ansehen", "abilityPeek()");
    }
    const [a, b] = upcomingEvents(2);
    return `<p class="muted" style="text-align:center">Welche Karte soll als Nächstes kommen? Die andere folgt danach.</p>`
      + eventPreview(a) + abilityButton("Diese Karte kommt als Nächstes", `foresight(${a}, ${b})`)
      + eventPreview(b) + abilityButton("Diese Karte kommt als Nächstes", `foresight(${b}, ${a})`);
  }
};
function foresight(first, next) {
  state.eventDeck = state.eventDeck.filter(index => index !== first && index !== next);
  state.eventDeck.push(next, first); // top of the deck is the end of the array
  show("overview");
}

// Duel against an opponent of choice; the winner gets half of the loser's coins (rounded up), nothing else.
// Any minigame that works for two can be the duel (duelReady), drinking games never.
ABILITIES.challenge = {
  show: (i, f, header) => header + (remainingMinigames("duel").length || playableMinigames().some(duelReady)
    ? abilityNote("Die App zieht ein Duell oder ein Minispiel, das sich zu zweit spielen lässt.") + abilityButton(`${playerName(i)} fordert zum Duell`, "challenge()")
    : abilityNote("In diesem Abenteuer gibt es kein Minispiel, das sich zu zweit spielen lässt."))
};
function challenge() {
  const i = state.ability.player;
  if (state.players[i].abilityUsed || !drawMinigame("duel", i)) return;
  state.players[i].abilityUsed = true;
  state.minigame.stakes = "half";
  save();
  render();
}

/* --- Henkersmahl im Verlies --- */

function abilityHolders(mechanic) {
  return state.players.map((_, i) => i).filter(i => roleOf(i) && roleOf(i).ability.mechanic === mechanic
    && state.players[i].revealed && !state.players[i].abilityUsed);
}

// Buttons and notes on the minigame screen for "Gezinkt" (loadedDice) and "Das Turnier" (marksman).
function minigameAbilities() {
  const m = state.minigame;
  if (!m || m.done) return "";
  let html = "";
  if (m.loadedDice !== undefined) {
    html += abilityNote(`${playerName(m.loadedDice)} setzt »Gezinkt« ein: Das Minispiel wird mit denselben Teilnehmern wiederholt. Der erste Versuch zählt nicht. Tragt erst das Ergebnis des zweiten Versuchs ein.`);
  } else {
    html += abilityHolders("loadedDice").map(i =>
      `<button class="btn-quiet" onclick="useLoadedDice(${i})">${playerName(i)}: »Gezinkt« – Minispiel wiederholen lassen</button>`).join("");
  }
  if (m.tournament !== undefined) {
    const t = playerName(m.tournament);
    html += abilityNote(`${t} hat beim »Turnier« den Sieg angekündigt. Gewinnt ${t}, zahlt jeder Mitspieler des Minispiels 1 Münze an ${t}.`);
  } else {
    html += abilityHolders("marksman").filter(tournamentReady).map(i =>
      `<button class="btn-quiet" onclick="announceTournament(${i})">${playerName(i)}: »Das Turnier« – Sieg ankündigen</button>`).join("");
  }
  return html;
}

// Rules and opponents must be fixed and the player must take part.
function tournamentReady(i) {
  const m = state.minigame;
  if (!lineupComplete(m) || (MINIGAMES[m.index].scoring === "none" && !isDuel(m))) return false;
  return minigameParticipants().includes(i);
}

// Every drawn card (event card, secret card or minigame from the deck) passes here.
function cardDrawn(kind) {
  state.cardCount = (state.cardCount || 0) + 1;
  const p = state.pause;
  if (p && state.players[p.player] && p.coins < RULES.bathroomBreakMax) {
    addCoins([p.player], 1);
    p.coins++;
    p.paidCard = state.cardCount;
  }
  const t = state.tip;
  if (t && kind === "event" && state.players[t.player]) {
    addCoins([t.player], 1);
    t.earned++;
    t.paidCard = state.cardCount;
  }
}

function cardNotes(card) {
  const notes = [];
  const p = state.pause;
  if (p && state.players[p.player]) {
    notes.push(`Pinkelpause: Diese Karte gilt nicht für ${playerName(p.player)}.${p.paidCard === card ? ` ${playerName(p.player)} erhält 1 Münze (bisher +${p.coins}).` : ""}`);
  }
  const t = state.tip;
  if (t && card && t.paidCard === card && state.players[t.player]) notes.push(`Trinkgeld: ${playerName(t.player)} erhält 1 Münze.`);
  return notes.map(abilityNote).join("");
}

/* Pinkelpause (bathroomBreak): right after a card is drawn, the player sits out this and all following cards,
   1 coin per card (at most RULES.bathroomBreakMax), until rejoining. Cards apply only to inPlay(). */
ABILITIES.bathroomBreak = {
  show: (i, f, header) => header + abilityNote(`Die Pinkelpause beginnt direkt nachdem eine Ereigniskarte gezogen wurde. Dort erscheint der Knopf zum Aussetzen.`)
};

function currentCard() {
  const e = state.event;
  if (state.screen === "event" && e) {
    if (e.isPrivate) return { kind: "private", fresh: true };
    return { kind: "event", fresh: !Object.keys(e.done || {}).length };
  }
  const m = state.minigame;
  if (state.screen === "minigame" && m) return { kind: "minigame", fresh: !m.done && !m.byAbility };
  return null;
}

function pauseControls() {
  const card = currentCard();
  if (!card) return "";
  const p = state.pause;
  if (p && state.players[p.player]) {
    return `<button class="btn-quiet" onclick="endPause()">${playerName(p.player)} kommt von der Pinkelpause zurück</button>`;
  }
  if (!card.fresh) return "";
  return abilityHolders("bathroomBreak").map(i =>
    `<button class="btn-quiet" onclick="startPause(${i})">${playerName(i)}: »Pinkelpause« – ab jetzt aussetzen</button>`).join("");
}

function pauseNote() {
  const p = state.pause;
  if (!p || !state.players[p.player]) return "";
  return `<div class="note note-action"><p>Pinkelpause: Ereigniskarten gelten nicht für ${playerName(p.player)} (bisher +${p.coins}).</p>
    <button class="link-button" onclick="endPause()">${playerName(p.player)} steigt wieder ein</button></div>`;
}

function startPause(i) {
  const card = currentCard();
  if (!card || !card.fresh || state.pause || state.players[i].abilityUsed) return;
  state.players[i].abilityUsed = true;
  state.pause = { player: i, coins: 1, paidCard: state.cardCount };
  addCoins([i], 1);
  refreshCard(card);
  save();
  render();
}

// Rejoining on a card nothing was booked for yet: the card applies again and its coin goes back.
function endPause() {
  const p = state.pause;
  if (!p) return;
  const card = currentCard();
  const back = card && card.fresh && card.kind !== "private";
  if (back && p.paidCard === state.cardCount) addCoins([p.player], -1);
  state.pause = null;
  if (back) refreshCard(card);
  save();
  render();
}

function refreshCard(card) {
  if (card.kind === "event") state.event.snapshot = takeSnapshot();
  if (card.kind === "private" && state.pause && state.event.player === state.pause.player) passPrivateCard();
  if (card.kind === "minigame") {
    const m = state.minigame;
    const keep = {};
    ["request", "card", "automatic", "stakes", "tournament", "loadedDice", "duel"].forEach(k => { if (m[k] !== undefined) keep[k] = m[k]; });
    startMinigame(m.index);
    Object.assign(state.minigame, keep);
  }
}

/* Langfinger (longFingers): up to three players, one spin each: −1, +1, +2, +3. */
const WHEEL = [-1, 1, 2, 3];

ABILITIES.longFingers = {
  show: (i, f, header) => {
    if (!f.targets) {
      const chosen = f.chosen || [];
      return header + `
        <div class="action-group">
          <span class="label">Bei wem greift ${playerName(i)} zu? Bis zu drei</span>
          ${state.players.map((s, j) => j === i ? "" : `
            <button class="action toggle ${chosen.includes(j) ? "chosen" : ""}" aria-pressed="${chosen.includes(j)}" onclick="toggleTheft(${j})"
              ${!chosen.includes(j) && chosen.length >= 3 ? "disabled" : ""}>${chosen.includes(j) ? "✓ " : ""}${playerName(j)} · ${coinsText(s.coins)}</button>`).join("")}
        </div>
        <button class="btn" onclick="startTheft()" ${chosen.length ? "" : "disabled"}>Glücksrad drehen</button>`;
    }
    const done = f.spins.length;
    const last = f.spins[done - 1];
    const next = f.targets[done];
    return `
      <p class="muted" style="text-align:center">${playerName(i)} als ${roleOf(i).name}, ${roleOf(i).title}</p>
      ${wheelHtml(f, Boolean(last))}
      ${last ? `<p class="wheel-result">${theftText(i, last)}</p>` : `<p class="muted" style="text-align:center">Felder: −1, +1, +2 und +3. Bei −1 ist ${playerName(i)} erwischt worden.</p>`}
      <div class="wheel-next">
        ${next !== undefined
          ? `<button class="btn" onclick="spinTheft()">Rad drehen für ${playerName(next)}</button>`
          : `<button class="btn" onclick="show('overview')">Weiter</button>`}
      </div>`;
  }
};

function wheelHtml(f, spinning) {
  const colors = ["wheel-bad", "wheel-a", "wheel-b", "wheel-c"];
  const slice = (k) => {
    const a0 = (k * 90 - 90) * Math.PI / 180, a1 = (k * 90) * Math.PI / 180;
    const p = a => `${(50 + 48 * Math.cos(a)).toFixed(2)} ${(50 + 48 * Math.sin(a)).toFixed(2)}`;
    const mid = (k * 90 - 45) * Math.PI / 180;
    return `<path class="${colors[k]}" d="M50 50 L${p(a0)} A48 48 0 0 1 ${p(a1)} Z"/>
      <text x="${(50 + 30 * Math.cos(mid)).toFixed(2)}" y="${(50 + 30 * Math.sin(mid)).toFixed(2)}" text-anchor="middle" dominant-baseline="central"
        transform="rotate(${k * 90 + 45} ${(50 + 30 * Math.cos(mid)).toFixed(2)} ${(50 + 30 * Math.sin(mid)).toFixed(2)})">${WHEEL[k] > 0 ? "+" + WHEEL[k] : "−1"}</text>`;
  };
  return `
    <div class="wheel">
      <svg class="wheel-disc ${spinning ? "spin" : ""}" viewBox="0 0 100 100" style="--from:${f.from || 0}deg; --to:${f.angle || 0}deg; transform: rotate(${f.angle || 0}deg)" aria-hidden="true">
        ${[0, 1, 2, 3].map(slice).join("")}
        <circle cx="50" cy="50" r="7" class="wheel-hub"/>
      </svg>
      <svg class="wheel-pointer" viewBox="0 0 20 16" aria-hidden="true"><path d="M2 0 H18 L10 15 Z"/></svg>
    </div>`;
}

function theftText(i, spin) {
  const t = playerName(spin.target);
  if (spin.value < 0) return spin.amount ? `Erwischt! ${playerName(i)} gibt ${t} 1 Münze.` : `Erwischt! Aber ${playerName(i)} hat nichts, was er ${t} geben könnte.`;
  if (!spin.amount) return `+${spin.value}, aber bei ${t} ist nichts mehr zu holen.`;
  return `${playerName(i)} nimmt ${t} ${coinsText(spin.amount)} weg.${spin.amount < spin.value ? " Mehr war nicht da." : ""}`;
}

function toggleTheft(j) {
  const f = state.ability;
  if (f.targets) return;
  const chosen = f.chosen || [];
  f.chosen = chosen.includes(j) ? chosen.filter(x => x !== j) : chosen.length < 3 ? chosen.concat(j) : chosen;
  save();
  render();
}

function startTheft() {
  const f = state.ability;
  if (f.targets || !(f.chosen || []).length) return;
  f.targets = f.chosen.slice();
  f.spins = [];
  state.players[f.player].abilityUsed = true;
  save();
  render();
}

function spinTheft() {
  const f = state.ability;
  const i = f.player;
  const target = f.targets[f.spins.length];
  if (target === undefined) return;
  const k = Math.floor(Math.random() * WHEEL.length);
  const value = WHEEL[k];
  const before = state.players.map(s => s.coins);
  let amount;
  if (value > 0) { amount = Math.min(value, state.players[target].coins); transfer(target, i, value); }
  else { amount = Math.min(1, state.players[i].coins); transfer(i, target, 1); }
  noteLosses(before, "ability", roleOf(i).ability.name, i);
  f.spins.push({ target, value, amount });
  f.from = f.angle || 0;
  const turns = f.from - (f.from % 360) + 360 * 5;
  f.angle = turns + ((-45 - k * 90) % 360 + 360) % 360; // segment k under the pointer at the top
  save();
  render();
}

/* Neugiernase (curiosity): a secret yes/no question; a later hit on that player pays RULES.curiosityHitReward. */
ABILITIES.curiosity = {
  show: (i, f, header) => {
    if (f.target === undefined) {
      const targets = state.players.map((_, j) => j).filter(j => j !== i && !state.players[j].revealed);
      if (!targets.length) return header + abilityNote("Alle anderen Rollen sind schon erraten. Hier gibt es nichts mehr zu fragen.");
      return header + `
        <div class="action-group">
          <span class="label">Wen fragt ${playerName(i)}?</span>
          ${targets.map(j => abilityButton(playerName(j), `state.ability.target = ${j}; save(); render()`)).join("")}
        </div>`;
    }
    const t = playerName(f.target);
    return header + abilityNote(`${playerName(i)} stellt ${t} jetzt heimlich eine Ja-Nein-Frage zu ${t}s Rolle, geflüstert oder kurz zur Seite. ${t} antwortet ehrlich. Nach dem Rollennamen selbst darf nicht gefragt werden. Errät ${playerName(i)} die Rolle von ${t} später, gibt es ${RULES.curiosityHitReward} statt ${RULES.hitReward} Münzen.`)
      + abilityButton("Die Frage ist gestellt", "applyAbility()");
  },
  apply: i => { state.curiosity = { player: i, target: state.ability.target }; }
};

/* Narrenrätsel (foolsRiddle): secretly 2, 4 or 6; a wrong guess pays the owner that many, a right one half to the guesser. */
ABILITIES.foolsRiddle = {
  show: (i, f, header) => {
    if (f.opponent === undefined) return header + `
        <div class="action-group">
          <span class="label">Wer soll raten?</span>
          ${state.players.map((_, j) => j === i ? "" : abilityButton(playerName(j), `state.ability.opponent = ${j}; save(); render()`)).join("")}
        </div>`;
    const o = playerName(f.opponent);
    if (f.secret === undefined) return header + onlyYouLook(i) + `
        <div class="action-group">
          <span class="label">${playerName(i)}, welche Zahl soll ${o} raten?</span>
          ${[2, 4, 6].map(n => abilityButton(String(n), `foolsRiddle(${n})`)).join("")}
        </div>`;
    if (f.guess === undefined) return `
      <div class="handover">
        <div class="emblem">${icon("guess")}</div>
        <p class="muted">Gib das Handy an</p>
        <p class="name-large">${o}</p>
        <p class="muted">${playerName(i)} hat heimlich 2, 4 oder 6 gewählt. ${o}, welche Zahl ist es?</p>
        <div class="number-row">${[2, 4, 6].map(n => `<button class="action" onclick="foolsGuess(${n})">${n}</button>`).join("")}</div>
      </div>`;
    const right = f.guess === f.secret;
    return `
      <div class="coin-flip">${f.secret}</div>
      <p class="narrative" style="text-align:center">${o} hat auf ${f.guess} getippt. ${right ? `Richtig! ${o} erhält ${coinsText(f.secret / 2)}.` : `Daneben! ${playerName(i)} erhält ${coinsText(f.secret)}.`}</p>
      <button class="btn" onclick="show('overview')">Weiter</button>`;
  }
};
function foolsRiddle(n) {
  const f = state.ability;
  if (f.secret !== undefined) return;
  f.secret = n;
  state.players[f.player].abilityUsed = true;
  save();
  render();
}
function foolsGuess(n) {
  const f = state.ability;
  if (f.secret === undefined || f.guess !== undefined) return;
  f.guess = n;
  if (n === f.secret) addCoins([f.opponent], f.secret / 2);
  else addCoins([f.player], f.secret);
  save();
  render();
}

Object.assign(SCREENS, {
  ability: screenAbility
});
