function screenEvent() {
  const e = state.event;
  const card = e && EVENTS[e.index];
  if (!card) return screenOverview();
  if (e.isPrivate) return screenPrivateEvent();

  const effect = eventEffect();
  const groups = (effect.groups || []).map((group, gi) => {
    const chosen = e.done[gi];
    const buttons = group.buttons.map((k, bi) => {
      if (chosen === bi) return `<button class="action chosen" disabled>✓ ${k.text}</button>`;
      return `<button class="action" onclick="eventAction(${gi}, ${bi})" ${chosen !== undefined || k.disabled ? "disabled" : ""}>${k.text}</button>`;
    }).join("");
    const title = group.title ? `<span class="label">${group.title}</span>` : "";
    return `<div class="action-group">${title}${group.row ? `<div class="action-row">${buttons}</div>` : buttons}</div>`;
  }).join("");
  const pick = effect.pick && pickHtml(effect.pick, e.picked || []);

  return `
    ${e.automatic
      ? `<p class="kicker">Die Zeit ist um! Ein Ereignis tritt ein …</p>`
      : `<p class="muted" style="text-align:center">Ereigniskarte · noch ${state.eventDeck.length} im Stapel</p>`}
    ${effect.who ? lineup("Wen trifft es?", effect.who) : ""}
    <article class="card drawn-card speakable">
      ${speakButton()}
      <div class="title">
        <span class="label">${card.category}</span>
        <div class="card-name">${card.title}</div>
      </div>
      <p class="narrative">${card.text}</p>
    </article>
    ${cardNotes(e.card)}
    ${pauseControls()}
    ${effect.note ? `<p class="note">${effect.note}</p>` : ""}
    ${effect.html || ""}
    ${pick || ""}
    ${groups ? `<div class="actions">${groups}</div>` : ""}
    ${eventPending() ? "" : `<button class="btn" onclick="show('overview')">Weiter</button>`}
  `;
}

// Players the table taps before the card's buttons appear (e.g. who is suspected).
function pickHtml(pick, picked) {
  return `
    <div class="action-group">
      <span class="label">${pick.title}</span>
      ${pick.players.map(i => `
        <button class="action toggle ${picked.includes(i) ? "chosen" : ""}" aria-pressed="${picked.includes(i)}" onclick="eventPick(${i})">${picked.includes(i) ? "✓ " : ""}${playerName(i)}</button>`).join("")}
    </div>
    <button class="btn" onclick="eventPickDone()" ${picked.length ? "" : "disabled"}>${pick.confirm}</button>`;
}

function eventPick(i) {
  const e = state.event;
  if (!e || e.pickDone) return;
  const picked = e.picked || [];
  e.picked = picked.includes(i) ? picked.filter(j => j !== i) : picked.concat(i);
  save();
  render();
}

function eventPickDone() {
  const e = state.event;
  if (!e || !(e.picked || []).length) return;
  e.pickDone = true;
  save();
  render();
}

// Played cards leave the game; only reshuffleEvents() brings them back, once none are left.
function remainingEvents() {
  const played = new Set(state.playedEvents || []);
  return playableEvents().filter(i => !played.has(i));
}

// Remaining cards that would change something right now (see EFFECTS_READY); the others wait in the deck.
function drawableEvents() { return remainingEvents().filter(eventReady); }

// Keeps the deck (top = last) equal to the remaining cards; cards added in the CMS go in at random positions.
function syncEventDeck() {
  const deck = Array.isArray(state.eventDeck) ? state.eventDeck : [];
  if (!Array.isArray(state.playedEvents)) { // game saved before cards were taken out
    state.playedEvents = deck.length ? playableEvents().filter(i => !deck.includes(i)) : [];
  }
  const remaining = remainingEvents();
  const kept = deck.filter(i => remaining.includes(i));
  const added = shuffle(remaining.filter(i => !kept.includes(i)));
  added.forEach(i => kept.splice(Math.floor(Math.random() * (kept.length + 1)), 0, i));
  if (added.some(i => EVENTS[i].effect === "jailerDrinks")) orderJailerCards(kept);
  state.eventDeck = kept;
  return kept;
}

