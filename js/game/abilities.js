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

ABILITIES.goldFinger = {
  show: (i, f, header) => {
    const extra = Math.min((state.lastWinnings || {})[i] || 0, 3);
    if (extra > 0) return header + abilityButton(`${playerName(i)} erhält ${extra} zusätzliche ${coinWord(extra)}`, "applyAbility()");
    return header + abilityNote(`${playerName(i)} hat das letzte Minispiel nicht gewonnen. Die Fähigkeit wirkt direkt nach einem gewonnenen Minispiel.`);
  },
  apply: i => {
    addCoins([i], Math.min((state.lastWinnings || {})[i] || 0, 3));
    delete state.lastWinnings[i];
  }
};

ABILITIES.marksman = {
  show: (i, f, header) => header + `
        <div class="action-group">
          <span class="label">${playerName(i)} kündigt den Sieg an. Welches Minispiel?</span>
          ${abilityButton(`Duell: ${playerName(i)} fordert heraus`, "startMarksman('duel')")}
          ${abilityButton("Alle gegen alle", "startMarksman('all')")}
          ${abilityButton(`Einer gegen alle: ${playerName(i)} allein`, "startMarksman('oneVsAll')")}
        </div>`
};
function startMarksman(category) {
  const i = state.ability.player;
  state.winBonus = { player: i, amount: 3 };
  state.players[i].abilityUsed = true;
  drawMinigame(category, false, i);
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

ABILITIES.luckyFairy = {
  show: (i, f, header) => {
    if (f.flip) {
      return header + `
          <div class="coin-flip">${f.flip}</div>
          <p class="result-number">${f.won ? "+4 Münzen" : "Leider nichts"}</p>
          <p class="narrative" style="text-align:center">${playerName(i)} hat auf ${f.side} gesetzt, die Münze zeigt ${f.flip}.</p>
          <button class="btn" onclick="show('overview')">Weiter</button>`;
    }
    return header + `
        <div class="action-group">
          <span class="label">Welche Seite bedeutet Erfolg?</span>
          ${abilityButton("Kopf", "luckyFairy('Kopf')")}
          ${abilityButton("Zahl", "luckyFairy('Zahl')")}
        </div>`;
  }
};
function luckyFairy(side) {
  const f = state.ability;
  const i = f.player;
  f.side = side;
  f.flip = Math.random() < 0.5 ? "Kopf" : "Zahl";
  f.won = f.flip === side;
  if (f.won) addCoins([i], 4);
  state.players[i].abilityUsed = true;
  save();
  render();
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

ABILITIES.tip = {
  show: (i, f, header) => {
    if ((state.lastParticipants || []).includes(i)) {
      return header + abilityButton(`${playerName(i)} erhält 2 Münzen Trinkgeld`, "applyAbility()");
    }
    return header + abilityNote(`Die Fähigkeit wirkt direkt nach einem Minispiel, bei dem ${playerName(i)} mitgespielt hat.`);
  },
  apply: i => {
    addCoins([i], 2);
    state.lastParticipants = [];
  }
};

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
    f.options = fresh.concat(shuffle(activeIndices(MINIGAMES).filter(k => !fresh.includes(k)))).slice(0, 3);
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
  startMinigame(index, false, i);
}

// The button for this ability appears on the minigame screen.
ABILITIES.loadedDice = {
  show: (i, f, header) => header + abilityNote(`Diese Fähigkeit setzt ${playerName(i)} während eines Minispiels ein. Dort erscheint dann ein Knopf dafür.`)
};
function useLoadedDice(i) {
  if (state.players[i].abilityUsed) return;
  state.players[i].abilityUsed = true;
  state.minigame.loadedDice = i;
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

ABILITIES.challenge = {
  show: (i, f, header) => header + abilityButton(`${playerName(i)} fordert zum Duell`, "challenge()")
};
function challenge() {
  const i = state.ability.player;
  state.winBonus = { player: i, amount: 2 };
  state.players[i].abilityUsed = true;
  drawMinigame("duel", false, i);
}

Object.assign(SCREENS, {
  ability: screenAbility
});
