// Adventures with goal "keys" (Das Henkersmahl im Verlies): players buy random keys from the drunk jailer.
// Only the buyer sees which key came out; three different keys break out and end the game at once.
// players[i].keys = { iron: n, silver: n, bone: n }

function keysGoal() { return currentAdventure().goal === "keys"; }
function keysOf(i) { return (state.players[i] && state.players[i].keys) || {}; }
function distinctKeys(i) { return RULES.keys.filter(k => keysOf(i)[k.id] > 0).length; }
function totalKeys(i) { return RULES.keys.reduce((n, k) => n + (keysOf(i)[k.id] || 0), 0); }
function hasAllKeys(i) { return distinctKeys(i) === RULES.keys.length; }
function keyKind(id) { return RULES.keys.find(k => k.id === id); }

function randomKey() {
  let r = Math.random() * RULES.keys.reduce((n, k) => n + k.chance, 0);
  for (const k of RULES.keys) { r -= k.chance; if (r < 0) return k.id; }
  return RULES.keys[0].id;
}

// counts: { iron: n, ... }; also used on the player's own QR page
function keyStrip(counts, small) {
  return `
    <div class="key-strip ${small ? "key-strip-small" : ""}">
      ${RULES.keys.map(k => {
        const n = (counts || {})[k.id] || 0;
        return `
        <figure class="key-slot ${n ? "owned" : "missing"}">
          <span class="key-image">
            <img src="${k.image}" alt="${k.name}${n ? "" : " (fehlt)"}" loading="lazy" decoding="async">
            ${n > 1 ? `<span class="key-count" aria-label="${n} Stück">${n}×</span>` : ""}
          </span>
          ${small ? "" : `<figcaption>${k.name.replace("schlüssel", "")}<span>${n ? (n > 1 ? `${n} Stück` : "vorhanden") : "fehlt noch"}</span></figcaption>`}
        </figure>`;
      }).join("")}
    </div>`;
}

const JAILER_LINES = [
  "„Der hier passt bestimmt“, lallt der Kerkermeister und kichert.",
  "„Hicks. Nimm den. Oder den. Ach, nimm den.“",
  "„Den hab ich noch nie gesehen. Muss wichtig sein.“",
  "Der Kerkermeister rülpst und drückt dir einen Schlüssel in die Hand.",
  "„Für dich nur das Beste“, nuschelt er und greift blind in den Bund.",
  "„Psst. Nicht weitersagen“, flüstert er so laut, dass es alle hören."
];

function startBuyKey() {
  state.buyKey = { step: "who", player: null };
  show("buyKey");
}

function screenBuyKey() {
  const b = state.buyKey || { step: "who", player: null };
  const cost = RULES.keyCost;
  if (b.step === "who" || !state.players[b.player]) {
    return `
      <div class="heading"><span class="eyebrow">Beim Kerkermeister</span><h2>Wer kauft einen Schlüssel?</h2></div>
      <figure class="key-banner"><img src="images/dungeon-keys.jpg" alt="Ein Eisen-, ein Silber- und ein Knochenschlüssel auf rotem Tuch"></figure>
      <p class="muted">Ein Schlüssel kostet ${coinsText(cost)}. Welcher es wird, weiß nicht einmal der Kerkermeister: meist Eisen, seltener Silber, ganz selten Knochen.</p>
      <div class="choices">
        ${state.players.map((s, i) => `
          <button class="choice" onclick="chooseKeyBuyer(${i})" ${s.coins < cost ? "disabled" : ""}>
            <span>${escapeName(s.name)}</span>
            <span class="muted">${s.coins < cost ? "zu wenige Münzen" : coinsText(s.coins)}</span>
          </button>`).join("")}
      </div>`;
  }
  const i = b.player;
  const name = playerName(i);
  if (b.step === "handover") {
    return `
      <div class="handover">
        <div class="emblem emblem-keys" aria-hidden="true"></div>
        <p class="muted">Gib das Handy an</p>
        <p class="name-large">${name}</p>
        <p class="muted">Nur ${name} darf jetzt hinsehen. Welchen Schlüssel du bekommst, bleibt dein Geheimnis.</p>
        <button class="btn" onclick="buyKey()" ${state.players[i].coins < cost ? "disabled" : ""}>Ich bin ${name}: ${coinsText(cost)} zahlen</button>
        <button class="link-button" onclick="state.buyKey = { step: 'who', player: null }; render()">Doch nicht</button>
      </div>`;
  }
  const kind = keyKind(b.result);
  const complete = hasAllKeys(i);
  const before = (b.before || 0);
  return `
    <div class="key-result">
      <p class="kicker">${b.line || JAILER_LINES[0]}</p>
      <figure class="key-drawn"><img src="${kind.image}" alt=""><figcaption>${kind.name}</figcaption></figure>
      ${complete ? `
        <h2 class="escape-title">Alle drei Schlüssel!</h2>
        <p class="narrative" style="text-align:center">Eisentür, Silbergitter, Knochentor: Für jede Tür hast du den passenden Schlüssel. Jetzt aber schnell, bevor der Kerkermeister aufwacht.</p>
        ${keyStrip(keysOf(i))}
        <button class="btn btn-large btn-escape" onclick="breakOut(${i})">Ausbrechen!</button>` : `
        <p class="muted" style="text-align:center">${before
          ? `Den hattest du schon. Doppelt hält besser, öffnet aber keine neue Tür.`
          : `Damit öffnest du ${kind.id === "iron" ? "die" : "das"} ${kind.door}. ${RULES.keys.length - distinctKeys(i) === 1 ? "Nur noch ein Schlüssel fehlt!" : `Noch ${RULES.keys.length - distinctKeys(i)} Schlüssel fehlen.`}`}</p>
        <span class="label">Deine Schlüssel, ${name}</span>
        ${keyStrip(keysOf(i))}
        <p class="muted" style="text-align:center">Du hast noch ${coinsText(state.players[i].coins)}.</p>
        ${state.players[i].coins >= cost ? `<button class="btn-quiet" onclick="buyKey()">Noch einen kaufen (${coinsText(cost)})</button>` : ""}
        <button class="btn" onclick="state.buyKey = null; show('overview')">Verbergen und zurückgeben</button>`}
    </div>`;
}

