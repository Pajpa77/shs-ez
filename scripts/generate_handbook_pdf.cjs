const { jsPDF } = require('jspdf');
const fs = require('fs');
const path = require('path');

// ============================================================================
// STYLING, FARBEN & DESIGNKONSTANTEN
// ============================================================================
const C_DARK = [15, 23, 42];        // Slate 900 (Text & Dark Panels)
const C_NAVY = [30, 41, 59];        // Slate 800 (Header & Subheadings)
const C_PRIMARY = [16, 185, 129];   // Emerald 500 (Akzente & Primär)
const C_PRIMARY_LIGHT = [240, 253, 244]; // Emerald 50 (Hell-Grün Card)
const C_BLUE = [37, 99, 235];       // Royal Blue 600 (Einsatz / Action)
const C_BLUE_LIGHT = [239, 246, 255]; // Blue 50
const C_AMBER = [217, 119, 6];      // Amber 600 (Warnungen & Übungen)
const C_AMBER_LIGHT = [254, 252, 232]; // Amber 50
const C_RED = [220, 38, 38];        // Red 600 (Gesperrt / Notfall)
const C_RED_LIGHT = [254, 242, 242]; // Red 50
const C_MUTED = [100, 116, 139];    // Slate 500 (Hilfstexte & Meta)
const C_BORDER = [226, 232, 240];   // Slate 200 (Rahmenlinien)
const C_CARD_BG = [248, 250, 252];  // Slate 50 (Neutrale Card)
const C_WHITE = [255, 255, 255];

const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4',
});

const pageWidth = 210;
const pageHeight = 297;
const margin = 16;
const contentWidth = pageWidth - 2 * margin; // 178 mm
const bottomMargin = pageHeight - 16;

let curY = 0;

// ============================================================================
// HILFSFUNKTIONEN FÜR DYNAMISCHES LAYOUT (KEIN TEXT-ÜBERLAUF MEHR!)
// ============================================================================

function checkPageBreak(neededHeight) {
  if (curY + neededHeight > bottomMargin) {
    doc.addPage();
    renderPageHeader();
    return true;
  }
  return false;
}

let activeChapterTitle = '';
let activeChapterSubtitle = '';

function renderPageHeader() {
  // Top-Farbbalken
  doc.setFillColor(...C_PRIMARY);
  doc.rect(margin, 12, contentWidth, 1.8, 'F');

  // Titel & Unterzeile
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C_DARK);
  doc.text(activeChapterTitle, margin, 20);

  if (activeChapterSubtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C_MUTED);
    doc.text(activeChapterSubtitle, margin, 24.5);
  }

  // Trennlinie
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, 27.5, pageWidth - margin, 27.5);

  curY = 34;
}

function startChapter(title, subtitle) {
  activeChapterTitle = title;
  activeChapterSubtitle = subtitle;
  doc.addPage();
  renderPageHeader();
}

/**
 * Zeichnet eine Karte mit flexibler dynamischer Höhe.
 * Der Inhalt (Textzeilen) wird automatisch umgebrochen und berechnet.
 */
function drawDynamicCard({
  title = '',
  badge = null,
  badgeColor = C_PRIMARY,
  sections = [],
  borderColor = C_BORDER,
  bgColor = C_WHITE,
  padding = 4.5,
  spacingAfter = 5,
}) {
  // 1. Höhe dynamisch im Vorab berechnen
  let totalH = padding * 2;
  const innerW = contentWidth - (padding * 2);

  if (title || badge) {
    totalH += 7; // Header-Höhe
  }

  const computedSections = sections.map((sec) => {
    let secH = 0;
    if (sec.heading) secH += 5;
    
    let lines = [];
    if (sec.text) {
      doc.setFont('helvetica', sec.isBold ? 'bold' : 'normal');
      doc.setFontSize(sec.fontSize || 8.5);
      lines = doc.splitTextToSize(sec.text, innerW);
      secH += lines.length * (sec.lineHeight || 4.2);
    }
    return { ...sec, lines, secH };
  });

  computedSections.forEach((s) => {
    totalH += s.secH + (s.gapBelow || 2);
  });

  // 2. Seitenumbruch prüfen
  checkPageBreak(totalH + spacingAfter);

  const startY = curY;

  // 3. Hintergrund & Rahmen zeichnen
  doc.setFillColor(...bgColor);
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, startY, contentWidth, totalH, 2, 2, 'FD');

  let innerY = startY + padding;

  // Header rendern
  if (title || badge) {
    if (title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
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

  // Sektionen rendern
  computedSections.forEach((s) => {
    if (s.heading) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(s.headingSize || 8.5);
      doc.setTextColor(...(s.headingColor || C_DARK));
      doc.text(s.heading, margin + padding, innerY + 3.5);
      innerY += 4.8;
    }

    if (s.lines && s.lines.length > 0) {
      doc.setFont('helvetica', s.isBold ? 'bold' : 'normal');
      doc.setFontSize(s.fontSize || 8.5);
      doc.setTextColor(...(s.color || C_DARK));
      doc.text(s.lines, margin + padding, innerY + 3.5);
      innerY += s.lines.length * (s.lineHeight || 4.2);
    }

    innerY += s.gapBelow || 2;
  });

  curY = startY + totalH + spacingAfter;
}

