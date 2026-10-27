// Core rule numbers. Rulebook, quick guide and screens read them from here.
const RULES = {
  minPlayers: 3, // maximum = number of roles in the adventure

  // an adventure from the CMS becomes playable with at least this much content
  adventureMinRoles: 3,
  adventureMinEvents: 1,

  startingCoinsFallback: 4, // if a role has no starting coins set

  guessCost: 1,
  hitReward: 3,
  hitRewardSeers: 5, // during "Die Nacht der Seher"

  eventMinutesDefault: 15,
  eventMinuteOptions: [5, 10, 15, 20],
  randomMinutesDefault: [5, 15], // random timer mode: window in minutes
  randomMinutesLimit: [1, 60]
};
