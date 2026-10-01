const fs = require('fs');
let c = fs.readFileSync('src/components/MissionLog.tsx', 'utf8');

c = c.replace(
  /<div className="flex items-center gap-2">[\s\S]*?<a[\s\S]*?href=\{selectedSnapshot\}[\s\S]*?download=\{`lagekarte-snapshot-\$\{currentOperation\.id\}\.jpg`\}[\s\S]*?className="px-2\.5 py-1[\s\S]*?<Download className="w-3\.5 h-3\.5 text-cyan-400" \/>[\s\S]*?<span>Download<\/span>[\s\S]*?<\/a>[\s\S]*?<button/,
  `<div className="flex items-center gap-2">\n                {isAdmin && (\n                <a\n                  href={selectedSnapshot}\n                  download={\`lagekarte-snapshot-\${currentOperation.id}.jpg\`}\n                  className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 border border-slate-400 dark:border-slate-600 rounded-lg text-xs font-mono font-bold transition text-slate-900 dark:text-slate-200 flex items-center gap-1.5"\n                >\n                  <Download className="w-3.5 h-3.5 text-cyan-400" />\n                  <span>Download</span>\n                </a>\n                )}\n                <button`
);

fs.writeFileSync('src/components/MissionLog.tsx', c);
console.log('MissionLog updated');
