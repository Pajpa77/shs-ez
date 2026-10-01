const fs = require('fs');
let c = fs.readFileSync('src/components/OperationsArchive.tsx', 'utf8');
const start = c.indexOf('<button\n                      onClick={handleExportCsv}');
const endStr = `<span>{isExportingPdf ? 'Erzeuge PDF...' : 'Drucken / PDF'}</span>\n                    </button>`;
const end = c.indexOf(endStr) + endStr.length;

if (start > -1 && c.indexOf(endStr) > -1) {
  const piece = c.substring(start, end);
  c = c.replace(piece, '{isAdmin && (<>\n' + piece + '\n</>)}');
  fs.writeFileSync('src/components/OperationsArchive.tsx', c);
  console.log('Replaced');
} else {
  console.log('Not found');
}
