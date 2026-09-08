import React, { useState } from 'react';
import { useRescue } from '../context/RescueContext';
import { Finding } from '../types';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MapPin,
  Clock,
  User,
  Shield,
  Trash2,
  Share2,
  X,
  ExternalLink,
} from 'lucide-react';

interface FindingDetailModalProps {
  finding: Finding | null;
  onClose: () => void;
}

export const FindingDetailModal: React.FC<FindingDetailModalProps> = ({ finding, onClose }) => {
  const { currentUser, verifyFinding, deleteFinding } = useRescue();
  const [adminNotes, setAdminNotes] = useState(finding?.adminNotes || '');
  const [isSaved, setIsSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!finding) return null;

  const isAdmin = currentUser?.role === 'admin';
  const isPerson = finding.category.startsWith('person');

  const handleVerify = (status: boolean) => {
    verifyFinding(finding.id, status, adminNotes);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleDelete = () => {
    if (finding) {
      deleteFinding(finding.id);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-3 sm:p-4 bg-slate-100 dark:bg-slate-950/80 backdrop-blur-md overflow-y-auto font-sans">
      <div className="bg-[#1E293B] border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl text-black dark:text-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900/90 p-4 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center text-xl font-bold border border-slate-300 dark:border-slate-700 ${
                isPerson ? 'bg-red-600/30 text-red-400 border-red-500/40' : 'bg-slate-50 dark:bg-slate-800 text-blue-400'
              }`}
            >
              {isPerson ? '🚨' : finding.category === 'clothing' ? '👕' : finding.category === 'trail_scent' ? '🐾' : '🚩'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 font-bold uppercase">
                  FUND #{finding.id.slice(-4)}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg uppercase ${
                    finding.urgency === 'critical'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : finding.urgency === 'high'
                      ? 'bg-slate-50 dark:bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {finding.urgency.toUpperCase()}
                </span>
              </div>
              <h2 className="text-base font-bold text-white mt-0.5 tracking-wide uppercase">{finding.title}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-700 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          {/* Media preview */}
          {finding.mediaUrl && (
            <div className="rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 max-h-72 flex items-center justify-center">
              {finding.mediaType === 'video' ? (
                <video src={finding.mediaUrl} controls className="max-h-72 w-full object-contain" />
              ) : (
                <img src={finding.mediaUrl} alt={finding.title} className="max-h-72 w-full object-contain" />
              )}
            </div>
          )}

          {/* Description */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 space-y-1">
            <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] block font-mono">FUND-BESCHREIBUNG:</span>
            <p className="text-xs text-slate-900 dark:text-slate-200 leading-relaxed">{finding.description}</p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-white dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-300 dark:border-slate-700">
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block font-bold font-mono uppercase">GEMELDET VON</span>
              <div className="font-bold text-slate-900 dark:text-slate-200 mt-0.5">{finding.userName}</div>
              <div className="text-[10px] text-blue-400 font-mono">{finding.userCallSign}</div>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block font-bold font-mono uppercase">KFZ-KENNZEICHEN</span>
              <div className="font-mono font-bold text-slate-900 dark:text-slate-200 mt-0.5">
                {finding.userLicensePlate || 'k.A.'}
              </div>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block font-bold font-mono uppercase">ZEITPUNKT</span>
              <div className="text-slate-900 dark:text-slate-200 font-mono mt-0.5 text-[11px]">
                {new Date(finding.timestamp).toLocaleString()}
              </div>
            </div>

            <div className="sm:col-span-3 pt-2 border-t border-slate-300 dark:border-slate-700/80 flex items-center justify-between">
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[10px] block font-bold font-mono uppercase">GPS-KOORDINATEN</span>
                <span className="font-mono font-bold text-blue-400">
                  {finding.location.lat.toFixed(6)}, {finding.location.lng.toFixed(6)}
                </span>
              </div>
              <a
                href={`https://www.google.com/maps?q=${finding.location.lat},${finding.location.lng}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-700 text-blue-400 font-semibold text-[11px] transition font-mono"
              >
                <span>Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Verification Status Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              finding.status === 'false_alarm'
                ? 'bg-red-950/50 border-red-800 text-red-300'
                : finding.status === 'verified' || finding.verified
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-50 dark:bg-amber-500/15 border-amber-500/40 text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {finding.status === 'false_alarm' ? (
                <XCircle className="w-5 h-5 text-red-400 shrink-0" />
              ) : finding.status === 'verified' || finding.verified ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <div>
                <div className="font-bold text-xs font-mono tracking-wide uppercase">
                  {finding.status === 'false_alarm'
                    ? '❌ ALS FEHLALARM MARKIERT (AUSGEBLENDET & ARCHIVIERT)'
                    : finding.status === 'verified' || finding.verified
                    ? '✅ VON EINSATZLEITUNG ALS RELEVANT BESTÄTIGT'
                    : '⏳ STATUS: IN PRÜFUNG DURCH EINSATZLEITUNG'}
                </div>
                <div className="text-[10px] opacity-85 font-mono mt-0.5">
                  {finding.status === 'false_alarm'
                    ? 'Wurde als Fehlalarm eingestuft. Auf der aktiven Lagekarte ausgeblendet, bleibt aber im Einsatzprotokoll archiviert.'
                    : finding.status === 'verified' || finding.verified
                    ? 'Wurde verifiziert und als prioritärer Einsatzhinweis auf der Lagekarte markiert.'
                    : 'Prüfung und Bestätigung durch Führungskraft (Maria, Jens, Micha) ausstehend.'}
                </div>
              </div>
            </div>
          </div>

          {/* Admin Evaluation & Notes */}
          {isAdmin && (
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-400 flex items-center gap-1.5 text-xs font-mono uppercase">
                  <Shield className="w-3.5 h-3.5" />
                  Einsatzleitungs-Bewertung & Status festlegen:
                </span>
                {isSaved && <span className="text-[10px] text-emerald-400 font-bold font-mono">✓ Status aktualisiert</span>}
              </div>
              <textarea
                rows={2}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Vermerk der Einsatzleitung, z.B. K9 Fährtenhund angesetzt, Spurensicherung informiert, Spaziergänger-Spur..."
                className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono">
                <button
                  type="button"
                  onClick={() => {
                    verifyFinding(finding.id, 'verified', adminNotes);
                    setIsSaved(true);
                    setTimeout(() => setIsSaved(false), 2000);
                  }}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer uppercase ${
                    finding.status === 'verified' || (finding.verified && finding.status !== 'false_alarm')
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                      : 'bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Relevant (OK)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    verifyFinding(finding.id, 'false_alarm', adminNotes);
                    setIsSaved(true);
                    setTimeout(() => setIsSaved(false), 2000);
                  }}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer uppercase ${
                    finding.status === 'false_alarm'
                      ? 'bg-red-600 text-white ring-2 ring-red-400'
                      : 'bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40'
                  }`}
                  title="Wird auf der Lagekarte ausgeblendet und im Protokoll archiviert"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Fehlalarm
                </button>

                <button
                  type="button"
                  onClick={() => {
                    verifyFinding(finding.id, 'pending', adminNotes);
                    setIsSaved(true);
                    setTimeout(() => setIsSaved(false), 2000);
                  }}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition cursor-pointer border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300`}
                >
                  In Prüfung
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white dark:bg-slate-900/90 p-4 border-t border-slate-300 dark:border-slate-700 flex items-center justify-between">
          {isAdmin ? (
            showDeleteConfirm ? (
              <div className="flex items-center gap-2 bg-red-950/90 border border-red-600/80 p-1.5 rounded-xl text-xs animate-in fade-in duration-150">
                <span className="text-[11px] font-bold text-red-300 font-mono">
                  Fundmeldung löschen?
                </span>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1 font-mono uppercase shadow"
                >
                  <Trash2 className="w-3 h-3" />
                  Ja, löschen
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition cursor-pointer font-mono border border-slate-300 dark:border-slate-700"
                >
                  Nein
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-400 hover:text-red-300 flex items-center gap-1 text-xs font-semibold p-1 transition cursor-pointer font-mono uppercase"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Fund löschen
              </button>
            )
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-white text-xs font-bold transition cursor-pointer border border-slate-300 dark:border-slate-700 uppercase tracking-wider font-mono"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
