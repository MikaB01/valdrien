// Hand cards: private event cards of type "keep". The player keeps the card and plays it later on the game master
// phone ("Nachsehen" → "Einsetzen"), on a page without the role that may be shown to the table.
// Playing books the card's coins (if any), then its handler. Handlers are keyed like CATALOG.privateEffects.keep:
//   blocked(i)        why the card cannot be played right now ("" when it can)
//   show(i, card)     HTML of the play step; buttons call playHandCard(arg) (or a function of their own)
//   play(i, arg)      books the effect and returns the line kept on the card
//   done(i, h)        extra HTML after playing (e.g. the keys just looked at)
//   elsewhere         the card is played somewhere else; the text replaces the button under "Nachsehen"
const HAND_CARDS = {};

function playButton(text, action = "playHandCard()", disabled) {
  return `<button class="action" onclick="${action}" ${disabled ? "disabled" : ""}>${text}</button>`;
}
function handNote(text) { return `<p class="note">${text}</p>`; }
function otherPlayers(i) { return state.players.map((_, j) => j).filter(j => j !== i); }

// Hand cards a player still holds, optionally only those with one effect.
function keptCards(i, effect) {
  const s = state.players[i];
  return ((s && s.secrets) || []).filter(p => p.kind === "keep" && p.status === "kept" && (effect === undefined || p.effect === effect));
}

function handHandler(p) { return HAND_CARDS[p.effect || ""] || HAND_CARDS[""]; }

function handBlocked(i, p) {
  if (p.drinking && !drinkingOn()) return "Das Trinkspiel ist gerade ausgeschaltet. Die Karte wartet, bis es in den Einstellungen wieder an ist.";
  const h = handHandler(p);
  return h.blocked ? h.blocked(i, p) : "";
}

// Under "Nachsehen": what the card waits for, or that it can be played now.
function handCardHint(i, p) {
  const h = handHandler(p);
  return h.elsewhere || handBlocked(i, p) || "Du kannst sie jetzt einsetzen. Danach ist sie verbraucht.";
}

function handCardControl(i, p) {
  if (p.kind !== "keep" || p.status !== "kept" || handHandler(p).elsewhere || handBlocked(i, p)) return "";
  return `<button class="btn-quiet" onclick="startHandCard(${i}, '${p.id}')">${p.title} einsetzen</button>`;
}

function handEntry(h) {
  const s = h && state.players[h.player];
  return s ? (s.secrets || []).find(p => p.id === h.id) || null : null;
}

function startHandCard(i, id) {
  const p = keptCards(i).find(x => x.id === id);
  if (!p) return;
  state.handCard = { player: i, id };
  show("handCard");
}

function playHandCard(arg) {
  const h = state.handCard;
  const p = handEntry(h);
  if (!p || p.status !== "kept" || h.played || handBlocked(h.player, p)) return;
  const i = h.player;
  const before = state.players.map(s => s.coins);
  if (p.coins) addCoins([i], p.coins);
  const handler = handHandler(p);
  const result = handler.play ? handler.play(i, arg, h) : "";
  noteLosses(before, "card", p.title, i);
  p.status = "used";
  p.result = result || "Eingesetzt.";
  h.played = true;
  save();
  render();
}

function backToSecrets() {
  state.handCard = null;
  if (state.peekRole && state.players[state.peekRole.player]) show("myRole");
  else show("overview");
}

function finishHandCard() {
  state.handCard = null;
  state.peekRole = null;
  show("overview");
}

function screenHandCard() {
  const h = state.handCard;
  const p = handEntry(h);
  if (!p) return screenOverview();
  const i = h.player;
  const handler = handHandler(p);
  const card = `
    <p class="muted" style="text-align:center">Handkarte von ${playerName(i)}</p>
    <article class="card drawn-card">
      <div class="title">
        <span class="label">Geheime Karte</span>
        <div class="card-name">${p.title}</div>
      </div>
      <p class="narrative">${p.text}</p>
    </article>`;
  if (h.played) return `
    ${card}
    <p class="outcome outcome-done"><strong>✓ Eingesetzt</strong>${p.result}</p>
    ${handler.done ? handler.done(i, h) : ""}
    <button class="btn" onclick="finishHandCard()">Fertig</button>`;
  const blocked = p.status === "kept" ? handBlocked(i, p) : "Die Karte ist schon verbraucht.";
  return `
    ${card}
    ${blocked ? handNote(blocked) : handler.show(i, p)}
    <button class="link-button" onclick="backToSecrets()">Doch nicht</button>`;
}

