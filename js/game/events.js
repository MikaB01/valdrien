function screenEvent() {
  const e = state.event;
  const card = e && EVENTS[e.index];
  if (!card) return screenOverview();
  if (e.isPrivate) return screenPrivateEvent();

  const effect = eventEffect();
  // "Wer hat gewonnen?" only makes sense once the minigame has been drawn
  const waiting = e.minigameIndex === null && (effect.groups || []).some(g => g.buttons.some(k => k.minigame));
  const groups = (effect.groups || []).map((group, gi) => {
    if (waiting && !group.buttons.some(k => k.minigame)) return "";
    const chosen = e.done[gi];
    const buttons = group.buttons.map((k, bi) => {
      if (k.minigame) {
        const drawn = MINIGAMES[e.minigameIndex];
        return `<button class="action action-minigame" onclick="eventAction(${gi}, ${bi})">${drawn ? `Minispiel ansehen: ${drawn.title}` : `Minispiel ziehen: ${CATEGORY_NAMES[k.minigame]}`}</button>`;
      }
      if (chosen === bi) {
        return `<button class="action chosen" disabled>✓ ${k.text}</button>`;
      }
      return `<button class="action" onclick="eventAction(${gi}, ${bi})" ${chosen !== undefined ? "disabled" : ""}>${k.text}</button>`;
    }).join("");
    return `<div class="action-group">${group.title ? `<span class="label">${group.title}</span>` : ""}${buttons}</div>`;
  }).join("");

  return `
    ${e.automatic
      ? `<p class="kicker">Die Zeit ist um! Ein Ereignis tritt ein …</p>`
      : `<p class="muted" style="text-align:center">Ereigniskarte · noch ${state.eventDeck.length} im Stapel</p>`}
    <article class="card drawn-card speakable">
      ${speakButton()}
      <div class="title">
        <span class="label">${card.category}</span>
        <div class="card-name">${card.title}</div>
      </div>
      <p class="narrative">${card.text}</p>
    </article>
    ${effect.note ? `<p class="note">${effect.note}</p>` : ""}
    ${groups ? `<div class="actions">${groups}</div>` : ""}
    ${eventPending() ? "" : `<button class="btn" onclick="show('overview')">Weiter</button>`}
  `;
}

// Cards come from a shuffled deck, so every card shows up once before any repeats.
function drawEvent(automatic, fixedIndex) {
  if (fixedIndex === undefined && (!state.eventDeck || state.eventDeck.length === 0)) {
    state.eventDeck = shuffle(playableEvents());
  }
  let index = fixedIndex !== undefined ? fixedIndex : state.eventDeck.pop();
  if (!EVENTS[index] || (fixedIndex === undefined && !playableEvents().includes(index))) { // stale deck
    state.eventDeck = shuffle(playableEvents());
    index = state.eventDeck.pop();
  }

  resetTimer();
  if (state.minigame && state.minigame.fromEvent) state.minigame = null;
  if (EVENTS[index].isPrivate) { privateEvent(index, automatic); return; }
  // a new card ends everything that lasted "until the next event"
  state.seersNight = false;
  state.freeGuesses = false;
  const onDraw = EFFECTS_ON_DRAW[EVENTS[index].effect];
  if (onDraw) onDraw();
  state.lastWinnings = {};
  state.lastParticipants = [];

  state.event = {
    index: index,
    automatic: Boolean(automatic),
    done: {},
    minigameIndex: null,
    snapshot: takeSnapshot()
  };
  show("event");
}

// A private card goes to one player (preferably one with few so far) and read under "Geheim nachsehen" or on their own phone.
function privateEvent(index, automatic) {
  const counts = state.players.map(s => (s.secrets || []).length);
  const fewest = Math.min(...counts);
  const candidates = state.players.map((_, i) => i).filter(i => counts[i] === fewest);
  const player = candidates[Math.floor(Math.random() * candidates.length)];
  const entry = givePrivateCard(index, player);
  state.event = { index, automatic: Boolean(automatic), isPrivate: true, player, entryId: entry.id, done: {}, snapshot: takeSnapshot() };
  show("event");
}

function givePrivateCard(index, player) {
  const card = EVENTS[index];
  const s = state.players[player];
  const entry = {
    id: randomCode().slice(0, 8),
    title: card.title,
    text: card.text,
    kind: card.privateType,
    coins: card.privateCoins,
    status: card.privateType === "task" ? "open" : "received",
    time: Date.now()
  };
  if (entry.kind === "instant" && entry.coins) addCoins([player], entry.coins);
  s.secrets = (s.secrets || []).concat(entry);
  return entry;
}

// When the time is up: an event card or, by the share set in the settings, a minigame.
function drawTimedCard() {
  const share = settings.minigameShare ?? RULES.minigameShareDefault;
  if (activeIndices(MINIGAMES).length && Math.random() < share) {
    resetTimer();
    drawMinigame(null, false);
    state.minigame.automatic = true;
    save();
    render();
  } else {
    drawEvent(true);
  }
}

// A player buys a secret event card: coins go to the bank, the card goes to the secret view.
function privateCards() { return playableEvents().filter(i => EVENTS[i].isPrivate); }

function startBuyCard() {
  state.buyCard = { player: null };
  show("buyCard");
}

