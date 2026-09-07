import React, { useState, useMemo } from 'react';
import { useRescue } from '../context/RescueContext';
import { SearchOperation, OperationLogEntry, User, EquipmentType } from '../types';
import { TacticalMap } from './TacticalMap';
import {
  Archive,
  FileText,
  Calendar,
  Users,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Download,
  Printer,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Shield,
  Eye,
  Trash2,
  X,
  User as UserIcon,
  RotateCcw,
  Play,
  Search,
  Filter,
  Radio,
  Clock,
  CheckCircle2,
  UserCheck,
  Plus,
  Copy,
  Check,
  ArrowRight,
  Camera,
  Wrench,
  Package,
} from 'lucide-react';

const EQUIPMENT_LABELS: Record<EquipmentType, { label: string; icon: string }> = {
  drone: { label: 'Drohne / UAS', icon: '🚁' },
  k9_mantrailer: { label: 'Mantrailer K9', icon: '🐕' },
  k9_area: { label: 'Flächensuchhund', icon: '🐾' },
  k9_cadaver: { label: 'Leichenspürhund', icon: '🐕‍🦺' },
  flir: { label: 'FLIR / Wärmebild', icon: '🌡️' },
  quad: { label: 'Quad / ATV', icon: '🚜' },
  boat: { label: 'Rettungsboot', icon: '🚤' },
  foot_search: { label: 'Fußtrupp', icon: '🚶' },
  first_aid: { label: 'Sanitäter / Notfall', icon: '🩹' },
};

interface OperationsArchiveProps {
  onNavigateToMap?: () => void;
}

