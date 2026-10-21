const { jsPDF } = require('jspdf');
const fs = require('fs');
const path = require('path');

// Colors
const COLOR_PRIMARY = [16, 185, 129];     // Emerald
const COLOR_DARK = [15, 23, 42];          // Slate 900
const COLOR_NAVY = [30, 41, 59];          // Slate 800
const COLOR_BLUE = [37, 99, 235];         // Royal Blue
const COLOR_MUTED = [100, 116, 139];      // Slate 500
const COLOR_CARD_BG = [248, 250, 252];    // Slate 50
const COLOR_BORDER = [226, 232, 240];     // Slate 200
const COLOR_WHITE = [255, 255, 255];
const COLOR_AMBER = [217, 119, 6];        // Amber 600
const COLOR_RED = [220, 38, 38];          // Red 600

const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4',
});

const pageWidth = 210;
const pageHeight = 297;
const margin = 16;
const contentWidth = pageWidth - 2 * margin;

let pageNumber = 1;

function addHeader(title, subtitle) {
  // Top colored bar
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(margin, 12, contentWidth, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_DARK);
  doc.text(title, margin, 20);

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(subtitle, margin, 25);
  }

  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, 28, pageWidth - margin, 28);
}

function addFooter(totalPagesEstimate = 7) {
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text('SHS-EZ • Suchhundestaffel Einsatzzentrale • Offizielles Systemhandbuch v6.3', margin, pageHeight - 9);
  doc.text(`Seite ${doc.internal.getNumberOfPages()}`, pageWidth - margin - 12, pageHeight - 9);
}

function drawCard(x, y, w, h, title, borderColor = COLOR_BORDER, bgColor = COLOR_CARD_BG) {
  doc.setFillColor(...bgColor);
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');

  if (title) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_DARK);
    doc.text(title, x + 4, y + 6);
  }
}

// ==========================================
// SEITE 1: TITELBLATT & SYSTEMÜBERSICHT
// ==========================================
// Background accents
doc.setFillColor(15, 23, 42); // Slate 900
doc.rect(0, 0, pageWidth, 95, 'F');

doc.setFont('helvetica', 'bold');
doc.setFontSize(26);
doc.setTextColor(...COLOR_WHITE);
doc.text('SHS-EZ', margin, 38);

doc.setFontSize(13);
doc.setTextColor(52, 211, 153); // Emerald 400
doc.text('Suchhundestaffel Einsatzzentrale', margin, 46);

doc.setFont('helvetica', 'normal');
doc.setFontSize(10);
doc.setTextColor(203, 213, 225);
doc.text('Vollstaendiges Funktionshandbuch & Rollenleitfaden', margin, 54);
doc.text('Fuer Admins, Einsatzleiter, Suchtrupps, Helfer & Gaeste / Behoerden', margin, 60);

doc.setFontSize(8);
doc.setTextColor(148, 163, 184);
doc.text(`Stand: Oktober 2026 | App-Version 6.3.0 | Progressive Web App & Android APK`, margin, 84);

// Content starts at y = 108
let curY = 105;

doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.setTextColor(...COLOR_DARK);
doc.text('1. Was ist SHS-EZ und wie funktioniert das System?', margin, curY);
curY += 6;

doc.setFont('helvetica', 'normal');
doc.setFontSize(9.2);
doc.setTextColor(...COLOR_DARK);
const introText = 
  'SHS-EZ ist eine hochspezialisierte, echtzeitfaehige Einsatzleitzentrale fuer Rettungs- und ' +
  'Suchhundestaffeln. Die Plattform vereint taktische Lagekartierung, praezise GPS-Echtzeitortung ' +
  'von Suchtrupps, lueckenlose Suchspur-Aufzeichnung, digitale Sektorenverwaltung, akustische Pager-Alarmierung ' +
  'und einen abhoersicheren Einsatzstellenfunk.\n\n' +
  'Das System unterscheidet strikt zwischen zwei grundlegenden Betriebszustaenden:\n' +
  '  1. Bereitschaftsmodus (kein aktiver Einsatz): Resourcenschonende Standby-Ortung (nur Punkt-Pins, keine Spur-Aufzeichnung) und Geister-Filter (automatische Abmeldung nach 5 Min. ohne Signal).\n' +
  '  2. Aktiver Einsatz / Uebung: Unterbrechungsfreie GPS-Hintergrundortung, Aufzeichnung der vollstaendigen Suchspuren (wer hat wo gesucht), Funk-Chat und EZ-Pin-Buendelung.';