/**
 * Zeichnet zwei Karten nebeneinander (z. B. Erlaubt / Nicht erlaubt)
 */
function drawSplitCard({
  title,
  badge = null,
  badgeColor = C_PRIMARY,
  leftHeading,
  leftHeadingColor = [5, 150, 105],
  leftLines = [],
  rightHeading,
  rightHeadingColor = [220, 38, 38],
  rightLines = [],
  spacingAfter = 5,
}) {
  const colW = (contentWidth - 14) / 2;
  
  // Zeilen berechnen
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  const leftWrapped = leftLines.flatMap(l => doc.splitTextToSize(l, colW));
  const rightWrapped = rightLines.flatMap(l => doc.splitTextToSize(l, colW));

  const maxLines = Math.max(leftWrapped.length, rightWrapped.length);
  const bodyH = maxLines * 4.2 + 8;
  const totalH = 14 + bodyH;

  checkPageBreak(totalH + spacingAfter);

  const startY = curY;

  // Box zeichnen
  doc.setFillColor(...C_WHITE);
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, startY, contentWidth, totalH, 2, 2, 'FD');

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...C_DARK);
  doc.text(title, margin + 4.5, startY + 6.5);

  if (badge) {
    doc.setFillColor(...badgeColor);
    const bW = doc.getTextWidth(badge) + 6;
    doc.roundedRect(pageWidth - margin - 4.5 - bW, startY + 2.5, bW, 5.5, 1.2, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C_WHITE);
    doc.text(badge, pageWidth - margin - 4.5 - bW + 3, startY + 6.3);
  }

  // Trenner oben
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.2);
  doc.line(margin + 4, startY + 10, pageWidth - margin - 4, startY + 10);

  // Linke Spalte
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...leftHeadingColor);
  doc.text(leftHeading, margin + 4.5, startY + 14.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C_DARK);
  doc.text(leftWrapped, margin + 4.5, startY + 19);

  // Vertikaler Trenner mittig
  const midX = margin + (contentWidth / 2);
  doc.setDrawColor(...C_BORDER);
  doc.line(midX, startY + 12, midX, startY + totalH - 4);

  // Rechte Spalte
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...rightHeadingColor);
  doc.text(rightHeading, midX + 3.5, startY + 14.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C_DARK);
  doc.text(rightWrapped, midX + 3.5, startY + 19);

  curY = startY + totalH + spacingAfter;
}

function printParagraph(text, isBold = false, color = C_DARK, fontSize = 8.8, spacingAfter = 3.5) {
  doc.setFont('helvetica', isBold ? 'bold' : 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);

  const lines = doc.splitTextToSize(text, contentWidth);
  const neededH = lines.length * 4.3;

  checkPageBreak(neededH + spacingAfter);

  doc.text(lines, margin, curY + 3.5);
  curY += neededH + spacingAfter;
}

function printSectionTitle(title, spacingBefore = 4, spacingAfter = 2.5) {
  checkPageBreak(9 + spacingBefore + spacingAfter);
  curY += spacingBefore;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C_NAVY);
  doc.text(title, margin, curY + 4);
  curY += 6.5 + spacingAfter;
}

// ============================================================================
// SEITE 1: TITELBLATT & SYSTEM-ÜBERBLICK
// ============================================================================
// Dunkler Premium-Hero
doc.setFillColor(15, 23, 42); // Slate 900
doc.rect(0, 0, pageWidth, 98, 'F');

doc.setFont('helvetica', 'bold');
doc.setFontSize(28);
doc.setTextColor(...C_WHITE);
doc.text('SHS-EZ', margin, 36);

doc.setFontSize(13);
doc.setTextColor(52, 211, 153); // Emerald 400
doc.text('Suchhundestaffel Einsatzzentrale', margin, 45);

doc.setFont('helvetica', 'normal');
doc.setFontSize(10.5);
doc.setTextColor(226, 232, 240);
doc.text('Offizielles Benutzerhandbuch & Operativer Leitfaden', margin, 54);
doc.text('Taktische Einsatzleitung • GPS-Ortung • Sektoren • Funk • Revisionssichere Berichte', margin, 61);

// Meta-Leiste im Hero
doc.setFillColor(30, 41, 59);
doc.roundedRect(margin, 70, contentWidth, 18, 1.5, 1.5, 'F');

doc.setFont('helvetica', 'bold');
doc.setFontSize(8);
doc.setTextColor(52, 211, 153);
doc.text('SYSTEM-STATUS: PRODUKTIV-BETRIEB', margin + 4, 76.5);

doc.setFont('helvetica', 'normal');
doc.setFontSize(7.8);
doc.setTextColor(203, 213, 225);
doc.text('App-Version: 6.4.0 (PWA & Android APK) | Stand: Oktober 2026 | Spürhunde-Salzlandkreis e.V.', margin + 4, 82.5);

curY = 106;

printSectionTitle('1. Was ist SHS-EZ und wie funktioniert die Plattform?');

