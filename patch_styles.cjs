const fs = require('fs');

// 1. Update TacticalMap.tsx
let tactical = fs.readFileSync('src/components/TacticalMap.tsx', 'utf8');

const oldIconHtml = `
            <div class="relative group cursor-pointer">
              <div class="absolute -inset-1.5 rounded-full \${outerGlowClass}"></div>
              <div class="relative flex items-center justify-center h-10 w-10 rounded-full border-2 \${avatarBorderClass} shadow-2xl overflow-hidden" style="background-color: \${item.trackColor};">
                \${
                  safeUserPhoto
                    ? \`<img src="\${safeUserPhoto}" alt="\${safeUserName}" class="h-full w-full object-cover" />\`
                    : \`<span class="text-white font-bold text-xs">\${escapeHtml(item.user.name.charAt(0))}</span>\`
                }
              </div>
              <!-- Sub-badge with equipment icon -->
              <div class="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full \${isEzCommand ? 'bg-indigo-900 text-white border-indigo-400' : 'bg-[#1E293B] text-xs border border-white/50'} shadow">
                \${badge.icon}
              </div>
              <!-- Call sign banner with Sector, Cluster Position & Connection Status -->
              <div class="absolute top-11 left-1/2 transform -translate-x-1/2 px-2 py-0.5 rounded \${item.isOnline ? 'bg-[#1E293B]/95 text-white' : 'bg-slate-800/90 text-slate-300'} text-[10px] font-semibold border border-slate-700 whitespace-nowrap shadow-md flex items-center gap-1">
                <span>\${safeCallSign}</span>
                \${ezBadge}
                \${clusterBadge}
                \${sectorTag}
                \${statusBadgeHtml}
              </div>
            </div>
          \`;
`;

const newIconHtml = `
            <div class="relative group cursor-pointer">
              <div class="absolute -inset-1.5 rounded-full \${outerGlowClass}"></div>
              <div class="relative flex items-center justify-center h-10 w-10 rounded-full border-2 \${avatarBorderClass} shadow-2xl overflow-hidden" style="background-color: \${item.trackColor};">
                \${
                  safeUserPhoto
                    ? \`<img src="\${safeUserPhoto}" alt="\${safeUserName}" class="h-full w-full object-cover" />\`
                    : \`<span class="text-white font-bold text-xs">\${escapeHtml(item.user.name.charAt(0))}</span>\`
                }
              </div>
            </div>
          \`;
`;

// Just to be safe, I'll use regex for the banner removal since exact string match might fail on whitespace
tactical = tactical.replace(
  /<!-- Sub-badge with equipment icon -->[\s\S]*?<\/div>\s+<\/div>/,
  '</div>'
);
fs.writeFileSync('src/components/TacticalMap.tsx', tactical);

// 2. Update ResponderList.tsx
let responder = fs.readFileSync('src/components/ResponderList.tsx', 'utf8');
responder = responder.replace(
  /className="w-2\.5 h-2\.5 rounded-full inline-block shrink-0 border border-white\/80 shadow-sm"/g,
  'className="w-3 h-3 rounded-sm inline-block shrink-0 border border-white/80 shadow-sm"'
);
fs.writeFileSync('src/components/ResponderList.tsx', responder);

console.log('Fixed styles.');
