(function checkMechanics() {
  Object.keys(CATALOG.abilities).filter(k => k && !ABILITIES[k])
    .forEach(k => console.warn(`Ability "${k}" is in the catalog but not implemented in abilities.js`));
  Object.keys(CATALOG.effects).filter(k => !EFFECTS[k])
    .forEach(k => console.warn(`Effect "${k}" is in the catalog but not implemented in effects.js`));
})();

// Start with cached content (offline) or the built-in content; the live version follows.
(function loadInitialContent() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("valdrien-content") || "null"); } catch (e) {}
  if (saved && applyContent(saved.data, "cached")) contentVersion = saved.version || 0;
  else applyContent(window.VALDRIEN_INITIAL_CONTENT, "builtin");
})();

// Opened via QR code: show only this player's own page.
own = ownPageFromUrl();
if (own) {
  startOwnPage();
} else {
  load();
  applyContent(lastContent, contentSource); // again, now with the slots of the saved game
  state.cardVisible = false;
  if (state.peekRole) state.peekRole.open = false;
  render();

  setInterval(tick, 1000);
  document.addEventListener("visibilitychange", tick);

  connectSeats();
}

fetchContent();
subscribeContent();
