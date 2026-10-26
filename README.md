# Valdrien

Ein Gesellschaftsspiel mit geheimen Rollen, Ereignissen und Minispielen, dazu eine Begleit-App und ein eigenes CMS für alle Inhalte.

## Was in diesem Ordner liegt

| Datei | Wofür |
|---|---|
| `index.html` | Das Spiel. Läuft auf dem Spielleiter-Handy und lädt seine Inhalte live aus Supabase. |
| `cms.html` | Das CMS (die Redaktion). Hier pflegt ihr Abenteuer, Rollen, Minispiele und Ereignisse, gemeinsam und live. |
| `verbindung.js` | Die Adresse deines Supabase-Projekts. **Hier trägst du einmal zwei Werte ein.** Spiel und CMS nutzen dieselbe Datei. |
| `supabase-einrichtung.sql` | Richtet die Datenbank ein. Wird einmal in Supabase ausgeführt. |
| `inhalt.json` | Der komplette Startinhalt beider Abenteuer als eine JSON-Datei (zum Nachschauen und als Sicherung). |
| `startinhalt.js` | Derselbe Inhalt für den Vorschau-Modus des CMS. |

**Ausprobieren ohne Einrichtung:** `cms.html` per Doppelklick öffnen. Solange `verbindung.js` leer ist, läuft das CMS im Vorschau-Modus. Änderungen bleiben dann nur in deinem Browser.

---

## Einrichtung Schritt für Schritt (etwa 20 Minuten)

### 1. Supabase-Projekt anlegen
1. Auf **supabase.com** mit GitHub oder E-Mail ein kostenloses Konto anlegen.
2. **New project** klicken.
   - Name: `valdrien`
   - Database Password: ein sicheres Passwort ausdenken und notieren (brauchst du im CMS nie)
   - Region: **Central EU (Frankfurt)**
3. Etwa 2 Minuten warten, bis das Projekt bereit ist.

### 2. Datenbank einrichten
1. Links auf **SQL Editor** klicken, dann **New query**.
2. Die Datei `supabase-einrichtung.sql` in VS Code öffnen, alles markieren (Strg + A), kopieren und in Supabase einfügen.
3. Unten rechts auf **Run** klicken. Unten erscheint „Success. No rows returned“.

> In der Datei steht bei Abschnitt 1 die erste E-Mail-Adresse, die bearbeiten darf: `mikabessel@googlemail.com`. Willst du eine andere verwenden, ändere sie dort **vor** dem Ausführen.

### 3. Den Code auf GitHub hochladen
1. Auf **github.com** ein kostenloses Konto anlegen (falls noch nicht vorhanden).
2. Oben rechts **+** → **New repository**.
   - Name: `valdrien`
   - **Public** auswählen
   - **Create repository**
3. Auf der neuen Seite **uploading an existing file** klicken und alle Dateien aus diesem Ordner hineinziehen. Unten **Commit changes**.
4. Oben **Settings** → links **Pages**.
   - Bei **Branch** `main` und `/ (root)` wählen
   - **Save**
5. Nach 1 bis 2 Minuten steht oben: *Your site is live at* `https://DEINNAME.github.io/valdrien/`.
   Das CMS liegt dann unter `https://DEINNAME.github.io/valdrien/cms.html`.

### 4. Supabase sagen, wohin der Anmeldelink führt
In Supabase links **Authentication** → **URL Configuration**:
- **Site URL:** `https://DEINNAME.github.io/valdrien/cms.html`
- Bei **Redirect URLs** auf **Add URL** klicken und `https://DEINNAME.github.io/valdrien/**` eintragen.
- **Save**

### 5. CMS mit Supabase verbinden
1. In Supabase links unten **Project Settings** → **API** (in neueren Versionen: **API Keys**).
2. Zwei Werte kopieren:
   - **Project URL** (sieht aus wie `https://abcdefgh.supabase.co`). Steht sie nicht auf dieser Seite, findest du sie unter **Data API**.
   - **anon public** Key: eine sehr lange Zeichenkette. Gibt es zwei Reiter, nimm ihn aus **Legacy API Keys**.
