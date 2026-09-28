import React, { useState, useMemo } from 'react';
import { useRescue } from '../context/RescueContext';
import { captureTacticalMapScreenshot } from '../lib/mapSnapshotHelper';
import {
  Pause,
  AlertTriangle,
  X,
  Camera,
  Layers,
  MapPin,
  Clock,
  CheckCircle2,
  Shield,
  Loader2,
} from 'lucide-react';

interface OperationPauseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessNavigateToMap?: () => void;
}

const QUICK_REASONS = [
  'Wetterverschlechterung / Unwetter',
  'Nachtpause / Sichtpause',
  'Ablösung Hundeteams / Kräftepause',
  'Taktische Lagebesprechung',
  'Warten auf Folgebefehl / Ermittlungsergebnisse',
];

export const OperationPauseModal: React.FC<OperationPauseModalProps> = ({
  isOpen,
  onClose,
  onSuccessNavigateToMap,
}) => {
  const { currentOperation, pauseOperation, currentUser, userLocations, allUsers, setUserArrivalStatus } = useRescue();

  const [reason, setReason] = useState('');
  const [includeSnapshot, setIncludeSnapshot] = useState(true);
  const [forceDisposition, setForceDisposition] = useState<'standby' | 'dismissed'>('standby');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !currentOperation) return null;

  // Admin and Einsatzleitung guard
  const canControl = Boolean(
    currentUser && (
      currentUser.role === 'admin' ||
      currentUser.isAdmin ||
      currentUser.role === 'einsatzleitung' ||
      currentUser.canLeadOperations
    )
  );
  if (!canControl) {
    return (
      <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-950/80 backdrop-blur-md font-sans">
        <div className="bg-[#1E293B] border border-red-500/50 rounded-2xl p-6 max-w-md text-center space-y-4 shadow-2xl text-black dark:text-slate-100">
          <div className="w-12 h-12 rounded-full bg-red-600/20 text-red-400 mx-auto flex items-center justify-center border border-red-500/40">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white uppercase tracking-wide">Zugriff verweigert</h3>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            Nur Einsatzleiter und Administratoren sind autorisiert, den Einsatz zu pausieren.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-xl font-bold text-xs font-mono transition cursor-pointer border border-slate-300 dark:border-slate-700"
          >
            Schließen
          </button>
        </div>
      </div>
    );
  }

  const handlePause = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      let snapshotUrl: string | undefined = undefined;
      if (includeSnapshot) {
        const captured = await captureTacticalMapScreenshot(currentOperation, userLocations, allUsers);
        if (captured) {
          snapshotUrl = captured;
        }
      }

      if (forceDisposition === 'dismissed' && currentOperation.participantIds) {
        currentOperation.participantIds.forEach((pid) => {
          setUserArrivalStatus(pid, 'in_transit');
        });
      }

      const finalReason = reason.trim()
        ? `${reason.trim()}${forceDisposition === 'dismissed' ? ' (Kräfte nach Hause entlassen / abgerückt)' : ''}`
        : forceDisposition === 'dismissed'
        ? 'Einsatz pausiert — Kräfte nach Hause entlassen / abgerückt'
        : 'Einsatz pausiert';

      await pauseOperation(currentOperation.id, finalReason, snapshotUrl);
      setIsProcessing(false);
      onClose();
      if (onSuccessNavigateToMap) {
        onSuccessNavigateToMap();
      }
    } catch (err) {
      console.error('Fehler beim Pausieren des Einsatzes:', err);
      setIsProcessing(false);
      onClose();
    }
  };

  // 1 User = 1 Spur (Bewegungsprofil)
  const distinctTrackUserIds = useMemo(() => {
    const ids = new Set<string>();
    currentOperation.archivedTracks?.forEach((t) => {
      if (t.userId && t.points && t.points.length > 1) ids.add(t.userId);
    });
    if (userLocations) {
      Object.entries(userLocations).forEach(([uId, loc]) => {
        const opHistory = (loc.trackHistory || []).filter(
          (p) => !p.operationId || !currentOperation?.id || p.operationId === currentOperation.id
        );
        if (opHistory.length > 1) ids.add(uId);
      });
    }
    return ids;
  }, [currentOperation, userLocations]);
  const tracksCount = distinctTrackUserIds.size;

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-3 sm:p-4 bg-slate-100 dark:bg-slate-950/85 backdrop-blur-sm font-sans animate-in fade-in duration-200">
      <div className="bg-[#1E293B] border border-amber-500/50 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-900 border-b border-amber-500/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-slate-50 dark:bg-amber-600/30 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
              <Pause className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wide">
                Einsatz vorübergehend pausieren
              </h2>
              <p className="text-[11px] text-amber-300/80 font-mono">
                {currentOperation.title} (#{currentOperation.id.slice(-6).toUpperCase()})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-700 flex items-center justify-center transition cursor-pointer text-slate-500 dark:text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handlePause} className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Important Preservation Guarantee Notice */}
          <div className="bg-slate-50 dark:bg-amber-950/30 border border-amber-500/40 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold font-mono">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>BEWEGUNGSPROFILE & LAGE BLEIBEN VOLLSTÄNDIG ERHALTEN</span>
            </div>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
              Alle bisherigen Suchspuren ({tracksCount} Bewegungsprofile als farbige Linien), Sektoren und Funde bleiben
              auf der taktischen Lagekarte sichtbar. Bei Fortsetzung wird das Profil nahtlos mit neuen Aufzeichnungen ergänzt.
            </p>
          </div>

          {/* Screenshot Option */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-purple-950/60 border border-purple-700/60 flex items-center justify-center text-purple-300 shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white font-mono">Lagekarten-Screenshot ins Protokoll</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Speichert aktuellen Kartenausschnitt mit allen Suchspuren & Funden
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              id="includeSnapshot"
              checked={includeSnapshot}
              onChange={(e) => setIncludeSnapshot(e.target.checked)}
              className="h-4 w-4 rounded bg-slate-50 dark:bg-slate-800 border-slate-400 dark:border-slate-600 text-amber-500 focus:ring-amber-500/40 cursor-pointer"
            />
          </div>

          {/* Status of Responders during Pause */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 rounded-xl p-3.5 space-y-2.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
              Verbleib & Status der Einsatzkräfte:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                  forceDisposition === 'standby'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-200'
                    : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="forceDisposition"
                  value="standby"
                  checked={forceDisposition === 'standby'}
                  onChange={() => setForceDisposition('standby')}
                  className="mt-0.5 text-amber-500 focus:ring-amber-500/40"
                />
                <div className="text-xs">
                  <div className="font-bold text-white flex items-center gap-1">
                    <span>🏢</span>
                    <span>In Bereitstellung (vor Ort)</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    Kräfte bleiben an der EZ / am Sammelplatz. Marker auf Lagekarte zeigen den Pause-Standort.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                  forceDisposition === 'dismissed'
                    ? 'bg-blue-500/10 border-blue-500 text-blue-200'
                    : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="forceDisposition"
                  value="dismissed"
                  checked={forceDisposition === 'dismissed'}
                  onChange={() => setForceDisposition('dismissed')}
                  className="mt-0.5 text-blue-500 focus:ring-blue-500/40"
                />
                <div className="text-xs">
                  <div className="font-bold text-white flex items-center gap-1">
                    <span>🏠</span>
                    <span>Kräfte nach Hause entlassen</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    Status wird auf 'Abgerückt' gesetzt. Verhindert Missverständnisse, wenn Kräfte bereits zuhause sind.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
              Grund für Pause (wird im Protokoll & Funk notiert):
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="z.B. Starkregen / Blitzschlag, Pause bis 06:00 Uhr..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-black dark:text-slate-100 text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border font-mono transition cursor-pointer ${
                    reason === r
                      ? 'bg-slate-50 dark:bg-amber-600 text-white border-amber-500'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold font-mono transition cursor-pointer border border-slate-300 dark:border-slate-700"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-5 py-2 bg-slate-50 dark:bg-amber-600 hover:bg-slate-50 dark:bg-amber-500 text-white rounded-xl text-xs font-bold font-mono transition cursor-pointer flex items-center gap-2 shadow-lg disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Wird pausiert...</span>
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" />
                  <span>Einsatz jetzt pausieren</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
