// Event card mechanics, keyed like CATALOG.effects. A handler receives a toolkit k
// (k.all = players the card applies to, k.b = coin snapshot at draw time {all, most, fewest, revealed, hidden}, k.allEqual, k.e)
// and returns { who, note, groups: [{ title, buttons: [{ text, apply, stay? }] }] }.
// who: [{ label, players }] names the players the card is about (shown prominently). Exactly one button per group is pressed.
const EFFECTS = {};

// Run when the card is drawn (effects that last until the next event card, or change the game at once).
// May return fields to remember on state.event.
const EFFECTS_ON_DRAW = {
  seers: () => { state.seersNight = true; },
  looseTongues: () => { state.freeGuesses = true; },
  jailerDrinks: () => {
    const before = keyPrice();
    state.jailerDrinks = (state.jailerDrinks || 0) + 1;
    return { keyPrice: [before, keyPrice()] };
  }
};

// A card whose effect needs a state the game has not reached yet (no role guessed, all coins equal, the jailer's
// earlier rounds) stays in the deck but is skipped until this returns true, so it never comes as a dud.
// New effects bound to a game state belong here too.
const EFFECTS_READY = {
  exposed: () => inPlay().some(i => state.players[i].revealed),
  disguise: () => inPlay().some(i => !state.players[i].revealed),
  envy: () => new Set(inPlay().map(i => state.players[i].coins)).size > 1,
  jailerDrinks: index => keysGoal() && keyPrice() > RULES.keyPrice.min && jailerStage(index) === (state.jailerDrinks || 0)
};

function eventReady(index) {
  const card = EVENTS[index];
  if (!card || card.isPrivate) return Boolean(card);
  const ready = EFFECTS_READY[card.effect];
  return !ready || ready(index);
}

function eventEffect() {
  const e = state.event;
  const b = e.snapshot;
  const all = b.all || state.players.map((_, i) => i);
  const k = {
    e, b, all,
    allEqual: b.most.length === all.length
  };
  const handler = EFFECTS[EVENTS[e.index].effect];
  return handler ? handler(k) : {};
}

// Label for the richest or poorest players; says so when coins are tied.
function coinGroupLabel(kind, list, all) {
  if (list.length > 1 && list.length === all.length) return "Gleichstand: alle haben gleich viele Münzen";
  const base = kind === "most" ? "Die meisten Münzen" : "Die wenigsten Münzen";
  return list.length > 1 ? `${base} (Gleichstand)` : base;
}
const everyone = all => [{ label: all.length === state.players.length ? "Alle" : "Alle, die mitspielen", players: all }];

EFFECTS.calm = () => ({});

EFFECTS.goldRain = ({ all }) =>
  ({ who: everyone(all), groups: [{ buttons: [{ text: "Alle erhalten 1 Münze", apply: () => addCoins(all, 1) }] }] });

EFFECTS.tax = ({ all }) =>
  ({ who: everyone(all), groups: [{ buttons: [{ text: "Alle zahlen 1 Münze", apply: () => addCoins(all, -1) }] }] });

EFFECTS.favor = ({ b, all }) => ({ who: [{ label: coinGroupLabel("fewest", b.fewest, all), players: b.fewest }], groups: [{ buttons: [{
  text: `${playerNames(b.fewest)} ${verb(b.fewest, "erhält", "erhalten je")} 3 Münzen`,
  apply: () => addCoins(b.fewest, 3) }] }] });

EFFECTS.pickpocket = ({ b, all }) => ({ who: [{ label: coinGroupLabel("most", b.most, all), players: b.most }], groups: [{ buttons: [{
  text: `${playerNames(b.most)} ${verb(b.most, "verliert", "verlieren je")} 2 Münzen`,
  apply: () => addCoins(b.most, -2) }] }] });

EFFECTS.envy = ({ b, allEqual }) => {
  if (allEqual) return { note: "Alle haben gleich viele Münzen. Nichts geschieht." };
  return { who: [{ label: "Geben ab: die meisten Münzen", players: b.most }, { label: "Bekommen: die wenigsten Münzen", players: b.fewest }], groups: [{ buttons: [{
    text: `${playerNames(b.most)} ${verb(b.most, "gibt", "geben je")} 2 Münzen an ${playerNames(b.fewest)}`,
    apply: () => { addCoins(b.most, -2); addCoins(b.fewest, 2); } }] }] };
};

EFFECTS.exposed = ({ b }) => {
  if (!b.revealed.length) return { note: "Noch wurde niemand entlarvt. Nichts geschieht." };
  return { who: [{ label: "Schon erraten", players: b.revealed }], groups: [{ buttons: [{
    text: `${playerNames(b.revealed)} ${verb(b.revealed, "verliert", "verlieren je")} 1 Münze`,
    apply: () => addCoins(b.revealed, -1) }] }] };
};

