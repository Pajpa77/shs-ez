const fs = require('fs');

let tactical = fs.readFileSync('src/components/TacticalMap.tsx', 'utf8');
tactical = tactical.replace(/return \{ icon: '🟢', label: 'Einsatzkraft', color: '#64748b' \};/g, "return { icon: '👤', label: 'Einsatzkraft', color: '#64748b' };");
fs.writeFileSync('src/components/TacticalMap.tsx', tactical);

let responder = fs.readFileSync('src/components/ResponderList.tsx', 'utf8');
responder = responder.replace(/let statusBadge = \{ label: 'In Anfahrt'/g, "let statusBadge = !isOpActive ? { label: 'Kein Einsatz aktiv', color: 'bg-slate-500/20 text-slate-300 border-slate-500/50', icon: '👤' } : { label: 'In Anfahrt'");
fs.writeFileSync('src/components/ResponderList.tsx', responder);

console.log('Fixed');
