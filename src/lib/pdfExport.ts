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
  pdf.setFontSize(22);
  pdf.text('Einsatzprotokoll', 105, 20, { align: 'center' });
  
  pdf.setFontSize(12);
  pdf.text(`Einsatzname: ${operation.title}`, 20, 40);
  pdf.text(`Start: ${new Date(operation.createdAt).toLocaleString('de-DE')}`, 20, 48);
  const endTime = operation.completedAt ? new Date(operation.completedAt).toLocaleString('de-DE') : 'Aktiv';
  pdf.text(`Ende: ${endTime}`, 20, 56);
  pdf.text(`Status: ${operation.status.toUpperCase()}`, 20, 64);

  // Findings
  pdf.setFontSize(16);
  pdf.text('Funde & Sichtungen', 20, 80);
  pdf.setFontSize(10);
  let yPos = 90;
  if (!operation.findings || operation.findings.length === 0) {
    pdf.text('Keine Funde gemeldet.', 20, yPos);
    yPos += 10;
  } else {
    operation.findings.forEach((finding, idx) => {
      pdf.text(`${idx + 1}. [${new Date(finding.timestamp).toLocaleTimeString()}] ${finding.userName || 'Suchkraft'}`, 20, yPos);
      yPos += 6;
      const desc = pdf.splitTextToSize(finding.description || 'Keine Details', 170);
      pdf.text(desc, 25, yPos);
      yPos += (desc.length * 5) + 5;
    });
  }

  // Participants
  yPos += 5;
  pdf.setFontSize(16);
  pdf.text('Teilnehmer', 20, yPos);
  yPos += 10;
  pdf.setFontSize(10);
  
  const participants = allUsers.filter(u => operation.participantIds?.includes(u.id));
  if (participants.length === 0) {
    pdf.text('Keine Teilnehmer erfasst.', 20, yPos);
  } else {
    participants.forEach((p, idx) => {
      pdf.text(`- ${p.name} (${p.callSign}) [${p.role.toUpperCase()}]`, 20, yPos);
      yPos += 6;
      if (yPos > 270) {
        pdf.addPage();
        yPos = 20;
      }
    });
  }

  // Map Snapshot
  try {
    const imgData = await captureTacticalMapScreenshot(operation, userLocations);
    if (imgData) {
      pdf.addPage();
      pdf.setFontSize(16);
      pdf.text('Kartenansicht (Gesamt)', 105, 20, { align: 'center' });
      // scale to fit A4
      const pdfWidth = 190;
      const pdfHeight = (750 * pdfWidth) / 1200; // 1200x750 is the fallback canvas size
      pdf.addImage(imgData, 'JPEG', 10, 30, pdfWidth, pdfHeight);
    }
  } catch (e) {
    console.warn('Map snapshot failed for PDF', e);
    pdf.text('(Karten-Screenshot konnte nicht geladen werden)', 20, 30);
  }

  pdf.save(`Einsatzprotokoll_${operation.title.replace(/\s+/g, '_')}.pdf`);
};
