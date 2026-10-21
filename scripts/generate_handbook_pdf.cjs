const { jsPDF } = require('jspdf');
const fs = require('fs');
const path = require('path');

// ============================================================================
// STYLING, FARBEN & DESIGNKONSTANTEN
// ============================================================================
const C_DARK = [15, 23, 42];            // Slate 900
const C_NAVY = [30, 41, 59];            // Slate 800
const C_PRIMARY = [16, 185, 129];       // Emerald 500
const C_PRIMARY_LIGHT = [240, 253, 244];// Emerald 50
const C_BLUE = [37, 99, 235];           // Royal Blue 600
const C_BLUE_LIGHT = [239, 246, 255];   // Blue 50
const C_AMBER = [217, 119, 6];          // Amber 600
const C_AMBER_LIGHT = [254, 252, 232];  // Amber 50
const C_RED = [220, 38, 38];            // Red 600
const C_RED_LIGHT = [254, 242, 242];    // Red 50
const C_MUTED = [100, 116, 139];        // Slate 500
const C_BORDER = [226, 232, 240];       // Slate 200
const C_CARD_BG = [248, 250, 252];      // Slate 50
const C_WHITE = [255, 255, 255];

const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4',
});

const pageWidth = 210;
const pageHeight = 297;
const margin = 15;
const contentWidth = pageWidth - 2 * margin; // 180 mm
const bottomMargin = pageHeight - 16;

let curY = 0;

// ============================================================================
// HILFSFUNKTIONEN FÜR DYNAMISCHES LAYOUT & SEITENKÖPFE
// ============================================================================

let activeChapterTitle = '';
let activeChapterSubtitle = '';

function renderPageHeader() {
  doc.setFillColor(...C_PRIMARY);
  doc.rect(margin, 12, contentWidth, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...C_DARK);
  doc.text(activeChapterTitle, margin, 20);

  if (activeChapterSubtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(...C_MUTED);
    doc.text(activeChapterSubtitle, margin, 24.5);
  }

  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, 27.5, pageWidth - margin, 27.5);

  curY = 34;
}

function checkPageBreak(neededHeight) {
  if (curY + neededHeight > bottomMargin) {
    doc.addPage();
    renderPageHeader();
    return true;
  }
  return false;
}

function startChapter(title, subtitle) {
  activeChapterTitle = title;
  activeChapterSubtitle = subtitle;
  doc.addPage();
  renderPageHeader();
}

/**
 * Zeichnet eine Karte mit flexibler dynamischer Höhe.
 * Garantiert sauberes Einbetten aller Zeilen ohne Textüberlauf.
 */
function drawDynamicCard({
  title = '',
  badge = null,
  badgeColor = C_PRIMARY,
  sections = [],
  borderColor = C_BORDER,
  bgColor = C_WHITE,
  padding = 4.5,
  spacingAfter = 4.2,
}) {
  const innerW = contentWidth - (padding * 2);
  let totalH = padding * 2;

  if (title || badge) {
    totalH += 7.5;
  }

  const computedSections = sections.map((sec) => {
    let secH = 0;
    if (sec.heading) secH += 5.2;

    let lines = [];
    if (sec.text) {
      doc.setFont('helvetica', sec.isBold ? 'bold' : 'normal');
      doc.setFontSize(sec.fontSize || 8.3);
      lines = doc.splitTextToSize(sec.text, innerW);
      secH += lines.length * (sec.lineHeight || 4.2);
    }
    return { ...sec, lines, secH };
  });

  computedSections.forEach((s) => {
    totalH += s.secH + (s.gapBelow || 2);
  });

  checkPageBreak(totalH + spacingAfter);

  const startY = curY;

  doc.setFillColor(...bgColor);
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, startY, contentWidth, totalH, 2, 2, 'FD');

  let innerY = startY + padding;

  if (title || badge) {
    if (title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...C_DARK);
      doc.text(title, margin + padding, innerY + 4.5);
    }

    if (badge) {
      doc.setFillColor(...badgeColor);
      const bWidth = doc.getTextWidth(badge) + 6;
      doc.roundedRect(pageWidth - margin - padding - bWidth, innerY, bWidth, 5.5, 1.2, 1.2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...C_WHITE);
      doc.text(badge, pageWidth - margin - padding - bWidth + 3, innerY + 3.8);
    }

    innerY += 7.5;
  }

  computedSections.forEach((s) => {
    if (s.heading) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(s.headingSize || 8.5);
      doc.setTextColor(...(s.headingColor || C_DARK));
      doc.text(s.heading, margin + padding, innerY + 3.8);
      innerY += 5.2;
    }

    if (s.lines && s.lines.length > 0) {
      doc.setFont('helvetica', s.isBold ? 'bold' : 'normal');
      doc.setFontSize(s.fontSize || 8.3);
      doc.setTextColor(...(s.color || C_DARK));
      doc.text(s.lines, margin + padding, innerY + 3.5);
      innerY += s.lines.length * (s.lineHeight || 4.2);
    }

    innerY += s.gapBelow || 2;
  });

  curY = startY + totalH + spacingAfter;
}

function printParagraph(text, isBold = false, color = C_DARK, fontSize = 8.6, spacingAfter = 3.5) {
  doc.setFont('helvetica', isBold ? 'bold' : 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);

  const lines = doc.splitTextToSize(text, contentWidth);
  const neededH = lines.length * 4.3;

  checkPageBreak(neededH + spacingAfter);

  doc.text(lines, margin, curY + 3.5);
  curY += neededH + spacingAfter;
}