printParagraph(
  'SHS-EZ ist eine hochmoderne, web- und app-basierte Einsatzleitzentrale, die speziell für die ' +
  'Anforderungen von Rettungs- und Suchhundestaffeln (Flächensuche, Trümmersuche, Mantrailing) entwickelt wurde. ' +
  'Sie vernetzt die Einsatzleitung (EL) in der mobilen Zentrale in Echtzeit mit allen Suchtrupps im Gelände, ' +
  'der Polizei, Feuerwehren sowie übergeordneten Leitstellen.'
);

printParagraph(
  'Die Architektur unterscheidet strikt zwischen zwei grundlegenden Betriebszuständen, um höchste Ausfallsicherheit ' +
  'mit maximaler Akkulaufzeit und lückenlosem Datenschutz zu kombinieren:'
);

drawDynamicCard({
  title: '⚪ Bereitschaftsmodus (Kein Einsatz aktiv)',
  borderColor: C_BORDER,
  bgColor: C_CARD_BG,
  sections: [
    {
      text: '• Standby-Ortung: Zeigt den aktuellen Standort der Einsatzkräfte lediglich als Punkt-Pins auf der Karte.\n' +
            '• Keine Spuraufzeichnung: Es werden im Bereitschaftsmodus KEINE Wegstrecken aufgezeichnet (Akkuschonung & Privatsphäre).\n' +
            '• 5-Minuten Geister-Filter: Schließt ein Helfer die App oder wischt sie weg, wird er nach 5 Minuten automatisch als offline markiert. Keine Geister-Pins!\n' +
            '• Ausnahme Trackingtest: Der persönliche GPS-Hardwaretest zeichnet auch im Bereitschaftsmodus eine vollständige Testspur auf.',
      fontSize: 8.3,
      lineHeight: 4.2
    }
  ],
  spacingAfter: 4
});

drawDynamicCard({
  title: '🔵 / 🟡 Aktiver Einsatz & Übung (Realeinsatz oder Training gestartet)',
  borderColor: C_BLUE,
  bgColor: C_BLUE_LIGHT,
  sections: [
    {
      text: '• Hochpräzises Suchspur-Tracking: Sobald die Einsatzleitung einen Sucher auf BEREIT schaltet, wird dessen vollständiger GPS-Pfad live aufgezeichnet.\n' +
            '• Prozess-Wachhaltung (WakeLock): Verhindert das Einschlafen des Prozessors bei gesperrtem Bildschirm in der Jackentasche.\n' +
            '• Geschützte Mindestbesetzung: Mindestens 1 Admin und 1 Einsatzleitung müssen während des gesamten Einsatzes aktiv eingeloggt bleiben.\n' +
            '• Integrierter Einsatzstellenfunk: Direkter Text- und CB-Sprachfunk mit akustischen Quittungen und Pager-Weckruf.\n' +
            '• Revisionssicheres Archiv: Nach Einsatzende werden alle Spuren, Sektoren, Funde und Funkprotokolle dauerhaft gespeichert.',
      fontSize: 8.3,
      lineHeight: 4.2
    }
  ],
  spacingAfter: 4
});

// ============================================================================
// SEITE 2: ROLLEN & BERECHTIGUNGEN IM DETAIL
// ============================================================================
startChapter('2. Rollen, Berechtigungen & Sicherheitsregeln', 'Detaillierte Übersicht aller Berechtigungsstufen im System');

printParagraph(
  'Die Plattform verfügt über ein strikt rollenbasiertes Zugriffskonzept. Jedes Mitglied der Staffel ' +
  'erhält einen festen Account mit PIN-Code, Rufnamen und spezifischen Zugriffsrechten:'
);

drawSplitCard({
  title: 'Administrator (Admin) & First-Admin (Maria)',
  badge: 'VOLLZUGRIFF',
  badgeColor: C_PRIMARY,
  leftHeading: 'Erlaubte Aktionen & Aufgaben:',
  leftLines: [
    '• Vollständige Benutzer- und Kontenverwaltung (Anlegen, Editieren, Löschen)',
    '• PIN-Codes und Passwörter für alle Helfer zurücksetzen',
    '• Einsätze erstellen, konfigurieren, starten, pausieren und beenden',
    '• Sektoren zeichnen, Hektar prüfen und Suchtrupps zuweisen',
    '• Bereit-Schaltung von Suchern per Barcode-Scan oder Klick',
    '• Gesamteinsatzberichte als PDF und CSV exportieren',
    '• Funk- und Chatprotokolle archivieren und leeren'
  ],
  rightHeading: 'Feste Schutz- & Sicherheitsregeln:',
  rightLines: [
    '• Maria (First-Admin / Owner) ist unantastbar: Kann weder gelöscht, gesperrt noch herabgestuft werden.',
    '• Mindestbesetzung im Einsatz: Mindestens 1 Admin muss dauerhaft eingeloggt bleiben. Logout gesperrt!',
    '• Einsatzbeendigung erfordert verbindliche Bestätigung, dass alle Suchtrupps das Gelände verlassen haben.'
  ]
});

