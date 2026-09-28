import React, { useState, useRef } from 'react';
import { Upload, FileUp, CheckSquare, Square, MapPin, Compass, Shield, AlertCircle, X, Layers, Check } from 'lucide-react';
import { parseGeoFile, GeoImportResult, ImportedSector, ImportedTrack, ImportedWaypoint } from '../lib/geoImport';
import { SearchSector, Finding } from '../types';

interface GeoImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSectors: (sectors: Omit<SearchSector, 'id' | 'operationId'>[]) => void;
  onImportTracks: (tracks: ImportedTrack[]) => void;
  onImportWaypoints: (waypoints: ImportedWaypoint[]) => void;
  activeOperationTitle?: string;
}

export const GeoImportModal: React.FC<GeoImportModalProps> = ({
  isOpen,
  onClose,
  onImportSectors,
  onImportTracks,
  onImportWaypoints,
  activeOperationTitle,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [importResult, setImportResult] = useState<GeoImportResult | null>(null);
  const [selectedSectorIds, setSelectedSectorIds] = useState<Set<string>>(new Set());
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [selectedWptIds, setSelectedWptIds] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const validExts = ['.gpx', '.kml', '.xml'];
    const isExtValid = validExts.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!isExtValid) {
      setErrorMsg('Bitte wähle eine gültige .gpx oder .kml Datei aus (z. B. von Garmin, QGIS oder Polizei).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const parsed = parseGeoFile(content, file.name);
        if (parsed.tracks.length === 0 && parsed.sectors.length === 0 && parsed.waypoints.length === 0) {
          setErrorMsg('In der Datei wurden keine verwertbaren Koordinaten, Spuren oder Sektoren gefunden.');
          return;
        }

        setImportResult(parsed);
        // Pre-select all parsed elements by default
        setSelectedSectorIds(new Set(parsed.sectors.map((s) => s.id)));
        setSelectedTrackIds(new Set(parsed.tracks.map((t) => t.id)));
        setSelectedWptIds(new Set(parsed.waypoints.map((w) => w.id)));
      } catch (err: any) {
        console.error('Import parse error:', err);
        setErrorMsg('Fehler beim Einlesen der Datei: ' + (err?.message || 'Unbekanntes XML-Format'));
      }
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const toggleSector = (id: string) => {
    setSelectedSectorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTrack = (id: string) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleWaypoint = (id: string) => {
    setSelectedWptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExecuteImport = () => {
    if (!importResult) return;

    let importedCount = 0;

    // 1. Import Sectors
    const chosenSectors = importResult.sectors.filter((s) => selectedSectorIds.has(s.id));
    if (chosenSectors.length > 0) {
      const newSectorsPayload = chosenSectors.map((s) => ({
        name: s.name,
        polygon: s.polygon,
        status: 'open' as const,
        priority: 'medium' as const,
        areaHectares: s.areaHectares || 0,
        notes: `Importiert aus ${importResult.filename} (${new Date().toLocaleDateString('de-DE')})`,
        assignedUserIds: [],
        assignedTeamIds: [],
        assignedEquipment: [],
      }));
      onImportSectors(newSectorsPayload);
      importedCount += chosenSectors.length;
    }

    // 2. Import Tracks
    const chosenTracks = importResult.tracks.filter((t) => selectedTrackIds.has(t.id));
    if (chosenTracks.length > 0) {
      onImportTracks(chosenTracks);
      importedCount += chosenTracks.length;
    }

    // 3. Import Waypoints
    const chosenWpts = importResult.waypoints.filter((w) => selectedWptIds.has(w.id));
    if (chosenWpts.length > 0) {
      onImportWaypoints(chosenWpts);
      importedCount += chosenWpts.length;
    }

    setSuccessMsg(`✓ Erfolgreich importiert: ${chosenSectors.length} Sektor(en), ${chosenTracks.length} Spur(en), ${chosenWpts.length} Wegpunkt(e)!`);
    setTimeout(() => {
      onClose();
      setImportResult(null);
      setSuccessMsg(null);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[2500] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900/90 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>GPX &amp; KML Daten-Import</span>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  Polizei / Forst / Garmin
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Lade externe Suchspuren, Waldabteilungen oder Fundkoordinaten direkt in die Einsatzkarte.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-700 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700 text-emerald-200 text-xs flex items-center gap-2 font-bold">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Upload Dropzone */}
          {!importResult && (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                dragActive
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-700 hover:border-slate-500 bg-slate-900/60 hover:bg-slate-900'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".gpx,.kml,.xml"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />
              <div className="h-14 w-14 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-lg">
                <Upload className="w-7 h-7" />
              </div>
              <div>
                <span className="font-bold text-sm text-white block">
                  GPX- oder KML-Datei hier ablegen oder anklicken
                </span>
                <span className="text-xs text-slate-400 mt-1 block">
                  Unterstützt: Garmin Tracks/Wegpunkte (.gpx), Google Earth &amp; QGIS Polygone/Pfade (.kml)
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  .GPX (1.0 / 1.1)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  .KML (2.2)
                </span>
              </div>
            </div>
          )}

          {/* Parsed Preview List */}
          {importResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-700">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate flex items-center gap-2">
                    <span>📄 {importResult.filename}</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                      {importResult.rawFormat}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Erkannt: {importResult.sectors.length} Sektor(en), {importResult.tracks.length} Spur(en), {importResult.waypoints.length} Wegpunkt(e)
                  </div>
                </div>
                <button
                  onClick={() => {
                    setImportResult(null);
                    setErrorMsg(null);
                  }}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 cursor-pointer"
                >
                  Andere Datei
                </button>
              </div>

              {/* Sectors Section */}
              {importResult.sectors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-300 uppercase tracking-wide font-mono">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      Suchsektoren / Polygone ({importResult.sectors.length})
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      Werden als aktive Sektoren angelegt
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {importResult.sectors.map((sec) => {
                      const isChecked = selectedSectorIds.has(sec.id);
                      return (
                        <div
                          key={sec.id}
                          onClick={() => toggleSector(sec.id)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition text-xs ${
                            isChecked
                              ? 'bg-amber-950/40 border-amber-500/60 text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isChecked ? <CheckSquare className="w-4 h-4 text-amber-400 shrink-0" /> : <Square className="w-4 h-4 text-slate-500 shrink-0" />}
                            <div className="truncate">
                              <span className="font-bold block">{sec.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {sec.polygon.length} Eckpunkte {sec.areaHectares ? `• ${sec.areaHectares} ha` : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tracks Section */}
              {importResult.tracks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-300 uppercase tracking-wide font-mono">
                    <span className="flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5" />
                      Suchspuren / Pfade ({importResult.tracks.length})
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      Werden als Referenzspuren auf Karte gelegt
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {importResult.tracks.map((trk) => {
                      const isChecked = selectedTrackIds.has(trk.id);
                      return (
                        <div
                          key={trk.id}
                          onClick={() => toggleTrack(trk.id)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition text-xs ${
                            isChecked
                              ? 'bg-emerald-950/40 border-emerald-500/60 text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isChecked ? <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" /> : <Square className="w-4 h-4 text-slate-500 shrink-0" />}
                            <div className="truncate">
                              <span className="font-bold block">{trk.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {trk.points.length} GPS-Punkte • {(trk.distanceMeters / 1000).toFixed(2)} km Länge
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Waypoints Section */}
              {importResult.waypoints.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-300 uppercase tracking-wide font-mono">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      Wegpunkte / Markierungen ({importResult.waypoints.length})
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      Werden als Fundstellen / POIs angelegt
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {importResult.waypoints.map((wpt) => {
                      const isChecked = selectedWptIds.has(wpt.id);
                      return (
                        <div
                          key={wpt.id}
                          onClick={() => toggleWaypoint(wpt.id)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition text-xs ${
                            isChecked
                              ? 'bg-blue-950/40 border-blue-500/60 text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isChecked ? <CheckSquare className="w-4 h-4 text-blue-400 shrink-0" /> : <Square className="w-4 h-4 text-slate-500 shrink-0" />}
                            <div className="truncate">
                              <span className="font-bold block">{wpt.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {wpt.lat.toFixed(5)}, {wpt.lng.toFixed(5)} {wpt.description ? `• ${wpt.description}` : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-700/80 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 cursor-pointer"
          >
            Abbrechen
          </button>

          {importResult && (
            <button
              onClick={handleExecuteImport}
              disabled={selectedSectorIds.size === 0 && selectedTrackIds.size === 0 && selectedWptIds.size === 0}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition cursor-pointer"
            >
              <FileUp className="w-4 h-4" />
              <span>
                Ausgewählte Objekte importieren ({selectedSectorIds.size + selectedTrackIds.size + selectedWptIds.size})
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
