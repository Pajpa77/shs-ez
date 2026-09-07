import React, { useState, useEffect } from 'react';
import { useRescue } from '../context/RescueContext';
import { SearchSector, SectorPriority, SectorStatus, EquipmentType, User } from '../types';
import { VEREINSBUERO_LOCATION } from '../mockData';
import {
  Layers,
  X,
  CheckCircle2,
  AlertTriangle,
  Users,
  Compass,
  Sparkles,
  Save,
  Trash2,
  PenTool,
  Download,
} from 'lucide-react';
import { exportSectorAsKml } from '../lib/kmlExport';

interface SectorEditorModalProps {
  sector: SearchSector | null;
  isOpen: boolean;
  onClose: () => void;
  onStartDrawing?: () => void;
  pendingPolygon?: [number, number][];
}

// Calculate geodesic area in hectares for a polygon
function calculatePolygonHectares(coords: [number, number][]): number {
  if (coords.length < 3) return 0;
  const R = 6378137; // meters
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const lat1 = (coords[i][0] * Math.PI) / 180;
    const lat2 = (coords[j][0] * Math.PI) / 180;
    const lon1 = (coords[i][1] * Math.PI) / 180;
    const lon2 = (coords[j][1] * Math.PI) / 180;
    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  area = (Math.abs(area) * R * R) / 2.0;
  return Number((area / 10000).toFixed(1));
}

const EQUIPMENT_OPTIONS: { id: EquipmentType; label: string; icon: string }[] = [
  { id: 'drone', label: 'Drohne / UAS (Luftaufklärung)', icon: '🚁' },
  { id: 'k9_mantrailer', label: 'K9 Mantrailer (Fährtenhund)', icon: '🐕' },
  { id: 'k9_area', label: 'K9 Flächensuchhund', icon: '🐾' },
  { id: 'k9_cadaver', label: 'K9 Leichenspürhund (HRD)', icon: '🐕‍🦺' },
  { id: 'foot_search', label: 'Fußsuchtrupp (Suchkette)', icon: '🚶' },
  { id: 'quad', label: 'Quad / ATV (Gelände)', icon: '🚜' },
  { id: 'boat', label: 'Boot / Wasserrettung', icon: '🚤' },
  { id: 'flir', label: 'Wärmebildkamera (FLIR)', icon: '🌡️' },
];

