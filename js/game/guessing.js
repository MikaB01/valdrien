function screenGuess() {
  const r = state.guess;
  if (!r) return screenOverview();
  const guesser = r.player !== null ? state.players[r.player] : null;
  const back = `<button class="btn" onclick="show('overview')">Weiter</button>`;

  if (r.step === "who") {
    return `
      <h2>Auf eine Rolle raten</h2>
      <p class="muted">Wer möchte raten? ${guessPriceText()} Schon erratene Rollen können nicht noch einmal erraten werden.</p>
      <div class="choices">
        ${state.players.map((s, i) => `
          <button class="choice" onclick="chooseGuesser(${i})" ${canGuess(i) ? "" : "disabled"}>
            <span>${escapeName(s.name)}</span>
            <span class="muted">${s.coins < guessCost() ? (s.coins ? "zu wenige Münzen" : "keine Münzen") : !unrevealedOthers(i) ? "alle anderen erraten" : s.coins + " Münzen"}</span>
          </button>`).join("")}
      </div>`;
  }

  if (r.step === "stake") {
    const cost = guessCost();
    return `
      ${cost ? `
      <h2>${escapeName(guesser.name)}, ${stakeText("eine Münze", coinsText(cost), cost)} setzen, um auf eine Rolle zu raten?</h2>
      <p class="muted">${guessPriceChanged() ? guessPriceText() + " " : ""}Du hast ${guesser.coins} Münzen. ${stakeText("Die gesetzte Münze geht", "Die gesetzten Münzen gehen", cost)} an die Spielbank.</p>
      <button class="btn" onclick="placeStake()">Ja, ${coinsText(cost)} setzen</button>` : `
      <h2>${escapeName(guesser.name)}, möchtest du auf eine Rolle raten?</h2>
      <p class="muted">${guessPriceText()}</p>
      <button class="btn" onclick="placeStake()">Ja, Tipp abgeben</button>`}
`;
  }

  if (r.step === "result") {
    return `
      <h2>${r.free ? "Dein Tipp, bitte!" : stakeText("Die Münze ist gesetzt", "Die Münzen sind gesetzt", r.cost)}</h2>
      <p class="narrative">${escapeName(guesser.name)}, sprich deinen Tipp laut aus: Wer ist welche Rolle? Die Person, auf die getippt wurde, sagt ehrlich, ob es stimmt.</p>
      <button class="btn" onclick="guessResult(true)">Rolle richtig erraten</button>
      <button class="btn-quiet" onclick="guessResult(false)">Falsch geraten</button>`;
  }

  if (r.step === "wrong") {
    return `
      <h2>Daneben!</h2>
      <p class="narrative">Die anderen haben ihr Geheimnis gewahrt. ${r.free ? "Zum Glück hat dich der Tipp nichts gekostet." : stakeText("Die gesetzte Münze ist verloren.", "Die gesetzten Münzen sind verloren.", r.cost)}</p>
      <p class="muted">${escapeName(guesser.name)} hat jetzt ${guesser.coins} Münzen.</p>
      ${back}`;
  }

  if (r.step === "whom") {
    return `
      <h2>Wessen Rolle hat ${escapeName(guesser.name)} erraten?</h2>
      <div class="choices">
        ${state.players.map((s, i) => i === r.player ? "" : `
          <button class="choice" onclick="guessTarget(${i})" ${s.revealed ? "disabled" : ""}>
            <span>${escapeName(s.name)}</span>
            <span class="muted">${s.revealed ? "schon erraten" : ""}</span>
          </button>`).join("")}
      </div>`;
  }

  const revealed = state.players[r.target];
  return `
    <h2>Treffer!</h2>
    <p class="result-number">+${r.bonus || RULES.hitReward} Münzen</p>
    <p class="narrative">${escapeName(guesser.name)} hat die Rolle von ${escapeName(revealed.name)} durchschaut. Die Fähigkeit von ${escapeName(revealed.name)} ist jetzt freigeschaltet.</p>
    <p class="muted">${escapeName(guesser.name)} hat jetzt ${guesser.coins} Münzen.</p>
    ${back}`;
}

function startGuess() {
  state.guess = { step: "who", player: null };
  show("guess");
}

function unrevealedOthers(i) {
  return state.players.filter((s, j) => j !== i && !s.revealed).length;
}

function canGuess(i) {
  return state.players[i].coins >= guessCost() && unrevealedOthers(i) > 0;
}

function chooseGuesser(i) {
  if (!canGuess(i)) return;
  state.guess = { step: "stake", player: i };
  show("guess");
}

function placeStake() {
  const guesser = state.players[state.guess.player];
  const cost = guessCost();
  if (guesser.coins < cost) return;
  guesser.coins -= cost;
  state.guess.cost = cost;
  state.guess.free = cost === 0;
  state.guess.step = "result";
  show("guess");
}

function guessResult(correct) {
  state.guess.step = correct ? "whom" : "wrong";
  show("guess");
}

function guessTarget(i) {
  if (state.players[i].revealed) return;
  const c = state.curiosity;
  const bonus = c && c.player === state.guess.player && c.target === i ? Math.max(RULES.curiosityHitReward, hitReward()) : hitReward();
  state.players[state.guess.player].coins += bonus;
  state.guess.bonus = bonus;
  state.players[i].revealed = true;
  state.guess.target = i;
  state.guess.step = "right";
  show("guess");
}

function guessCost() {
  return lasting("looseTongues") ? 0 : lasting("costlyGuess") ? RULES.guessCostCostly : RULES.guessCost;
}
function guessPriceChanged() { return guessCost() !== RULES.guessCost; }
function guessPriceText() {
  const cost = guessCost();
  const text = cost ? `Ein Tipp kostet ${guessPriceChanged() ? "gerade " : ""}${coinsText(cost)}.` : "Raten kostet gerade nichts.";
  return guessPriceChanged() ? `${state.lasting.title}: ${text}` : text;
}

function hitReward() {
  return lasting("seers") ? RULES.hitRewardSeers : lasting("bounty") ? RULES.hitRewardBounty : RULES.hitReward;
}

function stakeText(oneCoin, severalCoins, cost = RULES.guessCost) { return cost === 1 ? oneCoin : severalCoins; }

Object.assign(SCREENS, {
  guess: screenGuess
});
