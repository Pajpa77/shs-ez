import React, { useState } from 'react';
import { useYouth } from '../YouthContext';
import { YouthUser, YouthOperation } from '../types';
import { generateYouthDiplomaPDF } from '../youthPdfExport';
import { YouthMemberCardModal } from './YouthMemberCardModal';
import { YouthBarcodeScannerModal } from './YouthBarcodeScannerModal';
import { YouthMemberEditModal } from './YouthMemberEditModal';
import { YouthSectorManagerModal } from './YouthSectorManagerModal';
import { YouthScenarioManagerModal } from './YouthScenarioManagerModal';
import {
  Shield,
  Plus,
  Play,
  Pause,
  Square,
  Users,
  Compass,
  FileText,
  Trash2,
  Edit,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Phone,
  Key,
  RotateCcw,
  Sparkles,
  Award,
  Layers,
  Trophy,
  Scan,
} from 'lucide-react';

interface YouthAdminBoardProps {
  onNavigateToMap: () => void;
  onStartMapDrawing?: (sectorName: string, targetTeam: 'jugend' | 'erwachsene' | 'all') => void;
}

export const YouthAdminBoard: React.FC<YouthAdminBoardProps> = ({
  onNavigateToMap,
  onStartMapDrawing,
}) => {
  const {
    currentYouthUser,
    allYouthUsers,
    currentYouthOperation,
    allYouthOperations,
    activeYouthOperation,
    createYouthOperation,
    updateYouthOperation,
    startYouthOperation,
    pauseYouthOperation,
    resumeYouthOperation,
    endYouthOperation,
    deleteYouthOperation,
    createYouthUser,
    updateYouthUser,
    deleteYouthUser,
    setUserReady,
    scanBarcodeReady,
    selectOperation,
  } = useYouth();

  const [activeTab, setActiveTab] = useState<'exercise' | 'members' | 'archive'>('exercise');

  // Real Camera Barcode Modal
  const [isCameraBarcodeModalOpen, setIsCameraBarcodeModalOpen] = useState(false);

  // Member Edit / Create Modal
  const [editingMember, setEditingMember] = useState<YouthUser | null>(null);
  const [isMemberEditModalOpen, setIsMemberEditModalOpen] = useState(false);

  // Member Card Modal
  const [selectedMemberForCard, setSelectedMemberForCard] = useState<YouthUser | null>(null);

  // Sector Manager Modal
  const [isSectorManagerOpen, setIsSectorManagerOpen] = useState(false);

  // Scenario Manager Modal
  const [isScenarioManagerOpen, setIsScenarioManagerOpen] = useState(false);

  // Modal: New Exercise
  const [isNewOpModalOpen, setIsNewOpModalOpen] = useState(false);
  const [newOpTitle, setNewOpTitle] = useState('');
  const [newOpType, setNewOpType] = useState<'youth_only' | 'joint'>('youth_only');
  const [newOpLocation, setNewOpLocation] = useState('Vereinsgelände & Umgebung');
  const [newOpGoal, setNewOpGoal] = useState('Orientierung im Gelände, Funkübung & Fundanzeige');
  const [newOpTargetName, setNewOpTargetName] = useState('Übungspuppe Max');
  const [newOpTargetDesc, setNewOpTargetDesc] = useState('Übungspuppe mit gelber Warnweste');
  const [newOpGeofenceRadius, setNewOpGeofenceRadius] = useState<number>(1200);

  // Modal: Pause Reason
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('Besprechung & Trinkpause');

  // Modal: End Exercise
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [endNotes, setEndNotes] = useState('Übungsziel erfolgreich erreicht! Alle Kinder wohlauf.');

  const handleCreateExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpTitle.trim()) return;

    createYouthOperation({
      title: newOpTitle.trim(),
      type: newOpType,
      locationName: newOpLocation.trim() || 'Vereinsgelände',
      headquartersLocation: {
        lat: 51.798,
        lng: 11.74,
        address: `${newOpLocation.trim() || 'Vereinsgelände'} (Sammelpunkt / EZ)`,
      },
      geofenceRadiusMeters: Number(newOpGeofenceRadius) || 1200,
      trainingGoal: newOpGoal.trim() || 'Suchübung',
      missingTargetName: newOpTargetName.trim() || 'Übungspuppe Max',
      missingTargetDescription: newOpTargetDesc.trim() || 'Übungspuppe',
    });

    setIsNewOpModalOpen(false);
    setNewOpTitle('');
  };

  const handleSaveMember = (userData: Partial<YouthUser> & { id?: string }) => {
    if (userData.id) {
      updateYouthUser(userData.id, userData);
    } else {
      createYouthUser(userData as any);
    }
  };

  const currentOp = currentYouthOperation;

  // Toggle ready status helper
  const handleToggleReady = (userId: string, currentStatus?: string) => {
    const nextStatus = currentStatus === 'ready' ? 'in_transit' : 'ready';
    setUserReady(userId, nextStatus);
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-[#00083D] text-white p-3 sm:p-6 overflow-y-auto font-sans pb-28">
      {/* ── SEPARATER HEADER-BUTTON GANZ OBEN: NEUE ÜBUNG PLANEN ── */}
      <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-900 border border-cyan-400/50 shadow-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-xs sm:text-sm text-white block">
              Übungsorganisation &amp; Ablauf
            </span>
            <p className="text-[10px] text-cyan-200 font-mono">
              Neue Ausbildungs- oder Vergleichsübung anlegen
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsNewOpModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black font-mono text-xs uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer shadow-lg shrink-0 transform active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Neue Übung planen</span>
        </button>
      </div>

      {/* ── SECTION: KRÄFTE- & EINTREFF-MONITOR (WIE IN DER HAUPT-APP) ── */}
      <div className="mb-4 bg-[#000E66] border border-blue-900 p-4 sm:p-5 rounded-3xl shadow-xl space-y-3 font-mono">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-blue-900/80 pb-2.5">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <h3 className="text-xs sm:text-sm font-bold uppercase text-white tracking-wide">
              Kräfte- &amp; Eintreff-Monitor Jugend ({allYouthUsers.length} registriert)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className="text-[11px] text-cyan-300 hover:text-white underline transition cursor-pointer flex items-center gap-1 font-bold"
          >
            <span>Mitgliederliste öffnen</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Anfahrt / Wartend */}
          <div className="bg-[#00083D] p-3 rounded-2xl border border-blue-900/80 flex items-center justify-between">
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">1. IN ANFAHRT / WARTEND</span>
              <span className="text-lg font-black text-amber-400">
                {allYouthUsers.filter((u) => u.arrivalStatus === 'in_transit' || !u.arrivalStatus).length}{' '}
                <span className="text-[11px] font-normal text-slate-400">Kräfte</span>
              </span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm border border-amber-500/30">
              🚗
            </div>
          </div>

          {/* Sammelpunkt / EZ Erreicht */}
          <div className="bg-[#00083D] p-3 rounded-2xl border border-blue-900/80 flex items-center justify-between">
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">2. SAMMELPUNKT / EZ</span>
              <span className="text-lg font-black text-cyan-400">
                {allYouthUsers.filter((u) => u.arrivalStatus === 'ez_reached').length}{' '}
                <span className="text-[11px] font-normal text-slate-400">Kräfte</span>
              </span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm border border-cyan-500/30">
              🏢
            </div>
          </div>

          {/* Bereit / Im Feld (Tracking aktiv) */}
          <div className="bg-[#00083D] p-3 rounded-2xl border border-blue-900/80 flex items-center justify-between">
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">3. BEREIT / IM FELD</span>
              <span className="text-lg font-black text-emerald-400">
                {allYouthUsers.filter((u) => u.arrivalStatus === 'ready').length}{' '}
                <span className="text-[11px] font-normal text-slate-400">Kräfte</span>
              </span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/30">
              ✅
            </div>
          </div>
        </div>
      </div>

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-blue-900 pb-3 mb-4">
        <div>
          <h2 className="text-lg sm:text-2xl font-black text-amber-300 flex items-center gap-2 font-mono uppercase">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
            <span>Jugend-Adminboard</span>
          </h2>
          <p className="text-[11px] sm:text-xs text-blue-200 font-sans mt-0.5">
            Leitung &amp; Übungssteuerung durch {currentYouthUser?.name || 'Admin'}
          </p>
        </div>

        {/* Tab Switcher - Mobile optimized */}
        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-1 bg-[#000529] p-1 rounded-2xl border border-blue-900 text-[11px] font-mono font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('exercise')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'exercise'
                ? 'bg-amber-500 text-slate-950 shadow font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>🎯</span>
            <span>Übung</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'members'
                ? 'bg-cyan-500 text-slate-950 shadow font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>👥</span>
            <span>Mitglieder ({allYouthUsers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('archive')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'archive'
                ? 'bg-purple-600 text-white shadow font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>📂</span>
            <span>Archiv</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: ÜBUNGSSTEUERUNG ── */}
      {activeTab === 'exercise' && (
        <div className="space-y-4">
          {/* Active / Planned Op Card */}
          {currentOp ? (
            <div className="p-4 sm:p-6 rounded-3xl bg-[#000E66] border border-blue-900 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-900/80 pb-3">
                <div className="flex items-center gap-3">
                  <div className="text-2xl sm:text-3xl shrink-0">
                    {currentOp.type === 'joint' ? '🟣' : '🟡'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-full uppercase border ${
                          currentOp.status === 'active'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                            : currentOp.status === 'paused'
                            ? 'bg-orange-950 text-orange-300 border-orange-500'
                            : 'bg-slate-900 text-slate-300 border-slate-700'
                        }`}
                      >
                        {currentOp.status === 'active'
                          ? '● Aktiv'
                          : currentOp.status === 'paused'
                          ? '⏸ Pausiert'
                          : '⚪ Geplant'}
                      </span>
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-blue-950 text-cyan-300 border border-blue-800 uppercase">
                        {currentOp.type === 'joint' ? 'Gemeinsam' : 'Jugendübung'}
                      </span>
                      {currentOp.scenarioMode && (
                        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 uppercase">
                          {currentOp.scenarioMode === 'speed_challenge'
                            ? '⏱️ Zeit-Challenge'
                            : currentOp.scenarioMode === 'joint_teams'
                            ? '🤝 Teams'
                            : '🗺️ Sektoren'}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-white mt-1 truncate">
                      {currentOp.title}
                    </h3>
                  </div>
                </div>

                {/* Operations Selector */}
                <div className="w-full sm:w-auto">
                  <select
                    value={currentOp.id}
                    onChange={(e) => selectOperation(e.target.value)}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-[#00083D] border border-blue-800 text-xs font-mono text-cyan-300 focus:outline-none"
                  >
                    {allYouthOperations.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.title} ({op.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Op Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-sans">
                <div className="p-3 rounded-2xl bg-[#00083D] border border-blue-900/60">
                  <span className="text-[9px] text-slate-400 uppercase font-mono block">
                    📍 Treffpunkt / Gebiet:
                  </span>
                  <span className="font-bold text-white block mt-0.5 text-xs">
                    {currentOp.locationName}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-[#00083D] border border-blue-900/60">
                  <span className="text-[9px] text-slate-400 uppercase font-mono block">
                    🎯 Übungsziel:
                  </span>
                  <span className="font-bold text-white block mt-0.5 text-xs">
                    {currentOp.trainingGoal}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-[#00083D] border border-blue-900/60">
                  <span className="text-[9px] text-slate-400 uppercase font-mono block">
                    🧸 Gesuchtes Zielobjekt:
                  </span>
                  <span className="font-bold text-amber-300 block mt-0.5 text-xs">
                    {currentOp.missingTarget.name}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate">
                    {currentOp.missingTarget.description}
                  </span>
                </div>
              </div>

              {/* Status Controls */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-blue-900/80">
                {currentOp.status === 'planned' && (
                  <>
                    <button
                      type="button"
                      onClick={() => startYouthOperation(currentOp.id)}
                      className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase flex items-center justify-center gap-2 transition cursor-pointer shadow-lg"
                    >
                      <Play className="w-4 h-4" />
                      <span>▶️ Starten</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteYouthOperation(currentOp.id)}
                      className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-400 font-mono text-xs uppercase flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-700"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Entfernen</span>
                    </button>
                  </>
                )}

                {currentOp.status === 'active' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsPauseModalOpen(true)}
                      className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs uppercase flex items-center justify-center gap-2 transition cursor-pointer shadow-lg"
                    >
                      <Pause className="w-4 h-4" />
                      <span>Pausieren</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsEndModalOpen(true)}
                      className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-xs uppercase flex items-center justify-center gap-2 transition cursor-pointer shadow-lg"
                    >
                      <Square className="w-4 h-4" />
                      <span>Beenden</span>
                    </button>
                  </>
                )}

                {currentOp.status === 'paused' && (
                  <>
                    <button
                      type="button"
                      onClick={() => resumeYouthOperation(currentOp.id)}
                      className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase flex items-center justify-center gap-2 transition cursor-pointer shadow-lg"
                    >
                      <Play className="w-4 h-4" />
                      <span>Fortsetzen</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsEndModalOpen(true)}
                      className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-xs uppercase flex items-center justify-center gap-2 transition cursor-pointer shadow-lg"
                    >
                      <Square className="w-4 h-4" />
                      <span>Beenden</span>
                    </button>
                  </>
                )}

                {/* Scenario & Sector Manager Buttons */}
                <button
                  type="button"
                  onClick={() => setIsScenarioManagerOpen(true)}
                  className="px-3 py-2 rounded-xl bg-purple-900 hover:bg-purple-800 text-purple-200 border border-purple-500/50 font-bold font-mono text-[11px] uppercase flex items-center gap-1.5 transition cursor-pointer"
                  title="Szenario & Truppeinteilung anpassen"
                >
                  <Trophy className="w-3.5 h-3.5 text-purple-400" />
                  <span>Szenario</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSectorManagerOpen(true)}
                  className="px-3 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-cyan-200 border border-cyan-400/50 font-bold font-mono text-[11px] uppercase flex items-center gap-1.5 transition cursor-pointer"
                  title="Sektoren & Sicherheits-Grenze verwalten"
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Sektoren</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-3xl bg-[#000E66] border-2 border-dashed border-blue-700 text-center space-y-3">
              <span className="text-3xl block">🎯</span>
              <h3 className="text-sm font-bold text-white">Keine Übung vorhanden</h3>
              <p className="text-xs text-blue-200 max-w-md mx-auto">
                Erstelle eine neue Jugendübung oder gemeinsame Übung für die Spürhunde-Jugendgruppe.
              </p>
              <button
                type="button"
                onClick={() => setIsNewOpModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs uppercase transition cursor-pointer shadow-lg inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Neue Übung planen</span>
              </button>
            </div>
          )}

          {/* Sektoren & Trupps Übersicht */}
          {currentOp && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Sektoren-Kachel */}
              <div className="p-4 rounded-3xl bg-[#000E66] border border-blue-900 space-y-3">
                <div className="flex items-center justify-between border-b border-blue-900 pb-2.5">
                  <h4 className="text-xs font-bold text-white uppercase font-mono flex items-center gap-2">
                    <span>🗺️</span>
                    <span>Übungs-Sektoren ({currentOp.sectors.length})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsSectorManagerOpen(true)}
                    className="text-[11px] font-mono text-cyan-300 hover:underline cursor-pointer"
                  >
                    Verwalten
                  </button>
                </div>

                <div className="space-y-1.5">
                  {currentOp.sectors.map((sec) => (
                    <div
                      key={sec.id}
                      className="p-2.5 rounded-xl bg-[#00083D] border border-blue-900 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-white block truncate">{sec.name}</span>
                        <span className="text-[10px] text-cyan-300 font-mono">
                          Team: {sec.assignedTeam === 'jugend' ? '🎒 Jugend' : sec.assignedTeam === 'erwachsene' ? '🦺 Erwachsene' : '👥 Beide'}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded border uppercase shrink-0 ${
                          sec.status === 'searched'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                            : 'bg-blue-950 text-cyan-300 border-blue-700'
                        }`}
                      >
                        {sec.status === 'searched' ? 'Abgesucht' : 'Offen'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trupps-Kachel */}
              <div className="p-4 rounded-3xl bg-[#000E66] border border-blue-900 space-y-3">
                <div className="flex items-center justify-between border-b border-blue-900 pb-2.5">
                  <h4 className="text-xs font-bold text-white uppercase font-mono flex items-center gap-2">
                    <span>👥</span>
                    <span>Trupps &amp; Teams ({currentOp.squads?.length || 0})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsScenarioManagerOpen(true)}
                    className="text-[11px] font-mono text-amber-300 hover:underline cursor-pointer"
                  >
                    Anpassen
                  </button>
                </div>

                <div className="space-y-1.5">
                  {currentOp.squads && currentOp.squads.length > 0 ? (
                    currentOp.squads.map((sq) => (
                      <div
                        key={sq.id}
                        className="p-2.5 rounded-xl bg-[#00083D] border border-blue-900 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: sq.color }}
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-white block truncate">{sq.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {sq.memberIds.length} Mitglieder
                            </span>
                          </div>
                        </div>
                        {sq.targetFoundAt && (
                          <span className="text-[9px] font-mono text-amber-300 font-bold bg-amber-950 px-2 py-0.5 rounded border border-amber-600 shrink-0">
                            ⏱️ {sq.targetFoundAt}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">Keine separaten Trupps definiert.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: MITGLIEDERVERWALTUNG ── */}
      {activeTab === 'members' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs text-slate-300 font-mono">
              Registrierte Kinder &amp; Jugendliche (U18) — Akte, Notfallkontakte &amp; Ausweise
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCameraBarcodeModalOpen(true)}
                className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold font-mono text-xs uppercase flex items-center gap-1.5 transition cursor-pointer shadow"
              >
                <Scan className="w-4 h-4" />
                <span>Barcode-Scan / Bereit</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingMember(null);
                  setIsMemberEditModalOpen(true);
                }}
                className="px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs uppercase flex items-center gap-1.5 transition cursor-pointer shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Neues Mitglied</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allYouthUsers.map((member) => (
              <div
                key={member.id}
                className="p-3.5 rounded-2xl bg-[#000E66] border border-blue-900 flex flex-col justify-between gap-3 shadow hover:border-cyan-400/40 transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {member.photoUrl ? (
                        <img
                          src={member.photoUrl}
                          alt={member.name}
                          className="w-10 h-10 rounded-2xl object-cover border border-cyan-400 shadow shrink-0"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white text-base shadow border border-white/20 shrink-0"
                          style={{ backgroundColor: member.trackColor || '#38bdf8' }}
                        >
                          {member.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-bold text-sm text-white block leading-tight truncate">
                          {member.name}
                        </span>
                        <span className="text-[10px] text-cyan-300 font-mono truncate block">
                          {member.callSign} {member.age ? `(${member.age} J.)` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono bg-[#00083D] px-2 py-0.5 rounded-lg border border-blue-900 font-bold text-amber-300 block">
                        PIN: {member.pin}
                      </span>
                      {member.memberCardCode && (
                        <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                          {member.memberCardCode}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Profile Highlights / Tags */}
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {member.isSwimmer !== undefined && (
                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded-md border ${
                          member.isSwimmer
                            ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                            : 'bg-rose-950 text-rose-300 border-rose-700'
                        }`}
                      >
                        {member.isSwimmer ? '🏊 Schwimmer' : '⚠️ Nichtschwimmer'}
                      </span>
                    )}
                    {member.swimmingBadge && member.swimmingBadge !== 'Kein Abzeichen' && (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-blue-950 text-blue-300 border border-blue-800">
                        {member.swimmingBadge}
                      </span>
                    )}
                    {member.allergies && (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-700" title={member.allergies}>
                        ⚠️ Allergie
                      </span>
                    )}
                    {member.medications && (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-rose-950 text-rose-300 border border-rose-700" title={member.medications}>
                        💊 Medis
                      </span>
                    )}
                  </div>

                  {/* Emergency Contacts */}
                  <div className="mt-2.5 pt-2.5 border-t border-blue-900/60 space-y-1 text-xs text-slate-300">
                    {member.guardianContact && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">Notfallkontakt:</span>
                        <a
                          href={`tel:${member.guardianContact.replace(/[^0-9+]/g, '')}`}
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-300 hover:text-white bg-emerald-950/70 hover:bg-emerald-800 px-2 py-0.5 rounded border border-emerald-600 transition"
                          title="Eltern anrufen"
                        >
                          <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{member.guardianContact}</span>
                        </a>
                      </div>
                    )}
                    {member.phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">Handy d. Kindes:</span>
                        <span className="text-[11px] font-mono text-cyan-300">{member.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-blue-900 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Bereit Toggle Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleReady(member.id, member.arrivalStatus)}
                      className={`text-[9px] font-bold font-mono px-2 py-1 rounded transition cursor-pointer flex items-center gap-1 ${
                        member.arrivalStatus === 'ready'
                          ? 'bg-emerald-600 hover:bg-rose-700 text-white shadow'
                          : 'bg-blue-950 hover:bg-emerald-600 text-cyan-200 hover:text-white border border-cyan-400/50'
                      }`}
                      title={member.arrivalStatus === 'ready' ? 'Klicken zum Zurücknehmen' : 'Klicken zum Bereitstellen'}
                    >
                      {member.arrivalStatus === 'ready' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>✓ Bereit</span>
                        </>
                      ) : (
                        <span>🟢 Bereit</span>
                      )}
                    </button>

                    {/* Edit Profile Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMember(member);
                        setIsMemberEditModalOpen(true);
                      }}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition cursor-pointer"
                      title="Profil bearbeiten"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    {/* Ausweis anzeigen Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedMemberForCard(member)}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition cursor-pointer"
                      title="Dienstausweis anzeigen"
                    >
                      <span>🪪</span>
                    </button>

                    {/* Diplom Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const targetOp = currentOp || allYouthOperations[0];
                        generateYouthDiplomaPDF(member, targetOp, 2400);
                      }}
                      className="p-1 rounded-lg bg-amber-950 hover:bg-amber-800 text-amber-300 border border-amber-600 transition cursor-pointer"
                      title="Urkunde als PDF herunterladen"
                    >
                      <Award className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteYouthUser(member.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition cursor-pointer"
                    title="Mitglied entfernen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: ÜBUNGSARCHIV ── */}
      {activeTab === 'archive' && (
        <div className="space-y-3">
          <span className="text-xs text-slate-300 font-mono block">
            Vergangene und beendete Übungen der Jugendgruppe
          </span>

          <div className="space-y-2.5">
            {allYouthOperations
              .filter((op) => op.status === 'completed')
              .map((op) => (
                <div
                  key={op.id}
                  className="p-3.5 rounded-2xl bg-[#000E66] border border-blue-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-700 uppercase">
                        {op.type === 'joint' ? 'Gemeinsam' : 'Jugend'}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(op.createdAt).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                    <h4 className="font-bold text-white text-sm mt-1">{op.title}</h4>
                    <p className="text-xs text-blue-200 mt-0.5">{op.trainingGoal}</p>
                    {op.externalNotes && (
                      <p className="text-[11px] text-emerald-300 mt-1 italic">
                        Notiz: {op.externalNotes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => selectOperation(op.id)}
                      className="px-3 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-cyan-300 text-xs font-mono uppercase transition cursor-pointer"
                    >
                      Details ansehen
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Real Camera Barcode Scanner Modal */}
      {isCameraBarcodeModalOpen && (
        <YouthBarcodeScannerModal onClose={() => setIsCameraBarcodeModalOpen(false)} />
      )}

      {/* Member Edit / Create Modal */}
      <YouthMemberEditModal
        member={editingMember}
        isOpen={isMemberEditModalOpen}
        onClose={() => {
          setIsMemberEditModalOpen(false);
          setEditingMember(null);
        }}
        onSave={handleSaveMember}
      />

      {/* Member Card Modal */}
      <YouthMemberCardModal
        member={selectedMemberForCard}
        isOpen={Boolean(selectedMemberForCard)}
        onClose={() => setSelectedMemberForCard(null)}
      />

      {/* Sector Manager Modal */}
      <YouthSectorManagerModal
        isOpen={isSectorManagerOpen}
        onClose={() => setIsSectorManagerOpen(false)}
        onStartMapDrawing={(secName, team) => {
          if (onStartMapDrawing) {
            onStartMapDrawing(secName, team);
          }
        }}
      />

      {/* Scenario Manager Modal */}
      <YouthScenarioManagerModal
        isOpen={isScenarioManagerOpen}
        onClose={() => setIsScenarioManagerOpen(false)}
      />

      {/* New Op Modal */}
      {isNewOpModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-[#000E66] border border-cyan-400 rounded-3xl max-w-lg w-full p-5 sm:p-6 text-white space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-amber-300 font-mono uppercase">
              Neue Übung planen
            </h3>

            <form onSubmit={handleCreateExercise} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Übungs-Titel *</label>
                <input
                  type="text"
                  required
                  value={newOpTitle}
                  onChange={(e) => setNewOpTitle(e.target.value)}
                  placeholder="z.B. Frühjahrs-Suchübung Fasanengarten"
                  className="w-full px-3 py-2 rounded-xl bg-[#00083D] border border-blue-800 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Art der Übung</label>
                <select
                  value={newOpType}
                  onChange={(e) => setNewOpType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-[#00083D] border border-blue-800 text-white font-mono focus:outline-none focus:border-cyan-400"
                >
                  <option value="youth_only">🟡 Reine Jugendübung (nur U18 &amp; Leitung)</option>
                  <option value="joint">🟣 Gemeinsame Übung (Erwachsene vs. Jugend)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Treffpunkt / Ort</label>
                <input
                  type="text"
                  value={newOpLocation}
                  onChange={(e) => setNewOpLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#00083D] border border-blue-800 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Übungsziel</label>
                <input
                  type="text"
                  value={newOpGoal}
                  onChange={(e) => setNewOpGoal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#00083D] border border-blue-800 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1">Zu suchendes Ziel</label>
                  <input
                    type="text"
                    value={newOpTargetName}
                    onChange={(e) => setNewOpTargetName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#00083D] border border-blue-800 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Beschreibung</label>
                  <input
                    type="text"
                    value={newOpTargetDesc}
                    onChange={(e) => setNewOpTargetDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#00083D] border border-blue-800 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 flex items-center justify-between">
                  <span>Sicherheitsgrenze um EZ (Meter)</span>
                  <span className="text-cyan-300 font-mono font-bold">{newOpGeofenceRadius} m</span>
                </label>
                <input
                  type="range"
                  min={300}
                  max={5000}
                  step={100}
                  value={newOpGeofenceRadius}
                  onChange={(e) => setNewOpGeofenceRadius(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewOpModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-mono text-xs uppercase"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs uppercase"
                >
                  Übung planen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {isPauseModalOpen && currentOp && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-[#000E66] border border-amber-400 rounded-3xl max-w-sm w-full p-5 text-white space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-amber-300 font-mono uppercase">
              Übung pausieren
            </h3>
            <p className="text-xs text-slate-300">
              Bitte Grund für die Übungspause angeben:
            </p>
            <input
              type="text"
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#00083D] border border-blue-800 text-white text-xs focus:outline-none"
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPauseModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-mono text-xs uppercase"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  pauseYouthOperation(currentOp.id, pauseReason);
                  setIsPauseModalOpen(false);
                }}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs uppercase"
              >
                Pausieren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Modal */}
      {isEndModalOpen && currentOp && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-[#000E66] border border-rose-500 rounded-3xl max-w-sm w-full p-5 text-white space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-rose-300 font-mono uppercase">
              Übung beenden
            </h3>
            <p className="text-xs text-slate-300">
              Abschlussnotiz für das Jugendarchiv:
            </p>
            <textarea
              rows={3}
              value={endNotes}
              onChange={(e) => setEndNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#00083D] border border-blue-800 text-white text-xs focus:outline-none"
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEndModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-mono text-xs uppercase"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  endYouthOperation(currentOp.id, endNotes);
                  setIsEndModalOpen(false);
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-xs uppercase"
              >
                Beenden
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
