import React, { useState } from 'react';
import { useRescue } from '../context/RescueContext';
import { SearchOperation, EquipmentType, User } from '../types';
import {
  X,
  User as UserIcon,
  MapPin,
  Home,
  Shield,
  Clock,
  Calendar,
  AlertTriangle,
  Edit3,
  ZoomIn,
  HeartPulse,
  Phone,
  FileText,
  Compass,
  Layers,
  Sparkles,
  Camera,
  Navigation,
  CheckCircle2,
  Share2,
  Users,
  Wrench,
  Package,
  Image as ImageIcon,
} from 'lucide-react';

const EQUIPMENT_LABELS: Record<EquipmentType, { label: string; icon: string }> = {
  drone: { label: 'Drohne / UAS', icon: '🚁' },
  k9_mantrailer: { label: 'Mantrailer K9', icon: '🐕' },
  k9_area: { label: 'Flächensuchhund', icon: '🐾' },
  k9_cadaver: { label: 'Leichenspürhund', icon: '🐕‍🦺' },
  flir: { label: 'FLIR / Wärmebild', icon: '🌡️' },
  quad: { label: 'Quad / ATV', icon: '🚜' },
  boat: { label: 'Rettungsboot', icon: '🚤' },
  foot_search: { label: 'Fußtrupp', icon: '🚶' },
  first_aid: { label: 'Sanitäter / Notfall', icon: '🩹' },
};

interface OperationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenEditOperation?: () => void;
  onNavigateToMapPoint?: (lat: number, lng: number) => void;
  operation?: SearchOperation | null;
}

