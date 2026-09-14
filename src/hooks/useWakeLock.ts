import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to manage the Screen Wake Lock API and Background Audio Keep-Alive.
 * Prevents device screen from dimming/locking while visible AND keeps GPS active
 * in background when screen is turned off or smartphone is placed in searcher's pocket.
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

  // Silent audio keep-alive to prevent OS power management (iOS & Android)
  // from suspending background GPS threads on dark/locked screens
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
        // High-frequency 4-second pulse keeps media execution context hot
        intervalRef.current = setInterval(() => {
          if (audioCtxRef.current) {
            if (audioCtxRef.current.state === 'suspended') {
              audioCtxRef.current.resume().catch(() => {});
            }
            if (audioCtxRef.current.state === 'running') {
              try {
                const osc = audioCtxRef.current.createOscillator();
                const gain = audioCtxRef.current.createGain();
                // 20Hz infrasound wave at micro-gain (completely inaudible, zero battery impact)
                osc.type = 'sine';
                osc.frequency.setValueAtTime(20, audioCtxRef.current.currentTime);
                gain.gain.setValueAtTime(0.00001, audioCtxRef.current.currentTime);
                osc.connect(gain);
                gain.connect(audioCtxRef.current.destination);
                osc.start();
                osc.stop(audioCtxRef.current.currentTime + 0.1);
              } catch {}
            }
          }
        }, 4000);
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

      // Ensure AudioContext is actively resumed on any user interaction
      const resumeOnInteraction = () => {
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
      };
      window.addEventListener('touchstart', resumeOnInteraction, { passive: true });
      window.addEventListener('click', resumeOnInteraction, { passive: true });

      const handleVisibilityChange = async () => {
        if (document.visibilityState === 'visible') {
          if (wakeLockRef.current === null) {
            await requestWakeLock();
          }
        }
        startSilentHeartbeat();
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        window.removeEventListener('touchstart', resumeOnInteraction);
        window.removeEventListener('click', resumeOnInteraction);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        releaseWakeLock();
        stopSilentHeartbeat();
      };
    } else {
      releaseWakeLock();
      stopSilentHeartbeat();
    }
  }, [enabled, requestWakeLock, releaseWakeLock, startSilentHeartbeat, stopSilentHeartbeat]);
}
