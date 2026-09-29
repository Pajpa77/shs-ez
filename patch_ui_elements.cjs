const fs = require('fs');

let code = fs.readFileSync('src/components/ResponderList.tsx', 'utf8');

// 1. Remove emojis from status badges (I'll just strip the icon attribute everywhere)
code = code.replace(/, icon: '.*?' \}/g, ' }');
// Remove the rendering of the icon
code = code.replace(/<span>\{statusBadge\.icon\}<\/span> /g, '');

// 2. Change the square to a rectangle
code = code.replace(
  /className="w-3 h-3 rounded-sm inline-block shrink-0 border border-white\/80 shadow-sm"/g,
  'className="w-5 h-2 rounded-sm inline-block shrink-0 border border-white/80 shadow-sm"'
);

fs.writeFileSync('src/components/ResponderList.tsx', code);
console.log('Fixed lists');
