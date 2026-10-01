const fs = require('fs');
let c = fs.readFileSync('src/components/ChatPanel.tsx', 'utf8');

if (!c.includes('isUserAdmin')) {
  c = c.replace(
    /import \{ User, ChatMessage, SearchTeam, SearchOperation, isFirstAdmin \} from '\.\.\/types';/,
    `import { User, ChatMessage, SearchTeam, SearchOperation, isFirstAdmin, isUserAdmin, isUserEL } from '../types';`
  );
}

// Add const isAdmin = isUserAdmin(currentUser) || isUserEL(currentUser);
c = c.replace(
  /const \{ currentUser, users, allUsers, operations, chatMessages, sendChatMessage, currentOperation, markChatAsRead \} = useRescue\(\);/,
  `const { currentUser, users, allUsers, operations, chatMessages, sendChatMessage, currentOperation, markChatAsRead } = useRescue();\n  const isAdmin = currentUser ? (isUserAdmin(currentUser) || isUserEL(currentUser)) : false;`
);

// Wrap button in isAdmin
c = c.replace(
  /<button\n[\s\S]*?onClick=\{\(\) => selectChannel\('admins'\)\}[\s\S]*?Führungskanal EL[\s\S]*?<\/button>/,
  (m) => `{isAdmin && (\n${m}\n)}`
);

// Also enforce filter
c = c.replace(
  /\} else if \(activeChannel === 'admins'\) \{\n[\s\S]*?return msg\.channel === 'admins';/,
  `} else if (activeChannel === 'admins') {\n        return isAdmin ? msg.channel === 'admins' : false;`
);

fs.writeFileSync('src/components/ChatPanel.tsx', c);
console.log('ChatPanel updated');
