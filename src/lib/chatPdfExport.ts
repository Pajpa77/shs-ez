import { jsPDF } from 'jspdf';
import { ChatMessage, Finding } from '../types';

/**
 * Generates and downloads a clean, multi-page PDF for Chatverlauf
 */
export const exportChatHistoryPdf = (
  messages: ChatMessage[],
  operationTitle: string = 'Allgemein'
) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  // Header
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('Funk- und Chatprotokoll', margin, 18);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`Einsatz: ${operationTitle} | Erstellt am: ${new Date().toLocaleString('de-DE')}`, margin, 24);
  pdf.setLineWidth(0.3);
  pdf.line(margin, 27, pageWidth - margin, 27);

  let yPos = 35;

  if (!messages || messages.length === 0) {
    pdf.setFontSize(10);
    pdf.text('Keine Chat-Nachrichten vorhanden.', margin, yPos);
  } else {
    // Sort oldest first
    const sorted = [...messages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    sorted.forEach((msg, idx) => {
      const timeStr = new Date(msg.timestamp).toLocaleString('de-DE');
      const sender = `${msg.senderName} (${msg.senderCallSign || 'Funk'})`;
      const channel = msg.channel ? `[${msg.channel.toUpperCase()}]` : '';

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(30, 41, 59);
      pdf.text(`${idx + 1}. [${timeStr}] ${channel} ${sender}:`, margin, yPos);
      yPos += 4.5;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(51, 65, 85);
      const splitLines = pdf.splitTextToSize(msg.text || '', contentWidth - 4);
      pdf.text(splitLines, margin + 4, yPos);
      yPos += (splitLines.length * 4.2) + 3;

      if (yPos > 275) {
        pdf.addPage();
        yPos = 20;
      }
    });
  }

  const safeOp = operationTitle.replace(/[^a-zA-Z0-9]/g, '_');
  pdf.save(`Chatverlauf_${safeOp}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

/**
 * Generates and downloads a clean, multi-page PDF for System-Logbuch (Ein- und Ausloggen)
 */
export const exportLogbookPdf = (
  messages: ChatMessage[],
  operationTitle: string = 'Allgemein'
) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  // Header
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('System-Logbuch (Ein- & Ausloggvorgänge)', margin, 18);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`Einsatz: ${operationTitle} | Erstellt am: ${new Date().toLocaleString('de-DE')}`, margin, 24);
  pdf.setLineWidth(0.3);
  pdf.line(margin, 27, pageWidth - margin, 27);

  let yPos = 35;

  if (!messages || messages.length === 0) {
    pdf.setFontSize(10);
    pdf.text('Keine Logbuch-Einträge vorhanden.', margin, yPos);
  } else {
    const sorted = [...messages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    sorted.forEach((msg, idx) => {
      const timeStr = new Date(msg.timestamp).toLocaleString('de-DE');
      const sender = msg.senderName || 'System';

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(30, 41, 59);
      pdf.text(`${idx + 1}. [${timeStr}] ${sender}:`, margin, yPos);
      yPos += 4.5;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(51, 65, 85);
      const splitLines = pdf.splitTextToSize(msg.text || '', contentWidth - 4);
      pdf.text(splitLines, margin + 4, yPos);
      yPos += (splitLines.length * 4.2) + 3;

      if (yPos > 275) {
        pdf.addPage();
        yPos = 20;
      }
    });
  }

  const safeOp = operationTitle.replace(/[^a-zA-Z0-9]/g, '_');
  pdf.save(`System_Logbuch_${safeOp}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

/**
 * Generates and downloads a clean, multi-page PDF for Alarme & Fundmeldungen
 */
export const exportAlertsPdf = (
  alerts: ChatMessage[],
  findings: Finding[] = [],
  operationTitle: string = 'Allgemein'
) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  // Header
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(185, 28, 28); // Red
  pdf.text('Alarme & Fundmeldungen', margin, 18);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(30, 41, 59);
  pdf.text(`Einsatz: ${operationTitle} | Erstellt am: ${new Date().toLocaleString('de-DE')}`, margin, 24);
  pdf.setLineWidth(0.3);
  pdf.line(margin, 27, pageWidth - margin, 27);

  let yPos = 35;

  // 1. Findings Section
  if (findings && findings.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(217, 119, 6); // Amber
    pdf.text(`Dokumentierte Funde & Sichtungen (${findings.length}):`, margin, yPos);
    yPos += 7;

    findings.forEach((f, idx) => {
      const timeStr = new Date(f.timestamp).toLocaleString('de-DE');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(30, 41, 59);
      pdf.text(`${idx + 1}. [${timeStr}] ${f.title} (${f.category.toUpperCase()}) - ${f.userName}`, margin, yPos);
      yPos += 4.5;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      if (f.location) {
        pdf.setTextColor(100, 116, 139);
        pdf.text(`GPS: ${f.location.lat.toFixed(5)}, ${f.location.lng.toFixed(5)}`, margin + 4, yPos);
        yPos += 4;
      }

      pdf.setTextColor(51, 65, 85);
      const splitLines = pdf.splitTextToSize(f.description || 'Keine Beschreibung angegeben', contentWidth - 4);
      pdf.text(splitLines, margin + 4, yPos);
      yPos += (splitLines.length * 4.2) + 3;

      if (yPos > 275) {
        pdf.addPage();
        yPos = 20;
      }
    });
    yPos += 4;
  }

  // 2. Status & Eilmeldungen
  if (yPos > 240) {
    pdf.addPage();
    yPos = 20;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(220, 38, 38);
  pdf.text(`Status- & Eilmeldungen (${alerts.length}):`, margin, yPos);
  yPos += 7;

  if (alerts.length === 0) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Keine Alarme vorhanden.', margin, yPos);
  } else {
    const sorted = [...alerts].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    sorted.forEach((msg, idx) => {
      const timeStr = new Date(msg.timestamp).toLocaleString('de-DE');
      const sender = `${msg.senderName} (${msg.senderCallSign || 'Leitstelle'})`;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(185, 28, 28);
      pdf.text(`${idx + 1}. [${timeStr}] [ALARM] ${sender}:`, margin, yPos);
      yPos += 4.5;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(51, 65, 85);
      const splitLines = pdf.splitTextToSize(msg.text || '', contentWidth - 4);
      pdf.text(splitLines, margin + 4, yPos);
      yPos += (splitLines.length * 4.2) + 3;

      if (yPos > 275) {
        pdf.addPage();
        yPos = 20;
      }
    });
  }

  const safeOp = operationTitle.replace(/[^a-zA-Z0-9]/g, '_');
  pdf.save(`Alarme_und_Funde_${safeOp}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
