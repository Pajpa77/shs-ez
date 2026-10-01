import * as fs from 'fs';

const filePath = 'src/context/RescueContext.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const normalize = (str) => str.replace(/\r\n/g, '\n');

// 1. Update heartbeat to not stomp on newly active sessions
const oldHeartbeat = `  // Continuous heartbeat for active session so stale sessions never block login
  useEffect(() => {
    if (!currentUser || !currentUser.isActive) return;

    const ping = () => {
      const now = Date.now();
      updateUser(currentUser.id, {
        activeSessionId: deviceSessionId,
        lastHeartbeat: now,
        isActive: true,
      });
    };

    // Immediate ping on mount/login
    ping();
    const interval = setInterval(ping, 20000);
    return () => clearInterval(interval);
  }, [currentUser?.id, currentUser?.isActive, deviceSessionId]);

  // Real-time check to prevent simultaneous double logins on the same account from ANOTHER device/tab
  useEffect(() => {
    if (!currentUser || !currentUser.isActive || !currentUser.activeSessionId) return;

    // Check if the user's active session ID in Firestore matches this tab's deviceSessionId
    const isSameSession = currentUser.activeSessionId === deviceSessionId;

    if (!isSameSession) {
      console.log('Simultaneous double login detected from another device/session, logging out current device session.');
      
      // Perform local-only logout
      setCurrentUserId('');
      setIsLogoutConfirmOpen(false);
      try {
        localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
        localStorage.removeItem('rescue_app_remembered_device_user_id_slk_v4');
      } catch {}
      
      playAlertSound('alert');
      setActiveAlertNotification({
        title: '⚠️ Sitzung beendet (Neuer Login)',
        message: 'Ihr Benutzerkonto wurde soeben auf einem anderen Gerät oder Browserfenster angemeldet. Sie wurden hier automatisch abgemeldet.',
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  }, [currentUser?.activeSessionId, currentUser?.isActive, deviceSessionId]);`;

const newHeartbeat = `  // Continuous heartbeat for active session (only pings while this device owns the active session)
  useEffect(() => {
    if (!currentUser || !currentUser.isActive) return;
    if (currentUser.activeSessionId && currentUser.activeSessionId !== deviceSessionId) return;

    const ping = () => {
      const targetUser = allUsers.find((u) => u.id === currentUser.id);
      if (targetUser && targetUser.activeSessionId && targetUser.activeSessionId !== deviceSessionId) {
        return; // another device took over the session, do not overwrite
      }
      const now = Date.now();
      updateUser(currentUser.id, {
        activeSessionId: deviceSessionId,
        lastHeartbeat: now,
        isActive: true,
      });
    };

    const interval = setInterval(ping, 25000);
    return () => clearInterval(interval);
  }, [currentUser?.id, currentUser?.isActive, currentUser?.activeSessionId, deviceSessionId, allUsers]);

  // Real-time check to prevent simultaneous double logins on the same account from ANOTHER device/tab
  useEffect(() => {
    if (!currentUser || !currentUser.isActive || !currentUser.activeSessionId) return;

    // Check if the user's active session ID in Firestore matches this tab's deviceSessionId
    const isSameSession = currentUser.activeSessionId === deviceSessionId;

    if (!isSameSession) {
      console.warn('[Multi-Device Security] Simultaneous double login detected on account:', currentUser.name, 'from another device. Logging out this device session.');
      
      // Perform local-only logout immediately
      setCurrentUserId('');
      setIsLogoutConfirmOpen(false);
      try {
        localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
        localStorage.removeItem('rescue_app_remembered_device_user_id_slk_v4');
      } catch {}
      
      playAlertSound('alert');
      setActiveAlertNotification({
        title: '⚠️ Sitzung beendet (Neuer Login)',
        message: \`Ihr Benutzerkonto (\${currentUser.name}) wurde soeben auf einem anderen Gerät angemeldet. Sie wurden auf diesem Gerät automatisch abgemeldet.\`,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  }, [currentUser?.activeSessionId, currentUser?.isActive, currentUser?.name, deviceSessionId]);`;

