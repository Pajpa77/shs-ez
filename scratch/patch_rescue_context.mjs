import * as fs from 'fs';

const filePath = 'src/context/RescueContext.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add deleteChatMessagesFromCloud and updated clearChatHistory, clearLogbook, clearAlerts
const oldClearBlock = `  const clearChatHistory = useCallback(() => {
    setChatMessages((prev) =>
      prev.filter(
        (m) =>
          m.channel === 'system' ||
          m.channel === 'logs' ||
          m.text.includes('hat sich soeben eingeloggt') ||
          m.text.includes('hat das System verlassen') ||
          m.isAlert ||
          m.text.includes('EINSATZ REAKTIVIERT') ||
          m.text.includes('EINSATZ BEENDET') ||
          m.text.includes('EINSATZ PAUSIERT') ||
          m.text.includes('EINSATZ WIEDERAUFGENOMMEN') ||
          m.text.includes('REALEINSATZ')
      )
    );
  }, []);

  const clearLogbook = useCallback(() => {
    setChatMessages((prev) =>
      prev.filter(
        (m) =>
          !(
            m.channel === 'system' ||
            m.channel === 'logs' ||
            m.text.includes('hat sich soeben eingeloggt') ||
            m.text.includes('hat das System verlassen')
          )
      )
    );
  }, []);

  const clearAlerts = useCallback(() => {
    setChatMessages((prev) =>
      prev.filter(
        (m) =>
          !(
            m.isAlert ||
            m.text.includes('EINSATZ REAKTIVIERT') ||
            m.text.includes('EINSATZ BEENDET') ||
            m.text.includes('EINSATZ PAUSIERT') ||
            m.text.includes('EINSATZ WIEDERAUFGENOMMEN') ||
            m.text.includes('REALEINSATZ')
          )
      )
    );
  }, []);`;

const newClearBlock = `  const deleteChatMessagesFromCloud = useCallback((msgIds: string[]) => {
    if (!isFirebaseConfigured || !msgIds || msgIds.length === 0) return;
    safeFirestoreWrite(async () => {
      for (let i = 0; i < msgIds.length; i += 400) {
        const chunk = msgIds.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((id) => {
          batch.delete(doc(db, 'chat_messages', id));
        });
        await batch.commit();
      }
    }, 'delete_chat_messages');
  }, []);

  const clearChatHistory = useCallback(() => {
    const toDelete: string[] = [];
    setChatMessages((prev) => {
      const remaining: ChatMessage[] = [];
      prev.forEach((m) => {
        const isPreserved =
          m.channel === 'system' ||
          m.channel === 'logs' ||
          m.text.includes('hat sich soeben eingeloggt') ||
          m.text.includes('hat das System verlassen') ||
          m.isAlert ||
          m.text.includes('EINSATZ REAKTIVIERT') ||
          m.text.includes('EINSATZ BEENDET') ||
          m.text.includes('EINSATZ PAUSIERT') ||
          m.text.includes('EINSATZ WIEDERAUFGENOMMEN') ||
          m.text.includes('REALEINSATZ');
        if (isPreserved) {
          remaining.push(m);
        } else {
          toDelete.push(m.id);
        }
      });
      try {
        localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(remaining));
      } catch {}
      return remaining;
    });
    if (toDelete.length > 0) {
      deleteChatMessagesFromCloud(toDelete);
    }
  }, [deleteChatMessagesFromCloud]);

  const clearLogbook = useCallback(() => {
    const toDelete: string[] = [];
    setChatMessages((prev) => {
      const remaining: ChatMessage[] = [];
      prev.forEach((m) => {
        const isLogbook =
          m.channel === 'system' ||
          m.channel === 'logs' ||
          m.text.includes('hat sich soeben eingeloggt') ||
          m.text.includes('hat das System verlassen');
        if (!isLogbook) {
          remaining.push(m);
        } else {
          toDelete.push(m.id);
        }
      });
      try {
        localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(remaining));
      } catch {}
      return remaining;
    });
    if (toDelete.length > 0) {
      deleteChatMessagesFromCloud(toDelete);
    }
  }, [deleteChatMessagesFromCloud]);

  const clearAlerts = useCallback(() => {
    const toDelete: string[] = [];
    setChatMessages((prev) => {
      const remaining: ChatMessage[] = [];
      prev.forEach((m) => {
        const isAlert =
          m.isAlert ||
          m.text.includes('EINSATZ REAKTIVIERT') ||
          m.text.includes('EINSATZ BEENDET') ||
          m.text.includes('EINSATZ PAUSIERT') ||
          m.text.includes('EINSATZ WIEDERAUFGENOMMEN') ||
          m.text.includes('REALEINSATZ');
        if (!isAlert) {
          remaining.push(m);
        } else {
          toDelete.push(m.id);
        }
      });
      try {
        localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(remaining));
      } catch {}
      return remaining;
    });
    if (toDelete.length > 0) {
      deleteChatMessagesFromCloud(toDelete);
    }
  }, [deleteChatMessagesFromCloud]);`;

// Normalise newlines for replacement
const normalize = (str) => str.replace(/\r\n/g, '\n');
const normalizedContent = normalize(content);

if (normalizedContent.includes(normalize(oldClearBlock))) {
  content = normalizedContent.replace(normalize(oldClearBlock), normalize(newClearBlock));
  console.log('Successfully patched clear functions in RescueContext.tsx');
} else {
  console.error('Could not find oldClearBlock in RescueContext.tsx');
}

// 2. Patch onSnapshot for chat_messages to always update state with cloudChat (even if empty)
const oldOnSnapshotChat = `            if (cloudChat.length > 0) {
              setChatMessages(cloudChat);
            }
          } else {
            isInitialChatLoad = false;
          }`;

const newOnSnapshotChat = `            setChatMessages(cloudChat);
            try {
              localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(cloudChat));
            } catch {}
          } else {
            isInitialChatLoad = false;
            setChatMessages([]);
            try {
              localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify([]));
            } catch {}
          }`;

if (normalize(content).includes(normalize(oldOnSnapshotChat))) {
  content = normalize(content).replace(normalize(oldOnSnapshotChat), normalize(newOnSnapshotChat));
  console.log('Successfully patched onSnapshot chat in RescueContext.tsx');
} else {
  console.error('Could not find oldOnSnapshotChat in RescueContext.tsx');
}

// 3. Patch deleteOperation to also delete op chat messages from Firestore
const oldDeleteOpChat = `    // Delete from Firestore Cloud Database
    safeFirestoreWrite(
      () => deleteDoc(doc(db, 'operations', id)),
      \`delete_operation_\${id}\`
    );`;

const newDeleteOpChat = `    // Clean up associated chat messages for this operation from cloud and local cache
    const opMsgIds = chatMessages.filter((m) => m.operationId === id).map((m) => m.id);
    if (opMsgIds.length > 0) {
      deleteChatMessagesFromCloud(opMsgIds);
    }
    setChatMessages((prev) => {
      const remaining = prev.filter((m) => m.operationId !== id);
      try {
        localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(remaining));
      } catch {}
      return remaining;
    });

    // Delete from Firestore Cloud Database
    safeFirestoreWrite(
      () => deleteDoc(doc(db, 'operations', id)),
      \`delete_operation_\${id}\`
    );`;

if (normalize(content).includes(normalize(oldDeleteOpChat))) {
  content = normalize(content).replace(normalize(oldDeleteOpChat), normalize(newDeleteOpChat));
  console.log('Successfully patched deleteOperation in RescueContext.tsx');
} else {
  console.error('Could not find oldDeleteOpChat in RescueContext.tsx');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Finished updating RescueContext.tsx');