const introLines = doc.splitTextToSize(introText, contentWidth);
doc.text(introLines, margin, curY);
curY += introLines.length * 4.6 + 4;

// 3 Key Feature Boxes
const colW = (contentWidth - 6) / 3;
drawCard(margin, curY, colW, 40, 'Echtzeit-Lagekarte');
doc.setFont('helvetica', 'normal');
doc.setFontSize(8);
doc.setTextColor(...COLOR_MUTED);
doc.text(
  'Topografische OpenTopoMap & Satellit. Live-Pins aller Kraefte, Sektoren mit automatischer Hektar-Berechnung, Fundort-Dokumentation & Drohnen-Stream.',
  margin + 4, curY + 12, { maxWidth: colW - 8 }
);

drawCard(margin + colW + 3, curY, colW, 40, 'Suchspur-Tracking');
doc.text(
  'Sobald ein Sucher auf BEREIT gesetzt wird, zeichnet die App dessen GPS-Pfad auf. Nach Einsatzende ist lueckenlos belegbar, welche Flaechen abgedeckt wurden.',
  margin + colW + 7, curY + 12, { maxWidth: colW - 8 }
);

drawCard(margin + (colW + 3) * 2, curY, colW, 40, 'Funk & Alarmierung');
doc.text(
  'Vollwertiger Textfunk mit Akustik-Quittung, Pager-Weckruf mit hoher Dringlichkeit sowie integrierter CB-Sprachfunk ueber Firebase Realtime & WebRTC.',
  margin + (colW + 3) * 2 + 4, curY + 12, { maxWidth: colW - 8 }
);

curY += 46;

// Quick Role Overview Box
drawCard(margin, curY, contentWidth, 38, 'Schnelluebersicht der Benutzerrollen im System', COLOR_PRIMARY, [240, 253, 244]);
doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
doc.setTextColor(...COLOR_DARK);
doc.text([
  '• Administrator / First-Admin (Maria): Vollzugriff auf Benutzer, Geraete, Systemeinstellungen, Einsatzverwaltung & Loeschrechte.',
  '• Einsatzleitung (EL): Erstellen, Starten, Pausieren & Beenden von Einsaetzen, Sektoreneinteilung, Trupp-Freigaben und Funkleitung.',
  '• Sucher / Aktiver Nutzer (Hundefuehrer, Suchtrupphelfer): GPS-Live-Tracking, Sektorenansicht, Fundmeldungen & Funkteilnahme.',
  '• Gast / Betrachter (Polizei, Feuerwehr, Behoerden): Reine Live-Leseansicht der Lagekarte ohne eigenes GPS-Tracking und ohne Schreibrechte.'
], margin + 4, curY + 12);

addFooter();

// ==========================================
// SEITE 2: ROLLEN & BERECHTIGUNGEN IM DETAIL
// ==========================================
doc.addPage();
addHeader('2. Rollen, Berechtigungen & Sicherheitsregeln', 'Detaillierte Rechte-Matrix fuer alle Benutzergruppen');

curY = 34;

function printRoleBlock(title, badgeText, badgeColor, description, canDoList, cannotDoList) {
  drawCard(margin, curY, contentWidth, 54, '', COLOR_BORDER, COLOR_WHITE);
  
  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_DARK);
  doc.text(title, margin + 4, curY + 7);

  // Badge
  doc.setFillColor(...badgeColor);
  doc.roundedRect(pageWidth - margin - 35, curY + 2.5, 31, 5.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_WHITE);
  doc.text(badgeText, pageWidth - margin - 33, curY + 6.3);

  // Description
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_DARK);
  doc.text(description, margin + 4, curY + 13, { maxWidth: contentWidth - 8 });

  // Can Do
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(5, 150, 105); // Green 600
  doc.text('Erlaubte Aktionen:', margin + 4, curY + 23);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLOR_DARK);
  doc.text(canDoList, margin + 4, curY + 28, { maxWidth: (contentWidth - 8) / 2 - 2 });

  // Cannot Do
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(220, 38, 38); // Red 600
  doc.text('Einschraenkungen / Gesperrt:', margin + contentWidth / 2 + 2, curY + 23);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLOR_DARK);
  doc.text(cannotDoList, margin + contentWidth / 2 + 2, curY + 28, { maxWidth: (contentWidth - 8) / 2 - 2 });

  curY += 58;
}

