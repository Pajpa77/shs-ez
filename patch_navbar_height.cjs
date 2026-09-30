const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

const search = '<header className="h-14 sm:h-16 flex items-center justify-between px-3 sm:px-5 bg-[#1E293B] border-b \nborder-slate-700 shadow-lg shrink-0 sticky top-0 z-[4000] text-slate-200">';
const search2 = '<header className="h-14 sm:h-16 flex items-center justify-between px-3 sm:px-5 bg-[#1E293B] border-b border-slate-700 shadow-lg shrink-0 sticky top-0 z-[4000] text-slate-200">';
const search3 = '<header className="h-14 sm:h-16 flex items-center justify-between px-3 sm:px-5 bg-[#1E293B] border-b \r\nborder-slate-700 shadow-lg shrink-0 sticky top-0 z-[4000] text-slate-200">';

const replacement = '<header className="min-h-[3.5rem] sm:min-h-[4rem] h-auto flex flex-wrap sm:flex-nowrap items-center justify-between px-2 sm:px-5 py-2 bg-[#1E293B] border-b border-slate-700 shadow-lg shrink-0 sticky top-0 z-[4000] text-slate-200 gap-y-1.5 gap-x-1">';

if (code.includes(search)) {
  code = code.replace(search, replacement);
  console.log('patched 1');
} else if (code.includes(search2)) {
  code = code.replace(search2, replacement);
  console.log('patched 2');
} else if (code.includes(search3)) {
  code = code.replace(search3, replacement);
  console.log('patched 3');
} else {
  // Try regex
  code = code.replace(/<header className="h-14 sm:h-16 flex items-center justify-between[^>]+>/, replacement);
  console.log('patched regex');
}

fs.writeFileSync('src/components/Navbar.tsx', code);
