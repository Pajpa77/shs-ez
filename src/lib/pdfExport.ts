import { jsPDF } from 'jspdf';
import { SearchOperation, User, UserLocationState } from '../types';
import { captureTacticalMapScreenshot } from './mapSnapshotHelper';

export const generateOperationPDF = async (
  operation: SearchOperation, 
  allUsers: User[], 
  userLocations?: Record<string, UserLocationState>
) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  // Header
  pdf.setFontSize(20);
  pdf.text('Einsatzprotokoll & Abschlussbericht', 105, 18, { align: 'center' });
  pdf.setFontSize(10);
  pdf.text('Spürhunde-Salzlandkreis e.V. — Rettungshunde & Technische Ortung', 105, 24, { align: 'center' });
  
  pdf.setLineWidth(0.5);
  pdf.line(15, 27, 195, 27);

  pdf.setFontSize(11);
  pdf.text(`Einsatzbezeichnung: ${operation.title}`, 15, 34);
  pdf.text(`Einsatz-Typ: ${operation.type === 'exercise' ? 'Einsatzübung' : 'Realer Sucheinsatz'}`, 15, 41);
  pdf.text(`Einsatzleitung: ${operation.commander || 'Unbekannt'}`, 15, 48);
  pdf.text(`Ergebnis/Status: ${(operation.outcome || operation.status).toUpperCase()}`, 15, 55);

  pdf.text(`Alarmierung / Start: ${new Date(operation.createdAt).toLocaleString('de-DE')}`, 110, 34);
  const endTime = operation.completedAt ? new Date(operation.completedAt).toLocaleString('de-DE') : 'In Durchführung';
  pdf.text(`Einsatzende: ${endTime}`, 110, 41);
  pdf.text(`Einsatz-ID: #${operation.id.slice(-8).toUpperCase()}`, 110, 48);
  pdf.text(`Protokolldatum: ${new Date().toLocaleDateString('de-DE')}`, 110, 55);
  
  let yPos = 65;

  // 1. Missing Person Profile
  if (operation.missingPerson) {
    const mp = operation.missingPerson;
    pdf.setFontSize(13);
    pdf.text('1. Profil der vermissten Person', 15, yPos);
    yPos += 6;
    pdf.setFontSize(9);

    const genderMap: Record<string, string> = { male: 'Männlich', female: 'Weiblich', diverse: 'Divers' };
    const mpInfo = [
      `Name: ${mp.name || 'Unbekannt'} | Alter: ${mp.age ? `${mp.age} Jahre` : 'k.A.'} | Geschlecht: ${genderMap[mp.gender] || mp.gender || 'k.A.'}`,
      `Polizeiliches Aktenzeichen: ${mp.policeCaseId || 'Keines angegeben'} | Notfallkontakt: ${mp.emergencyContact || 'Keiner'}`,
      `Zuletzt gesehen: ${mp.lastSeenTime ? new Date(mp.lastSeenTime).toLocaleString('de-DE') : 'k.A.'} - Ort: ${mp.lastSeenLocation?.address || 'k.A.'}`,
      mp.homeAddress?.address ? `Wohnanschrift: ${mp.homeAddress.address}` : '',
      `Bekleidung: ${mp.clothing || 'Keine besonderen Angaben'}`,
      mp.medicalConditions && mp.medicalConditions.length > 0 ? `Medizinische Besonderheiten / Vorerkrankungen: ${mp.medicalConditions.join(', ')}` : '',
      mp.specialRisks ? `Besondere Risiken / Gefahrenlage: ${mp.specialRisks}` : '',
      mp.description ? `Personenbeschreibung / Merkmale: ${mp.description}` : '',
    ].filter(Boolean);

    mpInfo.forEach((line) => {
      const splitLines = pdf.splitTextToSize(line, 175);
      pdf.text(splitLines, 18, yPos);
      yPos += (splitLines.length * 4.5) + 1.5;
      if (yPos > 270) {
        pdf.addPage();
        yPos = 20;
      }
    });
    yPos += 4;
  }

  // 2. Sectors
  if (operation.sectors && operation.sectors.length > 0) {
    if (yPos > 240) {
      pdf.addPage();
      yPos = 20;
    }
    pdf.setFontSize(13);
    pdf.text('2. Suchsektoren & Geländeflächen', 15, yPos);
    yPos += 6;
    pdf.setFontSize(9);
    operation.sectors.forEach((s) => {
      const areaText = s.areaM2 ? ` (${(s.areaM2 / 10000).toFixed(2)} ha)` : '';
      const secText = `- Sektor "${s.name}"${areaText} | Prio: ${s.priority.toUpperCase()} | Status: ${s.status} | Kräfte: ${s.assignedUserNames?.join(', ') || 'Keine'}`;
      const lines = pdf.splitTextToSize(secText, 175);
      pdf.text(lines, 18, yPos);
      yPos += (lines.length * 4.5) + 2;
      if (yPos > 270) {
        pdf.addPage();
        yPos = 20;
      }
    });
    yPos += 4;
  }

  // 3. Findings
  if (yPos > 240) {
    pdf.addPage();
    yPos = 20;
  }
  pdf.setFontSize(13);
  pdf.text('3. Funde & Dokumentierte Sichtungen', 15, yPos);
  yPos += 6;
  pdf.setFontSize(9);
  if (!operation.findings || operation.findings.length === 0) {
    pdf.text('Keine Funde oder Freiverweise gemeldet.', 18, yPos);
    yPos += 6;
  } else {
    operation.findings.forEach((finding, idx) => {
      pdf.text(`${idx + 1}. [${new Date(finding.timestamp).toLocaleTimeString('de-DE')}] ${finding.userName || 'Suchkraft'} (${finding.category.toUpperCase()})`, 18, yPos);
      yPos += 4.5;
      const desc = pdf.splitTextToSize(`${finding.title}: ${finding.description || 'Keine Details'}`, 170);
      pdf.text(desc, 22, yPos);
      yPos += (desc.length * 4.5) + 3;
      if (yPos > 270) {
        pdf.addPage();
        yPos = 20;
      }
    });
  }
  yPos += 4;

  // 4. Participants
  if (yPos > 240) {
    pdf.addPage();
    yPos = 20;
  }
  pdf.setFontSize(13);
  pdf.text('4. Eingesetzte Einsatzkräfte & Einheiten', 15, yPos);
  yPos += 6;
  pdf.setFontSize(9);
  
  const participants = allUsers.filter(u => operation.participantIds?.includes(u.id));
  if (participants.length === 0) {
    pdf.text('Keine gesonderten Teilnehmer in Liste erfasst.', 18, yPos);
    yPos += 6;
  } else {
    participants.forEach((p) => {
      const dogText = p.dogInfo?.name ? ` | [Hund: ${p.dogInfo.name}]` : '';
      pdf.text(`- ${p.name} (${p.callSign || 'Spürhund-Einheit'}) [${p.role.toUpperCase()}]${dogText}`, 18, yPos);
      yPos += 5;
      if (yPos > 270) {
        pdf.addPage();
        yPos = 20;
      }
    });
  }
  yPos += 4;

  // 5. Operation Logs / Einsatztagebuch
  if (operation.logs && operation.logs.length > 0) {
    if (yPos > 230) {
      pdf.addPage();
      yPos = 20;
    }
    pdf.setFontSize(13);
    pdf.text('5. Lückenloses Einsatztagebuch & Protokoll', 15, yPos);
    yPos += 6;
    pdf.setFontSize(9);
    
    // Sort chronologically oldest first
    const sortedLogs = [...operation.logs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    sortedLogs.forEach((log) => {
      const timeStr = new Date(log.timestamp).toLocaleString('de-DE');
      const author = log.authorName || 'Einsatzleitung';
      const cat = log.category.toUpperCase();
      const logLine = `[${timeStr}] [${cat}] ${author}: ${log.text}`;
      const splitLines = pdf.splitTextToSize(logLine, 175);
      pdf.text(splitLines, 18, yPos);
      yPos += (splitLines.length * 4.5) + 2;
      if (yPos > 270) {
        pdf.addPage();
        yPos = 20;
      }
    });
    yPos += 4;
  }

  
    // 6. Map Snapshot
    try {
      const imgData = await captureTacticalMapScreenshot(operation, userLocations, allUsers);
      if (imgData) {
        pdf.addPage();
        pdf.setFontSize(14);
        pdf.text('6. Gesamte Lagekarte (Standort & Suchspuren)', 105, 18, { align: 'center' });
        const pdfWidth = 180;
        const pdfHeight = (750 * pdfWidth) / 1200;
        pdf.addImage(imgData, 'JPEG', 15, 25, pdfWidth, pdfHeight);
      }
    } catch (e) {
      console.warn('Map snapshot failed for PDF', e);
    }

    // 7. Individual User Detail Maps
    try {
      const usersWithTracks = new Set<string>();
      if (operation.archivedTracks) {
        operation.archivedTracks.forEach(t => usersWithTracks.add(t.userId));
      }
      if (userLocations) {
        Object.entries(userLocations).forEach(([uid, loc]) => {
          if (loc.trackHistory && loc.trackHistory.length >= 2) usersWithTracks.add(uid);
        });
      }

      const userArr = Array.from(usersWithTracks);
      for (let i = 0; i < userArr.length; i++) {
        const uid = userArr[i];
        const usr = allUsers.find(u => u.id === uid);
        const userImgData = await captureTacticalMapScreenshot(operation, userLocations, allUsers, uid);
        if (userImgData) {
          pdf.addPage();
          pdf.setFontSize(14);
          pdf.text(`Detailkarte: ${usr ? usr.name : uid} (${usr?.callSign || 'Team'})`, 105, 18, { align: 'center' });
          const pdfWidth = 180;
          const pdfHeight = (750 * pdfWidth) / 1200;
          pdf.addImage(userImgData, 'JPEG', 15, 25, pdfWidth, pdfHeight);
        }
      }
    } catch (e) {
      console.warn('User snapshots failed for PDF', e);
    }


  const safeTitle = operation.title.replace(/[^a-zA-Z0-9]/g, '_');
  pdf.save(`Einsatzprotokoll_${safeTitle}.pdf`);
};
