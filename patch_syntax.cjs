const fs = require('fs');
let tactical = fs.readFileSync('src/components/TacticalMap.tsx', 'utf8');
tactical = tactical.replace(/border-sky-400 ring-2 ring-sky-400\/50/g, "'border-sky-400 ring-2 ring-sky-400/50'");
fs.writeFileSync('src/components/TacticalMap.tsx', tactical);
console.log('Fixed');
