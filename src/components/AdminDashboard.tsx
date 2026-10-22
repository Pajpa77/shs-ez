import React, { useState } from 'react';
import { useRescue } from '../context/RescueContext';
import { isUserAdmin, isUserEL, isFirstAdmin, SearchOperation } from '../types';
import { getOpTheme } from './Navbar';
import { AppUpdateModal } from './AppUpdateModal';
import {
  Shield,
  Key,
  Plus,
  Edit,
  Play,
  Pause,
  Square,
  Users,
  Layers,
  FileText,
  Share2,
  RefreshCw,
  Navigation,
  Cloud,
  CloudOff,
  Compass,
  Radio,
  RadioTower,
  Video,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  UserPlus,
  Scan,
  Database,
  ExternalLink,
  RotateCcw,
  Trash2,
  Smartphone,
  Download,
} from 'lucide-react';

interface AdminDashboardProps {
  onOpenCreateOperation: () => void;
  onOpenEditOperation: (op?: SearchOperation) => void;
  onOpenEndOperation: () => void;
  onOpenPauseOperation: () => void;
  onOpenCreateUser: () => void;
  onOpenShareApp: () => void;
  onOpenOperationDetail: () => void;
  onNavigateToMap: () => void;
  onNavigateToSectors: () => void;
  onNavigateToResponders: () => void;
  onNavigateToLog: () => void;
  onNavigateToArchive: () => void;
  onNavigateToReports: () => void;
  onOpenUserListPdf?: () => void;
  showDroneFeed: boolean;
  setShowDroneFeed: (show: boolean) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onOpenCreateOperation,
  onOpenEditOperation,
  onOpenEndOperation,
  onOpenPauseOperation,
  onOpenCreateUser,
  onOpenShareApp,
  onOpenOperationDetail,
  onNavigateToMap,
  onNavigateToSectors,
  onNavigateToResponders,
  onNavigateToLog,
  onNavigateToArchive,
  onNavigateToReports,
  onOpenUserListPdf,
  showDroneFeed,
  setShowDroneFeed,
}) => {
  const {
    currentUser,
    currentOperation,
    allUsers,
    allOperations,
    isRealGpsActive,
    toggleRealGps,
    cloudSyncStatus,
    isRefreshing,
    refreshData,
    operationalRole,
    toggleOperationalRole,
    resumeOperation,
    updateOperation,
    setCurrentOperationId,
    deleteOperation,
    showConfirmModal,
  } = useRescue();

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  const isAdmin = isUserAdmin(currentUser);
  const isEL = isUserEL(currentUser);
  const isOwner = isFirstAdmin(currentUser);
  const isEZ = (currentUser?.operationalRole || operationalRole) === 'ez_command';

  if (!currentUser || !isAdmin) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-auto space-y-4 font-mono text-slate-200">
        <div className="w-14 h-14 rounded-2xl bg-red-950/80 border-2 border-red-500 text-red-400 flex items-center justify-center mx-auto text-2xl shadow-xl">
          🛡️
        </div>
        <h2 className="text-base font-bold text-white uppercase tracking-wider">Zugriff auf Admin-Zentrale beschränkt</h2>
        <p className="text-xs text-slate-400 leading-relaxed font-sans">
          Der Admin- und Leitstands-Zentralbereich steht ausschließlich gewählten Administratoren und der Einsatzleitung zur Verfügung.
        </p>
      </div>
    );
  }

  const activeOps = allOperations.filter((o) => o.status === 'active' || o.status === 'paused');
  const plannedOps = allOperations.filter((o) => o.status === 'planned');
  const activeResponders = allUsers.filter((u) => u.isActive);
  const inTransitResponders = activeResponders.filter((u) => u.arrivalStatus === 'in_transit');
  const ezReachedResponders = activeResponders.filter((u) => u.arrivalStatus === 'ez_reached');
  const readyResponders = activeResponders.filter((u) => u.arrivalStatus === 'ready');

  const currentTheme = getOpTheme(currentOperation, allOperations);

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-5 text-slate-100 font-sans select-none pb-24">
      {/* ── TOP ADMIN BANNER & ROLE INDICATOR ── */}
      <div className="bg-[#1E293B] border border-slate-700/80 p-4 sm:p-6 rounded-2xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border-2 border-blue-500/50 text-blue-400 flex items-center justify-center font-bold text-xl shrink-0 shadow-lg">
            🛡️
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black text-white uppercase tracking-wide font-mono">
                Admin- &amp; Leitstands-Zentrale
              </h1>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border shadow-sm ${
                isOwner
                  ? 'bg-amber-950/90 text-amber-300 border-amber-500'
                  : isEL
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-600'
                  : 'bg-blue-950/90 text-blue-300 border-blue-600'
              }`}>
                {isOwner ? '👑 First-Admin (Owner)' : isEL ? '⚡ Einsatzleitung & Admin' : '🛡️ System-Admin'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
              Angemeldet als: <strong className="text-white">{currentUser.name}</strong> ({currentUser.callSign})
            </p>
          </div>
        </div>

        {/* Dynamic Leadership Switcher Pill */}
        {currentOperation && currentOperation.status === 'active' && (
          <div className="w-full md:w-auto flex items-center justify-between sm:justify-end gap-3 bg-slate-900/90 border border-slate-700/80 p-2.5 rounded-xl font-mono text-xs shadow-inner">
            <div className="flex items-center gap-2">
              <span className="text-base">{isEZ ? '🏢' : '🚶'}</span>
              <div>
                <div className="font-bold text-white text-[11px]">
                  {isEZ ? 'Status: In der EZ' : 'Status: Sucher'}
                </div>
                <div className="text-[9px] text-slate-400">
                  {isEZ ? 'Pins aggregiert • Keine Linie' : 'Spur wird live aufgezeichnet'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleOperationalRole}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider transition cursor-pointer border shadow ${
                isEZ
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400'
              }`}
              title={isEZ ? 'Zu Sucher wechseln (Spur aufzeichnen)' : 'In die EZ wechseln (Spur pausieren)'}
            >
              {isEZ ? '🚶 Zu Sucher' : '🏢 Zu EZ'}
            </button>
          </div>
        )}
      </div>

      {/* ── SECTION 1: EINSATZ-STATUS & LEITSTAND-STEUERUNG ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Active Operation Overview Card */}
        <div className="lg:col-span-7 bg-[#1E293B] border border-slate-700 p-5 rounded-2xl shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-3 mb-3">
              <div className="flex items-center gap-2 font-mono font-bold text-xs uppercase text-slate-300">
                <span className="text-base">{currentTheme.emoji}</span>
                <span>Aktueller Einsatz</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border uppercase shadow ${currentTheme.badge}`}>
                {currentTheme.label}
              </span>
            </div>

            {currentOperation ? (
              <div className="space-y-3 font-mono">
                {currentOperation.status === 'planned' && (
                  <div className="bg-slate-800/90 border-2 border-white/70 rounded-xl p-3 flex items-center justify-between gap-2 text-xs shadow-md">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base shrink-0">⚪</span>
                      <div className="min-w-0">
                        <span className="font-bold text-white block">Einsatz angelegt (Noch nicht gestartet)</span>
                        <span className="text-[10px] text-slate-300 truncate block">Daten &amp; Sektoren können vorbereitet werden. Sobald die Suche beginnt: Starten!</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateOperation(currentOperation.id, { status: 'active' })}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase flex items-center gap-1 shadow cursor-pointer transition shrink-0"
                      title="Geplanten Einsatz jetzt starten"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Starten</span>
                    </button>
                  </div>
                )}

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white leading-snug">
                      {currentOperation.title}
                    </h3>
                    {currentOperation.missingPerson?.name && (
                      <p className="text-xs text-amber-300 mt-0.5 font-bold">
                        👤 Vermisste Person: {currentOperation.missingPerson.name} ({currentOperation.missingPerson.age || 'k.A.'} Jahre)
                      </p>
                    )}
                  </div>
                  {onOpenOperationDetail && (
                    <button
                      type="button"
                      onClick={onOpenOperationDetail}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-950/90 hover:bg-blue-900 text-blue-300 hover:text-white border border-blue-700/80 text-xs font-bold shrink-0 transition flex items-center gap-1 cursor-pointer shadow"
                      title="Einsatzdossier & Vermisstenprofil öffnen"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Dossier</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-700/60">
                    <span className="text-slate-400 block text-[9px] font-bold uppercase">EINSATZORT / PLS</span>
                    <span className="text-slate-200 font-bold truncate block">
                      {currentOperation.headquartersLocation?.address || currentOperation.searchAreaName || 'Vereinsbüro'}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-700/60">
                    <span className="text-slate-400 block text-[9px] font-bold uppercase">LEITUNG &amp; KADER</span>
                    <span className="text-slate-200 font-bold truncate block">
                      {currentOperation.commander || 'Einsatzleitung SHS'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 font-mono text-xs bg-slate-900/60 rounded-xl border border-dashed border-slate-700 space-y-2">
                <div className="text-2xl">⚪</div>
                <div className="font-bold text-white">Kein aktiver Einsatz</div>
                <p className="text-[11px] text-slate-400">
                  Die App befindet sich im Bereitschaftsmodus. Starten Sie einen neuen Einsatz über die Schaltfläche unten.
                </p>
              </div>
            )}
          </div>

          {/* Operation Control Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-700/80 font-mono">
            <button
              type="button"
              onClick={onOpenCreateOperation}
              className="py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Neuer Einsatz</span>
            </button>

            {currentOperation && (
              <button
                type="button"
                onClick={() => onOpenEditOperation(currentOperation)}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
                title="Einsatzdaten bearbeiten"
              >
                <Edit className="w-4 h-4" />
                <span>Editieren</span>
              </button>
            )}

            {currentOperation && currentOperation.status === 'planned' && (
              <button
                type="button"
                onClick={() => updateOperation(currentOperation.id, { status: 'active' })}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow uppercase"
                title="Geplanten Einsatz jetzt starten"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Starten</span>
              </button>
            )}

            {currentOperation && currentOperation.status === 'active' && (
              <button
                type="button"
                onClick={onOpenPauseOperation}
                className="py-2.5 px-3 bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
              >
                <Pause className="w-4 h-4" />
                <span>Pausieren</span>
              </button>
            )}

            {currentOperation && currentOperation.status === 'paused' && (
              <button
                type="button"
                onClick={() => resumeOperation(currentOperation.id)}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
              >
                <Play className="w-4 h-4" />
                <span>Fortsetzen</span>
              </button>
            )}

            {currentOperation && currentOperation.status === 'planned' ? (
              <button
                type="button"
                onClick={() => {
                  showConfirmModal({
                    title: 'Angelegten Einsatz entfernen',
                    message: `Möchten Sie den noch nicht gestarteten Einsatz "${currentOperation.title}" wieder entfernen?`,
                    confirmLabel: 'Einsatz entfernen',
                    isDanger: true,
                    onConfirm: () => {
                      deleteOperation(currentOperation.id);
                    },
                  });
                }}
                className="py-2.5 px-3 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow col-span-2 sm:col-span-1"
                title="Angelegten Einsatz entfernen"
              >
                <Trash2 className="w-4 h-4" />
                <span>Entfernen</span>
              </button>
            ) : currentOperation && currentOperation.status !== 'completed' ? (
              <button
                type="button"
                onClick={onOpenEndOperation}
                className="py-2.5 px-3 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow col-span-2 sm:col-span-1"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Beenden</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Fast Action Tiles Grid */}
        <div className="lg:col-span-5 bg-[#1E293B] border border-slate-700 p-5 rounded-2xl shadow-xl space-y-3 font-mono">
          <div className="text-xs font-bold uppercase text-slate-300 tracking-wider flex items-center gap-1.5 border-b border-slate-700/80 pb-2.5">
            <span>⚡</span>
            <span>Schnellzugriff Leitstand</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onNavigateToMap}
              className="p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/60 transition cursor-pointer text-left space-y-1 group shadow"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/40 flex items-center justify-center text-sm font-bold group-hover:scale-105 transition">
                🗺️
              </div>
              <div className="font-bold text-xs text-white">Lagekarte</div>
              <div className="text-[10px] text-slate-400">Live-Ortung &amp; Lagebild</div>
            </button>

            <button
              type="button"
              onClick={onNavigateToSectors}
              className="p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/60 transition cursor-pointer text-left space-y-1 group shadow"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-sm font-bold group-hover:scale-105 transition">
                🎯
              </div>
              <div className="font-bold text-xs text-white">Suchsektoren</div>
              <div className="text-[10px] text-slate-400">Flächen &amp; Gebiete zeichnen</div>
            </button>

            <button
              type="button"
              onClick={onOpenCreateUser}
              className="p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/60 transition cursor-pointer text-left space-y-1 group shadow"
            >
              <div className="w-7 h-7 rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center text-sm font-bold group-hover:scale-105 transition">
                👥
              </div>
              <div className="font-bold text-xs text-white">Accountverwaltung</div>
              <div className="text-[10px] text-slate-400">Helfer &amp; Rollen verwalten</div>
            </button>

            <button
              type="button"
              onClick={onNavigateToReports}
              className="p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/60 transition cursor-pointer text-left space-y-1 group shadow"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-600/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-sm font-bold group-hover:scale-105 transition">
                📋
              </div>
              <div className="font-bold text-xs text-white">Einsatzbericht PDF</div>
              <div className="text-[10px] text-slate-400">Export für Behörde/Polizei</div>
            </button>

            <button
              type="button"
              onClick={onOpenShareApp}
              className="p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/60 transition cursor-pointer text-left space-y-1 group shadow"
            >
              <div className="w-7 h-7 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/40 flex items-center justify-center text-sm font-bold group-hover:scale-105 transition">
                📱
              </div>
              <div className="font-bold text-xs text-white">App Teilen / QR</div>
              <div className="text-[10px] text-slate-400">Helfer vor Ort einladen</div>
            </button>

            {onOpenUserListPdf && (
              <button
                type="button"
                onClick={onOpenUserListPdf}
                className="p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/60 transition cursor-pointer text-left space-y-1 group shadow"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-sm font-bold group-hover:scale-105 transition">
                  🪪
                </div>
                <div className="font-bold text-xs text-white">Strichcode-Liste PDF</div>
                <div className="text-[10px] text-slate-400">Mitglieder &amp; Barcodes drucken</div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 1.5: ANGELEGTE & GEPLANTE EINSÄTZE (BEREITSCHAFT) ── */}
      {plannedOps.length > 0 && (
        <div className="bg-[#1E293B] border border-blue-500/40 p-4 sm:p-5 rounded-2xl shadow-xl space-y-3 font-mono">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-base">📋</span>
              <h2 className="text-sm font-bold uppercase text-white tracking-wide">
                Angelegte &amp; Geplante Einsätze in Bereitschaft ({plannedOps.length})
              </h2>
            </div>
            <span className="text-[10px] text-blue-300 bg-blue-950/80 border border-blue-700 px-2 py-0.5 rounded font-bold">
              Bereit zum Starten oder Bearbeiten
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plannedOps.map((op) => {
              const isSelected = currentOperation?.id === op.id;
              return (
                <div
                  key={op.id}
                  className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-blue-950/70 border-blue-500 shadow-md ring-1 ring-blue-500/40'
                      : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm truncate flex items-center gap-1.5">
                          <span>🐾</span>
                          <span className="truncate">{op.title}</span>
                        </div>
                        {op.missingPerson?.name && (
                          <div className="text-xs text-amber-300 font-bold truncate mt-0.5">
                            👤 Vermisst: {op.missingPerson.name} ({op.missingPerson.age || 'k.A.'} Jahre)
                          </div>
                        )}
                      </div>
                      <span className="px-2 py-0.5 text-[9px] rounded font-bold uppercase shrink-0 bg-blue-950 text-blue-300 border border-blue-800">
                        {isSelected ? 'Aktuell gewählt' : 'Geplant'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-0.5 pt-1">
                      <div>📍 Ort: {op.headquartersLocation?.address || op.searchAreaName || 'Vereinsbüro'}</div>
                      <div>🎖️ Leitung: {op.commander || 'Einsatzleitung'} • #{op.id.slice(-4).toUpperCase()}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        updateOperation(op.id, { status: 'active' });
                        setCurrentOperationId(op.id);
                      }}
                      className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow uppercase"
                      title="Geplanten Einsatz jetzt starten"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Starten</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenEditOperation(op)}
                      className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white border border-slate-700 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow"
                      title="Einsatz bearbeiten"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Bearbeiten</span>
                    </button>

                    {onOpenOperationDetail && (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentOperationId(op.id);
                          onOpenOperationDetail();
                        }}
                        className="py-1.5 px-2.5 bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-700/70 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow"
                        title="Vermisstendossier öffnen"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Dossier</span>
                      </button>
                    )}

                    {!isSelected && (
                      <button
                        type="button"
                        onClick={() => setCurrentOperationId(op.id)}
                        className="py-1.5 px-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow ml-auto"
                        title="Diesen Einsatz als aktuellen Leitstand-Einsatz auswählen"
                      >
                        <span>Auswählen</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SECTION 2: KRÄFTE- & EINTREFF-MONITOR ── */}
      <div className="bg-[#1E293B] border border-slate-700 p-5 rounded-2xl shadow-xl space-y-4 font-mono">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-bold uppercase text-white tracking-wide">
              Kräfte- &amp; Eintreff-Monitor ({activeResponders.length} aktiv)
            </h2>
          </div>
          <button
            type="button"
            onClick={onNavigateToResponders}
            className="text-xs text-blue-400 hover:text-white underline transition cursor-pointer flex items-center gap-1 font-bold"
          >
            <span>Kräfteliste öffnen</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Anfahrt */}
          <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">1. IN ANFAHRT</span>
              <span className="text-xl font-extrabold text-amber-400">
                {inTransitResponders.length} <span className="text-xs font-normal text-slate-400">Kräfte</span>
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-base border border-amber-500/40">
              🚗
            </div>
          </div>

          {/* Am EZ Eingetroffen */}
          <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">2. EZ EINGETROFFEN</span>
              <span className="text-xl font-extrabold text-blue-400">
                {ezReachedResponders.length} <span className="text-xs font-normal text-slate-400">Kräfte</span>
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-base border border-blue-500/40">
              🏢
            </div>
          </div>

          {/* Einsatzbereit / Im Feld */}
          <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">3. BEREIT / IM FELD</span>
              <span className="text-xl font-extrabold text-emerald-400">
                {readyResponders.length} <span className="text-xs font-normal text-slate-400">Kräfte</span>
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-base border border-emerald-500/40">
              ✅
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 1B: GESONDERT GESPEICHERTE / ANGELEGTE EINSÄTZE (VORBEREITUNG) ── */}
      {plannedOps.length > 0 && (
        <div className="bg-[#1E293B] border-2 border-white/40 p-5 rounded-2xl shadow-xl space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-white tracking-wide">
              <span className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.85)]" />
              <span>⚪ Angelegte Einsätze in Vorbereitung ({plannedOps.length})</span>
            </div>
            <span className="text-[10px] text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-500">
              Nicht gestartet • Gesondert vom Archiv
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plannedOps.map((op) => {
              const isSelected = currentOperation?.id === op.id;
              return (
                <div
                  key={op.id}
                  className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-slate-800/95 border-white shadow-lg'
                      : 'bg-slate-900/80 border-slate-600 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span>⚪</span>
                        <span className="text-xs font-bold text-white truncate">{op.title}</span>
                      </div>
                      <div className="text-[11px] text-slate-300 mt-1 truncate">
                        👤 Vermisst: {op.missingPerson?.name || 'Unbekannt'} • {op.sectors?.length || 0} Sektoren
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                        📍 {op.headquartersLocation?.address || 'Vereinsbüro'}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-800 text-white border border-slate-300 shrink-0">
                      Angelegt
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-700/80">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentOperationId(op.id);
                        updateOperation(op.id, { status: 'active' });
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer transition shadow"
                      title="Einsatz jetzt aktiv starten"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Starten</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrentOperationId(op.id);
                        onOpenEditOperation(op);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-amber-300 text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer transition border border-slate-500"
                      title="Einsatzdaten bearbeiten"
                    >
                      <Edit className="w-3 h-3" />
                      <span>Editieren</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrentOperationId(op.id);
                        onNavigateToMap();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 text-blue-300 text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer transition border border-blue-700"
                      title="Auf Lagekarte vorbereiten (Sektoren zeichnen)"
                    >
                      <span>🗺️ Karte</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        showConfirmModal({
                          title: 'Angelegten Einsatz entfernen',
                          message: `Möchten Sie den noch nicht gestarteten Einsatz "${op.title}" wieder entfernen?`,
                          confirmLabel: 'Entfernen',
                          isDanger: true,
                          onConfirm: () => {
                            deleteOperation(op.id);
                          },
                        });
                      }}
                      className="ml-auto px-2.5 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-900 text-red-300 text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer transition border border-red-800"
                      title="Angelegten Einsatz entfernen"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Entfernen</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SECTION 3: SYSTEM-, CLOUD- & TECHNIK-STATUS ── */}
      <div className="bg-[#1E293B] border border-slate-700 p-5 rounded-2xl shadow-xl space-y-4 font-mono">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-white tracking-wide">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Technik- &amp; Synchronisations-Status</span>
          </div>
          <span className="text-[10px] text-slate-400 font-normal">Release v6.6</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Cloud Sync Status */}
          <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">FIRESTORE CLOUD</span>
              <span className={`text-xs font-bold ${
                cloudSyncStatus === 'connected'
                  ? 'text-emerald-400'
                  : cloudSyncStatus === 'quota_exceeded'
                  ? 'text-amber-400'
                  : 'text-blue-400'
              }`}>
                {cloudSyncStatus === 'connected' ? '🟢 Verbunden' : cloudSyncStatus === 'quota_exceeded' ? '🟡 Quota Limit (Lokal)' : '🔵 Offline'}
              </span>
            </div>

            <button
              type="button"
              onClick={refreshData}
              disabled={isRefreshing}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-blue-300 transition cursor-pointer border border-slate-700 shrink-0"
              title="Manuelle Synchronisation erzwingen"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>

          {/* GPS Mode */}
          <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">GPS-MODUS</span>
              <span className="text-xs font-bold text-white">
                {isRealGpsActive ? '📡 Echtes GPS (Gerät)' : '🎯 Simulator-Modus'}
              </span>
            </div>

            <button
              type="button"
              onClick={toggleRealGps}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition cursor-pointer shrink-0 ${
                isRealGpsActive
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                  : 'bg-blue-950 text-blue-300 border-blue-600'
              }`}
            >
              {isRealGpsActive ? 'Echt' : 'Sim'}
            </button>
          </div>

          {/* Drohne / UAS Feed */}
          <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">DROHNEN-STREAM (UAS)</span>
              <span className="text-xs font-bold text-white">
                {showDroneFeed ? '🚁 Video-Stream aktiv' : 'Ausgeblendet'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowDroneFeed(!showDroneFeed)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition cursor-pointer shrink-0 ${
                showDroneFeed
                  ? 'bg-cyan-600 text-white border-cyan-400'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {showDroneFeed ? 'Aktiv' : 'Öffnen'}
            </button>
          </div>

          {/* APK & App-Updates via Firebase Storage */}
          <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">APK-UPDATES (FIREBASE)</span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span>shs-ea Bucket</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsUpdateModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition cursor-pointer shrink-0 bg-emerald-950 text-emerald-300 border-emerald-600 hover:bg-emerald-900 flex items-center gap-1"
              title="Aktuelle APK herunterladen oder Versions-Informationen prüfen"
            >
              <Download className="w-3 h-3" />
              <span>APK</span>
            </button>
          </div>
        </div>
      </div>
      <AppUpdateModal isOpen={isUpdateModalOpen} onClose={() => setIsUpdateModalOpen(false)} />
    </div>
  );
};