drawSplitCard({
  title: 'Einsatzleitung (EL)',
  badge: 'TAKTIK & LEITUNG',
  badgeColor: C_BLUE,
  leftHeading: 'Erlaubte Aktionen & Aufgaben:',
  leftLines: [
    '• Einsätze operativ führen (Starten, Pausieren, Fortsetzen, Beenden)',
    '• Sektoren im Gelände polygonieren und Suchtrupps zuteilen',
    '• Status-Steuerung aller Einsatzkräfte (Bereit / Pause)',
    '• Fundmeldungen der Sucher verifizieren und Marker setzen',
    '• Drohnen-Videostream zuschalten und Lagekarte einbinden',
    '• Pager-Sirenenalarm an einzelne oder alle Einheiten auslösen',
    '• Funkleitung im Text- und CB-Sprachkanal führen'
  ],
  rightHeading: 'Feste Schutz- & Sicherheitsregeln:',
  rightLines: [
    '• Kann keine anderen Administratoren löschen oder deren Passwörter ändern.',
    '• Mindestbesetzung im Einsatz: Mindestens 1 EL muss stets online sein.',
    '• Zugriff auf globale Systemeinstellungen bleibt Administratoren vorbehalten.'
  ]
});

drawSplitCard({
  title: 'Sucher / Aktiver Nutzer (Hundeführer & Helfer)',
  badge: 'EINSATZKRAFT IM GELÄNDE',
  badgeColor: C_AMBER,
  leftHeading: 'Erlaubte Aktionen & Aufgaben:',
  leftLines: [
    '• Eigene GPS-Suchspur lückenlos aufzeichnen (nach Freigabe durch EL)',
    '• Zugewiesene Sektorengrenzen und Gesamtgebiet live auf Karte einsehen',
    '• Fundmeldungen mit Foto, GPS-Koordinate und Dringlichkeit melden',
    '• Taktischen Funkverkehr (Text & CB-Voice) empfangen und senden',
    '• Eigenen Mitgliedsausweis mit Barcode / QR-Code vorzeigen',
    '• Persönlichen GPS-Trackingtest jederzeit autonom durchführen'
  ],
  rightHeading: 'Einschränkungen & Schutz:',
  rightLines: [
    '• Kann keinen Einsatz starten, pausieren oder beenden.',
    '• Kann keine fremden Sektoren bearbeiten oder löschen.',
    '• Trackingspur wird erst aufgezeichnet, wenn die EL den Trupp auf Bereit geschaltet hat.',
    '• Keine Administrationsrechte für Benutzerstammdaten.'
  ]
});

drawSplitCard({
  title: 'Gast / Betrachter (Polizei, Feuerwehr, Behörden)',
  badge: 'REINE LESEANSICHT',
  badgeColor: C_MUTED,
  leftHeading: 'Verfügbare Funktionen:',
  leftLines: [
    '• Live-Lagekarte in Echtzeit beobachten (Großbildschirm, Leitstelle)',
    '• Aktuelle Positionen der freigegebenen Suchtrupps und Sektoren sehen',
    '• Verifizierte Fundstellen und Suchgebietsgrenzen einsehen',
    '• Umschaltung zwischen Topo-Karte, Satellit und Nachtmodus'
  ],
  rightHeading: 'Gesperrte Funktionen:',
  rightLines: [
    '• Sendet KEINE eigene GPS-Position (wird nicht auf Karte angezeigt)',
    '• Keine Schreib- oder Senderechte im Funk-Chat',
    '• Keine Bearbeitungsrechte für Einsatz-, Sektoren- oder Personendaten',
    '• Reiner passiver Lese- und Beobachterzugang.'
  ]
});

// ============================================================================
// SEITE 3: DIE ZWEI GETRENNTEN AUSWAHLSEITEN NACH DEM LOGIN
// ============================================================================
startChapter('3. Die zwei Auswahlseiten nach dem Login', 'Verbindliche Systemlogik zur Vermeidung von Fehlbedienungen');

printParagraph(
  'Nach erfolgreicher Authentifizierung (Passwort oder PIN-Schnellwahl) leitet die App NIEMALS sofort unkontrolliert ' +
  'in eine Kartenansicht weiter, sondern zeigt immer eine eindeutige Auswahlseite. ' +
  'Das System prüft automatisch, ob aktuell ein Einsatz aktiv/pausiert ist oder ob sich die Staffel in Bereitschaft befindet:'
);