printRoleBlock(
  'Administrator (Admin) & First-Admin',
  'HOECHSTE RECHTE',
  [16, 185, 129],
  'Verantwortlich fuer das Gesamtnetzwerk, Benutzerkonten und die technische Einsatzbereitschaft.',
  '• Neue Konten anlegen, bearbeiten, loeschen\n• PIN-Codes & Passwoerter zuruecksetzen\n• Einsaetze starten, pausieren, archivieren\n• Sektoren zeichnen, Trupps zuweisen\n• Einsatzprotokolle & PDF-Berichte exportieren\n• Status-Korrektur (Bereit / Pause)',
  '• First-Admin (Maria) kann niemals geloescht\n  oder in den Rechten beschnitten werden\n• Waehrend aktivem Einsatz muss mind. 1 Admin\n  eingeloggt bleiben (Logout gesperrt)'
);

printRoleBlock(
  'Einsatzleitung (EL)',
  'TAKTIK & LEITUNG',
  [37, 99, 235],
  'Fuehrt den operativen Rettungseinsatz vor Ort in der mobilen Einsatzzentrale (EZ).',
  '• Einsaetze steuern (Start, Pause, Ende)\n• Sektoren erstellen und Hektar pruefen\n• Sucher per Barcode oder Klick auf Bereit setzen\n• Fundmeldungen verifizieren & Marker setzen\n• Drohnen-Videostream einbinden\n• Taktischen Funkverkehr leiten',
  '• Kann keine anderen Admins loeschen\n• Kein Zugriff auf kritische App-Settings\n• Mindestbesetzung im aktiven Einsatz:\n  Mindestens 1 EL muss stets online sein'
);

printRoleBlock(
  'Sucher / Aktiver Nutzer (Hundefuehrer & Helfer)',
  'EINSATZKRAFT',
  [217, 119, 6],
  'Befindet sich im Gelaende, fuehrt Rettungshunde oder sichert als Suchtrupphelfer ab.',
  '• Eigene GPS-Suchspur aufzeichnen (nach Freigabe)\n• Sektorengrenzen live auf Karte einsehen\n• Fundmeldungen mit Foto & GPS uebermitteln\n• Funk-Chat & Pager empfangen und antworten\n• Eigene Ausruestung & Profil ansehen',
  '• Kann Einsatz nicht starten oder beenden\n• Keine Sektoren fuer andere loeschen\n• Kann sich im aktiven Einsatz nicht selbst\n  ohne EZ-Bestaetigung als fertig deklarieren'
);

printRoleBlock(
  'Gast / Betrachter (Polizei, Rettungsdienst, Behoerden)',
  'NUR LESEZUGRIFF',
  [100, 116, 139],
  'Ermoeglicht externen Kraeften das Verfolgen der Lagekarte auf Tablets oder Leitstellen-Monitoren.',
  '• Live-Lagekarte in Echtzeit betrachten\n• Positionen der Suchtrupps & Sektoren sehen\n• Bestaetigte Fundmeldungen einsehen\n• Kartenebenen umschalten (Satellit / Topo)',
  '• Sendet KEINE eigene GPS-Position\n• Keine Schreibrechte im Funk-Chat\n• Keine Aenderung von Einsatzdaten\n• Kein Zugriff auf Mitglieder-Stammdaten'
);

addFooter();

// ==========================================
// SEITE 3: DIE ZWEI AUSWAHLSEITEN NACH DEM LOGIN
// ==========================================
doc.addPage();
addHeader('3. Die zwei Auswahlseiten nach dem Login', 'Strikte Trennung zwischen Bereitschaft und aktivem Einsatz');

curY = 34;

doc.setFont('helvetica', 'normal');
doc.setFontSize(9);
doc.setTextColor(...COLOR_DARK);
const loginExpl = 
  'Nach erfolgreicher Authentifizierung (Passwort oder Schnell-PIN) leitet die App NIEMALS sofort unkontrolliert ' +
  'in eine Ansicht weiter, sondern praesentiert immer eine rollenspezifische Auswahlseite. ' +
  'Das Interface unterscheidet automatisch, ob aktuell ein Einsatz aktiv/pausiert ist oder ob sich die Staffel im Bereitschaftsmodus befindet:';
