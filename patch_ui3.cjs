const fs = require('fs');

let responder = fs.readFileSync('src/components/ResponderList.tsx', 'utf8');

// I need to change:
// if (status === 'ready') { ... } else if (status === 'ez_reached') { ... } else if (status === 'near_ez') { ... }
// to:
// if (isOpActive) { if (status === 'ready') { ... } else if (status === 'ez_reached') { ... } else if (status === 'near_ez') { ... } }

responder = responder.replace(
    /if \(status === 'ready'\) \{/g,
    "if (isOpActive && status === 'ready') {"
);
responder = responder.replace(
    /\} else if \(status === 'ez_reached'\) \{/g,
    "} else if (isOpActive && status === 'ez_reached') {"
);
responder = responder.replace(
    /\} else if \(status === 'near_ez'\) \{/g,
    "} else if (isOpActive && status === 'near_ez') {"
);

fs.writeFileSync('src/components/ResponderList.tsx', responder);
console.log('Fixed ResponderList logic');