export const OperationDetailModal: React.FC<OperationDetailModalProps> = ({
  isOpen,
  onClose,
  onOpenEditOperation,
  onNavigateToMapPoint,
  operation: propOp,
}) => {
  const { currentOperation, currentUser, findings, allUsers } = useRescue();
  const [isPhotoZoomed, setIsPhotoZoomed] = useState(false);

  if (!isOpen) return null;

  const op = propOp || currentOperation;
  if (!op) {
    return (
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-950/80 backdrop-blur-md">
        <div className="bg-[#1E293B] border border-slate-300 dark:border-slate-700 rounded-2xl p-6 max-w-md text-center space-y-4 shadow-2xl text-black dark:text-slate-100">
          <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 mx-auto flex items-center justify-center border border-slate-300 dark:border-slate-700">
            <Compass className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Kein Einsatz ausgewählt</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Aktuell ist kein aktiver Sucheinsatz geladen.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-xl font-bold text-xs cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>
    );
  }

  const mp = op.missingPerson;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'einsatzleitung' || Boolean(currentUser?.isAdmin) || Boolean(currentUser?.canLeadOperations);
  const isExercise = op.type === 'exercise';
  const opFindings = findings.filter((f) => f.operationId === op.id);
  const activeRespondersCount = allUsers.filter((u) => u.isActive).length;

  const handleCenterOnCoordinates = (lat?: number, lng?: number) => {
    if (lat !== undefined && lng !== undefined && onNavigateToMapPoint) {
      onNavigateToMapPoint(lat, lng);
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[5000] flex items-center justify-center p-2 sm:p-4 bg-slate-100 dark:bg-slate-950/85 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
        <div className="bg-[#1E293B] border border-slate-300 dark:border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl text-black dark:text-slate-100 overflow-hidden my-auto">
          {/* Header */}
          <div className="px-4 sm:px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 border ${
                  isExercise
                    ? 'bg-slate-50 dark:bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                }`}
              >
                {isExercise ? '🟠' : '🔴'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] sm:text-[10px] uppercase font-mono px-2 py-0.5 rounded font-bold ${
                      op.status === 'active'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {op.status === 'active' ? 'Laufender Einsatz' : 'Archiviert'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    #{op.id.slice(-4).toUpperCase()}
                  </span>
                  {isExercise && (
                    <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-slate-50 dark:bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                      Übung
                    </span>
                  )}
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate mt-0.5">
                  {op.title}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && onOpenEditOperation && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEditOperation();
                  }}
                  className="px-2.5 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md"
                  title="Einsatz- und Vermisstendaten bearbeiten oder ergänzen"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Bearbeiten / Ergänzen</span>
                  <span className="sm:hidden">Edit</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-white hover:bg-slate-50 dark:bg-slate-800 rounded-xl transition cursor-pointer"
                title="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
            {/* Main Missing Person Dossier Banner */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-800/80 border border-slate-300 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
                {/* Photo Column */}
                <div className="w-full sm:w-44 shrink-0 flex flex-col items-center">
                  <div className="relative w-36 h-44 sm:w-44 sm:h-52 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 shadow-xl group">
                    {mp?.photoUrl && mp.photoUrl.trim() !== '' ? (
                      <>
                        <img
                          src={mp.photoUrl}
                          alt={mp.name || 'Vermisste Person'}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => setIsPhotoZoomed(true)}
                          className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-white dark:bg-slate-900/80 hover:bg-white dark:bg-slate-900 text-white border border-slate-300 dark:border-slate-700 shadow-md transition cursor-pointer"
                          title="Lichtbild vergrößern"
                        >
                          <ZoomIn className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400">
                        <UserIcon className="w-12 h-12 text-slate-600 mb-2" />
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Kein Foto hinterlegt
                        </span>
                        {isAdmin && onOpenEditOperation && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenEditOperation();
                            }}
                            className="mt-2 text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Camera className="w-3 h-3" /> Foto hochladen
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {mp?.photoUrl && (
                    <button
                      type="button"
                      onClick={() => setIsPhotoZoomed(true)}
                      className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 hover:text-blue-300 flex items-center gap-1 font-mono cursor-pointer"
                    >
                      <ZoomIn className="w-3 h-3" /> Vollbild anzeigen
                    </button>
                  )}
                </div>

                {/* Person Key Data Column */}
                <div className="flex-1 min-w-0 space-y-3 w-full">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 dark:border-slate-700/60 pb-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block"></span>
                        Vermissten-Dossier
                      </span>
                      <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
                        {mp?.name || 'Name unbekannt / Noch nicht erfasst'}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {mp?.age ? (
                        <span className="px-3 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-200">
                          {mp.age} Jahre
                        </span>
                      ) : null}
                      <span className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {mp?.gender === 'female'
                          ? 'Weiblich'
                          : mp?.gender === 'male'
                          ? 'Männlich'
                          : 'Divers / Unbekannt'}
                      </span>
                    </div>
                  </div>

                  {/* Medical Conditions & Warnings */}
                  {mp?.medicalConditions && mp.medicalConditions.length > 0 ? (
                    <div className="p-2.5 rounded-xl bg-red-950/50 border border-red-800/80 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-red-300 flex items-center gap-1.5 font-mono">
                        <HeartPulse className="w-3.5 h-3.5 text-red-400" />
                        <span>Medizinische Dringlichkeit & Vorerkrankungen</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {mp.medicalConditions.map((cond, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-lg bg-red-900/80 border border-red-700 text-red-200 text-xs font-semibold"
                          >
                            ⚠️ {cond}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Clothing */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                      👕 Bekleidung & Ausrüstung
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 font-medium text-xs sm:text-sm leading-relaxed">
                      {mp?.clothing && mp.clothing.trim() !== '' ? (
                        mp.clothing
                      ) : (
                        <span className="text-slate-500 italic">
                          Keine Bekleidungsangaben hinterlegt
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description / Features */}
                  {mp?.description && mp.description.trim() !== '' && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                        🔍 Signalement & Besondere Merkmale
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                        {mp.description}
                      </div>
                    </div>
                  )}

                  {/* Police Case ID & Contacts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {mp?.policeCaseId && (
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/60 text-xs">
                        <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="text-slate-500 dark:text-slate-400">Aktenzeichen:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-200 truncate">
                          {mp.policeCaseId}
                        </span>
                      </div>
                    )}
                    {mp?.emergencyContact && (
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/60 text-xs">
                        <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-slate-500 dark:text-slate-400">Notfallkontakt:</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-200 truncate">
                          {mp.emergencyContact}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Geographical Points Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Point Last Seen (PLS) */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-red-500/30 space-y-2 relative shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-red-400">
                    <span className="p-1 rounded-lg bg-red-950 border border-red-800 text-red-300">
                      📍 PLS
                    </span>
                    <span>Letzter Sichtungspunkt</span>
                  </div>
                  {mp?.lastSeenTime && (
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                      ⏱ {mp.lastSeenTime}
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-slate-900 dark:text-slate-200">
                    {mp?.lastSeenLocation?.address || 'Keine PLS-Adresse angegeben'}
                  </div>
                  {mp?.lastSeenLocation?.description && (
                    <div className="text-slate-500 dark:text-slate-400 italic text-[11px] bg-slate-100 dark:bg-slate-950/50 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                      {mp.lastSeenLocation.description}
                    </div>
                  )}
                  {mp?.lastSeenLocation?.lat !== undefined && mp?.lastSeenLocation?.lng !== undefined && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800/80 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span>
                        GPS: {mp.lastSeenLocation.lat.toFixed(5)}, {mp.lastSeenLocation.lng.toFixed(5)}
                      </span>
                      {onNavigateToMapPoint && (
                        <button
                          type="button"
                          onClick={() =>
                            handleCenterOnCoordinates(
                              mp.lastSeenLocation.lat,
                              mp.lastSeenLocation.lng
                            )
                          }
                          className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Navigation className="w-3 h-3" /> Auf Karte
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Home Address */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-amber-500/30 space-y-2 relative shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-amber-400">
                    <span className="p-1 rounded-lg bg-slate-50 dark:bg-amber-950 border border-amber-800 text-amber-300">
                      🏠 Heim
                    </span>
                    <span>Wohnanschrift der Person</span>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-slate-900 dark:text-slate-200">
                    {mp?.homeAddress?.address || 'Keine Wohnadresse hinterlegt'}
                  </div>
                  {mp?.homeAddress?.notes && (
                    <div className="text-slate-500 dark:text-slate-400 text-[11px] bg-slate-50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-800/40 text-amber-200/90">
                      <strong>Hinweis:</strong> {mp.homeAddress.notes}
                    </div>
                  )}
                  {mp?.homeAddress?.lat !== undefined && mp?.homeAddress?.lng !== undefined && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800/80 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span>
                        GPS: {mp.homeAddress.lat.toFixed(5)}, {mp.homeAddress.lng.toFixed(5)}
                      </span>
                      {onNavigateToMapPoint && (
                        <button
                          type="button"
                          onClick={() =>
                            handleCenterOnCoordinates(
                              mp.homeAddress?.lat,
                              mp.homeAddress?.lng
                            )
                          }
                          className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Navigation className="w-3 h-3" /> Auf Karte
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tactical Status & Resources Overview */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono flex items-center justify-between">
                <span>📋 Einsatzleitung & Lageübersicht</span>
                <span className="text-blue-400 font-bold">Phase {op.phase || 1}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/60">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Einsatzleitung</div>
                  <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-200 truncate mt-0.5">
                    {op.commander || 'Nicht benannt'}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/60">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Einsatzkräfte (App)</div>
                  <div className="font-bold text-xs sm:text-sm text-emerald-400 mt-0.5">
                    {op.participantIds?.length || allUsers.filter((u) => u.isActive).length} Kräfte
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/60">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Freiwillige / Externe</div>
                  <div className="font-bold text-xs sm:text-sm text-amber-400 mt-0.5">
                    {op.externalVolunteersCount || 0} Kräfte (ohne App)
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/60">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Gesamtstärke</div>
                  <div className="font-bold text-xs sm:text-sm text-cyan-400 mt-0.5">
                    {(op.participantIds?.length || allUsers.filter((u) => u.isActive).length) + (op.externalVolunteersCount || 0)} Gesamt
                  </div>
                </div>
              </div>

              {/* Externe Helfer Notiz */}
              {op.externalVolunteersNotes && (
                <div className="bg-slate-100 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-300 font-mono text-[10px] uppercase block">
                      Externe Organisationen & Helfer:
                    </span>
                    <span className="text-slate-900 dark:text-slate-200">{op.externalVolunteersNotes}</span>
                  </div>
                </div>
              )}

              {/* Ausrüstung & Einsatzmittel */}
              {Array.isArray(op.selectedEquipment) && op.selectedEquipment.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-800/80">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Zugeordnete Einsatzmittel & Ausrüstung:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {op.selectedEquipment.map((eq) => {
                      const item = EQUIPMENT_LABELS[eq] || { label: eq, icon: '📦' };
                      return (
                        <span
                          key={eq}
                          className="px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-700/50 text-cyan-200 text-xs font-mono font-semibold flex items-center gap-1.5 shadow-sm"
                        >
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </span>
                      );
                    })}
                  </div>
                  {op.customEquipmentNotes && (
                    <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-950/40 p-2 rounded-lg border border-slate-200 dark:border-slate-800 mt-1 font-mono">
                      <span className="text-slate-500 dark:text-slate-400">Sonderausrüstung:</span> {op.customEquipmentNotes}
                    </div>
                  )}
                </div>
              )}

              {/* Gespeicherter Lagekarten-Schnappschuss */}
              {op.mapSnapshotUrl && (
                <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-purple-400" />
                    <span>Gespeicherte Lagekarte zum Einsatzabschluss:</span>
                  </div>
                  <div className="relative rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-950 max-h-56">
                    <img
                      src={op.mapSnapshotUrl}
                      alt="Lagekarten-Snapshot"
                      className="w-full h-auto object-cover max-h-56"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              )}

              {op.description && op.description.trim() !== '' && (
                <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 leading-relaxed">
                  <strong>Einsatznotiz:</strong> {op.description}
                </div>
              )}
            </div>

            {/* Two Lists: Eingeloggte aktive User & Betrachter (Deduplicated uniquely) */}
            {(() => {
              const activeUsersUnique = Array.from(
                new Map<string, User>(
                  allUsers.filter((u) => u.isActive && u.role !== 'observer').map((u) => [u.id, u])
                ).values()
              );
              const observerUsersUnique = Array.from(
                new Map<string, User>(
                  allUsers.filter((u) => u.role === 'observer').map((u) => [u.id, u])
                ).values()
              );

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                  {/* List 1: Eingeloggte aktive User */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-2 shadow">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Eingeloggte aktive User ({activeUsersUnique.length})
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {activeUsersUnique.length > 0 ? (
                        activeUsersUnique.map((u) => (
                          <div key={u.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700/60 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-900 dark:text-slate-200">
                                {u.name.charAt(0)}
                              </span>
                              <div>
                                <div className="font-bold text-white">{u.name}</div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{u.callSign} • {u.organization || 'Rettungsdienst'}</div>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono font-bold">
                              Aktiv
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500 italic text-xs py-2 text-center">Keine aktiven User eingeloggt</div>
                      )}
                    </div>
                  </div>

                  {/* List 2: Betrachter (Observers) */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-2 shadow">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        Betrachter / Beobachter ({observerUsersUnique.length})
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {observerUsersUnique.length > 0 ? (
                        observerUsersUnique.map((u) => (
                          <div key={u.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700/60 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-purple-950 text-purple-300 border border-purple-800 flex items-center justify-center font-bold text-[10px]">
                                {u.name.charAt(0)}
                              </span>
                              <div>
                                <div className="font-bold text-white">{u.name}</div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{u.callSign} • {u.organization || 'Gast / Behörde'}</div>
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${u.isActive ? 'bg-purple-950 text-purple-300 border-purple-800' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700'}`}>
                              {u.isActive ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500 italic text-xs py-2 text-center">Keine Betrachter registriert</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Footer Controls */}
          <div className="px-4 sm:px-6 py-3 bg-white dark:bg-slate-900 border-t border-slate-300 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              Einsatzstart: {new Date(op.createdAt).toLocaleString('de-DE')}
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && onOpenEditOperation && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEditOperation();
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Einsatz & Personendaten bearbeiten</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer border border-slate-300 dark:border-slate-700"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Fullscreen Photo Modal */}
      {isPhotoZoomed && mp?.photoUrl && (
        <div
          className="fixed inset-0 z-[2100] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setIsPhotoZoomed(false)}
        >
          <button
            onClick={() => setIsPhotoZoomed(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-50 dark:bg-slate-800 text-white hover:bg-slate-100 dark:bg-slate-700 border border-slate-400 dark:border-slate-600 cursor-pointer shadow-xl z-10"
            title="Schließen"
          >
            <X className="w-6 h-6" />
          </button>
          <div
            className="max-w-4xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={mp.photoUrl}
              alt={mp.name || 'Vermisste Person'}
              className="max-h-[75vh] w-auto max-w-full object-contain"
              referrerPolicy="no-referrer"
            />
            <div className="w-full bg-white dark:bg-slate-900 p-3 text-center border-t border-slate-200 dark:border-slate-800">
              <div className="text-sm font-bold text-white">
                {mp.name} {mp.age ? `(${mp.age} Jahre)` : ''}
              </div>
              {mp.clothing && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Bekleidung: {mp.clothing}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
