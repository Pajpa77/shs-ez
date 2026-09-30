const fs = require('fs');
let code = fs.readFileSync('src/context/RescueContext.tsx', 'utf8');

// We need to find all places where archivedTracks are pushed and filter them.
code = code.replace(/points: \[\.\.\.locState\.trackHistory\],/g, "points: [...locState.trackHistory].filter(p => p.operationId === (typeof targetOp !== 'undefined' ? targetOp.id : (typeof op !== 'undefined' ? op.id : currentOperation?.id))),");

code = code.replace(/points: \[\.\.\.uloc\.trackHistory\],/g, "points: [...uloc.trackHistory].filter(p => p.operationId === (typeof op !== 'undefined' ? op.id : currentOperation?.id)),");

// Let's also add a quick function call when `deleteOperation` happens to purge trackHistory!
code = code.replace(
  'deletedOpIdsRef.current.add(id);',
  `deletedOpIdsRef.current.add(id);
    setUserLocations((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach(uid => {
        if (next[uid]?.trackHistory) {
          next[uid].trackHistory = next[uid].trackHistory.filter(pt => pt.operationId !== id);
        }
      });
      return next;
    });`
);

fs.writeFileSync('src/context/RescueContext.tsx', code);
console.log("Patched successfully");