function printSectionTitle(title, spacingBefore = 3, spacingAfter = 2) {
  checkPageBreak(10 + spacingBefore + spacingAfter);
  curY += spacingBefore;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C_NAVY);
  doc.text(title, margin, curY + 4);
  curY += 7 + spacingAfter;
}

// ============================================================================
// SEITE 1: TITELBLATT & SYSTEM-ÜBERSICHT
// ============================================================================
doc.setFillColor(15, 23, 42); // Slate 900
doc.rect(0, 0, pageWidth, 102, 'F');

doc.setFont('helvetica', 'bold');
doc.setFontSize(26);
doc.setTextColor(...C_WHITE);
doc.text('SHS-EZ', margin, 34);

doc.setFontSize(13);
doc.setTextColor(52, 211, 153); // Emerald 400
doc.text('Suchhundestaffel Einsatzzentrale', margin, 43);

doc.setFont('helvetica', 'normal');
doc.setFontSize(10);
doc.setTextColor(226, 232, 240);
doc.text('Schritt-fuer-Schritt Bedienungsanleitung & Operativer Einsatzleitfaden', margin, 52);
doc.text('Fuer Einsatzleitung (Admins), aktive Sucher (Hundefuehrer) und Behoerden', margin, 58);

doc.setFillColor(30, 41, 59);
doc.roundedRect(margin, 67, contentWidth, 23, 1.5, 1.5, 'F');

doc.setFont('helvetica', 'bold');
doc.setFontSize(8.2);
doc.setTextColor(52, 211, 153);
doc.text('SYSTEM-STATUS: PRODUKTIV-BETRIEB VERSION 6.4.0', margin + 4, 73.5);

doc.setFont('helvetica', 'normal');
doc.setFontSize(7.8);
doc.setTextColor(203, 213, 225);
doc.text('Plattform: Progressive Web App (PWA) & Native Android App (APK)', margin + 4, 79.5);
doc.text('Herausgeber: Spuerhunde-Salzlandkreis e.V. | Stand: Oktober 2026', margin + 4, 85);

curY = 112;

printSectionTitle('1. Kurzeinfuehrung & Grundarchitektur');

printParagraph(
  'SHS-EZ ist eine hochmoderne, echtzeitbasierte Fuehrungs- und Ortungsplattform, die speziell fuer die ' +
  'Beduerfnisse von Rettungs- und Suchhundestaffeln (Flaechensuche, Mantrailing, Truemmer) entwickelt wurde. ' +
  'Sie vernetzt die Einsatzleitung (EL) in der Zentrale mit den Hundefuehrern im Suchgebiet sowie externen Partnern ' +
  '(Polizei, Feuerwehr, Leitstelle).'
);

printParagraph(
  'Um hoechste Praezision im Einsatz mit maximaler Akkuschonung und absolutem Datenschutz in der Freizeit ' +
  'zu vereinen, arbeitet SHS-EZ in zwei strikt voneinander getrennten Systemmodi:'
);

