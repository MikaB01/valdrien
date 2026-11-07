// Live connection between the game master phone and the player pages (Supabase Realtime broadcast).
// One channel per seat, named after its access code, so only the phone with that QR link listens in.
// Game master -> phone: { type: "seat", data } right after the seat changed (the 5 s poll of seat_read stays as fallback).
// Phone -> game master: { type: "hello" } when it joins and every 25 s, and requests the game master phone checks
// before applying them: reroll / takeBack (from = the role the phone shows), read (card id), sketch (image of a drawing round).
// Requests are repeated by the phone until its seat shows the result, so a lost message only costs a few seconds.
const LIVE_EVENT = "msg";
const PHONE_FRESH_MS = 60000;
let liveClient = null;
const liveChannels = {};
const phoneSeen = {}; // game master side: access code -> time of the last message from that phone

function liveReady() { return Boolean(window.supabase && PROJECT_URL && PROJECT_KEY); }
function sharedClient() {
  if (!liveClient && liveReady()) liveClient = window.supabase.createClient(PROJECT_URL, PROJECT_KEY, { auth: { persistSession: false } });
  return liveClient;
}

function openChannel(code, onMessage, onJoined) {
  if (liveChannels[code] || !liveReady()) return liveChannels[code] || null;
  try {
    const ch = sharedClient().channel("valdrien-seat-" + code, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: LIVE_EVENT }, message => onMessage((message && message.payload) || {}));
    ch.subscribe(status => { if (status === "SUBSCRIBED" && onJoined) onJoined(); });
    liveChannels[code] = ch;
    return ch;
  } catch (e) { return null; }
}
function closeChannel(code) {
  const ch = liveChannels[code];
  delete liveChannels[code];
  try { if (ch) sharedClient().removeChannel(ch); } catch (e) {}
}
function liveSend(code, payload) {
  const ch = liveChannels[code];
  if (!ch) return;
  try { ch.send({ type: "broadcast", event: LIVE_EVENT, payload }); } catch (e) {}
}

/* --- Game master phone --- */

function pushSeat(code, data) { liveSend(code, { type: "seat", data: Object.assign({ updatedAt: Date.now() }, data) }); }

// Channels for the current links and the retired ones (their pages still have to learn the new link).
function syncLiveChannels() {
  if (!liveReady() || own) return;
  const wanted = new Set((state.players || []).map(s => s.accessCode).filter(Boolean).concat(state.retiredCodes || []));
  Object.keys(liveChannels).forEach(code => { if (!wanted.has(code)) closeChannel(code); });
  wanted.forEach(code => openChannel(code, msg => phoneMessage(code, msg)));
}

function phoneConnected(i) {
  const s = state.players[i];
  return Boolean(s && s.accessCode && phoneSeen[s.accessCode] && Date.now() - phoneSeen[s.accessCode] < PHONE_FRESH_MS);
}

function phoneMessage(code, msg) {
  const i = state.players.findIndex(s => s.accessCode === code);
  const fresh = i >= 0 && !phoneConnected(i);
  phoneSeen[code] = Date.now();
  if (i < 0) { if ((state.retiredCodes || []).includes(code)) pushSeat(code, replacedData(code)); return; }
  const role = roleOf(i);
  let changed = false;
  if (msg.type === "hello") {
    pushSeat(code, seatData(state.players[i]));
    if (fresh) liveRender();
    return;
  }
  if (msg.type === "reroll" && role && msg.from === role.id) changed = rerollPlayer(i);
  if (msg.type === "takeBack" && role && msg.from === role.id) {
    const k = ROLES.findIndex(r => r.id === msg.role);
    changed = k >= 0 && takeBackRole(i, k);
  }
  if (msg.type === "read") changed = markCardRead(i, msg.id);
  if (msg.type === "sketch") changed = sketchReceived(i, msg.key, msg.image);
  if (!changed) { pushSeat(code, seatData(state.players[i])); return; }
  save();
  liveRender();
}

