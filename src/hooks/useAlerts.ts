import { useEffect, useRef, useState } from 'react';
import { SearchOperation, Finding } from '../types';

export function useAlerts(currentOperation: SearchOperation | null) {
  const previousFindingsRef = useRef<Finding[]>([]);
  const previousStatusRef = useRef<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(setPermission);
      }
    }
  }, []);

  const triggerAlert = (title: string, body: string, vibratePattern: number[]) => {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(vibratePattern); } catch (e) {}
    }
    if ('Notification' in window && permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/assets/icon-192.png',
          badge: '/assets/icon-192.png',
        });
      } catch (e) {}
    }
  };

  useEffect(() => {
    if (!currentOperation) {
      previousFindingsRef.current = [];
      previousStatusRef.current = null;
      return;
    }

    const currentFindings = currentOperation.findings || [];
    const prevFindings = previousFindingsRef.current;
    
    if (currentFindings.length > prevFindings.length && prevFindings.length > 0) {
      const newFinding = currentFindings.find(f => !prevFindings.some(pf => pf.id === f.id));
      if (newFinding) {
        const title = newFinding.isCrucial ? '🚨 WICHTIGER FUND!' : '⚠️ Neuer Fund';
        const body = newFinding.description || 'Ohne Beschreibung';
        const pattern = newFinding.isCrucial ? [200, 100, 200, 100, 200, 500, 500, 100, 500, 100, 500] : [300, 150, 300];
        triggerAlert(title, body, pattern);
      }
    }
    previousFindingsRef.current = currentFindings;

    const currentStatus = currentOperation.status;
    const prevStatus = previousStatusRef.current;
    
    if (prevStatus && currentStatus !== prevStatus) {
      if (currentStatus === 'paused') {
        triggerAlert('⏸️ Einsatz pausiert', 'Die Einsatzleitung hat den Einsatz vorübergehend unterbrochen.', [500, 200, 500]);
      } else if (currentStatus === 'completed') {
        triggerAlert('🛑 Einsatz beendet', 'Die Einsatzleitung hat den Einsatz offiziell beendet.', [1000, 500, 1000]);
      }
    }
    previousStatusRef.current = currentStatus;
  }, [currentOperation, permission]);
}
