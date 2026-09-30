const fs = require('fs');
const path = 'src/components/OperationCreatorModal.tsx';
let code = fs.readFileSync(path, 'utf8');

// Fix grid-cols-2 to grid-cols-1 sm:grid-cols-2
code = code.replace(
  'className="grid grid-cols-2 gap-3 font-mono"',
  'className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono"'
);

// Fix the header flex overlap
// The header wrapper is likely: className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 bg-slate-800/80 sticky top-0 z-10 backdrop-blur-md"
code = code.replace(
  /className="flex items-center justify-between px-5 py-4 border-b border-slate-700\/60/g,
  'className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 border-b border-slate-700/60'
);

// Allow the header text container to wrap properly
code = code.replace(
  /className="text-xs text-slate-500 dark:text-slate-400 font-mono"/g,
  'className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono"'
);

fs.writeFileSync(path, code);
console.log('Patched modal');
