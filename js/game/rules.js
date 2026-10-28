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
  privateCardCost: 2, // a player buys a secret event card on the game master phone
  hitReward: 3,
  hitRewardSeers: 5, // during "Die Nacht der Seher"

  eventMinutesDefault: 15,
  eventMinuteRange: [1, 30], // slider range in the settings
  randomMinutesDefault: [5, 15], // random timer mode: window in minutes
  minigameShareDefault: 0.3 // when the time is up: share of minigames, the rest are event cards
};
