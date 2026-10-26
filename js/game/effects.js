// Event card mechanics, keyed like CATALOG.effects. A handler receives a toolkit k
// (k.all, k.b = coin snapshot at draw time {most, fewest, revealed, hidden}, k.allEqual, k.e, k.winnerChoice)
// and returns { note, groups: [{ title, buttons: [{ text, apply, winners?, participants?, stay? } | { minigame: category }] }] }.
// Exactly one button per group is pressed.
const EFFECTS = {};

// Effects that last until the next event card.
const EFFECTS_ON_DRAW = {
  seers: () => { state.seersNight = true; },
  looseTongues: () => { state.freeGuesses = true; }
};

function eventEffect() {
  const e = state.event;
  const b = e.snapshot;
  const all = state.players.map((_, i) => i);
  const k = {
    e, b, all,
    allEqual: b.most.length === all.length,
    winnerChoice: (list, amount) => ({
      title: "Wer hat gewonnen?",
      buttons: list.map(i => ({ text: `${playerName(i)} (+${amount})`, apply: () => addCoins([i], amount), winners: [i] }))
    })
  };
  const handler = EFFECTS[EVENTS[e.index].effect];
  return handler ? handler(k) : {};
}

EFFECTS.calm = () => ({});

EFFECTS.goldRain = ({ all }) =>
  ({ groups: [{ buttons: [{ text: "Alle erhalten 1 Münze", apply: () => addCoins(all, 1) }] }] });

EFFECTS.tax = ({ all }) =>
  ({ groups: [{ buttons: [{ text: "Alle zahlen 1 Münze", apply: () => addCoins(all, -1) }] }] });

EFFECTS.favor = ({ b }) => ({ groups: [{ buttons: [{
  text: `${playerNames(b.fewest)} ${verb(b.fewest, "erhält", "erhalten je")} 3 Münzen`,
  apply: () => addCoins(b.fewest, 3) }] }] });

EFFECTS.pickpocket = ({ b }) => ({ groups: [{ buttons: [{
  text: `${playerNames(b.most)} ${verb(b.most, "verliert", "verlieren je")} 2 Münzen`,
  apply: () => addCoins(b.most, -2) }] }] });

EFFECTS.envy = ({ b, allEqual }) => {
  if (allEqual) return { note: "Alle haben gleich viele Münzen. Nichts geschieht." };
  return { groups: [{ buttons: [{
    text: `${playerNames(b.most)} ${verb(b.most, "gibt", "geben je")} 2 Münzen an ${playerNames(b.fewest)}`,
    apply: () => { addCoins(b.most, -2); addCoins(b.fewest, 2); } }] }] };
};

EFFECTS.exposed = ({ b }) => {
  if (!b.revealed.length) return { note: "Noch wurde niemand entlarvt. Nichts geschieht." };
  return { groups: [{ buttons: [{
    text: `${playerNames(b.revealed)} ${verb(b.revealed, "verliert", "verlieren je")} 1 Münze`,
    apply: () => addCoins(b.revealed, -1) }] }] };
};

EFFECTS.disguise = ({ b }) => {
  if (!b.hidden.length) return { note: "Alle Rollen sind schon erraten. Nichts geschieht." };
  return { groups: [{ buttons: [{
    text: `${playerNames(b.hidden)} ${verb(b.hidden, "erhält", "erhalten je")} 1 Münze`,
    apply: () => addCoins(b.hidden, 1) }] }] };
};

EFFECTS.fate = ({ e, all }) => {
  if (e.flips) {
    return { note: e.flips.map((w, i) => `${playerName(i)}: ${w} (${w === "Kopf" ? "+1" : "−1"})`).join("<br>") };
  }
  return { groups: [{ buttons: [{ text: "Münzen für alle werfen", stay: true, apply: () => {
    e.flips = all.map(() => Math.random() < 0.5 ? "Kopf" : "Zahl");
    e.flips.forEach((w, i) => addCoins([i], w === "Kopf" ? 1 : -1));
  } }] }] };
};

EFFECTS.duel = ({ b, all }) => {
  const participants = all.filter(i => b.most.includes(i) || b.fewest.includes(i));
  const kind = participants.length === 2 ? "duel" : "all";
  return {
    note: `Es treten an: ${playerNames(participants)}`,
    groups: [
      { buttons: [{ minigame: kind }] },
      { title: "Wer hat gewonnen?", buttons: participants.map(i => ({
          text: `${playerName(i)} gewinnt und erhält von ${verb(participants.slice(1), "dem Verlierer", "jedem Verlierer")} 2 Münzen`,
          apply: () => duelWin(i, participants), winners: [i], participants: participants })) }
    ]
  };
};