function screenBuyCard() {
  const b = state.buyCard || { player: null };
  const cost = RULES.privateCardCost;
  const heading = `<div class="heading"><span class="eyebrow">Geheimkarte</span><h2>Wer kauft eine geheime Karte?</h2></div>`;
  if (!privateCards().length) {
    return `${heading}<p class="note">In diesem Abenteuer gibt es noch keine geheimen Ereigniskarten. Im CMS lassen sie sich mit der Sichtbarkeit „geheim“ anlegen.</p>`;
  }
  if (b.player === null || !state.players[b.player]) {
    return `
      ${heading}
      <p class="muted">Eine geheime Ereigniskarte kostet ${coinsText(cost)}. Nur wer sie kauft, erfährt, was darauf steht.</p>
      <div class="choices">
        ${state.players.map((s, i) => `
          <button class="choice" onclick="state.buyCard.player = ${i}; render()" ${s.coins < cost ? "disabled" : ""}>
            <span>${escapeName(s.name)}</span>
            <span class="muted">${s.coins < cost ? "zu wenige Münzen" : coinsText(s.coins)}</span>
          </button>`).join("")}
      </div>`;
  }
  const name = playerName(b.player);
  return `
    <div class="handover">
      <div class="emblem">${icon("event")}</div>
      <h2>${name} kauft eine geheime Karte</h2>
      <p class="muted">${coinsText(cost)} gehen an die Spielbank. Danach bekommt ${name} das Handy und liest die Karte allein.</p>
      <button class="btn" onclick="buyCard()">Ja, für ${coinsText(cost)} kaufen</button>
      <button class="link-button" onclick="state.buyCard.player = null; render()">Doch nicht</button>
    </div>`;
}

function buyCard() {
  const i = state.buyCard && state.buyCard.player;
  const s = state.players[i];
  const cost = RULES.privateCardCost;
  const cards = privateCards();
  if (!s || !cards.length || s.coins < cost) return;
  const had = new Set((s.secrets || []).map(p => p.title));
  const unseen = cards.filter(k => !had.has(EVENTS[k].title));
  const pool = unseen.length ? unseen : cards;
  addCoins([i], -cost);
  givePrivateCard(pool[Math.floor(Math.random() * pool.length)], i);
  state.buyCard = null;
  startMyRole(i);
}

function resolveTask(i, id, success) {
  const p = (state.players[i].secrets || []).find(x => x.id === id);
  if (!p || p.status !== "open") return;
  p.status = success ? "done" : "missed";
  if (success && p.coins) addCoins([i], p.coins);
  save();
  renderFrame();
  render();
}

function openTasks() {
  return (state.players || []).flatMap((s, i) => (s.secrets || []).filter(p => p.status === "open").map(p => ({ i, p })));
}

function screenPrivateEvent() {
  const e = state.event;
  const i = e.player;
  setTimeout(showConnection, 0);
  return `
    ${e.automatic ? `<p class="kicker">Die Zeit ist um! Ein Ereignis tritt ein …</p>` : ""}
    <article class="card drawn-card">
      <div class="title">
        <span class="label">Geheimes Ereignis</span>
        <div class="card-name">für ${playerName(i)}</div>
      </div>
      <p class="narrative">Nur ${playerName(i)} erfährt, was geschieht. Alle anderen wissen nur: Da ist etwas im Gange.</p>
    </article>
    <p class="note" id="connection-note" hidden></p>
    <button class="btn" onclick="startMyRole(${i})">${playerName(i)} sieht jetzt nach</button>
    <button class="btn-quiet" onclick="show('overview')">Später nachsehen</button>
  `;
}

// Only a connected player phone is worth a note; without one the card waits under "Geheim nachsehen".
async function showConnection() {
  const field = document.getElementById("connection-note");
  const e = state.event;
  if (!field || !e || !e.isPrivate || !PROJECT_URL || !state.session) return;
  const s = state.players[e.player];
  try {
    const list = await rpc("seat_status", { p_session: state.session.id, p_secret: state.session.secret });
    const row = (list || []).find(z => z.access_code === s.accessCode);
    const fresh = row && row.seen_at && Date.now() - new Date(row.seen_at).getTime() < 2 * 60000;
    if (fresh) {
      field.textContent = `Das Handy von ${s.name} ist verbunden. Die Karte erscheint dort in wenigen Sekunden.`;
      field.hidden = false;
    }
  } catch (err) {}
}

function eventAction(gi, bi) {
  const e = state.event;
  const button = eventEffect().groups[gi].buttons[bi];
  if (button.minigame) { drawMinigame(button.minigame, true); return; }
  if (e.done[gi] !== undefined) return;
  const before = state.players.map(s => s.coins);
  if (button.apply) button.apply();
  e.losses = e.losses || {}; // remembered for luckBringer and heartySoup
  state.players.forEach((s, i) => {
    const diff = s.coins - before[i];
    if (diff < 0) e.losses[i] = (e.losses[i] || 0) - diff;
  });
  if (button.winners) {
    minigameFinished(button.winners, before, button.participants);
    if (state.minigame && state.minigame.fromEvent) state.minigame.done = true;
  }
  e.done[gi] = bi;

  if (button.stay) { save(); render(); return; }

  if (!eventPending()) {
    show("overview");
  } else {
    save();
    render();
  }
}

function eventPending() {
  const e = state.event;
  if (!e || e.isPrivate) return false;
  return (eventEffect().groups || []).some((a, i) =>
    a.buttons.some(k => !k.minigame) && e.done[i] === undefined);
}

// Top n cards of the deck (top first) without drawing them; refills from below if needed.
function upcomingEvents(n) {
  const deck = state.eventDeck || [];
  if (deck.length < n) {
    const fresh = shuffle(playableEvents().filter(i => !deck.includes(i)));
    state.eventDeck = fresh.concat(deck);
  }
  return state.eventDeck.slice(-n).reverse();
}

function moveTopCardToBottom() {
  const index = state.eventDeck.pop();
  state.eventDeck.unshift(index);
}

Object.assign(SCREENS, {
  event: screenEvent,
  buyCard: screenBuyCard
});
