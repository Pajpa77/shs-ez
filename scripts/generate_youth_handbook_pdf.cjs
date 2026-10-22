const { jsPDF } = require('jspdf');
const fs = require('fs');
const path = require('path');

// Farben
const C_DARK = [15, 23, 42];            // Slate 900
const C_NAVY = [30, 41, 59];            // Slate 800
const C_PRIMARY = [0, 20, 137];         // Reflex Blue (SHS)
const C_CYAN = [6, 182, 212];           // Cyan 500 (Jugend)
const C_AMBER = [217, 119, 6];          // Amber 600 (Admin/Gold)
const C_EMERALD = [16, 185, 129];       // Emerald 500 (Bereit)
const C_ROSE = [225, 29, 72];           // Rose 600 (Fund / SOS)
const C_PURPLE = [147, 51, 234];        // Purple 600 (Gemeinsam)
const C_MUTED = [100, 116, 139];        // Slate 500
const C_BORDER = [203, 213, 225];       // Slate 300
const C_BG_LIGHT = [248, 250, 252];     // Slate 50
const C_WHITE = [255, 255, 255];

const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4',
});

const pageWidth = 210;
const pageHeight = 297;
const margin = 14;
const contentWidth = pageWidth - 2 * margin; // 182 mm
const bottomMargin = pageHeight - 14;

let curY = 0;
let pageNumber = 1;

function renderPageHeader(title, subtitle) {
  // Top brand bar
  doc.setFillColor(...C_PRIMARY);
  doc.rect(margin, 10, contentWidth, 2.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C_DARK);
  doc.text(title, margin, 18);

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C_MUTED);
    doc.text(subtitle, margin, 22);
  }

  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, 25, margin + contentWidth, 25);
}

function renderPageFooter() {
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, bottomMargin - 5, margin + contentWidth, bottomMargin - 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C_MUTED);
  doc.text('Spürhunde Salzlandkreis e.V. • SHS-EZ Version 7.0 • Jugendhandbuch (U18)', margin, bottomMargin);

  const pageStr = `Seite ${pageNumber}`;
  doc.text(pageStr, margin + contentWidth - doc.getTextWidth(pageStr), bottomMargin);
}

function checkPageOverflow(requiredHeight, newTitle, newSubtitle) {
  if (curY + requiredHeight > bottomMargin - 8) {
    renderPageFooter();
    doc.addPage();
    pageNumber++;
    renderPageHeader(newTitle, newSubtitle);
    curY = 32;
  }
}

function drawSectionHeading(num, title, color = C_PRIMARY) {
  doc.setFillColor(...color);
  doc.roundedRect(margin, curY, 7, 7, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C_WHITE);
  doc.text(String(num), margin + 3.5, curY + 5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C_DARK);
  doc.text(title, margin + 10, curY + 5.5);

  curY += 10;
}

function drawBox(x, y, w, h, bg, border, radius = 2) {
  doc.setFillColor(...bg);
  doc.setDrawColor(...border);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, w, h, radius, radius, 'FD');
}