export const OperationsArchive: React.FC<OperationsArchiveProps> = ({ onNavigateToMap }) => {
  const {
    allOperations,
    allUsers,
    currentOperation,
    currentUser,
    deleteOperation,
    reactivateOperation,
    updateOperation,
    endOperation,
  } = useRescue();

  const [selectedOpId, setSelectedOpId] = useState<string>(() => {
    // Prefer completed operation if any, or current
    const completed = allOperations.find((op) => op.status === 'completed');
    return completed?.id || allOperations[0]?.id || '';
  });

  const [activeSubTab, setActiveSubTab] = useState<'report' | 'protocol' | 'map' | 'findings' | 'roster' | 'chat'>('report');
  const [operationToDelete, setOperationToDelete] = useState<SearchOperation | null>(null);
  const [operationToReactivate, setOperationToReactivate] = useState<SearchOperation | null>(null);

  // Reactivation Modal Form State
  const [reactivatePhaseTitle, setReactivatePhaseTitle] = useState('');
  const [reactivateCommander, setReactivateCommander] = useState('');
  const [reactivateNotes, setReactivateNotes] = useState('');
  const [selectedResponderIds, setSelectedResponderIds] = useState<string[]>([]);
  const [keepSearchedSectors, setKeepSearchedSectors] = useState(true);
  const [preserveTracks, setPreserveTracks] = useState(true);
  const [autoOpenMap, setAutoOpenMap] = useState(true);

  // Protocol Filter & Search State
  const [protocolSearch, setProtocolSearch] = useState('');
  const [protocolCategoryFilter, setProtocolCategoryFilter] = useState<string>('all');
  const [copiedProtocol, setCopiedProtocol] = useState(false);
  const [copiedOfficialReport, setCopiedOfficialReport] = useState(false);
  const [newLogText, setNewLogText] = useState('');
  const [newLogCategory, setNewLogCategory] = useState<OperationLogEntry['category']>('general');
  const [showAddLogModal, setShowAddLogModal] = useState(false);
  const [snapshotPreviewModal, setSnapshotPreviewModal] = useState<string | null>(null);

  const selectedOp = allOperations.find((op) => op.id === selectedOpId) || allOperations[0];
  const isAdmin = currentUser?.role === 'admin';
  const isEL = currentUser?.role === 'einsatzleitung';
  const canManageOps = isAdmin || isEL;

  if (!selectedOp && allOperations.length === 0) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono space-y-3">
        <div className="text-3xl">📭</div>
        <div className="text-base font-bold text-white">Keine Einsätze vorhanden</div>
        <p className="text-xs text-slate-500">Es wurden noch keine Einsätze oder Übungen angelegt.</p>
      </div>
    );
  }

  // Participants calculation without double counting
  const participants = selectedOp
    ? (selectedOp.participantIds && selectedOp.participantIds.length > 0
        ? allUsers.filter((u) => selectedOp.participantIds?.includes(u.id))
        : allUsers.filter((u) => u.isActive))
    : [];
  const externalVolunteersCount = selectedOp?.externalVolunteersCount || 0;
  const totalRespondersCount = participants.length + externalVolunteersCount;
  const isExercise = selectedOp?.type === 'exercise';
  const isCompleted = selectedOp?.status === 'completed';

  const durationStr = useMemo(() => {
    if (!selectedOp?.createdAt) return '-';
    const start = new Date(selectedOp.createdAt).getTime();
    const end = selectedOp.completedAt ? new Date(selectedOp.completedAt).getTime() : Date.now();
    const diffMs = Math.max(0, end - start);
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours} Std. ${mins} Min.`;
  }, [selectedOp?.createdAt, selectedOp?.completedAt]);

  const handlePrint = () => {
    window.print();
  };

  const confirmDeleteOperation = (opId: string) => {
    const remaining = allOperations.filter((o) => o.id !== opId);
    deleteOperation(opId);
    if (selectedOpId === opId) {
      setSelectedOpId(remaining[0]?.id || '');
    }
    setOperationToDelete(null);
  };

  // Open Reactivate Modal with smart defaults
  const handleOpenReactivate = (op: SearchOperation) => {
    const phaseCount = (op.archivedTracks?.length || 0) > 0 ? 2 : 1;
    setOperationToReactivate(op);
    setReactivatePhaseTitle(`Suchphase ${phaseCount + 1} (Erweiterte Nachsuche)`);
    setReactivateCommander(currentUser?.name || op.commander);
    setReactivateNotes('Fortsetzung der Suche mit angepasster Kräfteaufteilung. Bisherige Suchspuren und abgesuchte Areale bleiben auf der Lagekarte sichtbar.');
    // By default, select only the current user (if any)
    setSelectedResponderIds(currentUser ? [currentUser.id] : []);
    setKeepSearchedSectors(true);
    setPreserveTracks(true);
    setAutoOpenMap(true);
  };

  // Confirm Reactivation
  const handleConfirmReactivation = () => {
    if (!operationToReactivate) return;

    reactivateOperation(operationToReactivate.id, {
      phaseTitle: reactivatePhaseTitle.trim() || 'Suchphase 2',
      notes: reactivateNotes.trim(),
      newCommander: reactivateCommander.trim(),
      activatedUserIds: selectedResponderIds,
      keepSearchedSectors,
      preserveHistoricalTracks: preserveTracks,
    });

    const reactivatedId = operationToReactivate.id;
    setOperationToReactivate(null);
    setSelectedOpId(reactivatedId);

    if (autoOpenMap && onNavigateToMap) {
      onNavigateToMap();
    } else {
      setActiveSubTab('map');
    }
  };

  // Filtered Protocol Logs
  const filteredLogs = useMemo(() => {
    if (!selectedOp?.logs) return [];
    return selectedOp.logs.filter((log) => {
      const matchesSearch =
        !protocolSearch.trim() ||
        log.text.toLowerCase().includes(protocolSearch.toLowerCase()) ||
        log.authorName.toLowerCase().includes(protocolSearch.toLowerCase());
      const matchesCategory =
        protocolCategoryFilter === 'all' || log.category === protocolCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [selectedOp?.logs, protocolSearch, protocolCategoryFilter]);

  // Copy Protocol to Clipboard (short form)
  const handleCopyProtocol = () => {
    if (!selectedOp?.logs) return;
    const text = selectedOp.logs
      .map(
        (l) =>
          `[${new Date(l.timestamp).toLocaleTimeString('de-DE')}] [${l.category.toUpperCase()}] ${l.authorName} (${l.authorRole}): ${l.text}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedProtocol(true);
    setTimeout(() => setCopiedProtocol(false), 2000);
  };

  // Export Protocol to CSV (Excel / Official Spreadsheets)
  const handleExportCsv = () => {
    if (!selectedOp?.logs || selectedOp.logs.length === 0) {
      return;
    }
    const header = 'Zeitstempel;Datum;Uhrzeit;Kategorie;Verfasser;Rolle;Ereignistext\n';
    const rows = [...selectedOp.logs]
      .reverse()
      .map((l) => {
        const d = new Date(l.timestamp);
        const dateStr = d.toLocaleDateString('de-DE');
        const timeStr = d.toLocaleTimeString('de-DE');
        const cleanText = (l.text || '').replace(/"/g, '""').replace(/;/g, ',').replace(/\n/g, ' ');
        return `"${l.timestamp}";"${dateStr}";"${timeStr}";"${l.category}";"${l.authorName}";"${l.authorRole}";"${cleanText}"`;
      })
      .join('\n');
    const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const sanitizedTitle = (selectedOp.title || 'Einsatz').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `Einsatzprotokoll_${sanitizedTitle}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Copy full official debriefing report to clipboard (suitable for police / dispatch)
  const handleCopyFullOfficialReport = () => {
    if (!selectedOp) return;
    const startStr = new Date(selectedOp.createdAt).toLocaleString('de-DE');
    const endStr = selectedOp.completedAt
      ? new Date(selectedOp.completedAt).toLocaleString('de-DE')
      : 'Laufend / Aktiv';
    const lines: string[] = [
      '========================================================================',
      'SPÜRHUNDE-SALZLANDKREIS E.V. – EINSATZ- & ABSCHLUSS-PROTOKOLL',
      'Vereinsbüro: Hohe Straße 15, 06449 Aschersleben',
      '========================================================================',
      `Einsatz:            ${selectedOp.title}`,
      `Typ:                ${selectedOp.type === 'exercise' ? 'Einsatzübung' : 'Realer Sucheinsatz'}`,
      `Einsatz-ID:         #${selectedOp.id.slice(-8).toUpperCase()} (${selectedOp.id})`,
      `Einsatzleitung:     ${selectedOp.commander}`,
      `Startzeitpunkt:     ${startStr}`,
      `Einsatzende:        ${endStr}`,
      `Dauer:              ${durationStr}`,
      `Einsatzergebnis:    ${selectedOp.outcome || (selectedOp.status === 'completed' ? 'Einsatz beendet' : 'In Durchführung')}`,
      `EZ-Standort:       ${selectedOp.headquartersLocation?.address || 'Vereinsbüro Hohe Straße 15, Aschersleben'} (GPS: ${selectedOp.headquartersLocation?.lat?.toFixed(5) || '51.75696'}, ${selectedOp.headquartersLocation?.lng?.toFixed(5) || '11.45352'})`,
      '------------------------------------------------------------------------',
      '1. ANGABEN ZUR VERMISSTEN PERSON / OBJEKT:',
      `Name:               ${selectedOp.missingPerson?.name || 'Unbekannt'}`,
      `Alter / Geschlecht: ${selectedOp.missingPerson?.age || '-'} Jahre / ${selectedOp.missingPerson?.gender === 'male' ? 'Männlich' : selectedOp.missingPerson?.gender === 'female' ? 'Weiblich' : 'Divers'}`,
      `Letzter Sichtort:   ${selectedOp.missingPerson?.lastSeenLocation?.address || '-'} (GPS: ${selectedOp.missingPerson?.lastSeenLocation?.lat}, ${selectedOp.missingPerson?.lastSeenLocation?.lng})`,
      `Wohnanschrift:      ${selectedOp.missingPerson?.homeAddress?.address || '-'}`,
      `Bekleidung:         ${selectedOp.missingPerson?.clothing || '-'}`,
      `Beschreibung:       ${selectedOp.missingPerson?.description || '-'}`,
      `Vorerkrankungen:    ${selectedOp.missingPerson?.medicalConditions?.join(', ') || 'Keine bekannt'}`,
      `Notfallkontakt:     ${selectedOp.missingPerson?.emergencyContact || '-'}`,
      `Poliz. Vorgang:     ${selectedOp.missingPerson?.policeCaseId || '-'}`,
      '------------------------------------------------------------------------',
      `2. STÄRKENACHWEIS (${totalRespondersCount} Einsatzkräfte):`,
      ...participants.map(
        (u) =>
          ` - ${u.name} | Funk: ${u.callSign} | KFZ: ${u.licensePlate || '-'} | Rolle: ${u.role === 'admin' ? 'Einsatzleitung' : 'Suchkraft'}`
      ),
      ...(externalVolunteersCount > 0
        ? [` - ${externalVolunteersCount} externe Helfer / Freiwillige (${selectedOp.externalVolunteersNotes || 'ohne App'})`]
        : []),
      '------------------------------------------------------------------------',
      `3. SUCHSEKTOREN (${selectedOp.sectors?.length || 0} Sektoren):`,
      ...(selectedOp.sectors?.map(
        (s) =>
          ` - [${s.name}] Prio: ${s.priority.toUpperCase()} | Status: ${s.status} | Fläche: ${s.areaM2 ? `${Math.round(s.areaM2 / 1000)}k m²` : '-'} | Kräfte: ${s.assignedUserNames?.join(', ') || 'Keine'}`
      ) || [' - Keine Sektoren definiert']),
      '------------------------------------------------------------------------',
      `4. DOKUMENTIERTE FUNDE (${selectedOp.findings?.length || 0}):`,
      ...(selectedOp.findings?.map(
        (f) =>
          ` - [${new Date(f.timestamp).toLocaleTimeString('de-DE')}] ${f.title} (${f.category}) von ${f.userName} | Pos: ${f.location?.lat?.toFixed(5)}, ${f.location?.lng?.toFixed(5)} | ${f.description}`
      ) || [' - Keine Funde dokumentiert']),
      '------------------------------------------------------------------------',
      `5. CHRONOLOGISCHES EINSATZTAGEBUCH (${selectedOp.logs?.length || 0} Einträge):`,
      ...([...(selectedOp.logs || [])]
        .reverse()
        .map(
          (l) =>
            ` [${new Date(l.timestamp).toLocaleTimeString('de-DE')}] [${l.category.toUpperCase()}] ${l.authorName} (${l.authorRole}): ${l.text}`
        )),
      '------------------------------------------------------------------------',
      '6. ABSCHLUSSVERMERK DER EINSATZLEITUNG:',
      selectedOp.notes || 'Keine gesonderten Abschlussbemerkungen hinterlegt.',
      '========================================================================',
      'Dokumentiert und zur Vorlage bei Polizei / Leitstelle freigegeben.',
      'Ort, Datum: Aschersleben, den __________________',
      `Unterschrift Einsatzleiter (${selectedOp.commander}): _______________________________`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedOfficialReport(true);
    setTimeout(() => setCopiedOfficialReport(false), 2500);
  };

  // Add Manual Protocol Entry
  const handleAddManualLog = () => {
    if (!newLogText.trim() || !selectedOp) return;
    const now = new Date().toISOString();
    const entry: OperationLogEntry = {
      id: `log-${Date.now()}`,
      operationId: selectedOp.id,
      timestamp: now,
      authorName: currentUser?.name || 'Einsatzleitung',
      authorRole: currentUser?.role || 'admin',
      category: newLogCategory,
      text: newLogText.trim(),
    };

    const updatedLogs = [entry, ...selectedOp.logs];
    updateOperation(selectedOp.id, {
      logs: updatedLogs,
      updatedAt: now,
    });

    setNewLogText('');
    setShowAddLogModal(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 text-slate-100 font-sans">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#1E293B] border border-slate-700 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🗄️</span>
            <h1 className="text-base font-bold text-white uppercase tracking-wide">
              Einsatzarchiv & Nachbereitung (Debriefing)
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Dauerhafte Archivierung, lückenloses Protokoll, GPS-Bewegungsprofile und Reaktivierung für Folgesuchen
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedOp && (
            <button
              onClick={() => handleOpenReactivate(selectedOp)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold border border-emerald-500 transition cursor-pointer font-mono uppercase tracking-wider shadow-lg shadow-emerald-950/50"
              title="Einsatz reaktivieren und neue Suchphase mit bisherigen Lageerkenntnissen starten"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Einsatz reaktivieren</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-xl text-xs font-bold border border-slate-700 transition cursor-pointer font-mono uppercase tracking-wider shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Bericht drucken / PDF</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Operations list on left, Replay / Report / Protocol on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Operation Selection Cards */}
        <div className="lg:col-span-4 space-y-3 font-mono">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              EINSÄTZE ({allOperations.length}):
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {allOperations.filter((o) => o.status === 'completed').length} abgeschlossen
            </span>
          </div>

          <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-0.5">
            {allOperations.map((op) => {
              const isSel = selectedOp && op.id === selectedOp.id;
              const opIsExercise = op.type === 'exercise';
              const isOpCompleted = op.status === 'completed';

              return (
                <div
                  key={op.id}
                  onClick={() => {
                    setSelectedOpId(op.id);
                  }}
                  className={`w-full text-left p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-2 shadow relative group ${
                    isSel
                      ? 'bg-slate-800/95 border-blue-500 ring-2 ring-blue-500/30'
                      : 'bg-[#1E293B] border-slate-700 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{opIsExercise ? '🟠' : '🔴'}</span>
                      <div className="min-w-0">
                        <h3 className="font-bold text-xs text-white leading-tight font-sans truncate">{op.title}</h3>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                          Erstellt: {new Date(op.createdAt).toLocaleDateString()} • {op.commander}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                          isOpCompleted
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                            : 'bg-red-950 text-red-300 border border-red-700'
                        }`}
                      >
                        {isOpCompleted ? 'Abgeschlossen' : 'Aktiv'}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOperationToDelete(op);
                          }}
                          className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/50 border border-transparent hover:border-red-800/60 transition cursor-pointer"
                          title="Einsatz unwiderruflich löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-700/60 font-mono">
                    <span>
                      {op.sectors?.length || 0} Sektoren • {op.findings?.length || 0} Funde • {op.logs?.length || 0} Logs
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOpId(op.id);
                          setActiveSubTab('report');
                        }}
                        className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-0.5 hover:underline cursor-pointer bg-blue-950/50 px-2 py-0.5 rounded border border-blue-800/60 text-[10px]"
                        title="Gesamtprotokoll öffnen"
                      >
                        Protokoll <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed Replay & Debrief Report */}
        {selectedOp ? (
          <div className="lg:col-span-8 bg-[#1E293B] border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-5">
            {/* Header of selected operation */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-700">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded uppercase border font-mono ${
                      isExercise
                        ? 'bg-amber-950 text-amber-300 border-amber-600'
                        : 'bg-red-950 text-red-300 border-red-600'
                    }`}
                  >
                    {isExercise ? 'ÜBUNG' : 'REALEINSATZ'}
                  </span>
                  <span className="text-xs font-mono text-slate-400">ID: {selectedOp.id}</span>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                      selectedOp.status === 'completed'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : 'bg-red-950 text-red-300 border border-red-700'
                    }`}
                  >
                    {selectedOp.status === 'completed' ? '✓ Archiviert' : '🔴 Aktiv'}
                  </span>
                </div>
                <h2 className="text-base font-bold text-white mt-1 uppercase tracking-wide">{selectedOp.title}</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Vermisste Person:{' '}
                  <strong className="text-slate-200 font-sans">
                    {selectedOp.missingPerson?.name || 'Unbekannt'}
                  </strong>{' '}
                  ({selectedOp.missingPerson?.age || 0} Jahre)
                </p>
              </div>

              {/* Action buttons & Sub-tab switcher */}
              <div className="flex flex-wrap items-center gap-2">
                {isAdmin && selectedOp.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => {
                      const notes = prompt('Abschlussvermerk / Grund für Beendigung eingeben:', 'Einsatz erfolgreich beendet.');
                      if (notes !== null) {
                        endOperation(selectedOp.id, notes, 'person_alive');
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-xl text-xs font-mono font-bold transition cursor-pointer shadow-md"
                    title="Diesen aktiven Einsatz beenden"
                  >
                    <span>🛑 Einsatz beenden</span>
                  </button>
                )}

                      {canManageOps && selectedOp.status === 'completed' && (
                        <button
                          type="button"
                          onClick={() => handleOpenReactivate(selectedOp)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-mono font-bold transition cursor-pointer shadow-md"
                          title="Diesen Einsatz reaktivieren und neue Suchphase starten"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reaktivieren</span>
                        </button>
                      )}

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setOperationToDelete(selectedOp)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 rounded-xl text-xs font-mono font-bold transition cursor-pointer"
                    title="Diesen Einsatz löschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Löschen</span>
                  </button>
                )}

                <div className="flex flex-wrap gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700 text-xs font-mono">
                  <button
                    onClick={() => setActiveSubTab('report')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer uppercase tracking-wider ${
                      activeSubTab === 'report' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Gesamtprotokoll
                  </button>
                  <button
                    onClick={() => setActiveSubTab('protocol')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer uppercase tracking-wider flex items-center gap-1.5 ${
                      activeSubTab === 'protocol' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>Tagebuch</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 font-mono">
                      {selectedOp.logs?.length || 0}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveSubTab('map')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer uppercase tracking-wider ${
                      activeSubTab === 'map' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Lagekarte
                  </button>
                  <button
                    onClick={() => setActiveSubTab('findings')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer uppercase tracking-wider ${
                      activeSubTab === 'findings' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Funde ({selectedOp.findings?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveSubTab('roster')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer uppercase tracking-wider ${
                      activeSubTab === 'roster' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Kräfte ({participants.length})
                  </button>
                  <button
                    onClick={() => setActiveSubTab('chat')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer uppercase tracking-wider flex items-center gap-1.5 ${
                      activeSubTab === 'chat' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>Funk & Chat</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 font-mono">
                      {selectedOp.archivedChatMessages?.length || 0}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* SubTab 1: Einsatzbericht / Debrief Protocol (Print Ready) */}
            {activeSubTab === 'report' && (
              <div className="space-y-5 text-xs">
                {/* Missing Person Profile Box */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row gap-4 items-start font-mono">
                  <div className="h-24 w-24 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shrink-0 flex items-center justify-center">
                    {selectedOp.missingPerson?.photoUrl && selectedOp.missingPerson.photoUrl.trim() !== '' ? (
                      <img
                        src={selectedOp.missingPerson.photoUrl}
                        alt={selectedOp.missingPerson.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserIcon className="w-10 h-10 text-slate-600" />
                    )}
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="text-xs font-bold text-white flex items-center justify-between">
                      <span className="text-sm font-sans">
                        {selectedOp.missingPerson?.name} ({selectedOp.missingPerson?.age} Jahre)
                      </span>
                      <span className="text-xs font-mono text-blue-400">
                        {selectedOp.missingPerson?.policeCaseId || 'Aktenzeichen SLK'}
                      </span>
                    </div>
                    <div className="text-slate-300">
                      <strong className="text-slate-400 uppercase text-[10px]">Bekleidung:</strong>{' '}
                      <span className="font-sans">{selectedOp.missingPerson?.clothing || 'Keine Angabe'}</span>
                    </div>
                    <div className="text-slate-400 font-sans">
                      <strong className="text-slate-400 uppercase text-[10px] font-mono">Beschreibung:</strong>{' '}
                      {selectedOp.missingPerson?.description || '-'}
                    </div>
                    <div className="text-amber-400">
                      <strong className="uppercase text-[10px]">Medizinische Besonderheiten:</strong>{' '}
                      <span className="font-sans">
                        {selectedOp.missingPerson?.medicalConditions?.join(', ') || 'Keine'}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px] pt-1">
                      Letzter Sichtungsort: {selectedOp.missingPerson?.lastSeenLocation?.address || 'Einsatzgebiet'} (
                      {selectedOp.missingPerson?.lastSeenTime || '-'})
                    </div>
                  </div>
                </div>

                {/* Sektor & Search Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">SUCHSEKTOREN GESAMT</span>
                    <div className="text-base font-bold text-white font-mono mt-1">
                      {selectedOp.sectors?.length || 0} Sektoren
                    </div>
                    <div className="text-[10px] text-emerald-400 mt-0.5">
                      {selectedOp.sectors?.filter((s) => s.status === 'searched').length || 0} als abgesucht markiert (Grün)
                    </div>
                  </div>

                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">DOKUMENTIERTE FUNDE</span>
                    <div className="text-base font-bold text-amber-400 font-mono mt-1">
                      {selectedOp.findings?.length || 0} Fundmeldungen
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {selectedOp.findings?.filter((f) => f.verified).length || 0} verifiziert durch Einsatzleitung
                    </div>
                  </div>

                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">EINGESETZTE KRÄFTE</span>
                    <div className="text-base font-bold text-cyan-400 font-mono mt-1">
                      {totalRespondersCount} Kräfte Gesamt
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {participants.length} App-Kräfte {externalVolunteersCount > 0 ? `+ ${externalVolunteersCount} Freiwillige / Externe` : ''}
                    </div>
                  </div>
                </div>

                {/* Externe Helfer Notiz (ohne App) */}
                {(externalVolunteersCount > 0 || (selectedOp.externalVolunteersNotes && selectedOp.externalVolunteersNotes.trim() !== '')) && (
                  <div className="bg-slate-900 p-3.5 rounded-xl border border-amber-500/30 font-mono flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-950/80 border border-amber-800 text-amber-300 shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                        Freiwillige Helfer & Externe Kräfte (Ohne App-Zugang): {externalVolunteersCount} Personen
                      </div>
                      <div className="text-[11px] text-slate-300 font-sans">
                        {selectedOp.externalVolunteersNotes || 'Im Stärkenachweis des Einsatzes erfasst.'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Ausrüstung & Einsatzmittel Übersicht */}
                {Array.isArray(selectedOp.selectedEquipment) && selectedOp.selectedEquipment.length > 0 && (
                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-700 font-mono space-y-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                      <span>EINGESETZTE AUSRÜSTUNG & HILFSMITTEL ({selectedOp.selectedEquipment.length}):</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedOp.selectedEquipment.map((eq) => {
                        const item = EQUIPMENT_LABELS[eq] || { label: eq, icon: '📦' };
                        return (
                          <span
                            key={eq}
                            className="px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-700/50 text-cyan-200 text-xs font-mono font-semibold flex items-center gap-1.5 shadow-sm"
                          >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                          </span>
                        );
                      })}
                    </div>
                    {selectedOp.customEquipmentNotes && (
                      <div className="text-[11px] text-slate-300 bg-slate-950/40 p-2 rounded-lg border border-slate-800 font-sans">
                        <span className="font-mono text-slate-400">Spezialausrüstung:</span> {selectedOp.customEquipmentNotes}
                      </div>
                    )}
                  </div>
                )}

                {/* Gespeicherter Lagekarten-Screenshot (Abschluss) */}
                {selectedOp.mapSnapshotUrl && (
                  <div className="bg-slate-900 p-3.5 rounded-xl border border-purple-500/40 font-mono space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold text-purple-300 uppercase flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-purple-400" />
                        <span>LAGEKARTEN-SCHNAPPSCHUSS BEI EINSATZENDE:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSnapshotPreviewModal(selectedOp.mapSnapshotUrl || null)}
                          className="px-2.5 py-1 bg-purple-950 hover:bg-purple-900 border border-purple-700 text-purple-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Vollbild</span>
                        </button>
                        <a
                          href={selectedOp.mapSnapshotUrl}
                          download={`lagekarte-${selectedOp.id}.jpg`}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3 text-cyan-400" />
                          <span>Download</span>
                        </a>
                      </div>
                    </div>

                    <div
                      onClick={() => setSnapshotPreviewModal(selectedOp.mapSnapshotUrl || null)}
                      className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 max-h-64 cursor-pointer group"
                    >
                      <img
                        src={selectedOp.mapSnapshotUrl}
                        alt="Lagekarten-Screenshot"
                        className="w-full h-auto object-cover max-h-64 group-hover:scale-[1.01] transition duration-200"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/0 transition" />
                      <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Klicken zum Vergrößern
                      </span>
                    </div>
                  </div>
                )}

                {/* Sektoren Detail-Tabelle */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block font-mono">
                    Detaillierte Sektoren-Dokumentation:
                  </span>
                  <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-900">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-700">
                        <tr>
                          <th className="p-2.5">Sektor</th>
                          <th className="p-2.5">Fläche</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">Zugewiesene Einheiten</th>
                          <th className="p-2.5">Freigabe / Vermerk</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/60">
                        {selectedOp.sectors?.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-800/50">
                            <td className="p-2.5 font-bold text-white font-sans">{s.name}</td>
                            <td className="p-2.5 text-slate-400 font-mono">{s.areaHectares || 25} ha</td>
                            <td className="p-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  s.status === 'searched'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                    : s.status === 'in_progress'
                                    ? 'bg-amber-950 text-amber-300'
                                    : 'bg-blue-950 text-blue-300'
                                }`}
                              >
                                {s.status === 'searched'
                                  ? '✅ Abgesucht'
                                  : s.status === 'in_progress'
                                  ? 'In Suche'
                                  : 'Offen'}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-300 font-sans">
                              {allUsers
                                .filter((u) => s.assignedUserIds?.includes(u.id))
                                .map((u) => u.callSign)
                                .join(', ') || 'Keine'}
                            </td>
                            <td className="p-2.5 text-slate-400 italic font-sans">
                              {s.clearedAt ? `Abgesucht: ${new Date(s.clearedAt).toLocaleTimeString()}` : s.notes || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Teilnehmerliste / Roster */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block font-mono">
                    Eingesetzte Kräfte & Teilnehmer:
                  </span>
                  <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-900">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-700">
                        <tr>
                          <th className="p-2.5">Name (Funkrufname)</th>
                          <th className="p-2.5">Rolle</th>
                          <th className="p-2.5">Gruppe</th>
                          <th className="p-2.5">Zugewiesene Sektoren</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/60">
                        {participants.map((u) => {
                          const userSectors = selectedOp.sectors?.filter(s => s.assignedUserIds?.includes(u.id)).map(s => s.name).join(', ') || '-';
                          return (
                            <tr key={u.id} className="hover:bg-slate-800/50">
                              <td className="p-2.5 font-bold text-white font-sans">{u.name} ({u.callSign})</td>
                              <td className="p-2.5 text-slate-400 font-sans capitalize">{u.role === 'einsatzleitung' || u.role === 'admin' ? 'Einsatzleitung' : 'Suchkraft'}</td>
                              <td className="p-2.5 text-slate-400 font-sans capitalize">{u.groupId || '-'}</td>
                              <td className="p-2.5 text-slate-400 font-sans">{userSectors}</td>
                            </tr>
                          );
                        })}
                        {participants.length === 0 && (
                          <tr><td colSpan={4} className="p-2.5 text-slate-500 italic text-center">Keine digitalen Teilnehmer erfasst.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Funde */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block font-mono">
                    Funde und Erkenntnisse:
                  </span>
                  {selectedOp.findings && selectedOp.findings.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedOp.findings.map(f => (
                        <div key={f.id} className="bg-slate-900 p-3 rounded-xl border border-slate-700">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-amber-400 font-sans">{f.title}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{new Date(f.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-xs text-slate-300 mb-2 font-sans">{f.description || 'Keine Details'}</p>
                          <div className="text-[10px] text-slate-400 font-mono bg-slate-950 p-1.5 rounded inline-block">
                            Verbleib: {f.status === 'verified' ? '✅ Gesichert' : f.status === 'pending' ? '🔍 In Untersuchung' : 'Gemeldet'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-700 text-slate-500 italic text-center text-xs">
                      Keine Funde dokumentiert.
                    </div>
                  )}
                </div>

                {/* Chatverlauf */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block font-mono">
                    Funk- und Chatprotokoll:
                  </span>
                  <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden max-h-96 overflow-y-auto">
                    {selectedOp.archivedChatMessages && selectedOp.archivedChatMessages.length > 0 ? (
                      <div className="divide-y divide-slate-700/50">
                        {selectedOp.archivedChatMessages.map(msg => {
                          const sender = allUsers.find(u => u.id === msg.senderId);
                          return (
                            <div key={msg.id} className="p-3 hover:bg-slate-800/30">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] text-slate-500 font-mono">{new Date(msg.timestamp).toLocaleString()}</span>
                                <span className={`text-[11px] font-bold ${msg.isAlert ? 'text-red-400' : 'text-blue-400'}`}>
                                  {sender ? `${sender.name} (${sender.callSign})` : 'System'}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 uppercase">
                                  {msg.channel}
                                </span>
                              </div>
                              <p className={`text-xs ${msg.isAlert ? 'text-red-300 font-bold' : 'text-slate-300'}`}>{msg.text}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 text-slate-500 italic text-center text-xs">
                        Kein Chatverlauf archiviert.
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Protocol Banner in Report */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex items-center justify-between font-mono">
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span>Einsatztagebuch & Chronologie ({selectedOp.logs?.length || 0} Einträge)</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Vollständige lückenlose Dokumentation aller Ereignisse, Funksprüche und Reaktivierungen
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveSubTab('protocol')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
                  >
                    <span>Tagebuch öffnen</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Notes & Commander Signoff */}
                {selectedOp.notes && (
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 font-mono">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      ABSCHLUSSVERMERK DER EINSATZLEITUNG:
                    </span>
                    <p className="text-xs text-slate-200 italic leading-relaxed font-sans">{selectedOp.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* SubTab 2: Einsatztagebuch & Protokoll (Interactive Chronological Log) */}
            {activeSubTab === 'protocol' && (
              <div className="space-y-4">
                {/* Protocol Filter & Action Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 p-3.5 rounded-xl border border-slate-700 font-mono text-xs">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={protocolSearch}
                        onChange={(e) => setProtocolSearch(e.target.value)}
                        placeholder="Im Protokoll suchen..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    {protocolSearch && (
                      <button
                        onClick={() => setProtocolSearch('')}
                        className="p-2 text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleCopyProtocol}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer text-xs font-mono"
                      title="Chronologisches Protokoll in Zwischenablage kopieren"
                    >
                      {copiedProtocol ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedProtocol ? 'Kopiert!' : 'Protokoll kopieren'}</span>
                    </button>

                    <button
                      onClick={handleCopyFullOfficialReport}
                      className="px-3 py-2 bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 rounded-xl border border-indigo-700/60 transition flex items-center gap-1.5 cursor-pointer text-xs font-mono"
                      title="Vollständigen behördlichen Einsatz- und Abschlussbericht (inkl. Vermisste, Kräfte, Sektoren, Funde und Tagebuch) kopieren"
                    >
                      {copiedOfficialReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileText className="w-3.5 h-3.5" />}
                      <span>{copiedOfficialReport ? 'Bericht kopiert!' : 'Gesamtbericht kopieren'}</span>
                    </button>

                    <button
                      onClick={handleExportCsv}
                      disabled={!selectedOp?.logs || selectedOp.logs.length === 0}
                      className="px-3 py-2 bg-emerald-950/70 hover:bg-emerald-900 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-300 rounded-xl border border-emerald-700/60 transition flex items-center gap-1.5 cursor-pointer text-xs font-mono"
                      title="Protokoll als CSV für Microsoft Excel oder Dienstsoftware exportieren"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>CSV Export</span>
                    </button>

                    <button
                      onClick={handlePrint}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer text-xs font-mono"
                      title="Offizielles Behördenprotokoll als PDF drucken / speichern"
                    >
                      <Printer className="w-3.5 h-3.5 text-blue-400" />
                      <span>Drucken / PDF</span>
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => setShowAddLogModal(true)}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer text-xs font-mono"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Eintrag hinzufügen</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Category Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                  <span className="text-slate-400 uppercase text-[10px] font-bold mr-1">Filter:</span>
                  {[
                    { id: 'all', label: 'Alle' },
                    { id: 'status', label: 'Status & Reaktivierung' },
                    { id: 'sector', label: 'Sektoren' },
                    { id: 'finding', label: 'Funde' },
                    { id: 'radio', label: 'Funk' },
                    { id: 'member', label: 'Kräfte' },
                    { id: 'end', label: 'Einsatzende' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setProtocolCategoryFilter(cat.id)}
                      className={`px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                        protocolCategoryFilter === cat.id
                          ? 'bg-blue-600 border-blue-500 text-white font-bold'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Protocol Timeline Entries */}
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {filteredLogs.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 font-mono text-xs bg-slate-900 rounded-xl border border-slate-800">
                      Keine Protokolleinträge für diese Filterung gefunden.
                    </div>
                  ) : (
                    filteredLogs.map((log) => {
                      const categoryColors: Record<string, string> = {
                        status: 'border-blue-500 bg-blue-950/40 text-blue-300',
                        finding: 'border-amber-500 bg-amber-950/40 text-amber-300',
                        sector: 'border-emerald-500 bg-emerald-950/40 text-emerald-300',
                        member: 'border-purple-500 bg-purple-950/40 text-purple-300',
                        radio: 'border-cyan-500 bg-cyan-950/40 text-cyan-300',
                        end: 'border-red-500 bg-red-950/40 text-red-300',
                        general: 'border-slate-600 bg-slate-900 text-slate-300',
                      };

                      const categoryBadges: Record<string, string> = {
                        status: 'STATUS / LAGE',
                        finding: 'FUNDMELDUNG',
                        sector: 'SEKTOR',
                        member: 'KRÄFTE',
                        radio: 'FUNKSPRUCH',
                        end: 'EINSATZENDE',
                        general: 'ALLGEMEIN',
                      };

                      return (
                        <div
                          key={log.id}
                          className="bg-slate-900/90 border border-slate-700 rounded-xl p-3.5 space-y-1.5 shadow"
                        >
                          <div className="flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                                  categoryColors[log.category] || categoryColors.general
                                }`}
                              >
                                {categoryBadges[log.category] || log.category.toUpperCase()}
                              </span>
                              <span className="font-bold text-white font-sans">{log.authorName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">({log.authorRole})</span>
                            </div>
                            <span className="text-slate-400 text-[11px] flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3 text-slate-500" />
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>

                          <p className="text-xs text-slate-200 leading-relaxed font-sans pl-1 border-l-2 border-slate-700">
                            {log.text}
                          </p>

                          {log.snapshotUrl && (
                            <div className="mt-2.5 p-2.5 bg-slate-950/80 rounded-xl border border-purple-500/30 flex items-center gap-3">
                              <img
                                src={log.snapshotUrl}
                                alt="Lagekarten-Snapshot"
                                onClick={() => setSnapshotPreviewModal(log.snapshotUrl || null)}
                                className="h-14 w-24 object-cover rounded-lg border border-slate-800 cursor-pointer shrink-0 hover:opacity-90"
                              />
                              <div className="space-y-1 flex-1">
                                <div className="text-xs font-bold text-purple-300 font-mono flex items-center gap-1.5">
                                  <Camera className="w-3.5 h-3.5" />
                                  <span>Lagekarten-Snapshot gesichert</span>
                                </div>
                                <p className="text-[10px] text-slate-400 font-sans">
                                  Momentaufnahme aller Suchspuren, Sektoren und Funde zu diesem Zeitpunkt.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setSnapshotPreviewModal(log.snapshotUrl || null)}
                                  className="text-[10px] text-cyan-400 hover:underline font-mono font-bold cursor-pointer"
                                >
                                  🔍 In Vollbild öffnen
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* SubTab 3: Lagekarten Replay (With preserved sectors, green search markers & tracks) */}
            {activeSubTab === 'map' && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs font-mono">
                  <span className="text-slate-300">
                    🗺️ <strong>Archivierte Lagekarte:</strong> Sektoren, dokumentierte Suchspuren & Fundstellen dieses Einsatzes.
                  </span>
                  <div className="flex items-center gap-2">
                    {selectedOp.mapSnapshotUrl && (
                      <a
                        href={selectedOp.mapSnapshotUrl}
                        download={`lagekarte-${selectedOp.id}.jpg`}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg font-bold text-[10px] uppercase transition cursor-pointer flex items-center gap-1"
                      >
                        <Download className="w-3 h-3 text-cyan-400" />
                        <span>Snapshot JPEG</span>
                      </a>
                    )}
                    {onNavigateToMap && (
                      <button
                        onClick={onNavigateToMap}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[10px] uppercase transition cursor-pointer"
                      >
                        Vollbild-Karte
                      </button>
                    )}
                  </div>
                </div>

                {/* If a snapshot was saved on completion, offer quick preview */}
                {selectedOp.mapSnapshotUrl && (
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-purple-500/30 flex items-center justify-between gap-3 text-xs font-mono">
                    <div className="flex items-center gap-2 text-purple-300">
                      <Camera className="w-4 h-4 shrink-0" />
                      <span>Gespeicherter Lagekarten-Screenshot zum Einsatzabschluss verfügbar</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSnapshotPreviewModal(selectedOp.mapSnapshotUrl || null)}
                      className="px-2.5 py-1 bg-purple-950 hover:bg-purple-900 border border-purple-700 text-purple-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Screenshot anzeigen</span>
                    </button>
                  </div>
                )}

                <div className="h-[520px] rounded-xl overflow-hidden border border-slate-700 shadow-xl">
                  <TacticalMap operation={selectedOp} mode="archive" />
                </div>
              </div>
            )}

            {/* SubTab 4: Findings Gallery */}
            {activeSubTab === 'findings' && (
              <div className="space-y-4 text-xs font-mono">
                {selectedOp.findings?.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">Keine Fundmeldungen bei dieser Operation erfasst.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedOp.findings?.map((f) => (
                      <div
                        key={f.id}
                        className="bg-slate-900 p-3.5 rounded-xl border border-slate-700 space-y-2 shadow flex flex-col justify-between"
                      >
                        <div>
                          {f.mediaUrl && f.mediaUrl.trim() !== '' && (
                            <div className="h-32 w-full rounded-lg overflow-hidden border border-slate-700 mb-2 bg-black">
                              <img src={f.mediaUrl} alt={f.title} className="h-full w-full object-cover" />
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-white text-xs font-sans">{f.title}</h4>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                f.verified ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'
                              }`}
                            >
                              {f.verified ? '✓ Verifiziert' : 'In Prüfung'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 mt-1 leading-snug font-sans">{f.description}</p>
                        </div>

                        <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between text-[10px] text-slate-400">
                          <span>
                            Von: {f.userName} ({f.userCallSign})
                          </span>
                          <span className="font-mono text-blue-400">
                            {f.location.lat.toFixed(4)}, {f.location.lng.toFixed(4)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SubTab 5: Responders Roster (Teilnehmerliste & Stärkenachweis) */}
            {activeSubTab === 'roster' && (
              <div className="space-y-4 text-xs font-mono">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Stärkenachweis & Teilnehmerliste der eingesetzten Kräfte:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[11px] font-bold">
                      Stärke: {totalRespondersCount} Gesamt
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ({participants.length} App-registriert, {externalVolunteersCount} externe Helfer)
                    </span>
                  </div>
                </div>

                {/* App-registrierte Kräfte */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">
                    App-Registrierte Einsatzkräfte ({participants.length}):
                  </span>
                  <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-900">
                    <table className="w-full text-left">
                      <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-700">
                        <tr>
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">Funkrufname</th>
                          <th className="p-2.5">KFZ-Kennzeichen</th>
                          <th className="p-2.5">Organisation</th>
                          <th className="p-2.5">Rolle / Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/60">
                        {participants.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-slate-500 font-mono">
                              Keine App-Kräfte direkt zugewiesen
                            </td>
                          </tr>
                        ) : (
                          participants.map((u) => (
                            <tr key={u.id} className="hover:bg-slate-800/50 font-sans">
                              <td className="p-2.5 font-bold text-white flex items-center gap-2">
                                <div className="h-6 w-6 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center">
                                  {u.photoUrl && u.photoUrl.trim() !== '' ? (
                                    <img src={u.photoUrl} alt={u.name} className="h-full w-full object-cover" />
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-300 uppercase">
                                      {u.name.charAt(0)}
                                    </span>
                                  )}
                                </div>
                                <span>{u.name}</span>
                              </td>
                              <td className="p-2.5 text-blue-400 font-mono font-semibold">{u.callSign}</td>
                              <td className="p-2.5 font-mono text-slate-300">{u.licensePlate || '-'}</td>
                              <td className="p-2.5 text-slate-400">{u.organization || '-'}</td>
                              <td className="p-2.5 text-slate-300 font-mono text-[11px]">
                                {u.role === 'admin' ? '🛡️ Einsatzleiter' : '🚶 Suchkraft'} •{' '}
                                {u.isActive ? '🟢 Aktiv' : '⚪ Inaktiv'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Externe Helfer & Freiwillige ohne App */}
                {(externalVolunteersCount > 0 || (selectedOp.externalVolunteersNotes && selectedOp.externalVolunteersNotes.trim() !== '')) && (
                  <div className="bg-slate-900/90 p-4 rounded-xl border border-amber-500/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-300 font-bold">
                        <Users className="w-4 h-4" />
                        <span className="uppercase text-xs tracking-wider">
                          Freiwillige Helfer & Externe Organisationen (ohne App-Zugang)
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 text-xs font-bold">
                        {externalVolunteersCount} Helfer
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                      <strong>Dokumentierte Zuordnung / Gruppen:</strong>{' '}
                      {selectedOp.externalVolunteersNotes || 'Keine detaillierte Gruppenaufteilung hinterlegt'}
                    </div>
                    <p className="text-[10px] text-slate-400 italic">
                      ✓ Diese Helfer fließen in die Gesamteinsatzstärke und das Protokoll ein, ohne die digitale App-Nutzerliste zu verfälschen.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* SubTab 6: Funk & Chatverlauf (Archived Radio / Direct Protocol) */}
            {activeSubTab === 'chat' && (
              <div className="space-y-4 text-xs font-mono">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Radio className="w-4 h-4 text-blue-400" />
                    <span>Archivierter Funk- und Einsatz-Chat ({selectedOp.archivedChatMessages?.length || 0} Meldungen)</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Chronologisch gesichert</span>
                </div>

                {!selectedOp.archivedChatMessages || selectedOp.archivedChatMessages.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
                    Für diesen Einsatz wurden keine gesonderten Chat-Nachrichten im Archiv erfasst.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto p-1">
                    {selectedOp.archivedChatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-xl border transition ${
                          msg.isAlert
                            ? 'bg-amber-950/30 border-amber-500/50'
                            : 'bg-slate-900 border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-cyan-300 font-mono">{msg.senderName}</span>
                            <span className="text-slate-400 font-mono text-[10px]">({msg.senderCallSign})</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-300 uppercase">
                              {msg.channel}
                            </span>
                          </div>
                          <span className="text-slate-500 font-mono text-[10px]">
                            {new Date(msg.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 font-sans leading-relaxed pl-1">{msg.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* REACTIVATION MODAL: Reaktivierung mit neuer Kräfteaufteilung & Erhalt von Sektoren/Spuren */}
      {operationToReactivate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[5000] flex items-center justify-center p-4">
          <div className="bg-[#1E293B] border-2 border-emerald-500/70 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] animate-in fade-in zoom-in-95 font-sans">
            <div className="p-6 flex items-start justify-between gap-3 border-b border-slate-700/50">
              <div className="flex items-center gap-2.5 text-emerald-400">
                <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-800/80">
                  <RotateCcw className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    Einsatz reaktivieren / Neue Suchphase
                  </h3>
                  <span className="text-[11px] text-emerald-300 font-mono">
                    Erkenntnisse, Sektoren & Bewegungsprofile anknüpfen
                  </span>
                </div>
              </div>
              <button
                onClick={() => setOperationToReactivate(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-5 custom-scrollbar">
              {/* Target Operation Info Box */}
              <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-700 text-xs font-mono space-y-1.5">
                <div className="text-white font-bold font-sans text-sm flex items-center justify-between">
                  <span>{operationToReactivate.title}</span>
                  <span className="text-emerald-400 text-xs">
                    {operationToReactivate.sectors?.filter((s) => s.status === 'searched').length || 0} Sektoren bereits abgesucht
                  </span>
                </div>
                <div className="text-slate-400 text-[11px]">
                  Vermisst: {operationToReactivate.missingPerson?.name || 'Unbekannt'} • Ursprungs-Einsatzleiter:{' '}
                  {operationToReactivate.commander}
                </div>
              </div>

              <div className="space-y-4 text-xs">
                {/* Field 1: Phase Title */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 font-mono uppercase mb-1">
                    Bezeichnung der neuen Suchphase:
                  </label>
                  <input
                    type="text"
                    value={reactivatePhaseTitle}
                    onChange={(e) => setReactivatePhaseTitle(e.target.value)}
                    placeholder="z.B. Suchphase 2 – Erweiterte Nachsuche"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-sans text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Field 2: Commander */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 font-mono uppercase mb-1">
                    Einsatzleitung für diese Suchphase:
                  </label>
                  <input
                    type="text"
                    value={reactivateCommander}
                    onChange={(e) => setReactivateCommander(e.target.value)}
                    placeholder="Name der Einsatzleitung"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-sans text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Field 3: Responder Selection (Kräfteauswahl) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-300 font-mono uppercase">
                      Einsatzkräfte aktivieren (Nur Online-Nutzer anzeigen):
                    </label>
                  </div>
                  <div className="max-h-40 overflow-y-auto bg-slate-950 border border-slate-700 rounded-xl p-2 space-y-1.5 font-mono text-[11px] custom-scrollbar">
                    {(() => {
                      const onlineUsers = allUsers.filter(u => u.isActive);
                      if (onlineUsers.length === 0) {
                        return (
                          <div className="text-slate-500 italic p-3 text-center text-[10px]">
                            Keine Einsatzkräfte aktuell online.<br/>
                            Neue Kräfte müssen sich erst einloggen.
                          </div>
                        );
                      }
                      return onlineUsers.map((u) => {
                        const isChecked = selectedResponderIds.includes(u.id);
                        return (
                          <label
                            key={u.id}
                            className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-900 cursor-pointer text-slate-200"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedResponderIds((prev) => [...prev, u.id]);
                                  } else {
                                    setSelectedResponderIds((prev) => prev.filter((id) => id !== u.id));
                                  }
                                }}
                                className="rounded text-emerald-500 focus:ring-0"
                              />
                              <span className="font-sans font-medium text-white">{u.name}</span>
                              <span className="text-blue-400 text-[10px]">({u.callSign})</span>
                            </div>
                            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              {u.role === 'admin' ? 'Leitung' : u.role === 'einsatzleitung' ? 'EL' : u.equipment?.join(', ') || 'Sucher'}
                            </span>
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Toggles */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2.5 font-mono text-xs">
                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={keepSearchedSectors}
                      onChange={(e) => setKeepSearchedSectors(e.target.checked)}
                      className="rounded text-emerald-500 focus:ring-0"
                    />
                    <span>✅ Bereits abgesuchte Sektoren (Grün) als erledigt beibehalten</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preserveTracks}
                      onChange={(e) => setPreserveTracks(e.target.checked)}
                      className="rounded text-emerald-500 focus:ring-0"
                    />
                    <span>🏛️ Bisherige GPS-Suchspuren der 1. Phase als Referenzpfade auf Karte behalten</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoOpenMap}
                      onChange={(e) => setAutoOpenMap(e.target.checked)}
                      className="rounded text-emerald-500 focus:ring-0"
                    />
                    <span>🗺️ Nach Reaktivierung direkt zur Lagekarte wechseln</span>
                  </label>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 font-mono uppercase mb-1">
                    Einsatzbefehl / Taktische Hinweise:
                  </label>
                  <textarea
                    value={reactivateNotes}
                    onChange={(e) => setReactivateNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-sans text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-slate-700 flex flex-col sm:flex-row items-center justify-end gap-2 font-mono text-xs font-bold bg-slate-900/50">
              <button
                onClick={() => setOperationToReactivate(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 uppercase tracking-wider cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                onClick={handleConfirmReactivation}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/60"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Einsatz jetzt reaktivieren</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD LOG ENTRY MODAL */}
      {showAddLogModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[5000] flex items-center justify-center p-4">
          <div className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] font-sans animate-in fade-in zoom-in-95">
            <div className="p-5 flex items-center justify-between border-b border-slate-700">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Eintrag ins Einsatztagebuch
              </h3>
              <button
                onClick={() => setShowAddLogModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs font-mono custom-scrollbar">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Kategorie:</label>
                <select
                  value={newLogCategory}
                  onChange={(e) => setNewLogCategory(e.target.value as OperationLogEntry['category'])}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="general">Allgemeine Lage</option>
                  <option value="status">Status & Führung</option>
                  <option value="sector">Sektoren & Suche</option>
                  <option value="finding">Fundmeldung</option>
                  <option value="radio">Funkspruch / Absprache</option>
                  <option value="member">Kräfte / Personal</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Ereignistext:</label>
                <textarea
                  value={newLogText}
                  onChange={(e) => setNewLogText(e.target.value)}
                  rows={5}
                  placeholder="Detaillierten Eintrag eingeben..."
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-sans text-xs focus:outline-none focus:border-blue-500 min-h-[120px]"
                />
              </div>
            </div>

            <div className="p-5 pt-3 border-t border-slate-700 flex justify-end gap-2 font-mono text-xs font-bold bg-slate-900/50">
              <button
                onClick={() => setShowAddLogModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAddManualLog}
                disabled={!newLogText.trim()}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold cursor-pointer transition shadow-lg"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deleting Operation */}
      {operationToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[5000] flex items-center justify-center p-4">
          <div className="bg-[#1E293B] border-2 border-red-500/60 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 text-red-400">
                <div className="p-2 rounded-xl bg-red-950/80 border border-red-800/80">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    Einsatz unwiderruflich löschen?
                  </h3>
                  <span className="text-[10px] text-red-300 font-mono">Aktion kann nicht rückgängig gemacht werden</span>
                </div>
              </div>
              <button
                onClick={() => setOperationToDelete(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-700 text-xs font-mono space-y-2">
              <div className="text-white font-bold font-sans text-sm">{operationToDelete.title}</div>
              <div className="text-slate-400 text-[11px]">
                Erstellt: {new Date(operationToDelete.createdAt).toLocaleDateString()} • {operationToDelete.commander}
              </div>
              <div className="text-slate-400 text-[11px] pt-1 border-t border-slate-800 flex justify-between">
                <span>{operationToDelete.sectors?.length || 0} Sektoren</span>
                <span>{operationToDelete.findings?.length || 0} Funde</span>
                <span>{operationToDelete.logs?.length || 0} Log-Einträge</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Möchten Sie diesen Einsatz wirklich vollständig löschen? Alle zugehörigen Sektoren, Lagekarten-Pfade,
              Fundmeldungen und Einsatztagebücher werden auch aus der Einsatz-Cloud entfernt.
            </p>

            <div className="pt-2 border-t border-slate-700/80 flex items-center justify-end gap-2 font-mono text-xs font-bold">
              <button
                onClick={() => setOperationToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 uppercase tracking-wider cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                onClick={() => confirmDeleteOperation(operationToDelete.id)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-900/40"
              >
                <Trash2 className="w-4 h-4" />
                <span>Endgültig löschen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Preview Lightbox Modal */}
      {snapshotPreviewModal && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-[5100] flex flex-col items-center justify-center p-4 animate-in fade-in"
          onClick={() => setSnapshotPreviewModal(null)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <a
              href={snapshotPreviewModal}
              download="lagekarte-snapshot.jpg"
              onClick={(e) => e.stopPropagation()}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-mono font-bold border border-slate-600 flex items-center gap-1.5 cursor-pointer shadow-xl"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Herunterladen</span>
            </a>
            <button
              type="button"
              onClick={() => setSnapshotPreviewModal(null)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 cursor-pointer shadow-xl"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            className="max-w-5xl max-h-[88vh] rounded-2xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-950 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
              <span className="text-purple-300 font-bold flex items-center gap-2">
                <Camera className="w-4 h-4" />
                <span>Gespeicherter Lagekarten-Screenshot (Abschluss)</span>
              </span>
              <span className="text-slate-400">Originalauflösung</span>
            </div>
            <img
              src={snapshotPreviewModal}
              alt="Lagekarten-Screenshot hochauflösend"
              className="max-h-[78vh] w-auto max-w-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}
      {/* Offizielles druckbares Einsatz- und Abschlussprotokoll für Behörden, Polizei und Verein */}
      {selectedOp && (
        <div id="printable-official-protocol" className="p-8 text-black bg-white space-y-6">
          {/* Header */}
          <div className="border-b-2 border-black pb-4 flex justify-between items-start">
            <div>
              <div className="text-xl font-black uppercase tracking-wider">
                Spürhunde-Salzlandkreis e.V.
              </div>
              <div className="text-xs text-gray-700 font-semibold">
                Rettungshunde, Mantrailing & Technische Ortung
              </div>
              <div className="text-[11px] text-gray-600 mt-1">
                Vereinsbüro: Hohe Straße 15, 06449 Aschersleben | Notruf / Leitstelle: 112 / 110
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black border border-black px-2.5 py-1 uppercase inline-block">
                Einsatz- & Abschluss-Protokoll
              </div>
              <div className="text-[10px] text-gray-600 mt-1 font-mono">
                Einsatz-ID: #{selectedOp.id.slice(-8).toUpperCase()}
              </div>
              <div className="text-[10px] text-gray-600 font-mono">
                Druckdatum: {new Date().toLocaleString('de-DE')}
              </div>
            </div>
          </div>

          {/* Einsatz-Stammdaten */}
          <div className="border border-black text-xs">
            <div className="bg-gray-100 font-bold px-3 py-1.5 border-b border-black uppercase text-[11px]">
              1. Einsatz-Stammdaten
            </div>
            <div className="grid grid-cols-2 p-3 gap-x-6 gap-y-1.5 leading-relaxed">
              <div>
                <span className="font-bold">Einsatzbezeichnung:</span> {selectedOp.title}
              </div>
              <div>
                <span className="font-bold">Einsatz-Art:</span>{' '}
                {selectedOp.type === 'exercise' ? 'Einsatzübung' : 'Realer Sucheinsatz'}
              </div>
              <div>
                <span className="font-bold">Einsatzleitung (Führung):</span> {selectedOp.commander}
              </div>
              <div>
                <span className="font-bold">Einsatzergebnis / Status:</span>{' '}
                <span className="font-bold uppercase">
                  {selectedOp.outcome || (selectedOp.status === 'completed' ? 'Einsatz beendet' : 'In Durchführung')}
                </span>
              </div>
              <div>
                <span className="font-bold">Alarmierung / Beginn:</span>{' '}
                {new Date(selectedOp.createdAt).toLocaleString('de-DE')}
              </div>
              <div>
                <span className="font-bold">Einsatzende:</span>{' '}
                {selectedOp.completedAt ? new Date(selectedOp.completedAt).toLocaleString('de-DE') : 'Laufend'}
              </div>
              <div>
                <span className="font-bold">Gesamtdauer:</span> {durationStr}
              </div>
              <div>
                <span className="font-bold">Einsatzkräfte gesamt:</span> {totalRespondersCount} Kräfte
              </div>
              <div className="col-span-2 pt-1 border-t border-gray-300">
                <span className="font-bold">Standort der EZ (EZ):</span>{' '}
                {selectedOp.headquartersLocation?.address || 'Vereinsbüro Hohe Straße 15, Aschersleben'}{' '}
                (GPS: {selectedOp.headquartersLocation?.lat?.toFixed(5) || '51.75696'},{' '}
                {selectedOp.headquartersLocation?.lng?.toFixed(5) || '11.45352'})
              </div>
            </div>
          </div>

          {/* Vermisste Person / Übungsobjekt */}
          <div className="border border-black text-xs print-no-break">
            <div className="bg-gray-100 font-bold px-3 py-1.5 border-b border-black uppercase text-[11px]">
              2. Vermisste Person / Übungsobjekt
            </div>
            <div className="grid grid-cols-2 p-3 gap-x-6 gap-y-1.5 leading-relaxed">
              <div>
                <span className="font-bold">Name:</span> {selectedOp.missingPerson?.name || 'Unbekannt'}
              </div>
              <div>
                <span className="font-bold">Alter / Geschlecht:</span>{' '}
                {selectedOp.missingPerson?.age || '-'} Jahre /{' '}
                {selectedOp.missingPerson?.gender === 'male'
                  ? 'Männlich'
                  : selectedOp.missingPerson?.gender === 'female'
                  ? 'Weiblich'
                  : 'Divers'}
              </div>
              <div className="col-span-2">
                <span className="font-bold">Letzter bekannter Aufenthaltsort (PLS):</span>{' '}
                {selectedOp.missingPerson?.lastSeenLocation?.address || 'Keine Adresse'}{' '}
                (GPS: {selectedOp.missingPerson?.lastSeenLocation?.lat},{' '}
                {selectedOp.missingPerson?.lastSeenLocation?.lng})
              </div>
              <div className="col-span-2">
                <span className="font-bold">Wohnanschrift:</span>{' '}
                {selectedOp.missingPerson?.homeAddress?.address || 'Keine Angabe'}
              </div>
              <div>
                <span className="font-bold">Bekleidung:</span>{' '}
                {selectedOp.missingPerson?.clothing || 'Keine Angabe'}
              </div>
              <div>
                <span className="font-bold">Notfallkontakt / Angehörige:</span>{' '}
                {selectedOp.missingPerson?.emergencyContact || 'Keine Angabe'}
              </div>
              <div>
                <span className="font-bold">Polizeiliche Vorgangsnummer:</span>{' '}
                {selectedOp.missingPerson?.policeCaseId || 'Nicht hinterlegt'}
              </div>
              <div>
                <span className="font-bold">Vorerkrankungen / Risikoprofil:</span>{' '}
                {selectedOp.missingPerson?.medicalConditions?.join(', ') || 'Keine bekannt'}
              </div>
              {selectedOp.missingPerson?.description && (
                <div className="col-span-2">
                  <span className="font-bold">Besondere Merkmale:</span>{' '}
                  {selectedOp.missingPerson.description}
                </div>
              )}
            </div>
          </div>

          {/* Stärkenachweis & eingesetzte Einheiten */}
          <div className="border border-black text-xs print-no-break">
            <div className="bg-gray-100 font-bold px-3 py-1.5 border-b border-black uppercase text-[11px] flex justify-between">
              <span>3. Stärkenachweis & eingesetzte Einheiten</span>
              <span>Gesamtstärke: {totalRespondersCount} Einsatzkräfte</span>
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-black bg-gray-50">
                  <th className="p-2 border-r border-black">Name</th>
                  <th className="p-2 border-r border-black">Funkrufname</th>
                  <th className="p-2 border-r border-black">KFZ-Kennzeichen</th>
                  <th className="p-2 border-r border-black">Funktion / Rolle</th>
                  <th className="p-2">Spezialausstattung / Hund</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((u, i) => (
                  <tr key={u.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-2 border-r border-black font-semibold">{u.name}</td>
                    <td className="p-2 border-r border-black font-mono">{u.callSign || '-'}</td>
                    <td className="p-2 border-r border-black font-mono">{u.licensePlate || '-'}</td>
                    <td className="p-2 border-r border-black">
                      {u.role === 'admin' ? 'Einsatzleitung (Führung)' : 'Suchkraft'}
                    </td>
                    <td className="p-2">
                      {u.dogInfo?.name
                        ? `🐕 ${u.dogInfo.name} (${u.dogInfo.breed || 'Rettungshund'}, ${u.dogInfo.qualification || 'Flächensuche'})`
                        : u.equipment?.map((eq) => EQUIPMENT_LABELS[eq]?.label || eq).join(', ') || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {externalVolunteersCount > 0 && (
              <div className="p-2 border-t border-black bg-gray-50 text-[11px]">
                <span className="font-bold">Externe Helfer / Freiwillige ohne App ({externalVolunteersCount}):</span>{' '}
                {selectedOp.externalVolunteersNotes || 'Als Unterstützungskräfte bei der Flächensuche eingesetzt.'}
              </div>
            )}
          </div>

          {/* Suchsektoren */}
          <div className="border border-black text-xs print-no-break">
            <div className="bg-gray-100 font-bold px-3 py-1.5 border-b border-black uppercase text-[11px]">
              4. Suchsektoren & Geländeflächen ({selectedOp.sectors?.length || 0})
            </div>
            {selectedOp.sectors && selectedOp.sectors.length > 0 ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black bg-gray-50">
                    <th className="p-2 border-r border-black">Sektor</th>
                    <th className="p-2 border-r border-black">Priorität</th>
                    <th className="p-2 border-r border-black">Status</th>
                    <th className="p-2 border-r border-black">Fläche</th>
                    <th className="p-2">Zugewiesene Einsatzkräfte</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOp.sectors.map((s, idx) => (
                    <tr key={s.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-2 border-r border-black font-bold font-mono">{s.name}</td>
                      <td className="p-2 border-r border-black uppercase text-[10px] font-bold">{s.priority}</td>
                      <td className="p-2 border-r border-black">
                        {s.status === 'searched' || (s.status as string) === 'completed'
                          ? 'Vollständig abgesucht'
                          : s.status === 'in_progress'
                          ? 'In Absuche'
                          : 'Offen'}
                      </td>
                      <td className="p-2 border-r border-black font-mono">
                        {s.areaM2 ? `${(s.areaM2 / 10000).toFixed(2)} ha (${Math.round(s.areaM2)} m²)` : '-'}
                      </td>
                      <td className="p-2">{s.assignedUserNames?.join(', ') || 'Nicht zugewiesen'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-3 text-gray-500 italic">Keine separaten Sektoren für diesen Einsatz definiert.</div>
            )}
          </div>

          {/* Funde */}
          {selectedOp.findings && selectedOp.findings.length > 0 && (
            <div className="border border-black text-xs print-no-break">
              <div className="bg-gray-100 font-bold px-3 py-1.5 border-b border-black uppercase text-[11px]">
                5. Dokumentierte Funde & Feststellungen ({selectedOp.findings.length})
              </div>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black bg-gray-50">
                    <th className="p-2 border-r border-black">Uhrzeit</th>
                    <th className="p-2 border-r border-black">Kategorie</th>
                    <th className="p-2 border-r border-black">Finder</th>
                    <th className="p-2 border-r border-black">GPS-Position</th>
                    <th className="p-2">Beschreibung</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOp.findings.map((f, idx) => (
                    <tr key={f.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-2 border-r border-black font-mono">
                        {new Date(f.timestamp).toLocaleTimeString('de-DE')}
                      </td>
                      <td className="p-2 border-r border-black font-bold uppercase text-[10px]">{f.category}</td>
                      <td className="p-2 border-r border-black">{f.userName}</td>
                      <td className="p-2 border-r border-black font-mono text-[10px]">
                        {f.location?.lat?.toFixed(5)}, {f.location?.lng?.toFixed(5)}
                      </td>
                      <td className="p-2 font-medium">{f.title}: {f.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Chronologisches Einsatztagebuch */}
          <div className="border border-black text-xs print-page-break">
            <div className="bg-gray-100 font-bold px-3 py-1.5 border-b border-black uppercase text-[11px] flex justify-between">
              <span>6. Lückenloses Chronologisches Einsatztagebuch (Protokoll)</span>
              <span>{selectedOp.logs?.length || 0} Protokolleinträge</span>
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-black bg-gray-50">
                  <th className="p-2 border-r border-black w-24">Uhrzeit</th>
                  <th className="p-2 border-r border-black w-28">Kategorie</th>
                  <th className="p-2 border-r border-black w-36">Verfasser / Funktion</th>
                  <th className="p-2">Ereignis / Meldung / Maßnahme</th>
                </tr>
              </thead>
              <tbody>
                {[...(selectedOp.logs || [])].reverse().map((log, idx) => (
                  <tr key={log.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-2 border-r border-black font-mono whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString('de-DE')}
                    </td>
                    <td className="p-2 border-r border-black uppercase text-[10px] font-bold">
                      {log.category}
                    </td>
                    <td className="p-2 border-r border-black whitespace-nowrap">
                      {log.authorName} ({log.authorRole === 'admin' ? 'EL' : 'Kraft'})
                    </td>
                    <td className="p-2 leading-relaxed">{log.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Chatverlauf */}
          <div className="border border-black text-xs print-page-break">
            <div className="bg-gray-100 font-bold px-3 py-1.5 border-b border-black uppercase text-[11px] flex justify-between">
              <span>7. Funk- und Chatprotokoll</span>
              <span>{selectedOp.archivedChatMessages?.length || 0} Meldungen</span>
            </div>
            {selectedOp.archivedChatMessages && selectedOp.archivedChatMessages.length > 0 ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black bg-gray-50">
                    <th className="p-2 border-r border-black w-24">Uhrzeit</th>
                    <th className="p-2 border-r border-black w-36">Absender (Funkrufname)</th>
                    <th className="p-2 border-r border-black w-28">Kanal</th>
                    <th className="p-2">Nachricht</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOp.archivedChatMessages.map((msg, idx) => {
                    const sender = allUsers.find(u => u.id === msg.senderId);
                    return (
                      <tr key={msg.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="p-2 border-r border-black font-mono whitespace-nowrap">
                          {new Date(msg.timestamp).toLocaleTimeString('de-DE')}
                        </td>
                        <td className="p-2 border-r border-black whitespace-nowrap font-bold">
                          {sender ? `${sender.name} (${sender.callSign})` : 'System'}
                        </td>
                        <td className="p-2 border-r border-black uppercase text-[10px] font-bold">
                          {msg.channel}
                        </td>
                        <td className={`p-2 leading-relaxed ${msg.isAlert ? 'text-red-600 font-bold' : ''}`}>
                          {msg.text}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-3 text-gray-500 italic">Kein Chatverlauf dokumentiert.</div>
            )}
          </div>

          {/* Kartensnapshot */}
          {selectedOp.mapSnapshot && (
            <div className="border border-black text-xs print-no-break">
              <div className="bg-gray-100 font-bold px-3 py-1.5 border-b border-black uppercase text-[11px]">
                8. Lagekarten-Übersicht (Abschluss-Snapshot)
              </div>
              <div className="p-3 flex justify-center">
                <img
                  src={selectedOp.mapSnapshot}
                  alt="Lagekarten-Snapshot"
                  className="max-h-80 w-auto border border-gray-400"
                />
              </div>
            </div>
          )}

          {/* Abschlussvermerk */}
          <div className="border border-black text-xs print-no-break">
            <div className="bg-gray-100 font-bold px-3 py-1.5 border-b border-black uppercase text-[11px]">
              9. Abschlussvermerk der Einsatzleitung
            </div>
            <div className="p-3 leading-relaxed whitespace-pre-wrap">
              {selectedOp.notes || 'Der Einsatz wurde ordnungsgemäß durchgeführt und abgeschlossen.'}
            </div>
          </div>

          {/* Unterschriftenzeile */}
          <div className="border border-black p-4 text-xs print-no-break space-y-4">
            <div className="font-bold uppercase text-[11px]">
              10. Formelle Bestätigung & Freigabe
            </div>
            <p className="text-[11px] text-gray-700">
              Hiermit wird die Richtigkeit und Vollständigkeit der vorstehenden Angaben und des Einsatztagebuchs
              zur Vorlage bei der zuständigen Polizeidienststelle, Rettungsleitstelle oder dem Vereinsvorstand
              bestätigt.
            </p>
            <div className="grid grid-cols-2 pt-8 gap-8">
              <div className="border-t border-black pt-2">
                <div>Ort, Datum: Aschersleben, den ____________________</div>
              </div>
              <div className="border-t border-black pt-2">
                <div>Unterschrift Einsatzleiter / Vorstand: _______________________________</div>
                <div className="text-[10px] text-gray-500 mt-1">({selectedOp.commander})</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
