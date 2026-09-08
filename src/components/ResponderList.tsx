import React, { useState } from 'react';
import { useRescue } from '../context/RescueContext';
import { User, EquipmentType, SearchTeam, isFirstAdmin, isOwner, getUserTrackColor } from '../types';
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
} from 'lucide-react';

interface ResponderListProps {
  onOpenCreateUser: () => void;
  onOpenDirectChat: (user: User) => void;
  onOpenSearchTeams: () => void;
  onFocusUserOnMap: () => void;
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
        return { icon: '📦', label: 'Ausrüstung', color: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700' };
    }
  });
}

export const ResponderList: React.FC<ResponderListProps> = ({
  onOpenCreateUser,
  onOpenDirectChat,
  onOpenSearchTeams,
  onFocusUserOnMap,
}) => {
  const {
    allUsers,
    currentUser,
    userLocations,
    currentOperation,
    updateUser,
    setUserActiveStatus,
    deactivateAllUsers,
    removeUserFromOperation,
    updateOperation,
    getUserArrivalStatus,
    confirmUserReady,
    calculateDistanceToEzMeters,
    setSelectedUser,
  } = useRescue();
  const [filterQuery, setFilterQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'einsatzleitung' | 'responder' | 'observer'>('all');
  const [showObserversSection, setShowObserversSection] = useState(false);

  // Filter allUsers to only contain participants of the active operation
  const currentOperationUsers = React.useMemo(() => {
    if (currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused')) {
      const participantIds = currentOperation.participantIds || [];
      return allUsers.filter((u) => participantIds.includes(u.id));
    }
    return allUsers;
  }, [allUsers, currentOperation]);

  const isRealAdmin = currentUser?.role === 'admin' || Boolean(currentUser?.isAdmin);
  const canLead = currentUser?.role === 'einsatzleitung' || Boolean(currentUser?.canLeadOperations) || isRealAdmin;
  const observerUsers = currentOperationUsers.filter((u) => u.role === 'observer');
  const teams: SearchTeam[] = currentOperation?.teams || [];
  const sectors = currentOperation?.sectors || [];

  const handleToggleAdminRole = (targetUser: User) => {
    if (!isRealAdmin || targetUser.id === currentUser?.id) return;
    if (isFirstAdmin(targetUser)) {
      alert('Der First-Admin Account von Maria (App-Owner) ist unantastbar und kann nicht geändert werden.');
      return;
    }
    if (targetUser.role === 'einsatzleitung') {
      // Toggle admin capability for einsatzleitung
      const nextIsAdmin = !targetUser.isAdmin;
      updateUser(targetUser.id, { isAdmin: nextIsAdmin });
    } else if (targetUser.role === 'admin') {
      // Change from pure Admin to Einsatzleitung without Admin
      updateUser(targetUser.id, { role: 'einsatzleitung', isAdmin: false, canLeadOperations: true });
    } else {
      // Promote responder to Einsatzleitung
      updateUser(targetUser.id, { role: 'einsatzleitung', isAdmin: false, canLeadOperations: true });
    }
  };

  const filteredUsers = currentOperationUsers
    .filter((user) => {
      const matchesRole =
        roleFilter === 'all'
          ? user.role !== 'observer'
          : user.role === roleFilter;

      const matchesSearch =
        user.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
        user.callSign.toLowerCase().includes(filterQuery.toLowerCase()) ||
        (user.licensePlate && user.licensePlate.toLowerCase().includes(filterQuery.toLowerCase())) ||
        (user.organization && user.organization.toLowerCase().includes(filterQuery.toLowerCase()));
      return matchesRole && matchesSearch;
    })
    .sort((a, b) => {
      // Active users first, inactive/logged-out users at the bottom
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 text-black dark:text-slate-100 font-sans">
      {/* Top Banner with Search Teams & Responders Actions */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-[#1E293B] border border-slate-300 dark:border-slate-700 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white uppercase tracking-wide">Kräfte & Suchtrupps (Suchtrupp-Verwaltung)</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Einsatz: {currentOperation?.title || 'Kein aktiver Einsatz'} • {currentOperationUsers.length} Kräfte registriert
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
          {/* Main Search Teams Button */}
          <button
            onClick={onOpenSearchTeams}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg transition cursor-pointer"
          >
            <span>🐕‍🦺</span> Suchtrupps bilden & zuteilen ({teams.length})
          </button>

          {isRealAdmin && (
            <>
              <button
                onClick={onOpenCreateUser}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Einsatzkraft anlegen
              </button>
            </>
          )}
        </div>
      </div>

      {/* EZ Arrival & Readiness Monitor (Admin / Command Center) */}
      <div className="bg-[#1E293B] border border-slate-300 dark:border-slate-700/80 p-5 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📍</span>
            <div>
              <h2 className="font-bold text-white text-sm sm:text-base uppercase tracking-wider">
                EZ & Einsatzkräfte-Bereitschaftsmonitor (Ankunftskontrolle)
              </h2>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  EZ: {(currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused') && currentOperation.headquartersLocation?.address) ? currentOperation.headquartersLocation.address : 'Vereinsbüro Hohe Straße 15, Aschersleben'}
                </span>
                <span className="text-slate-500">•</span>
                <span>0,5 km Radius</span>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${
                    (currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused') && currentOperation.headquartersLocation?.lat)
                      ? `${currentOperation.headquartersLocation.lat},${currentOperation.headquartersLocation.lng}`
                      : '51.7587,11.4589'
                  }`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 underline font-bold"
                  title="Route zur EZ in Google Maps / Navi-App öffnen"
                >
                  🧭 Route zur EZ
                </a>
              </div>
            </div>
          </div>
          <span className="text-xs font-mono px-3 py-1 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-300 dark:border-slate-700">
            {currentOperationUsers.filter((u) => u.isActive).length} aktive User eingeloggt
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {currentOperationUsers
            .filter((u) => u.isActive)
            .map((user) => {
              const status = getUserArrivalStatus(user.id);
              const loc = userLocations[user.id]?.currentPosition;
              const distMeters = loc ? calculateDistanceToEzMeters(loc.lat, loc.lng) : null;
              const distText = distMeters !== null ? (distMeters >= 1000 ? `${(distMeters / 1000).toFixed(1)} km` : `${Math.round(distMeters)} m`) : 'Kein GPS';

              let statusBadge = { label: 'In Anfahrt', color: 'bg-red-500/20 text-red-300 border-red-500/50', icon: '🔴' };
              if (status === 'ready') {
                statusBadge = { label: 'Bereit (Tracking aktiv)', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500', icon: '🟢' };
              } else if (status === 'ez_reached') {
                statusBadge = { label: 'EZ erreicht (Bestätigung ausstehend)', color: 'bg-slate-50 dark:bg-amber-500/20 text-amber-300 border-amber-500/50', icon: '🟡' };
              }

              return (
                <div key={user.id} className="bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700/80 rounded-xl p-3.5 space-y-2.5 shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800 shrink-0 border border-slate-300 dark:border-slate-700">
                        {user.photoUrl ? (
                          <img src={user.photoUrl} alt={user.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center font-bold text-white text-xs">
                            {user.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white leading-tight flex items-center gap-1.5">
                          <span>{user.name}</span>
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block shrink-0 border border-white/80 shadow-sm"
                            style={{ backgroundColor: getUserTrackColor(user, allUsers) }}
                            title={`Suchspur-Farbe: ${getUserTrackColor(user, allUsers)}`}
                          />
                        </div>
                        <div className="text-[10px] text-blue-400 font-mono">{user.callSign}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono font-bold flex items-center gap-1 ${statusBadge.color}`}>
                      <span>{statusBadge.icon}</span> {statusBadge.label}
                    </span>
                  </div>

                  {user.lastTrackingTest && (
                    <div className="text-[10px] font-mono flex items-center justify-between px-2.5 py-1 rounded bg-blue-950/40 border border-blue-800/40 text-blue-300">
                      <span>🛰️ Gerätetest:</span>
                      <span className="font-bold">
                        {user.lastTrackingTest.passed ? '✓ Bestanden' : '⚠️ Unvollständig'} ({new Date(user.lastTrackingTest.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })})
                      </span>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-700 dark:text-slate-300 font-mono flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700/60">
                    <span>Entfernung zur EZ:</span>
                    <span className="font-bold text-white">{distText}</span>
                  </div>

                  {(canLead || currentUser?.id === user.id) && status !== 'ready' && (
                    <button
                      type="button"
                      onClick={() => confirmUserReady(user.id)}
                      className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold font-mono transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {currentUser?.id === user.id && !canLead
                        ? 'Ich bin bereit (Tracking starten)'
                        : 'Als „Bereit“ bestätigen & Tracking starten'}
                    </button>
                  )}
                  {status === 'ready' && (
                    <div className="text-[10px] text-emerald-400 font-mono text-center font-bold">
                      ✅ Eintreffen bestätigt • Bewegung wird aufgezeichnet & protokolliert
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Active Search Teams Overview Section */}
      <div className="bg-[#1E293B] border border-slate-300 dark:border-slate-700/80 p-5 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🐕‍🦺</span>
            <div>
              <h2 className="font-bold text-white text-sm sm:text-base uppercase tracking-wider">Aktive Suchtrupps für diesen Einsatz ({teams.length})</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Suchtrupps bestehen aus 1 Gruppenführer, weiteren Suchern und freiw. Helfern (ohne App). Sie können einem oder mehreren Sektoren zugeteilt werden.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenSearchTeams}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-blue-300 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer font-mono"
          >
            + Suchtrupp bearbeiten / erstellen
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {teams.length > 0 ? (
            teams.map((team) => {
              const leader = allUsers.find((u) => u.id === team.leaderUserId);
              const members = allUsers.filter((u) => team.memberUserIds?.includes(u.id));
              const assignedSectors = sectors.filter((sec) => team.sectorIds?.includes(sec.id));

              return (
                <div key={team.id} className="bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700/80 rounded-xl p-4 space-y-3 shadow">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      <span>🎯</span> {team.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-mono font-bold">
                      {1 + members.length + (team.externalVolunteersCount || 0)} Personen
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-300 dark:border-slate-700/60">
                      <span className="text-[10px] font-bold text-amber-400 uppercase font-mono block">🎖️ Gruppenführer:</span>
                      <span className="font-bold text-white">{leader?.name || 'Nicht zugewiesen'} ({leader?.callSign || 'k.A.'})</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-100 dark:bg-slate-950/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono block mb-0.5">Sucher ({members.length}):</span>
                        <div className="flex flex-wrap gap-1">
                          {members.length > 0 ? (
                            members.map((m) => (
                              <span key={m.id} className="px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-200 rounded text-[10px] font-mono">
                                {m.callSign}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 italic text-[10px]">Keine Sucher</span>
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-100 dark:bg-slate-950/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[9px] font-bold text-amber-400 uppercase font-mono block mb-0.5">Helfer (ohne App):</span>
                        <span className="text-amber-300 font-bold font-mono text-xs">{team.externalVolunteersCount || 0} Helfer</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase font-mono block mb-1">🗺️ Zuteilung Sektoren:</span>
                      <div className="flex flex-wrap gap-1">
                        {assignedSectors.length > 0 ? (
                          assignedSectors.map((sec) => (
                            <span key={sec.id} className="px-2 py-0.5 bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-[10px] font-mono rounded font-semibold">
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
            <div className="col-span-full py-6 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <p className="font-bold text-slate-700 dark:text-slate-300">Noch keine Suchtrupps für diesen Einsatz gebildet.</p>
              <p className="text-slate-500 mt-0.5">Klicken Sie oben auf „Suchtrupps bilden & zuteilen“, um Trupps aus Gruppenführer, Suchern und Helfern zusammenzustellen.</p>
            </div>
          )}
        </div>
      </div>

      {/* Filter & Search Bar for Individual Personnel */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#1E293B] p-3 rounded-xl border border-slate-300 dark:border-slate-700">
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Einsatzkräfte nach Name, Funkrufname, KFZ-Kennzeichen filtern..."
          className="w-full sm:w-80 px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-black dark:text-slate-100 text-xs focus:outline-none focus:border-blue-500 placeholder-slate-500 font-mono"
        />

        <div className="flex gap-1.5 w-full sm:w-auto flex-wrap">
          {(['all', 'admin', 'einsatzleitung', 'responder', 'observer'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer uppercase tracking-wider font-mono ${
                roleFilter === r
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
              }`}
            >
              {r === 'all'
                ? 'Alle Kräfte'
                : r === 'admin'
                ? '🛡️ Admin'
                : r === 'einsatzleitung'
                ? '📋 EL'
                : r === 'responder'
                ? '🚶 Sucher'
                : `👁️ Betrachter (${observerUsers.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Responders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((user) => {
          const assignedSector = currentOperation?.sectors.find(
            (s) => s.id === user.assignedSectorId || s.assignedUserIds?.includes(user.id)
          );
          const badges = getEquipmentBadges(user.equipment);
          const isMe = user.id === currentUser?.id;

          return (
            <div
              key={user.id}
              className={`rounded-2xl p-5 border transition shadow-xl flex flex-col justify-between ${
                !user.isActive
                  ? 'opacity-50 grayscale bg-slate-100 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800'
                  : user.role === 'admin'
                  ? 'bg-[#1E293B] border-blue-500/50'
                  : 'bg-[#1E293B] border-slate-300 dark:border-slate-700'
              }`}
            >
              <div>
                {/* Header with Photo, Name & Role */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="h-12 w-12 rounded-xl overflow-hidden border-2 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 shadow-md">
                        {user.photoUrl ? (
                          <img src={user.photoUrl} alt={user.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center font-bold text-white text-lg bg-slate-50 dark:bg-slate-800">
                            {user.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <span
                        className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-slate-900 ${
                          user.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'
                        }`}
                        title={user.isActive ? 'Eingeloggt & Aktiv' : 'Abgemeldet / Offline'}
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-sm text-white">{user.name}</h3>
                        {isMe && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500 font-bold font-mono">
                            DU
                          </span>
                        )}
                        <button
                          onClick={() => setUserActiveStatus(user.id, !user.isActive)}
                          className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold transition cursor-pointer ${
                            user.isActive
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-rose-900/40 hover:text-rose-300'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700 hover:bg-emerald-900/40 hover:text-emerald-300'
                          }`}
                          title={user.isActive ? 'Klicken um abzumelden' : 'Klicken um anzumelden'}
                        >
                          {user.isActive ? '● Online' : '○ Abgemeldet'}
                        </button>
                      </div>
                      <div className="text-xs text-blue-400 font-mono font-semibold">{user.callSign}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{user.organization || 'Einsatzkraft'}</div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {isFirstAdmin(user) ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase border bg-slate-50 dark:bg-amber-500/25 text-amber-300 border-amber-400/80 flex items-center gap-1 shadow-sm">
                        <span>👑</span>
                        <span>First Admin (Owner)</span>
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
                          ? '🛡️ Admin'
                          : user.role === 'einsatzleitung'
                          ? user.isAdmin
                            ? '📋 EL & Admin'
                            : '📋 EL'
                          : user.role === 'observer'
                          ? '👁️ Betrachter'
                          : '🦺 Sucher'}
                      </span>
                    )}
                    {!isFirstAdmin(user) && user.role === 'einsatzleitung' && user.isAdmin && (
                      <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-slate-50 dark:bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                        👑 +Admin
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="mt-4 grid grid-cols-2 gap-2 bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-300 dark:border-slate-700/80 text-xs">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block">KFZ-KENNZEICHEN</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                      {user.licensePlate || 'Nicht hinterlegt'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block">AKKUSTAND</span>
                    <span className={`font-bold font-mono ${
                      (user.batteryLevel ?? 100) > 40
                        ? 'text-emerald-400'
                        : (user.batteryLevel ?? 100) > 15
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }`}>
                      {user.batteryCharging ? '⚡' : '🔋'} {user.batteryLevel ?? 100}%
                      {user.batteryCharging && <span className="text-[9px] text-emerald-300 ml-1">(Laden)</span>}
                    </span>
                  </div>

                  <div className="col-span-2 pt-1 border-t border-slate-300 dark:border-slate-700/60">
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block">SEKTOR-ZUWEISUNG</span>
                    <span className="font-semibold text-amber-300 text-[11px]">
                      {assignedSector ? `🎯 ${assignedSector.name}` : '⭕ Kein Sektor zugewiesen'}
                    </span>
                  </div>
                </div>

                {/* Equipment Badges & Custom Tags */}
                {(badges.length > 0 || (user.customEquipmentTags && user.customEquipmentTags.length > 0)) && (
                  <div className="mt-3">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1 font-mono">
                      AUSRÜSTUNG / HILFSMITTEL:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
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
                  </div>
                )}

                {user.customEquipmentNotes && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 p-2 bg-white dark:bg-slate-900/50 rounded-lg border border-slate-300 dark:border-slate-700/50 italic font-mono">
                    "{user.customEquipmentNotes}"
                  </p>
                )}
              </div>

              {/* Action Bar (No individual profile edit button under forces per user request) */}
              <div className="mt-5 pt-3 border-t border-slate-300 dark:border-slate-700 flex items-center justify-between gap-2">
                <div className="flex gap-2 flex-1">
                  {user.phone && (
                    <a
                      href={`tel:${user.phone}`}
                      className="flex-1 py-2 px-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-300 dark:border-slate-700"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      Anruf
                    </a>
                  )}

                  <button
                    onClick={() => onOpenDirectChat(user)}
                    className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Direktfunk
                  </button>

                  {user.isActive && (
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        onFocusUserOnMap();
                      }}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow border border-emerald-500/30"
                      title="Auf taktischer Karte anzeigen & Bewegungsprofil einsehen"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      Karte
                    </button>
                  )}
                </div>

                {(isRealAdmin || canLead) && user.id !== currentUser.id && (
                  <div className="flex gap-1">
                    {isFirstAdmin(user) ? (
                      <div
                        className="px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-amber-950/60 text-amber-300 border border-amber-500/60 font-mono text-[10px] flex items-center gap-1 font-bold select-none cursor-default"
                        title="First Admin & App-Owner (unantastbar)"
                      >
                        <span>👑</span>
                        <span>Owner</span>
                      </div>
                    ) : (
                      <>
                        {isRealAdmin && (
                          <button
                            onClick={() => handleToggleAdminRole(user)}
                            className={`p-2 rounded-lg border transition cursor-pointer ${
                              user.role === 'admin'
                                ? 'bg-red-950/60 hover:bg-red-900/80 text-red-300 border-red-800/80'
                                : user.isAdmin
                                ? 'bg-slate-50 dark:bg-amber-950/60 hover:bg-slate-50 dark:bg-amber-900/80 text-amber-300 border-amber-800/80'
                                : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-50 dark:bg-amber-950/60 text-slate-700 dark:text-slate-300 hover:text-amber-300 border-slate-300 dark:border-slate-700'
                            }`}
                            title={
                              user.role === 'admin'
                                ? 'Admin-Rechte entfernen (zu Einsatzleitung machen)'
                                : user.isAdmin
                                ? 'Admin-Rechte entziehen (nur Einsatzleitung belassen)'
                                : 'Zum Administrator / Einsatzleitung befördern'
                            }
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                        )}
                        {(currentOperation?.participantIds?.includes(user.id) || user.isActive) ? (
                          <button
                            onClick={() => {
                              if (confirm(`${user.name} (${user.callSign}) wirklich aus dem aktuellen Einsatz abmelden?`)) {
                                removeUserFromOperation(user.id);
                              }
                            }}
                            className="p-2 rounded-lg bg-slate-50 dark:bg-amber-950/60 hover:bg-slate-50 dark:bg-amber-900/80 text-amber-300 border border-amber-800/80 transition cursor-pointer"
                            title="Aus dem aktuellen Einsatz abmelden"
                          >
                            <LogOut className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setUserActiveStatus(user.id, true);
                              if (currentOperation) {
                                const updated = Array.from(new Set([...(currentOperation.participantIds || []), user.id]));
                                updateOperation(currentOperation.id, { participantIds: updated });
                              }
                            }}
                            className="p-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/80 transition cursor-pointer"
                            title="In den aktuellen Einsatz aufnehmen"
                          >
                            <UserCheck className="w-4 h-4" />
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

      {/* Dedicated Collapsible Section for Observers / Viewers */}
      <div className="bg-[#1E293B] border border-slate-300 dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Angemeldete Betrachter & Gäste ({observerUsers.length})
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Nur Leseansicht
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Personen, die sich einloggen, aber nicht aktiv an der Suche teilnehmen.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowObserversSection((prev) => !prev)}
            className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>{showObserversSection ? 'Liste verbergen' : `Liste anzeigen (${observerUsers.length})`}</span>
            {showObserversSection ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showObserversSection && (
          <div className="pt-3 border-t border-slate-300 dark:border-slate-700 space-y-3 font-mono text-xs animate-in fade-in duration-150">
            {observerUsers.length === 0 ? (
              <p className="text-slate-500 text-xs py-2">Keine Betrachter-Accounts angelegt.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {observerUsers.map((obs) => (
                  <div
                    key={obs.id}
                    className="p-3.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 flex items-center justify-between gap-2 shadow-sm"
                  >
                    <div className="truncate">
                      <div className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0"></span>
                        <span className="truncate">{obs.name}</span>
                      </div>
                      <div className="text-[10px] text-purple-300 font-mono">{obs.callSign || obs.username}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{obs.organization || 'Gast / Externe Stelle'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
