const fs = require('fs');
let c = fs.readFileSync('src/components/OperationsArchive.tsx', 'utf8');

if (!c.includes('isUserAdmin')) {
  c = c.replace(
    /import \{ Operation, User, ChatMessage \} from '\.\.\/types';/,
    `import { Operation, User, ChatMessage, isUserAdmin } from '../types';`
  );
  c = c.replace(
    /const \{ currentOperation, updateOperation, currentUser, chatMessages, allUsers, operations, deleteOperation \} = useRescue\(\);/,
    `const { currentOperation, updateOperation, currentUser, chatMessages, allUsers, operations, deleteOperation } = useRescue();\n  const isAdmin = currentUser ? isUserAdmin(currentUser) : false;`
  );
}

// Option 3: Direct Download in OperationsArchive - Wrap in isAdmin
c = c.replace(
  /<button\n[\s\S]*?onClick=\{handleDirectPdfDownload\}\n[\s\S]*?Direkter PDF-Download \(Bild-Abbild\)\n[\s\S]*?<\/button>/g,
  (match) => {
    return `{isAdmin && (\n                    ${match}\n                  )}`;
  }
);

// CSV Export logic
c = c.replace(
  /<button\n[\s\S]*?onClick=\{handleExportCSV\}[\s\S]*?<\/button>/g,
  (match) => {
    return `{isAdmin && (\n                  ${match}\n                )}`;
  }
);

// JSON / Zip Export
c = c.replace(
  /<button\n[\s\S]*?onClick=\{handleExportJSON\}[\s\S]*?<\/button>/g,
  (match) => {
    return `{isAdmin && (\n                  ${match}\n                )}`;
  }
);

c = c.replace(
  /<button\n[\s\S]*?onClick=\{handleExportZip\}[\s\S]*?<\/button>/g,
  (match) => {
    return `{isAdmin && (\n                  ${match}\n                )}`;
  }
);


// In the Lagekarte Snapshot views inside archive (like 941, 990, 1415, 2101)
// It usually looks like <a href=... download=...>...</a>
c = c.replace(
  /<a\n[\s\S]*?download=\{`lagekarte[\s\S]*?<\/a>/g,
  (match) => {
    return `{isAdmin && (\n${match}\n)}`;
  }
);

// and <a href={selectedSnapshot} download="lagekarte-snapshot.jpg"...>
c = c.replace(
  /<a\n[\s\S]*?download="lagekarte-snapshot\.jpg"[\s\S]*?<\/a>/g,
  (match) => {
    return `{isAdmin && (\n${match}\n)}`;
  }
);

fs.writeFileSync('src/components/OperationsArchive.tsx', c);
console.log('OperationsArchive updated');
