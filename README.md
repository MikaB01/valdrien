# Valdrien

A social deduction party game with secret roles, events and minigames, plus a companion web app and a collaborative CMS for all content. The player-facing UI is German.

- Game: `https://<user>.github.io/valdrien/`
- CMS: `https://<user>.github.io/valdrien/cms.html`

## Repository layout

| Path | Purpose |
|---|---|
| `index.html` | Game shell (game master phone and player pages opened via QR code). |
| `cms.html` | CMS shell ("Valdrien Redaktion"): edit adventures, roles, minigames and events together and live. |
| `connection.js` | Supabase project URL and public anon key, shared by game and CMS. |
| `js/shared/` | Loaded by game and CMS: `helpers.js`, `catalog.js` (available mechanics), `content-format.js` (content JSON format + upgrade from format 1). |
| `js/game/` | Game code, one file per topic (see below). |
| `js/cms/cms.js` | CMS code. |
| `js/lib/qrcode.js` | Vendored QR code generator (MIT), do not modify. |
| `css/` | `game.css`, `cms.css`. Color tokens at the top, light and dark theme. |
| `images/` | Painted artwork, e.g. `forest-guild.jpg`; dungeon pictures (`dungeon-*.jpg`) and key icons (`key-*.webp`) for the Halloween adventure. |
| `content/` | Initial content of all adventures: `content.json` (backup) and `initial-content.js` (CMS preview mode and game fallback). |
| `database/` | `setup.sql` (full Supabase setup, idempotent), `migrate-to-english.sql` (one-time upgrade from the old German schema). |

No build step: plain `<script>` files loaded in order, all top-level declarations are global. Code that runs at load time may only use what earlier scripts defined. `js/game/main.js` is loaded last and starts the app.

## Game code (`js/game/`)

| File | Contents |
|---|---|
| `rules.js` | `RULES`: core rule numbers (guess cost, hit reward, player limits, event interval). Texts read these values. |
| `server.js` | `rpc()` for Supabase functions. |
| `content.js` | Converts CMS content into `ADVENTURES`, `ROLES`, `EVENTS`, `MINIGAMES`; keeps slots stable during a running game; live updates. |
| `state.js` | `state` (saved to localStorage), settings, coin helpers. |
| `artwork.js` | Drawn forest and tavern artwork, icons. |
| `frame.js` | `show(screen)`, `render()`, `SCREENS` registry, bottom app bar (back, purse, menu) and its sheets. |
| `menu.js`, `rulebook.js`, `setup.js`, `overview.js` | Screens before and around play. |
| `timer.js` | Countdown to the next event card: fixed or random interval; the clock in the corner of the main screen is the pause/play button. |
| `guessing.js` | Guessing a role. |
| `abilities.js` | `ABILITIES`: one handler per ability mechanic. |
| `events.js` | Drawing and resolving event cards, private events, secret tasks (`TASK_EFFECTS`). |
| `effects.js` | `EFFECTS`: one handler per event effect. |
| `minigames.js` | Drawing minigames, line-ups, scoring. |
| `keys.js` | Adventures with goal `keys` (Henkersmahl): key price and the jailer's mood, buying random keys, the secret key display, showing one player's keys to another, breakout and its end screen. |
| `hand-cards.js` | `HAND_CARDS`: private cards the player keeps and plays later under "Nachsehen". |
| `ending.js` | Secret tasks, final count, play again. |
| `player-page.js` | QR links, syncing seats to Supabase, the player's own page. |
| `speech.js` | Read-aloud buttons via the browser's Web Speech API (on-device voices, no service). |
| `music.js` | Background music while the timer runs, generated live with the Web Audio API (no audio files). |
| `main.js` | Startup. |

### Common changes

- **Rule numbers:** `js/game/rules.js`.
- **New screen:** write `screenXyz()` returning HTML, register it with `Object.assign(SCREENS, { xyz: screenXyz })`, navigate with `show("xyz")`.
- **New ability or event effect:**
  1. Add the key and a German CMS label to `js/shared/catalog.js` (it becomes selectable in the CMS).
  2. Implement it in `ABILITIES` (`js/game/abilities.js`) or `EFFECTS` (`js/game/effects.js`); the expected shape is documented at the top of each file.
  `main.js` logs a console warning for catalog entries without an implementation.
- **Event effect that needs a game state** (a guessed role, unequal coins, an earlier card): add a check to `EFFECTS_READY` in `js/game/effects.js`. Until it returns true the card stays in the deck and is skipped, so it never comes without effect.

## Content JSON (format 2)

```text
{ format: 2, world: { name, motto },
  adventures: { <id>: { pos, name, setting, goal (coins|keys, default coins),
    story: { title, paragraphs[], closing },
    epilogue: { title, before[], after[] },          ({winner} is replaced by the winner's name)
    terms: { question, player, plural, dative, finish },
    roles: { <id>: { pos, name, title, startingCoins, background, character, traits[],
                     ability: { name, text, mechanic }, task: { name, text, bonus } } },
    minigames: { <id>: { pos, name, category (duel|all|oneVsAll|team|uneven), description,
                         reward: { winner, loser, judge, solo, group, fail, team, single, pair, singleName, pairName } } },
    events: { <id>: { pos, name, category, visibility (public|private), description, effect,
                      privateType (instant|task|keep), privateCoins, requiresRoles, drinking } } } } }
```