// The jailer's rounds come in list order: they keep the random deck positions they were shuffled into,
// but the first round takes the position nearest the top.
function orderJailerCards(deck) {
  const slots = deck.map((index, k) => [index, k]).filter(([index]) => EVENTS[index].effect === "jailerDrinks").map(([, k]) => k);
  const cards = slots.map(k => deck[k]).sort((a, b) => jailerStage(b) - jailerStage(a));
  slots.forEach((k, n) => { deck[k] = cards[n]; });
}

// Top of the deck = end of the array; cards that are not ready yet are skipped and keep their place.
function topEvents(deck, n) {
  const ready = [];
  for (let k = deck.length - 1; k >= 0 && ready.length < n; k--) if (eventReady(deck[k])) ready.push(deck[k]);
  return ready;
}

function reshuffleEvents() {
  state.playedEvents = [];
  state.eventDeck = [];
  syncEventDeck();
  show("overview");
}

function drawEvent(automatic, fixedIndex) {
  const deck = syncEventDeck();
  const index = fixedIndex !== undefined ? fixedIndex : topEvents(deck, 1)[0];
  if (index === undefined || !EVENTS[index]) { show("overview"); return; }
  state.eventDeck = deck.filter(i => i !== index);
  state.playedEvents.push(index);

  resetTimer();
  cardDrawn("event");
  if (EVENTS[index].isPrivate) { privateEvent(index, automatic); return; }
  // a new card ends everything that lasted "until the next event"
  const effect = EVENTS[index].effect;
  state.lasting = null;
  const onDraw = EFFECTS_ON_DRAW[effect];
  const remembered = onDraw ? onDraw(index) : null;
  if (LASTING[effect]) state.lasting = { effect, title: EVENTS[index].title };
  state.lastWinnings = {};
  state.lastParticipants = [];

  state.event = Object.assign({
    index: index,
    automatic: Boolean(automatic),
    done: {},
    card: state.cardCount,
    random: Math.random(),
    snapshot: takeSnapshot()
  }, remembered || {});
  show("event");
}

// A private card goes to one player (preferably one with few so far) and read under "Geheim nachsehen" or on their own phone.
function privateEvent(index, automatic) {
  const player = privateCardTarget();
  const entry = givePrivateCard(index, player);
  state.event = { index, automatic: Boolean(automatic), isPrivate: true, player, entryId: entry.id, done: {}, card: state.cardCount, snapshot: takeSnapshot() };
  show("event");
}

