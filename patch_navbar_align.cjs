const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

code = code.replace(
  '<div className="flex flex-wrap items-center gap-1.5 sm:gap-3 shrink-0">',
  '<div className="flex items-center justify-end ml-auto gap-1.5 sm:gap-3 shrink-0">'
);
code = code.replace(
  '<div className="flex flex-wrap items-center gap-1.5 sm:gap-4 min-w-0">',
  '<div className="flex items-center flex-wrap gap-1.5 sm:gap-4 min-w-0 flex-1">'
);

fs.writeFileSync('src/components/Navbar.tsx', code);
console.log('Fixed Navbar alignment');
