// Core rule numbers. Rulebook, quick guide and screens read them from here.
const RULES = {
  minPlayers: 3, // maximum = number of roles in the adventure
  maxPlayersWithoutRoles: 10,

  // an adventure from the CMS becomes playable with at least this much content
  adventureMinRoles: 3,
  adventureMinEvents: 1,

  startingCoinsFallback: 4, // if a role has no starting coins set; also the start in games without roles

  rerollOptions: [0, 1, 2, 3], // settings: how often each player may draw a new role
  rerollsDefault: 1,

  guessCost: 1,
  guessCostCostly: 2, // effect "costlyGuess" (Teure Gerüchte)
  privateCardCost: 2, // a player buys a secret event card on the game master phone
  privateCardCostSale: 1, // effect "secretSale" (Geflüster zum halben Preis)
  hitReward: 3,
  hitRewardSeers: 5, // effect "seers" (Die Nacht der Seher)
  hitRewardBounty: 4, // effect "bounty" (Kopfgeld)

  eventMinutesDefault: 15,
  eventMinuteRange: [1, 30], // slider range in the settings
  randomMinutesDefault: [5, 15], // random timer mode: window in minutes
  minigameShareDefault: 0.3, // when the time is up: share of minigames, the rest are event cards

  // Adventures with goal "keys": buy random keys, three different ones break out and win at once.
  // The price falls by 1 with every "jailerDrinks" event card, from start down to min;
  // effect "keyPriceSet" (Der Kerkermeister verrechnet sich) fixes it at muddled until the next event card.
  keyPrice: { start: 7, min: 2, muddled: 4 },
  keys: [
    { id: "iron", name: "Eisenschlüssel", door: "Eisentür", chance: 0.5, image: "images/key-iron.webp" },
    { id: "silver", name: "Silberschlüssel", door: "Silbergitter", chance: 0.35, image: "images/key-silver.webp" },
    { id: "bone", name: "Knochenschlüssel", door: "Knochentor", chance: 0.15, image: "images/key-bone.webp" }
  ],

  lotteryWin: 3, // event effect "lottery"
  curiosityHitReward: 6, // Neugiernase: a later hit on the questioned player
  fortuneTipHitReward: 5, // hand card "fortuneTip" (Der Tipp der Wahrsagerin)
  keyDealPrice: 1, // task "keyDeal" (Der Schlüsselschwindler): what the other player pays to see the keys
  bathroomBreakMax: 10 // Pinkelpause: at most this many coins
};
