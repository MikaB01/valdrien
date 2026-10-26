function screenGuess() {
  const r = state.guess;
  if (!r) return screenOverview();
  const guesser = r.player !== null ? state.players[r.player] : null;
  const back = `<button class="btn" onclick="show('overview')">Weiter</button>`;

  if (r.step === "who") {
    return `
      <h2>Auf eine Rolle raten</h2>
      <p class="muted">Wer möchte raten? ${state.freeGuesses ? "Lose Zungen: Raten kostet gerade nichts." : `Ein Tipp kostet ${coinsText(RULES.guessCost)}.`} Schon erratene Rollen können nicht noch einmal erraten werden.</p>
      <div class="choices">
        ${state.players.map((s, i) => `
          <button class="choice" onclick="chooseGuesser(${i})" ${canGuess(i) ? "" : "disabled"}>
            <span>${escapeName(s.name)}</span>
            <span class="muted">${s.coins < guessCost() ? (s.coins ? "zu wenige Münzen" : "keine Münzen") : !unrevealedOthers(i) ? "alle anderen erraten" : s.coins + " Münzen"}</span>
          </button>`).join("")}
      </div>`;
  }

  if (r.step === "stake") {
    return `
      ${state.freeGuesses ? `
      <h2>${escapeName(guesser.name)}, möchtest du auf eine Rolle raten?</h2>
      <p class="muted">Lose Zungen: Dein Tipp kostet gerade nichts.</p>
      <button class="btn" onclick="placeStake()">Ja, Tipp abgeben</button>` : `
      <h2>${escapeName(guesser.name)}, ${stakeText("eine Münze", coinsText(RULES.guessCost))} setzen, um auf eine Rolle zu raten?</h2>
      <p class="muted">Du hast ${guesser.coins} Münzen. ${stakeText("Die gesetzte Münze geht", "Die gesetzten Münzen gehen")} an die Spielbank.</p>
      <button class="btn" onclick="placeStake()">Ja, ${coinsText(RULES.guessCost)} setzen</button>`}
`;
  }

  if (r.step === "result") {
    return `
      <h2>${r.free ? "Dein Tipp, bitte!" : stakeText("Die Münze ist gesetzt", "Die Münzen sind gesetzt")}</h2>
      <p class="narrative">${escapeName(guesser.name)}, sprich deinen Tipp laut aus: Wer ist welche Rolle? Die Person, auf die getippt wurde, sagt ehrlich, ob es stimmt.</p>
      <button class="btn" onclick="guessResult(true)">Rolle richtig erraten</button>
      <button class="btn-quiet" onclick="guessResult(false)">Falsch geraten</button>`;
  }

  if (r.step === "wrong") {
    return `
      <h2>Daneben!</h2>
      <p class="narrative">Die anderen haben ihr Geheimnis gewahrt. ${r.free ? "Zum Glück hat dich der Tipp nichts gekostet." : stakeText("Die gesetzte Münze ist verloren.", "Die gesetzten Münzen sind verloren.")}</p>
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
  const bonus = hitReward();
  state.players[state.guess.player].coins += bonus;
  state.guess.bonus = bonus;
  state.players[i].revealed = true;
  state.guess.target = i;
  state.guess.step = "right";
  show("guess");
}

function guessCost() { return state.freeGuesses ? 0 : RULES.guessCost; }

function hitReward() { return state.seersNight ? RULES.hitRewardSeers : RULES.hitReward; }

function stakeText(oneCoin, severalCoins) { return RULES.guessCost === 1 ? oneCoin : severalCoins; }

Object.assign(SCREENS, {
  guess: screenGuess
});
