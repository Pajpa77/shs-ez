import { jsPDF } from 'jspdf';
import { YouthUser, YouthOperation } from './types';

export const generateYouthDiplomaPDF = async (
  user: YouthUser,
  operation?: YouthOperation | null,
  distanceMeters: number = 0
) => {
  try {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    // Safe fallbacks for operation
    const opTitle = operation?.title || 'Praxis-Übung Spürhunde-Jugend';
    const opDate = operation?.createdAt ? new Date(operation.createdAt).toLocaleDateString('de-DE') : new Date().toLocaleDateString('de-DE');

    // 1. Background styling
    doc.setFillColor(245, 248, 255); // Sehr zartes Blau
    doc.rect(0, 0, width, height, 'F');

    // Outer decorative frame
    doc.setDrawColor(0, 20, 137); // Reflex Blue
    doc.setLineWidth(3);
    doc.rect(10, 10, width - 20, height - 20);

    // Inner gold border
    doc.setDrawColor(234, 179, 8); // Gold / Amber
    doc.setLineWidth(1);
    doc.rect(13, 13, width - 26, height - 26);

    // 2. Header
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 20, 137);
    doc.setFontSize(22);
    doc.text('SPÜRHUNDE SALZLANDKREIS E.V.', width / 2, 30, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(70, 70, 70);
    doc.text('JUGENDGRUPPE & NACHWUCHSAUSBILDUNG (U18)', width / 2, 38, { align: 'center' });

    // 3. Main Diploma Title
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(234, 179, 8);
    doc.setFontSize(32);
    doc.text('Ü B U N G S - D I P L O M', width / 2, 56, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text('Dieses Zertifikat wird mit Stolz verliehen an:', width / 2, 68, { align: 'center' });

    // 4. Kid Name & Call Sign
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(0, 20, 137);
    doc.text(user.name, width / 2, 82, { align: 'center' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(13);
    doc.setTextColor(100, 100, 100);
    doc.text(`Funkrufname: ${user.callSign || 'Jungspürer'}`, width / 2, 90, { align: 'center' });

    // 5. Exercise Description
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    const introText =
      'hat mit großem Engagement, Teamgeist und vorbildlicher Orientierung an folgender Ausbildungsübung erfolgreich teilgenommen:';
    doc.text(introText, width / 2, 104, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text(`„${opTitle}“`, width / 2, 115, { align: 'center' });

    // 6. Performance Box
    const distanceKm = distanceMeters > 0 ? (distanceMeters / 1000).toFixed(2) : '1.80';
    const findingsCount = operation?.findings?.filter((f) => f.finderId === user.id).length || 0;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.roundedRect(width / 2 - 85, 124, 170, 24, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text('ORT & DATUM:', width / 2 - 80, 132);
    doc.text('SUCHSTRECKE:', width / 2 - 20, 132);
    doc.text('GELÖSTE AUFGABEN:', width / 2 + 40, 132);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`${opDate}`, width / 2 - 80, 140);
    doc.text(`${distanceKm} km`, width / 2 - 20, 140);
    doc.text(`${findingsCount > 0 ? `${findingsCount} Fundstücke` : 'Sektor durchkämmt'}`, width / 2 + 40, 140);

    // 7. Golden Stamp
    doc.setFillColor(254, 240, 138); // Helles Gold
    doc.setDrawColor(234, 179, 8);
    doc.setLineWidth(1.5);
    doc.circle(42, 165, 16, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(161, 98, 7);
    doc.text('★ ★ ★', 42, 160, { align: 'center' });
    doc.text('BESTANDEN', 42, 165, { align: 'center' });
    doc.text('SHS JUGEND', 42, 170, { align: 'center' });

    // 8. Signatures
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.5);
    doc.line(width / 2 - 60, 175, width / 2 - 10, 175);
    doc.line(width / 2 + 20, 175, width / 2 + 70, 175);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Jugendleitung / Ausbilder', width / 2 - 35, 181, { align: 'center' });
    doc.text('Ausbildungsleitung SHS-EZ', width / 2 + 45, 181, { align: 'center' });

    // Safe File Download trigger
    const cleanName = user.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Spuerhunde_Jugend_Diplom_${cleanName}.pdf`;

    // Direct blob download for maximum mobile browser / webview reliability
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    console.error('PDF Diploma Generation Error:', err);
    alert('Das Diplom konnte leider nicht erstellt werden. Bitte versuche es erneut.');
  }
};
