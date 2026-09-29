import React, { useState, useEffect } from 'react';
import { Lock, Unlock } from 'lucide-react';

interface PocketModeOverlayProps {
  onUnlock: () => void;
}

export const PocketModeOverlay: React.FC<PocketModeOverlayProps> = ({ onUnlock }) => {
  const [unlockProgress, setUnlockProgress] = useState(0);

  useEffect(() => {
    // Attempt to request WakeLock when pocket mode activates
    let wakeLock: WakeLockSentinel | null = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        console.warn('Wake Lock request failed in pocket mode:', err);
      }
    };
    requestWakeLock();

    return () => {
      if (wakeLock) {
        wakeLock.release().catch(console.warn);
      }
    };
  }, []);

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    // Simple slider logic to unlock
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const height = window.innerHeight;
    // Calculate how far down they dragged
    const progress = Math.min(100, Math.max(0, (clientY / height) * 100));
    setUnlockProgress(progress);
    
    if (progress > 85) {
      onUnlock();
    }
  };

  const handleTouchEnd = () => {
    if (unlockProgress <= 85) {
      setUnlockProgress(0);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-between py-12 select-none touch-none"
      onMouseMove={handleTouchMove}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="text-slate-700 font-mono text-center space-y-2 mt-8 animate-pulse">
        <Lock className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-xl font-bold opacity-60">HOSENTASCHEN-MODUS</p>
        <p className="text-xs opacity-40 px-8">
          Bildschirm ist abgedunkelt, um Strom zu sparen und versehentliche Eingaben zu verhindern.<br/>
          Das GPS-Tracking läuft im Hintergrund weiter!
        </p>
      </div>

      <div className="w-full px-8 pb-12">
        <div className="text-slate-600 text-[10px] text-center mb-4 uppercase font-bold tracking-widest opacity-50">
          Zum Entsperren nach unten wischen
        </div>
        <div className="relative w-16 h-48 mx-auto bg-slate-900 rounded-full border border-slate-800 overflow-hidden">
          <div 
            className="absolute top-2 left-2 right-2 h-12 bg-slate-800 rounded-full flex items-center justify-center transition-transform duration-75"
            style={{ transform: `translateY(${unlockProgress * 1.5}px)` }}
          >
            <Unlock className="w-5 h-5 text-slate-500" />
          </div>
        </div>
      </div>
    </div>
  );
};
