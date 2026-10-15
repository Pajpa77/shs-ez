import fs from 'fs';
let content = fs.readFileSync('src/components/TacticalMap.tsx', 'utf8');

// Desktop
content = content.replace(
  /\{showSectors \? <Eye className="w-3 h-3 text-blue-400" \/> : <EyeOff className="w-3 h-3" \/>\}\\n\s*Sektoren\\n\s*<\/button>/g,
  \{showSectors ? <Eye className="w-3 h-3 text-blue-400" /> : <EyeOff className="w-3 h-3" />}\\n                    Sektoren\\n                  </button>\\n                  <button onClick={() => setShowCoverage((v) => !v)} className={\\\lex items-center gap-1.5 px-2 py-1.5 rounded-lg transition text-left cursor-pointer font-medium text-[11px] \\\\}>\\n                    {showCoverage ? <Eye className="w-3 h-3 text-red-400" /> : <EyeOff className="w-3 h-3" />}\\n                    Lücken-Analyse\\n                  </button>\
);

// Mobile
content = content.replace(
  /<span>Sektoren \(\{currentOperation\?\.sectors\.length \|\| 0\}\)<\/span>\\n\s*\{showSectors \? <Eye className="w-3\.5 h-3\.5 text-blue-400" \/> : <EyeOff className="w-3\.5 h-3\.5" \/>\}\\n\s*<\/button>/g,
  \<span>Sektoren ({currentOperation?.sectors.length || 0})</span>\\n                  {showSectors ? <Eye className="w-3.5 h-3.5 text-blue-400" /> : <EyeOff className="w-3.5 h-3.5" />}\\n                </button>\\n                <button onClick={() => setShowCoverage((v) => !v)} className={\\\lex items-center justify-between px-3 py-2.5 rounded-xl transition text-left cursor-pointer font-semibold text-xs \\\\}>\\n                  <span>Lücken-Analyse</span>\\n                  {showCoverage ? <Eye className="w-3.5 h-3.5 text-red-400" /> : <EyeOff className="w-3.5 h-3.5" />}\\n                </button>\
);

fs.writeFileSync('src/components/TacticalMap.tsx', content);
console.log('patched');
