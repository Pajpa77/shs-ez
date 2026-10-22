import React, { useState, useRef, useMemo } from 'react';
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
  Wifi,
  WifiOff,
  Search,
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
    isExerciseActive,
    isExercisePaused,
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

  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'exercise' | 'members' | 'archive'>('exercise');
  const [memberFilter, setMemberFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [memberSearch, setMemberSearch] = useState('');

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

  // Modal: New / Edit Exercise
  const [isNewOpModalOpen, setIsNewOpModalOpen] = useState(false);
  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [newOpTitle, setNewOpTitle] = useState('');
  const [newOpType, setNewOpType] = useState<'youth_only' | 'joint'>('youth_only');
  const [newOpLocation, setNewOpLocation] = useState('Vereinsgelände & Umgebung');
  const [newOpHqLat, setNewOpHqLat] = useState<number>(51.798);
  const [newOpHqLng, setNewOpHqLng] = useState<number>(11.74);
  const [isGeocodingLocation, setIsGeocodingLocation] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'success' | 'not_found'>('idle');
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

  const handleOpenNewExercise = () => {
    setEditingOpId(null);
    setNewOpTitle('');
    setNewOpType('youth_only');
    setNewOpLocation('Vereinsgelände & Umgebung');
    setNewOpHqLat(51.798);
    setNewOpHqLng(11.74);
    setNewOpGoal('Orientierung im Gelände, Funkübung & Fundanzeige');
    setNewOpTargetName('Übungspuppe Max');
    setNewOpTargetDesc('Übungspuppe mit gelber Warnweste');
    setNewOpGeofenceRadius(1200);
    setGeocodeStatus('idle');
    setIsNewOpModalOpen(true);
  };

  const handleOpenEditExercise = (op: YouthOperation) => {
    setEditingOpId(op.id);
    setNewOpTitle(op.title);
    setNewOpType(op.type);
    setNewOpLocation(op.locationName);
    setNewOpHqLat(op.headquartersLocation?.lat || 51.798);
    setNewOpHqLng(op.headquartersLocation?.lng || 11.74);
    setNewOpGoal(op.trainingGoal);
    setNewOpTargetName(op.missingTarget.name);
    setNewOpTargetDesc(op.missingTarget.description);
    setNewOpGeofenceRadius(op.geofenceRadiusMeters || 1200);
    setGeocodeStatus('idle');
    setIsNewOpModalOpen(true);
  };

  const handleGeocodeLocation = async () => {
    if (!newOpLocation.trim()) return;
    setIsGeocodingLocation(true);
    setGeocodeStatus('idle');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          newOpLocation.trim() + ', Salzlandkreis, Sachsen-Anhalt'
        )}&limit=1`,
        { headers: { 'Accept-Language': 'de' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const lat = Number(Number(data[0].lat).toFixed(6));
          const lng = Number(Number(data[0].lon).toFixed(6));
          setNewOpHqLat(lat);
          setNewOpHqLng(lng);
          setGeocodeStatus('success');
        } else {
          setGeocodeStatus('not_found');
        }
      } else {
        setGeocodeStatus('not_found');
      }
    } catch {
      setGeocodeStatus('not_found');
    } finally {
      setIsGeocodingLocation(false);
    }
  };

  const handleUseCurrentGps = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setNewOpHqLat(Number(pos.coords.latitude.toFixed(6)));
          setNewOpHqLng(Number(pos.coords.longitude.toFixed(6)));
          setGeocodeStatus('success');
        },
        () => setGeocodeStatus('not_found'),
        { timeout: 8000 }
      );
    }
  };

  const handleCreateOrUpdateExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpTitle.trim()) return;

    const opData = {
      title: newOpTitle.trim(),
      type: newOpType,
      locationName: newOpLocation.trim() || 'Vereinsgelände',
      headquartersLocation: {
        lat: newOpHqLat,
        lng: newOpHqLng,
        address: `${newOpLocation.trim() || 'Treffpunkt'} (EZ)`,
      },
      geofenceRadiusMeters: Number(newOpGeofenceRadius) || 1200,
      trainingGoal: newOpGoal.trim() || 'Suchübung',
      missingTargetName: newOpTargetName.trim() || 'Übungspuppe Max',
      missingTargetDescription: newOpTargetDesc.trim() || 'Übungspuppe',
    };

    if (editingOpId) {
      updateYouthOperation(editingOpId, {
        title: opData.title,
        type: opData.type,
        locationName: opData.locationName,
        headquartersLocation: opData.headquartersLocation,
        geofenceRadiusMeters: opData.geofenceRadiusMeters,
        trainingGoal: opData.trainingGoal,
        missingTarget: {
          name: opData.missingTargetName,
          description: opData.missingTargetDescription,
          isFound: false,
        },
      });
    } else {
      createYouthOperation(opData);
    }

    setIsNewOpModalOpen(false);
    setEditingOpId(null);
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

  // Online / Logged-in calculations
  const onlineUsers = useMemo(() => allYouthUsers.filter((u) => u.isActive), [allYouthUsers]);
  const offlineUsers = useMemo(() => allYouthUsers.filter((u) => !u.isActive), [allYouthUsers]);
  const inTransitCount = useMemo(
    () => allYouthUsers.filter((u) => u.arrivalStatus === 'in_transit' || !u.arrivalStatus).length,
    [allYouthUsers]
  );
  const ezReachedCount = useMemo(
    () => allYouthUsers.filter((u) => u.arrivalStatus === 'ez_reached').length,
    [allYouthUsers]
  );
  const readyCount = useMemo(
    () => allYouthUsers.filter((u) => u.arrivalStatus === 'ready').length,
    [allYouthUsers]
  );

  const filteredMembers = useMemo(() => {
    return allYouthUsers.filter((member) => {
      if (memberFilter === 'online' && !member.isActive) return false;
      if (memberFilter === 'offline' && member.isActive) return false;
      if (memberSearch.trim()) {
        const query = memberSearch.toLowerCase().trim();
        const matchesName = member.name.toLowerCase().includes(query);
        const matchesCallSign = member.callSign.toLowerCase().includes(query);
        const matchesCode = (member.memberCardCode || '').toLowerCase().includes(query);
        return matchesName || matchesCallSign || matchesCode;
      }
      return true;
    });
  }, [allYouthUsers, memberFilter, memberSearch]);

  const handleOpenMembersTab = (filter: 'all' | 'online' | 'offline' = 'all') => {
    setMemberFilter(filter);
    setActiveTab('members');
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full flex-1 flex flex-col bg-[#00083D] text-white p-3 sm:p-6 overflow-y-auto font-sans pb-36 min-h-0"
    >
      {/* ── 1. PROMINENTES ÜBUNGS-STATUSBANNER (RULE 5: 🟡 GELB / 🟣 LILA / ⚪ WEISS / 🟠 ORANGE) ── */}
      <div
        className={`mb-4 p-4 sm:p-5 rounded-3xl border-2 shadow-2xl transition-all ${
          !currentOp
            ? 'bg-slate-900/90 border-slate-600 text-slate-300'
            : currentOp.status === 'active'
            ? currentOp.type === 'joint'
              ? 'bg-gradient-to-r from-purple-950 via-indigo-950 to-purple-950 border-purple-400 text-purple-100 shadow-purple-900/40'
              : 'bg-gradient-to-r from-amber-950 via-yellow-950 to-amber-950 border-amber-400 text-amber-100 shadow-amber-900/40'
            : currentOp.status === 'paused'
            ? 'bg-gradient-to-r from-orange-950 via-amber-950 to-orange-950 border-orange-500 text-orange-100 shadow-orange-900/40'
            : 'bg-slate-900/95 border-slate-300 text-white shadow-slate-900/60'
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5">
          <div className="flex items-start sm:items-center gap-3">
            <div className="text-3xl sm:text-4xl shrink-0 p-2 rounded-2xl bg-black/30 border border-white/10">
              {!currentOp
                ? '⚪'
                : currentOp.status === 'active'
                ? currentOp.type === 'joint'
                  ? '🟣'
                  : '🟡'
                : currentOp.status === 'paused'
                ? '🟠'
                : '⚪'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-[10px] sm:text-xs font-mono font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border shadow-sm ${
                    !currentOp
                      ? 'bg-slate-800 text-slate-300 border-slate-600'
                      : currentOp.status === 'active'
                      ? currentOp.type === 'joint'
                        ? 'bg-purple-900 text-purple-200 border-purple-400 animate-pulse'
                        : 'bg-yellow-900 text-yellow-200 border-yellow-400 animate-pulse'
                      : currentOp.status === 'paused'
                      ? 'bg-orange-900 text-orange-200 border-orange-400'
                      : 'bg-slate-800 text-slate-200 border-slate-400'
                  }`}
                >
                  {!currentOp
                    ? '⚪ Bereitschaft (Keine Übung)'
                    : currentOp.status === 'active'
                    ? currentOp.type === 'joint'
                      ? '● GEMEINSAME ÜBUNG AKTIV (Erwachsene vs. Jugend)'
                      : '● JUGENDÜBUNG AKTIV (Nur Jugend)'
                    : currentOp.status === 'paused'
                    ? `⏸ ÜBUNG PAUSIERT (${currentOp.pausedReason || 'Pause'})`
                    : '⚪ GEPLANTE ÜBUNG (Noch nicht gestartet)'}
                </span>

                {currentOp && (
                  <span className="text-[10px] font-mono text-cyan-300 bg-blue-950 px-2 py-0.5 rounded border border-blue-800">
                    📍 {currentOp.locationName}
                  </span>
                )}
              </div>

              <h2 className="text-base sm:text-xl font-black text-white mt-1 leading-snug">
                {currentOp ? currentOp.title : 'Aktuell keine Jugendübung angelegt'}
              </h2>

              <p className="text-[11px] sm:text-xs text-blue-200/90 mt-0.5 font-sans">
                {!currentOp
                  ? 'Erstelle eine neue Übung über den Button rechts, um Sektoren zu planen und Suchspuren aufzuzeichnen.'
                  : currentOp.status === 'active'
                  ? 'GPS-Suchspuraufzeichnung läuft live für alle bereiten Kräfte. Ortung und Funk aktiv.'
                  : currentOp.status === 'paused'
                  ? 'GPS-Aufzeichnung vorübergehend angehalten. Kräfte verharren oder sammeln sich.'
                  : 'Bereitstellungs- & Suchspurtracking werden erst mit Klick auf "▶️ Starten" freigeschaltet.'}
              </p>
            </div>
          </div>

          {/* Quick Actions in Status Banner */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/10">
            {currentOp?.status === 'planned' && (
              <button
                type="button"
                onClick={() => startYouthOperation(currentOp.id)}
                className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-black font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-lg transform active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>▶️ Übung starten</span>
              </button>
            )}

            {currentOp?.status === 'active' && (
              <>
                <button
                  type="button"
                  onClick={() => setIsPauseModalOpen(true)}
                  className="flex-1 md:flex-initial px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs uppercase flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
                >
                  <Pause className="w-4 h-4" />
                  <span>Pausieren</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEndModalOpen(true)}
                  className="flex-1 md:flex-initial px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-xs uppercase flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
                >
                  <Square className="w-4 h-4" />
                  <span>Beenden</span>
                </button>
              </>
            )}

            {currentOp?.status === 'paused' && (
              <>
                <button
                  type="button"
                  onClick={() => resumeYouthOperation(currentOp.id)}
                  className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase flex items-center justify-center gap-2 transition cursor-pointer shadow-lg"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Fortsetzen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEndModalOpen(true)}
                  className="flex-1 md:flex-initial px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-xs uppercase flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
                >
                  <Square className="w-4 h-4" />
                  <span>Beenden</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setIsNewOpModalOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black font-mono text-xs uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer shadow-lg transform active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Neue Übung planen</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. KRÄFTE-, EINTREFF- & ONLINE-MONITOR ── */}
      <div className="mb-4 bg-[#000E66] border border-blue-900 p-4 sm:p-5 rounded-3xl shadow-xl space-y-3 font-mono">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-blue-900/80 pb-2.5">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <h3 className="text-xs sm:text-sm font-bold uppercase text-white tracking-wide">
              Kräfte- &amp; Anwesenheits-Monitor ({allYouthUsers.length} registriert)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => handleOpenMembersTab('all')}
            className="text-[11px] text-cyan-300 hover:text-white underline transition cursor-pointer flex items-center gap-1 font-bold"
          >
            <span>Mitgliederliste öffnen</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* ONLINE / EINGELOGGT BOX */}
          <div
            onClick={() => handleOpenMembersTab('online')}
            className="bg-[#00083D] p-3 rounded-2xl border border-blue-900/80 hover:border-emerald-500/50 transition cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-emerald-400 font-bold uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE / EINGELOGGT
              </span>
              <span className="text-xs font-mono text-emerald-300 font-bold">
                {onlineUsers.length} / {allYouthUsers.length}
              </span>
            </div>
            <div className="my-1.5">
              <span className="text-lg font-black text-emerald-400">
                {onlineUsers.length}{' '}
                <span className="text-[11px] font-normal text-slate-400">Kinder aktiv</span>
              </span>
            </div>
            <div className="text-[10px] text-slate-300 flex flex-wrap gap-1">
              {onlineUsers.length > 0 ? (
                onlineUsers.slice(0, 3).map((u) => (
                  <span
                    key={u.id}
                    className="bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-1.5 py-0.5 rounded text-[9px] font-bold"
                  >
                    {u.name.split(' ')[0]}
                  </span>
                ))
              ) : (
                <span className="text-slate-500 italic">Kein Kind eingeloggt</span>
              )}
              {onlineUsers.length > 3 && (
                <span className="text-slate-400 text-[9px]">+{onlineUsers.length - 3} weitere</span>
              )}
            </div>
          </div>

          {/* Anfahrt / Wartend */}
          <div
            onClick={() => handleOpenMembersTab('all')}
            className="bg-[#00083D] p-3 rounded-2xl border border-blue-900/80 hover:border-amber-500/50 transition cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-slate-400 font-bold uppercase">1. IN ANFAHRT / WARTEND</span>
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs border border-amber-500/30">
                🚗
              </div>
            </div>
            <div className="my-1.5">
              <span className="text-lg font-black text-amber-400">
                {inTransitCount}{' '}
                <span className="text-[11px] font-normal text-slate-400">Kräfte</span>
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Noch auf dem Weg</span>
          </div>

          {/* Sammelpunkt / EZ Erreicht */}
          <div
            onClick={() => handleOpenMembersTab('all')}
            className="bg-[#00083D] p-3 rounded-2xl border border-blue-900/80 hover:border-cyan-500/50 transition cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-slate-400 font-bold uppercase">2. SAMMELPUNKT / EZ</span>
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs border border-cyan-500/30">
                🏢
              </div>
            </div>
            <div className="my-1.5">
              <span className="text-lg font-black text-cyan-400">
                {ezReachedCount}{' '}
                <span className="text-[11px] font-normal text-slate-400">Kräfte</span>
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Vor Ort eingetroffen</span>
          </div>

          {/* Bereit / Im Feld */}
          <div
            onClick={() => handleOpenMembersTab('all')}
            className="bg-[#00083D] p-3 rounded-2xl border border-blue-900/80 hover:border-emerald-500/50 transition cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-emerald-400 font-bold uppercase">3. BEREIT / IM FELD</span>
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/30">
                ✅
              </div>
            </div>
            <div className="my-1.5">
              <span className="text-lg font-black text-emerald-400">
                {readyCount}{' '}
                <span className="text-[11px] font-normal text-slate-400">Kräfte</span>
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              {isExerciseActive ? 'GPS-Spuraufzeichnung läuft' : 'Wartet auf Übungsstart'}
            </span>
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
            onClick={() => handleOpenMembersTab('all')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'members'
                ? 'bg-cyan-500 text-slate-950 shadow font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>👥</span>
            <span>Mitglieder ({allYouthUsers.length})</span>
            {onlineUsers.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
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
                      onClick={() => handleOpenEditExercise(currentOp)}
                      className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-xs uppercase flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg"
                      title="Angelegte Übung bearbeiten"
                    >
                      <Edit className="w-4 h-4" />
                      <span>✏️ Bearbeiten</span>
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
                onClick={handleOpenNewExercise}
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
        <div className="space-y-3.5 animate-fadeIn">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#000E66] border border-blue-900">
            <div>
              <span className="text-xs sm:text-sm font-bold text-white block">
                Jugend-Kräfte &amp; Mitgliederverwaltung (U18)
              </span>
              <p className="text-[10px] text-cyan-300 font-mono mt-0.5">
                {allYouthUsers.length} registriert • {onlineUsers.length} aktuell online &amp; eingeloggt
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
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

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Name, Funkrufname oder Ausweis-Code suchen..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#00083D] border border-blue-900 text-xs text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1 bg-[#00083D] p-1 rounded-xl border border-blue-900 font-mono text-[11px] font-bold shrink-0">
              <button
                type="button"
                onClick={() => setMemberFilter('all')}
                className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                  memberFilter === 'all'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Alle ({allYouthUsers.length})
              </button>
              <button
                type="button"
                onClick={() => setMemberFilter('online')}
                className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                  memberFilter === 'online'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-emerald-400 hover:text-emerald-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Online ({onlineUsers.length})
              </button>
              <button
                type="button"
                onClick={() => setMemberFilter('offline')}
                className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                  memberFilter === 'offline'
                    ? 'bg-slate-700 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Offline ({offlineUsers.length})
              </button>
            </div>
          </div>

          {/* Members Cards Grid */}
          {filteredMembers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredMembers.map((member) => {
                const isReady = member.arrivalStatus === 'ready';
                const canSetReady = isExerciseActive && member.isActive;

                return (
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

                      {/* Online Status & Tags */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1">
                        {member.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-600 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Online (Eingeloggt)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-slate-900 text-slate-400 border border-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            Offline
                          </span>
                        )}

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
                        {member.allergies && (
                          <span
                            className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-700"
                            title={member.allergies}
                          >
                            ⚠️ Allergie
                          </span>
                        )}
                        {member.medications && (
                          <span
                            className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-rose-950 text-rose-300 border border-rose-700"
                            title={member.medications}
                          >
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

                    <div className="flex items-center justify-between pt-2.5 border-t border-blue-900 text-xs gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Bereit Toggle Button with strict guards (Grün durchgehend) */}
                        <button
                          type="button"
                          onClick={() => handleToggleReady(member.id, member.arrivalStatus)}
                          disabled={!isReady && !canSetReady}
                          className={`text-[9px] font-bold font-mono px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 ${
                            isReady
                              ? 'bg-emerald-700 hover:bg-rose-700 text-white font-bold border-2 border-emerald-300 shadow-lg cursor-pointer'
                              : !isExerciseActive
                              ? 'bg-slate-900 text-slate-500 border border-slate-800 opacity-60 cursor-not-allowed'
                              : !member.isActive
                              ? 'bg-slate-900 text-slate-500 border border-slate-800 opacity-60 cursor-not-allowed'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold border border-emerald-400 cursor-pointer shadow-md'
                          }`}
                          title={
                            isReady
                              ? 'Klicken zum Zurücknehmen'
                              : !isExerciseActive
                              ? 'Übung muss zuerst gestartet werden!'
                              : !member.isActive
                              ? 'Kind ist noch nicht in der App angemeldet (offline)!'
                              : 'Klicken zum Bereitstellen (GPS-Suchspur startet)'
                          }
                        >
                          {isReady ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>✓ Bereit (Aktiv)</span>
                            </>
                          ) : !isExerciseActive ? (
                            <span>⚠️ Erst bei aktiver Übung</span>
                          ) : !member.isActive ? (
                            <span>⚪ Erst nach Login (Offline)</span>
                          ) : (
                            <span>🟢 Bereitstellen</span>
                          )}
                        </button>

                        {/* Edit Profile Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMember(member);
                            setIsMemberEditModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition cursor-pointer"
                          title="Profil bearbeiten"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {/* Ausweis anzeigen Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedMemberForCard(member)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition cursor-pointer"
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
                          className="p-1.5 rounded-lg bg-amber-950 hover:bg-amber-800 text-amber-300 border border-amber-600 transition cursor-pointer"
                          title="Urkunde als PDF herunterladen"
                        >
                          <Award className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => deleteYouthUser(member.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition cursor-pointer"
                        title="Mitglied entfernen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-[#000E66] border border-blue-900 text-center space-y-2">
              <span className="text-2xl block">🔍</span>
              <p className="text-sm font-bold text-white">Keine Mitglieder gefunden</p>
              <p className="text-xs text-slate-400 font-mono">
                Kein Treffer für den aktuellen Filter oder Suchbegriff.
              </p>
            </div>
          )}
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

      {/* New / Edit Op Modal */}
      {isNewOpModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-[#000E66] border border-cyan-400 rounded-3xl max-w-lg w-full p-5 sm:p-6 text-white space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-amber-300 font-mono uppercase flex items-center gap-2">
              <span>{editingOpId ? '✏️ Übung bearbeiten' : '🎯 Neue Übung planen'}</span>
            </h3>

            <form onSubmit={handleCreateOrUpdateExercise} className="space-y-3 text-xs">
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
                <label className="block text-slate-300 mb-1">Treffpunkt / Sammelplatz (EZ-Standort) *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newOpLocation}
                    onChange={(e) => {
                      setNewOpLocation(e.target.value);
                      setGeocodeStatus('idle');
                    }}
                    placeholder="z.B. Wanderparkplatz Löderburger See"
                    className="flex-1 px-3 py-2 rounded-xl bg-[#00083D] border border-blue-800 text-white focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={handleGeocodeLocation}
                    disabled={isGeocodingLocation || !newOpLocation.trim()}
                    className="px-3 py-2 rounded-xl bg-blue-800 hover:bg-blue-700 text-cyan-200 border border-blue-600 font-mono text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    title="Adresse suchen und GPS für EZ ermitteln"
                  >
                    <Search className={`w-3.5 h-3.5 ${isGeocodingLocation ? 'animate-spin' : ''}`} />
                    <span>Suchen</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleUseCurrentGps}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-mono text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    title="Eigenen aktuellen GPS-Standort für EZ übernehmen"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>GPS</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1">
                  <span>
                    EZ-Koordinaten: {newOpHqLat.toFixed(5)}, {newOpHqLng.toFixed(5)}
                  </span>
                  {geocodeStatus === 'success' && (
                    <span className="text-emerald-400 font-bold">✓ Treffpunkt gefunden</span>
                  )}
                  {geocodeStatus === 'not_found' && (
                    <span className="text-amber-400">Ort nicht exakt gefunden, GPS manuell</span>
                  )}
                </div>
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
                  onClick={() => {
                    setIsNewOpModalOpen(false);
                    setEditingOpId(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-mono text-xs uppercase"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs uppercase shadow-lg"
                >
                  {editingOpId ? 'Änderungen speichern' : 'Übung anlegen'}
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