3. Auf GitHub die Datei `verbindung.js` öffnen und auf den **Stift** (Bearbeiten) klicken.
4. Die beiden Werte zwischen die Anführungszeichen setzen:
   ```js
   window.VALDRIEN_VERBINDUNG = {
     url: "https://abcdefgh.supabase.co",
     anonKey: "eyJhbGciOi..."
   };
   ```
5. **Commit changes**. Nach etwa einer Minute ist die Änderung online.

> Der anon-Schlüssel ist **öffentlich** und darf auf GitHub stehen. Er erlaubt nur das Lesen. Bearbeiten darf nur, wer sich anmeldet **und** im Team steht. Den Schlüssel **service_role** dagegen nie irgendwo eintragen.

### 6. Anmelden und loslegen
1. `https://DEINNAME.github.io/valdrien/cms.html` öffnen.
2. **Noch kein Passwort? Anmeldelink per E-Mail** wählen, E-Mail-Adresse eingeben und den Link in der Mail öffnen. Am besten im selben Browser, in dem du das CMS benutzen willst.
3. Unter **Team & Verlauf** → **Mein Passwort** ein Passwort festlegen. Ab dann meldest du dich mit E-Mail und Passwort an, auf jedem Gerät, ohne Mail.
4. Unter **Team & Verlauf** weitere Personen per E-Mail-Adresse hinzufügen und ihnen den CMS-Link schicken. Sie machen dann dasselbe: einmal Anmeldelink, dann eigenes Passwort.

> Supabase verschickt im kostenlosen Paket nur **2 Anmeldemails pro Stunde** für das ganze Projekt. Deshalb das Passwort. Wer angemeldet ist, bleibt es in diesem Browser, bis er auf „Abmelden“ klickt.

**Ausgesperrt?** So setzt du dein Passwort direkt in Supabase, ganz ohne Mail. Öffne den **SQL Editor** und führe Folgendes aus, mit deinem Passwort statt `MEIN-PASSWORT`:
```sql
update auth.users
set encrypted_password = extensions.crypt('MEIN-PASSWORT', extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now())
where email = 'mikabessel@googlemail.com';
```
Danach den Verlauf des SQL Editors löschen, damit das Passwort dort nicht stehen bleibt.

---

## So funktioniert das CMS

- **Live zusammenarbeiten:** Jede Änderung wird nach einer kurzen Tipp-Pause gespeichert. Alle anderen sehen sie sofort.
- **Wer arbeitet wo:** Oben rechts siehst du, wer gerade im CMS ist. In der Liste und im Eintrag siehst du, wer am selben Eintrag arbeitet.
- **Kein Überschreiben:** Gespeichert wird immer nur das eine Feld, das sich geändert hat. Zwei Personen, die gleichzeitig verschiedene Felder bearbeiten, stören sich nicht. Am selben Feld gewinnt, wer zuletzt tippt.
- **Verlauf:** Unter **Team & Verlauf** steht, wer wann was geändert hat.
- **Sicherung:** Unter **JSON-Datei** lädst du den gesamten Inhalt als `inhalt.json` herunter oder spielst eine Sicherung wieder ein.
- **Spielmechaniken:** Bei Fähigkeiten und Ereignissen wählst du aus einer Liste, was die App tun soll, zum Beispiel „Alle erhalten 1 Münze“. Neue Mechaniken müssen programmiert werden. Alles andere (Texte, Zahlen, neue Rollen, Minispiele, Ereignisse, ganze Abenteuer) könnt ihr frei anlegen.
- **Spielbarkeit prüfen:** Unter **Abenteuer** zeigt das CMS, ob ein Abenteuer spielbar ist, zum Beispiel ob genug Rollen da sind und ob es für jede Kategorie ein Minispiel gibt.

## Aufbau der JSON-Datei

