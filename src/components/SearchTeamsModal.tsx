import React, { useState } from 'react';
import { useRescue } from '../context/RescueContext';
import { SearchTeam, SearchSector } from '../types';
import { X, Users, Plus, Trash2, Edit, Shield, Check, Layers } from 'lucide-react';

interface SearchTeamsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchTeamsModal: React.FC<SearchTeamsModalProps> = ({ isOpen, onClose }) => {
  const { currentOperation, updateOperation, allUsers, currentUser } = useRescue();

  const [isEditing, setIsEditing] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  const [teamName, setTeamName] = useState('Suchtrupp Alpha');
  const [leaderUserId, setLeaderUserId] = useState('');
  const [memberUserIds, setMemberUserIds] = useState<string[]>([]);
  const [externalVolunteersCount, setExternalVolunteersCount] = useState<number>(0);
  const [sectorIds, setSectorIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  if (!isOpen || !currentOperation) return null;

  const teams: SearchTeam[] = currentOperation.teams || [];
  const sectors: SearchSector[] = currentOperation.sectors || [];
  const activeUsers = allUsers.filter((u) => u.role !== 'observer');

  const handleOpenNew = () => {
    setEditingTeamId(null);
    setTeamName(`Suchtrupp ${String.fromCharCode(65 + teams.length)}`);
    setLeaderUserId(activeUsers[0]?.id || '');
    setMemberUserIds([]);
    setExternalVolunteersCount(0);
    setSectorIds([]);
    setNotes('');
    setIsEditing(true);
  };

  const handleOpenEdit = (team: SearchTeam) => {
    setEditingTeamId(team.id);
    setTeamName(team.name);
    setLeaderUserId(team.leaderUserId);
    setMemberUserIds(team.memberUserIds || []);
    setExternalVolunteersCount(team.externalVolunteersCount || 0);
    setSectorIds(team.sectorIds || []);
    setNotes(team.notes || '');
    setIsEditing(true);
  };

  const handleSaveTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      alert('Bitte geben Sie einen Truppnamen ein.');
      return;
    }
    if (!leaderUserId) {
      alert('Bitte bestimmen Sie einen Truppführer.');
      return;
    }

    const teamId = editingTeamId || `team-${Date.now()}`;
    const newTeam: SearchTeam = {
      id: teamId,
      operationId: currentOperation.id,
      name: teamName.trim(),
      leaderUserId,
      memberUserIds: Array.from(new Set(memberUserIds)),
      externalVolunteersCount: Math.max(0, Number(externalVolunteersCount) || 0),
      sectorIds: Array.from(new Set(sectorIds)),
      notes: notes.trim(),
    };

    const updatedTeams = editingTeamId
      ? teams.map((t) => (t.id === editingTeamId ? newTeam : t))
      : [...teams, newTeam];

    // Synchronize sector assignments and assigned user IDs
    const updatedSectors = sectors.map((sec) => {
      const isAssignedToThisTeam = sectorIds.includes(sec.id);
      const teamUserIds = Array.from(new Set([leaderUserId, ...memberUserIds]));
      const oldTeam = teams.find((t) => t.id === teamId);
      const oldTeamUserIds = oldTeam ? [oldTeam.leaderUserId, ...(oldTeam.memberUserIds || [])] : [];

      if (isAssignedToThisTeam) {
        const mergedUserIds = Array.from(new Set([...(sec.assignedUserIds || []), ...teamUserIds]));
        return {
          ...sec,
          assignedGroupName: sec.assignedGroupName || newTeam.name,
          assignedUserIds: mergedUserIds,
        };
      } else {
        // If unassigned from this team, remove team users from sector assignedUserIds if no other team uses them here
        const isUsedByOtherTeam = teams.some((t) => t.id !== teamId && t.sectorIds?.includes(sec.id) && ([t.leaderUserId, ...(t.memberUserIds || [])].some(id => teamUserIds.includes(id))));
        if (!isUsedByOtherTeam) {
          return {
            ...sec,
            assignedGroupName: sec.assignedGroupName === newTeam.name ? undefined : sec.assignedGroupName,
            assignedUserIds: (sec.assignedUserIds || []).filter((id) => !teamUserIds.includes(id)),
          };
        }
      }
      return sec;
    });

    updateOperation(currentOperation.id, {
      teams: updatedTeams,
      sectors: updatedSectors,
    });