const linesExpl = doc.splitTextToSize(loginExpl, contentWidth);
doc.text(linesExpl, margin, curY);
curY += linesExpl.length * 4.6 + 4;

// Case A: Bereitschaft
drawCard(margin, curY, contentWidth, 58, 'A) Auswahlseite OHNE aktiven Einsatz (Bereitschaftsmodus)', COLOR_PRIMARY, [240, 253, 244]);
doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
doc.setTextColor(...COLOR_DARK);
doc.text([
  'Gilt, wenn kein Einsatz laeuft oder Einsaetze lediglich im Status "Vorbereitet / Geplant" (weiss) existieren.',
  '',
  'Mensch-Maschine-Schnittstelle:',
  '  1.  Als Admin anmelden (nur fuer Admins sichtbar): Direkter Zugang zur EZ ohne Trupp-Unterscheidung.',
  '  2.  Als aktiver Nutzer anmelden (Bereitschaft): Eigener Standort-Pin sichtbar, KEINE Suchspur-Aufzeichnung.',
  '  3.  Als Gast / Betrachter anmelden: Reine Leseansicht ohne Standortsendung.',
  '  4.  Persoenlicher Trackingtest (10 / 20 / 30 Min.): Separate Selbsttest-Funktion fuer jeden.',
  '',
  'Verhalten des Bereitschaftsmodus:',
  '• Akkuschonung: Kein dauerhafter Hintergrund-WakeLock.',
  '• Geister-Filter: Sendet ein Smartphone 5 Minuten lang kein Lebenszeichen (App weggewischt oder geschlossen),',
  '  wird der Benutzer automatisch als offline markiert, um Geister-Pins auf der Karte zu verhindern.'
], margin + 4, curY + 11);

curY += 63;

// Case B: Bei aktivem Einsatz
drawCard(margin, curY, contentWidth, 68, 'B) Auswahlseite BEI AKTIVEM EINSATZ (Status aktiv / pausiert)', COLOR_BLUE, [239, 246, 255]);
doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
doc.setTextColor(...COLOR_DARK);
doc.text([
  'Sobald ein Realeinsatz (blau) oder eine Uebung (gelb) laeuft, erfolgt eine strikte Rollenteilung:',
  '',
  'Fuer Administratoren & Einsatzleitung:',
  '  • In der EZ (ez_command): Leitung aus der mobilen Zentrale. Kein GPS-Tracking der eigenen Person.',
  '    Der Admin wird nicht als einzelner Laeufer dargestellt, sondern gebuendelt im "EZ"-Kartenpin.',
  '  • Als Sucher (searcher): Der Admin begibt sich selbst ins Gelaende. Erhaelt eigenen Karten-Pin und',
  '    wird nach Freigabe als Suchtrupp getrackt.',
  '',
  'Fuer regulaere Einsatzkraefte (Sucher):',
  '  • Als aktiver Nutzer / Sucher anmelden: Erhaelt sofortigen Zugang zum Funk und zur Lagekarte.',
  '    Sobald der Admin den Sucher auf "Gruen / Bereit" setzt, wird die hochpraezise Suchspur aktiv.',
  '',
  'Fuer Behoerden & Beobachter:',
  '  • Als Gast / Betrachter: Reine Karteneinsicht ohne Funk- und GPS-Teilnahme.',
  '',
  'Schutzregel bei laufendem Einsatz: Mindestens 1 Admin und 1 EL muessen dauerhaft eingeloggt bleiben!'
], margin + 4, curY + 11);

curY += 73;

// Reminder Box
drawCard(margin, curY, contentWidth, 34, 'Wichtige Dienstvorschrift fuer Einsatzleiter', COLOR_AMBER, [254, 252, 232]);
doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
doc.setTextColor(...COLOR_DARK);
doc.text([
  '• Angelegte Einsaetze (Status planned / weiss) sperren den Bereitschaftsmodus noch nicht.',
  '• Erst mit Klick auf "Starten" wechselt das System in den Vollschutzmodus (Hintergrund-WakeLock,',
  '  Einsatzprotokollierung, Mindestbesetzung-Schutz).',
  '• Vor dem Verlassen des Einsatzes muessen alle Sucher ordnungsgemaess abgemeldet werden.'
], margin + 4, curY + 11);

