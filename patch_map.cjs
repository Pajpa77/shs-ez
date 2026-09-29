const fs = require('fs');

let tactical = fs.readFileSync('src/components/TacticalMap.tsx', 'utf8');

const searchCode = `targetUserIds.forEach((userId) => {
        const user = allUsers.find((u) => u.id === userId);
        if (!user) return;
        
        // Hide completely offline users UNLESS they are part of an active operation's participant list
        const isOpActive = currentOperation?.status === 'active' || currentOperation?.status === 'paused';
        const isParticipant = currentOperation?.participantIds?.includes(userId);
        if (!user.isActive && (!isOpActive || !isParticipant)) {
           return; 
        }`;

const replaceCode = `targetUserIds.forEach((userId) => {`;

tactical = tactical.replace(searchCode, replaceCode);
fs.writeFileSync('src/components/TacticalMap.tsx', tactical);
console.log('Fixed duplicate code');