function privateCardTarget() {
  const pool = inPlay();
  const counts = pool.map(i => (state.players[i].secrets || []).length);
  const fewest = Math.min(...counts);
  const candidates = pool.filter((_, k) => counts[k] === fewest);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Pinkelpause started right on a secret card for this player: the card goes to someone else.
function passPrivateCard() {
  const e = state.event;
  const s = state.players[e.player];
  const entry = (s.secrets || []).find(p => p.id === e.entryId);
  if (!entry) return;
  if (entry.kind === "instant" && entry.coins) addCoins([e.player], -entry.coins);
  s.secrets = s.secrets.filter(p => p !== entry);
  e.player = privateCardTarget();
  e.entryId = givePrivateCard(e.index, e.player).id;
}

function givePrivateCard(index, player) {
  const card = EVENTS[index];
  const s = state.players[player];
  const entry = {
    id: randomCode().slice(0, 8),
    title: card.title,
    text: card.text,
    kind: card.privateType,
    effect: card.effect,
    coins: card.privateCoins,
    drinking: card.drinking,
    status: { task: "open", keep: "kept" }[card.privateType] || "received",
    time: Date.now()
  };
  if (entry.kind === "instant" && entry.coins) addCoins([player], entry.coins);
  s.secrets = (s.secrets || []).concat(entry);
  return entry;
}

// What a secret card means for the player's coins, stated so nobody books them a second time.
// holder: set on the game master phone ("Nachsehen"), where hand cards are played (handCardControl adds the button).
function secretOutcome(p, holder) {
  const n = Math.abs(p.coins || 0);
  const coins = `${n} ${n === 1 ? "Münze" : "Münzen"}`;
  if (p.kind === "task") {
    if (p.status === "open") return `<p class="outcome outcome-open"><strong>Noch offen</strong>Schaffst du es, ${p.coins < 0 ? "verlierst du" : "bekommst du"} ${coins}. Sag dem Spielleiter Bescheid, sobald du es geschafft hast. Erst dann bucht die App die Münzen.</p>`;
    if (p.status === "done") return `<p class="outcome outcome-done"><strong>✓ Geschafft und verbucht</strong>Die App hat dir ${coins} ${p.coins < 0 ? "abgezogen" : "gutgeschrieben"}.${p.result ? ` ${p.result}` : ""}</p>`;
    return `<p class="outcome"><strong>Nicht geschafft</strong>Es gibt keine Münzen.</p>`;
  }
  if (p.kind === "keep") {
    if (p.status === "used") return `<p class="outcome outcome-done"><strong>✓ Eingesetzt</strong>${p.result || "Die Karte ist verbraucht."}</p>`;
    return `<p class="outcome outcome-open"><strong>Auf der Hand</strong>${holder !== undefined ? handCardHint(holder, p) : "Einsetzen kannst du sie am Spielleiter-Handy unter „Nachsehen“."}</p>`;
  }
  if (!p.coins) return "";
  return `<p class="outcome outcome-done"><strong>✓ Schon verbucht</strong>Die App hat dir ${coins} ${p.coins < 0 ? "abgezogen" : "gutgeschrieben"}. Du musst nichts weiter tun.</p>`;
}

// When the time is up: an event card or, by the share set in the settings, a minigame; only what is left can come.
function canDrawTimed() { return drawableEvents().length > 0 || remainingMinigames().length > 0; }

function drawTimedCard() {
  const share = settings.minigameShare ?? RULES.minigameShareDefault;
  const minigames = remainingMinigames().length > 0;
  if (minigames && (!drawableEvents().length || Math.random() < share)) {
    resetTimer();
    drawMinigame();
    state.minigame.automatic = true;
    save();
    render();
  } else {
    drawEvent(true);
  }
}

// A player buys a secret event card: coins go to the bank, the card goes to the secret view.
function privateCards() { return playableEvents().filter(i => EVENTS[i].isPrivate && eventReady(i)); }
function privateCardCost() { return lasting("secretSale") ? RULES.privateCardCostSale : RULES.privateCardCost; }

function startBuyCard() {
  state.buyCard = { player: null };
  show("buyCard");
}

function screenBuyCard() {
  const b = state.buyCard || { player: null };
  const cost = privateCardCost();
  const heading = `<div class="heading"><span class="eyebrow">Geheimkarte</span><h2>Wer kauft eine geheime Karte?</h2></div>`;
  if (!privateCards().length) {
    return `${heading}<p class="note">In diesem Abenteuer gibt es noch keine geheimen Ereigniskarten. Im CMS lassen sie sich mit der Sichtbarkeit „geheim“ anlegen.</p>`;
  }
  if (b.player === null || !state.players[b.player]) {
    return `
      ${heading}
      <p class="muted">Eine geheime Ereigniskarte kostet ${lasting("secretSale") ? `gerade nur ${coinsText(cost)} (${state.lasting.title})` : coinsText(cost)}. Nur wer sie kauft, erfährt, was darauf steht.</p>
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
  const cost = privateCardCost();
  const cards = privateCards();
  if (!s || !cards.length || s.coins < cost) return;
  const had = new Set((s.secrets || []).map(p => p.title));
  const unseen = cards.filter(k => !had.has(EVENTS[k].title));
  const pool = unseen.length ? unseen : cards;
  addCoins([i], -cost);
  if (state.tip) { addCoins([state.tip.player], 1); state.tip.earned++; } // Trinkgeld
  givePrivateCard(pool[Math.floor(Math.random() * pool.length)], i);
  state.buyCard = null;
  startMyRole(i);
}

// Tasks with an effect ask the purse for one more player first (taskPick), e.g. who noticed it first.
function resolveTask(i, id, success, other) {
  const p = (state.players[i].secrets || []).find(x => x.id === id);
  if (!p || p.status !== "open") return;
  const effect = success && TASK_EFFECTS[p.effect];
  if (effect && other === undefined) { taskPick = { i, id }; renderFrame(); return; }
  taskPick = null;
  p.status = success ? "done" : "missed";
  if (success && p.coins) addCoins([i], p.coins);
  if (effect) p.result = effect.apply(i, p, other);
  if (effect && effect.after) { effect.after(i, other); return; }
  save();
  renderFrame();
  render();
}

// Task effects, keyed like CATALOG.privateEffects.task: pick = who else is involved, apply books it and returns
// the line kept on the card, after may open a screen.
const TASK_EFFECTS = {
  witness: {
    pick: () => "Wer hat es zuerst bemerkt? Er bekommt dieselben Münzen.",
    players: i => state.players.map((_, j) => j).filter(j => j !== i),
    apply: (i, p, j) => { addCoins([j], p.coins); return `${playerName(j)} hat es zuerst bemerkt und ${coinsText(p.coins)} bekommen.`; }
  },
  keyDeal: {
    pick: () => `Wer hat ${coinsText(RULES.keyDealPrice)} gezahlt, um die Schlüssel zu sehen?`,
    players: i => state.players.map((_, j) => j).filter(j => j !== i && state.players[j].coins >= RULES.keyDealPrice),
    apply: (i, p, j) => { transfer(j, i, RULES.keyDealPrice); return `${playerName(j)} hat dir ${coinsText(RULES.keyDealPrice)} gezahlt und deine Schlüssel gesehen.`; },
    after: (i, j) => startKeyGlimpse(i, j)
  }
};

function taskPickHtml() {
  const t = taskPick;
  const p = t && state.players[t.i] && (state.players[t.i].secrets || []).find(x => x.id === t.id);
  const effect = p && TASK_EFFECTS[p.effect];
  if (!effect) return "";
  const players = effect.players(t.i);
  return `
    <span class="label">${effect.pick()}</span>
    ${players.length ? players.map(j => `<button class="action" onclick="resolveTask(${t.i}, '${p.id}', true, ${j})">${playerName(j)}</button>`).join("")
      : `<p class="muted">Gerade kommt dafür niemand infrage.</p>`}
    <button class="link-button" onclick="taskPick = null; renderFrame()">Abbrechen</button>`;
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
    ${cardNotes(e.card)}
    ${pauseControls()}
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
  if (e.done[gi] !== undefined || button.disabled) return;
  const before = state.players.map(s => s.coins);
  if (button.apply) button.apply();
  noteLosses(before, "event", EVENTS[e.index].title);
  e.losses = e.losses || {}; // remembered for luckBringer and heartySoup
  state.players.forEach((s, i) => {
    const diff = s.coins - before[i];
    if (diff < 0) e.losses[i] = (e.losses[i] || 0) - diff;
  });
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
  const effect = eventEffect();
  return Boolean(effect.pick) || (effect.groups || []).some((a, i) => e.done[i] === undefined);
}

// Next n cards that would be drawn (top first) without drawing them; fewer if fewer are left.
function upcomingEvents(n) {
  return topEvents(syncEventDeck(), n);
}

function moveTopCardToBottom() {
  const index = topEvents(syncEventDeck(), 1)[0];
  if (index === undefined) return;
  state.eventDeck = [index].concat(state.eventDeck.filter(i => i !== index));
}

Object.assign(SCREENS, {
  event: screenEvent,
  buyCard: screenBuyCard
});
