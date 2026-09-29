const fs = require('fs');

function replaceFile(path, replacements) {
    let code = fs.readFileSync(path, 'utf8');
    for (let r of replacements) {
        code = code.replace(r.search, r.replace);
    }
    fs.writeFileSync(path, code);
}

replaceFile('src/components/ResponderList.tsx', [
    { search: /connStatus === 'active'\s*\?\s*'bg-emerald-500 animate-pulse'/g, replace: "connStatus === 'active'\n                              ? 'bg-sky-500 animate-pulse'" },
    { search: /connStatus === 'active'\s*\?\s*'bg-emerald-500\/20 text-emerald-300 border border-emerald-500\/40 hover:bg-rose-900\/40 hover:text-rose-300'/g, replace: "connStatus === 'active'\n                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-rose-900/40 hover:text-rose-300'" }
]);

replaceFile('src/components/TacticalMap.tsx', [
    { search: /connStatus === 'active'\s*\?\s*'bg-emerald-500\/20'/g, replace: "connStatus === 'active'\n            ? 'bg-sky-500/20'" },
    { search: /connStatus === 'active'\s*\?\s*'border-emerald-500'/g, replace: "connStatus === 'active'\n            ? 'border-sky-500'" }
]);

console.log('Replaced colors');
