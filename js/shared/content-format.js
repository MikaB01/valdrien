// Content JSON format 2 (English keys). upgradeContent() converts the old German format 1,
// e.g. an old backup file or content cached before the database migration.
const CONTENT_FORMAT = 2;

const LEGACY_IDS = {
  adventure: { wald: "forest", taverne: "tavern" },
  category: { duell: "duel", alle: "all", einer: "oneVsAll", team: "team", ungleich: "uneven" },
  visibility: { oeffentlich: "public", privat: "private" },
  privateType: { sofort: "instant", aufgabe: "task" },
  reward: {
    sieger: "winner", verlierer: "loser", richter: "judge", einzeln: "solo", gruppe: "group", scheitern: "fail",
    team: "team", riese: "single", zwerge: "pair", einzelName: "singleName", paarName: "pairName"
  },
  mechanic: {
    schatzsucher: "treasureHunter", pfadfinderin: "pathfinder", gluecksbringerin: "luckBringer", goldfinger: "goldFinger",
    praezisionsmeister: "marksman", schicksalswender: "fateTurner", gluecksfee: "luckyFairy", hausrecht: "houseRules",
    trinkgeld: "tip", narr: "foolsLuck", suppe: "heartySoup", zugabe: "encore", gezinkt: "loadedDice",
    zukunft: "foresight", herausforderung: "challenge"
  },
  effect: {
    ruhe: "calm", goldregen: "goldRain", steuer: "tax", gunst: "favor", taschendieb: "pickpocket", neid: "envy",
    entlarvt: "exposed", tarnung: "disguise", duell: "duel", kraeftemessen: "contest", lager: "camps", beutel: "purse",
    fremder: "stranger", orakel: "oracle", scheideweg: "crossroads", grosszuegig: "generosity", schicksal: "fate",
    seher: "seers", losezungen: "looseTongues"
  }
};

function upgradeContent(data) {
  if (!data || data.format === CONTENT_FORMAT || !data.abenteuer) return data;
  const L = LEGACY_IDS;
  const map = (table, v) => (v in table ? table[v] : v);
  const each = (obj, fn) => Object.fromEntries(Object.entries(obj || {}).map(([id, x]) => [id, fn(x || {})]));
  const winner = list => (list || []).map(p => String(p).split("{sieger}").join("{winner}"));
  const adventures = {};
  for (const [id, a] of Object.entries(data.abenteuer)) {
    const g = a.geschichte || {}, s = a.schlusstext || {}, t = a.begriffe || {};
    adventures[map(L.adventure, id)] = {
      pos: a.pos, name: a.name, setting: a.setting,
      story: { title: g.titel, paragraphs: g.absaetze || [], closing: g.schluss },
      epilogue: { title: s.titel, before: winner(s.vorher), after: winner(s.nachher) },
      terms: { question: t.frage, player: t.spieler, plural: t.mehrzahl, dative: t.dativ, finish: t.beenden },
      roles: each(a.rollen, r => ({
        pos: r.pos, name: r.name, title: r.bezeichnung, startingCoins: r.startkapital,
        background: r.hintergrund, character: r.charakter, traits: r.merkmale || [],
        ability: { name: r.faehigkeit?.name, text: r.faehigkeit?.text, mechanic: map(L.mechanic, r.faehigkeit?.mechanik || "") },
        task: { name: r.aufgabe?.name, text: r.aufgabe?.text, bonus: r.aufgabe?.bonus }
      })),
      minigames: each(a.minispiele, m => ({
        pos: m.pos, name: m.name, category: map(L.category, m.kategorie), description: m.beschreibung,
        reward: Object.fromEntries(Object.entries(m.belohnung || {}).map(([k, v]) => [map(L.reward, k), v]))
      })),
      events: each(a.ereignisse, e => ({
        pos: e.pos, name: e.name, category: e.kategorie, visibility: map(L.visibility, e.sichtbarkeit),
        description: e.beschreibung, effect: map(L.effect, e.wirkung),
        privateType: map(L.privateType, e.privatArt), privateCoins: e.privatMuenzen
      }))
    };
  }
  const world = data.welt || {};
  return JSON.parse(JSON.stringify({ format: CONTENT_FORMAT, world: { name: world.name, motto: world.spruch }, adventures }));
}
