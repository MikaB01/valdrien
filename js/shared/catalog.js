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
    goldFinger:     "Goldfinger: nach gewonnenem Minispiel Gewinn verdoppeln (max. +3)",
    marksman:       "Präzisionsmeister: Sieg ankündigen, Minispiel wählen, Sieg +3",
    fateTurner:     "Schicksalswender: 2 Ereigniskarten sehen, eine spielen",
    luckyFairy:     "Glücksfee: Kopf oder Zahl, Treffer +4",
    houseRules:     "Hausrecht: nächste Karte sehen, spielen (+1) oder unter den Stapel",
    tip:            "Trinkgeld: nach Minispiel mit eigener Teilnahme +2",
    foolsLuck:      "Glück des Narren: zufällig 1 bis 4 Münzen",
    heartySoup:     "Stärkende Suppe: nach Verlust durch ein Ereignis +3",
    encore:         "Zugabe: aus 3 Minispielen wählen und mitspielen, Sieg +2",
    loadedDice:     "Gezinkt: verlorenen Minispielversuch wiederholen",
    foresight:      "Blick in die Zukunft: nächste 2 Karten sehen und Reihenfolge bestimmen",
    challenge:      "Herausforderung: Duell gegen Gegner der Wahl, Sieg +2"
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
    duel:         "Meiste gegen Wenigste im Duell, Sieger erhält von jedem Verlierer 2",
    contest:      "Alle gegen alle, Sieger erhält doppelte Belohnung",
    camps:        "Erratene gegen Unerratene, Siegerteam je +1",
    purse:        "Meiste verliert 2, außer er gewinnt ein Duell",
    stranger:     "Meiste allein gegen alle",
    oracle:       "Meiste verrät ein Erkennungsmerkmal oder zahlt 2",
    crossroads:   "Wenigste wählt: alle +1 oder selbst +2",
    generosity:   "Meiste schenkt einem Mitspieler 2 oder zahlt 3",
    fate:         "Münzwurf für jeden: Kopf +1, Zahl −1",
    seers:        "Hält an: Treffer beim Raten bringt 5 statt 3",
    looseTongues: "Hält an: Raten kostet nichts"
  }
};