    setIsEditing(false);
  };

  const handleDeleteTeam = (teamId: string) => {
    if (!window.confirm('Möchten Sie diesen Suchtrupp wirklich auflösen?')) return;
    const teamToDelete = teams.find((t) => t.id === teamId);
    const updatedTeams = teams.filter((t) => t.id !== teamId);

    const teamUserIds = teamToDelete ? [teamToDelete.leaderUserId, ...(teamToDelete.memberUserIds || [])] : [];
    const updatedSectors = sectors.map((sec) => {
      if (teamToDelete?.sectorIds?.includes(sec.id)) {
        return {
          ...sec,
          assignedGroupName: sec.assignedGroupName === teamToDelete.name ? undefined : sec.assignedGroupName,
          assignedUserIds: (sec.assignedUserIds || []).filter((id) => !teamUserIds.includes(id)),
        };
      }
      return sec;
    });

    updateOperation(currentOperation.id, {
      teams: updatedTeams,
      sectors: updatedSectors,
    });
  };

  const toggleSectorSelection = (secId: string) => {
    setSectorIds((prev) =>
      prev.includes(secId) ? prev.filter((id) => id !== secId) : [...prev, secId]
    );
  };

  const toggleMemberSelection = (userId: string) => {
    setMemberUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/40 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wide">
                Suchtrupp-Verwaltung & Sektoren-Zuteilung
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Einsatz: {currentOperation.title} • Trupps flexibel bilden & mehreren Sektoren zuteilen
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
          {!isEditing ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base">Aktive Suchtrupps ({teams.length})</h3>
                  <p className="text-xs text-slate-400">
                    Trupps bestehen aus einem Truppführer, Suchern (nur eingeloggte User) und freiwilligen Helfern. Ein Trupp kann auf mehreren Sektoren gleichzeitig eingesetzt werden.
                  </p>
                </div>
                {currentUser?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={handleOpenNew}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Suchtrupp bilden
                  </button>
                )}
              </div>

              {/* Teams Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teams.length > 0 ? (
                  teams.map((team) => {
                    const leader = allUsers.find((u) => u.id === team.leaderUserId);
                    const members = allUsers.filter((u) => team.memberUserIds?.includes(u.id));
                    const assignedSectors = sectors.filter((sec) => team.sectorIds?.includes(sec.id));

                    return (
                      <div
                        key={team.id}
                        className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 space-y-3 shadow-lg flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🐕‍🦺</span>
                              <h4 className="font-bold text-white text-sm">{team.name}</h4>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-mono font-bold">
                              {(1 + members.length + (team.externalVolunteersCount || 0))} Personen stark
                            </span>
                          </div>

                          {/* Leader */}
                          <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60 text-xs">
                            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block font-mono mb-0.5">
                              🎖️ TRUPPFÜHRER:
                            </span>
                            <div className="font-bold text-white flex items-center justify-between">
                              <span>{leader?.name || 'Nicht zugewiesen'} ({leader?.callSign || 'k.A.'})</span>
                              <span className="text-[10px] text-slate-400 font-mono">{leader?.organization || 'Rettungsdienst'}</span>
                            </div>
                          </div>

                          {/* Members & External Volunteers */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                              <span className="text-[9px] font-bold text-slate-400 uppercase font-mono block mb-1">
                                Sucher ({members.length}):
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {members.length > 0 ? (
                                  members.map((m) => (
                                    <span key={m.id} className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[10px] font-mono">
                                      {m.callSign}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-slate-500 italic text-[10px]">Keine Sucher</span>
                                )}
                              </div>
                            </div>

                            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                              <span className="text-[9px] font-bold text-amber-400 uppercase font-mono block mb-1">
                                Freiw. Helfer (ohne Account):
                              </span>
                              <div className="font-bold text-amber-300 text-sm font-mono">
                                {team.externalVolunteersCount || 0} Helfer
                              </div>
                            </div>
                          </div>

                          {/* Assigned Multiple Sectors */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono block">
                              🗺️ ZUTEILUNG Sektoren ({assignedSectors.length}):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {assignedSectors.length > 0 ? (
                                assignedSectors.map((sec) => (
                                  <span
                                    key={sec.id}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-950/50 border border-emerald-800/80 text-emerald-200 text-xs font-mono font-semibold"
                                  >
                                    🎯 {sec.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-500 italic text-[11px]">Kein Sektor zugeteilt</span>
                              )}
                            </div>
                          </div>

                          {team.notes && (
                            <p className="text-[11px] text-slate-300 bg-slate-950/50 p-2 rounded-lg border border-slate-800 italic">
                              "{team.notes}"
                            </p>
                          )}
                        </div>

                        {currentUser?.role === 'admin' && (
                          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(team)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer border border-slate-700 flex items-center gap-1"
                            >
                              <Edit className="w-3.5 h-3.5" /> Bearbeiten
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTeam(team.id)}
                              className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900 text-red-300 rounded-xl text-xs font-bold transition cursor-pointer border border-red-800/80 flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Auflösen
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-12 text-center text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800">
                    <Users className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                    <p className="font-bold text-slate-300">Noch keine Suchtrupps gebildet</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Klicken Sie auf "Suchtrupp bilden", um Trupps aus eingeloggten Kräften und Freiwilligen zusammenzustellen.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Edit / Create Form */
            <form onSubmit={handleSaveTeam} className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <h3 className="font-bold text-white text-base">
                  {editingTeamId ? 'Suchtrupp bearbeiten' : 'Neuen Suchtrupp bilden'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer font-mono"
                >
                  ← Zurück zur Übersicht
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-300 mb-1 font-mono uppercase tracking-wider text-[11px]">
                    Trupp-Name:
                  </label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="z.B. Suchtrupp Alpha / Mantrailer 1"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1 font-mono uppercase tracking-wider text-[11px]">
                    Truppführer (nur eingeloggte User):
                  </label>
                  <select
                    value={leaderUserId}
                    onChange={(e) => setLeaderUserId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                    required
                  >
                    <option value="">-- Truppführer wählen --</option>
                    {activeUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.callSign})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Members (Sucher) */}
              <div>
                <label className="block font-bold text-slate-300 mb-1.5 font-mono uppercase tracking-wider text-[11px]">
                  Weitere Sucher (eingeloggte aktive Einsatzkräfte):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-900/80 rounded-xl border border-slate-800">
                  {activeUsers.map((u) => {
                    const isSelected = memberUserIds.includes(u.id);
                    const isLeader = u.id === leaderUserId;
                    if (isLeader) return null; // Can't be member if already leader

                    return (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => toggleMemberSelection(u.id)}
                        className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center justify-between text-xs font-mono ${
                          isSelected
                            ? 'bg-blue-600/30 border-blue-500 text-white'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-bold truncate">{u.name}</div>
                          <div className="text-[10px] text-slate-400">{u.callSign}</div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* External Volunteers Count */}
              <div>
                <label className="block font-bold text-slate-300 mb-1 font-mono uppercase tracking-wider text-[11px]">
                  Anzahl freiwilliger Helfer (einmalige Helfer ohne Account):
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={externalVolunteersCount}
                  onChange={(e) => setExternalVolunteersCount(parseInt(e.target.value) || 0)}
                  className="w-full sm:w-48 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Zusätzliche Bürger, Feuerwehrleute oder Anwohner ohne eigene App-Registrierung, die diesen Trupp verstärken.
                </span>
              </div>

              {/* Multiple Sectors Assignment */}
              <div>
                <label className="block font-bold text-slate-300 mb-1.5 font-mono uppercase tracking-wider text-[11px]">
                  Zuteilung zu Suchsektoren (Mehrfach-Auswahl möglich):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-900/80 rounded-xl border border-slate-800">
                  {sectors.map((sec) => {
                    const isSelected = sectorIds.includes(sec.id);
                    return (
                      <button
                        type="button"
                        key={sec.id}
                        onClick={() => toggleSectorSelection(sec.id)}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between text-xs font-mono ${
                          isSelected
                            ? 'bg-emerald-600/30 border-emerald-500 text-white'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-bold">{sec.name}</div>
                          <div className="text-[10px] text-slate-400">
                            ca. {sec.areaHectares || 25} ha • Status: {sec.status.toUpperCase()}
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1 font-mono uppercase tracking-wider text-[11px]">
                  Zusätzliche Notizen / Ausrüstung:
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="z.B. Ausgestattet mit FLIR-Drohne und Funkgerät Kanal 2"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer border border-slate-700"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs cursor-pointer shadow-lg"
                >
                  Suchtrupp speichern
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-900 border-t border-slate-700 flex items-center justify-between shrink-0">
          <div className="text-[10px] text-slate-400 font-mono">
            Suchtrupp-Verwaltung • {teams.length} Trupps aktiv
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs cursor-pointer border border-slate-700"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
