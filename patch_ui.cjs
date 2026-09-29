const fs = require('fs');

function replaceFile(path, replacements) {
    let code = fs.readFileSync(path, 'utf8');
    for (let r of replacements) {
        code = code.replace(r.search, r.replace);
    }
    fs.writeFileSync(path, code);
}

replaceFile('src/components/TacticalMap.tsx', [
    { search: /return \{ icon: 'Y'', label: 'Einsatzkraft', color: '#64748b' \};/g, replace: "return { icon: '?', label: 'Einsatzkraft', color: '#64748b' };" }
]);

let code = fs.readFileSync('src/components/ResponderList.tsx', 'utf8');
code = code.replace(
    /let statusBadge = \{ label: 'In Anfahrt', color: 'bg-red-500\/20 text-red-300 border-red-500\/50', icon: 'Y"' \};/g,
    "let statusBadge = isOpActive ? { label: 'In Anfahrt', color: 'bg-red-500/20 text-red-300 border-red-500/50', icon: 'Y\"' } : { label: 'Eingeloggt', color: 'bg-slate-500/20 text-slate-300 border-slate-500/50', icon: '?' };"
);
fs.writeFileSync('src/components/ResponderList.tsx', code);

console.log('Fixed UI issues');