/* --- What the cards do --- */

HAND_CARDS[""] = {
  show: () => playButton("Karte einsetzen")
};

const LOSS_SOURCES = { event: "die Ereigniskarte", minigame: "das Minispiel", ability: "die Fähigkeit", card: "die Karte" };
function lossText(r) { return `${coinsText(r.amount)} durch ${LOSS_SOURCES[r.source] || ""} »${r.title}«`; }
const noLoss = "Gerade hast du keine Münzen verloren. Die Karte wirkt direkt nach einem Verlust, bevor die nächste Karte oder das nächste Minispiel kommt. Was du selbst ausgibst, etwa für Schlüssel oder beim Raten, zählt nicht.";

// Freibrief: the last loss does not count.
HAND_CARDS.waiver = {
  blocked: i => recentLoss(i) ? "" : noLoss,
  show: i => handNote(`Dein letzter Verlust: ${lossText(recentLoss(i))}.`)
    + playButton(`Einsetzen: ${coinsText(recentLoss(i).amount)} zurück`),
  play: i => {
    const r = recentLoss(i);
    addCoins([i], r.amount);
    clearLoss(i);
    return `${coinsText(r.amount)} zurück. Der Verlust durch »${r.title}« gilt für dich nicht.`;
  }
};

// Doppelte Ration: the gain of the minigame just won once more.
HAND_CARDS.doubleWin = {
  blocked: i => recentWin(i) ? "" : "Du hast gerade kein Minispiel gewonnen. Zeig die Karte direkt nach einem gewonnenen Minispiel vor, bevor die nächste Karte kommt.",
  show: i => playButton(`Einsetzen: ${coinsText(recentWin(i))} extra`),
  play: i => {
    const n = recentWin(i);
    addCoins([i], n);
    delete state.lastWinnings[i];
    return `Dein Minispielgewinn ist verdoppelt: ${coinsText(n)} extra.`;
  }
};

// Sündenbock (loss through a minigame) and Mitgefangen, mitgehangen (half of any loss, rounded up):
// another player of the holder's choice pays, at most what he has.
function lossShifter(share, onlyMinigame) {
  const usable = i => { const r = recentLoss(i); return r && (!onlyMinigame || r.source === "minigame") ? r : null; };
  return {
    blocked: i => !usable(i)
      ? (onlyMinigame && recentLoss(i) ? "Dein letzter Verlust kam nicht aus einem Minispiel. Die Karte wirkt nur direkt nach einem Verlust durch ein Minispiel." : noLoss)
      : otherPlayers(i).some(j => state.players[j].coins > 0) ? "" : "Niemand sonst hat Münzen, die er für dich zahlen könnte.",
    show: i => {
      const r = usable(i);
      const amount = share(r.amount);
      return handNote(`Dein letzter Verlust: ${lossText(r)}. Wer zahlt ${coinsText(amount)} für dich? Hat er weniger, zahlt er, was er hat.`)
        + `<div class="action-group">${otherPlayers(i).map(j => playButton(`${playerName(j)} (${coinsText(state.players[j].coins)})`, `playHandCard(${j})`, !state.players[j].coins)).join("")}</div>`;
    },
    play: (i, j) => {
      const r = usable(i);
      const amount = share(r.amount);
      const paid = transfer(j, i, amount);
      clearLoss(i);
      return `${playerName(j)} zahlt dir ${coinsText(paid)}${paid < amount ? ", mehr hatte er nicht" : ""}.`;
    }
  };
}
HAND_CARDS.scapegoat = lossShifter(n => n, true);
HAND_CARDS.shareLoss = lossShifter(n => Math.ceil(n / 2), false);

