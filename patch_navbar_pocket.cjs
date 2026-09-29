const fs = require('fs');

let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

// 1. Import PocketModeOverlay
if (!code.includes('PocketModeOverlay')) {
  code = code.replace(
    /import \{ User, isFirstAdmin, isUserAdmin, isUserEL, isUserAdminOrEL, getUserTrackColor \} from '\.\.\/types';/,
    "import { User, isFirstAdmin, isUserAdmin, isUserEL, isUserAdminOrEL, getUserTrackColor } from '../types';\nimport { PocketModeOverlay } from './PocketModeOverlay';"
  );
}

// 2. Add state for pocket mode
if (!code.includes('isPocketMode')) {
  code = code.replace(
    /const \[showSarAdminMenu, setShowSarAdminMenu\] = useState\(false\);/,
    "const [showSarAdminMenu, setShowSarAdminMenu] = useState(false);\n  const [isPocketMode, setIsPocketMode] = useState(false);"
  );
}

// 3. Add button before Chat / Funk
const pocketButtonCode = `
          {/* Hosentaschen Modus */}
          <button
            onClick={() => setIsPocketMode(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600 transition cursor-pointer text-[10px] font-mono font-bold shadow-sm shrink-0"
            title="Hosentaschen-Modus (Bildschirm verdunkeln und sperren für Akku-sparendes Tracking)"
          >
            <span className="hidden sm:inline whitespace-nowrap">HOSENTASCHE</span>
            <span className="sm:hidden">LOCK</span>
          </button>
`;

if (!code.includes('HOSENTASCHE')) {
  code = code.replace(
    /\{\/\* Chat \/ Funk Schnellzugriff mit Ungelesen-Badge \*\/\}/,
    pocketButtonCode + '\n          {/* Chat / Funk Schnellzugriff mit Ungelesen-Badge */}'
  );
}

// 4. Render PocketModeOverlay
const overlayCode = `
      {isPocketMode && <PocketModeOverlay onUnlock={() => setIsPocketMode(false)} />}
`;

if (!code.includes('<PocketModeOverlay')) {
  code = code.replace(
    /<\/header>/,
    overlayCode + '\n    </header>'
  );
}

fs.writeFileSync('src/components/Navbar.tsx', code);
console.log('Patched Navbar.tsx for Pocket Mode');
