import React from 'react';
import { useRescue } from '../context/RescueContext';
import { SearchSector, SectorStatus, EquipmentType } from '../types';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Compass,
  Users,
  Edit,
  Trash2,
  MapPin,
  Check,
  Shield,
  Download,
} from 'lucide-react';
import { exportSectorAsKml } from '../lib/kmlExport';

interface SectorOverviewProps {
  onOpenSectorEditor: (sector?: SearchSector) => void;
  onFocusSectorOnMap?: (sector: SearchSector) => void;
  onOpenSearchTeams: () => void;
}

function getEquipmentIcon(eq: EquipmentType): string {
  switch (eq) {
    case 'drone':
      return '🚁';
    case 'k9_mantrailer':
      return '🐕';
    case 'k9_area':
      return '🐾';
    case 'quad':
      return '🚜';
    case 'boat':
      return '🚤';
    case 'foot_search':
      return '🚶';
    case 'flir':
      return '🌡️';
    default:
      return '📦';
  }
}

export const SectorOverview: React.FC<SectorOverviewProps> = ({
  onOpenSectorEditor,
  onFocusSectorOnMap,
  onOpenSearchTeams,
}) => {
  const { currentOperation, allUsers, setSectorStatus, deleteSector, currentUser } = useRescue();

  if (!currentOperation) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        Kein aktiver Einsatz ausgewählt.
      </div>
    );
  }

  const sectors = currentOperation.sectors || [];
  const searchedCount = sectors.filter((s) => s.status === 'searched').length;
  const inProgressCount = sectors.filter((s) => s.status === 'in_progress').length;
  const openCount = sectors.filter((s) => s.status === 'open').length;
  const totalHectares = sectors.reduce((acc, s) => acc + (s.areaHectares || 25), 0);
  const searchedHectares = sectors
    .filter((s) => s.status === 'searched')
    .reduce((acc, s) => acc + (s.areaHectares || 25), 0);

  const percentComplete = sectors.length > 0 ? Math.round((searchedCount / sectors.length) * 100) : 0;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5 text-black dark:text-slate-100 font-sans">
      {/* Top Banner Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#1E293B] border border-slate-300 dark:border-slate-700 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white uppercase tracking-wide">Suchsektoren & Gebietsaufteilung</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Einsatzgebiet: {currentOperation.title} • Gesamtfläche: ca. {totalHectares} ha
              </p>
            </div>
          </div>
        </div>

        {/* Progress pill & Action */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="bg-white dark:bg-slate-900/90 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-right">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">
              Abgesuchte Fläche
            </div>
            <div className="text-base font-black text-emerald-400 font-mono">
              {percentComplete}% ({searchedHectares} / {totalHectares} ha)
            </div>
          </div>

          <button
            onClick={onOpenSearchTeams}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-blue-300 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold shadow-lg transition cursor-pointer"
          >
            <span>🐕‍🦺</span> Suchtrupps ({currentOperation.teams?.length || 0})
          </button>

          {currentUser?.role === 'admin' && (
            <button
              onClick={() => onOpenSectorEditor()}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Sektor anlegen
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-full h-2.5 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 via-emerald-500 to-green-400 h-full rounded-full transition-all duration-500"
          style={{ width: `${percentComplete}%` }}
        />
      </div>

      {/* Quick Filter Counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#1E293B] border border-emerald-500/40 p-4 rounded-xl shadow">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block font-mono">
            ● ABGESUCHT (GRÜN)
          </span>
          <span className="text-2xl font-black text-emerald-300 font-mono mt-1 block">
            {searchedCount} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Sektoren</span>
          </span>
        </div>

        <div className="bg-[#1E293B] border border-amber-500/40 p-4 rounded-xl shadow">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block font-mono">
            ● IN BEARBEITUNG
          </span>
          <span className="text-2xl font-black text-amber-300 font-mono mt-1 block">
            {inProgressCount} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Sektoren</span>
          </span>
        </div>

        <div className="bg-[#1E293B] border border-blue-500/40 p-4 rounded-xl shadow">
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block font-mono">
            ● OFFEN / GEPLANT
          </span>
          <span className="text-2xl font-black text-blue-300 font-mono mt-1 block">
            {openCount} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Sektoren</span>
          </span>
        </div>

        <div className="bg-[#1E293B] border border-slate-300 dark:border-slate-700 p-4 rounded-xl shadow">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-mono">
            GESAMTE SEKTOREN
          </span>
          <span className="text-2xl font-black text-white font-mono mt-1 block">
            {sectors.length} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Sektoren</span>
          </span>
        </div>
      </div>

      {/* Sector Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sectors.map((sec) => {
          const isSearched = sec.status === 'searched';
          const isInProgress = sec.status === 'in_progress';
          const assignedUsers = allUsers.filter((u) => sec.assignedUserIds?.includes(u.id));

          return (
            <div
              key={sec.id}
              className={`rounded-2xl p-5 border transition shadow-xl relative overflow-hidden flex flex-col justify-between ${
                isSearched
                  ? 'bg-[#1E293B] border-emerald-500/60 ring-1 ring-emerald-500/20'
                  : isInProgress
                  ? 'bg-[#1E293B] border-amber-500/60'
                  : 'bg-[#1E293B] border-slate-300 dark:border-slate-700'
              }`}
            >
              {/* Top Sector Info */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{isSearched ? '✅' : isInProgress ? '⏳' : '🎯'}</span>
                    <div>
                      <h3 className="font-bold text-base text-white leading-tight">{sec.name}</h3>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                        ca. {sec.areaHectares || 25} ha • Priorität: {sec.priority.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider font-mono border ${
                      isSearched
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                        : isInProgress
                        ? 'bg-slate-50 dark:bg-amber-500/20 text-amber-300 border-amber-500'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500'
                    }`}
                  >
                    {isSearched ? 'Abgesucht (Grün)' : isInProgress ? 'In Suche' : 'Offen'}
                  </span>
                </div>

                {sec.notes && (
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-3 p-2.5 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-300 dark:border-slate-700/60 italic">
                    "{sec.notes}"
                  </p>
                )}

                {/* Assigned Units & Equipment Badges */}
                <div className="mt-4 space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1 font-mono">
                      ZUGETEILTE KRÄFTE ({assignedUsers.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {assignedUsers.length > 0 ? (
                        assignedUsers.map((u) => (
                          <span
                            key={u.id}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs"
                          >
                            <span className="text-sm">
                              {u.equipment.includes('drone')
                                ? '🚁'
                                : u.equipment.includes('k9_mantrailer') || u.equipment.includes('k9_area')
                                ? '🐕'
                                : '👤'}
                            </span>
                            <span className="font-semibold">{u.callSign}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">Keine Kräfte zugewiesen</span>
                      )}
                    </div>
                  </div>

                  {sec.assignedEquipment && sec.assignedEquipment.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1 font-mono">
                        EINGESETZTE HILFSMITTEL:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {sec.assignedEquipment.map((eq) => (
                          <span
                            key={eq}
                            className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[10px] font-medium uppercase font-mono"
                          >
                            {getEquipmentIcon(eq)} {eq}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {sec.clearedAt && (
                    <div className="text-[10px] text-emerald-400 bg-emerald-950/40 p-2 rounded-lg border border-emerald-900 font-mono">
                      ✓ Abgesucht am {new Date(sec.clearedAt).toLocaleTimeString()} durch {sec.clearedBy || 'Sucher'}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-5 pt-3 border-t border-slate-300 dark:border-slate-700 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    const next: SectorStatus = isSearched ? 'in_progress' : 'searched';
                    setSectorStatus(sec.id, next);
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow ${
                    isSearched
                      ? 'bg-slate-50 dark:bg-amber-600 hover:bg-slate-50 dark:bg-amber-500 text-slate-950'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSearched ? 'Status zurücksetzen' : 'Als abgesucht markieren (Grün)'}
                </button>

                {onFocusSectorOnMap && (
                  <button
                    onClick={() => onFocusSectorOnMap(sec)}
                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition cursor-pointer"
                    title="Auf Karte anzeigen"
                  >
                    <Compass className="w-4 h-4 text-blue-400" />
                  </button>
                )}
                
                <button
                  onClick={() => exportSectorAsKml(sec)}
                  className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400 border border-slate-300 dark:border-slate-700 transition cursor-pointer"
                  title="Drohnen-Export (KML)"
                >
                  <Download className="w-4 h-4" />
                </button>

                {currentUser?.role === 'admin' && (
                  <>
                    <button
                      onClick={() => onOpenSectorEditor(sec)}
                      className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition cursor-pointer"
                      title="Sektor bearbeiten"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`🚨 Sektor "${sec.name}" wirklich endgültig löschen?`)) {
                          deleteSector(sec.id);
                        }
                      }}
                      className="p-2 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/80 transition cursor-pointer"
                      title="Sektor löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
