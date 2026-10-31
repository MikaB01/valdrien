function screenQuickGuide() {
  return `<div class="speakable stack">
    ${speakButton()}
    <div class="heading"><span class="eyebrow">Kurzanleitung</span><h2>In einer Minute erklärt</h2></div>
    ${rolesForGuide() ? `<ol class="steps">
      <li><span><strong>Du hast ein Geheimnis.</strong>Jeder bekommt heimlich eine Rolle. Spiel sie durch dein Verhalten, aber nicht zu deutlich.</span></li>
      <li><span><strong>Rate, wer die anderen sind.</strong>Ein Tipp kostet ${coinsText(RULES.guessCost)}. Liegst du richtig, bekommst du ${coinsText(RULES.hitReward)}.</span></li>
      <li><span><strong>Erraten werden hat zwei Seiten.</strong>Deine Tarnung ist weg, dafür wird deine besondere Fähigkeit frei. Du darfst sie einmal einsetzen.</span></li>
      <li><span><strong>Unterwegs passiert etwas.</strong>${intervalText()} deckt die App ein Ereignis oder ein Minispiel auf. Ereignisse und Minispiele bringen oder kosten Münzen.</span></li>
      ${keysForGuide() ? keysStep() : `<li><span><strong>Am Ende wird gezählt.</strong>Deine Münzen plus der Bonus für deine geheime Aufgabe. Wer die meisten hat, gewinnt.</span></li>`}
    </ol>` : `<ol class="steps">
      <li><span><strong>Sammle Münzen.</strong>Jeder startet mit ${coinsText(RULES.startingCoinsFallback)}. Diesmal spielt ihr ohne geheime Rollen.</span></li>
      <li><span><strong>Unterwegs passiert etwas.</strong>${intervalText()} deckt die App ein Ereignis oder ein Minispiel auf. Ereignisse und Minispiele bringen oder kosten Münzen.</span></li>
      <li><span><strong>Manches bleibt geheim.</strong>Geheime Ereignisse gehen nur an einen von euch. Für ${coinsText(RULES.privateCardCost)} kann sich jeder selbst eine geheime Karte kaufen.</span></li>
      ${keysForGuide() ? keysStep() : `<li><span><strong>Am Ende wird gezählt.</strong>Wer die meisten Münzen hat, gewinnt.</span></li>`}
    </ol>`}
    <p class="note">Die App rechnet alle Münzen mit. Ihr tippt nur an, was passiert ist.</p>
  </div>`;
}

// During a game the dealt game decides, before it the settings.
function rolesForGuide() { return state.running && state.players && state.players.length ? rolesOn() : settings.roles !== false; }

// In a running game with the keys goal (Henkersmahl), the last step explains the breakout instead of the count.
function keysForGuide() { return Boolean(state.running && state.players && state.players.length && keysGoal()); }
function keysStep() {
  return `<li><span><strong>Kauf dir die Freiheit.</strong>Ein Schlüssel kostet gerade ${coinsText(keyPrice())} und ist zufällig aus Eisen, Silber oder Knochen. Je mehr der Kerkermeister trinkt, desto billiger wird er. Nur du siehst deine Schlüssel. Wer zuerst alle drei verschiedenen hat, bricht aus und gewinnt sofort.</span></li>`;
}

function openQuickGuide() { openReference("quickGuide"); }

