const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

code = code.replace(
  '<div className="flex items-center gap-1.5 sm:gap-4 min-w-0">',
  '<div className="flex flex-wrap items-center gap-1.5 sm:gap-4 min-w-0">'
);
code = code.replace(
  '<div className="flex items-center gap-1.5 sm:gap-3 shrink-0">',
  '<div className="flex flex-wrap items-center gap-1.5 sm:gap-3 shrink-0">'
);

fs.writeFileSync('src/components/Navbar.tsx', code);
console.log('Patched wrap');
