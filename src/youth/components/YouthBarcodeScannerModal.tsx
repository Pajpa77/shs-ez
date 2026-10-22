import React, { useState, useEffect, useRef } from 'react';
import { useYouth } from '../YouthContext';
import { YouthUser } from '../types';
import {
  X,
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Scan,
  Sparkles,
  UserCheck,
  RotateCcw,
} from 'lucide-react';

interface YouthBarcodeScannerModalProps {
  onClose: () => void;
}

/** Synthesizes a pleasant double-beep tone with Web Audio API */
function playBeep(success = true) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (success) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.setValueAtTime(1760, ctx.currentTime + 0.08); // A6
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.setValueAtTime(200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // Ignore audio failures
  }
}

export const YouthBarcodeScannerModal: React.FC<YouthBarcodeScannerModalProps> = ({ onClose }) => {
  const { allYouthUsers, scanBarcodeReady, setUserReady, isExerciseActive } = useYouth();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [manualCode, setManualCode] = useState<string>('');
  const [lastScannedUser, setLastScannedUser] = useState<{ user: YouthUser; timestamp: string } | null>(null);
  const [scanNotice, setScanNotice] = useState<{ isSuccess: boolean; text: string } | null>(null);

  const isScanningRef = useRef<boolean>(true);
  const lastScannedTimeRef = useRef<number>(0);

  // Initialize Camera Stream with graceful fallback constraints
  useEffect(() => {
    let isMounted = true;
    isScanningRef.current = true;

    async function startCamera() {
      try {
        setCameraError(null);
        setCameraActive(false);

        // Stop any old tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError('Kamerazugriff wird in diesem Browser / Modus nicht unterstützt. Bitte Code manuell eingeben.');
          return;
        }

        // Try preferred constraint first (back camera)
        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: cameraFacing },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch (firstErr) {
          console.warn('Initial camera constraint failed, retrying simple video constraint:', firstErr);
          // Fallback without strict facing mode
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('autoplay', 'true');
          videoRef.current.setAttribute('muted', 'true');
          await videoRef.current.play();
          setCameraActive(true);
        }
      } catch (err: any) {
        console.warn('Camera stream error:', err);
        setCameraActive(false);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraError('Kamerazugriff wurde abgelehnt. Bitte in den Android-/Browser-Einstellungen der SHS-EZ App Zugriff auf die Kamera erlauben.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraError('Keine Kamera auf dem Gerät gefunden. Bitte Code manuell eintippen.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setCameraError('Kamera wird bereits von einer anderen App verwendet. Bitte Kamera freigeben.');
        } else {
          setCameraError('Kamera konnte nicht gestartet werden. Bitte Barcode-Nummer manuell eingeben.');
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      isScanningRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [cameraFacing]);

  // Handle scanned raw text
  const handleDetectCode = (rawCode: string) => {
    const now = Date.now();
    if (now - lastScannedTimeRef.current < 2000) return; // Debounce 2s
    lastScannedTimeRef.current = now;

    const trimmed = rawCode.trim();
    if (!trimmed) return;

    const result = scanBarcodeReady(trimmed);
    if (result.success && result.user) {
      playBeep(true);
      setLastScannedUser({
        user: result.user,
        timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
      setScanNotice({ isSuccess: true, text: result.message });
    } else {
      playBeep(false);
      setScanNotice({ isSuccess: false, text: result.message });
    }
  };

  // Continuous Barcode Scanning Loop via BarcodeDetector API
  useEffect(() => {
    let animFrameId: number;
    let detector: any = null;

    if ('BarcodeDetector' in window) {
      try {
        const supported = ['code_128', 'code_39', 'qr_code', 'ean_13', 'ean_8'];
        detector = new (window as any).BarcodeDetector({ formats: supported });
      } catch (e) {
        console.warn('BarcodeDetector initialization fallback:', e);
      }
    }

    const checkFrame = async () => {
      if (
        isScanningRef.current &&
        videoRef.current &&
        videoRef.current.readyState >= 2 &&
        detector
      ) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (code) {
              handleDetectCode(code);
            }
          }
        } catch {
          // ignore detection frame drops
        }
      }

      if (isScanningRef.current) {
        animFrameId = requestAnimationFrame(checkFrame);
      }
    };

    if (cameraActive) {
      animFrameId = requestAnimationFrame(checkFrame);
    }

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [cameraActive]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDetectCode(manualCode);
    setManualCode('');
  };

  const handleToggleReady = (userId: string, currentStatus?: string) => {
    const nextStatus = currentStatus === 'ready' ? 'in_transit' : 'ready';
    setUserReady(userId, nextStatus);
    playBeep(nextStatus === 'ready');
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#000E66] border border-cyan-400/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-blue-900 bg-[#00083D]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base leading-tight">
                Bereitstellen per Barcode / Ausweis
              </h3>
              <p className="text-[10px] text-cyan-300 font-mono">
                Kamera auf Dienstausweis der Jugend richten
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto">
          {/* Status warning if exercise not active */}
          {!isExerciseActive && (
            <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/60 text-amber-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-[11px] leading-tight">
                Übung noch nicht gestartet. Bereitstellen ist möglich, GPS-Suchspur zeichnet erst ab Übungsstart auf.
              </span>
            </div>
          )}

          {/* Camera Viewport */}
          <div className="relative aspect-video w-full bg-slate-950 rounded-2xl overflow-hidden border border-blue-900 shadow-inner flex items-center justify-center">
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Tactical Reticle Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-56 h-32 border-2 border-dashed border-cyan-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-300 -mt-0.5 -ml-0.5" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-300 -mt-0.5 -mr-0.5" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-300 -mb-0.5 -ml-0.5" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-300 -mb-0.5 -mr-0.5" />
                    <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500/80 animate-pulse shadow-[0_0_8px_#f43f5e]" />
                  </div>
                </div>

                {/* Flip camera button */}
                <button
                  type="button"
                  onClick={() =>
                    setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'))
                  }
                  className="absolute bottom-2.5 right-2.5 p-1.5 bg-slate-900/80 hover:bg-slate-800 text-cyan-300 rounded-xl border border-blue-800 text-xs flex items-center gap-1.5 transition backdrop-blur-sm cursor-pointer"
                  title="Kamera wechseln"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Kamera wechseln</span>
                </button>
              </>
            ) : (
              <div className="p-4 text-center space-y-2">
                <Camera className="w-8 h-8 text-blue-400/50 mx-auto animate-pulse" />
                <p className="text-xs text-amber-300 font-mono max-w-xs mx-auto leading-relaxed">
                  {cameraError || 'Kamera wird gestartet...'}
                </p>
                <button
                  type="button"
                  onClick={() => setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                  className="px-3 py-1 rounded-lg bg-blue-900 hover:bg-blue-800 text-cyan-300 text-xs font-mono border border-blue-700 mt-1 cursor-pointer"
                >
                  Erneut versuchen
                </button>
              </div>
            )}
          </div>

          {/* Scanned Result Banner */}
          {scanNotice && (
            <div
              className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 transition animate-fadeIn ${
                scanNotice.isSuccess
                  ? 'bg-emerald-950/80 border-emerald-500/70 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-500/70 text-rose-200'
              }`}
            >
              {scanNotice.isSuccess ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 font-mono text-[11px] leading-snug">{scanNotice.text}</div>
            </div>
          )}

          {/* Last scanned member card preview */}
          {lastScannedUser && (
            <div className="p-3 rounded-2xl bg-[#00083D] border border-cyan-400/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm shadow"
                  style={{ backgroundColor: lastScannedUser.user.trackColor || '#38bdf8' }}
                >
                  {lastScannedUser.user.name.charAt(0)}
                </div>
                <div>
                  <span className="font-bold text-xs sm:text-sm text-white block">
                    {lastScannedUser.user.name}
                  </span>
                  <span className="text-[10px] text-cyan-300 font-mono">
                    {lastScannedUser.user.callSign} • {lastScannedUser.timestamp}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold font-mono px-2 py-1 rounded-lg bg-emerald-600 text-white shadow">
                  ✓ Bereit
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleReady(lastScannedUser.user.id, 'ready')}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition cursor-pointer"
                  title="Zurücknehmen"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Manual Input Fallback */}
          <form onSubmit={handleManualSubmit} className="space-y-1.5 pt-2 border-t border-blue-900">
            <label className="block text-[10px] font-bold font-mono uppercase text-slate-300">
              Oder Barcode-Nummer / Name manuell eingeben:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="z.B. SHS-Y-101 oder felix"
                className="flex-1 px-3 py-2 rounded-xl bg-[#00083D] border border-blue-800 text-white text-xs font-mono placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs uppercase transition cursor-pointer"
              >
                Prüfen
              </button>
            </div>
          </form>

          {/* Quick Member List for fast 1-click Toggle */}
          <div className="space-y-2 pt-2 border-t border-blue-900">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Mitglieder per Klick bereitstellen / umschalten:</span>
              <span>{allYouthUsers.filter((u) => u.arrivalStatus === 'ready').length} / {allYouthUsers.length} bereit</span>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {allYouthUsers.map((u) => {
                const isReady = u.arrivalStatus === 'ready';
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-[#00083D] border border-blue-950 hover:border-blue-900 transition text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: u.trackColor || '#38bdf8' }}
                      />
                      <span className="font-bold text-white text-xs">{u.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({u.memberCardCode || u.username})</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleReady(u.id, u.arrivalStatus)}
                      className={`px-2 py-1 rounded-lg font-bold font-mono text-[10px] uppercase transition cursor-pointer flex items-center gap-1 ${
                        isReady
                          ? 'bg-emerald-600 hover:bg-rose-700 text-white'
                          : 'bg-blue-950 hover:bg-emerald-600 text-cyan-300 hover:text-white border border-blue-800'
                      }`}
                      title={isReady ? 'Klicken zum Zurücknehmen' : 'Klicken zum Bereitstellen'}
                    >
                      {isReady ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>✓ Bereit (Umschalten)</span>
                        </>
                      ) : (
                        <span>🟢 Bereit</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-blue-900 bg-[#00083D] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs uppercase transition cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
