# Valdrien

Ein Gesellschaftsspiel mit geheimen Rollen, Ereignissen und Minispielen, dazu eine Begleit-App und ein eigenes CMS für alle Inhalte.

## Was in diesem Ordner liegt

| Datei | Wofür |
|---|---|
| `cms.html` | Das CMS (die Redaktion). Hier pflegt ihr Abenteuer, Rollen, Minispiele und Ereignisse, gemeinsam und live. |
| `verbindung.js` | Die Adresse deines Supabase-Projekts. **Hier trägst du einmal zwei Werte ein.** |
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
2. E-Mail-Adresse eingeben und **Anmeldelink schicken** klicken. Den Link in der Mail öffnen.
3. Unter **Team & Verlauf** weitere Personen per E-Mail-Adresse hinzufügen und ihnen den CMS-Link schicken.

> Supabase verschickt im kostenlosen Paket nur wenige Anmeldemails pro Stunde. Wer angemeldet ist, bleibt es aber auf diesem Gerät, normalerweise wochenlang.

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

## Nächste Etappen
2. Die Spiel-App (`index.html`) liest ihre Inhalte live aus Supabase.
3. Die Münzen und privaten Ereignisse auf den QR-Seiten der Spieler laufen über Supabase, ohne Claude-Konto.
