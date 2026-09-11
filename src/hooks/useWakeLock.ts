import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to manage the Screen Wake Lock API and Background Keep-Alive.
 * Prevents the device screen from dimming or locking and keeps GPS active in background.
 */
export function useWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<any>(null);

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      return;
    }

    try {
      if (wakeLockRef.current) return;
      
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen');

      wakeLockRef.current.addEventListener('release', () => {
        wakeLockRef.current = null;
      });
    } catch (err: any) {
      console.warn('Wake Lock request info:', err?.message || err);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {}
      wakeLockRef.current = null;
    }
  }, []);

  // Silent audio keep-alive to prevent OS power management from suspending background GPS on dark/locked screens
  const startSilentHeartbeat = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtxRef.current = new AudioContextClass();
        }
      }

      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }

      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => {
          if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
            try {
              const osc = audioCtxRef.current.createOscillator();
              const gain = audioCtxRef.current.createGain();
              gain.gain.value = 0.00001; // Essentially silent
              osc.connect(gain);
              gain.connect(audioCtxRef.current.destination);
              osc.start();
              osc.stop(audioCtxRef.current.currentTime + 0.05);
            } catch {}
          }
        }, 12000);
      }
    } catch {}
  }, []);

  const stopSilentHeartbeat = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      requestWakeLock();
      startSilentHeartbeat();
    } else {
      releaseWakeLock();
      stopSilentHeartbeat();
    }

    const handleVisibilityChange = async () => {
      if (enabled) {
        if (document.visibilityState === 'visible') {
          if (wakeLockRef.current === null) {
            await requestWakeLock();
          }
        }
        startSilentHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
      stopSilentHeartbeat();
    };
  }, [enabled, requestWakeLock, releaseWakeLock, startSilentHeartbeat, stopSilentHeartbeat]);
}
