import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Share2,
  Copy,
  Check,
  Smartphone,
  QrCode,
  X,
  ExternalLink,
  Shield,
  Compass,
  Download,
  Users,
  Info,
} from 'lucide-react';

interface ShareAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareAppModal: React.FC<ShareAppModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  
  // Always construct the public shareable preview URL (ais-pre-...)
  // Dev container origin (ais-dev-...) requires Google Cloud account login, so we automatically convert to public URL
  const getPublicShareUrl = () => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      if (origin.includes('ais-dev-')) {
        return origin.replace('ais-dev-', 'ais-pre-');
      }
      return origin;
    }
    return 'https://ais-pre-u3b6a6j65lw4mptbmvi4mh-627811107808.europe-west1.run.app';
  };

  const appUrl = getPublicShareUrl();

  useEffect(() => {
    if (isOpen && appUrl) {
      QRCode.toDataURL(appUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'M',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR Code generation error:', err));
    }
  }, [isOpen, appUrl]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(appUrl);
      } else {
        const el = document.createElement('textarea');
        el.value = appUrl;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Vermisstensuche & Einsatzleitung',
          text: 'Taktisches Einsatzleitsystem für Spürhunde-Salzlandkreis e.V. Bitte beitreten und GPS aktivieren:',
          url: appUrl,
        });
      } catch {
        // Share cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[5000] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-[#1E293B] border border-blue-500/40 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/40 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                App teilen & Einsatzkräfte einladen
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Ohne Google-Konto nutzbar für alle Helfer & Sucher vor Ort
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-white hover:bg-slate-50 dark:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-slate-900 dark:text-slate-200 text-xs font-sans">
          {/* QR Code Section */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700/80 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-5">
            <div className="bg-white p-3 rounded-xl shadow-lg border border-slate-400 dark:border-slate-600 shrink-0 flex items-center justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code zum Beitreten der App"
                  className="w-40 h-40 sm:w-44 sm:h-44 object-contain rounded-lg"
                />
              ) : (
                <div className="w-40 h-40 flex items-center justify-center text-slate-500">
                  <QrCode className="w-8 h-8 animate-pulse" />
                </div>
              )}
            </div>

            <div className="space-y-3 text-center sm:text-left flex-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-950/80 text-blue-400 border border-blue-700/60 font-mono text-[10px] font-bold uppercase">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Kamera-Scan am EZ</span>
              </div>
              <h3 className="text-sm font-bold text-white">
                Mit dem Smartphone scannen
              </h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-xs">
                Einsatzkräfte und Helfer scannen diesen QR-Code direkt mit ihrer Handy-Kamera (iPhone oder Android). 
                Die App öffnet sich sofort im Browser – ganz <strong>ohne Login-Zwang mit Google</strong> oder Registrierung im Store.
              </p>
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition w-full sm:w-auto"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Per WhatsApp / Messenger teilen</span>
                </button>
              )}
            </div>
          </div>

          {/* Direct Link Copy Box */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
              Einsatz-Web-Adresse (Link zum Verschicken):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={appUrl}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-blue-300 font-mono select-all focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`px-4 py-2.5 rounded-xl font-bold font-mono text-xs flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-md ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Kopiert!' : 'Kopieren'}</span>
              </button>
            </div>
          </div>

          {/* Instructions for Field Users */}
          <div className="bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700/60 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider font-mono flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              <span>Ablauf für neue Suchkräfte vor Ort:</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-slate-700 dark:text-slate-300">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700/60">
                <span className="font-bold text-blue-400 block mb-1">1. Link öffnen</span>
                <span>QR-Code scannen oder Link im mobilen Browser (Safari, Chrome) aufrufen.</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700/60">
                <span className="font-bold text-emerald-400 block mb-1">2. Name wählen</span>
                <span>Eigenes Profil auswählen oder als neue Suchkraft mit 1 Klick eintragen.</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700/60">
                <span className="font-bold text-purple-400 block mb-1">3. GPS aktivieren</span>
                <span>Tippen auf &quot;Live-GPS an&quot;. Der Browser fragt nach Standort: &quot;Erlauben&quot; wählen.</span>
              </div>
            </div>
          </div>

          {/* PWA Home Screen Installation Guide */}
          <div className="bg-blue-950/30 border border-blue-800/50 rounded-xl p-4 space-y-2 text-[11px] text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-2 text-blue-300 font-bold font-mono">
              <Download className="w-4 h-4" />
              <span>Tipp: Als App auf dem Homescreen speichern (Vollbild)</span>
            </div>
            <p className="leading-relaxed">
              • <strong>iPhone / iPad (Safari):</strong> Unten auf das Teilen-Symbol (Viereck mit Pfeil nach oben) tippen und <em>&quot;Zum Home-Bildschirm&quot;</em> wählen.<br />
              • <strong>Android (Chrome):</strong> Oben rechts auf das 3-Punkte-Menü tippen und <em>&quot;App installieren&quot;</em> oder <em>&quot;Zum Startbildschirm hinzufügen&quot;</em> wählen.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-white rounded-xl font-bold text-xs transition cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
