const fs = require('fs');

let c = fs.readFileSync('src/components/ResponderList.tsx', 'utf8');

c = c.replace(
  /<button\n[\s\S]*?onClick=\{\(\) => \{\n[\s\S]*?exportSingleTrackAsGpx\(\{[\s\S]*?\}\);\n[\s\S]*?\}\}\n[\s\S]*?className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-\[10px\] font-mono transition cursor-pointer flex items-center gap-1 border border-slate-700"\n[\s\S]*?title="Diesen Track als GPX-Datei herunterladen \(für Garmin \/ Polizei\)"\n[\s\S]*?>\n[\s\S]*?<Download className="w-3 h-3 text-emerald-400" \/>\n[\s\S]*?<span>GPX<\/span>\n[\s\S]*?<\/button>/,
  (m) => `{isRealAdmin && (\n${m}\n)}`
);

c = c.replace(
  /<button\n[\s\S]*?onClick=\{\(\) => \{\n[\s\S]*?exportSingleTrackAsGpx\(\{[\s\S]*?\}\);\n[\s\S]*?\}\}\n[\s\S]*?className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-500 dark:text-amber-400 rounded-lg font-bold text-xs flex items-center justify-center transition cursor-pointer shadow border border-amber-500\/30"\n[\s\S]*?title=\{`GPX-Track herunterladen \(\$\{userLocations\[user\.id\]\?\.trackHistory\?\.length\} Punkte\) für Garmin \/ QGIS \/ Polizei`\}\n[\s\S]*?>\n[\s\S]*?<Download className="w-3\.5 h-3\.5" \/>\n[\s\S]*?<\/button>/,
  (m) => `{isRealAdmin && (\n${m}\n)}`
);

fs.writeFileSync('src/components/ResponderList.tsx', c);
console.log('ResponderList updated');
