# SHS-EZ – Verbindliche Architektur-, Rollen- und Betriebsregeln

Diese Regeln gelten **ausnahmslos** für alle Änderungen am Projekt **SHS-EZ (Suchhundestaffel Einsatzzentrale)** und dürfen niemals ohne ausdrückliche Anweisung des Users geändert oder umgangen werden.

## 1. Login-Ablauf & Zwei getrennte Auswahlseiten (`src/components/LoginScreen.tsx`)
- **Niemals die Auswahlseite nach dem Login überspringen!**
- Nach erfolgreicher Passwort-/PIN-Prüfung in `handleVerifyCredentials` (`src/components/LoginScreen.tsx`) muss **immer** `setVerifiedUser(foundUser)` gesetzt werden.
- Es gibt **zwei klar getrennte Auswahlseiten**, abhängig davon, ob ein Einsatz aktiv ist (`hasActiveOps`: `status === 'active' || status === 'paused'`) oder nicht:

### A) Auswahlseite OHNE aktiven Einsatz (`!hasActiveOps` – Bereitschaftsmodus, inkl. nur angelegte Einsätze `planned`)
- **Keine** Unterscheidung für Admins zwischen „In der EZ“ und „Als Sucher“!
- Auswahlmöglichkeiten:
  1. **🛡️ Als Admin anmelden** (sofern der User Admin/EL-Rechte besitzt – ein einfacher Button ohne EZ/Sucher-Aufteilung)
  2. **🦺 Als aktiver Nutzer anmelden** (Bereitschaftsmodus)
  3. **👁️ Als Gast / Betrachter** (reine Leseansicht ohne eigenen Standort)
  4. **🛰️ Persönlicher Trackingtest (10 / 20 / 30 Min.)** (separat, darf jeder)
- **Karten- & Tracking-Verhalten ohne aktiven Einsatz:**
  - Es werden lediglich die **aktuellen Standorte (Pins)** der angemeldeten Nutzer (Admins & aktive Nutzer) auf der Karte angezeigt – **ohne Aufzeichnung einer Trackingspur (Linie)** und ohne Bündelung im EZ-Pin.

### B) Auswahlseite BEI AKTIVEM EINSATZ (`hasActiveOps` – `status === 'active' || status === 'paused'`)
- **Nur im aktiven Einsatz** melden sich Admins entweder **in der EZ** oder **als Sucher** an:
  1. **Für Admins / Einsatzleitung (`isUserAdminOrEL`):**
     - **🏢 In der EZ (`ez_command`):** Kein GPS-Tracking / keine Trackingspur-Aufzeichnung. Werden auf der Karte **nicht** als gesonderter Pin angezeigt, sondern direkt **im EZ-Pin (`📡 EZ`)** aufgeführt.
     - **🦺 Als Sucher (`searcher`):** Eigener Pin auf der Karte. Sobald bereit gesetzt, wird die Suchspur aufgezeichnet.
  2. **Für Sucher / Einsatzkräfte:**
     - **🦺 Als Sucher anmelden (`searcher`):** Sobald sie vom Admin bereit gesetzt werden (per Barcode-Scan oder Button `🟢 Bereit`), werden sie getrackt und ihre Suchspur wird auf der Karte aufgezeichnet, um am Ende genau zu sehen, wo gesucht wurde und wo nicht.
  3. **👁️ Als Gast / Betrachter:** Reine Leseansicht der Einsatzkarte ohne eigenes GPS-Tracking.
  4. **🛰️ Persönlicher Trackingtest (10 / 20 / 30 Min.):** Eigenständige, separate Funktion der App (darf jeder jederzeit starten).

## 2. Einsatz-Status, Farbschema & Lebenszyklus
- **Bereitschaft (kein Einsatz aktiv)**: **⚪ Weiß**
- **Angelegter Einsatz (`status === 'planned'`, noch nicht gestartet)**:
  - Farbe: **⚪ Weiß** (*niemals Grün!*).
  - Aktionen: Hat einen **„▶️ Starten“**-Button und einen **„🗑️ Entfernen“**-Button (*keinen „🛑 Beenden“-Button!*).
  - Archiv: Angelegte Einsätze (`status === 'planned'`) gehören **nicht** ins Einsatzarchiv (`src/components/OperationsArchive.tsx`), sondern werden separat unter den vorbereiteten/angelegten Einsätzen geführt.
  - Regeln: Für angelegte Einsätze gelten **noch keine** Aktiv-Einsatz-Sperrregeln (erst ab Start!).
- **Realeinsatz (`!isTraining`)**:
  - Aktiv (`status === 'active'`): **🔵 Blau**
  - Pausiert (`status === 'paused'`): **🔴 Rot**
- **Übung (`isTraining === true`)**:
  - Aktiv (`status === 'active'`): **🟡 Gelb**
  - Pausiert (`status === 'paused'`): **🟠 Orange**

## 3. Rollen- & Schutzregeln bei laufendem Einsatz (`status === 'active' || status === 'paused'`)
- **First-Admin / App-Owner (`Maria`, `id === 'user-maria'`, `isFirstAdmin: true`)**:
  - Ist unantastbar: Darf niemals gelöscht, gesperrt oder in den Rechten (`Admin`) beschnitten werden.
- **Mindestbesetzung im laufenden/pausierten Einsatz**:
  - Solange ein Einsatz den Status `active` oder `paused` hat, müssen **mindestens 1 Admin** und **mindestens 1 Einsatzleitung (EL)** aktiv eingeloggt bleiben.
  - Ein Rollenwechsel (z. B. auf Gast) oder Logout des letzten aktiven Admins bzw. der letzten Einsatzleitung muss verhindert werden.
- **Sektor-Zuweisung**:
  - Im Sektor-Editor muss bei Einsatzkräften, die bereits einem anderen Sektor zugewiesen sind, eine deutliche Doppelzuweisungs-Warnung (`⚠️ In: Sektor X`) angezeigt werden.

## 4. Karten-Bedienoberfläche (`src/components/TacticalMap.tsx` & `src/components/FloatingMapControlsBar.tsx`)
- Die Buttons für **Karten-Darkmode (Mond/Sonne)** und **Drohnen-Stream (Funkantenne `RadioTower`)** befinden sich gesammelt im oberen rechten Bedienfenster (**Wetter / GPS / Ebenen** in `src/components/TacticalMap.tsx`), nicht verstreut in der unteren Zoom-Leiste.
