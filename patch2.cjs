const fs = require('fs');
let code = fs.readFileSync('src/context/RescueContext.tsx', 'utf8');

code = code.replace(
    /\/\/ 5\. Activate selected users \(or current user\/participants\) and set arrivalStatus = 'ready' so tracking starts immediately/g,
    "// 5. Activate selected users (or current user/participants) and set arrivalStatus = 'in_transit' so they are not automatically tracking"
);

code = code.replace(
    /arrivalStatus: 'ready',\s*lastSeen: 'Aktiviert f\\?Ǭ?ü?r Folgesuche',/g,
    "arrivalStatus: 'in_transit',\n              lastSeen: 'Aktiviert für Folgesuche',"
);

code = code.replace(
    /next\[id\] = 'ready';/g,
    "next[id] = 'in_transit';"
);

fs.writeFileSync('src/context/RescueContext.tsx', code);
console.log('Patched');
