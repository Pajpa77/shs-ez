const fs = require('fs');

let code = fs.readFileSync('src/components/ResponderList.tsx', 'utf8');

code = code.replace(
  /className="w-3\.5 h-3\.5 rounded-full shrink-0 border-2 border-white shadow-sm"/g,
  'className="w-5 h-2 rounded-sm shrink-0 border border-white/80 shadow-sm"'
);

fs.writeFileSync('src/components/ResponderList.tsx', code);
console.log('Fixed Spurlagen track color dot.');

let mapCode = fs.readFileSync('src/components/TacticalMap.tsx', 'utf8');

// I also need to remove the pulse in TacticalMap.tsx!
mapCode = mapCode.replace(
  /<div class="absolute -inset-1\.5 rounded-full \$\{outerGlowClass\}"><\/div>/g,
  ''
);

fs.writeFileSync('src/components/TacticalMap.tsx', mapCode);
console.log('Fixed map pulse.');
