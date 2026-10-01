const fs = require('fs');
let c = fs.readFileSync('src/components/MissionLog.tsx', 'utf8');

c = c.replace(
  `import { OperationLogEntry } from '../types';`,
  `import { OperationLogEntry, isUserAdmin } from '../types';`
);

c = c.replace(
  `const { currentOperation, updateOperation, currentUser, chatMessages, findings, userLocations } = useRescue();`,
  `const { currentOperation, updateOperation, currentUser, chatMessages, findings, userLocations } = useRescue();\n  const isAdmin = currentUser ? isUserAdmin(currentUser) : false;`
);

// Target specifically the download link under {/* Snapshot Preview Modal */}
const targetStart = c.indexOf('{/* Snapshot Preview Modal */}');
const linkStart = c.indexOf('<a', targetStart);
const linkEnd = c.indexOf('</a>', linkStart) + 4;

const piece = c.substring(linkStart, linkEnd);
c = c.replace(piece, '{isAdmin && (\n' + piece + '\n)}');

fs.writeFileSync('src/components/MissionLog.tsx', c);
console.log('MissionLog updated');