EFFECTS.disguise = ({ b }) => {
  if (!b.hidden.length) return { note: "Alle Rollen sind schon erraten. Nichts geschieht." };
  return { who: [{ label: "Noch nicht erraten", players: b.hidden }], groups: [{ buttons: [{
    text: `${playerNames(b.hidden)} ${verb(b.hidden, "erhält", "erhalten je")} 1 Münze`,
    apply: () => addCoins(b.hidden, 1) }] }] };
};

EFFECTS.fate = ({ e, all }) => {
  if (e.flips) {
    const list = Array.isArray(e.flips[0]) ? e.flips : e.flips.map((w, i) => [i, w]); // older saves: one entry per player
    return { who: everyone(all), note: list.map(([i, w]) => `${playerName(i)}: ${w} (${w === "Kopf" ? "+1" : "−1"})`).join("<br>") };
  }
  return { who: everyone(all), groups: [{ buttons: [{ text: "Münzen für alle werfen", stay: true, apply: () => {
    e.flips = all.map(i => [i, Math.random() < 0.5 ? "Kopf" : "Zahl"]);
    e.flips.forEach(([i, w]) => addCoins([i], w === "Kopf" ? 1 : -1));
  } }] }] };
};

// The app draws one player; e.random is fixed when the card is drawn, so the choice survives a reload.
function luckyOne({ e, all }) { return all[Math.floor((e.random ?? 0) * all.length) % all.length]; }

EFFECTS.lottery = k => {
  const i = luckyOne(k);
  return { who: [{ label: "Das Los fällt auf", players: [i] }], groups: [{ buttons: [{
    text: `${playerName(i)} erhält ${coinsText(RULES.lotteryWin)}`, apply: () => addCoins([i], RULES.lotteryWin) }] }] };
};

EFFECTS.misfortune = k => {
  const i = luckyOne(k);
  return { who: [{ label: "Das Los fällt auf", players: [i] }], groups: [{ buttons: [{
    text: `${playerName(i)} verliert ${coinsText(RULES.misfortuneLoss)}`, apply: () => addCoins([i], -RULES.misfortuneLoss) }] }] };
};

EFFECTS.oracle = ({ b, all }) => ({ who: [{ label: coinGroupLabel("most", b.most, all), players: b.most }], groups: b.most.map(i => ({ title: `${playerName(i)}`, buttons: [
  { text: `${playerName(i)} verrät ein Merkmal`, apply: () => {} },
  { text: `${playerName(i)} schweigt und zahlt 2 Münzen`, apply: () => addCoins([i], -2) }
] })) });

EFFECTS.crossroads = ({ b, all }) => ({ who: [{ label: `Entscheidet: ${coinGroupLabel("fewest", b.fewest, all).replace(/^Die/, "die")}`, players: b.fewest }], groups: [{
  title: `${playerNames(b.fewest)} ${verb(b.fewest, "entscheidet", "entscheiden gemeinsam")}`,
  buttons: [
    { text: "Alle erhalten 1 Münze", apply: () => addCoins(all, 1) },
    { text: `${playerNames(b.fewest)} ${verb(b.fewest, "erhält", "erhalten je")} 2 Münzen`, apply: () => addCoins(b.fewest, 2) }
  ] }] });

EFFECTS.generosity = ({ b, all }) => ({ who: [{ label: `Entscheidet: ${coinGroupLabel("most", b.most, all).replace(/^Die/, "die")}`, players: b.most }], groups: b.most.map(i => ({ title: `${playerName(i)} entscheidet`, buttons: [
  ...all.filter(j => j !== i).map(j => ({ text: `${playerName(i)} schenkt ${playerName(j)} 2 Münzen`, apply: () => transfer(i, j, 2) })),
  { text: `${playerName(i)} zahlt 3 Münzen an die Spielbank`, apply: () => addCoins([i], -3) }
] })) });

EFFECTS.looseTongues = ({ all }) =>
  ({ who: everyone(all), note: "Die App hat es sich gemerkt: Bis zum nächsten Ereignis kostet Raten keine Münze." });

EFFECTS.jailerDrinks = ({ e }) => {
  const [before, after] = e.keyPrice || [keyPrice() + 1, keyPrice()];
  return { note: `Der Kerkermeister ist jetzt ${jailerMood(after)}. Neuer Schlüsselpreis: ${coinsText(after)} statt ${before}.` };
};

EFFECTS.seers = ({ all }) =>
  ({ who: everyone(all), note: `Die App hat es sich gemerkt: Bis zum nächsten Ereignis bringt ein Treffer beim Raten ${RULES.hitRewardSeers} Münzen.` });
