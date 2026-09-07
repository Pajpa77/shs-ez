import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to manage the Screen Wake Lock API.
 * Prevents the device screen from dimming or locking when enabled.
 */
export function useWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<any>(null);

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      console.warn('Wake Lock API not supported in this browser.');
      return;
    }

    try {
      if (wakeLockRef.current) return;
      
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      console.log('Screen Wake Lock acquired.');

      wakeLockRef.current.addEventListener('release', () => {
        console.log('Screen Wake Lock was released.');
        wakeLockRef.current = null;
      });
    } catch (err: any) {
      console.error(`${err.name}, ${err.message}`);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    // Handle visibility change (re-request if app becomes visible again)
    const handleVisibilityChange = async () => {
      if (enabled && wakeLockRef.current === null && document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [enabled, requestWakeLock, releaseWakeLock]);
}
