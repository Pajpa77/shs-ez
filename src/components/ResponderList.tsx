import React, { useState, useMemo } from 'react';
import { useRescue } from '../context/RescueContext';
import {
  User,
  EquipmentType,
  SearchTeam,
  isFirstAdmin,
  isOwner,
  getUserTrackColor,
  getUserConnectionStatus,
  getSignalFreshnessText,
  isUserAdmin,
  isUserEL,
  isUserAdminOrEL,
} from '../types';
import { VEREINSBUERO_LOCATION } from '../mockData';
import {
  Users,
  Shield,
  Phone,
  MessageSquare,
  Battery,
  MapPin,
  Car,
  Radio,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  LogOut,
  Eye,
  ChevronDown,
  ChevronUp,
  UserCheck,
  UserX,
  Scan,
  CreditCard,
  Download,
  Layers,
  Compass,
  Award,
  Navigation,
  Bell,
} from 'lucide-react';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { MemberCardModal } from './MemberCardModal';
import { exportSingleTrackAsGpx } from '../lib/gpxExport';
import { computeTrackSummaries } from '../lib/trackHelper';

interface ResponderListProps {
  onOpenCreateUser: () => void;
  onOpenDirectChat: (user: User) => void;
  onOpenSearchTeams: () => void;
  onFocusUserOnMap: () => void;
  onOpenUserListPdfModal?: () => void;
}

function getEquipmentBadges(equipment: EquipmentType[] = []): { icon: string; label: string; color: string }[] {
  return equipment.map((eq) => {
    switch (eq) {
      case 'drone':
        return { icon: '🚁', label: 'Drohne / UAS', color: 'bg-cyan-950 text-cyan-300 border-cyan-700' };
      case 'k9_mantrailer':
        return { icon: '🐕', label: 'Mantrailer K9', color: 'bg-orange-950 text-orange-300 border-orange-700' };
      case 'k9_area':
        return { icon: '🐾', label: 'Flächenhund K9', color: 'bg-yellow-950 text-yellow-300 border-yellow-700' };
      case 'k9_cadaver':
        return { icon: '🐕‍🦺', label: 'Leichenspürhund K9', color: 'bg-indigo-950 text-indigo-300 border-indigo-700' };
      case 'quad':
        return { icon: '🚜', label: 'Quad / ATV', color: 'bg-purple-950 text-purple-300 border-purple-700' };
      case 'boat':
        return { icon: '🚤', label: 'Wasserrettung', color: 'bg-blue-950 text-blue-300 border-blue-700' };
      case 'foot_search':
        return { icon: '🚶', label: 'Fußtrupp', color: 'bg-emerald-950 text-emerald-300 border-emerald-700' };
      case 'flir':
        return { icon: '🌡️', label: 'Wärmebild', color: 'bg-red-950 text-red-300 border-red-700' };
      case 'first_aid':
        return { icon: '🩹', label: 'Sanitäter', color: 'bg-rose-950 text-rose-300 border-rose-700' };
      default:
        return {
          icon: '📦',
          label: 'Ausrüstung',
          color: 'bg-slate-800 text-slate-300 border-slate-700',
        };
    }
  });
}

