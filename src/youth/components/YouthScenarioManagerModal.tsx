import React, { useState } from 'react';
import { useYouth } from '../YouthContext';
import { YouthSquad, YouthScenarioMode } from '../types';
import {
  X,
  Users,
  Trophy,
  Layers,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Shuffle,
} from 'lucide-react';

interface YouthScenarioManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_SQUAD_COLORS = ['#38bdf8', '#f59e0b', '#a855f7', '#10b981', '#f43f5e'];

export const YouthScenarioManagerModal: React.FC<YouthScenarioManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentYouthOperation, updateYouthOperation, allYouthUsers } = useYouth();

  const [mode, setMode] = useState<YouthScenarioMode>(
    currentYouthOperation?.scenarioMode || 'multi_sector'
  );
  const [squads, setSquads] = useState<YouthSquad[]>(
    currentYouthOperation?.squads || [
      {
        id: 'squad-1',
        name: 'Trupp 1 (Spürnasen)',
        color: '#38bdf8',
        memberIds: [],
      },
      {
        id: 'squad-2',
        name: 'Trupp 2 (Fährtenfüchse)',
        color: '#f59e0b',
        memberIds: [],
      },
    ]
  );

  const [newSquadName, setNewSquadName] = useState('');

  if (!isOpen || !currentYouthOperation) return null;

  // Auto-distribute members evenly across squads
  const handleAutoDistribute = () => {
    if (squads.length === 0) return;
    const shuffled = [...allYouthUsers].sort(() => Math.random() - 0.5);
    const newSquads = squads.map((sq) => ({ ...sq, memberIds: [] as string[] }));

    shuffled.forEach((u, index) => {
      const targetSquadIndex = index % squads.length;
      newSquads[targetSquadIndex].memberIds.push(u.id);
    });

    setSquads(newSquads);
  };

  const handleToggleMemberInSquad = (squadId: string, userId: string) => {
    setSquads((prev) =>
      prev.map((sq) => {
        if (sq.id === squadId) {
          const exists = sq.memberIds.includes(userId);
          const nextMemberIds = exists
            ? sq.memberIds.filter((id) => id !== userId)
            : [...sq.memberIds, userId];
          return { ...sq, memberIds: nextMemberIds };
        } else {
          // Remove from other squads to avoid double assignment
          return { ...sq, memberIds: sq.memberIds.filter((id) => id !== userId) };
        }
      })
    );
  };

  const handleAddSquad = () => {
    if (!newSquadName.trim()) return;
    const nextColor = DEFAULT_SQUAD_COLORS[squads.length % DEFAULT_SQUAD_COLORS.length];
    const newSq: YouthSquad = {
      id: `squad-${Date.now()}`,
      name: newSquadName.trim(),
      color: nextColor,
      memberIds: [],
    };
    setSquads((prev) => [...prev, newSq]);
    setNewSquadName('');
  };

  const handleDeleteSquad = (squadId: string) => {
    setSquads((prev) => prev.filter((s) => s.id !== squadId));
  };

  const handleSave = () => {
    updateYouthOperation(currentYouthOperation.id, {
      scenarioMode: mode,
      squads,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#000E66] border border-cyan-400/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-900 bg-[#00083D]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Übungs-Szenario &amp; Trupp-Einteilung
              </h3>
              <p className="text-[11px] text-cyan-300 font-mono">
                Aufteilung in Gruppen, Sektoren oder Zeit-Challenge
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* SCENARIO MODE SELECTOR */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-white uppercase font-mono">
              Wähle das Übungs-Szenario:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option A */}
              <button
                type="button"
                onClick={() => setMode('multi_sector')}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  mode === 'multi_sector'
                    ? 'bg-blue-950 border-cyan-400 ring-2 ring-cyan-400/30 shadow-lg'
                    : 'bg-[#00083D] border-blue-900 hover:border-blue-700'
                }`}
              >
                <div>
                  <div className="text-2xl mb-1">🗺️</div>
                  <span className="font-bold text-xs text-white block">
                    Sektor-Aufteilung
                  </span>
                  <p className="text-[10px] text-slate-300 mt-1 leading-snug">
                    Ein Suchgebiet aufgeteilt auf mehrere Sektoren (Trupp 1 in Sektor A, Trupp 2 in Sektor B).
                  </p>
                </div>
                {mode === 'multi_sector' && (
                  <span className="text-[9px] font-bold font-mono text-cyan-300 mt-3 block">
                    ✓ Aktiviert
                  </span>
                )}
              </button>

              {/* Option B */}
              <button
                type="button"
                onClick={() => setMode('speed_challenge')}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  mode === 'speed_challenge'
                    ? 'bg-amber-950/80 border-amber-400 ring-2 ring-amber-400/30 shadow-lg'
                    : 'bg-[#00083D] border-blue-900 hover:border-blue-700'
                }`}
              >
                <div>
                  <div className="text-2xl mb-1">⏱️</div>
                  <span className="font-bold text-xs text-amber-200 block">
                    Wettlauf auf Zeit (Challenge)
                  </span>
                  <p className="text-[10px] text-slate-300 mt-1 leading-snug">
                    2 oder 3 Trupps im selben Suchgebiet gegeneinander: Wer findet das Ziel als Erstes?
                  </p>
                </div>
                {mode === 'speed_challenge' && (
                  <span className="text-[9px] font-bold font-mono text-amber-300 mt-3 block">
                    ✓ Aktiviert
                  </span>
                )}
              </button>

              {/* Option C */}
              <button
                type="button"
                onClick={() => setMode('joint_teams')}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  mode === 'joint_teams'
                    ? 'bg-purple-950/80 border-purple-400 ring-2 ring-purple-400/30 shadow-lg'
                    : 'bg-[#00083D] border-blue-900 hover:border-blue-700'
                }`}
              >
                <div>
                  <div className="text-2xl mb-1">🤝</div>
                  <span className="font-bold text-xs text-purple-200 block">
                    Gemeinsame Teams
                  </span>
                  <p className="text-[10px] text-slate-300 mt-1 leading-snug">
                    Erwachsene &amp; Jugend in gemischten Trupps oder flexiblen Teams (nicht nur starr gegeneinander).
                  </p>
                </div>
                {mode === 'joint_teams' && (
                  <span className="text-[9px] font-bold font-mono text-purple-300 mt-3 block">
                    ✓ Aktiviert
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* SQUADS SETUP */}
          <div className="p-4 rounded-2xl bg-[#00083D] border border-blue-900 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white uppercase font-mono text-xs flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>Trupps &amp; Teams festlegen ({squads.length})</span>
                </h4>
                <p className="text-[10px] text-slate-400">
                  Weise die Jugendlichen ihren jeweiligen Suchtrupps zu
                </p>
              </div>

              <button
                type="button"
                onClick={handleAutoDistribute}
                className="px-3 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-cyan-300 border border-cyan-400/40 text-[11px] font-mono flex items-center gap-1.5 transition cursor-pointer"
                title="Mitglieder gleichmäßig auf alle Trupps verteilen"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Zufällig verteilen</span>
              </button>
            </div>

            {/* Squads List */}
            <div className="space-y-3">
              {squads.map((sq) => (
                <div
                  key={sq.id}
                  className="p-3.5 rounded-2xl bg-[#000E66] border border-blue-900 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: sq.color }}
                      />
                      <span className="font-bold text-xs text-white">{sq.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({sq.memberIds.length} Mitglieder)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteSquad(sq.id)}
                      className="p-1 text-slate-400 hover:text-rose-400 transition"
                      title="Trupp entfernen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Members Selection Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {allYouthUsers.map((u) => {
                      const isAssigned = sq.memberIds.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleToggleMemberInSquad(sq.id, u.id)}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-mono transition cursor-pointer flex items-center gap-1 ${
                            isAssigned
                              ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                              : 'bg-[#00083D] text-slate-300 hover:text-white border border-blue-900'
                          }`}
                        >
                          {isAssigned && <span>✓</span>}
                          <span>{u.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Add squad input */}
            <div className="flex gap-2 pt-2 border-t border-blue-900">
              <input
                type="text"
                value={newSquadName}
                onChange={(e) => setNewSquadName(e.target.value)}
                placeholder="Neuer Truppname (z.B. Trupp 3 - Suchkometen)"
                className="flex-1 px-3 py-2 rounded-xl bg-[#000E66] border border-blue-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={handleAddSquad}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs uppercase flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Trupp hinzufügen</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-blue-900 bg-[#00083D] flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs uppercase transition cursor-pointer"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs uppercase flex items-center gap-2 transition cursor-pointer shadow-lg"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Szenario aktivieren</span>
          </button>
        </div>
      </div>
    </div>
  );
};
