const fs = require('fs');
let c = fs.readFileSync('src/components/OperationsArchive.tsx', 'utf8');

c = c.replace(
  /<button\n[\s\S]*?onClick=\{handleExportCsv\}[\s\S]*?<span>CSV Export<\/span>\n                    <\/button>/,
  (m) => `{isAdmin && (\n${m}\n)}`
);

c = c.replace(
  /\{selectedOp\?\.archivedTracks && selectedOp\.archivedTracks\.length > 0 && \(\n                      <button\n                        onClick=\{\(\) => exportOperationTracksAsGpx\(selectedOp\)\}[\s\S]*?<span>GPX Spuren<\/span>\n                      <\/button>\n                    \)\}/,
  (m) => `{isAdmin && ${m}}`
);

c = c.replace(
  /<button\n                      onClick=\{handlePrint\}[\s\S]*?<span>\{isExportingPdf \? 'Erzeuge PDF\.\.\.' : 'Drucken \/ PDF'\}<\/span>\n                    <\/button>/,
  (m) => `{isAdmin && (\n${m}\n)}`
);

c = c.replace(
  /<button\n[\s\S]*?onClick=\{handlePrint\}[\s\S]*?<span>\{isExportingPdf \? 'Erzeuge PDF\.\.\.' : 'Bericht drucken \/ PDF'\}<\/span>\n            <\/button>/,
  (m) => `{isAdmin && (\n${m}\n)}`
);


fs.writeFileSync('src/components/OperationsArchive.tsx', c);
console.log('OperationsArchive export buttons updated');
