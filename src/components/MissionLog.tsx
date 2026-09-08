import React, { useState } from 'react';
import { useRescue } from '../context/RescueContext';
import { OperationLogEntry } from '../types';
import {
  FileText,
  Clock,
  Shield,
  Search,
  Plus,
  Filter,
  CheckCircle,
  AlertTriangle,
  Send,
  Layers,
  Users,
  Camera,
  Eye,
  Download,
  X,
  MessageSquare,
  MapPin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const MissionLog: React.FC = () => {
  const { currentOperation, updateOperation, currentUser, chatMessages, findings } = useRescue();
  const [manualNote, setManualNote] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [showArchivedChat, setShowArchivedChat] = useState(false);

  if (!currentOperation) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-mono">
        Kein aktiver Einsatz ausgewählt.
      </div>
    );
  }

  const logs = currentOperation.logs || [];

  const relevantChat =
    (currentOperation.archivedChatMessages && currentOperation.archivedChatMessages.length > 0)
      ? currentOperation.archivedChatMessages
      : chatMessages.filter((m) => m.operationId === currentOperation.id);

  const opFindings = currentOperation.findings || findings.filter((f) => f.operationId === currentOperation.id);
  const tracksCount = currentOperation.archivedTracks?.length || 0;

  const filteredLogs = logs.filter((log) => {
    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter;
    const matchesSearch =
      log.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.authorName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualNote.trim()) return;

    const newLog: OperationLogEntry = {
      id: `log-${Date.now()}`,
      operationId: currentOperation.id,
      timestamp: new Date().toISOString(),
      authorName: currentUser?.name || 'Einsatzleitung',
      authorRole: currentUser?.role || 'admin',
      category: 'general',
      text: manualNote.trim(),
    };

    updateOperation(currentOperation.id, {
      logs: [newLog, ...logs],
    });

    setManualNote('');
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 text-black dark:text-slate-100 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#1E293B] border border-slate-300 dark:border-slate-700 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📑</span>
            <h1 className="text-base font-bold text-white uppercase tracking-wide">
              Einsatztagebuch & Protokoll
            </h1>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider ${
                currentOperation.status === 'active'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700'
                  : currentOperation.status === 'paused'
                  ? 'bg-slate-50 dark:bg-amber-950/80 text-amber-300 border border-amber-700'
                  : 'bg-blue-950/80 text-blue-300 border border-blue-700'
              }`}
            >
              {currentOperation.status === 'active'
                ? '🟢 Aktiv'
                : currentOperation.status === 'paused'
                ? '⏸️ Pausiert'
                : '🛑 Abgeschlossen'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
            Audit-feste Dokumentation aller Ereignisse, Suchspuren, Lagekarten-Snapshots und Funkmeldungen ({logs.length} Einträge)
          </p>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block font-mono">
            EINSATZLEITER VOM DIENST:
          </span>
          <span className="text-xs font-bold text-blue-400 font-mono">
            {currentOperation.commander}
          </span>
        </div>
      </div>

      {/* Preservation & Protocol Summary Card */}
      <div className="bg-[#1E293B]/90 border border-slate-300 dark:border-slate-700 rounded-2xl p-4 shadow-lg space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-700 pb-2.5">
          <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wider text-xs">
            <Layers className="w-4 h-4 text-blue-400" />
            <span>Dokumentierter Einsatzstand & Datenarchive</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Einsatz-ID: #{currentOperation.id.slice(-6).toUpperCase()}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">BEWEGUNGSPROFILE</span>
            <span className="text-sm font-bold text-cyan-400 mt-0.5 block">
              {tracksCount} {tracksCount === 1 ? 'Suchspur' : 'Suchspuren'}
            </span>
            <span className="text-[10px] text-slate-500">Linien auf Karte erhalten</span>
          </div>

          <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">FUNDE & HINWEISE</span>
            <span className="text-sm font-bold text-red-400 mt-0.5 block">
              {opFindings.length} {opFindings.length === 1 ? 'Fundmeldung' : 'Fundmeldungen'}
            </span>
            <span className="text-[10px] text-slate-500">Im Protokoll hinterlegt</span>
          </div>

          <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">FUNK- & CHATVERLAUF</span>
            <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
              {relevantChat.length} Funksprüche
            </span>
            <span className="text-[10px] text-slate-500">Lückenlos archiviert</span>
          </div>

          <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">LAGEKARTEN-SNAPSHOT</span>
            {currentOperation.mapSnapshotUrl ? (
              <button
                type="button"
                onClick={() => setSelectedSnapshot(currentOperation.mapSnapshotUrl || null)}
                className="mt-1 px-2 py-1 bg-purple-950/80 hover:bg-purple-900 border border-purple-700/70 text-purple-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer w-fit"
              >
                <Camera className="w-3 h-3 text-purple-300" />
                <span>Snapshot ansehen</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-500 mt-1">Wird bei Pause/Ende erzeugt</span>
            )}
          </div>
        </div>

        {/* Expandable Archived Chat / Radio Protocol */}
        {relevantChat.length > 0 && (
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowArchivedChat(!showArchivedChat)}
              className="flex items-center justify-between w-full py-1.5 px-2 rounded-lg bg-white dark:bg-slate-900/60 hover:bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-white transition cursor-pointer text-xs"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-bold">Archivierter Funk- und Chatverlauf ({relevantChat.length} Funksprüche)</span>
              </div>
              {showArchivedChat ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showArchivedChat && (
              <div className="mt-2.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 max-h-64 overflow-y-auto space-y-2 text-xs">
                {relevantChat.map((msg) => (
                  <div key={msg.id} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-cyan-300">{msg.senderName} ({msg.senderCallSign})</span>
                      <span className="text-slate-500 font-mono text-[10px]">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-900 dark:text-slate-200 font-sans">{msg.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Entry Form */}
      <form onSubmit={handleAddLog} className="bg-[#1E293B] border border-slate-300 dark:border-slate-700 p-4 rounded-2xl space-y-2 shadow-lg">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
          Manuellen Protokolleintrag erfassen (Einsatzdokumentation):
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            placeholder="z.B. Wetterumschwung: Nebel setzt ein, Drohnenflug vorübergehend ausgesetzt..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-black dark:text-slate-100 text-xs focus:outline-none focus:border-blue-500 placeholder-slate-500 font-mono"
          />
          <button
            type="submit"
            disabled={!manualNote.trim()}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5 shrink-0 uppercase tracking-wider font-mono"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Eintragen</span>
          </button>
        </div>
      </form>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#1E293B]/80 p-3 rounded-2xl border border-slate-300 dark:border-slate-700 text-xs font-mono">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tagebuch durchsuchen..."
          className="w-full sm:w-72 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-black dark:text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
        />

        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          {[
            { id: 'all', label: 'Alle' },
            { id: 'status', label: 'Lage & Status' },
            { id: 'pause', label: '⏸️ Pausen' },
            { id: 'end', label: '🛑 Abschluss' },
            { id: 'finding', label: '🚨 Funde' },
            { id: 'sector', label: '🎯 Sektoren' },
          ].map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer text-xs uppercase tracking-wider ${
                categoryFilter === c.id
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Entries */}
      <div className="space-y-3">
        {filteredLogs.map((log) => {
          const isFinding = log.category === 'finding' || log.text.includes('FUND');
          const isSector = log.category === 'sector';
          const isPause = log.category === 'pause' || log.text.includes('PAUSIERT');
          const isEnd = log.category === 'end' || log.text.includes('BEENDET');
          const isStatus = log.category === 'status';

          return (
            <div
              key={log.id}
              className={`p-4 rounded-2xl border transition shadow flex items-start gap-3.5 ${
                isFinding
                  ? 'bg-[#1E293B] border-red-500/60 ring-1 ring-red-500/20'
                  : isPause
                  ? 'bg-[#1E293B] border-amber-500/50 ring-1 ring-amber-500/20'
                  : isEnd
                  ? 'bg-[#1E293B] border-red-500/50'
                  : isSector
                  ? 'bg-[#1E293B] border-slate-300 dark:border-slate-700'
                  : isStatus
                  ? 'bg-[#1E293B] border-blue-500/40'
                  : 'bg-[#1E293B] border-slate-300 dark:border-slate-700'
              }`}
            >
              {/* Icon badge */}
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-base shrink-0 shadow ${
                  isFinding
                    ? 'bg-red-950 text-red-300 border border-red-600'
                    : isPause
                    ? 'bg-slate-50 dark:bg-amber-950 text-amber-300 border border-amber-600'
                    : isEnd
                    ? 'bg-red-950 text-red-300 border border-red-700'
                    : isSector
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    : 'bg-slate-50 dark:bg-slate-800 text-blue-400 border border-slate-300 dark:border-slate-700'
                }`}
              >
                {isFinding ? '🚨' : isPause ? '⏸️' : isEnd ? '🛑' : isSector ? '🎯' : isStatus ? '📢' : '📝'}
              </div>

              {/* Text, Meta & Snapshot */}
              <div className="flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white font-mono">{log.authorName}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-50 dark:bg-slate-800 text-blue-400 border border-slate-300 dark:border-slate-700">
                      {log.authorRole === 'admin' ? 'Einsatzleitung' : 'Sucher'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    🕒 {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-slate-900 dark:text-slate-200 leading-relaxed font-sans">{log.text}</p>

                {/* Attached Map Screenshot thumbnail */}
                {log.snapshotUrl && (
                  <div className="pt-2">
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-900/90 border border-purple-500/40 rounded-xl p-2.5">
                      <div
                        onClick={() => setSelectedSnapshot(log.snapshotUrl || null)}
                        className="h-16 w-24 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 shrink-0 cursor-pointer relative group bg-slate-100 dark:bg-slate-950"
                      >
                        <img
                          src={log.snapshotUrl}
                          alt="Lagekarte Snapshot"
                          className="h-full w-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="space-y-1 flex-1">
                        <div className="text-xs font-bold text-purple-300 font-mono flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5" />
                          <span>Lagekarten-Snapshot gespeichert</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">
                          Momentaufnahme aller Suchspuren, Sektoren und Funde zu diesem Zeitpunkt.
                        </p>
                        <button
                          type="button"
                          onClick={() => setSelectedSnapshot(log.snapshotUrl || null)}
                          className="text-[10px] text-purple-400 hover:text-purple-300 font-mono font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <span>🔍 In voller Auflösung öffnen</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Snapshot Preview Modal */}
      {selectedSnapshot && (
        <div className="fixed inset-0 z-[2200] flex items-center justify-center p-3 sm:p-5 bg-slate-100 dark:bg-slate-950/90 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#1E293B] border border-purple-500/50 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-white font-mono uppercase tracking-wide">
                  Lagekarten-Snapshot (Einsatzdokumentation)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={selectedSnapshot}
                  download={`lagekarte-snapshot-${currentOperation.id}.jpg`}
                  className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 border border-slate-400 dark:border-slate-600 rounded-lg text-xs font-mono font-bold transition text-slate-900 dark:text-slate-200 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedSnapshot(null)}
                  className="h-7 w-7 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-950 flex-1 overflow-auto flex items-center justify-center">
              <img
                src={selectedSnapshot}
                alt="Lagekarten-Snapshot"
                className="max-h-[75vh] w-auto object-contain rounded-lg border border-slate-200 dark:border-slate-800 shadow-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
