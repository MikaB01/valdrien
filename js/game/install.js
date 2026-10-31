// Install as an app. Chrome, Edge and Samsung Internet hand out a beforeinstallprompt; we keep it for our own button
// (menu and start screen). iOS has no prompt: the install screen explains "Zum Home-Bildschirm".
let installPrompt = null;

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
    .catch(e => console.warn("Service worker not registered", e)));
}

function runningAsApp() {
  return matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches
    || navigator.standalone === true;
}
function appleMobile() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function canInstall() { return !runningAsApp() && Boolean(installPrompt || appleMobile()); }

// Only the start screen and the menu show the install entry. The player page (QR) has no frame, so `own` skips it;
// before main.js has run, `own` is not initialised yet and main.js renders anyway.
function refreshInstallEntry() {
  try { if (!own && (state.screen === "start" || sheet === "menu")) render(); } catch (e) {}
}

addEventListener("beforeinstallprompt", e => { e.preventDefault(); installPrompt = e; refreshInstallEntry(); });
addEventListener("appinstalled", () => { installPrompt = null; refreshInstallEntry(); });

function installApp() {
  if (!installPrompt) { openReference("install"); return; }
  const prompt = installPrompt;
  installPrompt = null; // a prompt can be shown only once
  sheet = null;
  prompt.prompt();
  prompt.userChoice.finally(() => render());
}

function screenInstall() {
  const steps = appleMobile() ? `
      <li><span><strong>Teilen öffnen.</strong>In Safari auf das Teilen-Symbol tippen (Quadrat mit Pfeil nach oben). Ab iOS 26 steckt es hinter den drei Punkten in der Leiste unten. In Chrome sitzt es oben rechts in der Adresszeile.</span></li>
      <li><span><strong>Zum Home-Bildschirm.</strong>»Zum Home-Bildschirm« wählen. Steht es nicht in der Liste, ganz nach unten scrollen oder auf »Mehr« tippen.</span></li>
      <li><span><strong>Hinzufügen.</strong>»Als Web-App öffnen« eingeschaltet lassen und auf »Hinzufügen« tippen. Valdrien liegt jetzt mit eigenem Symbol auf dem Home-Bildschirm.</span></li>` : `
      <li><span><strong>Browser-Menü öffnen.</strong>Auf die drei Punkte oben rechts im Browser tippen.</span></li>
      <li><span><strong>App installieren.</strong>»App installieren« oder »Zum Startbildschirm hinzufügen« wählen und bestätigen.</span></li>`;
  return `<div class="stack">
    <div class="heading"><span class="eyebrow">Auf dem Handy</span><h2>Valdrien als App</h2></div>
    <img class="install-icon" src="images/icons/icon-192.png" alt="Das App-Symbol: die Burg aus dem Henkersmahl unter dem Vollmond" width="96" height="96">
    ${runningAsApp() ? `<p>Valdrien läuft auf diesem Gerät schon als App.</p>` : `<ol class="steps">${steps}</ol>`}
    <p class="note">Als App startet Valdrien vom Home-Bildschirm ohne Adressleiste und läuft nach dem ersten Start auch ohne Netz, etwa beim Wandern. Nur die QR-Seiten der Mitspieler brauchen Netz.${appleMobile()
      ? " Auf dem iPhone hat die App ihren eigenen Speicher: Ein Spiel, das gerade in Safari läuft, ist in der App nicht zu sehen." : ""}</p>
  </div>`;
}

Object.assign(SCREENS, { install: screenInstall });