addFooter();

// ==========================================
// SEITE 4: PERSÖNLICHER TRACKINGTEST
// ==========================================
doc.addPage();
addHeader('4. Persoenlicher Trackingtest (10 / 20 / 30 Min.)', 'Autonomer GPS-Qualitaetstest fuer Hundefuehrer und Geraete');

curY = 34;

doc.setFont('helvetica', 'normal');
doc.setFontSize(9);
doc.setTextColor(...COLOR_DARK);
const trackExpl = 
  'Der Trackingtest ist eine vollstaendig autonome Funktion von SHS-EZ. Er dient dazu, vor einem Einsatz ' +
  'oder waehrend des Trainings die GPS-Genauigkeit des Smartphones, die Energieeinstellungen und das ' +
  'Standortverhalten im Wald oder schwierigen Gelaende unabhaengig von einem Realeinsatz zu ueberpruefen.';
const linesTrack = doc.splitTextToSize(trackExpl, contentWidth);
doc.text(linesTrack, margin, curY);
curY += linesTrack.length * 4.6 + 4;

// 3 Test Steps Boxes
const boxH = 42;
drawCard(margin, curY, contentWidth, boxH, 'Schritt 1: Dauer waehlen & Starten', COLOR_BORDER, COLOR_WHITE);
doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
doc.setTextColor(...COLOR_DARK);
doc.text([
  '• Waehlbare Testdauer: 10 Minuten (Schnelltest), 20 Minuten (Standard) oder 30 Minuten (Dauertest).',
  '• Start per Knopfdruck: Die App aktiviert sofort den internen Hochpraezisions-GPS-Sensor.',
  '• Ein WakeLock verhindert das Einschlafen des Prozessors bei gesperrtem Bildschirm in der Jackentasche.',
  '• Visualisierung: Der Startpunkt wird als gruene Fahne auf der Live-Karte verankert.'
], margin + 4, curY + 11);

curY += boxH + 4;

drawCard(margin, curY, contentWidth, boxH, 'Schritt 2: Live-Aufzeichnung & Statistik', COLOR_BORDER, COLOR_WHITE);
doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
doc.setTextColor(...COLOR_DARK);
doc.text([
  '• Durchgaengige Trackingspur: Jeder GPS-Punkt wird mit Zeitstempel, Hoehe und Genauigkeit erfasst.',
  '• Richtungspfeile entlang der Spur zeigen die exakte Gehrichtung und Wendepunkte an.',
  '• Live-Metriken im Test-Cockpit: Zurueckgelegte Strecke (in Metern), Dauer, Restzeit und aktuelle km/h.',
  '• Warnanzeige bei Signalverlust oder schlechter HDOP / Satellitenabdeckung.'
], margin + 4, curY + 11);

curY += boxH + 4;

drawCard(margin, curY, contentWidth, boxH, 'Schritt 3: Auswertung, PDF & E-Mail-Protokoll', COLOR_BORDER, COLOR_WHITE);
doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
doc.setTextColor(...COLOR_DARK);
doc.text([
  '• Automatischer Stopp nach Ablauf des Timers oder manueller Abbruch jederzeit moeglich.',
  '• Rote Endpunkt-Fahne markiert den Schlusspunkt der Uebung.',
  '• Generierung eines ausfuehrlichen Testberichts mit Karten-Screenshot, Spurlaenge und GPS-Stabilitaet.',
  '• Direkter PDF-Download fuer das Hundefuehrer-Ausbildungsbuch oder E-Mail-Versand an Ausbildungsleiter.'
], margin + 4, curY + 11);

curY += boxH + 6;

// Special Rule Callout
drawCard(margin, curY, contentWidth, 32, 'Wichtigste Sonderregel gemaess Architektur-Vorgaben', COLOR_PRIMARY, [240, 253, 244]);
doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
doc.setTextColor(...COLOR_DARK);
doc.text([
  'Waehrend im normalen Bereitschaftsmodus KEINE Spuren aufgezeichnet werden (um Akku und Privatsphaere zu schonen),',
  'wird beim persoenlichen Trackingtest IMMER die vollstaendige GPS-Testspur visualisiert und gespeichert.',
  'Dieser Test funktioniert fuer alle Nutzer uneingeschraenkt - sowohl mit als auch ohne aktiven Einsatz.'
], margin + 4, curY + 11);