function chooseKeyBuyer(i) {
  if (!state.players[i] || state.players[i].coins < RULES.keyCost) return;
  state.buyKey = { step: "handover", player: i };
  show("buyKey");
}

function buyKey() {
  const b = state.buyKey;
  const s = b && state.players[b.player];
  if (!s || s.coins < RULES.keyCost || hasAllKeys(b.player)) return;
  addCoins([b.player], -RULES.keyCost);
  const id = randomKey();
  s.keys = s.keys || {};
  b.before = s.keys[id] || 0;
  s.keys[id] = b.before + 1;
  b.result = id;
  b.step = "result";
  b.line = pick(JAILER_LINES);
  playKeySound(hasAllKeys(b.player));
  show("buyKey");
}

function breakOut(i) {
  if (!hasAllKeys(i)) return;
  state.escaped = i;
  state.buyKey = null;
  state.running = false;
  resetTimer();
  playEscapeSound();
  show("end");
}

// Without a breakout ("Der Henker kommt"): whoever came closest; then more keys, then more coins.
function keyRanking() {
  return state.players.map((_, i) => i).sort((a, b) =>
    (b === state.escaped) - (a === state.escaped) || distinctKeys(b) - distinctKeys(a)
    || totalKeys(b) - totalKeys(a) || state.players[b].coins - state.players[a].coins);
}

function sameKeyRank(a, b) {
  return distinctKeys(a) === distinctKeys(b) && totalKeys(a) === totalKeys(b) && state.players[a].coins === state.players[b].coins;
}

function screenKeysEnd() {
  const order = keyRanking();
  const escaped = state.escaped !== undefined && state.escaped !== null && state.players[state.escaped];
  const leaders = escaped ? [state.escaped] : order.filter(i => sameKeyRank(i, order[0]));
  const winner = leaders.map(playerName).join(" & ");
  const best = distinctKeys(order[0]);
  const story = escaped ? currentAdventure().epilogue(winner, false) : `
    <p class="ornament">✦ ✦ ✦</p>
    <h1>Der Henker kommt</h1>
    <div class="narrative"><p>Das Morgengrauen kriecht durch die Gitter, und niemand hat es hinausgeschafft. Schwere Schritte kommen die Wendeltreppe herunter. Am weitesten gekommen ist:</p></div>
    <p class="winner">${winner}</p>
    <div class="narrative"><p class="closing">${best ? `${best} von ${RULES.keys.length} Schlüsseln. Fast frei ist auch gefangen.` : "Kein einziger Schlüssel. Der Henker freut sich auf eine lange Liste."}</p></div>`;
  return `
    <div class="speakable epilogue">${speakButton()}${story}</div>
    <span class="label">Wer hatte was?</span>
    <div class="reveal-list">
      ${order.map(i => {
        const role = roleOf(i);
        return `
        <div class="reveal-row ${leaders.includes(i) ? "reveal-winner" : ""}">
          <div class="reveal-head">
            <span class="player-name">${playerName(i)}</span>
            <span class="score-coins">${state.players[i].coins}<span class="coin-icon" aria-hidden="true"></span></span>
          </div>
          ${role ? `<span class="muted">${role.name}, ${role.title}</span>` : ""}
          ${keyStrip(keysOf(i), true)}
        </div>`;
      }).join("")}
    </div>
    <button class="btn" onclick="playAgain()">Nochmal mit derselben Runde</button>
    <button class="btn-quiet" onclick="newGame()">Zum Hauptmenü</button>`;
}

// Keys mode: the secret task is cashed in during the game (the end comes without warning).
function taskCashIn(i) {
  const s = state.players[i];
  const role = roleOf(i);
  if (!keysGoal() || !role || !role.task.bonus) return "";
  if (s.taskDone) return `<p class="note">Deine geheime Aufgabe ist erledigt, ${coinsText(role.task.bonus)} sind gebucht.</p>`;
  const m = state.peekRole || {};
  return m.confirmTask ? `
    <div class="confirm">
      <strong>${role.task.name} wirklich geschafft?</strong>
      <p class="muted">Ehrensache unter Gefangenen: Die anderen müssen es am Ende bestätigen können.</p>
      <button class="btn" onclick="cashInTask(${i})">Ja, ${coinsText(role.task.bonus)} kassieren</button>
      <button class="link-button" onclick="state.peekRole.confirmTask = false; render()">Noch nicht</button>
    </div>` : `<button class="btn-quiet" onclick="state.peekRole.confirmTask = true; render()">Aufgabe geschafft: ${coinsText(role.task.bonus)} kassieren</button>`;
}

function cashInTask(i) {
  const s = state.players[i];
  const role = roleOf(i);
  if (!role || s.taskDone) return;
  s.taskDone = true;
  addCoins([i], role.task.bonus);
  state.peekRole.confirmTask = false;
  save();
  render();
}

Object.assign(SCREENS, {
  buyKey: screenBuyKey
});
