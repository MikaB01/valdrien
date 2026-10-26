let settings = { minutes: RULES.eventMinutesDefault };
try { Object.assign(settings, JSON.parse(localStorage.getItem("valdrien-settings") || "{}")); } catch (e) {}
function minutes() { return settings.minutes || RULES.eventMinutesDefault; }
function setSetting(key, value) {
  settings[key] = value;
  try { localStorage.setItem("valdrien-settings", JSON.stringify(settings)); } catch (e) {}
  render();
}

let confirmFinish = false;
let correctionsOpen = false;
let sheet = null;

// The whole game state; saved to localStorage after every change.
// players[]: { name, role (index into ROLES), coins, revealed, abilityUsed, taskDone, accessCode, secrets[] }
// Further fields are added during play: adventure, running, timerEnd, eventDeck (top = last), event, minigame,
// guess, ability, peekRole, seersNight, freeGuesses, winBonus, lastWinnings, lastParticipants, slots, session.
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
  selectAdventureData(state.adventure);
}

function takeSnapshot() {
  const coins = state.players.map(s => s.coins);
  const max = Math.max(...coins);
  const min = Math.min(...coins);
  const all = state.players.map((_, i) => i);
  return {
    most: all.filter(i => coins[i] === max),
    fewest: all.filter(i => coins[i] === min),
    revealed: all.filter(i => state.players[i].revealed),
    hidden: all.filter(i => !state.players[i].revealed)
  };
}

function playerName(i) { return escapeName(state.players[i].name); }
function playerNames(list) {
  const n = list.map(playerName);
  return n.length <= 1 ? n.join("") : n.slice(0, -1).join(", ") + " und " + n[n.length - 1];
}
function verb(list, singular, plural) { return list.length === 1 ? singular : plural; }

function addCoins(list, amount) {
  list.forEach(i => { state.players[i].coins = Math.max(0, state.players[i].coins + amount); });
}

function duelWin(winner, participants) {
  participants.forEach(i => {
    if (i === winner) return;
    const payment = Math.min(2, state.players[i].coins);
    state.players[i].coins -= payment;
    state.players[winner].coins += payment;
  });
}

function transfer(from, to, n) {
  const amount = Math.min(n, state.players[from].coins);
  state.players[from].coins -= amount;
  state.players[to].coins += amount;
}