addFooter();

// ==========================================
// SEITE 5: EINSATZ-STATUS & FARBCODES
// ==========================================
doc.addPage();
addHeader('5. Einsatz-Status, Farbschemata & Lebenszyklus', 'Verbindliche optische Kennzeichnung gemaess Dienstvorschrift');

curY = 34;

doc.setFont('helvetica', 'normal');
doc.setFontSize(9);
doc.setTextColor(...COLOR_DARK);
doc.text(
  'Um Verwechslungen zwischen echten Einsaetzen, Uebungen und Vorbereitungsphasen unter Stress ' +
  'auszuschliessen, folgt SHS-EZ einer strikten, farbcodierten Status-Logik:',
  margin, curY, { maxWidth: contentWidth }
);
curY += 12;

function printStatusRow(colorBox, statusName, typeBadge, descText, buttonsText) {
  drawCard(margin, curY, contentWidth, 34, '', COLOR_BORDER, COLOR_WHITE);

  // Colored Indicator
  doc.setFillColor(...colorBox);
  doc.roundedRect(margin + 4, curY + 5, 8, 24, 1.5, 1.5, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...COLOR_DARK);
  doc.text(statusName, margin + 16, curY + 9);

  // Type Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(typeBadge, margin + 16, curY + 14);

  // Description
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(...COLOR_DARK);
  doc.text(descText, margin + 16, curY + 19, { maxWidth: contentWidth - 70 });

  // Buttons available
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_BLUE);
  doc.text('Verfuegbare Aktionen:', pageWidth - margin - 52, curY + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...COLOR_DARK);
  doc.text(buttonsText, pageWidth - margin - 52, curY + 14, { maxWidth: 48 });

  curY += 38;
}

printStatusRow(
  [226, 232, 240], // White / Light Slate
  'Angelegt / Vorbereitet (planned)',
  'WEISS (Niemals Gruen!)',
  'Einsatz ist vorkonfiguriert (z. B. Sektoren eingetragen, Vermisstenprofil hinterlegt), aber Kraefte sind noch in Anfahrt.',
  '• [▶ Starten] Button\n• [🗑 Entfernen] Button\n(KEIN [Beenden]-Button!)'
);

printStatusRow(
  [37, 99, 235], // Blue
  'Realeinsatz - Aktiv (active)',
  'BLAU',
  'Echter Vermissten- oder Rettungsfall laeuft. Hoechste Prioritaet. Alle Freigaben, Spuren und Funkkanale sind scharf geschaltet.',
  '• [⏸ Pausieren] Button\n• [🛑 Einsatz Beenden]\n• Sektor-Editor & Funde'
);

printStatusRow(
  [220, 38, 38], // Red
  'Realeinsatz - Pausiert (paused)',
  'ROT',
  'Realeinsatz ist temporaer unterbrochen (z. B. Lagebesprechung, Gewitterunterbrechung oder Nachtruhe). Tracking pausiert.',
  '• [▶ Fortsetzen] Button\n• [🛑 Einsatz Beenden]\n• Lageprotokoll fuehren'
);

printStatusRow(
  [234, 179, 8], // Yellow
  'Staffeluebung - Aktiv (active)',
  'GELB',
  'Trainings- oder Pruefungseinsatz. Reale GPS- und Funkaufzeichnung, jedoch im Archiv eindeutig als Schulung gekennzeichnet.',
  '• [⏸ Pausieren] Button\n• [🛑 Uebung Beenden]\n• Ausbildungsbericht'
);

printStatusRow(
  [234, 88, 12], // Orange
  'Staffeluebung - Pausiert (paused)',
  'ORANGE',
  'Uebungsunterbrechung fuer Feedback oder Trupp-Wechsel.',
  '• [▶ Fortsetzen] Button\n• [🛑 Uebung Beenden]'
);

addFooter();