drawDynamicCard({
  title: 'A) Auswahlseite OHNE aktiven Einsatz (Bereitschaftsmodus)',
  badge: 'BEREITSCHAFT',
  badgeColor: C_PRIMARY,
  borderColor: C_PRIMARY,
  bgColor: C_PRIMARY_LIGHT,
  sections: [
    {
      heading: 'Gültig bei: Kein Einsatz vorhanden oder angelegte Einsätze im Status "Vorbereitet / Geplant" (weiß).',
      headingColor: C_DARK,
      text: 'Im Bereitschaftsmodus gibt es für Admins KEINE Unterscheidung zwischen „In der EZ“ und „Als Sucher“!\n\n' +
            'Folgende 4 Auswahlmöglichkeiten stehen bereit:\n' +
            '  1. 🛡️ Als Admin anmelden: Ein einfacher Button ohne EZ/Sucher-Aufteilung (nur für Admins/EL sichtbar).\n' +
            '  2. 🦺 Als aktiver Nutzer anmelden: Meldet den Helfer für die Bereitschaft an. Zeigt den aktuellen Standort-Pin auf der Karte, zeichnet jedoch KEINE Trackingspur auf.\n' +
            '  3. 👁️ Als Gast / Betrachter: Reine Leseansicht ohne eigenen Standort-Pin.\n' +
            '  4. 🛰️ Persönlicher Trackingtest (10 / 20 / 30 Min.): Separater Hardware- und Genauigkeitstest für jedermann.',
      fontSize: 8.3,
      lineHeight: 4.2
    },
    {
      heading: 'Spezifisches Verhalten im Bereitschaftsmodus:',
      headingColor: [5, 150, 105],
      text: '• Automatischer Geister-Filter: Verlässt ein Helfer die App (Browser geschlossen, App weggewischt) und sendet länger als 5 Minuten kein Lebenszeichen, wird er automatisch als offline markiert. Dadurch bleibt die Bereitschaftskarte stets verlässlich sauber.',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 5
});

drawDynamicCard({
  title: 'B) Auswahlseite BEI AKTIVEM EINSATZ (Status aktiv oder pausiert)',
  badge: 'EINSATZ LÄUFT',
  badgeColor: C_BLUE,
  borderColor: C_BLUE,
  bgColor: C_BLUE_LIGHT,
  sections: [
    {
      heading: 'Gültig bei: Realeinsatz (blau/rot) oder Staffelübung (gelb/orange) wurde gestartet.',
      headingColor: C_DARK,
      text: 'Nur bei laufendem Einsatz melden sich Führungskräfte rollenbasiert an:\n\n' +
            '1. Für Administratoren & Einsatzleitung:\n' +
            '   • 🏢 In der EZ (ez_command): Leitung aus der Einsatzzentrale. Kein GPS-Tracking der eigenen Person! Führungskräfte werden nicht als einzelne Läufer auf der Karte dargestellt, sondern direkt gebündelt im „📡 EZ“-Kartenpin aufgeführt.\n' +
            '   • 🦺 Als Sucher (searcher): Die Führungskraft begibt sich selbst ins Gelände. Erhält einen eigenen Karten-Pin und wird nach Freigabe als vollwertiger Suchtrupp getrackt.\n\n' +
            '2. Für reguläre Einsatzkräfte (Nicht-Admins):\n' +
            '   • 🦺 Als aktiver Nutzer / Sucher: Fungieren im Einsatz als Sucher. Sobald sie von der EL per Barcode-Scan oder Klick auf „🟢 Bereit“ freigegeben werden, zeichnet die App ihre Suchspur lückenlos auf.\n\n' +
            '3. Für Externe (Polizei, Behörden, Gäste):\n' +
            '   • 👁️ Als Gast / Betrachter: Reine Kartenbeobachtung ohne eigenes GPS-Signal.',
      fontSize: 8.3,
      lineHeight: 4.2
    },
    {
      heading: 'Wichtige Sicherheitsgarantie im aktiven Einsatz:',
      headingColor: C_BLUE,
      text: 'Der 5-Minuten Geister-Filter ist im aktiven Einsatz DEAKTIVIERT! Selbst bei vorübergehendem Funkloch im dichten Wald läuft die GPS-Aufzeichnung lokal auf dem Smartphone ununterbrochen weiter und synchronisiert sich automatisch nach.',
      fontSize: 8.2,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 4
});

// ==========================================
// SEITE 4: PERSÖNLICHER TRACKINGTEST
// ==========================================
startChapter('4. Persönlicher Trackingtest (10 / 20 / 30 Min.)', 'Autonomer GPS-Hardware- und Akkutest für Hundeführer');

printParagraph(
  'Der persönliche Trackingtest ist eine eigenständige Funktion von SHS-EZ. Er dient dazu, vor einem ' +
  'Ernsteinsatz oder während des Trainings die GPS-Präzision des Handys, die Energieeinstellungen und das ' +
  'Standortverhalten im Wald unabhängig von der Leitstelle zu überprüfen.'
);

drawDynamicCard({
  title: 'Ablauf des Trackingtests in 3 Schritten',
  borderColor: C_BORDER,
  bgColor: C_WHITE,
  sections: [
    {
      heading: 'Schritt 1: Dauer wählen & Starten',
      headingColor: C_DARK,
      text: '• Wählbare Testzeit: 10 Minuten (Schnelltest), 20 Minuten (Standard) oder 30 Minuten (Dauertest).\n' +
            '• Start per Knopfdruck: Die App schaltet den GPS-Empfänger auf maximale Genauigkeit.\n' +
            '• Integrierter WakeLock: Verhindert zuverlässig das Einschlafen des Betriebssystems bei gesperrtem Bildschirm.\n' +
            '• Start-Markierung: Der Startpunkt wird als grüne Fahne auf der Karte verankert.',
      fontSize: 8.3,
      lineHeight: 4.1
    },
    {
      heading: 'Schritt 2: Live-Aufzeichnung & Statistik-Cockpit',
      headingColor: C_DARK,
      text: '• Durchgängige Trackingspur: Jeder GPS-Punkt wird mit Zeit, Höhe, Geschwindigkeit und HDOP-Genauigkeit erfasst.\n' +
            '• Richtungspfeile: Auf der Spur zeigen Pfeile die exakte Gehrichtung und Richtungswechsel an.\n' +
            '• Live-Anzeige: Zurückgelegte Strecke in Metern, aktuelle Geschwindigkeit (km/h) und verbleibende Testzeit.\n' +
            '• Warnanzeige bei Signalverlust oder schlechtem Satellitenempfang.',
      fontSize: 8.3,
      lineHeight: 4.1
    },
    {
      heading: 'Schritt 3: Auswertung, PDF-Protokoll & E-Mail',
      headingColor: C_DARK,
      text: '• Automatischer Stopp nach Ablauf des Timers (oder manueller vorzeitiger Abbruch).\n' +
            '• Rote Endpunkt-Fahne markiert das Ende des Testlaufs.\n' +
            '• Generierung eines detailreichen Testberichts mit interaktivem Karten-Snapshot und Metriken.\n' +
            '• PDF-Download für das Ausbildungsbuch des Hundeführers oder direkter Versand an den Ausbildungsleiter.',
      fontSize: 8.3,
      lineHeight: 4.1
    }
  ],
  spacingAfter: 5
});

drawDynamicCard({
  title: '⭐ Wichtigste Ausnahmeregel gemäß Dienstvorschrift',
  badge: 'AUSNAHME-REGEL',
  badgeColor: C_PRIMARY,
  borderColor: C_PRIMARY,
  bgColor: C_PRIMARY_LIGHT,
  sections: [
    {
      text: 'Während im regulären Bereitschaftsmodus KEINE Spuren aufgezeichnet werden (um Akku und Privatsphäre zu schonen), ' +
            'wird beim persönlichen Trackingtest IMMER die vollständige GPS-Testspur (Linie, Pfeile, Fahnen) aufgezeichnet und visualisiert.\n' +
            'Dieser Test darf von jedem Mitglied jederzeit gestartet werden – völlig unabhängig davon, ob ein Einsatz aktiv ist oder nicht.',
      fontSize: 8.3,
      lineHeight: 4.2
    }
  ],
  spacingAfter: 4
});

// ==========================================
// SEITE 5: EINSATZ-STATUS & FARBCODES
// ==========================================
startChapter('5. Einsatz-Status, Farbcodes & Lebenszyklus', 'Verbindliche optische Kennzeichnung gemäß Einsatzrichtlinie');

printParagraph(
  'Um Verwechslungen zwischen echten Einsätzen, Übungen und Vorbereitungsphasen unter Stress ' +
  'vollständig auszuschließen, folgt SHS-EZ einer unveränderlichen, farbcodierten Status-Logik:'
);

function printStatusCard(colorBox, title, badge, desc, actions) {
  drawDynamicCard({
    title,
    badge,
    badgeColor: colorBox,
    borderColor: colorBox,
    bgColor: C_WHITE,
    sections: [
      {
        heading: 'Beschreibung & Verhalten im System:',
        headingColor: C_DARK,
        text: desc,
        fontSize: 8.2,
        lineHeight: 4.1
      },
      {
        heading: 'Verfügbare Aktionen für Einsatzleitung & Admins:',
        headingColor: C_BLUE,
        text: actions,
        fontSize: 8.2,
        lineHeight: 4.1
      }
    ],
    spacingAfter: 4
  });
}

printStatusCard(
  [148, 163, 184],
  '⚪ Angelegt / Vorbereitet (planned)',
  'WEISS (NIEMALS GRÜN!)',
  'Der Einsatz ist vorkonfiguriert (z. B. Vermisstenprofil hinterlegt, Sektoren grob vordefiniert), aber die Kräfte sind noch in Anfahrt. ' +
  'Für angelegte Einsätze gelten noch KEINE Aktiv-Einsatz-Sperrregeln. Angelegte Einsätze werden separat geführt und gehören noch nicht ins Archiv.',
  '• [▶️ Starten] Button: Schaltet das System scharf in den Aktiv-Modus.\n' +
  '• [🗑️ Entfernen] Button: Löscht den vorbereiteten Entwurf rückstandslos.\n' +
  '• WICHTIG: Hat KEINEN [🛑 Beenden]-Button, da er noch gar nicht gestartet wurde!'
);

printStatusCard(
  C_BLUE,
  '🔵 Realeinsatz – Aktiv (active)',
  'BLAU (REALEINSATZ)',
  'Echter Vermisstenfall läuft mit höchster Priorität. Alle GPS-Suchspuren, Sektorenfreigaben, Funk- und Pagerkanäle sind voll aktiv. ' +
  'Die Mindestbesetzung (1 Admin & 1 EL) ist aktiv geschützt. Tracking läuft unterbrechungsfrei.',
  '• [⏸️ Pausieren] Button (z. B. Lagebesprechung, Gewitterpause)\n' +
  '• [🛑 Einsatz Beenden] Button mit Rückkehr-Bestätigung aller Kräfte\n' +
  '• Sektor-Editor, Fundmeldungen mit Foto, Drohnen-Stream, Einsatzfunk'
);

printStatusCard(
  C_RED,
  '🔴 Realeinsatz – Pausiert (paused)',
  'ROT (UNTERBROCHEN)',
  'Der Realeinsatz ist temporär unterbrochen (z. B. Nachtpause, Unwetter). Die GPS-Spuraufzeichnung ist vorübergehend angehalten, ' +
  'aber alle Daten, Sektoren und bisherigen Spuren bleiben vollständig auf der Lagekarte erhalten.',
  '• [▶️ Fortsetzen] Button: Nimmt die aktive Suche sofort wieder auf.\n' +
  '• [🛑 Einsatz Beenden] Button: Beendet die Operation endgültig.\n' +
  '• Lageprotokollierung und Funkverkehr bleiben weiterhin aktiv.'
);

printStatusCard(
  [202, 138, 4], // Amber / Dark Yellow
  '🟡 Staffelübung – Aktiv (active)',
  'GELB (ÜBUNGSEINSATZ)',
  'Ausbildungs- und Prüfungseinsatz. Bietet exakt dieselben Funktionen wie ein Realeinsatz (Live-GPS, Suchspuren, Sektoren, Funk), ' +
  'wird im System und im späteren Archiv jedoch unübersehbar als Schulungsmaßnahme gekennzeichnet.',
  '• [⏸️ Pausieren] Button\n' +
  '• [🛑 Übung Beenden] Button\n' +
  '• Ausbildungsbericht & Protokollexport für Prüfungsunterlagen'
);

printStatusCard(
  [234, 88, 12], // Orange
  '🟠 Staffelübung – Pausiert (paused)',
  'ORANGE (ÜBUNGS-PAUSE)',
  'Unterbrechung der Übung für Auswerter-Feedback oder Truppwechsel. Tracking pausiert.',
  '• [▶️ Fortsetzen] Button\n' +
  '• [🛑 Übung Beenden] Button'
);

// ==========================================
// SEITE 6: LAGEKARTE, SEKTOREN & FUNK
// ==========================================
startChapter('6. Taktische Lagekarte, Sektoren, Funk & Pager', 'Operative Werkzeuge für Führungskräfte und Suchtrupps');

printParagraph(
  'Das Herzstück von SHS-EZ ist die interaktive Lagekarte mit integrierter Sektorenverwaltung, ' +
  'Lageprotokollierung und Einsatzstellenfunk:'
);

drawDynamicCard({
  title: '🗺️ Taktische Lagekarte & Kartenebenen',
  borderColor: C_BORDER,
  bgColor: C_WHITE,
  sections: [
    {
      text: '• Kartenebenen: Schneller Wechsel zwischen topografischer Wanderkarte (OpenTopoMap mit Höhenlinien und Waldwegen) und Satelliten-Luftbild.\n' +
            '• Zentrales Wetter- & GPS-Bedienfenster (oben rechts): Alle Kartensteuerungen (Nachtmodus/Darkmode mit Mond/Sonne, Drohnen-Stream mit Funkantenne RadioTower, GPS-Status) sind ergonomisch oben rechts gebündelt und verdecken nicht die Zoom-Leiste.\n' +
            '• Live-Pins: Eindeutige Kennzeichnung aller Kräfte mit Funkrufnamen, Akkustand und Rolle.\n' +
            '• EZ-Pin-Bündelung: Führungskräfte in der Einsatzzentrale werden sauber im „📡 EZ“-Marker zusammengefasst.',
      fontSize: 8.3,
      lineHeight: 4.2
    }
  ],
  spacingAfter: 4
});

drawDynamicCard({
  title: '📐 Sektorenverwaltung & Doppelzuweisungs-Schutz',
  borderColor: C_BORDER,
  bgColor: C_WHITE,
  sections: [
    {
      text: '• Freies Polygon-Zeichnen: Sektoren werden mit wenigen Fingertipps direkt auf Wald- und Feldrändern abgesteckt.\n' +
            '• Automatische Flächenberechnung: Exakte Hektar- (ha) und Umfangsberechnung für realistische Zeit- und Kräfteansätze.\n' +
            '• ⚠️ Doppelzuweisungs-Warnung: Weist die EL einen Sucher zu, der bereits in einem anderen Sektor eingeteilt ist, warnt das System sofort auffällig in Rot („⚠️ In: Sektor X“). Doppelbelegungen werden dadurch zuverlässig verhindert.\n' +
            '• Statusverwaltung: Sektoren wechseln farblich von Offen (Gelb) über In Arbeit (Blau) zu Abgesucht (Grün).',
      fontSize: 8.3,
      lineHeight: 4.2
    }
  ],
  spacingAfter: 4
});

drawDynamicCard({
  title: '📻 Funk, Pager & Einsatzdokumentation (Neu in Version 6.4)',
  borderColor: C_BORDER,
  bgColor: C_WHITE,
  sections: [
    {
      text: '• Tastatur-optimierter Textfunk: Das Eingabefeld bleibt auf Android- und iOS-Smartphones beim Aufklappen der Bildschirmtastatur stabil fixiert.\n' +
            '• Akustischer Pager-Weckruf: Löst bei dringenden Durchsagen oder Erstalarmierung einen durchdringenden Weckton aus (ideal für schlafende Hundeführer im Bereitstellungsraum).\n' +
            '• 📄 Direkt-PDF & Leeren: Im aktiven Einsatz können Chatverlauf, System-Logbuch sowie Alarme & Fundmeldungen mit einem Klick als sauberes PDF exportiert werden. Die Einträge fließen automatisch in das revisionssichere Einsatztagebuch ein und überlasten nicht den Live-Chat.',
      fontSize: 8.3,
      lineHeight: 4.2
    }
  ],
  spacingAfter: 4
});

// ==========================================
// SEITE 7: CHECKLISTE FÜR DEN EINSATZABLAUF
// ==========================================
startChapter('7. Checkliste für den Einsatzablauf', 'Schritt-für-Schritt Leitfaden von der Erstalarmierung bis zum Archiv');

printParagraph(
  'Dieser standardisierte Einsatzablauf stellt sicher, dass alle Daten vollständig erfasst werden ' +
  'und nach Einsatzende ein lückenloses Behördenprotokoll zur Verfügung steht:'
);

function printStepCard(stepNum, stepTitle, phaseBadge, bulletText) {
  drawDynamicCard({
    title: `${stepNum}. ${stepTitle}`,
    badge: phaseBadge,
    badgeColor: C_PRIMARY,
    borderColor: C_BORDER,
    bgColor: C_WHITE,
    sections: [
      {
        text: bulletText,
        fontSize: 8.3,
        lineHeight: 4.2
      }
    ],
    spacingAfter: 4
  });
}

printStepCard(
  'Phase 1',
  'Alarmierung & Einsatz vorbereiten',
  'VORBEREITUNG',
  '1. Einsatzleiter öffnet SHS-EZ und klickt auf „Neuer Einsatz“.\n' +
  '2. Einsatzname, Vermisstenprofil (Name, Foto, Kleidung, Vorerkrankungen), Sammelplatz / EZ und Modus (Realeinsatz oder Übung) festlegen.\n' +
  '3. Speichern: Der Einsatz hat den Status planned (weiß). Anfahrende Suchtrupps können sich bereits orientieren.'
);

printStepCard(
  'Phase 2',
  'Eintreffen am Sammelplatz & Einsatz starten',
  'START & SAMMLUNG',
  '1. Am Sammelplatz klickt die EL auf [▶️ Starten] – Der Status wechselt auf Blau (Realeinsatz) oder Gelb (Übung).\n' +
  '2. Einsatzkräfte melden sich am Handy als „🦺 Aktiver Nutzer / Sucher“ an.\n' +
  '3. Die Führungs-Schutzregel (mind. 1 Admin & 1 EL dauerhaft online) wird automatisch aktiviert.'
);

printStepCard(
  'Phase 3',
  'Sektoreneinteilung & Sucher auf BEREIT schalten',
  'SUCHPHASE',
  '1. EL teilt im Sektor-Editor den Teams ihre Suchbereiche zu (Achtung auf Doppelzuweisungs-Warnung!).\n' +
  '2. EL schaltet jedes abmarschbereite Team per Klick auf [🟢 Bereit] (oder Barcode-Scan des Mitgliedsausweises) scharf.\n' +
  '3. Die hochpräzise GPS-Suchspur des Hundeteams erscheint ab diesem Moment live für alle auf der Lagekarte.'
);

printStepCard(
  'Phase 4',
  'Fund, Einsatzende & Revisionssicheres Archiv',
  'ABSCHLUSS',
  '1. Bei Fund: Foto mit GPS-Fix aufnehmen und übermitteln. Die EL verifiziert den Fund und alarmiert Rettungsdienst / Notarzt.\n' +
  '2. Nach Rückkehr aller Kräfte: Klick auf [🛑 Einsatz Beenden] und Prüfung der Vollständigkeit.\n' +
  '3. Alle GPS-Spuren, Sektoren und Funkprotokolle werden revisionssicher im Einsatzarchiv gespeichert.\n' +
  '4. Export des offiziellen Behörden-Einsatzberichtes (PDF & CSV) mit Karten-Snapshots und Spurennachweis.'
);

// ============================================================================
// FOOTER AUF ALLEN SEITEN RENDERN
// ============================================================================
const totalPages = doc.internal.getNumberOfPages();
for (let p = 1; p <= totalPages; p++) {
  doc.setPage(p);

  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...C_MUTED);
  doc.text('SHS-EZ • Suchhundestaffel Einsatzzentrale • Offizielles Systemhandbuch v6.4', margin, pageHeight - 8.5);
  doc.text(`Seite ${p} von ${totalPages}`, pageWidth - margin - 18, pageHeight - 8.5);
}

// ============================================================================
// DATEIEN SPEICHERN
// ============================================================================
const outPathRoot = path.join(__dirname, '..', 'SHS_EZ_Funktionsuebersicht_Handbuch.pdf');
const outPathBackups = path.join('C:\\Users\\Maria\\.gemini\\antigravity\\scratch\\shs-ez-backups\\v6.4-backup', 'SHS_EZ_Funktionsuebersicht_Handbuch.pdf');

const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
fs.writeFileSync(outPathRoot, pdfBuffer);
console.log('PDF erfolgreich erstellt unter:', outPathRoot);

try {
  fs.writeFileSync(outPathBackups, pdfBuffer);
  console.log('PDF erfolgreich gesichert in Backups unter:', outPathBackups);
} catch (e) {
  console.error('Backup copy error:', e.message);
}
