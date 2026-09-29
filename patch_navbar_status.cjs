const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

const regex = /let statusBadge = \{ label: 'In Bereitschaft'[\s\S]*?\/\/\s*in_transit\s*statusBadge = \{ label: 'Auf Anfahrt', color: 'bg-red-950\/60 text-red-300 border-red-700' \};\s*\}\s*\}/;

const replacement = `const isOpActive = Boolean(currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused'));
                        let statusBadge = { label: 'Offline', color: 'bg-slate-800 text-slate-500 border-slate-700' };

                        if (isOnline) {
                          if (!isOpActive) {
                            statusBadge = { label: 'In Bereitschaft', color: 'bg-slate-700 text-slate-200 border-slate-500' };
                          } else {
                            if (status === 'ready') {
                              statusBadge = { label: 'Vor Ort / Im Einsatz', color: 'bg-emerald-950 text-emerald-300 border-emerald-700' };
                            } else if (status === 'ez_reached') { 
                              statusBadge = { label: 'EZ erreicht', color: 'bg-amber-500/20 text-amber-300 border-amber-500/50' }; 
                            } else if (status === 'near_ez') { 
                              statusBadge = { label: 'Im Einsatzbereich (< 0.5km)', color: 'bg-amber-500 text-white border-amber-600' }; 
                            } else {
                              statusBadge = { label: 'Auf Anfahrt', color: 'bg-red-950/60 text-red-300 border-red-700' };
                            }
                          }
                        }`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/Navbar.tsx', code);
console.log('Fixed status logic!');
