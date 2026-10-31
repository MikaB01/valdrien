let settings = {
  minutes: RULES.eventMinutesDefault,
  timerMode: "fixed", // or "random": a new random interval after every event card
  randomMin: RULES.randomMinutesDefault[0],
  randomMax: RULES.randomMinutesDefault[1],
  showTimer: true,
  speech: true,
  music: true,
  musicVolume: 0.5,
  theme: "auto", // "auto" follows the phone, "light" or "dark" forces it
  minigameShare: RULES.minigameShareDefault,
  sound: true, // short reward sound when the time is up
  roles: true, // deal secret roles; without them guessing, abilities, tasks and role events are left out
  drinking: false, // drinking game: event cards marked "drinking" join the deck (applies at once, also in a running game)
  rerolls: RULES.rerollsDefault // how often each player may draw a new role during the handover
};
try { Object.assign(settings, JSON.parse(localStorage.getItem("valdrien-settings") || "{}")); } catch (e) {}
function clampMinutes(m) { return Math.min(RULES.eventMinuteRange[1], Math.max(RULES.eventMinuteRange[0], Math.round(m))); }
function minutes() { return clampMinutes(Number(settings.minutes) || RULES.eventMinutesDefault); }
function randomRange() {
  const lo = clampMinutes(Number(settings.randomMin) || RULES.randomMinutesDefault[0]);
  const hi = clampMinutes(Number(settings.randomMax) || RULES.randomMinutesDefault[1]);
  return [Math.min(lo, hi), Math.max(lo, hi)];
}
function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === "light" || settings.theme === "dark") root.dataset.theme = settings.theme;
  else delete root.dataset.theme;
}
applyTheme();
function saveSettings() {
  try { localStorage.setItem("valdrien-settings", JSON.stringify(settings)); } catch (e) {}
}
function setSetting(key, value) {
  settings[key] = value;
  saveSettings();
  if (key === "theme") applyTheme();
  render();
}

function drinkingOn() { return settings.drinking === true; }

function rerollSetting() {
  const n = Math.round(Number(settings.rerolls));
  return Number.isFinite(n) ? Math.max(0, Math.min(Math.max(...RULES.rerollOptions), n)) : RULES.rerollsDefault;
}

let confirmFinish = false;
let confirmRedraw = false;
let confirmReroll = false;
let taskPick = null; // { i, id }: a task with an effect waits for the other player in the purse
let sheet = null;

// The whole game state; saved to localStorage after every change.
// players[]: { name, role (index into ROLES, null without roles), coins, revealed, abilityUsed, taskDone, accessCode, secrets[], rerolls }
// roles: false for a game without roles (fixed when the game is dealt); rerollLimit, discardedRoles: drawing new roles at the handover.
// Further fields are added during play: adventure, running, timerEnd, eventDeck (top = last), playedEvents, playedMinigames, event, minigame,
// timerPaused, timerDuration, timerWindow, guess, ability, peekRole, lasting (effect until the next event card), tableRules (until the next
// minigame), winBonus, lastWinnings, lastWinningsCard, lastParticipants, slots, session, handCard, keyGlimpse, recentLoss,
// and for the newer abilities and the keys goal: players[].keys, buyKey, escaped, tip, pause, curiosity, cardCount.
// players[].secrets[]: { id, title, text, kind (instant|task|keep), effect, coins, drinking, status, result, seen, time }
let state = {
  screen: "start",
  names: ["Anna", "Ben", "Clara", "David"],
  players: [],
  current: 0,
  cardVisible: false
};

function save() {
  try { localStorage.setItem("valdrien-game", JSON.stringify(state)); } catch (e) {}
  syncSeats();
}
function load() {
  try {
    const saved = localStorage.getItem("valdrien-game");
    if (saved) state = JSON.parse(saved);
  } catch (e) {}
  // games saved while event cards still started minigames
  if (state.minigame && state.minigame.fromEvent) state.minigame = null;
  // games saved before lasting effects were kept in state.lasting
  if (state.seersNight) state.lasting = { effect: "seers", title: "Die Nacht der Seher" };
  else if (state.freeGuesses) state.lasting = { effect: "looseTongues", title: "Lose Zungen" };
  delete state.seersNight;
  delete state.freeGuesses;
  // games saved while only one rule could last until the next minigame
  if (state.tableRule) state.tableRules = [state.tableRule];
  delete state.tableRule;
  selectAdventureData(state.adventure);
}

// Players event cards apply to: everyone except a player on "Pinkelpause" (state.pause).
function inPlay() {
  const all = state.players.map((_, i) => i);
  const away = state.pause ? state.pause.player : -1;
  const list = all.filter(i => i !== away);
  return list.length ? list : all;
}

function takeSnapshot() {
  const coins = state.players.map(s => s.coins);
  const all = inPlay();
  const max = Math.max(...all.map(i => coins[i]));
  const min = Math.min(...all.map(i => coins[i]));
  return {
    all,
    most: all.filter(i => coins[i] === max),
    fewest: all.filter(i => coins[i] === min),
    revealed: all.filter(i => state.players[i].revealed),
    hidden: all.filter(i => !state.players[i].revealed)
  };
}

// Settings change only the next game; a running game keeps what it was dealt with.
function rolesOn() { return state.roles !== false; }
function roleOf(i) { return rolesOn() && state.players[i] ? ROLES[state.players[i].role] || null : null; }

function playerName(i) { return escapeName(state.players[i].name); }
function playerNames(list) {
  const n = list.map(playerName);
  return n.length <= 1 ? n.join("") : n.slice(0, -1).join(", ") + " und " + n[n.length - 1];
}
function verb(list, singular, plural) { return list.length === 1 ? singular : plural; }

function addCoins(list, amount) {
  list.forEach(i => { state.players[i].coins = Math.max(0, state.players[i].coins + amount); });
}

function transfer(from, to, n) {
  const amount = Math.min(n, state.players[from].coins);
  state.players[from].coins -= amount;
  state.players[to].coins += amount;
  return amount;
}

// Coins a player lost through an event card, a minigame, another player's ability or hand card; never what a player
// spends himself (keys, guesses, secret cards). Hand cards (Freibrief, Sündenbock, …) act on the last loss until the
// next card is drawn. state.recentLoss[i] = { amount, source: "event"|"minigame"|"ability"|"card", title, card }
function noteLosses(before, source, title, except) {
  const card = state.cardCount || 0;
  state.players.forEach((s, i) => {
    const lost = before[i] - s.coins;
    if (lost <= 0 || i === except) return;
    state.recentLoss = state.recentLoss || {};
    const r = state.recentLoss[i];
    const same = r && r.card === card && r.source === source && r.title === title;
    state.recentLoss[i] = { amount: (same ? r.amount : 0) + lost, source, title, card };
  });
}
function recentLoss(i) {
  const r = (state.recentLoss || {})[i];
  return r && r.card === (state.cardCount || 0) ? r : null;
}
function clearLoss(i) { if (state.recentLoss) delete state.recentLoss[i]; }

// The gain of the minigame just won (state.lastWinnings), until the next card is drawn.
function recentWin(i) {
  return state.lastWinningsCard === (state.cardCount || 0) ? (state.lastWinnings || {})[i] || 0 : 0;
}
