const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

// Hide EINSÄTZE / ARCHIV text on very small screens
code = code.replace(
  '<span className="text-xs sm:text-sm md:text-base font-bold leading-tight uppercase tracking-wider text-white hover:text-blue-300 transition cursor-pointer truncate text-left"',
  '<span className="hidden md:inline text-xs sm:text-sm md:text-base font-bold leading-tight uppercase tracking-wider text-white hover:text-blue-300 transition cursor-pointer truncate text-left"'
);

// In the operation selector button (which might say "ARCHIV" or "#1234 EINSÄTZE"):
// It looks like: 
// <span>{activeTab === 'archive' ? 'ARCHIV' : currentOperation ? `#${currentOperation.id.slice(-4).toUpperCase()}` : 'EINSÄTZE'}</span>
code = code.replace(
  "<span>\n                      {activeTab === 'archive'\n                        ? 'ARCHIV'\n                        : currentOperation\n                        ? `#${currentOperation.id.slice(-4).toUpperCase()}`\n                        : 'EINSÄTZE'}\n                    </span>",
  "<span className=\"hidden sm:inline\">\n                      {activeTab === 'archive'\n                        ? 'ARCHIV'\n                        : currentOperation\n                        ? `#${currentOperation.id.slice(-4).toUpperCase()}`\n                        : 'EINSÄTZE'}\n                    </span>"
);


// In the Bereitschaft button:
// <span className="font-bold text-slate-200">Bereitschaft</span>
code = code.replace(
  '<span className="font-bold text-slate-200">Bereitschaft</span>',
  '<span className="font-bold text-slate-200 hidden sm:inline">Bereitschaft</span>'
);

fs.writeFileSync('src/components/Navbar.tsx', code);
console.log('Patched Navbar text visibility');