`goal: "keys"` (Das Henkersmahl im Verlies): instead of counting coins at the end, players buy random keys for `keyPrice()`: `RULES.keyPrice.start` (7), 1 coin less with every event card with effect `jailerDrinks` (they come in list order), down to `RULES.keyPrice.min` (2); the chances and key pictures are in `RULES.keys`. Whoever first holds all three kinds breaks out and wins at once; each player sees only their own keys. Role tasks are cashed in during the game under "Nachsehen", because the end comes without warning.

`drinking: true` marks a drinking card (Trinkrunde, Trinkregel): it only comes into the deck while the drinking game is switched on in the settings (`settings.drinking`, per device, applies at once, also in a running game).

Effects that last "until the next event card" (`seers`, `bounty`, `looseTongues`, `costlyGuess`, `secretSale`, `keyPriceSet`) are listed in `LASTING` in `js/game/effects.js` and stored as `state.lasting = { effect, title }`; bought secret cards do not end them. `untilMinigame` keeps a reminder (`state.tableRules`) on the main screen until the next minigame.

Private events (`visibility: "private"`) go to one player. `privateType` decides what happens: `instant` books `privateCoins` at once, `task` books them once the game master confirms the task in the purse, `keep` is a hand card: the player keeps it and plays it later under "Nachsehen" (coins are booked when it is played). For `task` and `keep` the `effect` comes from `CATALOG.privateEffects` (empty = nothing beyond the coins); hand card effects are implemented in `HAND_CARDS` (`js/game/hand-cards.js`), task effects in `TASK_EFFECTS` (`js/game/events.js`). Hand cards that act on a loss or a won minigame use `recentLoss(i)` / `recentWin(i)` (state.js): only losses through event cards, minigames and other players' abilities or cards count, never a player's own spending, and only until the next card is drawn. `CATALOG.privateRoleEffects` keep a card out of games without roles; private effects that need the keys goal are checked in `EFFECTS_READY`.

Event cards never start a minigame: when the time is up the app draws either an event card or a minigame. Events still set to one of the former minigame effects (`CATALOG.retiredEffects`) or to any unknown effect stay out of the deck (`retired`); the CMS marks them so another effect can be chosen.

A role's `task` is optional: without name, text and bonus the role has no secret task (the Henkersmahl roles have none).

`requiresRoles: true` keeps an event out of games played without roles (settings → "Geheime Rollen"). Events with an effect from `CATALOG.roleEffects` count as role events even without the field; the CMS sets it for them, and `database/setup.sql` adds it to existing content.

Entries are objects keyed by id (not arrays) so several editors can add and reorder entries at the same time; order comes from `pos`. Old format-1 files (German keys) are converted automatically by `upgradeContent()`.

## Supabase

Tables: `content` (one row `id = 'valdrien'`, `data` jsonb, `version`), `editors`, `history`, plus `sessions` and `seats` for player pages. Clients never write tables directly; all writes go through security-definer functions:

- CMS (signed in, listed in `editors`): `content_set(path, value)`, `content_delete(path)`, `content_replace(data)`, `editor_add`, `editor_remove`, `is_editor()`.
- Game (anon): `seat_write(p_session, p_secret, p_access, p_data)` from the game master phone, `seat_read(p_access)` from a player phone, `seat_status`, `session_delete`. Sessions older than 3 days are removed on the next write.

`content` is part of the `supabase_realtime` publication, so CMS windows and games update live.

## Setup

1. **Supabase:** create a project (region Frankfurt), open *SQL Editor*, run `database/setup.sql`. The first editor email is set at the top of the file.
2. **GitHub Pages:** push the repository, enable *Settings → Pages* for `main` / root.
3. **Auth URLs:** in Supabase *Authentication → URL Configuration* set the Site URL to `.../valdrien/cms.html` and add `.../valdrien/**` to the redirect URLs. Recommended: disable new sign-ups (*Sign In / Providers*) and add editors via *Authentication → Users*.
4. **connection.js:** enter the project URL and the anon public key (*Project Settings → API*). The anon key is public; never use the service_role key. Without values the CMS runs in preview mode (browser storage only).
5. **Sign in:** open the CMS, request a magic link once, then set a password under *Team & Verlauf → Mein Passwort*. Supabase only sends a few auth emails per hour.

Emergency password reset in the SQL editor:

```sql
update auth.users
set encrypted_password = extensions.crypt('NEW-PASSWORD', extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now())
where email = 'mikabessel@googlemail.com';
```

### Upgrading from the German schema

1. Run `database/migrate-to-english.sql`, then `database/setup.sql`.
2. Push the code.
3. Sign in to the CMS once as an editor: it stores the content in format 2. Until then the game converts the old format on the fly.

## Local development

Open `index.html` or `cms.html` directly in a browser (or serve the folder with any static server). Reload after changes.
