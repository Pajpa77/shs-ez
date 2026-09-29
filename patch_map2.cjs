const fs = require('fs');

let tactical = fs.readFileSync('src/components/TacticalMap.tsx', 'utf8');

const searchCode = `        const isCurrentlyOnline = user.isActive || Boolean(userLocations[userId]?.isLive);
        const isParticipant = Boolean(
          currentOperation && isCurrentlyOnline && (
            currentOperation.participantIds?.includes(userId) ||
            currentOperation.archivedTracks?.some(t => t.userId === userId) ||
            (userLocations[userId]?.trackHistory?.length || 0) > 0
          )
        );
        const isOnline = user.isActive;
        const isSelected = selectedUser?.id === userId;
        if (!isOnline && !showInactiveResponders && !isParticipant && !isSelected) return;`;

const replaceCode = `        const isCurrentlyOnline = user.isActive || Boolean(userLocations[userId]?.isLive);
        const isParticipant = Boolean(
          currentOperation && isCurrentlyOnline && (
            currentOperation.participantIds?.includes(userId) ||
            currentOperation.archivedTracks?.some(t => t.userId === userId) ||
            (userLocations[userId]?.trackHistory?.length || 0) > 0
          )
        );
        
        // Fix: Hide completely offline users UNLESS they are part of an active operation's participant list
        const isOpActive = currentOperation?.status === 'active' || currentOperation?.status === 'paused';
        if (!user.isActive && (!isOpActive || !isParticipant)) {
           return; 
        }

        const isOnline = user.isActive;
        const isSelected = selectedUser?.id === userId;
        if (!isOnline && !showInactiveResponders && !isParticipant && !isSelected) return;`;

tactical = tactical.replace(searchCode, replaceCode);

// Also need to re-apply the border color fix!
tactical = tactical.replace(
  /const avatarBorderClass = isPaused/g,
  `
        const isOpRunning = currentOperation?.status === 'active';
        const avatarBorderClass = (!isOpRunning && currentOperation?.status !== 'paused')
          ? 'border-white ring-2 ring-white/50'
          : isPaused`
);


fs.writeFileSync('src/components/TacticalMap.tsx', tactical);
console.log('Fixed tactical map offline visibility');
