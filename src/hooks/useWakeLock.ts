import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to manage the Screen Wake Lock API and Background Audio Keep-Alive.
 * Prevents device screen from dimming/locking while visible AND keeps GPS active
 * in background when screen is turned off or smartphone is placed in searcher's pocket.
 */
export function useWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

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

  // Continuous silent audio keep-alive to prevent OS power management (iOS & Android)
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

      if (!audioSourceRef.current && audioCtxRef.current) {
        // Create a continuous silent buffer loop
        const buffer = audioCtxRef.current.createBuffer(1, audioCtxRef.current.sampleRate * 2, audioCtxRef.current.sampleRate);
        // buffer is inherently silent (filled with zeros)
        const source = audioCtxRef.current.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(audioCtxRef.current.destination);
        source.start();
        audioSourceRef.current = source;
      }
    } catch (err) {
        console.warn('Audio heartbeat start error:', err);
    }
  }, []);

  const stopSilentHeartbeat = useCallback(() => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
      } catch {}
      audioSourceRef.current = null;
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
        if (!audioSourceRef.current) {
          startSilentHeartbeat();
        }
      };
      
      // Standard events to catch interaction
      window.addEventListener('touchstart', resumeOnInteraction, { passive: true });
      window.addEventListener('click', resumeOnInteraction, { passive: true });
      window.addEventListener('scroll', resumeOnInteraction, { passive: true });

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
        window.removeEventListener('scroll', resumeOnInteraction);
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
