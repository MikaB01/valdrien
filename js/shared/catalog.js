// Mechanics known to the game; shared by game and CMS. Labels are shown in the CMS (German).
// Adding a mechanic: add it here, then implement it in js/game/abilities.js or js/game/effects.js.
const CATALOG = {
  // minigame categories with their reward fields [key, CMS label]
  categories: {
    duel:     { name: "Duell (1 gegen 1)", fields: [["winner", "Sieger erhält"], ["loser", "Verlierer erhält (z. B. −1)"]] },
    all:      { name: "Alle gegen alle", fields: [["winner", "Sieger erhält"], ["judge", "Richter erhält (leer lassen, wenn es keinen Richter gibt)"]] },
    oneVsAll: { name: "Einer gegen alle", fields: [["solo", "Einzelner gewinnt: erhält"], ["group", "Gruppe gewinnt: jeder erhält"], ["fail", "Einzelner scheitert: erhält (z. B. −1)"]] },
    team:     { name: "Team gegen Team", fields: [["team", "Siegerteam: jeder erhält"]] },
    uneven:   { name: "1 gegen 2", fields: [["single", "Einzelner gewinnt: erhält"], ["pair", "Paar gewinnt: jeder erhält"]], names: [["singleName", "Name des Einzelnen (z. B. Riese)"], ["pairName", "Name des Paars (z. B. Zwerge)"]] }
  },

  // Other ways to score a minigame (field "scoring"); "" = the category's own reward fields above.
  // Payments between players: if the payer has too little, the bank adds the rest.
  scorings: {
    duel: {
      fromLoser: { name: "Verlierer zahlt dem Sieger", fields: [["fromLoser", "Verlierer zahlt dem Sieger"]] }
    },
    all: {
      winners:          { name: "Ein oder mehrere Sieger", fields: [["winner", "Jeder Sieger erhält"]] },
      shown:            { name: "Sieger erhält so viele Münzen, wie er zeigt", fields: [["maxShown", "Höchste Zahl, die man zeigen kann"]] },
      worstToBest:      { name: "Wer am weitesten daneben liegt, zahlt dem Besten", fields: [["worstToBest", "Betrag"]] },
      firstOutToWinner: { name: "Wer zuerst raus ist, zahlt dem Sieger", fields: [["firstOutToWinner", "Betrag"]] },
      perPoint:         { name: "Punkte über mehrere Runden, Münzen je Punkt", fields: [["perPoint", "Münzen je Punkt"], ["rounds", "Runden"]] },
      none:             { name: "Keine Münzen (z. B. Trinkspiel)", fields: [] }
    },
    oneVsAll: {
      perCorrect: { name: "Jeder, der richtig liegt, erhält Münzen; keiner richtig: der Einzelne", fields: [["perCorrect", "Jeder Richtige erhält"], ["solo", "Keiner richtig: Einzelner erhält"]] },
      none:       { name: "Keine Münzen (z. B. Trinkspiel)", fields: [] }
    }
  },

  // What the app does while a minigame is played (field "tool"), with the settings each one needs.
  minigameTools: {
    "":         { name: "Nichts weiter", fields: [] },
    untilTimer: { name: "Läuft, bis die Uhr abläuft (dann gewinnen alle, die noch dabei sind)", fields: [] },
    countdown:  { name: "Countdown mit Ton", fields: [["seconds", "Sekunden"]] },
    hourglass:  { name: "Blinde Stoppuhr reihum, die App lost die Zielzeit aus", fields: [["min", "Kürzeste Zielzeit (Sekunden)"], ["max", "Längste Zielzeit (Sekunden)"]] },
    length:     { name: "Die App lost eine Länge aus", fields: [["min", "Kürzeste Länge (cm)"], ["max", "Längste Länge (cm)"]] },
    sketch:     { name: "Reihum malen, danach alle Bilder zeigen", fields: [["seconds", "Sekunden zum Malen"]], prompts: "Begriffe zum Malen, einer pro Zeile" },
    vote:       { name: "Reihum geheim abstimmen, die App zeigt nur die Stimmenzahl", fields: [["rounds", "Runden"]], prompts: "Fragen, eine pro Zeile" }
  },

  // One against all: who plays alone (field "alone"). Duels: the app draws the challenger, he picks his opponent.
  alone: {
    "":     "Wer die meisten Münzen hat",
    fewest: "Wer die wenigsten Münzen hat",
    vote:   "Die Gruppe wählt (Spielleiter tippt an)"
  },
  // Who starts (field "opener"), shown in the line-up.
  openers: {
    "":   "Keine Angabe",
    most: "Wer die meisten Münzen hat"
  },

  abilities: {
    "":             "Keine (nur Text, Münzen werden von Hand gebucht)",
    treasureHunter: "Schatzsucher: sofort +3 Münzen",
    pathfinder:     "Pfadfinderin: nächste Ereigniskarte ansehen, spielen oder unter den Stapel",
    luckBringer:    "Glücksbringerin: nach Verlust durch ein Ereignis den Verlust zurück",
    goldFinger:     "Goldfinger: direkt nach gewonnenem Minispiel den Gewinn verdoppeln",
    marksman:       "Das Turnier: Knopf bei jedem Minispiel mit eigener Teilnahme, Sieg ankündigen, Sieg: 1 von jedem Mitspieler",
    fateTurner:     "Schicksalswender: 2 Ereigniskarten sehen, eine spielen",
    luckyFairy:     "Glücksfee: Kopf oder Zahl; richtig: dem Reichsten die Hälfte wegnehmen, falsch: alle eigenen Münzen weg",
    houseRules:     "Hausrecht: nächste Karte sehen, spielen (+1) oder unter den Stapel",
    tip:            "Trinkgeld: +1 je Ereigniskarte (kein Minispiel) und je gekaufter Geheimkarte, bis ein Minispiel kommt",
    foolsLuck:      "Glück des Narren: zufällig 1 bis 4 Münzen",
    heartySoup:     "Stärkende Suppe: nach Verlust durch ein Ereignis +3",
    encore:         "Zugabe: aus 3 Minispielen wählen und mitspielen, Sieg +2",
    loadedDice:     "Gezinkt: Knopf beim Minispiel, Minispiel wiederholen lassen (auch ohne mitzuspielen)",
    foresight:      "Blick in die Zukunft: nächste 2 Karten sehen und Reihenfolge bestimmen",
    challenge:      "Herausforderung: Duell gegen Gegner der Wahl, Sieger erhält die Hälfte der Münzen des Verlierers",
    longFingers:    "Langfinger: bis zu 3 Mitspieler, Glücksrad −1/+1/+2/+3 je Mitspieler",
    bathroomBreak:  "Pinkelpause: Knopf bei jeder Ereigniskarte, aussetzen, +1 je Karte (max. 10)",
    curiosity:      "Neugiernase: heimliche Ja-Nein-Frage, späterer Treffer bei ihm 6 statt 3",
    foolsRiddle:    "Narrenrätsel: heimlich 2, 4 oder 6, Mitspieler rät; falsch: Zahl für dich, richtig: Hälfte für ihn"
  },

  effects: {
    calm:         "Nichts geschieht (Ruhe)",
    goldRain:     "Alle erhalten 1 Münze",
    tax:          "Alle verlieren 1 Münze",
    favor:        "Wer die wenigsten hat, erhält 3",
    pickpocket:   "Wer die meisten hat, verliert 2",
    envy:         "Reichste geben je 2 an die Ärmsten",
    exposed:      "Alle Erratenen verlieren 1",
    disguise:     "Alle Unerratenen erhalten 1",
    oracle:       "Meiste verrät ein Erkennungsmerkmal oder zahlt 2",
    crossroads:   "Wenigste wählt: alle +1 oder selbst +2",
    generosity:   "Meiste schenkt einem Mitspieler 2 oder zahlt 3",
    fate:         "Münzwurf für jeden: Kopf +1, Zahl −1",
    fateManual:   "Echte Münze: für jeden „richtig“ (+1) oder „falsch“ (−1) eintragen",
    seers:        "Hält an: Treffer beim Raten bringt 5 statt 3",
    bounty:       "Hält an: Treffer beim Raten bringt 4 statt 3",
    looseTongues: "Hält an: Raten kostet nichts",
    costlyGuess:  "Hält an: Raten kostet 2 statt 1",
    secretSale:   "Hält an: geheime Karte kostet 1 statt 2",
    lottery:      "Die App lost einen Spieler aus, er erhält 3",
    spotlightMost:   "Nichts zu buchen, die App zeigt, wer die meisten Münzen hat",
    spotlightFewest: "Nichts zu buchen, die App zeigt, wer die wenigsten Münzen hat",
    coinCount:    "Nichts zu buchen, die App zeigt die Münzen aller Spieler",
    untilMinigame: "Nichts zu buchen, Erinnerung auf der Hauptseite bis zum nächsten Minispiel",
    jailerDrinks: "Kerkermeister trinkt: Schlüssel 1 Münze billiger (nur Schlüssel-Abenteuer, kommt in Listenreihenfolge)",
    keyPriceSet:  "Hält an: Schlüssel kostet 4, egal was vorher (nur Schlüssel-Abenteuer)",
    searchPockets: "Verdächtigte wählen: 2 an die Bank zahlen oder Schlüssel zeigen (nur Schlüssel-Abenteuer)"
  },

  // What a private card does besides its coins, per privateType ("instant" has none).
  // keep = hand card: the player keeps it and plays it later under "Nachsehen" (js/game/hand-cards.js).
  privateEffects: {
    task: {
      "":      "Nichts weiter: Münzen, sobald die Aufgabe geschafft ist",
      witness: "Zeuge: wer es zuerst bemerkt, erhält dieselben Münzen",
      keyDeal: "Schlüsselhandel: ein Mitspieler zahlt 1 Münze und sieht die Schlüssel (nur Schlüssel-Abenteuer)"
    },
    keep: {
      "":         "Nichts zu buchen, das Einsetzen wird nur vermerkt",
      waiver:     "Freibrief: den letzten Verlust zurück",
      doubleWin:  "Nach gewonnenem Minispiel den Gewinn verdoppeln",
      scapegoat:  "Verlust durch ein Minispiel zahlt ein Mitspieler der Wahl",
      shareLoss:  "Ein Mitspieler der Wahl zahlt die Hälfte des letzten Verlusts (aufgerundet)",
      whisper:    "Heimliche Ja-Nein-Frage zur Rolle eines Mitspielers (nur mit Rollen)",
      fortuneTip: "Gleich raten: Treffer bringt 5 statt 3 (nur mit Rollen)",
      peekKeys:   "Die Schlüssel eines Mitspielers ansehen (nur Schlüssel-Abenteuer)",
      redrawKey:  "Beim Schlüsselkauf einen doppelten Schlüssel zurückgeben und neu ziehen (nur Schlüssel-Abenteuer)",
      tableRule:  "Gilt bis zum nächsten Minispiel, Erinnerung auf der Hauptseite",
      freeBeer:   "Münzen der Karte, dann so viele Schlücke verteilen, wie man Münzen hat"
    }
  },

  // Effects that started a minigame. Event cards no longer do that: the app draws either an event card or a minigame.
  // Events still set to one of these stay out of the deck until another effect is chosen in the CMS.
  retiredEffects: {
    duel:     "Duell zwischen Meisten und Wenigsten",
    contest:  "Alle gegen alle mit doppelter Belohnung",
    camps:    "Erratene gegen Unerratene",
    purse:    "Duell um den verfluchten Beutel",
    stranger: "Meiste allein gegen alle"
  },

  // adventure goals (CMS: "Spielziel")
  goals: {
    coins: "Die meisten Münzen am Ende",
    keys: "Schlüssel kaufen: drei verschiedene brechen aus (Preis fällt mit dem Rausch des Kerkermeisters)"
  },

  // Effects that only make sense with roles (guessing, revealed/hidden, traits).
  // Events with one of these, or with requiresRoles: true, are left out of games without roles.
  roleEffects: ["exposed", "disguise", "oracle", "seers", "looseTongues", "bounty", "costlyGuess"],
  privateRoleEffects: ["whisper", "fortuneTip"]
};

// e: an event as stored in the content JSON
function eventRetired(e) {
  return Boolean(e) && e.visibility !== "private" && !CATALOG.effects[e.effect || "calm"];
}
function privateType(e) { return e.privateType === "task" || e.privateType === "keep" ? e.privateType : "instant"; }
// A private card's effect if its type knows it, otherwise "" (an effect left over from a public card does nothing).
function privateEffect(e) {
  const known = CATALOG.privateEffects[privateType(e)];
  return known && e.effect && known[e.effect] ? e.effect : "";
}
// The effect alone needs roles (guessing, revealed players, questions about a role).
function effectNeedsRoles(e) {
  return Boolean(e) && (e.visibility === "private"
    ? CATALOG.privateRoleEffects.includes(privateEffect(e)) : CATALOG.roleEffects.includes(e.effect));
}
function eventRequiresRoles(e) {
  return Boolean(e) && (e.requiresRoles === true || effectNeedsRoles(e));
}