export const SectorEditorModal: React.FC<SectorEditorModalProps> = ({
  sector,
  isOpen,
  onClose,
  onStartDrawing,
  pendingPolygon,
}) => {
  const { currentOperation, allUsers, addSector, updateSector, deleteSector, setSectorStatus, currentUser, updateOperation } = useRescue();

  const [name, setName] = useState('');
  const [priority, setPriority] = useState<SectorPriority>('high');
  const [status, setStatus] = useState<SectorStatus>('open');
  const [assignedGroupName, setAssignedGroupName] = useState('');
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [assignedTeamIds, setAssignedTeamIds] = useState<string[]>([]);
  const [assignedEquipment, setAssignedEquipment] = useState<EquipmentType[]>([]);
  const [notes, setNotes] = useState('');
  const [areaHectares, setAreaHectares] = useState<number>(25);
  const [errorMsg, setErrorMsg] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setShowDeleteConfirm(false);
    if (sector) {
      setName(sector.name);
      setPriority(sector.priority);
      setStatus(sector.status);
      setAssignedGroupName(sector.assignedGroupName || '');
      setAssignedUserIds(sector.assignedUserIds || []);
      const teamsForThisSector = (currentOperation?.teams || []).filter((t) => t.sectorIds?.includes(sector.id));
      setAssignedTeamIds(teamsForThisSector.map((t) => t.id));
      setAssignedEquipment(sector.assignedEquipment || []);
      setNotes(sector.notes || '');
      if (pendingPolygon && pendingPolygon.length >= 3) {
        setAreaHectares(calculatePolygonHectares(pendingPolygon));
      } else {
        setAreaHectares(sector.areaHectares || 25);
      }
    } else {
      setName(`Sektor ${String.fromCharCode(65 + (currentOperation?.sectors.length || 0))} - Suchgebiet`);
      setPriority('high');
      setStatus('open');
      setAssignedGroupName('');
      setAssignedUserIds([]);
      setAssignedTeamIds([]);
      setAssignedEquipment([]);
      setNotes('');
      if (pendingPolygon && pendingPolygon.length >= 3) {
        setAreaHectares(calculatePolygonHectares(pendingPolygon));
      } else {
        setAreaHectares(20 + Math.floor(Math.random() * 15));
      }
    }
  }, [sector, currentOperation, isOpen, pendingPolygon]);

  if (!isOpen) return null;

  if (currentUser?.role !== 'admin') {
    return (
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-950/80 backdrop-blur-md">
        <div className="bg-[#1E293B] border border-red-500/50 rounded-2xl p-6 max-w-md text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-600/20 text-red-400 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Zugriff verweigert</h3>
          <p className="text-xs text-slate-700 dark:text-slate-300">
            Nur Einsatzleiter & Administratoren dürfen Suchsektoren zeichnen oder bearbeiten.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-xl font-bold text-xs"
          >
            Schließen
          </button>
        </div>
      </div>
    );
  }

  const toggleUserAssignment = (userId: string) => {
    setAssignedUserIds((prev) => {
      const exists = prev.includes(userId);
      const next = exists ? prev.filter((id) => id !== userId) : [...prev, userId];

      // Auto-extract equipment from assigned users
      const users = allUsers.filter((u) => next.includes(u.id));
      const autoEquip = Array.from(new Set(users.flatMap((u) => u.equipment)));
      setAssignedEquipment(autoEquip);

      return next;
    });
  };

  const toggleEquipment = (eq: EquipmentType) => {
    setAssignedEquipment((prev) =>
      prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!name.trim()) {
      setErrorMsg('Bitte geben Sie einen Sektornamen an.');
      return;
    }

    const targetSectorId = sector ? sector.id : `sector-${Date.now()}`;

    // Update teams sectorIds
    if (currentOperation) {
      const updatedTeams = (currentOperation.teams || []).map((t) => {
        const shouldHaveSector = assignedTeamIds.includes(t.id);
        const hasSector = t.sectorIds?.includes(targetSectorId);
        if (shouldHaveSector && !hasSector) {
          return { ...t, sectorIds: [...(t.sectorIds || []), targetSectorId] };
        } else if (!shouldHaveSector && hasSector) {
          return { ...t, sectorIds: (t.sectorIds || []).filter((id) => id !== targetSectorId) };
        }
        return t;
      });
      updateOperation(currentOperation.id, { teams: updatedTeams });
    }

    if (sector) {
      // Update existing sector
      updateSector(sector.id, {
        name: name.trim(),
        priority,
        status,
        assignedGroupName: assignedGroupName.trim() || undefined,
        assignedUserIds,
        assignedEquipment,
        notes: notes.trim(),
        areaHectares,
        polygon: pendingPolygon || sector.polygon,
      });
      if (status !== sector.status) {
        setSectorStatus(sector.id, status);
      }
    } else {
      // Create new sector
      const defaultCenterLat = currentOperation?.headquartersLocation?.lat || currentOperation?.missingPerson?.lastSeenLocation?.lat || VEREINSBUERO_LOCATION.lat;
      const defaultCenterLng = currentOperation?.headquartersLocation?.lng || currentOperation?.missingPerson?.lastSeenLocation?.lng || VEREINSBUERO_LOCATION.lng;

      // Use pending polygon or generate a realistic box around center
      const polygon: [number, number][] = pendingPolygon || [
        [defaultCenterLat + 0.003, defaultCenterLng - 0.004],
        [defaultCenterLat + 0.004, defaultCenterLng + 0.003],
        [defaultCenterLat - 0.002, defaultCenterLng + 0.005],
        [defaultCenterLat - 0.003, defaultCenterLng - 0.003],
      ];

      addSector({
        id: targetSectorId,
        name: name.trim(),
        polygon,
        status,
        priority,
        assignedGroupName: assignedGroupName.trim() || undefined,
        assignedUserIds,
        assignedEquipment,
        notes: notes.trim(),
        areaHectares,
      });
    }

    onClose();
  };

  const handleDelete = () => {
    if (sector) {
      deleteSector(sector.id);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-3 sm:p-4 bg-slate-100 dark:bg-slate-950/80 backdrop-blur-md overflow-y-auto font-sans">
      <div className="bg-[#1E293B] border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl text-black dark:text-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900/90 p-4 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-blue-400 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                {sector ? `Sektor bearbeiten: ${sector.name}` : 'Neuen Suchsektor anlegen'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Suchgebiet aufteilen, Kräfte zuteilen und Status verwalten
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-700 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/90 border border-red-600 text-red-300 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Sector Name & Hectares */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-mono">
                Sektor-Bezeichnung *:
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Sektor Alpha - Waldstück Nord"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-black dark:text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-mono">
                Fläche (Hektar):
              </label>
              <input
                type="number"
                value={areaHectares}
                onChange={(e) => setAreaHectares(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-black dark:text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Sector Status (Key feature: Abgesucht = Green!) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
              Suchstatus des Sektors:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
              {[
                { id: 'open', label: 'Offen', icon: '⭕', color: 'border-blue-500/50 bg-blue-500/20 text-blue-300' },
                { id: 'in_progress', label: 'In Suche', icon: '⏳', color: 'border-amber-500/50 bg-slate-50 dark:bg-[#0F172A]mber-500/20 text-amber-300' },
                { id: 'searched', label: '✅ ABGESUCHT', icon: '✅', color: 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold' },
                { id: 'suspicious', label: '⚠️ Verdacht', icon: '🚨', color: 'border-red-500/50 bg-red-500/20 text-red-300' },
              ].map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setStatus(s.id as SectorStatus)}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    status === s.id
                      ? `${s.color} ring-2 ring-white/30 shadow-lg`
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-base">{s.icon}</span>
                  <span className="text-[11px] font-semibold">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
              Such-Priorität:
            </label>
            <div className="grid grid-cols-4 gap-2 font-mono">
              {(['low', 'medium', 'high', 'urgent'] as SectorPriority[]).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`py-2 px-2.5 rounded-xl border text-center uppercase text-[11px] font-bold transition cursor-pointer ${
                    priority === p
                      ? p === 'urgent'
                        ? 'bg-red-600 text-white border-red-500'
                        : p === 'high'
                        ? 'bg-slate-50 dark:bg-[#0F172A]mber-600 text-white border-amber-500'
                        : 'bg-blue-600 text-white border-blue-500'
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200'
                  }`}
                >
                  {p === 'urgent' ? 'Dringend' : p === 'high' ? 'Hoch' : p === 'medium' ? 'Mittel' : 'Niedrig'}
                </button>
              ))}
            </div>
          </div>

          {/* Assignment: Search Teams & Individual Users */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
              🐕‍🦺 Suchtrupps diesem Sektor zuteilen:
            </label>

            {currentOperation?.teams && currentOperation.teams.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-300 dark:border-slate-700">
                {currentOperation.teams.map((team) => {
                  const isSelected = assignedTeamIds.includes(team.id);
                  const leader = allUsers.find((u) => u.id === team.leaderUserId);
                  const membersCount = 1 + (team.memberUserIds?.length || 0) + (team.externalVolunteersCount || 0);
                  return (
                    <button
                      type="button"
                      key={team.id}
                      onClick={() => {
                        setAssignedTeamIds((prev) => {
                          const next = prev.includes(team.id) ? prev.filter((id) => id !== team.id) : [...prev, team.id];
                          if (!prev.includes(team.id)) {
                            const teamUsers = Array.from(new Set([team.leaderUserId, ...(team.memberUserIds || [])]));
                            setAssignedUserIds((uIds) => Array.from(new Set([...uIds, ...teamUsers])));
                            if (!assignedGroupName) {
                              setAssignedGroupName(team.name);
                            }
                          }
                          return next;
                        });
                      }}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between font-mono ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 ring-1 ring-emerald-400/40'
                          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-slate-800'
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-bold text-xs text-white flex items-center gap-1.5 truncate">
                          <span>🎯</span> <span className="truncate">{team.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-700 dark:text-slate-300 mt-0.5 truncate">
                          Führer: {leader?.name || 'k.A.'} • {membersCount} Pers.
                        </div>
                      </div>
                      <span className="text-xs shrink-0">{isSelected ? '✅ Zuteilt' : '➕ Zuteilen'}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic bg-white dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 font-mono">
                Keine Suchtrupps im Einsatz erstellt. Erstellen Sie zuerst Suchtrupps über das Suchtrupps-Menü.
              </p>
            )}

            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono pt-1">
              Zuweisung an Einheiten & Sucher:
            </label>

            <input
              type="text"
              value={assignedGroupName}
              onChange={(e) => setAssignedGroupName(e.target.value)}
              placeholder="Gruppenname (z.B. Drohnenstaffel 1, Suchkette Bravo)"
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-black dark:text-slate-100 text-xs focus:outline-none focus:border-blue-500 mb-2 font-mono"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-300 dark:border-slate-700">
              {allUsers.map((user) => {
                const isAssigned = assignedUserIds.includes(user.id);
                return (
                  <button
                    type="button"
                    key={user.id}
                    onClick={() => toggleUserAssignment(user.id)}
                    className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center justify-between font-mono ${
                      isAssigned
                        ? 'bg-blue-500/20 border-blue-500 text-blue-200 ring-1 ring-blue-400/40'
                        : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="h-7 w-7 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800 shrink-0 border border-slate-300 dark:border-slate-700">
                        {user.photoUrl ? (
                          <img src={user.photoUrl} alt={user.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center font-bold text-white text-xs">
                            {user.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-xs text-white leading-tight">{user.name}</div>
                        <div className="text-[10px] text-blue-400 font-mono">{user.callSign}</div>
                      </div>
                    </div>
                    <span className="text-xs">{isAssigned ? '✅' : '➕'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Special Equipment / Assets required */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
              Eingesetzte Hilfsmittel / Ausrüstung im Sektor:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono">
              {EQUIPMENT_OPTIONS.map((eq) => {
                const isSelected = assignedEquipment.includes(eq.id);
                return (
                  <button
                    type="button"
                    key={eq.id}
                    onClick={() => toggleEquipment(eq.id)}
                    className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? 'bg-slate-50 dark:bg-[#0F172A]mber-500/20 border-amber-500 text-amber-200'
                        : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200'
                    }`}
                  >
                    <span className="text-base">{eq.icon}</span>
                    <span className="text-[11px] font-semibold leading-tight">{eq.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-mono">
              Einsatzhinweise / Besonderheiten:
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="z.B. Steiles Flussufer, dichtes Dickicht, Wärmebild-Rasterflug empfohlen..."
              className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          {/* Polygon Drawing Action */}
          {onStartDrawing && (
            <div className="bg-white dark:bg-slate-900/90 p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <PenTool className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-200 block text-xs font-mono uppercase">
                    Suchsektor auf Karte einzeichnen (Pen / Freihand)
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    {pendingPolygon
                      ? `✅ Gezeichnete Fläche: ${pendingPolygon.length} Punkte • ca. ${calculatePolygonHectares(pendingPolygon)} ha`
                      : 'Mit Apple Pencil, Stylus, Finger oder Maus freihand umranden'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartDrawing();
                }}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 font-mono uppercase shadow shrink-0"
              >
                <Compass className="w-3.5 h-3.5" />
                {pendingPolygon ? 'Neu zeichnen 🖊️' : 'Auf Karte zeichnen 🖊️'}
              </button>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-300 dark:border-slate-700 flex items-center justify-between">
            {sector ? (
              showDeleteConfirm ? (
                <div className="flex items-center gap-2 bg-red-950/90 border border-red-600/80 p-2 rounded-xl text-xs animate-in fade-in duration-150">
                  <span className="text-[11px] font-bold text-red-300 font-mono">
                    Sektor wirklich löschen?
                  </span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1 font-mono uppercase shadow"
                  >
                    <Trash2 className="w-3 h-3" />
                    Ja, löschen
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition cursor-pointer font-mono border border-slate-300 dark:border-slate-700"
                  >
                    Abbrechen
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold text-xs transition cursor-pointer p-1 font-mono uppercase"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Sektor löschen
                </button>
              )
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              {sector && (
                <button
                  type="button"
                  onClick={() => exportSectorAsKml(sector)}
                  className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-bold transition cursor-pointer border border-slate-300 dark:border-slate-700 uppercase tracking-wider font-mono text-xs flex items-center gap-1.5"
                  title="Drohnen-Export (KML)"
                >
                  <Download className="w-3.5 h-3.5" />
                  KML
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition cursor-pointer border border-slate-300 dark:border-slate-700 uppercase tracking-wider font-mono text-xs"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition cursor-pointer flex items-center gap-1.5 shadow uppercase tracking-wider font-mono text-xs"
              >
                <Save className="w-3.5 h-3.5" />
                Sektor speichern
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