if (normalize(content).includes(normalize(oldHeartbeat))) {
  content = normalize(content).replace(normalize(oldHeartbeat), normalize(newHeartbeat));
  console.log('Successfully patched heartbeat & multi-device listener');
} else {
  console.error('Could not find oldHeartbeat block in RescueContext.tsx');
}

// 2. Update setAllUsers in onSnapshot to always trust cloud activeSessionId & isActive
const oldSetAllUsersMerge = `                const merged = cloudUsers.map((cloudU) => {
                  const localU = localMap.get(cloudU.id);
                  let finalU = cloudU;
                  
                  if (localU) {
                    const cloudTime = cloudU.updatedAt ? new Date(cloudU.updatedAt).getTime() : 0;
                    const localTime = localU.updatedAt ? new Date(localU.updatedAt).getTime() : 0;
                    
                    if (cloudU.id === currentUserIdRef.current && localTime > cloudTime) {
                      finalU = localU;
                    } else {
                      // Preserve memberId, phone, licensePlate, callSign, and all profile details if cloud record missing or has empty values
                      finalU = {
                        ...localU,
                        ...cloudU,
                        name: cloudU.name || localU.name || '',
                        callSign: cloudU.callSign || localU.callSign || '',
                        memberId: cloudU.memberId || localU.memberId || '',
                        phone: cloudU.phone || localU.phone || '',
                        licensePlate: cloudU.licensePlate || localU.licensePlate || '',
                        organization: cloudU.organization || localU.organization || '',
                        customEquipmentNotes: cloudU.customEquipmentNotes || localU.customEquipmentNotes || '',
                        customEquipmentTags: (cloudU.customEquipmentTags && cloudU.customEquipmentTags.length > 0) ? cloudU.customEquipmentTags : (localU.customEquipmentTags || []),
                        equipment: (cloudU.equipment && cloudU.equipment.length > 0) ? cloudU.equipment : (localU.equipment || ['foot_search']),
                        dogInfo: cloudU.dogInfo || localU.dogInfo,
                        groupId: cloudU.groupId || localU.groupId,
                        photoUrl: cloudU.photoUrl || localU.photoUrl || '',
                      };
                    }
                  }`;

const newSetAllUsersMerge = `                const merged = cloudUsers.map((cloudU) => {
                  const localU = localMap.get(cloudU.id);
                  let finalU = { ...cloudU };
                  
                  if (localU) {
                    // Preserve profile details if cloud record missing or has empty values, BUT always accept cloud activeSessionId & isActive
                    finalU = {
                      ...localU,
                      ...cloudU,
                      name: cloudU.name || localU.name || '',
                      callSign: cloudU.callSign || localU.callSign || '',
                      memberId: cloudU.memberId || localU.memberId || '',
                      phone: cloudU.phone || localU.phone || '',
                      licensePlate: cloudU.licensePlate || localU.licensePlate || '',
                      organization: cloudU.organization || localU.organization || '',
                      customEquipmentNotes: cloudU.customEquipmentNotes || localU.customEquipmentNotes || '',
                      customEquipmentTags: (cloudU.customEquipmentTags && cloudU.customEquipmentTags.length > 0) ? cloudU.customEquipmentTags : (localU.customEquipmentTags || []),
                      equipment: (cloudU.equipment && cloudU.equipment.length > 0) ? cloudU.equipment : (localU.equipment || ['foot_search']),
                      dogInfo: cloudU.dogInfo || localU.dogInfo,
                      groupId: cloudU.groupId || localU.groupId,
                      photoUrl: cloudU.photoUrl || localU.photoUrl || '',
                      activeSessionId: cloudU.activeSessionId,
                      isActive: cloudU.isActive,
                    };
                  }`;

if (normalize(content).includes(normalize(oldSetAllUsersMerge))) {
  content = normalize(content).replace(normalize(oldSetAllUsersMerge), normalize(newSetAllUsersMerge));
  console.log('Successfully patched setAllUsers merge in onSnapshot');
} else {
  console.error('Could not find oldSetAllUsersMerge block in RescueContext.tsx');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Finished session concurrency fix');