// Re-renders for news from a phone, but never under a finger that is drawing.
let liveRenderPending = false;
function liveRender() {
  if (sketchPointerDown) { liveRenderPending = true; return; }
  liveRenderPending = false;
  if (["handover", "minigame", "event", "myRole", "admin"].includes(state.screen) && !sheet) keepScroll(render);
  else renderFrame();
}

// The public card or minigame on the table, for every phone. state.shownCard = { kind, index, id, read: [players] }
function showOnPhones(kind, index) {
  state.shownCard = { kind, index, id: randomCode().slice(0, 8), read: [] };
}
function markCardRead(i, id) {
  const c = state.shownCard;
  if (!c || c.id !== id || c.read.includes(i)) return false;
  c.read.push(i);
  return true;
}
function readLine() {
  const c = state.shownCard;
  const phones = state.players.map((_, i) => i).filter(i => phoneConnected(i) || (c && c.read.includes(i)));
  if (!c || !phones.length) return "";
  const read = phones.filter(i => c.read.includes(i)), open = phones.filter(i => !c.read.includes(i));
  return `<p class="read-line" aria-live="polite">${read.length ? `<span class="read-yes">✓ Gelesen: ${playerNames(read)}</span>` : ""}${open.length ? `<span class="muted">Liest noch: ${playerNames(open)}</span>` : ""}</p>`;
}

function tableCard(i) {
  const c = state.shownCard;
  if (!c || !state.running) return null;
  const base = { id: c.id, kind: c.kind, read: c.read.includes(i) };
  if (c.kind === "event") {
    const e = EVENTS[c.index];
    return e ? Object.assign(base, { entry: e.id, title: e.title }) : null;
  }
  const mg = MINIGAMES[c.index];
  const m = state.minigame && state.minigame.index === c.index ? state.minigame : null;
  if (!mg) return null;
  return Object.assign(base, {
    entry: mg.id,
    title: mg.title,
    reward: rewardText(mg, m),
    players: m && lineupComplete(m) ? minigameParticipants().map(k => state.players[k].name) : [],
    done: !m || Boolean(m.done),
    tool: m && !m.done ? phoneTool(m, mg, i) : null
  });
}

// What a tool shows on player i's own phone: { text } or, for drawing on the own phone, { sketch: { key, term, seconds, done } }.
function phoneTool(m, mg, i) {
  const tool = MINIGAME_TOOLS[mg.tool];
  return tool && tool.phone && m.run ? tool.phone(m, mg, i) || null : null;
}

function rerollOffer(i) {
  if (!state.rerollLimit || !rerollOpen(i)) return null;
  return {
    left: canReroll(i) ? rerollsLeft(i) : 0,
    back: putAwayRoles(i).map(k => ({ id: ROLES[k].id, name: ROLES[k].name }))
  };
}

/* --- Player phone --- */

let ownRequest = null; // { payload, until } repeated with every seat update until done() says it arrived

function startOwnLive() {
  const hello = () => liveSend(own.accessCode, { type: "hello" });
  if (!openChannel(own.accessCode, ownMessage, hello)) return;
  setInterval(() => { if (!document.hidden) { hello(); repeatOwnRequest(); } }, 25000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) hello(); });
}

function ownMessage(msg) {
  if (msg.type === "seat" && msg.data) applyOwnData(msg.data);
}

function ownSend(payload, arrived) {
  ownRequest = { payload, arrived };
  liveSend(own.accessCode, payload);
  renderOwn();
}
function repeatOwnRequest() {
  const r = ownRequest;
  if (!r) return;
  if (r.arrived(own.data || {})) { ownRequest = null; return; }
  liveSend(own.accessCode, r.payload);
}
function ownWaiting(type) { return Boolean(ownRequest && ownRequest.payload.type === type); }

// A seat that was put away points to the player's current link; the page moves on by itself.
function followNewLink(d) {
  if (!d || !d.replaced || !d.next || ("#" + d.next) === location.hash) return false;
  history.replaceState(null, "", "#" + d.next);
  location.reload();
  return true;
}