function screenRules() {
  return `<div class="speakable stack">
    ${speakButton()}
    <h2>Regelwerk</h2>
    <button class="tile tile-wide tile-secret" onclick="openReference('quickGuide', 'rules')">
      ${icon("lightning")}
      <span class="tile-body">
        <span class="tile-title">Kurzregeln</span>
        <span class="tile-text">Das Spiel in einer Minute erklärt</span>
      </span>
    </button>
    <div class="rules">
      <section>
        <h3>Ziel des Spiels</h3>
        <p>Sammle bis zum Ende des Abenteuers die meisten Münzen. Wer am Ende vorne liegt, gewinnt: In der Waldgilde wird er aufgenommen, im Goldenen Krug wird er Stammgast. Im Verlies zählt etwas anderes, siehe unten.</p>
      </section>

      <section>
        <h3>Das Henkersmahl im Verlies: Schlüssel statt Münzen</h3>
        <ul>
          <li><strong>Ziel:</strong> Wer zuerst einen Eisen-, einen Silber- und einen Knochenschlüssel besitzt, bricht aus und gewinnt. Die Partie endet in diesem Moment.</li>
          <li><strong>Schlüssel kaufen:</strong> Jederzeit, für jeden, beim Kerkermeister (Knopf „Schlüssel kaufen“ auf der Hauptseite). Welcher Schlüssel herauskommt, ist Zufall: ${RULES.keys.map(k => `${k.name} ${Math.round(k.chance * 100)} %`).join(", ")}.</li>
          <li><strong>Der Preis:</strong> Zu Beginn ist der Kerkermeister fast nüchtern und verlangt ${coinsText(RULES.keyPrice.start)} für einen Schlüssel. Fünf Ereigniskarten erzählen, wie er im Lauf der Nacht weitertrinkt. Jede davon macht einen Schlüssel um 1 Münze billiger, bis er am Ende nur noch ${coinsText(RULES.keyPrice.min)} kostet. Früh kaufen ist teuer, warten ist riskant.</li>
          <li><strong>Geheim:</strong> Nur der Käufer sieht, welchen Schlüssel er bekommt. Seine Schlüssel sieht jeder nur selbst unter „Nachsehen“ oder auf seinem eigenen Handy. Doppelte Schlüssel werden mitgezählt, öffnen aber keine weitere Tür.</li>
          <li><strong>Münzen</strong> sind hier nur Mittel zum Zweck: Ereignisse, Minispiele, Raten und Fähigkeiten bringen sie, der Kerkermeister nimmt sie.</li>
          <li><strong>Keine geheimen Aufgaben:</strong> Im Verlies haben die Rollen nur ihre Fähigkeit. Wer hier sitzt, hat genug damit zu tun, hinauszukommen.</li>
          <li><strong>Kein Ausbruch:</strong> Beendet ihr die Nacht vorher („Der Henker kommt“ im Menü), gewinnt, wer die meisten verschiedenen Schlüssel hat, dann die meisten Schlüssel, dann die meisten Münzen.</li>
        </ul>
      </section>

      <section>
        <h3>Vorbereitung</h3>
        <ol>
          <li>Wählt ein Abenteuer. Dann geben ${RULES.minPlayers} Spieler bis so viele, wie das Abenteuer Rollen hat, ihre Namen ein (zum Beispiel 7 in der Waldgilde, 8 in der Taverne, 10 im Verlies).</li>
          <li>Die App verteilt die Rollen zufällig und geheim.</li>
          <li>Das Handy wird herumgereicht. Jeder sieht nur seine eigene Rolle mit Fähigkeit und geheimer Aufgabe (im Verlies ohne Aufgabe).</li>
          <li>Gefällt dir deine Rolle nicht, darfst du sie weglegen und eine neue ziehen, so oft wie in den Einstellungen festgelegt. Eine weggelegte Rolle bekommt niemand mehr zu sehen. Reichen die übrigen Rollen nicht, damit jeder gleich oft neu ziehen kann, senkt die App die Zahl für alle gleich. Reicht es nicht einmal für eine zweite Rolle pro Kopf, weist die App darauf hin, und ihr klärt untereinander, wer neu ziehen darf.</li>
          <li>Jeder startet mit dem Startkapital seiner Rolle (3 bis 5 Münzen).</li>
        </ol>
      </section>

      <section>
        <h3>Trinkspiel (Verlies)</h3>
        <p>Im Henkersmahl gibt es Ereigniskarten, geheime Handkarten und Minispiele mit Trinkrunden und Trinkregeln. Sie kommen nur vor, wenn in den Einstellungen das Trinkspiel eingeschaltet ist, sonst spielt ihr ganz normal ohne sie. Die Einstellung gilt sofort, auch mitten in einer Partie; eine Trinkkarte, die schon jemand auf der Hand hat, lässt sich dann erst wieder einsetzen, wenn das Trinkspiel an ist. Alkohol ist auch im Trinkspiel nie Pflicht.</p>
      </section>

      <section>
        <h3>Ohne Rollen spielen</h3>
        <p>In den Einstellungen lassen sich die geheimen Rollen vor einer Partie abschalten. Dann gibt es kein Raten, keine Fähigkeiten und keine geheimen Aufgaben. Ereigniskarten, die Rollen brauchen, bleiben aus dem Stapel. Jeder startet mit ${coinsText(RULES.startingCoinsFallback)}, es spielen ${RULES.minPlayers} bis ${RULES.maxPlayersWithoutRoles} Spieler, und am Ende zählen nur die Münzen.</p>
      </section>

      <section>
        <h3>Während des Abenteuers</h3>
        <ul>
          <li><strong>Rolle spielen:</strong> Stelle deine Rolle durch dein Verhalten dar, aber nicht zu offensichtlich.</li>
          <li><strong>Rollen erraten:</strong> Beobachte die anderen und versuche, ihre Rollen zu erraten. Du darfst jederzeit und so oft du willst raten. Jeder Tipp kostet ${coinsText(RULES.guessCost)}, ${stakeText("wer keine Münze hat", "wer nicht genug Münzen hat")}, kann nicht raten. Manche Ereigniskarten ändern das für eine Weile. Eine Rolle, die schon erraten wurde, kann nicht noch einmal erraten werden.</li>
          <li><strong>Treffer oder daneben:</strong> Liegst du richtig, bekommst du ${coinsText(RULES.hitReward)}, und die Fähigkeit des Erratenen wird freigeschaltet. Liegst du falsch, ${stakeText("ist die gesetzte Münze", "sind die gesetzten Münzen")} verloren.</li>
          <li><strong>Fähigkeiten:</strong> Jede Fähigkeit darf nur einmal pro Partie eingesetzt werden. Ihr setzt sie über »Besondere Fähigkeit einsetzen« auf der Spielübersicht ein, die App erledigt den Rest.</li>
          <li><strong>Ereignisse und Minispiele:</strong> Unerwartete Begegnungen und kleine Herausforderungen bringen Münzen. ${intervalText()} deckt die App automatisch eine Ereigniskarte oder ein Minispiel auf (das Verhältnis lässt sich in den Einstellungen festlegen). Ereigniskarten lösen keine Minispiele aus: Es kommt entweder eine Karte oder ein Minispiel. Die Uhr oben rechts auf der Hauptseite hält ihr mit einem Tipp an und lasst sie genauso weiterlaufen. Manche Fähigkeiten lösen zusätzlich Ereignisse aus. Unter jeder Karte verteilt ihr die Münzen direkt per Knopfdruck. Das gilt auch für Minispiele. Karten, die gerade nichts bewirken würden, bleiben im Stapel, bis sie etwas bewirken: „Alle Erratenen verlieren 1 Münze“ kommt zum Beispiel erst, wenn mindestens eine Rolle erraten wurde. Gespielte Karten und Minispiele kommen in dieser Partie nicht noch einmal. Sind alle Ereigniskarten oder alle Minispiele gespielt, kommt nur noch die andere Sorte, bis ihr die gespielten auf der Hauptseite neu einmischt.</li>
          <li><strong>Geheime Ereignisse:</strong> Manche Karten gehen nur an einen einzelnen Spieler. Er liest sie heimlich auf dem Spielleiter-Handy unter „Geheim nachsehen“ oder, wenn er mag, auf seinem eigenen Handy (QR-Code, freiwillig). Alle anderen erfahren nur, dass etwas geschehen ist. Ist es eine geheime Aufgabe, sagt er dem Spielleiter Bescheid, wenn er sie geschafft hat. Der bestätigt das im Geldbeutel. Wer eine Karte vorzeigen muss, etwa um zu beweisen, dass er eine Frage stellen darf, tippt sie unter „Nachsehen“ an: Dann zeigt das Handy nur diese Karte groß, ohne Rolle, Münzen oder Schlüssel. Eine Handkarte hebt er auf und setzt sie ein, sobald sie passt: unter „Nachsehen“ steht bei ihr ein Knopf dafür. Karten, die nach einem Verlust oder einem gewonnenen Minispiel wirken, gelten nur, bis die nächste Karte oder das nächste Minispiel kommt. Was du selbst ausgibst, etwa für Schlüssel oder beim Raten, zählt nicht als Verlust. Wer mag, kauft sich auf der Hauptseite für ${coinsText(RULES.privateCardCost)} eine geheime Karte.</li>
          <li><strong>Gleichstand bei Ereignissen:</strong> Betrifft eine Karte den Spieler mit den meisten oder den wenigsten Münzen, sind bei Gleichstand alle Gleichplatzierten betroffen.</li>
          <li><strong>Wer spielt beim Minispiel mit?</strong> Das zeigt die App über jedem Minispiel. Im Duell lost die App einen Spieler aus, und er sucht sich seinen Gegner aus. Braucht eine Fähigkeit ein Duell, kann auch ein anderes Minispiel kommen, das sich zu zweit spielen lässt, aber nie ein Trinkspiel. Bei Einer gegen alle ist meist der Spieler mit den meisten Münzen der Einzelne (manche Minispiele sagen etwas anderes), bei 1 gegen 2 der Riese oder Rausschmeißer, und die zwei mit den wenigsten Münzen sind seine Gegner. Teams lost die App aus, ebenso bei Gleichstand.</li>
          <li><strong>Spielbank:</strong> Münzen für Fähigkeiten und Belohnungen kommen aus einer gemeinsamen Bank.</li>
        </ul>
      </section>

      <section>
        <h3>Spielende</h3>
        <ol>
          <li>Alle Rollen werden enthüllt.</li>
          <li>Jeder weist seine geheime Aufgabe nach, zum Beispiel mit einem Foto oder Gegenstand. Wer sie erfüllt hat, bekommt die Bonusmünzen.</li>
          <li>Die Münzen werden gezählt. Die meisten Münzen gewinnen.</li>
        </ol>
      </section>

      <section>
        <h3>Regeln für unterwegs (Waldgilde)</h3>
        <ul>
          <li>Niemand muss für eine Aufgabe den Weg verlassen.</li>
          <li>Kein Klettern, Rennen und keine gefährlichen Mutproben.</li>
          <li>Tiere und Pflanzen werden nicht gestört oder beschädigt. Mitgenommen wird nur, was bereits am Boden liegt.</li>
          <li>Fotos von Mitspielern nur mit deren Zustimmung.</li>
          <li>Alkohol ist nie Pflicht. Wasser oder Saft tun es genauso.</li>
        </ul>
      </section>

      <section>
        <h3>Regeln am Tisch (Taverne und Verlies)</h3>
        <ul>
          <li>Alkohol ist nie Pflicht, und es gibt kein Wetttrinken. Wasser oder Saft zählen immer genauso.</li>
          <li>Wer den Trunkenbold spielt, spielt ihn nur. Niemand muss dafür mehr trinken.</li>
          <li>Mit Essen wird nicht geworfen.</li>
          <li>Fotos und Videos von Mitspielern nur mit deren Zustimmung.</li>
          <li>Geliehene Gegenstände gehen nach dem Spiel an ihre Besitzer zurück.</li>
          <li>Gruselig darf es werden, aber niemand wird erschreckt, festgehalten oder gegen seinen Willen angefasst.</li>
        </ul>
      </section>

      <section class="open-points no-speak">
        <h3>Noch offen</h3>
        <ul>
          <li>Wie lange dauert eine Partie?</li>
          <li>Was passiert bei einem Gleichstand?</li>
        </ul>
      </section>
    </div>
  </div>`;
}

function openRules() {
  openReference("rules");
}

Object.assign(SCREENS, {
  rules: screenRules,
  quickGuide: screenQuickGuide
});
