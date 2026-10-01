const fs = require('fs');
let c = fs.readFileSync('src/components/ResponderList.tsx', 'utf8');

const s1 = c.indexOf('title="Diesen Track als GPX-Datei herunterladen');
if (s1 > -1) {
    const startBtn = c.lastIndexOf('<button', s1);
    const endBtn = c.indexOf('</button>', s1) + 9;
    const piece = c.substring(startBtn, endBtn);
    if (!piece.includes('isRealAdmin')) {
        c = c.replace(piece, '{isRealAdmin && (\\n' + piece + '\\n)}');
    }
}

const s2 = c.indexOf('GPX-Track herunterladen (${userLocations[user.id]?.trackHistory?.length} Punkte) für Garmin / QGIS / Polizei');
if (s2 > -1) {
    const startBtn = c.lastIndexOf('<button', s2);
    const endBtn = c.indexOf('</button>', s2) + 9;
    const piece = c.substring(startBtn, endBtn);
    if (!piece.includes('isRealAdmin')) {
        c = c.replace(piece, '{isRealAdmin && (\\n' + piece + '\\n)}');
    }
}

fs.writeFileSync('src/components/ResponderList.tsx', c);
console.log('done');