function ownReroll() { ownSend({ type: "reroll", from: own.roleId }, d => Boolean(d.replaced)); own.confirmReroll = false; renderOwn(); }
function ownTakeBack(id) { ownSend({ type: "takeBack", from: own.roleId, role: id }, d => Boolean(d.replaced)); }
function ownRead(id) { ownSend({ type: "read", id }, d => !d.table || d.table.id !== id || d.table.read); }

function ownTableHtml(d) {
  const t = d && d.table;
  const a = ADVENTURES[own.adventure];
  if (!t || !a || d.phase !== "running") return "";
  const list = t.kind === "event" ? a.events : a.minigames;
  const entry = list.find(x => x.id === t.entry);
  const title = entry ? entry.title : escapeName(t.title || "");
  const label = t.kind === "event" ? (entry ? entry.category : "Ereigniskarte") : `Minispiel${entry ? " · " + CATEGORY_NAMES[entry.category] : ""}`;
  const waiting = ownWaiting("read") && ownRequest.payload.id === t.id;
  const players = (t.players || []).map(n => `<span class="name-chip">${escapeName(n)}</span>`).join("");
  return `
    <section class="table-card" aria-label="Auf dem Tisch">
      <span class="label">${t.kind === "event" ? "Auf dem Tisch" : t.done ? "Letztes Minispiel" : "Minispiel läuft"}</span>
      ${t.tool ? ownToolHtml(t) : ""}
      <article class="card drawn-card">
        <div class="title"><span class="label">${label}</span><div class="card-name">${title}</div></div>
        ${entry ? `<p class="narrative">${entry.text}</p>` : ""}
        ${t.reward ? `<p class="coin-line">${String(t.reward).replace(/<[^>]*>/g, "")}</p>` : ""}
      </article>
      ${players ? `<div class="lineup-names own-lineup">${players}</div>` : ""}
      ${t.read ? `<p class="read-done">✓ Gelesen</p>`
        : `<button class="btn-quiet" onclick="ownRead('${escapeName(t.id)}')" ${waiting ? "disabled" : ""}>${waiting ? "Wird gemeldet …" : "Gelesen"}</button>`}
    </section>`;
}

function ownToolHtml(t) {
  const tool = t.tool;
  if (tool.sketch) return ownSketchHtml(tool.sketch);
  if (tool.countdown) return `<div class="countdown" id="own-countdown" data-end="${Number(tool.countdown)}">${Math.max(0, Math.ceil((tool.countdown - Date.now()) / 1000))}</div>`;
  return tool.text ? `<p class="note">${escapeName(tool.text)}</p>` : "";
}

function ownRerollHtml(d) {
  const r = d && d.reroll;
  if (!r || d.replaced) return "";
  if (ownWaiting("reroll") || ownWaiting("takeBack")) return `<p class="muted reroll-line">Die neue Rolle kommt gleich …</p>`;
  const back = (r.back || []).map(x => `<button class="btn-quiet" onclick="ownTakeBack('${escapeName(x.id)}')">${escapeName(x.name)} zurückholen</button>`).join("");
  const draw = !r.left ? "" : own.confirmReroll ? `
    <div class="confirm reroll-confirm" role="alertdialog" aria-labelledby="own-reroll-title">
      <strong id="own-reroll-title">Wirklich eine neue Rolle ziehen?</strong>
      <p class="muted">Deine Rolle legst du weg. Zurückholen kannst du sie, bis die erste Karte kommt.</p>
      <button class="btn" onclick="ownReroll()">Ja, neue Rolle ziehen</button>
      <button class="link-button" onclick="own.confirmReroll = false; renderOwn()">Nein, behalten</button>
    </div>` : `
    <button class="btn-quiet" onclick="own.confirmReroll = true; renderOwn()">Rolle weglegen und neu ziehen</button>
    <p class="muted">${r.left === 1 ? "Noch einmal möglich" : `Noch ${r.left}-mal möglich`}, bis die erste Karte kommt.</p>`;
  return draw || back ? `<div class="reroll">${draw}${back ? `<span class="label">Weggelegt</span>${back}` : ""}</div>` : "";
}

