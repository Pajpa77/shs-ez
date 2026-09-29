const fs = require('fs');

let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

// 1. Add getUserTrackColor to imports
code = code.replace(
  /import \{ User, isFirstAdmin, isUserAdmin, isUserEL, isUserAdminOrEL \} from '\.\.\/types';/,
  "import { User, isFirstAdmin, isUserAdmin, isUserEL, isUserAdminOrEL, getUserTrackColor } from '../types';"
);

// 2. Fix the status badges to remove emoji icons
code = code.replace(
  /let statusBadge = \{ label: 'In Bereitschaft', color: 'bg-slate-800 text-slate-400 border-slate-700', icon: '[^']+' \};/g,
  "let statusBadge = { label: 'In Bereitschaft', color: 'bg-slate-800 text-slate-400 border-slate-700' };"
);

code = code.replace(
  /statusBadge = \{ label: 'Vor Ort \/ Im Einsatz', color: 'bg-emerald-950 text-emerald-300 border-emerald-700', icon: '[^']+' \};/g,
  "statusBadge = { label: 'Vor Ort / Im Einsatz', color: 'bg-emerald-950 text-emerald-300 border-emerald-700' };"
);

code = code.replace(
  /statusBadge = \{ label: 'EZ erreicht', color: 'bg-amber-500\/20 text-amber-300 border-amber-500\/50', icon: '[^']+' \};/g,
  "statusBadge = { label: 'EZ erreicht', color: 'bg-amber-500/20 text-amber-300 border-amber-500/50' };"
);

code = code.replace(
  /statusBadge = \{ label: 'Im Einsatzbereich \(< 0\.5km\)', color: 'bg-amber-500 text-white border-amber-600', icon: '[^']+' \};/g,
  "statusBadge = { label: 'Im Einsatzbereich (< 0.5km)', color: 'bg-amber-500 text-white border-amber-600' };"
);

code = code.replace(
  /statusBadge = \{ label: 'Auf Anfahrt', color: 'bg-red-950\/60 text-red-300 border-red-700', icon: '[^']+' \};/g,
  "statusBadge = { label: 'Auf Anfahrt', color: 'bg-red-950/60 text-red-300 border-red-700' };"
);

// 3. Fix the rendering of the dot -> rectangle
code = code.replace(
  /<span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: isOnline \? '#10b981' : '#64748b' }}><\/span>/g,
  "<span className=\"w-5 h-2 rounded-sm shrink-0 border border-slate-700 shadow-sm\" style={{ backgroundColor: isOnline ? getUserTrackColor(user, allUsers) : '#64748b' }}></span>"
);

// 4. Fix rendering of the badge to remove the icon
code = code.replace(
  /\{statusBadge\.icon\} \{statusBadge\.label\}/g,
  "{statusBadge.label}"
);

fs.writeFileSync('src/components/Navbar.tsx', code);
console.log('Patched Navbar.tsx');
