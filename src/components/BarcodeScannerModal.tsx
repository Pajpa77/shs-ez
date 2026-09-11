import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { X, Camera, RefreshCw, CheckCircle2, AlertCircle, Scan, Volume2, Sparkles, UserCheck } from 'lucide-react';

interface BarcodeScannerModalProps {
  allUsers: User[];
  onConfirmReady: (userId: string) => void;
  onClose: () => void;
}

/** Synthesizes a pleasant double-beep audio tone using Web Audio API */
function playSuccessBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.setValueAtTime(1760, ctx.currentTime + 0.08); // A6

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    // ignore audio failures
  }
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  allUsers,
  onConfirmReady,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [manualCode, setManualCode] = useState<string>('');
  const [lastScannedUser, setLastScannedUser] = useState<{ user: User; timestamp: string } | null>(null);
  const [notLoggedInUser, setNotLoggedInUser] = useState<{ user: User; timestamp: string } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const isScanningRef = useRef<boolean>(true);
  const lastScannedTimeRef = useRef<number>(0);

  // Initialize Camera Stream
  useEffect(() => {
    let stream: MediaStream | null = null;
    isScanningRef.current = true;

    async function startCamera() {
      try {
        setCameraError(null);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError('Kamera-Zugriff wird von diesem Browser nicht unterstützt.');
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: cameraFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraActive(true);
        }
      } catch (err: any) {
        console.warn('Camera access warning:', err);
        setCameraError('Kamera konnte nicht geöffnet werden (Rechte prüfen oder manuelle Eingabe nutzen).');
        setCameraActive(false);
      }
    }

    startCamera();

    return () => {
      isScanningRef.current = false;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraFacing]);

  // Barcode Detection Loop (Native BarcodeDetector API)
  useEffect(() => {
    let animId: number;

    const hasBarcodeDetector = 'BarcodeDetector' in window;
    let detector: any = null;

    if (hasBarcodeDetector) {
      try {
        detector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'ean_8'],
        });
      } catch {
        detector = null;
      }
    }

    async function scanLoop() {
      if (!isScanningRef.current) return;

      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        if (detector) {
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const rawValue = barcodes[0].rawValue;
              handleCodeScanned(rawValue);
            }
          } catch (e) {
            // detector fallback error
          }
        }
      }

      animId = requestAnimationFrame(scanLoop);
    }

    animId = requestAnimationFrame(scanLoop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [allUsers]);

  // Process Scanned Code Value
  const handleCodeScanned = (codeValue: string) => {
    if (!codeValue) return;
    const cleanCode = codeValue.trim();

    // Prevent double-scan within 3 seconds for same code
    const now = Date.now();
    if (now - lastScannedTimeRef.current < 2500) return;

    // Search user matching memberId, id, or username
    const matchedUser = allUsers.find(
      (u) =>
        (u.memberId && u.memberId.toLowerCase() === cleanCode.toLowerCase()) ||
        u.id.toLowerCase() === cleanCode.toLowerCase() ||
        u.username.toLowerCase() === cleanCode.toLowerCase()
    );

    if (matchedUser) {
      lastScannedTimeRef.current = now;

      // Wahrheitsgemäße Prüfung: Ist die Einsatzkraft im System eingeloggt?
      if (!matchedUser.isActive) {
        setNotLoggedInUser({
          user: matchedUser,
          timestamp: new Date().toLocaleTimeString('de-DE'),
        });
        setLastScannedUser(null);
        setScanError(null);
        return;
      }

      playSuccessBeep();
      onConfirmReady(matchedUser.id);

      setLastScannedUser({
        user: matchedUser,
        timestamp: new Date().toLocaleTimeString('de-DE'),
      });
      setNotLoggedInUser(null);
      setScanError(null);
    } else {
      lastScannedTimeRef.current = now;
      setScanError(`Kein User zu Ausweiscode „${cleanCode}“ gefunden.`);
      setTimeout(() => setScanError(null), 3500);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleCodeScanned(manualCode);
    setManualCode('');
  };

  const toggleCameraFacing = () => {
    setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#1E293B] border border-slate-700 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col text-slate-100 font-sans">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-700 flex items-center justify-between bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Scan className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider">Vereinsausweis Scannen</h2>
              <p className="text-xs text-slate-400 font-mono">
                Ausweis-Strichcode oder QR-Code scannen zum Eintreff-Bestätigen
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Camera Area */}
        <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-700">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${cameraFacing === 'user' ? 'scale-x-[-1]' : ''}`}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Target Scanner Reticle */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
            <div className="w-64 h-36 border-2 border-dashed border-emerald-400 rounded-2xl relative shadow-[0_0_30px_rgba(52,211,153,0.3)] flex items-center justify-center">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl"></div>
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr"></div>
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl"></div>
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br"></div>
              <div className="w-full h-0.5 bg-emerald-500/80 shadow-[0_0_8px_#10b981] animate-pulse"></div>
            </div>
          </div>

          {/* Camera Switcher Floating Button */}
          <button
            onClick={toggleCameraFacing}
            className="absolute bottom-3 right-3 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-white rounded-xl text-xs font-bold font-mono transition flex items-center gap-1.5 border border-slate-700 shadow-lg cursor-pointer backdrop-blur"
            title="Kamera wechseln (Vorder-/Rückseite)"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Kamera Wechseln</span>
          </button>

          {/* Camera Error overlay */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-2">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <p className="text-xs text-amber-200 font-mono max-w-xs">{cameraError}</p>
              <p className="text-[11px] text-slate-400">Nutze stattdessen das manuelle Eingabefeld unten.</p>
            </div>
          )}
        </div>

        {/* Scan Results & Notification Banner */}
        <div className="p-4 space-y-3 bg-slate-900/40 flex-1">
          {lastScannedUser && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 shadow-lg flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/40">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-mono text-emerald-400 uppercase font-bold flex items-center gap-1">
                    <span>✅ Status auf BEREIT gesetzt ({lastScannedUser.timestamp})</span>
                  </div>
                  <div className="text-sm font-bold text-white leading-tight">
                    {lastScannedUser.user.name} ({lastScannedUser.user.callSign})
                  </div>
                  {lastScannedUser.user.memberId && (
                    <div className="text-[10px] text-slate-400 font-mono">
                      Ausweis-ID: {lastScannedUser.user.memberId}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {notLoggedInUser && (
            <div className="p-3.5 rounded-2xl bg-amber-950/90 border-2 border-amber-500/80 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-mono text-amber-300 uppercase font-bold flex items-center gap-1">
                    <span>⚠️ USER AKTUELL NICHT EINGELOGGT ({notLoggedInUser.timestamp})</span>
                  </div>
                  <div className="text-sm font-bold text-white leading-tight">
                    {notLoggedInUser.user.name} ({notLoggedInUser.user.callSign})
                  </div>
                  <div className="text-[10px] text-amber-200/90 font-mono mt-0.5">
                    Ausweis-ID: {notLoggedInUser.user.memberId || notLoggedInUser.user.id} • Bitte zuerst am Smartphone in der App einloggen!
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onConfirmReady(notLoggedInUser.user.id);
                  setLastScannedUser(notLoggedInUser);
                  setNotLoggedInUser(null);
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs font-mono rounded-xl transition cursor-pointer shrink-0 shadow border border-amber-400"
                title="Manuell im Einsatz anmelden und auf Bereitschaft setzen"
              >
                ⚡ Dennoch anmelden
              </button>
            </div>
          )}

          {scanError && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/60 text-red-200 text-xs font-mono flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{scanError}</span>
            </div>
          )}

          {/* Manual Input Fallback Form */}
          <form onSubmit={handleManualSubmit} className="flex gap-2 pt-1">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Ausweisnummer manuell eintippen (z.B. RT-2026-001)..."
              className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer font-mono shadow shrink-0"
            >
              Bestätigen
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Audio-Signal (Beep) bei Scan aktiv</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition cursor-pointer"
          >
            Fertig / Schließen
          </button>
        </div>

      </div>
    </div>
  );
};