// Drawing on the own phone (Phantombild, mode "phones"). Kept per round in localStorage, so a reload loses nothing.
function ownSketch(key) {
  try { return JSON.parse(localStorage.getItem(`valdrien-sketch-${own.accessCode}-${key}`) || "null") || { started: null, strokes: [], finished: false }; }
  catch (e) { return { started: null, strokes: [], finished: false }; }
}
function storeOwnSketch(key, sk) { try { localStorage.setItem(`valdrien-sketch-${own.accessCode}-${key}`, JSON.stringify(sk)); } catch (e) {} }
function ownSketchLeft(sk, seconds) { return sk.started ? seconds - (Date.now() - sk.started) / 1000 : seconds; }
let ownSketchCurrent = null; // { key, seconds, sk } while the drawing screen is shown

function ownSketchHtml(t) {
  const sk = ownSketch(t.key);
  ownSketchCurrent = null;
  if (t.done) return `<p class="note">✓ Dein Bild ist angekommen. Gleich zeigt das Spielleiter-Handy alle Bilder.</p>`;
  if (sk.finished) return `<p class="note">Dein Bild wird geschickt …</p>`;
  if (!sk.started) return `
    <div class="handover handover-small">
      <p class="muted">Dein Begriff, nur für dich</p>
      <p class="sketch-term sketch-term-large">${escapeName(t.term)}</p>
      <p class="muted">Lies ihn in Ruhe. Die Zeit läuft erst, wenn du auf Los tippst.</p>
      <button class="btn" onclick="ownSketchStart('${escapeName(t.key)}')">Los, ${t.seconds} Sekunden</button>
    </div>`;
  ownSketchCurrent = { key: t.key, seconds: t.seconds, sk };
  return `
    <div class="sketch-head">
      <span><span class="label">Dein Begriff</span><strong class="sketch-term">${escapeName(t.term)}</strong></span>
      <span class="sketch-clock" id="own-sketch-clock">${Math.max(0, Math.ceil(ownSketchLeft(sk, t.seconds)))}</span>
    </div>
    <canvas class="sketch-canvas" id="own-sketch" width="600" height="600" aria-label="Zeichenfläche"></canvas>
    ${sketchToolbar()}
    <button class="btn" onclick="ownSketchFinish()">Schon fertig</button>`;
}

function ownSketchStart(key) {
  const sk = ownSketch(key);
  if (!sk.started) { sk.started = Date.now(); sk.strokes = []; storeOwnSketch(key, sk); }
  sketchErasing = false;
  unlockAudio();
  renderOwn();
  window.scrollTo(0, 0);
}

function mountOwnSketch() {
  const canvas = document.getElementById("own-sketch");
  const c = ownSketchCurrent;
  if (!canvas || !c) return;
  sketchPad(canvas, c.sk.strokes, () => !c.sk.finished && ownSketchLeft(c.sk, c.seconds) > 0, () => storeOwnSketch(c.key, c.sk));
}

function ownSketchTick() {
  const c = ownSketchCurrent;
  const field = document.getElementById("own-sketch-clock");
  if (!c || !field || c.sk.finished) return;
  const left = ownSketchLeft(c.sk, c.seconds);
  field.textContent = Math.max(0, Math.ceil(left));
  if (left > 0 || sketchPointerDown) return;
  try { if (navigator.vibrate) navigator.vibrate(300); } catch (e) {}
  playSignal();
  ownSketchFinish();
}

function ownSketchFinish() {
  const c = ownSketchCurrent;
  if (!c || c.sk.finished) return;
  c.sk.finished = true;
  storeOwnSketch(c.key, c.sk);
  const image = c.sk.strokes.length ? strokesToImage(c.sk.strokes, 360, "image/jpeg", 0.7) : null;
  const key = c.key;
  ownSend({ type: "sketch", key, image }, d => {
    const t = d.table && d.table.tool && d.table.tool.sketch;
    return !t || t.key !== key || t.done;
  });
}
