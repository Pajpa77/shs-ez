import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { RescueOperation, User } from '../types';

export const generateOperationPDF = async (operation: RescueOperation, allUsers: User[], mapElementId: string = 'tactical-map-container') => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  // Header
  pdf.setFontSize(22);
  pdf.text('Einsatzprotokoll', 105, 20, { align: 'center' });
  
  pdf.setFontSize(12);
  pdf.text(`Einsatzname: ${operation.name}`, 20, 40);
  pdf.text(`Start: ${new Date(operation.startTime).toLocaleString('de-DE')}`, 20, 48);
  const endTime = operation.endTime ? new Date(operation.endTime).toLocaleString('de-DE') : 'Aktiv';
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
      pdf.text(`${idx + 1}. [${new Date(finding.timestamp).toLocaleTimeString()}] ${finding.reportedByUsername}`, 20, yPos);
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
  const mapElement = document.getElementById(mapElementId);
  if (mapElement) {
    try {
      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      pdf.addPage();
      pdf.text('Kartenansicht', 105, 20, { align: 'center' });
      // scale to fit A4
      const pdfWidth = 190;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 10, 30, pdfWidth, pdfHeight);
    } catch (e) {
      console.warn('Map snapshot failed for PDF', e);
      pdf.text('(Karten-Screenshot konnte nicht geladen werden)', 20, 30);
    }
  }

  pdf.save(`Einsatzprotokoll_${operation.name.replace(/\s+/g, '_')}.pdf`);
};
