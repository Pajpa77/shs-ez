import React, { useState } from 'react';
import { useRescue } from '../context/RescueContext';
import { generateOperationPDF } from '../lib/pdfExport';
import {
  CheckCircle2,
  AlertTriangle,
  X,
  FileCheck,
  Shield,
  Activity,
  Users,
  Layers,
  Sparkles,
  MapPin,
  Clock,
  ArrowRight,
  Camera,
  Loader2,
  Image as ImageIcon,
  Download,
  FileText
} from 'lucide-react';

interface OperationEndModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessNavigateToMap?: () => void;
  onSuccessNavigateToArchive?: () => void;
}

export const OperationEndModal: React.FC<OperationEndModalProps> = ({
  isOpen,
  onClose,
  onSuccessNavigateToMap,
  onSuccessNavigateToArchive,
}) => {
  const { currentOperation, endOperation, currentUser, allUsers } = useRescue();

  const [outcome, setOutcome] = useState<
    'person_alive' | 'person_transferred' | 'aborted' | 'person_deceased' | 'exercise_completed'
  >(currentOperation?.type === 'exercise' ? 'exercise_completed' : 'person_alive');
  const [closingNotes, setClosingNotes] = useState('');
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const [includeMapSnapshot, setIncludeMapSnapshot] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !currentOperation) return null;

  // Explicit admin-only guard clause
  if (currentUser?.role !== 'admin') {
    return (
      <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-950/80 backdrop-blur-md font-sans">
        <div className="bg-[#1E293B] border border-red-500/50 rounded-2xl p-6 max-w-md text-center space-y-4 shadow-2xl text-black dark:text-slate-100">
          <div className="w-12 h-12 rounded-full bg-red-600/20 text-red-400 mx-auto flex items-center justify-center border border-red-500/40">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white uppercase tracking-wide">Zugriff verweigert (Admin-Bereich)</h3>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            Nur Einsatzleiter und Administratoren (Rolle: <span className="font-mono text-red-400 font-bold">admin</span>) sind autorisiert, Einsätze offiziell zu beenden, auszuwerten und zu archivieren.
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

  const isExercise = currentOperation.type === 'exercise';
  const totalSectors = currentOperation.sectors.length;
  const searchedSectors = currentOperation.sectors.filter((s) => s.status === 'searched').length;
  const activeFindings = currentOperation.findings.filter((f) => f.status !== 'false_alarm').length;
  const falseAlarmFindings = currentOperation.findings.filter((f) => f.status === 'false_alarm').length;

  const handleEndOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (currentUser?.role !== 'admin') {
      setErrorMsg('Aktion verweigert: Nur Administratoren dürfen Einsätze beenden.');
      return;
    }
    if (!confirmCheckbox) {
      setErrorMsg('Bitte bestätigen Sie die offizielle Beendigung des Einsatzes per Checkbox.');
      return;
    }

    setIsProcessing(true);
    let snapshotDataUrl: string | undefined = undefined;

    if (includeMapSnapshot) {
      // The actual screenshot generation is now handled cleanly by the
      // captureTacticalMapScreenshot utility inside endOperation to avoid Leaflet DOM issues.
      // We just pass undefined to let the context handle it.
      snapshotDataUrl = undefined;
    }

    endOperation(currentOperation.id, closingNotes.trim() || undefined, outcome, snapshotDataUrl);
    setIsProcessing(false);
    onClose();
    if (onSuccessNavigateToArchive) {
      onSuccessNavigateToArchive();
    } else if (onSuccessNavigateToMap) {
      onSuccessNavigateToMap();
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-3 sm:p-4 bg-slate-100 dark:bg-slate-950/85 backdrop-blur-md font-sans">
      <div className="bg-[#1E293B] border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl text-black dark:text-slate-100 overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900/90 p-4 sm:p-5 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-red-600/20 text-red-400 border border-red-500/40 flex items-center justify-center font-bold text-xl shrink-0">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500 font-bold uppercase">
                  ABSCHLUSS
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  #{currentOperation.id.slice(-6).toUpperCase()}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                {isExercise ? 'Übung abschließen & auswerten' : 'Sucheinsatz offiziell beenden'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-700 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleEndOperation} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs custom-scrollbar">
            {/* Summary Box */}
            <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-xl border border-slate-300 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider font-mono">
                  EINSATZ-BILANZ & DOKUMENTATION
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  Leiter: {currentOperation.commander}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-center">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">SEKTOREN</div>
                  <div className="text-sm font-bold text-emerald-400">
                    {searchedSectors}/{totalSectors} ✅
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">RELEVANTE FUNDE</div>
                  <div className="text-sm font-bold text-blue-400">
                    {activeFindings} 🚩
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">FEHLALARME</div>
                  <div className="text-sm font-bold text-slate-500 dark:text-slate-400">
                    {falseAlarmFindings} ❌
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">KRÄFTE IM EINSATZ</div>
                  <div className="text-sm font-bold text-amber-400">
                    {currentOperation.participantIds?.length || 4} 👥
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-700 dark:text-slate-300 font-mono flex items-center gap-2 pt-1">
                <span className="text-red-400 font-bold">Vermisste Person:</span>
                <span>{currentOperation.missingPerson.name} ({currentOperation.missingPerson.age} Jahre)</span>
              </div>
            </div>

            {/* Outcome Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
                Einsatzergebnis / Abschluss-Status auswählen *:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono">
                <button
                  type="button"
                  onClick={() => setOutcome('person_alive')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                    outcome === 'person_alive'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-100 ring-2 ring-emerald-500/40'
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200'
                  }`}
                >
                  <span className="text-xl">🟢</span>
                  <div>
                    <div className="font-bold text-xs text-emerald-400 uppercase">Person lebend aufgefunden</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">Erfolgreich gerettet & versorgt</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOutcome('person_transferred')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                    outcome === 'person_transferred'
                      ? 'bg-blue-500/20 border-blue-500 text-blue-100 ring-2 ring-blue-500/40'
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200'
                  }`}
                >
                  <span className="text-xl">🔄</span>
                  <div>
                    <div className="font-bold text-xs text-blue-400 uppercase">An Polizei / RD übergeben</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">Einsatzleitung abgegeben</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOutcome('aborted')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                    outcome === 'aborted'
                      ? 'bg-slate-50 dark:bg-[#0F172A]mber-500/20 border-amber-500 text-amber-100 ring-2 ring-amber-500/40'
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200'
                  }`}
                >
                  <span className="text-xl">⏹️</span>
                  <div>
                    <div className="font-bold text-xs text-amber-400 uppercase">Suche eingestellt / abgebrochen</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">Ergebnislos oder wetterbedingt</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOutcome('person_deceased')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                    outcome === 'person_deceased'
                      ? 'bg-red-950 border-red-500 text-red-200 ring-2 ring-red-500/40'
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200'
                  }`}
                >
                  <span className="text-xl">⬛</span>
                  <div>
                    <div className="font-bold text-xs text-red-400 uppercase">Person verstorben aufgefunden</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">Übergabe an Kriminalpolizei</div>
                  </div>
                </button>

                {isExercise && (
                  <button
                    type="button"
                    onClick={() => setOutcome('exercise_completed')}
                    className={`col-span-1 sm:col-span-2 p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                      outcome === 'exercise_completed'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-100 ring-2 ring-purple-500/40'
                        : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200'
                    }`}
                  >
                    <span className="text-xl">🏆</span>
                    <div>
                      <div className="font-bold text-xs text-purple-400 uppercase">Übungsziel erfolgreich erreicht</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">Staffelübung ordnungsgemäß beendet</div>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Closing Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-mono">
                Abschlussbericht / Protokollvermerk der Einsatzleitung:
              </label>
              <textarea
                rows={3}
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="z.B. Vermisste Person durch Flächensuchhund 'Bella' im Sektor B aufgefunden. An Rettungsdienst übergeben, leicht unterkühlt aber ansprechbar. Alle Einheiten abrücken."
                className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-black dark:text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            {/* Snapshot Checkbox */}
            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-xl flex items-start gap-3">
              <input
                type="checkbox"
                id="include-snapshot-cb"
                checked={includeMapSnapshot}
                onChange={(e) => setIncludeMapSnapshot(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded bg-slate-50 dark:bg-slate-800 border-slate-400 dark:border-slate-600 text-amber-500 focus:ring-amber-400 cursor-pointer"
              />
              <label htmlFor="include-snapshot-cb" className="text-xs text-slate-900 dark:text-slate-200 cursor-pointer select-none">
                <strong className="text-amber-400 font-mono flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" />
                  Lagekarten-Snapshot automatisch erzeugen:
                </strong>
                <span>Speichert ein hochauflösendes Lagebild mit allen abgesuchten Sektoren, Spuren und Fundstellen direkt im Einsatzprotokoll.</span>
              </label>
            </div>

            {/* Confirmation Checkbox */}
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl flex items-start gap-3">
              <input
                type="checkbox"
                id="confirm-end-op"
                checked={confirmCheckbox}
                onChange={(e) => setConfirmCheckbox(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <label htmlFor="confirm-end-op" className="text-xs text-slate-900 dark:text-slate-200 cursor-pointer select-none">
                <strong className="text-red-400 font-mono">BESTÄTIGUNG:</strong> Ich bestätige als Einsatzleitung die
                offizielle Beendigung dieses Einsatzes. Der Einsatz wird archiviert und das Protokoll gesichert.
              </label>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/90 border border-red-600 text-red-300 text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 sm:p-6 pt-3 border-t border-slate-300 dark:border-slate-700 flex items-center justify-end gap-2.5 bg-white dark:bg-slate-900/50 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition cursor-pointer border border-slate-300 dark:border-slate-700 uppercase tracking-wider font-mono text-xs disabled:opacity-40"
            >
              Abbrechen
            </button>

            <button
              type="button"
              onClick={() => generateOperationPDF(currentOperation, allUsers)}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition cursor-pointer shadow uppercase tracking-wider font-mono text-xs flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Protokoll PDF (Vorab)
            </button>

            <button
              type="submit"
              disabled={!confirmCheckbox || isProcessing}
              className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold transition cursor-pointer flex items-center gap-2 shadow-lg uppercase tracking-wider font-mono text-xs"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Wird archiviert & Snapshot erstellt...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Einsatz jetzt beenden & archivieren</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
