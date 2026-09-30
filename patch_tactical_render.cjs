const fs = require('fs');
let code = fs.readFileSync('src/components/TacticalMap.tsx', 'utf8');

code = code.replace(
  'const archivedForUser = currentOperation?.archivedTracks?.find((at) => at.userId === userId);',
  `const archivedForUserRaw = currentOperation?.archivedTracks?.find((at) => at.userId === userId);
   const archivedForUser = archivedForUserRaw ? { ...archivedForUserRaw, points: archivedForUserRaw.points.filter(pt => !pt.operationId || pt.operationId === currentOperation.id) } : undefined;`
);

fs.writeFileSync('src/components/TacticalMap.tsx', code);
console.log('TacticalMap patched');