// ============================================================================
// DECKBLATT / TITELSEITE
// ============================================================================
function renderCoverPage() {
  // Deep Blue Header Accent
  doc.setFillColor(...C_PRIMARY);
  doc.rect(0, 0, pageWidth, 90, 'F');

  // Golden sub-bar
  doc.setFillColor(...C_AMBER);
  doc.rect(0, 90, pageWidth, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...C_WHITE);
  doc.text('SPÜRHUNDE SALZLANDKREIS E.V.', pageWidth / 2, 38, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C_CYAN);
  doc.text('EINSATZZENTRALE (SHS-EZ) • VERSION 7.0', pageWidth / 2, 48, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(220, 235, 255);
  doc.text('Offizielles Handbuch & Schritt-für-Schritt Anleitung', pageWidth / 2, 58, { align: 'center' });

  // Main Badge on Cover
  doc.setFillColor(...C_WHITE);
  doc.roundedRect(pageWidth / 2 - 50, 70, 100, 14, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C_PRIMARY);
  doc.text('MODUL JUGENDGRUPPE (U18)', pageWidth / 2, 79, { align: 'center' });

  // Cover Content
  curY = 110;

  // Overview Card
  drawBox(margin, curY, contentWidth, 42, C_BG_LIGHT, C_BORDER, 3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...C_DARK);
  doc.text('Über dieses Handbuch', margin + 6, curY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...C_NAVY);
  const introDesc = [
    'Mit Version 7.0 erhält die SHS-EZ App ein eigenständiges, vollständig abgeschirmtes Modul für die',
    'Jugendgruppe (U18). Da Jugendliche aus rechtlichen und versicherungstechnischen Gründen nicht an',
    'Realeinsätzen teilnehmen dürfen, findet in der Jugendgruppe ausschließlich Übungsbetrieb statt.',
    'Dieses Dokument führt Kinder und Jugendleiter Schritt für Schritt durch alle Funktionen.',
  ];
  doc.text(introDesc, margin + 6, curY + 16, { lineHeightFactor: 1.35 });

  curY += 50;

  // Two Blocks: Teil 1 & Teil 2
  const colW = (contentWidth - 6) / 2;

  // Block Kids
  drawBox(margin, curY, colW, 70, [240, 249, 255], C_CYAN, 3);
  doc.setFillColor(...C_CYAN);
  doc.roundedRect(margin + 5, curY + 6, 26, 6, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C_DARK);
  doc.text('TEIL 1', margin + 18, curY + 10.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C_DARK);
  doc.text('Für die Kids & Jugend', margin + 6, curY + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(...C_NAVY);
  const kidsPoints = [
    '• Einfacher Login mit 4-stelliger PIN',
    '• Eigener Jugend-Dienstausweis & Barcode',
    '• Interaktive Übungskarte & Sektoren',
    '• Fundmeldungen mit automatischer GPS-Lage',
    '• Funk mit kindgerechten Schnell-Buttons',
    '• Notfall-Pfeife (SOS) & Übungsraum-Schutz',
    '• Automatisches Spürhunde-Diplom (PDF)',
    '• Spürhunde-Junior Quiz in der Wartezeit',
  ];
  doc.text(kidsPoints, margin + 6, curY + 28, { lineHeightFactor: 1.35 });

  // Block Admins
  drawBox(margin + colW + 6, curY, colW, 70, [255, 251, 235], C_AMBER, 3);
  doc.setFillColor(...C_AMBER);
  doc.roundedRect(margin + colW + 11, curY + 6, 26, 6, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C_WHITE);
  doc.text('TEIL 2', margin + colW + 24, curY + 10.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C_DARK);
  doc.text('Für die Jugendleitung', margin + colW + 6, curY + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(...C_NAVY);
  const adminPoints = [
    '• Verifizierter Admin-Login mit Haupt-Account',
    '• Vollständiges Jugend-Adminboard',
    '• Übungen planen (Jugend-Übung & Gemeinsam)',
    '• Barcode-Scan zur Bereitstellung (Ready)',
    '• GPS-Suchspuraufzeichnung im Gelände',
    '• Mitgliederverwaltung & Notfallkontakte',
    '• Übungen starten, pausieren und beenden',
    '• Übungsarchiv & Urkundenausgabe',
  ];
  doc.text(adminPoints, margin + colW + 6, curY + 28, { lineHeightFactor: 1.35 });

  curY += 78;

  // Bottom Notice: Zero Regression Guarantee
  drawBox(margin, curY, contentWidth, 24, [240, 253, 244], C_EMERALD, 2.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(6, 95, 70);
  doc.text('🔒 100% Kapselung & Schutz der Haupt-App (Zero-Regression-Garantie)', margin + 6, curY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.3);
  doc.setTextColor(6, 78, 59);
  doc.text(
    'Das Jugendmodul operiert vollständig isoliert. Kinder-Accounts können sich niemals in Realeinsätze einloggen.\nErwachsenen-Einsatzdaten, sensible Archive und Behördenprotokolle sind für die Jugendgruppe unzugänglich.',
    margin + 6,
    curY + 13,
    { lineHeightFactor: 1.3 }
  );

  renderPageFooter();
}

// ============================================================================
// TEIL 1: FÜR DIE KIDS & JUGENDLICHEN
// ============================================================================
function renderKidsGuidePage() {
  doc.addPage();
  pageNumber++;
  renderPageHeader('TEIL 1: ANLEITUNG FÜR KIDS & JUGENDLICHE', 'Spürhunde Salzlandkreis e.V. • Jugendgruppe U18');
  curY = 32;

  // Intro Banner
  drawBox(margin, curY, contentWidth, 14, [240, 249, 255], C_CYAN, 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C_PRIMARY);
  doc.text('🎒 Willkommen bei den Spürhunde-Nachwuchssuchern!', margin + 5, curY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C_NAVY);
  doc.text('Hier lernst du, wie du dich anmeldest, Sektoren suchst, Funde meldest und dich im Notfall absicherst.', margin + 5, curY + 10.5);
  curY += 20;

  // Schritt 1: Anmeldung
  drawSectionHeading(1, 'Anmeldung in der Jugendgruppe', C_CYAN);
  drawBox(margin, curY, contentWidth, 26, C_BG_LIGHT, C_BORDER, 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C_DARK);
  doc.text('1. App starten & Button wählen:', margin + 4, curY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Auf dem Startbildschirm tippst du auf den großen blauen Button:  „🎒 Zur Spürhunde Jugendgruppe (U18)“.', margin + 4, curY + 10.5);

  doc.setFont('helvetica', 'bold');
  doc.text('2. Deinen Namen antippen & PIN eingeben:', margin + 4, curY + 16);
  doc.setFont('helvetica', 'normal');
  doc.text('Tippe auf dein Foto oder deinen Namen (z. B. Felix, Lena, Tim). Gib deine 4-stellige PIN ein (Standard: 1234)\nund drücke auf „Start“. Schon bist du in der Ausbildungszentrale!', margin + 4, curY + 20.5, { lineHeightFactor: 1.25 });
  curY += 32;

  // Schritt 2: Dienstausweis
  drawSectionHeading(2, 'Dein Spürhunde-Dienstausweis & Barcode', C_CYAN);
  drawBox(margin, curY, contentWidth, 24, C_BG_LIGHT, C_BORDER, 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C_NAVY);
  const ausweisText = [
    '• Tippe oben rechts auf „🪪 Ausweis“. Dort siehst du deinen bunten Jugend-Dienstausweis.',
    '• Auf dem Ausweis ist dein persönlicher Barcode abgebildet.',
    '• Vor Übungsbeginn hältst du diesen Barcode deinem Jugendleiter hin: Er scannt ihn mit der App ein,',
    '  um dich auf „🟢 BEREIT“ zu schalten. Erst dann startet die Aufzeichnung deiner Suchspur!',
  ];
  doc.text(ausweisText, margin + 4, curY + 5.5, { lineHeightFactor: 1.3 });
  curY += 30;

  // Schritt 3: Taktische Karte & Suchspur
  drawSectionHeading(3, 'Die Lagekarte & GPS-Suchspuraufzeichnung', C_CYAN);
  drawBox(margin, curY, contentWidth, 28, C_BG_LIGHT, C_BORDER, 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C_NAVY);
  const mapText = [
    '• Auf der Karte siehst du deinen aktuellen Standort mit deinem Jungspürer-Pin.',
    '• Eingeteilte Suchgebiete sind als bunte Sektoren markiert (z. B. „Sektor A - Waldweg“).',
    '• Sobald die Übung vom Leiter GESTARTET wurde und du BEREIT bist, zeichnet die App automatisch deine',
    '  gelaufene Suchspur als farbige Linie auf. So kann man später genau sehen, welche Flächen du abgesucht hast.',
    '• Mit der Taste „📍 Mein Standort“ springt die Karte jederzeit direkt zu deiner Position.',
  ];
  doc.text(mapText, margin + 4, curY + 5.5, { lineHeightFactor: 1.3 });
  curY += 34;

  // Schritt 4: Fundmeldung
  drawSectionHeading(4, 'Fundstück melden (Puppe, Rucksack, Fährte)', C_ROSE);
  drawBox(margin, curY, contentWidth, 26, [255, 241, 242], C_ROSE, 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C_ROSE);
  doc.text('Großer Button: „🎉 Fundstück melden 🎒“', margin + 4, curY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C_NAVY);
  const fundText = [
    '• Hast du die Übungspuppe, einen Gegenstand oder eine Fährte entdeckt? Bleib stehen!',
    '• Tippe auf den roten Fund-Button. Wähle die Schnellauswahl (z. B. 🧸 Puppe, 🎒 Rucksack, 🐾 Fährte).',
    '• Drücke auf „Fund eintragen“. Dein exakter GPS-Standort wird sofort mit Uhrzeit und deinem Namen',
    '  auf der Karte für alle markiert und im Protokoll festgehalten!',
  ];
  doc.text(fundText, margin + 4, curY + 11, { lineHeightFactor: 1.3 });
  curY += 32;

  // Schritt 5: Notfall-Pfeife & SOS
  drawSectionHeading(5, 'Sicherheit zuerst: Notfall-Pfeife (SOS) & Grenzen', C_ROSE);
  drawBox(margin, curY, contentWidth, 28, [254, 242, 242], C_ROSE, 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C_NAVY);
  const sosText = [
    '• 🚨 Notfall-Pfeife: Fühlst du dich unwohl, hast Schmerzen oder die Orientierung verloren? Tippe auf „🚨 SOS“!',
    '  Die App erzeugt einen lauten Pfeifton und schlägt sofort Alarm bei der Jugendleitung.',
    '  Deine Position pulsiert rot auf der Karte, damit dir sofort geholfen werden kann.',
    '• ⚠️ Übungsraum-Grenze: Läufst du zu weit vom Übungsgebiet weg, warnt dich die App automatisch mit einem',
    '  gelben Warnbanner. Bleibe dann stehen und melde dich per Funk bei deiner Leitung.',
  ];
  doc.text(sosText, margin + 4, curY + 5.5, { lineHeightFactor: 1.3 });
  curY += 34;

  // Schritt 6: Diplom & Quiz
  drawSectionHeading(6, 'Belohnung: Spürhunde-Diplom (PDF) & Junior-Quiz', C_AMBER);
  drawBox(margin, curY, contentWidth, 24, [254, 252, 232], C_AMBER, 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C_NAVY);
  const rewardText = [
    '• 📜 Übungs-Diplom: Tippe auf den Reiter „Aufgabe“ und klicke auf „Mein Spürhunde-Diplom herunterladen“.',
    '  Du erhältst eine offizielle, bunt gestaltete PDF-Urkunde mit deinem Namen, gelaufenen Kilometern und Siegel!',
    '• 🐕 Junior-Quiz: In Wartezeiten tippst du oben auf „🐕 Junior-Quiz“. Teste dein Wissen über Rettungshunde,',
    '  sammle Sterne und werde zum echten Spürhunde-Profi!',
  ];
  doc.text(rewardText, margin + 4, curY + 5.5, { lineHeightFactor: 1.3 });

  renderPageFooter();
}

// ============================================================================
// TEIL 2: FÜR DIE JUGENDLEITUNG & ADMINS
// ============================================================================
function renderAdminGuidePage1() {
  doc.addPage();
  pageNumber++;
  renderPageHeader('TEIL 2: ANLEITUNG FÜR DIE JUGENDLEITUNG', 'Spürhunde Salzlandkreis e.V. • Jugend-Adminboard');
  curY = 32;

  // Intro Banner
  drawBox(margin, curY, contentWidth, 14, [255, 251, 235], C_AMBER, 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C_AMBER);
  doc.text('🛡️ Leitstand & Ausbildungssteuerung (Jugend-Admin)', margin + 5, curY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C_NAVY);
  doc.text('Anleitung für erwachsene Jugendwarte, Ausbilder und Admins zur Durchführung von Übungen.', margin + 5, curY + 10.5);
  curY += 20;

  // Schritt 1: Login als Admin
  drawSectionHeading(1, 'Zugang zum Jugend-Adminboard', C_AMBER);
  drawBox(margin, curY, contentWidth, 26, C_BG_LIGHT, C_BORDER, 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C_NAVY);
  const adminLoginText = [
    '• Betrete das Jugendmodul über die Auswahlseite oder die Startseite („🎒 Zur Spürhunde Jugendgruppe“).',
    '• Klicke oben auf den Reiter „🛡️ Jugend-Admin“.',
    '• Wähle deinen Admin-Account aus der Schnellauswahl (z. B. Maria, Jens) und gib dein normales Kennwort ein.',
    '• Die App prüft deine Adminrechte gegen die Haupt-App. Nach erfolgreicher Prüfung öffnet sich das',
    '  Jugend-Adminboard. Keine Erwachsenendaten oder Realeinsätze werden dabei in den Jugendbereich geladen!',
  ];
  doc.text(adminLoginText, margin + 4, curY + 5.5, { lineHeightFactor: 1.3 });
  curY += 32;

  // Schritt 2: Übung planen
  drawSectionHeading(2, 'Neue Übung anlegen & Übungs-Typ wählen', C_AMBER);
  drawBox(margin, curY, contentWidth, 34, C_BG_LIGHT, C_BORDER, 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C_NAVY);
  const planText = [
    'Klicke im Adminboard auf „Neue Übung anlegen“. Hier wählst du den Übungs-Typ:',
    '  🟡 1. Reine Jugendübung: Nur die Kinder-Accounts und die Jugendleitung nehmen teil.',
    '  🟣 2. Gemeinsame Übung (Erwachsene vs. Jugend): Erlaubt den Beitritt erwachsener Einsatzkräfte',
    '        als „Team Erwachsene 🦺“. Die Kinder agieren als „Team Jugend 🎒“.',
    '• Vergib einen Titel (z. B. „Flächensuchübung Waldstück Süd“), den Ort und das Übungsziel.',
    '• Definiere das Suchziel (z. B. „Übungspuppe Max mit gelber Weste“ oder „Rucksack an Wegkreuzung“).',
    '• Neu angelegte Übungen starten im Status ⚪ GEPLANT (Bereitschaft).',
  ];
  doc.text(planText, margin + 4, curY + 5.5, { lineHeightFactor: 1.3 });
  curY += 40;

  // Schritt 3: Mitgliederverwaltung & Barcodes
  drawSectionHeading(3, 'Kräfte auf BEREIT setzen & Barcode-Scan', C_EMERALD);
  drawBox(margin, curY, contentWidth, 34, [240, 253, 244], C_EMERALD, 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C_NAVY);
  const readyText = [
    '• Genau wie bei den Erwachsenen gilt: Erst wenn ein Kind auf „🟢 BEREIT“ geschaltet ist,',
    '  zeichnet die App im Gelände aktiv die GPS-Suchstrecke auf der taktischen Karte auf!',
    '• Weg 1 (Scanner): Klicke auf „📷 Code scannen / Bereit“. Scanne den Barcode auf dem Dienstausweis',
    '  des Kindes (mit Barcode-Handscanner oder Kamera) oder tippe den Code ein (z. B. SHS-Y-101).',
    '• Weg 2 (Direktklick): In der Mitgliederliste findest du neben jedem Kind den Button „🟢 Bereit setzen“.',
    '• Ein Klick schaltet den Status auf „✓ Bereit“ um. Auf der Karte erscheint das Kind nun als aktiver Sucher.',
  ];
  doc.text(readyText, margin + 4, curY + 5.5, { lineHeightFactor: 1.3 });
  curY += 40;

  // Schritt 4: Übungsdurchführung
  drawSectionHeading(4, 'Übung starten, pausieren & abschließen', C_AMBER);
  drawBox(margin, curY, contentWidth, 36, C_BG_LIGHT, C_BORDER, 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C_NAVY);
  const flowText = [
    '• ▶️ Übung starten: Schaltet die Übung auf AKTIV (🟡 Gelb bei reiner Jugendübung, 🟣 Lila bei gemeinsamer).',
    '  Ab diesem Moment werden alle GPS-Spuren der bereitgestellten Teilnehmer live erfasst.',
    '• ⏸️ Übung pausieren: Für Zwischenbesprechungen oder Verpflegungspausen. Schaltet auf 🟠 ORANGE um.',
    '  Die Spuraufzeichnung wird unterbrochen, bis auf „▶️ Fortsetzen“ geklickt wird.',
    '• ⏹️ Übung beenden: Schließt die Übung ab, stoppt das Tracking und verschiebt die Übung samt aller',
    '  gemeldeten Funde, Logs und Tracks ins Jugend-Übungsarchiv.',
  ];
  doc.text(flowText, margin + 4, curY + 5.5, { lineHeightFactor: 1.3 });

  renderPageFooter();
}

function renderAdminGuidePage2() {
  doc.addPage();
  pageNumber++;
  renderPageHeader('TEIL 2: WEITERE LEITUNGSFUNKTIONEN', 'Spürhunde Salzlandkreis e.V. • Jugend-Adminboard');
  curY = 32;

  // Schritt 5: Gemeinsame Übungen
  drawSectionHeading(5, 'Szenario: Gemeinsame Übung („Erwachsene vs. Jugend“)', C_PURPLE);
  drawBox(margin, curY, contentWidth, 38, [250, 245, 255], C_PURPLE, 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C_NAVY);
  const jointText = [
    '• Ziel: Ein spielerischer Wettkampf oder gemischte Suchtrupps, ohne die Haupt-App zu belasten.',
    '• Beitritt für Erwachsene: Im Jugendmodul wählen erwachsene Helfer den Reiter „🦺 Gemeinsam“.',
    '  Sie melden sich mit ihrem gewohnten Account der Erwachsenen-App an.',
    '• Team-Kennzeichnung: Die App ordnet Erwachsene automatisch als „🦺 Team Erwachsene“ ein.',
    '  Kinder agieren als „🎒 Team Jugend“.',
    '• Live-Scoreboard: Auf der Karte zählt ein Zähler die Funde beider Teams live mit.',
    '• Funk: Es stehen getrennte Kanäle für „Team Jugend“, „Team Erwachsene“ und „Leitung“ bereit.',
    '• Datenschutz: Die Erwachsenen nehmen im Jugend-Modul teil; die Kinder erhalten dennoch keinerlei',
    '  Einblick in Realeinsätze oder sensible Einsatzakten der Haupt-App.',
  ];
  doc.text(jointText, margin + 4, curY + 5.5, { lineHeightFactor: 1.3 });
  curY += 44;

  // Schritt 6: Notfall- & Fürsorgemanagement
  drawSectionHeading(6, 'Notfall- & Fürsorgemanagement bei U18', C_ROSE);
  drawBox(margin, curY, contentWidth, 36, [255, 241, 242], C_ROSE, 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C_NAVY);
  const safetyText = [
    '• 🚨 Reagieren auf SOS-Notfallpfeife: Löst ein Kind die Pfeife aus, ertönt im Leitstand ein lautes Signal.',
    '  Oben im Bildschirm erscheint ein rotes Alarmbanner. Klicke auf „Standort zeigen“, um die Position',
    '  sofort zentriert auf der Karte zu sehen. Ist der Vorfall geklärt, klicke auf „Entwarnung“.',
    '• 📞 1-Klick-Elternanruf: In der Mitgliederliste des Adminboards ist bei jedem Kind die hinterlegte',
    '  Handynummer der Eltern direkt als grüner Anruf-Link eingebunden.',
    '• ⚠️ Geofence-Überwachung: Die App berechnet die Entfernung jedes Teilnehmers zum Übungsgebiet.',
    '  Verlässt jemand den Bereich (> 1.200 m), wird eine Warnung ausgegeben.',
  ];
  doc.text(safetyText, margin + 4, curY + 5.5, { lineHeightFactor: 1.3 });
  curY += 42;

  // Schritt 7: Urkunden & Diplome
  drawSectionHeading(7, 'Urkunden- & Ausweis-Generierung', C_AMBER);
  drawBox(margin, curY, contentWidth, 34, [254, 252, 232], C_AMBER, 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C_NAVY);
  const certText = [
    '• 📜 Spürhunde-Diplom für Mitglieder: Im Adminboard unter „Mitglieder“ findest du bei jedem Kind',
    '  den Button „Diplom“. Ein Klick erzeugt sofort die druckfertige DIN A4 PDF-Urkunde mit Name,',
    '  Datum, Suchstrecke und Siegel zur Aushändigung nach der Übung.',
    '• 🪪 Jugend-Dienstausweis: Klicke auf „🪪 Ausweis“, um den Mitgliedsausweis mit Barcode anzuzeigen',
    '  und auszudrucken. Kann laminiert und mit Lanyard als offizieller Übungsausweis genutzt werden.',
    '• 📁 Archivierung: Alle beendeten Übungen bleiben mit Logbuch und Funden im Übungsarchiv erhalten.',
  ];
  doc.text(certText, margin + 4, curY + 5.5, { lineHeightFactor: 1.3 });
  curY += 40;

  // Zusammenfassungstabelle
  drawSectionHeading(8, 'Status-Farben & Rollen-Übersicht', C_PRIMARY);
  drawBox(margin, curY, contentWidth, 38, C_BG_LIGHT, C_BORDER, 2);

  // Mini Table
  const tableRows = [
    ['⚪ Weiß', 'Bereitschaft / Geplante Übung', 'Keine aktive Aufzeichnung. Mitglieder sammeln sich.'],
    ['🟡 Gelb', 'Reine Jugendübung AKTIV', 'GPS-Suchspuraufzeichnung für bereitgestellte Kinder aktiv.'],
    ['🟣 Lila', 'Gemeinsame Übung AKTIV', 'Erwachsene & Jugend trainieren gemeinsam (Challenge).'],
    ['🟠 Orange', 'Übung PAUSIERT', 'Besprechung / Rast. Tracking temporär angehalten.'],
    ['🎒 Team Jugend', 'Kinder & Jugendliche (U18)', 'Vereinfachte Sucher-Ansicht, 4-stellige PIN, Fund-Melder.'],
    ['🦺 Team Erw.', 'Erwachsene Helfer', 'Teilnahme im Jugendmodul mit eigenem Login.'],
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C_MUTED);
  doc.text('FARBE / BADGE', margin + 4, curY + 5);
  doc.text('BEDEUTUNG', margin + 35, curY + 5);
  doc.text('BESCHREIBUNG', margin + 85, curY + 5);

  let rowY = curY + 9;
  tableRows.forEach(([c1, c2, c3]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C_DARK);
    doc.text(c1, margin + 4, rowY);
    doc.text(c2, margin + 35, rowY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C_NAVY);
    doc.text(c3, margin + 85, rowY);
    rowY += 4.8;
  });

  renderPageFooter();
}

// ============================================================================
// MAIN GENERATION EXECUTION
// ============================================================================
console.log('Generiere offizielles SHS-EZ Jugend-Handbuch (PDF)...');
renderCoverPage();
renderKidsGuidePage();
renderAdminGuidePage1();
renderAdminGuidePage2();

const outputPath = path.join(__dirname, '..', 'SHS-EZ_Jugendhandbuch_v7.0.pdf');
const pdfBytes = doc.output('arraybuffer');
fs.writeFileSync(outputPath, Buffer.from(pdfBytes));

console.log('Erfolgreich generiert!');
console.log('Ausgabepfad:', outputPath);
console.log('Dateigröße:', (fs.statSync(outputPath).size / 1024).toFixed(1), 'KB');
