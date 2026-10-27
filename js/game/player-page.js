// Game master phone: writes each player's coins and secrets to a "seat" in Supabase (seatData, syncSeats).
// Player phone: opens #v.<adventure>.<roleId>.<accessCode> via QR code and reads only its own seat.
const PLAYER_LINK = location.origin + location.pathname;

let seatsEnabled = null;
let lastSynced = {};
let syncRunning = false, syncAgain = false;
let own = null;

function playerUrl(i) {
  const s = state.players[i];
  if (!s.accessCode) { s.accessCode = randomCode(); save(); }
  return `${PLAYER_LINK}#v.${currentAdventure().id}.${ROLES[s.role].id}.${s.accessCode}`;
}

function qrSvg(text) {
  if (typeof QRCodeLib === "undefined") return "";
  try {
    const q = new QRCodeLib.QRCode(-1, QRCodeLib.ErrorLevel.M);
    q.addData(text);
    q.make();
    const n = q.getModuleCount(), margin = 3, g = n + 2 * margin;
    let path = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (q.isDark(r, c)) path += `M${c + margin} ${r + margin}h1v1h-1z`;
    }
    return `<svg class="qr" viewBox="0 0 ${g} ${g}" role="img" aria-label="QR-Code zu deiner Rollenseite" shape-rendering="crispEdges"><rect width="${g}" height="${g}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  } catch (e) { return ""; }
}

function qrSection(i) {
  const art = qrSvg(playerUrl(i));
  if (!art) return "";
  return `
    <details class="qr-optional">
      <summary>Optional: aufs eigene Handy holen</summary>
      <div class="qr-box">
        ${art}
        <p>Scanne den Code mit deiner Kamera. Dann siehst du Rolle, Münzen und geheime Ereignisse auch auf deinem Handy. Nicht nötig: Alles steht auch hier unter „Geheim nachsehen“.</p>
      </div>
    </details>`;
}

// What a player's phone may see. The role itself is not included, only encoded in the QR link.
function seatData(s) {
  return {
    name: s.name,
    coins: s.coins,
    revealed: Boolean(s.revealed),
    abilityUsed: Boolean(s.abilityUsed),
    adventure: state.adventure || "forest",
    phase: state.running ? "running" : (["tasks", "end"].includes(state.screen) ? "end" : "start"),
    timerEnd: state.running && state.timerEnd && !timerPaused() && settings.showTimer !== false ? state.timerEnd : 0,
    secrets: (s.secrets || []).slice(-12).reverse(),
    notes: [
      state.seersNight && `Die Nacht der Seher: Bis zum nächsten Ereignis bringt ein Treffer beim Raten ${RULES.hitRewardSeers} Münzen.`,
      state.freeGuesses && "Lose Zungen: Bis zum nächsten Ereignis kostet Raten keine Münze.",
      state.winBonus && state.players[state.winBonus.player] === s && `Gewinnst du das nächste Minispiel, gibt es ${state.winBonus.amount} Münzen extra.`
    ].filter(Boolean)
  };
}

function newSession() { return { id: randomCode() + randomCode(), secret: randomCode() + randomCode() }; }

async function syncSeats() {
  if (!seatsEnabled || own || !state.players || !state.players.length) return;
  if (syncRunning) { syncAgain = true; return; }
  syncRunning = true;
  if (!state.session) { state.session = newSession(); try { localStorage.setItem("valdrien-game", JSON.stringify(state)); } catch (e) {} }
  try {
    for (const s of state.players) {
      if (!s.accessCode) continue;
      const data = seatData(s);
      const json = JSON.stringify(data);
      if (lastSynced[s.accessCode] === json) continue;
      try {
        await rpc("seat_write", { p_session: state.session.id, p_secret: state.session.secret, p_access: s.accessCode, p_data: Object.assign(data, { updatedAt: Date.now() }) });
        lastSynced[s.accessCode] = json;
      } catch (e) { /* offline: retried on the next sync */ }
    }
  } finally {
    syncRunning = false;
    if (syncAgain) { syncAgain = false; syncSeats(); }
  }
}

function resetSeats() {
  const old = state.session;
  lastSynced = {};
  state.session = newSession();
  if (seatsEnabled && old) rpc("session_delete", { p_session: old.id, p_secret: old.secret }).catch(() => {});
}

function connectSeats() {
  seatsEnabled = PROJECT_URL && PROJECT_KEY ? true : null;
  syncSeats();
  setInterval(syncSeats, 20000);
  window.addEventListener("online", syncSeats);
}

function ownPageFromUrl() {
  const hit = /^#v\.([a-z0-9-]+)\.([a-z0-9-]+)\.([a-z0-9]{6,24})$/.exec(location.hash || "");
  if (!hit) return null;
  return { adventure: hit[1], roleId: hit[2], accessCode: hit[3], status: "loading", data: null, open: false };
}

function startOwnPage() {
  renderOwn();
  setInterval(tickOwnClock, 1000);
  if (!PROJECT_URL || !PROJECT_KEY) { own.status = "noServer"; renderOwn(); return; }
  fetchOwn();
  setInterval(() => { if (!document.hidden) fetchOwn(); }, 5000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) fetchOwn(); });
  window.addEventListener("online", fetchOwn);
}

let lastOwnJson = "";
async function fetchOwn() {
  try {
    const data = await rpc("seat_read", { p_access: own.accessCode });
    const fresh = JSON.stringify(data);
    if (fresh === lastOwnJson && own.status !== "loading") return;
    lastOwnJson = fresh;
    own.data = data;
    own.status = data ? "ok" : "empty";
    renderOwn();
  } catch (e) {
    if (own.status === "loading") { own.status = "offline"; renderOwn(); }
  }
}

function seenSecrets() {
  try { return JSON.parse(localStorage.getItem("valdrien-seen-" + own.accessCode) || "[]"); } catch (e) { return []; }
}
function markSecretSeen(id) {
  const list = seenSecrets();
  if (!list.includes(id)) list.push(id);
  try { localStorage.setItem("valdrien-seen-" + own.accessCode, JSON.stringify(list)); } catch (e) {}
  renderOwn();
}

function secretsHtml(d) {
  const list = d && Array.isArray(d.secrets) ? d.secrets : [];
  if (!list.length) return "";
  const seen = seenSecrets();
  return `
    <section class="secret-list" aria-label="Geheime Ereignisse">
      <span class="label">Nur für dich</span>
      ${list.map(p => {
        const fresh = !seen.includes(p.id);
        const consequence = p.kind === "task"
          ? (p.status === "open" ? `Geheime Aufgabe: Schaffst du es, gibt es ${signed(p.coins)} Münzen. Sag dem Spielleiter Bescheid, wenn du es geschafft hast.`
            : p.status === "done" ? `Geschafft: ${signed(p.coins)} Münzen gebucht.` : "Nicht geschafft.")
          : (p.coins ? `${signed(p.coins)} Münzen, schon gebucht.` : "");
        return `
        <article class="secret-card ${fresh ? "new" : ""}">
          ${fresh ? `<span class="chip chip-gold">Neu</span>` : ""}
          <strong class="secret-title">${escapeName(p.title || "")}</strong>
          <p>${escapeName(p.text || "")}</p>
          ${consequence ? `<p class="muted">${consequence}</p>` : ""}
          ${fresh ? `<button class="btn-quiet" onclick="markSecretSeen('${escapeName(p.id)}')">Gelesen</button>` : ""}
        </article>`;
      }).join("")}
    </section>`;
}

function renderOwn() {
  document.getElementById("app").innerHTML = screenOwnPage();
  document.querySelector(".app-bar").hidden = true;
  document.body.classList.add("own-page");
  document.getElementById("backdrop").hidden = true;
}

function tickOwnClock() {
  const field = document.getElementById("own-time");
  const d = own && own.data;
  if (field && d && d.timerEnd) field.textContent = timeText(Math.max(0, d.timerEnd - Date.now()));
}

function screenOwnPage() {
  const a = ADVENTURES[own.adventure];
  const r = a && a.roles.find(x => x.id === own.roleId);
  const d = own.data;
  if (!a || !r) return `
    <div class="own-header"><span class="eyebrow">Valdrien</span><h1>Deine Rolle</h1></div>
    <p class="note">${contentSource === "live" ? "Diese Rolle gibt es nicht mehr. Frag am Tisch nach einem neuen QR-Code." : "Die Rolle wird geladen …"}</p>`;

  let coinsHtml;
  if (own.status === "loading") {
    coinsHtml = `<p class="muted">Verbinde mit dem Spieltisch …</p>`;
  } else if (own.status === "noServer") {
    coinsHtml = `<p class="muted">Deine Münzen siehst du am Spielleiter-Handy.</p>`;
  } else if (own.status === "empty") {
    coinsHtml = `<p class="muted">Noch keine Münzen vom Spieltisch. Sie erscheinen, sobald das Spielleiter-Handy Netz hat.</p>`;
  } else if (own.status === "offline") {
    coinsHtml = `<p class="muted">Gerade keine Verbindung. Deine Münzen erscheinen, sobald wieder Netz da ist.</p>`;
  } else {
    const status = !d.revealed ? `<span class="chip">noch nicht erraten</span>`
      : d.abilityUsed ? `<span class="chip">erraten</span><span class="chip">Fähigkeit benutzt</span>`
      : `<span class="chip">erraten</span><span class="chip chip-forest">Fähigkeit bereit</span>`;
    coinsHtml = `
      <span class="label">Deine Münzen</span>
      <span class="own-count">${Number(d.coins) || 0}<span class="coin-icon" aria-hidden="true"></span></span>
      <div class="chips">${status}</div>
      ${d.phase === "running" && d.timerEnd ? `<span class="own-clock">Nächstes Ereignis in <strong id="own-time">${timeText(Math.max(0, d.timerEnd - Date.now()))}</strong></span>` : ""}
      ${d.phase === "start" ? `<span class="own-clock">Das Abenteuer beginnt gleich.</span>` : ""}
      ${d.phase === "end" ? `<span class="own-clock">Das Abenteuer ist zu Ende. Am Tisch wird jetzt gezählt.</span>` : ""}`;
  }
  const notes = d && Array.isArray(d.notes) ? d.notes.map(h => `<p class="note">${escapeName(h)}</p>`).join("") : "";

  return `
    <div class="own-header">
      <span class="eyebrow">${a.title}</span>
      <h1>${d && d.name ? escapeName(d.name) : "Deine Rolle"}</h1>
    </div>
    <div class="own-coins" aria-live="polite">${coinsHtml}</div>
    ${notes}
    ${secretsHtml(d)}
    ${own.open ? `
      ${roleCard(r)}
      <button class="btn-quiet" onclick="own.open = false; renderOwn()">Rolle verdecken</button>` : `
      <div class="covered">
        <span class="card-name">Deine Rolle</span>
        <p class="muted">Verdeckt, damit niemand mitliest.</p>
        <button class="btn" onclick="own.open = true; renderOwn()">Rolle aufdecken</button>
      </div>`}
    <p class="muted" style="text-align:center">Diese Seite aktualisiert sich von selbst. Leg sie dir auf den Home-Bildschirm, dann findest du sie schnell wieder.</p>
  `;
}
