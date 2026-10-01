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

const target = `              <button
                type="button"
                onClick={() => selectChannel('admins')}
                className={\`w-full flex items-center justify-between p-3 rounded-xl transition cursor-pointer text-left \${
                  activeChannel === 'admins'
                    ? 'bg-red-700 text-white font-bold shadow ring-1 ring-red-400'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300'
                }\`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="text-lg shrink-0">🛡️</span>
                  <div className="truncate">
                    <div className="font-bold leading-tight uppercase text-sm">Führungskanal EL</div>
                    <div className="text-[10px] opacity-75 mt-0.5">Geschützter Chat Einsatzleitung</div>
                  </div>
                </div>
                {activeChannel === 'admins' && <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />}
              </button>`;

const replacement = `              {isAdmin && (
${target}
              )}`;

c = c.replace(target, replacement);

// Also enforce filter
c = c.replace(
  /\} else if \(activeChannel === 'admins'\) \{\n[\s\S]*?return msg\.channel === 'admins';/,
  `} else if (activeChannel === 'admins') {\n        return isAdmin ? msg.channel === 'admins' : false;`
);

fs.writeFileSync('src/components/ChatPanel.tsx', c);
console.log('ChatPanel updated safely');
