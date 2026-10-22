import React, { useState } from 'react';
import { useYouth } from '../YouthContext';
import { YouthSector, YouthSquad } from '../types';
import {
  X,
  Layers,
  MapPin,
  Trash2,
  CheckCircle2,
  Users,
  Compass,
  Sparkles,
  Info,
} from 'lucide-react';

interface YouthSectorManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartMapDrawing: (sectorName: string, targetTeam: 'jugend' | 'erwachsene' | 'all') => void;
}

export const YouthSectorManagerModal: React.FC<YouthSectorManagerModalProps> = ({
  isOpen,
  onClose,
  onStartMapDrawing,
}) => {
  const { currentYouthOperation, updateYouthOperation, allYouthUsers } = useYouth();

  const [newSecName, setNewSecName] = useState('Sektor B (Waldkante)');
  const [newSecTeam, setNewSecTeam] = useState<'jugend' | 'erwachsene' | 'all'>('jugend');
  const [geofenceMeters, setGeofenceMeters] = useState<number>(
    currentYouthOperation?.geofenceRadiusMeters || 1200
  );

  if (!isOpen || !currentYouthOperation) return null;

  const sectors = currentYouthOperation.sectors || [];

  const handleDeleteSector = (sectorId: string) => {
    const updated = sectors.filter((s) => s.id !== sectorId);
    updateYouthOperation(currentYouthOperation.id, { sectors: updated });
  };

  const handleToggleStatus = (sectorId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'searched' ? 'open' : 'searched';
    const updated = sectors.map((s) =>
      s.id === sectorId ? { ...s, status: nextStatus as any } : s
    );
    updateYouthOperation(currentYouthOperation.id, { sectors: updated });
  };

  const handleUpdateGeofence = () => {
    updateYouthOperation(currentYouthOperation.id, { geofenceRadiusMeters: Number(geofenceMeters) });
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#000E66] border border-cyan-400/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-900 bg-[#00083D]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Suchgebiet, Sicherheitsgrenze &amp; Sektoren
              </h3>
              <p className="text-[11px] text-cyan-300 font-mono">
                Übung: {currentYouthOperation.title}
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
          {/* SECTION 1: GEOFENCE / SICHERHEITSGRENZE */}
          <div className="p-4 rounded-2xl bg-[#00083D] border border-blue-900 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-300 font-mono font-bold text-xs">
                <span>🛡️</span>
                <span>Sicherheits-Geofence (Maximalradius um Treffpunkt)</span>
              </div>
              <span className="text-xs font-mono text-cyan-300 bg-[#000E66] px-2 py-0.5 rounded border border-blue-800">
                {geofenceMeters} Meter
              </span>
            </div>

            <p className="text-[11px] text-slate-300">
              Verlässt ein Jugendlicher diesen Sicherheitsradius, ertönt in der Einsatzzentrale und auf der Karte sofort ein Warnhinweis.
            </p>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min={300}
                max={5000}
                step={100}
                value={geofenceMeters}
                onChange={(e) => setGeofenceMeters(Number(e.target.value))}
                className="flex-1 accent-amber-400 cursor-pointer"
              />
              <button
                type="button"
                onClick={handleUpdateGeofence}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs uppercase transition cursor-pointer"
              >
                Setzen
              </button>
            </div>
          </div>

          {/* SECTION 2: NEUEN SEKTOR ZEICHNEN */}
          <div className="p-4 rounded-2xl bg-[#00083D] border border-blue-900 space-y-3">
            <h4 className="font-bold text-white uppercase font-mono text-xs flex items-center gap-2">
              <span>✏️</span>
              <span>Neuen Sektor auf Karte einzeichnen</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[10px] text-slate-400 mb-1">Sektorbezeichnung</label>
                <input
                  type="text"
                  value={newSecName}
                  onChange={(e) => setNewSecName(e.target.value)}
                  placeholder="z.B. Sektor B - Waldkante"
                  className="w-full px-3 py-2 rounded-xl bg-[#000E66] border border-blue-800 text-white text-xs font-medium focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Zuständiges Team</label>
                <select
                  value={newSecTeam}
                  onChange={(e) => setNewSecTeam(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-[#000E66] border border-blue-800 text-white text-xs font-mono focus:border-cyan-400 focus:outline-none"
                >
                  <option value="jugend">🎒 Nur Jugend</option>
                  <option value="erwachsene">🦺 Nur Erwachsene</option>
                  <option value="all">👥 Beide Teams / Alle</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onStartMapDrawing(newSecName, newSecTeam);
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs uppercase flex items-center justify-center gap-2 transition cursor-pointer shadow-lg"
            >
              <span>📍 Auf Karte zeichnen starten</span>
            </button>
          </div>

          {/* SECTION 3: VORHANDENE SEKTOREN */}
          <div className="space-y-3">
            <h4 className="font-bold text-white uppercase font-mono text-xs flex items-center justify-between">
              <span>Bestehende Sektoren ({sectors.length})</span>
            </h4>

            {sectors.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Noch keine Sektoren angelegt.</p>
            ) : (
              <div className="space-y-2">
                {sectors.map((sec) => {
                  const isSearched = sec.status === 'searched';
                  return (
                    <div
                      key={sec.id}
                      className="p-3.5 rounded-2xl bg-[#00083D] border border-blue-900 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{sec.name}</span>
                          <span
                            className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded border uppercase ${
                              isSearched
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                                : 'bg-blue-950 text-cyan-300 border-blue-700'
                            }`}
                          >
                            {isSearched ? '✓ Abgesucht' : 'Offen'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                          Team: {sec.assignedTeam === 'jugend' ? '🎒 Jugend' : sec.assignedTeam === 'erwachsene' ? '🦺 Erwachsene' : '👥 Beide'} • {sec.polygon?.length || 0} Eckpunkte
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(sec.id, sec.status)}
                          className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase transition cursor-pointer ${
                            isSearched
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          {isSearched ? 'Wieder öffnen' : 'Als abgesucht markieren'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSector(sec.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition cursor-pointer"
                          title="Sektor löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-blue-900 bg-[#00083D] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs uppercase transition cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