drawDynamicCard({
  title: '[BEREITSCHAFT] Bereitschaftsmodus (Kein Einsatz aktiv)',
  borderColor: C_BORDER,
  bgColor: C_CARD_BG,
  sections: [
    {
      text: '- Reine Punkt-Ortung: Zeigt angemeldete Helfer lediglich als Standort-Pin auf der Lagekarte.\n' +
            '- KEINE Spuraufzeichnung: Im Bereitschaftsmodus werden keine Wegstrecken aufgezeichnet (Privatsphaere & Akku).\n' +
            '- Automatischer Geister-Filter: Verlaesst ein Helfer die App laenger als 5 Minuten ohne Abmeldung, wird er automatisch als offline markiert. Keine Geister-Pins!\n' +
            '- Ausnahme Trackingtest: Der persoenliche GPS-Hardwaretest darf jederzeit gestartet werden und zeichnet immer eine vollstaendige Testspur auf.',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

drawDynamicCard({
  title: '[AKTIV] Aktiver Einsatz & Uebung (Status aktiv oder pausiert)',
  borderColor: C_BLUE,
  bgColor: C_BLUE_LIGHT,
  sections: [
    {
      text: '- Hochpraezises Suchspur-Tracking: Sobald die EL ein Team auf BEREIT schaltet, wird dessen GPS-Spur lueckenlos live erfasst.\n' +
            '- Prozessor-Wachhaltung (WakeLock): Haelt das Smartphone auch bei gesperrtem Bildschirm in der Jackentasche wach.\n' +
            '- Schutzregel: Mindestens 1 Admin und 1 EL muessen waehrend des gesamten Einsatzes eingeloggt bleiben.\n' +
            '- Taktischer Einsatzfunk: Tastatur-stabiler Textfunk, Notfall-Pager mit Sirenenton und Direkt-PDF-Archivierung.\n' +
            '- Revisionssicherheit: Nach Einsatzende werden alle Spuren, Sektoren und Protokolle dauerhaft gespeichert.',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

// ============================================================================
// TEIL I: SCHRITT-FÜR-SCHRITT FÜR ADMINISTRATOREN & EINSATZLEITUNG
// ============================================================================
startChapter('TEIL I: Handbuch fuer Admins & Einsatzleitung', 'Schritt-fuer-Schritt Anleitung fuer die Fuehrungskraft');

printParagraph(
  'Als Administrator oder Einsatzleitung fuehren Sie den Einsatz operativ, koordinieren die Suchtrupps, ' +
  'teilen Sektoren ein und sichern die behoerdliche Dokumentation. Befolgen Sie diese Schrittfolge:'
);

drawDynamicCard({
  title: 'Schritt 1: Einsatz oder Uebung vorbereiten (Status: planned / Weiss)',
  badge: 'SCHRITT 1',
  badgeColor: C_PRIMARY,
  sections: [
    {
      heading: 'Ziel: Einsatzdaten anlegen, bevor die Teams am Sammelplatz eintreffen.',
      text: '1. Klicken Sie in der Hauptnavigation auf "+ Neuer Einsatz".\n' +
            '2. Name & Einsatzart waehlen: Geben Sie dem Einsatz einen praegnanten Namen (z.B. "Einsatz Bernburg Waldkante") und waehlen Sie, ob es sich um einen Realeinsatz oder eine Staffeluebung handelt.\n' +
            '3. Vermisstenprofil erfassen: Tragen Sie Name, Alter, koerperliche Verfassung, Kleidung und besondere Risiken (z.B. Demenz, Diabetes) ein. Laden Sie optional ein Foto der vermissten Person hoch.\n' +
            '4. Sammelplatz / EZ definieren: Setzen Sie den Treffpunkt auf der Karte per Klick oder GPS.\n' +
            '5. Speichern: Der Einsatz erscheint nun mit weissem Status (planned). In diesem Status greifen noch keine Sperren und anfahrende Kraefte koennen bereits das Einsatzprofil studieren.\n' +
            'WICHTIG: Angelegte Einsaetze haben einen [Starten]- und einen [Entfernen]-Button, aber KEINEN [Beenden]-Button!',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

drawDynamicCard({
  title: 'Schritt 2: Einsatz scharfschalten & starten (Status: active)',
  badge: 'SCHRITT 2',
  badgeColor: C_BLUE,
  sections: [
    {
      heading: 'Ziel: Beginn der aktiven Phase und Aktivierung der Fuehrungsschutzregeln.',
      text: '1. Sobald die Einsatzleitung vor Ort einsatzbereit ist, klicken Sie auf [Starten].\n' +
            '2. Die Statusanzeige faerbt sich sofort gemaess Vorschrift:\n' +
            '   - Realeinsatz: BLAU (active)\n' +
            '   - Staffeluebung: GELB (active)\n' +
            '3. Systemschutz schaltet sich scharf: Ab jetzt muessen mindestens 1 Admin und 1 Einsatzleitung dauerhaft eingeloggt bleiben. Ein versehentlicher Logout der letzten Fuehrungskraft wird vom System blockiert.\n' +
            '4. Der Geister-Filter wird fuer aktive Helfer deaktiviert, damit Sucher bei voruebergehendem Funkloch nicht von der Karte verschwinden.',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

drawDynamicCard({
  title: 'Schritt 3: Kraefteverwaltung & User BEREIT schalten',
  badge: 'SCHRITT 3',
  badgeColor: C_PRIMARY,
  sections: [
    {
      heading: 'Ziel: Freigabe der Suchtrupps zur Spuraufzeichnung.',
      text: 'Sucher zeichnen ihre Suchspur erst auf, wenn sie von der EL ausdruecklich auf BEREIT geschaltet werden!\n\n' +
            'Sie haben dafuer zwei komfortable Moeglichkeiten:\n' +
            'A) Schneller Barcode- / QR-Scan:\n' +
            '   - Oeffnen Sie den Scanner in der App und scannen Sie den digitalen Mitgliedsausweis des Suchers.\n' +
            '   - Der Sucher wird sofort erkannt und auf [BEREIT] gesetzt.\n' +
            'B) Manuelle Freigabe in der Kraefteliste:\n' +
            '   - Oeffnen Sie die Kraefte-Uebersicht.\n' +
            '   - Klicken Sie neben dem Namen des Helfers auf den gruenen Schalter [Bereit].\n\n' +
            'Ergebnis: Das Smartphone des Helfers schaltet in den hochfrequenten GPS-Modus und seine gelaufene Spur wird ab diesem Meter fuer alle live auf der Lagekarte gezeichnet.',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

// ============================================================================
// TEIL I FORTSETZUNG: SEKTOREN, LAGEKARTE, FUNK & FUNDMELDUNGEN
// ============================================================================
startChapter('TEIL I: Admins & EL - Sektoren, Lage & Funk', 'Operative Werkzeuge der Einsatzleitung');

drawDynamicCard({
  title: 'Schritt 4: Suchgebiet & Sektoren anlegen, berechnen & zuweisen',
  badge: 'SCHRITT 4',
  badgeColor: C_PRIMARY,
  sections: [
    {
      heading: 'Ziel: Gezielte Flaechenzuteilung ohne Luecken und ohne Doppelbelegungen.',
      text: '1. Sektor-Editor aufrufen: Klicken Sie in der Kartenansicht auf "Sektoren" und anschliessend auf "+ Neuer Sektor".\n' +
            '2. Flaeche abstecken: Tippen Sie die Eckpunkte des Suchgebiets entlang von Waldkanten, Wegen oder Gelaendemarken auf der Karte ab. Das System schliesst das Polygon automatisch.\n' +
            '3. Hektar- & Umfangsermittlung: Die Flaeche in Hektar (ha) sowie der Umfang in Metern werden in Echtzeit berechnet. Dies ermoeglicht eine praezise Einschaetzung des Zeitbedarfs fuer das Suchhundeteam.\n' +
            '4. Sektor benennen & Suchtrupp zuweisen: Geben Sie dem Sektor eine Kennung (z.B. "Sektor A - Waldstueck Nord") und weisen Sie ueber das Dropdown-Menue den zustaendigen Sucher zu.\n' +
            '5. DOPPELZUWEISUNGS-WARNUNG: Versuchen Sie versehentlich, einen Helfer zuzuweisen, der bereits in einem anderen Sektor eingeteilt ist, blendet das System sofort eine Warnung ein ("Warnung: Bereits in Sektor X"). Dadurch werden Doppelbelegungen zuverlaessig verhindert!\n' +
            '6. Statuspflege: Aendern Sie den Status waehrend des Einsatzes von "Offen" (Gelb) ueber "In Arbeit" (Blau) zu "Abgesucht" (Gruen).',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

drawDynamicCard({
  title: 'Schritt 5: Taktische Lagekarte, Drohnenstream & Nachtmodus',
  badge: 'SCHRITT 5',
  badgeColor: C_BLUE,
  sections: [
    {
      heading: 'Ziel: Maximale Uebersicht ueber alle Kraefte und Gelaendegegebenheiten.',
      text: '- Kartenlayer wechseln: Schalten Sie per Klick zwischen OpenTopoMap (detailreiche topografische Wander- und Forstwege mit Hoehenlinien) und Satelliten-Luftbild (zur Beurteilung von Dickungen und Freiflaechen) um.\n' +
            '- Bedienfenster oben rechts (Wetter / GPS / Ebenen): Hier sind alle wichtigen Sondersteuerungen gebuendelt:\n' +
            '  * Mond/Sonne-Icon: Schaltet den Karten-Nachtmodus (Darkmode) an, um die Nachtsichtfaehigkeit im Wald nicht durch blendende Bildschirme zu zerstoeren.\n' +
            '  * Funkantennen-Icon (RadioTower): Oeffnet das Drohnen-Videofenster, um Luftbilder oder Waermebildkameras direkt auf der Lagekarte einzublenden.\n' +
            '  * GPS-Cockpit: Zeigt die eigene Signalgenauigkeit und Satellitenverbindung an.\n' +
            '- EZ-Pin Buendelung: Fuehrungskraefte, die sich als "In der EZ" angemeldet haben, werden nicht als einzelne Laeufer auf der Karte angezeigt, sondern sauber gebuendelt im Standortmarker der Einsatzzentrale ("EZ").',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

drawDynamicCard({
  title: 'Schritt 6: Einsatzfunk, Pager & Einsatzdokumentation (PDF & Leeren)',
  badge: 'SCHRITT 6',
  badgeColor: C_PRIMARY,
  sections: [
    {
      heading: 'Ziel: Ausfallsichere Kommunikation und fortlaufende Protokollsicherung.',
      text: '- Tastatur-optimierter Textfunk: Das Eingabefeld bleibt auch beim Aufklappen der Smartphone-Tastatur fest am unteren Bildschirmrand verankert. Kein Wegspringen des Chats!\n' +
            '- Pager-Sirenenalarm: Bei dringenden Durchsagen, Rueckzugsbefehlen oder Erstalarmierung loest die EL den Pager aus. Auf den Smartphones aller Teams ertoent ein durchdringender Alarmton.\n' +
            '- WERKZEUG "PDF & LEEREN": Waehrend eines laengeren Einsatzes koennen Chatverlauf, System-Logbuch sowie Alarme mit einem Klick als PDF exportiert und anschliessend geleert werden. Dadurch bleibt die App auf aelteren Handys blitzschnell, waehrend saemtliche Eintraege lueckenlos im revisionssicheren Einsatztagebuch archiviert werden.',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

// ============================================================================
// TEIL I FORTSETZUNG: FUNDMELDUNGEN, PAUSIEREN, BEENDEN & BERICHTE
// ============================================================================
startChapter('TEIL I: Admins & EL - Funde, Abschluss & Archiv', 'Von der Fundmeldung bis zum behoerdlichen Einsatzbericht');

drawDynamicCard({
  title: 'Schritt 7: Fundmeldungen empfangen, pruefen & Rettungskette einleiten',
  badge: 'SCHRITT 7',
  badgeColor: C_AMBER,
  sections: [
    {
      heading: 'Ziel: Sofortige Verifikation von Funden und Alarmierung weiterer Kraefte.',
      text: '1. Sobald ein Suchtrupp einen Fund meldet, ertoent ein akustisches Alarmsignal in der EZ.\n' +
            '2. Die Fundmeldung enthaelt: Exakte GPS-Koordinate, Uhrzeit, Finder-Name, Dringlichkeitsstufe (z.B. Person / Kleidungsstueck) und ein Belegfoto.\n' +
            '3. Verifizieren: Die EL prueft die Daten und setzt per Klick den Fundstellen-Marker auf die taktische Lagekarte. Dieser Marker ist ab sofort fuer alle Kraefte und externe Beobachter sichtbar.\n' +
            '4. Rettungskette aktivieren: Bei Auffinden der Person ueber die hinterlegte Notfallliste sofort Notarzt / Rettungsdienst sowie Polizei alarmieren und Koordinaten uebermitteln.',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

drawDynamicCard({
  title: 'Schritt 8: Einsatz pausieren & fortsetzen (Status: paused)',
  badge: 'SCHRITT 8',
  badgeColor: C_RED,
  sections: [
    {
      heading: 'Ziel: Geordnete Unterbrechung bei Gewitter, Lagebesprechung oder Nachtpause.',
      text: '1. Klicken Sie in der Kopfzeile auf [Pausieren].\n' +
            '2. Der Status wechselt auf ROT (Realeinsatz pausiert) oder ORANGE (Uebung pausiert).\n' +
            '3. Die GPS-Spuraufzeichnung wird temporaer angehalten, damit bei Lagebesprechungen am Zelt keine unnoetigen Punktwolken gezeichnet werden.\n' +
            '4. Alle bisherigen Spuren, Sektoren und Fundmarker bleiben unveraendert sichtbar.\n' +
            '5. Sobald die Suche weitergeht, klicken Sie auf [Fortsetzen] - das Tracking laeuft nahtlos weiter.',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

drawDynamicCard({
  title: 'Schritt 9: Einsatz beenden & Sicherheitspruefung',
  badge: 'SCHRITT 9',
  badgeColor: C_DARK,
  sections: [
    {
      heading: 'Ziel: Vollstaendigkeitsabfrage und Ueberfuehrung ins Archiv.',
      text: '1. Erst wenn alle Suchtrupps das Gelaende vollstaendig verlassen haben und persoenlich am Sammelplatz angetreten sind, klicken Sie auf [Einsatz Beenden].\n' +
            '2. Bestaetigungsdialog: Bestaetigen Sie die Abfrage, dass alle Einsatzkraefte wohlbehalten zurueck sind.\n' +
            '3. Das System schliesst alle offenen Spuren, beendet das GPS-Tracking auf allen Mobilgeraeten und verschiebt den Vorgang in das Einsatzarchiv.\n' +
            '4. Die Aktiv-Einsatz-Sperrregeln werden aufgehoben und die App kehrt in den Bereitschaftsmodus zurueck.',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

drawDynamicCard({
  title: 'Schritt 10: Einsatzberichte, Archiv & Accountverwaltung',
  badge: 'SCHRITT 10',
  badgeColor: C_PRIMARY,
  sections: [
    {
      heading: 'Behoerdlicher Gesamteinsatzbericht (PDF & CSV):',
      text: '- Nach Beendigung kann mit einem Klick der offizielle Einsatzbericht generiert werden.\n' +
            '- Enthaelt Karten-Snapshots, lueckenlose Suchspuren jedes Hundefuehrers, genaue Hektarangaben, alle Funksprueche mit Zeitstempel und Fundstellenfotos.\n' +
            '- CSV-Export fuer uebergeordnete GIS-Systeme von Feuerwehr und Katastrophenschutz.',
      fontSize: 8.2,
      lineHeight: 4.1
    },
    {
      heading: 'Einsatzarchiv & Reaktivierung:',
      text: '- Alle abgeschlossenen Einsaetze koennen im Archiv jederzeit eingesehen werden.\n' +
            '- Reaktivierungs-Option: Sollte am Folgetag eine Nachsuche erforderlich sein, kann der Einsatz reaktiviert werden, sodass alle bisherigen Sektoren und Spuren direkt weitergenutzt werden koennen.',
      fontSize: 8.2,
      lineHeight: 4.1
    },
    {
      heading: 'Benutzer- & Rollenverwaltung:',
      text: '- Admins verwalten die Mitglieder (Rufname, PIN, Rolle: Admin, EL, Sucher, Gast).\n' +
            '- Uebersichtliche Streifendarstellung mit Admins an erster Stelle und anschliessend alphabetischer Sortierung.\n' +
            '- UNANTASTBAR: First-Admin Maria (user-maria) kann weder geloescht noch in den Rechten beschnitten werden.',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

// ============================================================================
// TEIL II: SCHRITT-FÜR-SCHRITT FÜR AKTIVE NUTZER / SUCHER
// ============================================================================
startChapter('TEIL II: Handbuch fuer Sucher & Helfer', 'Schritt-fuer-Schritt Anleitung fuer Einsatzkraefte im Gelaende');

printParagraph(
  'Als Sucher, Hundefuehrer oder Suchtrupphelfer arbeiten Sie direkt im Gelaende. ' +
  'Fuer Sie ist die App bewusst einfach, uebersichtlich und ablenkungsfrei gestaltet. ' +
  'Befolgen Sie diese Schritte von der Alarmierung bis zum Rueckweg:'
);

drawDynamicCard({
  title: 'Schritt 1: Anmeldung am Smartphone & PIN-Eingabe',
  badge: 'SCHRITT 1',
  badgeColor: C_PRIMARY,
  sections: [
    {
      heading: 'Ziel: Schneller und sicherer Login in der App.',
      text: '1. Oeffnen Sie SHS-EZ auf Ihrem Smartphone (als installierte App oder im Chrome-/Safari-Browser).\n' +
            '2. Waehlen Sie Ihren Rufnamen aus der Mitgliederliste aus oder tippen Sie die ersten Buchstaben ein.\n' +
            '3. Geben Sie Ihre 4-stellige persoenliche PIN oder Ihr Passwort ein.\n' +
            '4. Nach erfolgreicher PIN-Pruefung gelangen Sie auf die rollenbasierte Auswahlseite:\n' +
            '   - WENN KEIN EINSATZ AKTIV IST: Tippen Sie auf "[Als aktiver Nutzer anmelden]". Sie sind in Bereitschaft. Ihr Standort-Pin ist sichtbar, es wird jedoch KEINE Spur aufgezeichnet (Akkuschonung).\n' +
            '   - WENN EIN EINSATZ AKTIV IST: Tippen Sie auf "[Als aktiver Nutzer / Sucher anmelden]". Sie sind im Einsatz registriert.',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

drawDynamicCard({
  title: 'Schritt 2: Am Sammelplatz eintreffen & Freigabe abwarten',
  badge: 'SCHRITT 2',
  badgeColor: C_BLUE,
  sections: [
    {
      heading: 'Ziel: Freischaltung der GPS-Suchspur durch die Einsatzleitung.',
      text: '1. Melden Sie sich persoenlich am Einsatzleitwagen (EZ).\n' +
            '2. Zeigen Sie Ihren digitalen Mitgliedsausweis mit Barcode/QR-Code auf dem Handy vor, oder lassen Sie sich von der EL in der Kraefteliste auf BEREIT setzen.\n' +
            '3. WICHTIGE REGEL: Ihre GPS-Suchspur wird erst aufgezeichnet, wenn die EL Sie auf [BEREIT] geschaltet hat!\n' +
            '4. Geraete-Check:\n' +
            '   - Pruefen Sie, ob der Standortdienst (GPS) auf "Hohe Genauigkeit" steht.\n' +
            '   - Deaktivieren Sie extreme Energiesparmodi fuer SHS-EZ (die App nutzt eine automatische Prozessor-Wachhaltung WakeLock).\n' +
            '   - Sperren Sie ruhig das Display und stecken Sie das Handy in die Einsatzweste - die Aufzeichnung laeuft zuverlaessig im Hintergrund weiter.',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

drawDynamicCard({
  title: 'Schritt 3: Sektorenansicht & Navigation im Gelaende',
  badge: 'SCHRITT 3',
  badgeColor: C_PRIMARY,
  sections: [
    {
      heading: 'Ziel: Sichere Orientierung im zugewiesenen Suchbereich.',
      text: '1. Tippen Sie auf die Karte: Ihr zugewiesener Sektor ist farbig umrandet hervorgehoben.\n' +
            '2. Ihr eigener Standort wird als blauer Punkt mit genauer Blickrichtung dargestellt.\n' +
            '3. Kartenebene waehlen: Nutzen Sie die topografische Karte (OpenTopoMap), um Waldwege, Gelaendekanten, Baeche und Hoehenlinien zu erkennen. Bei unuebersichtlichem Gelaende schalten Sie auf Satellit um.\n' +
            '4. Bisherige Suchspur: Auf der Karte sehen Sie exakt, welche Flaechen Sie und Ihr Hund bereits abgesucht haben und wo noch Luecken vorhanden sind.',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

// ============================================================================
// TEIL II FORTSETZUNG: FUNDMELDUNG, FUNK & EINSATZENDE
// ============================================================================
startChapter('TEIL II: Sucher & Helfer - Funde & Einsatzende', 'Meldewesen und Verhalten bei Auffinden');

drawDynamicCard({
  title: 'Schritt 4: Fundmeldung mit Foto & GPS absetzen',
  badge: 'SCHRITT 4',
  badgeColor: C_AMBER,
  sections: [
    {
      heading: 'Ziel: Beweissichere und sekunenschnelle Uebermittlung an die Einsatzleitung.',
      text: 'Wenn Ihr Suchhund verbellt, Sie einen Gegenstand (Schuh, Muetze, Fahrrad), eine Spur oder die vermisste Person finden:\n\n' +
            '1. Bleiben Sie sofort stehen! Zertrampeln Sie keine Spuren und sichern Sie Ihren Hund.\n' +
            '2. Tippen Sie in der App unten auf den Button [Fund melden].\n' +
            '3. Foto aufnehmen: Machen Sie mit der Handykamera ein klares Foto des Fundes.\n' +
            '4. Dringlichkeit auswaehlen:\n' +
            '   - Notfall / Vermisste Person (hoechste Prioritaet)\n' +
            '   - Spur / Faehrte\n' +
            '   - Gegenstand / Kleidungsstueck\n' +
            '5. Kurze Beschreibung eingeben (z.B. "Roter Damenschuh im Brombeergestruepp").\n' +
            '6. Auf [Absenden] tippen: Ihre exakte GPS-Koordinate wird automatisch angehaengt und der Einsatzleitung sofort mit akustischem Signal gemeldet!',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

drawDynamicCard({
  title: 'Schritt 5: Taktischer Funk & Pager-Quittung',
  badge: 'SCHRITT 5',
  badgeColor: C_PRIMARY,
  sections: [
    {
      heading: 'Ziel: Reibungsloser Funkverkehr mit der Einsatzleitung.',
      text: '- Textfunk: Nutzen Sie den Chat fuer kurze Rueckmeldungen (z.B. "Sektor A zu 50% abgesucht, keine Feststellung").\n' +
            '- Pager-Sirene: Wenn die Einsatzleitung einen Alarm ausloest, ertoent ein lauter Signalton auf Ihrem Handy. Quittieren Sie den Alarm per Fingertipp und beachten Sie sofort die Durchsage (z.B. Suchabbruch bei Fund oder Gefahrenlage).\n' +
            '- Funkloch-Sicherheit: Haben Sie im dichten Wald kurzzeitig keinen Mobilfunkempfang, zeichnet Ihr Handy die GPS-Spur lokal im Speicher weiter auf und uebermittelt sie automatisch, sobald wieder Netzempfang besteht.',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

drawDynamicCard({
  title: 'Schritt 6: Einsatzende & persoenliche Rueckmeldung',
  badge: 'SCHRITT 6',
  badgeColor: C_DARK,
  sections: [
    {
      heading: 'Ziel: Sichere Rueckkehr aller Teams zum Bereitstellungsraum.',
      text: '1. Nach dem offiziellen Signal zum Einsatzende (per Funk oder Pager) brechen Sie die Suche ab.\n' +
            '2. Kehren Sie auf dem sichersten Weg zum Sammelplatz / zur Einsatzzentrale zurueck.\n' +
            '3. Melden Sie sich persoenlich bei der Einsatzleitung zurueck!\n' +
            '4. Erst wenn Sie persoenlich registriert sind, kann die EL den Einsatz vollstaendig schliessen.\n' +
            '5. Nach Einsatzbeendigung stoppt das Tracking automatisch auf Ihrem Smartphone.',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

// ============================================================================
// TEIL III: SCHRITT-FÜR-SCHRITT ZUM PERSÖNLICHEN TRACKINGTEST
// ============================================================================
startChapter('TEIL III: Persoenlicher GPS-Trackingtest', 'Autonomer Hardware- und Genauigkeitstest fuer alle Helfer');

printParagraph(
  'Der persoenliche Trackingtest ist eine voellig autonome Funktion von SHS-EZ. ' +
  'Er ermoeglicht jedem Mitglied, vor einem Einsatz oder im woechentlichen Hundetraining ' +
  'die Satellitengenauigkeit, das Akkuverhalten und die GPS-Spuraufzeichnung des eigenen Handys zu testen:'
);

drawDynamicCard({
  title: 'Zweck & wichtigste Ausnahmeregel gemaess Dienstvorschrift',
  badge: 'GRUNDREGEL',
  badgeColor: C_PRIMARY,
  sections: [
    {
      heading: 'Wann wird der Test genutzt?',
      text: '- Vor dem Ernstfall zur Funktionspruefung des Handys im Wald.\n' +
            '- Waehrend des Trainings zur Dokumentation von Suchstrecken fuer das Ausbildungsheft.\n' +
            '- Bei Verdacht auf fehlerhafte Energiespar-Einstellungen des Smartphone-Betriebssystems.',
      fontSize: 8.2,
      lineHeight: 4.1
    },
    {
      heading: 'Wichtige System-Ausnahme:',
      text: 'Waehrend im regulaeren Bereitschaftsmodus KEINE Spuren aufgezeichnet werden, zeichnet der persoenliche ' +
            'Trackingtest IMMER eine vollstaendige, hochpraezise Testspur (Linie, Start-/Zielflaggen, Richtungspfeile) auf! ' +
            'Der Test darf von jedem Nutzer jederzeit gestartet werden - unabhaengig davon, ob ein Einsatz aktiv ist oder nicht.',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

drawDynamicCard({
  title: 'Schritt-fuer-Schritt Anleitung fuer den Trackingtest',
  badge: 'TESTABLAUF',
  badgeColor: C_BLUE,
  sections: [
    {
      heading: '1. Testdauer waehlen & Starten:',
      text: '- Nach dem Login waehlen Sie auf der Auswahlseite "[Persoenlicher Trackingtest]".\n' +
            '- Waehlen Sie die gewuenschte Dauer: 10 Minuten (Schnelltest), 20 Minuten (Standard) oder 30 Minuten (Intensivtest).\n' +
            '- Tippen Sie auf [Starten]: Die App setzt eine gruene Startflagge und schaltet die Prozessor-Wachhaltung (WakeLock) scharf.',
      fontSize: 8.2,
      lineHeight: 4.1
    },
    {
      heading: '2. Bewegung im Gelaende & Live-Cockpit:',
      text: '- Sie koennen das Smartphone sperren und in die Tasche stecken.\n' +
            '- Auf dem Bildschirm sehen Sie: Zurueckgelegte Strecke (Meter), aktuelle Geschwindigkeit (km/h) und die Restzeit.\n' +
            '- Auf der Karte wird Ihre Wegstrecke mit Richtungspfeilen fuer jeden Richtungswechsel gezeichnet.',
      fontSize: 8.2,
      lineHeight: 4.1
    },
    {
      heading: '3. Testende, Auswertung & PDF-Protokoll:',
      text: '- Nach Ablauf des Timers stoppt der Test automatisch (oder manuell vorzeitig per Klick auf Stopp).\n' +
            '- Eine rote Zielflagge markiert den Endpunkt.\n' +
            '- Detaillierte Auswertung: Gesamtstrecke, Durchschnittsgeschwindigkeit, Hoehenprofil und Satellitenguete.\n' +
            '- Export: Sie koennen das offizielle PDF-Testprotokoll mit Kartenbild herunterladen oder direkt an Ihren Ausbildungsleiter senden.',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

// ============================================================================
// TEIL IV: ROLLEN, STATUSCODES & SYSTEMREGELN (REFERENZ)
// ============================================================================
startChapter('TEIL IV: Referenz - Rollen, Farbcodes & Regeln', 'Verbindliche Nachschlagetafel gemaess Dienstanweisung');

printParagraph(
  'Diese Referenztafel fasst alle Statusfarben, Rollenbefugnisse und Sicherheitsgarantien zusammen:'
);

function printRefStatus(boxCol, name, code, desc) {
  drawDynamicCard({
    title: `${name} [Status: ${code}]`,
    badge: code.toUpperCase(),
    badgeColor: boxCol,
    borderColor: boxCol,
    bgColor: C_WHITE,
    sections: [
      {
        text: desc,
        fontSize: 8.2,
        lineHeight: 4.1
      }
    ],
    spacingAfter: 3.5
  });
}

printRefStatus(
  [148, 163, 184],
  'Angelegter Einsatz (Vorbereitet)',
  'planned',
  'FARBE: WEISS (NIEMALS GRUEN!). Der Einsatz ist angelegt, Kraefte sind in Anfahrt. Hat [Starten]- und [Entfernen]-Button, aber KEINEN [Beenden]-Button. Noch keine Aktiv-Sperrregeln.'
);

printRefStatus(
  C_BLUE,
  'Realeinsatz - Aktiv',
  'active',
  'FARBE: BLAU. Echter Vermisstenfall. Vollstaendiges Live-Tracking aller freigegebenen Sucher. Mindestbesetzung (1 Admin & 1 EL) ist aktiv geschuetzt. Funk- und Fundsystem voll aktiv.'
);

printRefStatus(
  C_RED,
  'Realeinsatz - Pausiert',
  'paused',
  'FARBE: ROT. Einsatz temporaer unterbrochen (Gewitter, Besprechung). Tracking pausiert, alle bisherigen Spuren bleiben voll erhalten. Kann per [Fortsetzen] sofort reaktiviert werden.'
);

printRefStatus(
  [202, 138, 4],
  'Staffeluebung - Aktiv',
  'active',
  'FARBE: GELB. Uebungs- und Pruefungsbetrieb. Exakt identische Funktionen wie Realeinsatz, wird jedoch im System und Archiv unuebersehbar als Schulung gekennzeichnet.'
);

printRefStatus(
  [234, 88, 12],
  'Staffeluebung - Pausiert',
  'paused',
  'FARBE: ORANGE. Pause im Uebungsbetrieb. Tracking pausiert.'
);

drawDynamicCard({
  title: 'Wichtigste Schutz- & Sicherheitsregeln im Ueberblick',
  badge: 'SICHERHEIT',
  badgeColor: C_PRIMARY,
  sections: [
    {
      heading: '1. Unantastbarkeit von First-Admin Maria:',
      text: 'Der Hauptadministrator-Account (user-maria, Maria) besitzt unveraenderlichen Eigentuemer-Schutz. Er kann weder geloescht, gesperrt noch herabgestuft werden.',
      fontSize: 8.2,
      lineHeight: 4.1
    },
    {
      heading: '2. Mindestbesetzung im laufenden Einsatz:',
      text: 'Solange ein Einsatz aktiv oder pausiert ist, muessen mindestens 1 Admin und 1 EL online bleiben. Ein Wechsel auf Gast oder Logout der letzten Fuehrungskraft ist technisch gesperrt.',
      fontSize: 8.2,
      lineHeight: 4.1
    },
    {
      heading: '3. Geister-Filter im Bereitschaftsmodus:',
      text: 'Helfer, die im Bereitschaftsmodus laenger als 5 Minuten kein Lebenszeichen senden, werden automatisch ausgeblendet, um Kartenverwirrung zu verhindern. Im aktiven Einsatz ist dieser Filter deaktiviert.',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

// ============================================================================
// FOOTER AUF ALLEN SEITEN RENDERN
// ============================================================================
const totalPages = doc.internal.getNumberOfPages();
for (let p = 1; p <= totalPages; p++) {
  doc.setPage(p);

  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, pageHeight - 12.5, pageWidth - margin, pageHeight - 12.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(...C_MUTED);
  doc.text('SHS-EZ - Suchhundestaffel Einsatzzentrale - Schritt-fuer-Schritt Handbuch v6.4', margin, pageHeight - 8);
  doc.text(`Seite ${p} von ${totalPages}`, pageWidth - margin - 18, pageHeight - 8);
}

// ============================================================================
// DATEIEN SPEICHERN
// ============================================================================
const outPathRoot = path.join(__dirname, '..', 'SHS_EZ_Funktionsuebersicht_Handbuch.pdf');
const outPathStepManual = path.join(__dirname, '..', 'SHS_EZ_Schritt_fuer_Schritt_Anleitung.pdf');
const outPathBackups = path.join('C:\\Users\\Maria\\.gemini\\antigravity\\scratch\\shs-ez-backups\\v6.4-backup', 'SHS_EZ_Funktionsuebersicht_Handbuch.pdf');
const outPathBackups2 = path.join('C:\\Users\\Maria\\.gemini\\antigravity\\scratch\\shs-ez-backups\\v6.4-backup', 'SHS_EZ_Schritt_fuer_Schritt_Anleitung.pdf');

const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

fs.writeFileSync(outPathRoot, pdfBuffer);
console.log('PDF erfolgreich gespeichert:', outPathRoot);

fs.writeFileSync(outPathStepManual, pdfBuffer);
console.log('PDF erfolgreich gespeichert:', outPathStepManual);

try {
  fs.writeFileSync(outPathBackups, pdfBuffer);
  fs.writeFileSync(outPathBackups2, pdfBuffer);
  console.log('PDF erfolgreich in Backups kopiert.');
} catch (e) {
  console.warn('Backup-Pfad nicht beschreibbar:', e.message);
}