// ==========================================
// SEITE 6: LAGEKARTE, SEKTOREN & FUNK
// ==========================================
doc.addPage();
addHeader('6. Taktische Lagekarte, Sektoren, Funk & Pager', 'Operative Werkzeuge fuer die Einsatzleitung und Trupps');

curY = 34;

// 2 Columns
const halfW = (contentWidth - 6) / 2;

// Left: Lagekarte & Sektoren
drawCard(margin, curY, halfW, 110, 'Taktische Lagekarte & Sektoren', COLOR_BORDER, COLOR_WHITE);
doc.setFont('helvetica', 'normal');
doc.setFontSize(8.2);
doc.setTextColor(...COLOR_DARK);
doc.text([
  'Karten-Grundlagen:',
  '• Topo-Layer: Hochaufloesende Hoehenlinien und Waldwege ueber OpenTopoMap.',
  '• Satelliten-Layer: Luftbildansicht fuer Vegetations- und Bebauungsbeurteilung.',
  '• Darkmode: Schnelle Nachtumschaltung (Mond/Sonne im oberen Wetter-/GPS-Panel).',
  '',
  'Sektoren-Management:',
  '• Freies Zeichnen von Polygonen im Gelaende.',
  '• Automatische Hektar- (ha) und Umfangsberechnung.',
  '• Truppzuweisung per Klick oder Scan.',
  '• Doppelzuweisungs-Schutz: Das System warnt',
  '  sofort rot ("In Sektor X"), falls ein Sucher',
  '  bereits einem anderen Sektor zugeteilt ist.',
  '',
  'Fundmeldungen & Marker:',
  '• Schnelle Fotodokumentation mit GPS-Fix.',
  '• Sofortige Alarmierung der Einsatzzentrale.',
  '• Export fuer Polizei & Rettungsdienst.'
], margin + 4, curY + 11);

// Right: Funk, Pager & Drohnen
drawCard(margin + halfW + 6, curY, halfW, 110, 'Funk, Pager & Drohnen-Stream', COLOR_BORDER, COLOR_WHITE);
doc.setFont('helvetica', 'normal');
doc.setFontSize(8.2);
doc.setTextColor(...COLOR_DARK);
doc.text([
  'Textfunk (Chat):',
  '• Zentraler Einsatzkanal fuer alle Kraefte.',
  '• Automatische Zeitstempelung und Speicherung.',
  '• Tastatur-optimiertes Eingabefeld (rutscht',
  '  auf Smartphones beim Tippen nicht weg).',
  '',
  'Akustischer Pager-Weckruf:',
  '• Sendet einen durchdringenden Weckruf-Ton',
  '  an einzelne Sucher oder alle Trupps.',
  '• Weckt schlafende Hundefuehrer im Zelt.',
  '• Sofortige Bestaetigung erforderlich.',
  '',
  'CB-Sprachfunk & Drohnen:',
  '• Direkt integrierter Sprechfunk (PTT).',
  '• Drohnen-Live-Stream (Funkantenne RadioTower',
  '  im oberen rechten Wetterfenster).',
  '• KML / GPX-Export fuer Garmin-Geraete.'
], margin + halfW + 10, curY + 11);

curY += 116;

// Bottom Safety & Geister-Filter Box
drawCard(margin, curY, contentWidth, 54, 'Der 5-Minuten Geister-Filter (Standby-Schutz)', COLOR_PRIMARY, [240, 253, 244]);
doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
doc.setTextColor(...COLOR_DARK);
doc.text([
  'Hauefiges Problem bei mobilen Apps: Einsatzkraefte verlassen die App ohne Logout (z. B. durch Schliessen des',
  'Browsers oder Wegwischen). Dadurch verblieben frueher inaktive "Geister-Pins" auf der Karte.',
  '',
  'Die Loesung in SHS-EZ Version 6.3:',
  '• Im Bereitschaftsmodus (kein aktiver Einsatz) prueft ein serverseitiger Timeout den letzten Zeitstempel.',
  '• Sendet ein Geraet laenger als 5 Minuten kein Signal, wird der Status automatisch auf "offline" gesetzt.',
  '• Die Karte bleibt dadurch stets uebersichtlich und zeigt nur Kraefte, die wirklich einsatzbereit sind.',
  '• WICHTIG: Im aktiven Einsatz gilt diese Abschaltung NICHT! Dort hat die unterbrechungsfreie Aufzeichnung',
  '  der Suchspuren oberste Prioritaet, selbst wenn die Funkverbindung im Funkloch temporaer abreisst.'
], margin + 4, curY + 11);