EFFECTS.contest = ({ e, all, winnerChoice }) => {
  const reward = e.minigameIndex !== null ? MINIGAMES[e.minigameIndex].winner * 2 : 4;
  return { groups: [{ buttons: [{ minigame: "all" }] }, winnerChoice(all, reward)] };
};

EFFECTS.camps = ({ b, all, winnerChoice }) => {
  if (b.revealed.length && b.hidden.length) {
    return { groups: [
      { buttons: [{ minigame: "team" }] },
      { title: "Welches Team hat gewonnen?", buttons: [
        { text: `Die Entdeckten: ${playerNames(b.revealed)} (je +1)`, apply: () => addCoins(b.revealed, 1), winners: b.revealed },
        { text: `Die Unentdeckten: ${playerNames(b.hidden)} (je +1)`, apply: () => addCoins(b.hidden, 1), winners: b.hidden }
      ] }
    ] };
  }
  return {
    note: "Es gibt nur ein Lager. Darum heißt es: alle gegen alle!",
    groups: [{ buttons: [{ minigame: "all" }] }, winnerChoice(all, 2)]
  };
};

EFFECTS.purse = ({ b }) => ({ groups: [
  { buttons: [{ minigame: "duel" }] },
  ...b.most.map(i => ({ title: `${playerName(i)}`, buttons: [
    { text: `${playerName(i)} gewinnt das Duell und behält alles`, apply: () => {}, winners: [i] },
    { text: `${playerName(i)} verliert 2 Münzen`, apply: () => addCoins([i], -2), winners: [] }
  ] }))
] });

EFFECTS.stranger = ({ b, all, allEqual }) => {
  if (allEqual) return { note: "Alle haben gleich viele Münzen. Der Fremde findet keinen würdigen Gegner und trinkt still sein Bier. Nichts geschieht." };
  const group = all.filter(i => !b.most.includes(i));
  return {
    note: `Allein gegen alle: ${playerNames(b.most)}`,
    groups: [
      { buttons: [{ minigame: "oneVsAll" }] },
      { title: "Wer hat gewonnen?", buttons: [
        { text: `${playerNames(b.most)} ${verb(b.most, "gewinnt (+3)", "gewinnen (je +3)")}`,
          apply: () => addCoins(b.most, 3), winners: b.most },
        { text: "Die Gruppe gewinnt (je +1)", apply: () => addCoins(group, 1), winners: group }
      ] }
    ]
  };
};

EFFECTS.oracle = ({ b }) => ({ groups: b.most.map(i => ({ title: `${playerName(i)}`, buttons: [
  { text: `${playerName(i)} verrät ein Merkmal`, apply: () => {} },
  { text: `${playerName(i)} schweigt und zahlt 2 Münzen`, apply: () => addCoins([i], -2) }
] })) });

EFFECTS.crossroads = ({ b, all }) => ({ groups: [{
  title: `${playerNames(b.fewest)} ${verb(b.fewest, "entscheidet", "entscheiden gemeinsam")}`,
  buttons: [
    { text: "Alle erhalten 1 Münze", apply: () => addCoins(all, 1) },
    { text: `${playerNames(b.fewest)} ${verb(b.fewest, "erhält", "erhalten je")} 2 Münzen`, apply: () => addCoins(b.fewest, 2) }
  ] }] });

EFFECTS.generosity = ({ b, all }) => ({ groups: b.most.map(i => ({ title: `${playerName(i)} entscheidet`, buttons: [
  ...all.filter(j => j !== i).map(j => ({ text: `${playerName(i)} schenkt ${playerName(j)} 2 Münzen`, apply: () => transfer(i, j, 2) })),
  { text: `${playerName(i)} zahlt 3 Münzen an die Spielbank`, apply: () => addCoins([i], -3) }
] })) });

EFFECTS.looseTongues = () =>
  ({ note: "Die App hat es sich gemerkt: Bis zum nächsten Ereignis kostet Raten keine Münze." });

EFFECTS.seers = () =>
  ({ note: `Die App hat es sich gemerkt: Bis zum nächsten Ereignis bringt ein Treffer beim Raten ${RULES.hitRewardSeers} Münzen.` });