```text
{
  "format": 1,
  "welt": { "name", "spruch" },
  "abenteuer": {
    "wald": {
      "pos", "name", "setting",
      "geschichte":  { "titel", "absaetze": [...], "schluss" },
      "schlusstext": { "titel", "vorher": [...], "nachher": [...] },   ← {sieger} wird ersetzt
      "begriffe":    { "frage", "spieler", "mehrzahl", "dativ", "beenden" },
      "rollen": {
        "magnus": { "pos", "name", "bezeichnung", "startkapital", "hintergrund", "charakter",
                    "merkmale": [...],
                    "faehigkeit": { "name", "text", "mechanik" },
                    "aufgabe":    { "name", "text", "bonus" } }
      },
      "minispiele": {
        "wortgefecht": { "pos", "name", "kategorie", "beschreibung", "belohnung": { "sieger": 2, "verlierer": -1 } }
      },
      "ereignisse": {
        "goldregen": { "pos", "name", "kategorie", "sichtbarkeit": "oeffentlich" | "privat", "beschreibung", "wirkung" }
      }
    }
  }
}
```

Einträge sind nach Kennung (`"magnus"`) statt als Liste gespeichert. So können mehrere Personen gleichzeitig Einträge anlegen und umsortieren, ohne sich zu stören. Die Reihenfolge steht in `pos`.

**Öffentlich abrufen** (zum Beispiel für die Spiel-App):
`https://DEIN-PROJEKT.supabase.co/rest/v1/inhalt?id=eq.valdrien&select=daten&apikey=DEIN-ANON-KEY`
Die fertige Adresse zeigt dir das CMS unter **JSON-Datei**.

## Das Spiel

Das Spiel liegt unter `https://DEINNAME.github.io/valdrien/`. Auf dem iPhone: in Safari öffnen → Teilen → **Zum Home-Bildschirm**.

- **Live-Inhalte:** Beim Start lädt das Spiel den aktuellen Inhalt aus Supabase. Ändert jemand etwas im CMS, steht es nach wenigen Sekunden im Spiel, auch mitten in einer Partie.
- **Laufende Partien bleiben stimmig:** Wird während einer Partie eine Rolle gelöscht, behält der Spieler sie bis zum Ende. Gelöschte oder privat gewordene Ereignisse kommen nicht mehr aus dem Stapel. Neue Einträge sind sofort dabei, neue Rollen ab der nächsten Partie.
- **Ohne Netz (z. B. im Wald):** Das Spiel merkt sich den zuletzt geladenen Inhalt und funktioniert damit weiter. Öffne es einmal vor der Wanderung mit Netz. Gab es noch nie eine Verbindung, nimmt es den eingebauten Startinhalt.
- **Neue Abenteuer:** Sie erscheinen automatisch in der Auswahl. Spielbar werden sie, sobald sie mindestens 3 Rollen und 1 öffentliches Ereignis haben.
- **QR-Codes:** Jede Rollenkarte hat einen QR-Code. Er öffnet auf dem Handy des Spielers seine eigene Seite mit Rolle, Münzen, Countdown und geheimen Ereignissen. Sie aktualisiert sich alle paar Sekunden von selbst. Die Spieler brauchen kein Konto.
- **Geheime Ereignisse:** Ereignisse, die im CMS auf „Privat“ stehen, gehen an einen einzelnen Spieler. Am Spielleiter-Handy steht nur „Geheimes Ereignis für Ben“, den Text sieht Ben auf seinem Handy. Bei „Sofort“ bucht die App die Münzen gleich. Bei „Aufgabe“ bestätigt der Spielleiter im Geldbeutel, ob sie geschafft wurde. Ohne eigenes Handy kann der Spielleiter die Karte auch auf seinem Handy zeigen.
- **Sicherheit:** Jede Partie hat einen geheimen Spielleiter-Schlüssel. Nur das Spielleiter-Handy kann die Spielerseiten beschreiben. Jede Spielerseite ist nur mit dem Code aus ihrem QR-Code lesbar. Partien werden nach 3 Tagen automatisch gelöscht.