addFooter();

// ==========================================
// SEITE 7: CHECKLISTE FÜR DEN EINSATZABLAUF
// ==========================================
doc.addPage();
addHeader('7. Checkliste fuer den perfekten Einsatzablauf', 'Schritt-fuer-Schritt Leitfaden von der Alarmierung bis zum Archiv');

curY = 34;

function printCheckStep(stepNum, stepTitle, timeBadge, bulletPoints) {
  drawCard(margin, curY, contentWidth, 38, '', COLOR_BORDER, COLOR_WHITE);

  // Step Number Badge
  doc.setFillColor(...COLOR_PRIMARY);
  doc.circle(margin + 8, curY + 10, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_WHITE);
  doc.text(String(stepNum), margin + 6.8, curY + 11.5);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...COLOR_DARK);
  doc.text(stepTitle, margin + 17, curY + 11);

  // Time Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(timeBadge, pageWidth - margin - 35, curY + 11);

  // Details
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(...COLOR_DARK);
  doc.text(bulletPoints, margin + 17, curY + 18, { maxWidth: contentWidth - 22 });

  curY += 42;
}

printCheckStep(
  1,
  'Alarmierung & Einsatz anlegen (Status Vorbereitet)',
  'PHASE 1',
  '• Einsatzleiter oeffnet SHS-EZ und klickt auf "Neuer Einsatz".\n• Name, Vermisste Person, Sammelplatz (EZ-Standort) und Modus (Realeinsatz oder Uebung) waehlen.\n• Einsatz wird gespeichert (Status: planned / weiss). Suchtrupps koennen bereits Sektoren einsehen.'
);

printCheckStep(
  2,
  'Eintreffen am Sammelplatz & Starten',
  'PHASE 2',
  '• Einsatzleiter klickt auf [▶ Starten] - Status wechselt auf BLAU (Realeinsatz) oder GELB (Uebung).\n• Sucher melden sich in der App als "Aktiver Nutzer / Sucher" an.\n• Mindestbesetzung (1 Admin & 1 EL) ist ab jetzt automatisch durch das System geschuetzt.'
);

printCheckStep(
  3,
  'Sektoren zuweisen & Sucher auf BEREIT schalten',
  'PHASE 3',
  '• Im Sektor-Editor teilt die EL jedem Trupp seinen Suchbereich zu (Achtung auf Doppelzuweisungs-Warnung!).\n• Per Klick auf [🟢 Bereit] (oder Barcode-Scan des Mitgliedsausweises) wird das GPS-Tracking aktiviert.\n• Die Live-Suchspur des Trupps erscheint ab diesem Moment fuer die EZ sichtbar auf der Karte.'
);

printCheckStep(
  4,
  'Fund, Abschluss & Revisionssicheres Archivieren',
  'PHASE 4',
  '• Fundmeldungen mit Foto sofort pruefen und dokumentieren.\n• Nach Einsatzende klickt die EL auf [🛑 Einsatz Beenden] -> Rueckkehr aller Kraefte bestaetigen.\n• Alle GPS-Spuren, Chat-Protokolle und Sektorendaten werden revisionssicher im Einsatzarchiv abgelegt.\n• PDF-Einsatzbericht fuer Behoerden und Versicherung mit einem Klick exportieren.'
);

addFooter();

// Write to files
const outPathRoot = path.join(__dirname, '..', 'SHS_EZ_Funktionsuebersicht_Handbuch.pdf');
const outPathBackups = path.join('C:\\Users\\Maria\\.gemini\\antigravity\\scratch\\shs-ez-backups', 'SHS_EZ_Funktionsuebersicht_Handbuch.pdf');

const pdfBytes = doc.output();
fs.writeFileSync(outPathRoot, Buffer.from(pdfBytes, 'binary'));
console.log('PDF successfully generated at:', outPathRoot);

try {
  fs.writeFileSync(outPathBackups, Buffer.from(pdfBytes, 'binary'));
  console.log('PDF successfully copied to backups at:', outPathBackups);
} catch (e) {
  console.error('Backup copy error:', e.message);
}