// Flüstern durch die Wand: a secret yes/no question about a role; the app only notes that it was asked.
HAND_CARDS.whisper = {
  blocked: i => !rolesOn() ? "In dieser Partie gibt es keine Rollen, nach denen du fragen könntest."
    : otherPlayers(i).some(j => !state.players[j].revealed) ? "" : "Alle anderen Rollen sind schon erraten.",
  show: () => handNote("Stell jetzt einem Mitspieler heimlich eine Ja-Nein-Frage zu seiner Rolle, zum Beispiel ins Ohr geflüstert. Nach dem Namen der Rolle darfst du nicht fragen. Er muss ehrlich antworten.")
    + playButton("Die Frage ist gestellt"),
  play: () => "Du hast deine Frage gestellt."
};

// Der Tipp der Wahrsagerin: starts a guess right away; a hit pays RULES.fortuneTipHitReward (see guessing.js).
HAND_CARDS.fortuneTip = {
  blocked: i => !rolesOn() ? "In dieser Partie gibt es keine Rollen zu erraten."
    : !unrevealedOthers(i) ? "Alle anderen Rollen sind schon erraten."
    : state.players[i].coins < guessCost() ? `Ein Tipp kostet gerade ${coinsText(guessCost())}, so viele Münzen hast du nicht.` : "",
  show: () => handNote(`Zeig die Karte vor und rate gleich: Liegst du richtig, erhältst du ${coinsText(tipReward())} statt ${hitReward()}. Liegst du falsch, ist die Karte trotzdem verbraucht.`)
    + playButton("Karte vorzeigen und jetzt raten", "fortuneGuess()")
};
function fortuneGuess() {
  const h = state.handCard;
  const p = handEntry(h);
  if (!p || p.status !== "kept" || handBlocked(h.player, p)) return;
  state.handCard = null;
  state.peekRole = null;
  state.guess = { step: "stake", player: h.player, tip: p.id };
  show("guess");
}

// Ein Blick in fremde Taschen: only the holder sees another player's keys.
HAND_CARDS.peekKeys = {
  blocked: () => keysGoal() ? "" : "In diesem Abenteuer gibt es keine Schlüssel.",
  show: i => `<div class="action-group"><span class="label">In wessen Tasche schaust du?</span>
    ${otherPlayers(i).map(j => playButton(playerName(j), `playHandCard(${j})`)).join("")}</div>`,
  play: (i, j, h) => { h.target = j; return `Du hast dir die Schlüssel von ${playerName(j)} angesehen.`; },
  done: (i, h) => state.players[h.target]
    ? `<section class="shown-keys"><span class="label">Die Schlüssel von ${playerName(h.target)}</span>${keyStrip(keysOf(h.target))}</section>` : ""
};

// Noch ein Griff in den Bund: played on the key purchase screen (keys.js, redrawKey).
HAND_CARDS.redrawKey = {
  elsewhere: "Die setzt du beim Schlüsselkauf ein: Bekommst du einen Schlüssel, den du schon hast, erscheint dort ein Knopf dafür."
};

// Der Fragenmeister, Das Kerkergesetz: a rule that holds until the next minigame (reminder on the main screen).
HAND_CARDS.tableRule = {
  show: () => handNote("Zeig die Karte vor. Sie gilt bis zum nächsten Minispiel, die Hauptseite erinnert daran.")
    + playButton("Karte vorzeigen"),
  play: i => {
    const p = handEntry(state.handCard);
    addTableRule({ title: p.title, player: i });
    return "Gilt bis zum nächsten Minispiel.";
  }
};

// Ein Beutel voll Freibier: the card's coins (booked by playHandCard), then as many sips to hand out as coins now.
HAND_CARDS.freeBeer = {
  show: (i, p) => playButton(p.coins ? `Einsetzen: ${coinsText(p.coins)}` : "Karte einsetzen"),
  play: i => {
    const n = state.players[i].coins;
    return `${handEntry(state.handCard).coins ? `Du hast jetzt ${coinsText(n)}. ` : ""}Verteile ${n} ${n === 1 ? "Schluck" : "Schlücke"} an deine Mitspieler.`;
  }
};

Object.assign(SCREENS, {
  handCard: screenHandCard
});
