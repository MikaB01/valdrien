// Read-aloud via the browser's built-in speech synthesis (Web Speech API): on-device voices, no external service, no fees.
// Only containers marked .speakable get a button; roles and secret events never do.
const speech = { supported: "speechSynthesis" in window && "SpeechSynthesisUtterance" in window, button: null };
if (speech.supported) speechSynthesis.getVoices(); // starts loading the voice list

const SPEAK_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>`;
const STOP_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>`;

function speechOn() { return speech.supported && settings.speech !== false; }

function speakButton() {
  if (!speechOn()) return "";
  return `<button class="speak" aria-label="Vorlesen" onclick="toggleSpeak(this)">${SPEAK_ICON}</button>`;
}

function germanVoice() {
  const voices = speechSynthesis.getVoices().filter(v => /^de([-_]|$)/i.test(v.lang));
  const rank = v => (/premium|enhanced|verbessert|natural|neural/i.test(v.name) ? 4 : 0) + (/de[-_]DE/i.test(v.lang) ? 2 : 0) + (v.localService ? 1 : 0);
  return voices.sort((a, b) => rank(b) - rank(a))[0] || null;
}

// One line per block element, so titles and paragraphs are read as separate sentences.
function speakableText(button) {
  const box = button.closest(".speakable");
  if (!box) return "";
  const copy = box.cloneNode(true);
  copy.querySelectorAll(".speak, button, .label, .ornament, .no-speak").forEach(n => n.remove());
  copy.querySelectorAll("h1, h2, h3, p, li, strong, .card-name, .role-title, .winner, .eyebrow").forEach(n => n.append("\n"));
  return copy.textContent.split("\n").map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean)
    .map(line => /[.!?…:»“"]$/.test(line) ? line : line + ".").join(" ");
}

function toggleSpeak(button) {
  const same = speech.button === button;
  stopSpeaking();
  if (same) return;
  const text = speakableText(button);
  if (!text) return;
  const voice = germanVoice();
  speech.button = button;
  button.innerHTML = STOP_ICON;
  button.setAttribute("aria-label", "Vorlesen beenden");
  button.classList.add("speaking");
  duckMusic(true);
  // short utterances: some browsers stop long ones after about 15 seconds
  const parts = text.match(/[^.!?…]+[.!?…]*[»“"]?\s*/g) || [text];
  parts.forEach((part, k) => {
    const u = new SpeechSynthesisUtterance(part.trim());
    u.lang = "de-DE";
    if (voice) u.voice = voice;
    u.rate = 0.95;
    if (k === parts.length - 1) u.onend = u.onerror = () => { if (speech.button === button) stopSpeaking(); };
    speechSynthesis.speak(u);
  });
}

function stopSpeaking() {
  if (!speech.supported) return;
  const b = speech.button;
  speech.button = null;
  speechSynthesis.cancel();
  if (b) {
    b.innerHTML = SPEAK_ICON;
    b.setAttribute("aria-label", "Vorlesen");
    b.classList.remove("speaking");
  }
  duckMusic(false);
}
