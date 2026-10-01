const fs = require('fs');
let c = fs.readFileSync('src/components/ResponderList.tsx', 'utf8');

c = c.replace(/\\n<button/g, '\n<button');
c = c.replace(/\\n\)\}/g, '\n)}');

fs.writeFileSync('src/components/ResponderList.tsx', c);
console.log('Fixed ResponderList syntax');
