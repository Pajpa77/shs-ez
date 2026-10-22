import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  RefreshCw,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  FileText,
  ExternalLink,
  CheckCircle2,
  Cloud,
} from 'lucide-react';
import {
  CURRENT_APP_VERSION,
  AppReleaseInfo,
  getLatestReleaseInfo,
  triggerInAppUpdate,
  isAndroidApk,
  isNativeApp,
} from '../lib/appUpdateService';

interface AppUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [releaseInfo, setReleaseInfo] = useState<AppReleaseInfo | null>(null);
  const [downloadStarted, setDownloadStarted] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const isNative = isNativeApp();

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setErrorMsg('');
    setDownloadStarted(false);

    getLatestReleaseInfo()
      .then((info) => {
        if (isMounted) {
          setReleaseInfo(info);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('[AppUpdateModal] Failed to get release info:', err);
          setErrorMsg('Versionsinformationen konnten nicht aus der Firebase Cloud geladen werden.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadClick = async () => {
    if (!releaseInfo?.apkUrl) return;
    setDownloadStarted(true);
    setStatusMessage('Download wird gestartet...');
    try {
      const res = await triggerInAppUpdate(releaseInfo.apkUrl);
      if (res.status === 'permission_needed') {
        setStatusMessage(res.message || 'Bitte erlaube das Installieren unbekannter Apps in den Android-Einstellungen und tippe erneut.');
      } else if (res.status === 'download_started') {
        setStatusMessage('Lade Update herunter... Sobald der Download beendet ist, öffnet sich automatisch das Android-Installationsfenster!');
      } else {
        setStatusMessage('Download gestartet. Bitte Android-Benachrichtigung beachten.');
      }
    } catch (err: any) {
      setStatusMessage('Fehler beim Starten des Updates: ' + (err?.message || 'Unbekannter Fehler'));
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div className="relative w-full max-w-lg bg-[#000E66] border-2 border-[#2B42F2] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#2B42F2]/60 flex items-center justify-between bg-[#000840]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight font-mono">
                App-Aktualisierung (Firebase)
              </h3>
              <p className="text-[11px] text-blue-200">
                Android APK Direkt-Update
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-blue-800/50 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 font-mono text-xs">
          {/* Version Comparison Card */}
          <div className="p-3.5 rounded-xl bg-[#000840] border border-[#2B42F2]/60 grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-blue-300 uppercase tracking-wider block font-bold">
                Installierte Version
              </span>
              <span className="text-base font-black text-white">v{CURRENT_APP_VERSION}</span>
            </div>
            <div>
              <span className="text-[10px] text-cyan-300 uppercase tracking-wider block font-bold">
                Firebase Cloud Version
              </span>
              <span className="text-base font-black text-cyan-300">
                {loading ? 'Prüfe...' : releaseInfo?.version ? `v${releaseInfo.version}` : 'v6.4.x'}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-cyan-300">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
              <span>Verbinde mit Firebase Storage...</span>
            </div>
          ) : errorMsg ? (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-700 text-red-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <div>
                <div className="font-bold text-xs">{errorMsg}</div>
                <div className="text-[11px] text-red-300 mt-1">
                  Bitte prüfe deine Internetverbindung oder versuche es in wenigen Minuten erneut.
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Release Notes */}
              {releaseInfo?.releaseNotes && (
                <div className="p-3 rounded-xl bg-[#000529] border border-blue-900/60 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-blue-200 font-bold text-[11px]">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Hinweise zu diesem Update:</span>
                  </div>
                  <p className="text-[11px] text-blue-100 font-sans leading-relaxed whitespace-pre-line pl-5">
                    {releaseInfo.releaseNotes}
                  </p>
                </div>
              )}

              {/* Instructions Box */}
              <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-700/50 space-y-2 text-[11px] font-sans">
                <div className="font-bold text-cyan-300 font-mono uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Automatischer In-App-Installer</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-blue-100">
                  <li>Tippe unten auf <strong>„Update jetzt automatisch installieren“</strong>.</li>
                  <li>Die Datei wird sicher im Hintergrund heruntergeladen.</li>
                  <li>Das Android-Systemfenster öffnet sich automatisch – tippe nur noch auf <strong>„Aktualisieren“</strong>.</li>
                </ol>
                <p className="text-[10px] text-emerald-300 font-mono mt-1">
                  ✓ Alle Einstellungen, Standorte &amp; gemerkten Geräte bleiben erhalten!
                </p>
              </div>

              {downloadStarted && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-200 flex items-center gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-[11px]">
                    {statusMessage || 'Download läuft... Der Installationsdialog öffnet sich automatisch nach Abschluss.'}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              disabled={loading || !releaseInfo?.apkUrl}
              onClick={handleDownloadClick}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Download className="w-4 h-4" />
              <span>🚀 Update jetzt automatisch installieren</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#2B42F2]/60 bg-[#000840] flex items-center justify-between text-[10px] text-blue-300 font-mono">
          <span>Firebase Storage: shs-ea.firebasestorage.app</span>
          <button
            type="button"
            onClick={onClose}
            className="text-blue-300 hover:text-white underline cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