export const ResponderList: React.FC<ResponderListProps> = ({
  onOpenCreateUser,
  onOpenDirectChat,
  onOpenSearchTeams,
  onFocusUserOnMap,
  onOpenUserListPdfModal,
}) => {
  const {
    allUsers,
    currentUser,
    userLocations,
    currentOperation,
    updateUser,
    setUserActiveStatus,
    removeUserFromOperation,
    updateOperation,
    getUserArrivalStatus,
    setUserArrivalStatus,
    confirmUserReady,
    calculateDistanceToEzMeters,
    setSelectedUser,
    sendPagerAlert,
  } = useRescue();

  // 3 klare Unterbereiche ohne redundante Doppel-Auflistung
  const [activeSubTab, setActiveSubTab] = useState<'responders' | 'teams' | 'tracks'>('responders');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'einsatzleitung' | 'group_leader' | 'responder' | 'observer'>('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [cardUser, setCardUser] = useState<User | null>(null);

  const isRealAdmin = isUserAdmin(currentUser);
  const canLead = isUserEL(currentUser);
  const isOpActive = Boolean(currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused'));

  const trackSummaries = useMemo(() => {
    return computeTrackSummaries(currentOperation, userLocations, allUsers);
  }, [currentOperation, userLocations, allUsers]);

  const teams: SearchTeam[] = currentOperation?.teams || [];
  const sectors = currentOperation?.sectors || [];

  const handleFocusUser = (targetUser: User) => {
    setSelectedUser(targetUser);
    onFocusUserOnMap();
  };

  const handleToggleAdminRole = (targetUser: User) => {
    if (!isRealAdmin || targetUser.id === currentUser?.id) return;
    if (isFirstAdmin(targetUser)) {
      alert('Der First-Admin Account von Maria (App-Owner) ist unantastbar und kann nicht geändert werden.');
      return;
    }
    // Only First Admin (Maria) can manage permanent System-Admins
    if (targetUser.role === 'admin') {
      if (!isFirstAdmin(currentUser)) {
        alert('Aktion verweigert: Nur der First-Admin (Maria) darf System-Administratoren verwalten.');
        return;
      }
      const nextCanLead = !targetUser.canLeadOperations;
      updateUser(targetUser.id, { canLeadOperations: nextCanLead });
      return;
    }

    // For Einsatzleitung, Gruppenleiter & Sucher: Toggle temporary Admin rights (isAdmin)
    const nextAdmin = !targetUser.isAdmin;
    updateUser(targetUser.id, { isAdmin: nextAdmin });
  };

  // Gefilterte Benutzer: Jeder Nutzer wird genau EINMAL dargestellt
  const filteredUsers = useMemo(() => {
    return allUsers
      .filter((user) => {
        const matchesRole =
          roleFilter === 'all'
            ? user.role !== 'observer'
            : user.role === roleFilter;

        const q = filterQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          user.name.toLowerCase().includes(q) ||
          user.callSign.toLowerCase().includes(q) ||
          (user.licensePlate && user.licensePlate.toLowerCase().includes(q)) ||
          (user.organization && user.organization.toLowerCase().includes(q));

        return matchesRole && matchesSearch;
      })
      .sort((a, b) => {
        // Aktive Einsatzkräfte zuerst, abgemeldete nach unten
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [allUsers, roleFilter, filterQuery]);

  // Schnell-KPIs
  const activeCount = allUsers.filter((u) => u.isActive && u.role !== 'observer').length;
  const readyCount = allUsers.filter((u) => u.isActive && getUserArrivalStatus(u.id) === 'ready').length;
  const inTransitCount = allUsers.filter((u) => u.isActive && isOpActive && getUserArrivalStatus(u.id) === 'in_transit').length;
  const nearEzCount = allUsers.filter((u) => u.isActive && isOpActive && (getUserArrivalStatus(u.id) === 'near_ez' || getUserArrivalStatus(u.id) === 'ez_reached')).length;
  const observerCount = allUsers.filter((u) => u.role === 'observer' && u.isActive).length;

  // EZ-Koordinaten für Routen & Distanzen
  const targetLat = isOpActive
    ? (currentOperation?.headquartersLocation?.lat || currentOperation?.missingPerson?.lastSeenLocation?.lat || VEREINSBUERO_LOCATION.lat)
    : VEREINSBUERO_LOCATION.lat;
  const targetLng = isOpActive
    ? (currentOperation?.headquartersLocation?.lng || currentOperation?.missingPerson?.lastSeenLocation?.lng || VEREINSBUERO_LOCATION.lng)
    : VEREINSBUERO_LOCATION.lng;
  const targetAddr = isOpActive
    ? (currentOperation?.headquartersLocation?.address || currentOperation?.missingPerson?.lastSeenLocation?.address || 'Einsatzort')
    : VEREINSBUERO_LOCATION.address;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5 text-slate-100 font-sans">
      {/* ── TOP HEADER BANNER ─────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-[#1E293B] border border-slate-700 p-4 sm:p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white uppercase tracking-wide">Kräfte & Suchtrupps</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {activeCount} aktiv
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {currentOperation?.title ? `Einsatz: ${currentOperation.title}` : 'Bereitschaftsmodus (Allgemein)'} • {allUsers.length} Kräfte registriert
            </p>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
          {canLead && (
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer font-mono"
              title="Vereinsausweis-Strichcode / QR-Code per Kamera scannen"
            >
              <Scan className="w-4 h-4 animate-pulse text-emerald-200" />
              <span>Ausweis scannen</span>
            </button>
          )}

          <button
            onClick={onOpenSearchTeams}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
            title="Suchtrupp-Verwaltung öffnen"
          >
            <span>🐕‍🦺</span>
            <span>Suchtrupps ({teams.length})</span>
          </button>

          {isRealAdmin && (
            <>
              <button
                onClick={onOpenCreateUser}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
                title="Neues Mitglied anlegen"
              >
                <Plus className="w-4 h-4" />
                <span>Kraft anlegen</span>
              </button>

              {onOpenUserListPdfModal && (
                <button
                  onClick={onOpenUserListPdfModal}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 shadow transition cursor-pointer font-mono"
                  title="PDF-Liste aller Mitglieder mit Ausweis-Strichcodes drucken & speichern"
                >
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span>Strichcode-PDF</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 3 KLARE UNTERBEREICHE (Sub-Tabs) ──────────────────────────────── */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-[#1E293B] border border-slate-700 rounded-xl text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveSubTab('responders')}
          className={`py-2 px-2 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'responders'
              ? 'bg-blue-600 text-white shadow font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Einsatzkräfte ({allUsers.filter((u) => u.role !== 'observer').length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('teams')}
          className={`py-2 px-2 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'teams'
              ? 'bg-teal-600 text-white shadow font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🐕‍🦺</span>
          <span>Suchtrupps ({teams.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('tracks')}
          className={`py-2 px-2 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'tracks'
              ? 'bg-emerald-600 text-white shadow font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Suchspuren ({trackSummaries.length})</span>
        </button>
      </div>

      {/* ── TAB 1: EINSATZKRÄFTE (Einheitliche, nicht-redundante Übersicht) ─── */}
      {activeSubTab === 'responders' && (
        <div className="space-y-4">
          {/* EZ Status & Quick KPI Monitor Banner */}
          <div className="bg-[#1E293B] border border-slate-700/80 p-3.5 sm:p-4 rounded-2xl shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">📍</span>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>EZ-STANDORT: {targetAddr}</span>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 underline font-bold"
                    title="Route zur EZ in Google Maps öffnen"
                  >
                    🧭 Route öffnen
                  </a>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Radius: 500m • Automatische Eintreff-Erkennung bei Annäherung
                </div>
              </div>
            </div>

            {/* Quick KPI Status Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold">
                🟢 {readyCount} Bereit
              </span>
              {isOpActive && (
                <>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold">
                    🟡 {nearEzCount} Am Ort
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold">
                    🔴 {inTransitCount} Anfahrt
                  </span>
                </>
              )}
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono font-bold">
                ○ {allUsers.length - activeCount} Offline
              </span>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#1E293B] p-3 rounded-xl border border-slate-700">
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Name, Funkrufname, KFZ filtern..."
              className="w-full sm:w-80 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 placeholder-slate-500 font-mono"
            />

            <div className="flex gap-1.5 w-full sm:w-auto flex-wrap">
              {(['all', 'admin', 'einsatzleitung', 'group_leader', 'responder', 'observer'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer uppercase tracking-wider font-mono ${
                    roleFilter === r
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                  }`}
                >
                  {r === 'all'
                    ? `Alle (${allUsers.filter((u) => u.role !== 'observer').length})`
                    : r === 'admin'
                    ? '🛡️ Admin'
                    : r === 'einsatzleitung'
                    ? '📋 EL'
                    : r === 'group_leader'
                    ? '🧭 GL'
                    : r === 'responder'
                    ? '🚶 Sucher'
                    : `👁️ Betrachter (${observerCount})`}
                </button>
              ))}
            </div>
          </div>

          {/* Hinweis zur Ortung */}
          <div className="bg-blue-950/40 border border-blue-500/30 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs text-blue-200 font-mono shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-base">📍</span>
              <span><strong>Kräfte-Ortung:</strong> Antippen einer Einsatzkraft zentriert sofort ihren Live-Standort auf der Lagekarte.</span>
            </div>
          </div>

          {/* Unified Responder Cards Grid (Jeder User genau 1x!) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((user) => {
              const assignedSector = currentOperation?.sectors.find(
                (s) => s.id === user.assignedSectorId || s.assignedUserIds?.includes(user.id)
              );
              const assignedTeam = teams.find(
                (t) => t.leaderUserId === user.id || t.memberUserIds?.includes(user.id)
              );
              const badges = getEquipmentBadges(user.equipment);
              const isMe = user.id === currentUser?.id;
              const connStatus = getUserConnectionStatus(user);
              const freshnessText = getSignalFreshnessText(user);
              const arrivalStatus = getUserArrivalStatus(user.id);
              const loc = userLocations[user.id]?.currentPosition;
              const distMeters = loc ? calculateDistanceToEzMeters(loc.lat, loc.lng) : null;
              const distText = distMeters !== null
                ? distMeters >= 1000
                  ? `${(distMeters / 1000).toFixed(1)} km`
                  : `${Math.round(distMeters)} m`
                : 'Kein GPS';

              const userTrack = trackSummaries.find((t) => t.userId === user.id);

              return (
                <div
                  key={user.id}
                  onClick={() => handleFocusUser(user)}
                  className={`rounded-2xl p-4 sm:p-5 border transition shadow-xl flex flex-col justify-between cursor-pointer group hover:ring-2 hover:ring-blue-500/50 hover:border-blue-400/80 active:scale-[0.99] ${
                    !user.isActive
                      ? 'opacity-60 bg-slate-900/60 border-slate-800'
                      : user.role === 'admin'
                      ? 'bg-[#1E293B] border-blue-500/40'
                      : 'bg-[#1E293B] border-slate-700'
                  }`}
                  title="Antippen, um Einsatzkraft auf der Lagekarte zu zentrieren"
                >
                  <div className="space-y-3">
                    {/* Header: Photo, Name, Rollen-Badge, Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className="h-12 w-12 rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-950 shadow-md">
                            {user.photoUrl ? (
                              <img src={user.photoUrl} alt={user.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center font-bold text-white text-base bg-slate-800">
                                {user.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <span
                            className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-slate-900 ${
                              !user.isActive
                                ? 'bg-slate-500'
                                : connStatus === 'active'
                                ? 'bg-sky-500 animate-pulse'
                                : connStatus === 'stale'
                                ? 'bg-amber-400 animate-pulse'
                                : 'bg-rose-500'
                            }`}
                            title={
                              !user.isActive
                                ? 'Abgemeldet'
                                : connStatus === 'active'
                                ? '🟢 Online & Ortend'
                                : connStatus === 'stale'
                                ? `🟡 Signal verzögert (${freshnessText})`
                                : `🔴 Offline (${freshnessText})`
                            }
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-bold text-sm text-white truncate">{user.name}</h3>
                            {isMe && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500 font-bold font-mono">
                                DU
                              </span>
                            )}
                            <span
                              className="w-4 h-2 rounded-sm inline-block shrink-0 border border-white/80 shadow-sm"
                              style={{ backgroundColor: getUserTrackColor(user, allUsers) }}
                              title={`Suchspur-Farbe: ${getUserTrackColor(user, allUsers)}`}
                            />
                          </div>
                          <div className="text-xs text-blue-400 font-mono font-semibold truncate">{user.callSign}</div>
                          <div className="text-[10px] text-slate-400 truncate">{user.organization || 'Einsatzkraft'}</div>
                        </div>
                      </div>

                      {/* Rollen-Badge & An/Abmelde-Knopf */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {isFirstAdmin(user) ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase border bg-amber-500/25 text-amber-300 border-amber-400/80 flex items-center gap-1 shadow-sm">
                            <span>👑</span>
                            <span>First Admin</span>
                          </span>
                        ) : (
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase border ${
                              user.role === 'admin'
                                ? 'bg-red-500/20 text-red-300 border-red-500'
                                : user.role === 'einsatzleitung'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                                : user.role === 'observer'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500'
                                : 'bg-blue-500/20 text-blue-300 border-blue-500'
                            }`}
                          >
                            {user.role === 'admin'
                              ? user.canLeadOperations
                                ? '🛡️ Admin & EL'
                                : '🛡️ Admin'
                              : user.role === 'einsatzleitung'
                              ? '📢 EL (Admin)'
                              : user.role === 'observer'
                              ? '👁️ Gast (Lesen)'
                              : '🦺 Sucher'}
                          </span>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUserActiveStatus(user.id, !user.isActive);
                          }}
                          className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold transition cursor-pointer ${
                            !user.isActive
                              ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-emerald-900/40 hover:text-emerald-300'
                              : connStatus === 'active'
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-rose-900/40'
                              : connStatus === 'stale'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-rose-900/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}
                          title={user.isActive ? 'Klicken zum Abmelden' : 'Klicken zum Anmelden'}
                        >
                          {!user.isActive
                            ? '○ Abgemeldet'
                            : connStatus === 'active'
                            ? '● Online'
                            : connStatus === 'stale'
                            ? `🟡 Funkloch (${freshnessText})`
                            : `🔴 Signal weg (${freshnessText})`}
                        </button>
                      </div>
                    </div>

                    {/* Einsatz-Statusleiste (Ankunft & Bereitschaft) */}
                    {isOpActive && (
                      <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 space-y-1.5 font-mono text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">Einsatz-Status:</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              arrivalStatus === 'ready'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                                : arrivalStatus === 'near_ez' || arrivalStatus === 'ez_reached'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                                : 'bg-rose-500/20 text-rose-300 border-rose-500/60'
                            }`}
                          >
                            {arrivalStatus === 'ready'
                              ? '🟢 Bereit (Tracking aktiv)'
                              : arrivalStatus === 'ez_reached'
                              ? '🟡 EZ erreicht (Bestätigung offen)'
                              : arrivalStatus === 'near_ez'
                              ? '🟡 Am Ort (< 500m)'
                              : '🔴 In Anfahrt'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1 border-t border-slate-800">
                          <span>Entfernung zur EZ:</span>
                          <span className="font-bold text-white">{distText}</span>
                        </div>

                        {/* Status manuell schalten (Einsatzleitung) */}
                        {canLead && (
                          <div className="pt-1.5 border-t border-slate-800/80 space-y-1">
                            <span className="text-[9px] text-slate-400 block">Status schalten (Leitung):</span>
                            <div className="grid grid-cols-3 gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUserArrivalStatus(user.id, 'in_transit');
                                }}
                                className={`py-1 px-1 rounded text-[10px] font-bold transition cursor-pointer border ${
                                  arrivalStatus === 'in_transit'
                                    ? 'bg-rose-700 text-white border-rose-400 shadow'
                                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                }`}
                              >
                                🔴 Anfahrt
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUserArrivalStatus(user.id, 'near_ez');
                                }}
                                className={`py-1 px-1 rounded text-[10px] font-bold transition cursor-pointer border ${
                                  arrivalStatus === 'near_ez' || arrivalStatus === 'ez_reached'
                                    ? 'bg-amber-600 text-white border-amber-400 shadow'
                                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                }`}
                              >
                                🟡 Am Ort
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmUserReady(user.id);
                                }}
                                className={`py-1 px-1 rounded text-[10px] font-bold transition cursor-pointer border ${
                                  arrivalStatus === 'ready'
                                    ? 'bg-emerald-600 text-white border-emerald-400 shadow'
                                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                }`}
                              >
                                🟢 Bereit
                              </button>
                            </div>
                          </div>
                        )}

                        {!canLead && isMe && arrivalStatus !== 'ready' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmUserReady(user.id);
                            }}
                            className="w-full py-1.5 px-3 mt-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold font-mono transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Ich bin bereit (Tracking starten)</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Details Grid: KFZ, Akku, Sektor, Trupp, Track */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/80 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-slate-400 block">KFZ-KENNZEICHEN</span>
                        <span className="font-bold text-slate-200 truncate block">
                          {user.licensePlate || 'Nicht hinterlegt'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 block">AKKUSTAND</span>
                        <span
                          className={`font-bold ${
                            (user.batteryLevel ?? 100) > 40
                              ? 'text-emerald-400'
                              : (user.batteryLevel ?? 100) > 15
                              ? 'text-amber-400'
                              : 'text-red-400'
                          }`}
                        >
                          {user.batteryCharging ? '⚡' : '🔋'} {user.batteryLevel ?? 100}%
                        </span>
                      </div>

                      <div className="col-span-2 pt-1 border-t border-slate-800">
                        <span className="text-[10px] text-slate-400 block">SEKTOR & TRUPP</span>
                        <span className="font-semibold text-amber-300 text-[11px] truncate block">
                          {assignedSector ? `🎯 ${assignedSector.name}` : '⭕ Kein Sektor'}
                          {assignedTeam ? ` • 👥 ${assignedTeam.name}` : ''}
                        </span>
                      </div>

                      {userTrack && userTrack.distanceMeters > 0 && (
                        <div className="col-span-2 pt-1 border-t border-slate-800 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Suchstrecke:</span>
                          <span className="font-bold text-emerald-400">
                            {(userTrack.distanceMeters / 1000).toFixed(2)} km ({userTrack.pointCount} Pkt.)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Ausrüstung & Notizen */}
                    {(badges.length > 0 || (user.customEquipmentTags && user.customEquipmentTags.length > 0)) && (
                      <div className="flex flex-wrap gap-1">
                        {badges.map((b, idx) => (
                          <span
                            key={idx}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium font-mono ${b.color}`}
                          >
                            <span>{b.icon}</span>
                            <span>{b.label}</span>
                          </span>
                        ))}
                        {user.customEquipmentTags?.map((tag, idx) => (
                          <span
                            key={`custom-${idx}`}
                            className="flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium font-mono bg-blue-950 text-blue-300 border-blue-700"
                          >
                            <span>🦮</span>
                            <span>{tag}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Toolbar */}
                  <div className="mt-4 pt-3 border-t border-slate-700/80 flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex gap-1.5 flex-1 flex-wrap">
                      {user.id !== currentUser?.id && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Lautes Pager-Signal an ${user.name} (${user.callSign}) senden? Auf dem Smartphone ertönt ein lauter Alarmton.`)) {
                              sendPagerAlert(user.id);
                            }
                          }}
                          className="py-1.5 px-2 bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded-lg text-xs font-bold flex items-center gap-1 border border-red-500/50 cursor-pointer active:scale-95 shadow-sm"
                          title="Lautes Pager-Signal / Weckruf an Einsatzkraft senden"
                        >
                          <Bell className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                          <span>Pager</span>
                        </button>
                      )}

                      {user.phone && (
                        <a
                          href={`tel:${user.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-700"
                          title="Anrufen"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Anruf</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDirectChat(user);
                        }}
                        className="py-1.5 px-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow"
                        title="Direktfunk öffnen"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Funk</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFocusUser(user);
                        }}
                        className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow border border-emerald-500/30 font-mono"
                        title="Auf Karte zentrieren"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Karte</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCardUser(user);
                        }}
                        className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold font-mono border border-slate-700"
                        title="Vereinsausweis & Strichcodes"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                        <span>Ausweis</span>
                      </button>

                      {(userLocations[user.id]?.trackHistory?.length || 0) > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            exportSingleTrackAsGpx({
                              points: userLocations[user.id]?.trackHistory || [],
                              callSign: user.callSign,
                              userName: user.name,
                              operationTitle: currentOperation?.title || 'Aktiver Einsatz',
                            });
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg text-xs border border-amber-500/30"
                          title="GPX herunterladen"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Admin / EL Management Controls */}
                    {(isRealAdmin || canLead) && user.id !== currentUser?.id && (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {isFirstAdmin(user) ? (
                          <div
                            className="px-2 py-1 rounded-lg bg-amber-950/60 text-amber-300 border border-amber-500/60 font-mono text-[10px] font-bold select-none"
                            title="First Admin Maria (unantastbar)"
                          >
                            👑 Owner
                          </div>
                        ) : (
                          <>
                            {isRealAdmin && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleAdminRole(user);
                                }}
                                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                  user.role === 'admin'
                                    ? user.canLeadOperations
                                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                                      : 'bg-red-950/60 text-red-300 border-red-800'
                                    : user.role === 'einsatzleitung'
                                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-amber-300'
                                }`}
                                title="Admin- / Einsatzleitungs-Rechte schalten"
                              >
                                <Shield className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {(currentOperation?.participantIds?.includes(user.id) || user.isActive) ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`${user.name} (${user.callSign}) wirklich aus dem Einsatz abmelden?`)) {
                                    removeUserFromOperation(user.id);
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900 text-amber-300 border border-amber-800 transition cursor-pointer"
                                title="Aus dem Einsatz abmelden"
                              >
                                <LogOut className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUserActiveStatus(user.id, true);
                                  if (currentOperation) {
                                    const updated = Array.from(new Set([...(currentOperation.participantIds || []), user.id]));
                                    updateOperation(currentOperation.id, { participantIds: updated });
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 transition cursor-pointer"
                                title="In den Einsatz aufnehmen"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: SUCHTRUPPS ────────────────────────────────────────────── */}
      {activeSubTab === 'teams' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#1E293B] border border-slate-700 p-4 sm:p-5 rounded-2xl shadow">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🐕‍🦺</span>
              <div>
                <h2 className="font-bold text-white text-sm sm:text-base uppercase tracking-wider">
                  Suchtrupps ({teams.length})
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  Suchtrupps fassen Gruppenführer, Sucher und externe Helfer zusammen und sind Suchsektoren zugeteilt.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenSearchTeams}
              className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer font-mono"
            >
              + Suchtrupp bearbeiten / erstellen
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.length > 0 ? (
              teams.map((team) => {
                const leader = allUsers.find((u) => u.id === team.leaderUserId);
                const members = allUsers.filter((u) => team.memberUserIds?.includes(u.id));
                const assignedSectors = sectors.filter((sec) => team.sectorIds?.includes(sec.id));

                return (
                  <div key={team.id} className="bg-[#1E293B] border border-slate-700 rounded-xl p-4 space-y-3 shadow">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-white text-sm flex items-center gap-2">
                        <span>🎯</span> {team.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-mono font-bold">
                        {1 + members.length + (team.externalVolunteersCount || 0)} Personen
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/60">
                        <span className="text-[10px] font-bold text-amber-400 uppercase block">🎖️ Gruppenführer:</span>
                        <span className="font-bold text-white">{leader?.name || 'Nicht zugewiesen'} ({leader?.callSign || 'k.A.'})</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Sucher ({members.length}):</span>
                          <div className="flex flex-wrap gap-1">
                            {members.length > 0 ? (
                              members.map((m) => (
                                <span key={m.id} className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded text-[10px]">
                                  {m.callSign}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-500 italic text-[10px]">Keine</span>
                            )}
                          </div>
                        </div>

                        <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                          <span className="text-[9px] font-bold text-amber-400 uppercase block mb-0.5">Helfer:</span>
                          <span className="text-amber-300 font-bold text-xs">{team.externalVolunteersCount || 0} Helfer</span>
                        </div>
                      </div>

                      <div className="pt-1">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase block mb-1">🗺️ Zuteilung Sektoren:</span>
                        <div className="flex flex-wrap gap-1">
                          {assignedSectors.length > 0 ? (
                            assignedSectors.map((sec) => (
                              <span key={sec.id} className="px-2 py-0.5 bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-[10px] rounded font-semibold">
                                {sec.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 italic text-[10px]">Kein Sektor zugeteilt</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-12 text-center text-slate-400 bg-[#1E293B]/60 rounded-xl border border-slate-800 text-xs font-mono space-y-2">
                <p className="font-bold text-slate-200 text-sm">Noch keine Suchtrupps für diesen Einsatz gebildet.</p>
                <p className="text-slate-400 max-w-md mx-auto">
                  Klicken Sie oben auf „+ Suchtrupp bearbeiten / erstellen“, um Gruppenführer, Sucher und Helfer zu Trupps zusammenzustellen.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: SUCHSPUREN & STRECKEN ─────────────────────────────────── */}
      {activeSubTab === 'tracks' && (
        <div className="space-y-4">
          <div className="bg-[#1E293B] border border-slate-700 p-4 sm:p-5 rounded-2xl shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🧭</span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-white text-sm sm:text-base uppercase tracking-wider">
                    Suchspuren & Strecken ({trackSummaries.length})
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold">
                    {(trackSummaries.reduce((sum, t) => sum + t.distanceMeters, 0) / 1000).toFixed(2)} km Gesamtstrecke
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Live aufgezeichnete GPS-Wege und Distanzen aller eingesetzten Sucher im aktuellen Einsatz.
                </p>
              </div>
            </div>

            {trackSummaries.length > 0 && (
              <button
                type="button"
                onClick={onFocusUserOnMap}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold font-mono transition cursor-pointer flex items-center gap-1.5 shadow"
              >
                <span>🗺️ Lagekarte öffnen</span>
              </button>
            )}
          </div>

          {!isOpActive && (
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl text-xs font-mono text-slate-400 flex items-center gap-2.5">
              <span>ℹ️</span>
              <span>Suchspuren werden während aktiven Einsätzen in Echtzeit aufgezeichnet. Beendete Einsätze finden Sie im Einsatzarchiv.</span>
            </div>
          )}

          {trackSummaries.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-[#1E293B]/60 rounded-xl border border-slate-800 text-xs font-mono">
              Noch keine Suchspuren für diesen Einsatz aufgezeichnet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trackSummaries.map((item) => {
                const userObj = allUsers.find((u) => u.id === item.userId);
                const distText =
                  item.distanceMeters >= 1000
                    ? `${(item.distanceMeters / 1000).toFixed(2)} km`
                    : `${Math.round(item.distanceMeters)} m`;

                return (
                  <div
                    key={`${item.userId}-${item.phaseLabel || 'track'}`}
                    className="bg-[#1E293B] border border-slate-700 rounded-xl p-4 space-y-3 shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-5 h-2 rounded-sm shrink-0 border border-white/80 shadow-sm"
                          style={{ backgroundColor: item.color }}
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-white text-xs truncate flex items-center gap-1">
                            <span>{item.equipmentIcon}</span>
                            <span className="truncate">{item.name}</span>
                          </div>
                          <div className="text-[10px] text-blue-400 font-mono truncate">{item.callSign}</div>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                          item.isLive
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        }`}
                      >
                        {item.isLive ? '🟢 Live' : '📁 Gespeichert'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Suchstrecke:</span>
                        <span className="font-bold text-emerald-400">{distText}</span>
                      </div>
                      <div className="bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">GPS-Punkte:</span>
                        <span className="font-bold text-white">{item.pointCount} Pkt.</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          if (userObj) {
                            handleFocusUser(userObj);
                          } else {
                            onFocusUserOnMap();
                          }
                        }}
                        className="px-2.5 py-1.5 bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white rounded-lg text-xs font-bold font-mono transition cursor-pointer border border-blue-500/40 flex items-center gap-1"
                      >
                        <span>🗺️ Auf Karte anzeigen</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const pts = userLocations[item.userId]?.trackHistory || [];
                          if (pts.length > 0) {
                            exportSingleTrackAsGpx({
                              userName: item.name,
                              callSign: item.callSign,
                              points: pts,
                              operationTitle: currentOperation?.title,
                            });
                          }
                        }}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition cursor-pointer flex items-center gap-1 border border-slate-700"
                        title="GPX herunterladen"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                        <span>GPX</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MODALS ────────────────────────────────────────────────────────── */}
      {isScannerOpen && (
        <BarcodeScannerModal
          allUsers={allUsers}
          onConfirmReady={(userId) => confirmUserReady(userId)}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {cardUser && (
        <MemberCardModal
          user={cardUser}
          onClose={() => setCardUser(null)}
        />
      )}
    </div>
  );
};
