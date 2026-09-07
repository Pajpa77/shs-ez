import React, { useState } from 'react';
import { useRescue } from '../context/RescueContext';
import { FIREBASE_CONSOLE_QUOTA_URL, resetQuotaExhaustedState } from '../lib/firebase';
import { AlertTriangle, ExternalLink, X, Database, ShieldAlert, RotateCw } from 'lucide-react';

export const QuotaNotificationBanner: React.FC = () => {
  const { isQuotaExceeded, cloudSyncStatus } = useRescue();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  if ((!isQuotaExceeded && cloudSyncStatus !== 'quota_exceeded') || isDismissed) {
    return null;
  }

  const handleRetry = () => {
    resetQuotaExhaustedState();
    setShowDetailModal(false);
  };

  return (
    <>
      {/* Top Banner Alert */}
      <div className="bg-slate-50 dark:bg-[#0F172A]mber-950/80 border-b border-amber-600/40 text-amber-200 px-3 py-1.5 sm:px-4 sm:py-2 text-xs flex items-center justify-between gap-2 shadow-md relative z-[999] backdrop-blur-sm">
        <div className="flex items-center gap-2 truncate">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          <div className="truncate">
            <span className="font-bold text-amber-300">Firestore Kontingent-Hinweis:</span>{' '}
            <span className="text-amber-200/90 hidden sm:inline">
              Das tägliche Firestore-Schreiblimit (Spark Free Tier) wurde erreicht.
            </span>{' '}
            <span className="text-emerald-400 font-medium">
              Lokale Speicherung & Multi-Tab-Funk aktiv.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowDetailModal(true)}
            className="px-2 py-0.5 rounded bg-slate-50 dark:bg-[#0F172A]mber-800/60 hover:bg-slate-50 dark:bg-[#0F172A]mber-700/80 text-amber-100 font-bold text-[11px] transition cursor-pointer border border-amber-600/50"
          >
            Details & Konsole
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 text-amber-400 hover:text-amber-100 transition rounded hover:bg-slate-50 dark:bg-[#0F172A]mber-900/40 cursor-pointer"
            title="Banner ausblenden"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Detailed Quota Explanation Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-[#1E293B] border border-amber-500/50 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-50 dark:bg-[#0F172A]mber-950/50 border-b border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Firestore Kontingent-Status</h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-slate-500 dark:text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-50 dark:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700 dark:text-slate-300">
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 space-y-2">
                <div className="font-semibold text-amber-300 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  Free Daily Write Units erreicht
                </div>
                <p className="leading-relaxed text-slate-700 dark:text-slate-300 text-[11px]">
                  Die Firebase-Datenbank nutzt den kostenfreien <strong>Spark-Tarif</strong> mit einem Kontingent von 20.000 Schreibvorgängen pro Tag. Dieses Limit wurde für den heutigen Abrechnungszyklus erreicht.
                </p>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider text-[10px]">
                  Was bedeutet das für Ihren Einsatz?
                </div>
                <ul className="space-y-1.5 list-disc pl-4 text-slate-700 dark:text-slate-300 text-[11px]">
                  <li>
                    <strong className="text-emerald-400">Kein Datenverlust:</strong> Alle Einsätze, Sektoren, Chat-Nachrichten und Funde werden weiterhin im lokalen Speicher des Browsers (LocalStorage) gesichert.
                  </li>
                  <li>
                    <strong className="text-emerald-400">Multi-Tab-Funk aktiv:</strong> Mehrere geöffnete Fenster oder Tabs auf demselben Rechner synchronisieren sich in Echtzeit über den browserinternen Funkkanal.
                  </li>
                  <li>
                    <strong className="text-blue-400">Automatischer Reset:</strong> Das Firestore-Schreibkontingent wird täglich um Mitternacht (PST) automatisch zurückgesetzt.
                  </li>
                </ul>
              </div>

              <div className="pt-2 border-t border-slate-300 dark:border-slate-700 flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={handleRetry}
                  className="py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-200 font-bold text-center flex items-center justify-center gap-1.5 transition text-xs border border-slate-400 dark:border-slate-600 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-blue-400" />
                  <span>Verbindung erneut prüfen</span>
                </button>
                <a
                  href={FIREBASE_CONSOLE_QUOTA_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-50 dark:bg-[#0F172A]mber-600 hover:bg-slate-50 dark:bg-[#0F172A]mber-500 text-white font-bold text-center flex items-center justify-center gap-1.5 transition text-xs shadow cursor-pointer"
                >
                  <span>Firebase Konsole & Kontingente</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
