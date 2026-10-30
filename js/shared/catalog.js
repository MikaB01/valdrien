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
    seers:        "Hält an: Treffer beim Raten bringt 5 statt 3",
    looseTongues: "Hält an: Raten kostet nichts",
    lottery:      "Die App lost einen Spieler aus, er erhält 4",
    misfortune:   "Die App lost einen Spieler aus, er verliert 2",
    jailerDrinks: "Kerkermeister trinkt: Schlüssel 1 Münze billiger (nur Schlüssel-Abenteuer, kommt in Listenreihenfolge)"
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
  roleEffects: ["exposed", "disguise", "oracle", "seers", "looseTongues"]
};

// e: an event as stored in the content JSON
function eventRetired(e) {
  return Boolean(e) && e.visibility !== "private" && !CATALOG.effects[e.effect || "calm"];
}
function eventRequiresRoles(e) {
  if (!e) return false;
  return e.requiresRoles === true || (e.visibility !== "private" && CATALOG.roleEffects.includes(e.effect));
}
