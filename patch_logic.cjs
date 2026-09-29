const fs = require('fs');

let nav = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

const statusHtml = `<span>Mein Status</span>
                          <span className="font-bold">
                            {!(currentOperation?.status === 'active' || currentOperation?.status === 'paused') ? (
                              <span className="text-slate-300">👤 Eingeloggt (Bereitschaft)</span>
                            ) : currentUser?.arrivalStatus === 'ready' || currentUser?.arrivalStatus === 'ez_reached' ? (
                              <span className="text-emerald-400">🟢 Bereit in EZ / Feld</span>
                            ) : currentUser?.arrivalStatus === 'near_ez' ? (
                              <span className="text-amber-300">🟡 Im Einsatzbereich (≤500m)</span>
                            ) : (
                              <span className="text-rose-400">🚨 In Anfahrt (&gt;500m)</span>
                            )}
                          </span>`;

nav = nav.replace(/<span>Mein Status<\/span>[\s\S]*?<\/span>\s*<\/div>\s*<div className="grid grid-cols-3/, statusHtml + `\n                        </div>\n                        <div className="grid grid-cols-3`);

// Disable buttons when not in operation
const disabledClass = " opacity-50 cursor-not-allowed ";
nav = nav.replace(
  /onClick=\{\(\) => \{\n\s*if \(currentUser\) setUserArrivalStatus\(currentUser.id, 'in_transit'\);\n\s*\}\}/g,
  `onClick={() => {
                              if (currentUser && (currentOperation?.status === 'active' || currentOperation?.status === 'paused')) setUserArrivalStatus(currentUser.id, 'in_transit');
                            }}
                            disabled={!(currentOperation?.status === 'active' || currentOperation?.status === 'paused')}`
);
nav = nav.replace(
  /onClick=\{\(\) => \{\n\s*if \(currentUser\) setUserArrivalStatus\(currentUser.id, 'near_ez'\);\n\s*\}\}/g,
  `onClick={() => {
                              if (currentUser && (currentOperation?.status === 'active' || currentOperation?.status === 'paused')) setUserArrivalStatus(currentUser.id, 'near_ez');
                            }}
                            disabled={!(currentOperation?.status === 'active' || currentOperation?.status === 'paused')}`
);
nav = nav.replace(
  /onClick=\{\(\) => \{\n\s*if \(currentUser\) setUserArrivalStatus\(currentUser.id, 'ready'\);\n\s*\}\}/g,
  `onClick={() => {
                              if (currentUser && (currentOperation?.status === 'active' || currentOperation?.status === 'paused')) setUserArrivalStatus(currentUser.id, 'ready');
                            }}
                            disabled={!(currentOperation?.status === 'active' || currentOperation?.status === 'paused')}`
);

fs.writeFileSync('src/components/Navbar.tsx', nav);

// 2. Fix TacticalMap.tsx
let tactical = fs.readFileSync('src/components/TacticalMap.tsx', 'utf8');

tactical = tactical.replace(
  /targetUserIds\.forEach\(\(userId\) => \{/g,
  `targetUserIds.forEach((userId) => {
        const user = allUsers.find((u) => u.id === userId);
        if (!user) return;
        
        // Hide completely offline users UNLESS they are part of an active operation's participant list
        const isOpActive = currentOperation?.status === 'active' || currentOperation?.status === 'paused';
        const isParticipant = currentOperation?.participantIds?.includes(userId);
        if (!user.isActive && (!isOpActive || !isParticipant)) {
           return; 
        }`
);

// We need to also change the avatar border for offline users to make them white ONLY AFTER login?
// "erst nach dem login (ohne aktive einsätze/übungen) geht der user auf weiss" -> They want LOGGED IN users (without active op) to be WHITE bordered.
// If they are logged in, but no active op, what should their border be?
// In TacticalMap.tsx, avatarBorderClass currently is:
// !item.isOnline -> 'border-slate-400 opacity-60' (This means offline/not logged in, which we just hid above).
// connStatus === 'active' -> 'border-sky-400 ring-2 ring-sky-400/50' (Blue)
// The user says: "erst nach dem login (ohne aktive einsätze/übungen) geht der user auf weiss"
// So if they are logged in (active), but NO active operation, their border should be WHITE!

tactical = tactical.replace(
  /const avatarBorderClass = isPaused/g,
  `
        const isOpRunning = currentOperation?.status === 'active';
        const avatarBorderClass = (!isOpRunning && currentOperation?.status !== 'paused')
          ? 'border-white ring-2 ring-white/50'
          : isPaused`
);

fs.writeFileSync('src/components/TacticalMap.tsx', tactical);

console.log('Fixed Navbar and TacticalMap.');
