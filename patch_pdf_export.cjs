const fs = require('fs');
let code = fs.readFileSync('src/lib/pdfExport.ts', 'utf8');

const newPdfLogic = `
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
          if (loc.activeTrack && loc.activeTrack.length >= 2) usersWithTracks.add(uid);
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
          pdf.text(\`Detailkarte: \${usr ? usr.name : uid} (\${usr?.callSign || 'Team'})\`, 105, 18, { align: 'center' });
          const pdfWidth = 180;
          const pdfHeight = (750 * pdfWidth) / 1200;
          pdf.addImage(userImgData, 'JPEG', 15, 25, pdfWidth, pdfHeight);
        }
      }
    } catch (e) {
      console.warn('User snapshots failed for PDF', e);
    }
`;

const regex = /\/\/ 6\. Map Snapshot[\s\S]*?console\.warn\('Map snapshot failed for PDF', e\);\s*\}/;

code = code.replace(regex, newPdfLogic);
fs.writeFileSync('src/lib/pdfExport.ts', code);
console.log('Patched pdfExport.ts');
