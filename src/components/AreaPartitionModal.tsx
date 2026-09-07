import React, { useState, useMemo } from 'react';
import { SearchSector, SectorPriority } from '../types';
import {
  Grid,
  Scissors,
  Layers,
  Sparkles,
  Check,
  X,
  Compass,
  ArrowRight,
  Maximize2,
  Info,
} from 'lucide-react';

interface AreaPartitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  polygonPoints?: [number, number][];
  defaultCenter?: { lat: number; lng: number };
  onApplySectors: (newSectors: Omit<SearchSector, 'id' | 'operationId'>[]) => void;
}

// Tactical color palette for generated sectors
const SECTOR_PALETTE = [
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#84cc16', // lime
  '#e11d48', // rose
  '#a855f7', // violet
];

const NATO_PHONETIC = [
  'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrott',
  'Golf', 'Hotel', 'India', 'Juliett', 'Kilo', 'Lima',
  'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo'
];

function clipHalfPlane(
  polygon: [number, number][],
  isInside: (p: [number, number]) => boolean,
  intersect: (p1: [number, number], p2: [number, number]) => [number, number]
): [number, number][] {
  const result: [number, number][] = [];
  if (polygon.length === 0) return result;

  let s = polygon[polygon.length - 1];
  for (const e of polygon) {
    if (isInside(e)) {
      if (isInside(s)) {
        result.push(e);
      } else {
        result.push(intersect(s, e));
        result.push(e);
      }
    } else if (isInside(s)) {
      result.push(intersect(s, e));
    }
    s = e;
  }
  return result;
}

function clipPolygonToRect(
  subjectPolygon: [number, number][],
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number
): [number, number][] {
  if (!subjectPolygon || subjectPolygon.length < 3) return [];

  let output = [...subjectPolygon];

  output = clipHalfPlane(output, (p) => p[0] <= maxLat, (p1, p2) => {
    const t = (maxLat - p1[0]) / (p2[0] - p1[0]);
    return [maxLat, p1[1] + t * (p2[1] - p1[1])];
  });

  output = clipHalfPlane(output, (p) => p[0] >= minLat, (p1, p2) => {
    const t = (minLat - p1[0]) / (p2[0] - p1[0]);
    return [minLat, p1[1] + t * (p2[1] - p1[1])];
  });

  output = clipHalfPlane(output, (p) => p[1] <= maxLng, (p1, p2) => {
    const t = (maxLng - p1[1]) / (p2[1] - p1[1]);
    return [p1[0] + t * (p2[0] - p1[0]), maxLng];
  });

  output = clipHalfPlane(output, (p) => p[1] >= minLng, (p1, p2) => {
    const t = (minLng - p1[1]) / (p2[1] - p1[1]);
    return [p1[0] + t * (p2[0] - p1[0]), minLng];
  });

  return output.length >= 3 ? output : [];
}

function calculatePolygonHectares(coords: [number, number][]): number {
  if (!coords || coords.length < 3) return 0;
  let area = 0;
  const earthRadius = 6378137; // meters
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const lat1 = (coords[i][0] * Math.PI) / 180;
    const lat2 = (coords[j][0] * Math.PI) / 180;
    const lon1 = (coords[i][1] * Math.PI) / 180;
    const lon2 = (coords[j][1] * Math.PI) / 180;
    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  area = Math.abs((area * earthRadius * earthRadius) / 2.0);
  const hectares = area / 10000;
  return Math.round(hectares * 10) / 10;
}

export const AreaPartitionModal: React.FC<AreaPartitionModalProps> = ({
  isOpen,
  onClose,
  polygonPoints,
  defaultCenter = { lat: 51.758, lng: 11.458 },
  onApplySectors,
}) => {
  // Split configuration
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [namingPattern, setNamingPattern] = useState<'nato' | 'matrix' | 'compass' | 'numbers'>('nato');
  const [basePrefix, setBasePrefix] = useState('Sektor');
  const [priority, setPriority] = useState<SectorPriority>('medium');
  const [notes, setNotes] = useState('');

  // Default box size in meters if no polygon was drawn
  const [boxRadiusMeters, setBoxRadiusMeters] = useState(600);

  if (!isOpen) return null;

  // Determine bounding box
  const boundingBox = useMemo(() => {
    if (polygonPoints && polygonPoints.length >= 3) {
      let minLat = 90;
      let maxLat = -90;
      let minLng = 180;
      let maxLng = -180;

      polygonPoints.forEach(([lat, lng]) => {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      });

      return { minLat, maxLat, minLng, maxLng, isFromPolygon: true };
    }

    // Otherwise generate square around center
    // 1 deg lat ~ 111,320 meters
    const latDelta = boxRadiusMeters / 111320;
    const lngDelta = boxRadiusMeters / (111320 * Math.cos((defaultCenter.lat * Math.PI) / 180));

    return {
      minLat: defaultCenter.lat - latDelta,
      maxLat: defaultCenter.lat + latDelta,
      minLng: defaultCenter.lng - lngDelta,
      maxLng: defaultCenter.lng + lngDelta,
      isFromPolygon: false,
    };
  }, [polygonPoints, defaultCenter, boxRadiusMeters]);

  // Compute sub-sectors
  const generatedSectors = useMemo(() => {
    const list: Omit<SearchSector, 'id' | 'operationId'>[] = [];
    const latStep = (boundingBox.maxLat - boundingBox.minLat) / rows;
    const lngStep = (boundingBox.maxLng - boundingBox.minLng) / cols;

    const rowLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
    let count = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Grid bounds (North to South, West to East)
        const cellTop = boundingBox.maxLat - r * latStep;
        const cellBottom = boundingBox.maxLat - (r + 1) * latStep;
        const cellLeft = boundingBox.minLng + c * lngStep;
        const cellRight = boundingBox.minLng + (c + 1) * lngStep;

        let cellPolygon: [number, number][] = [
          [cellTop, cellLeft],
          [cellTop, cellRight],
          [cellBottom, cellRight],
          [cellBottom, cellLeft],
        ];

        if (polygonPoints && polygonPoints.length >= 3) {
          const clipped = clipPolygonToRect(polygonPoints, cellBottom, cellTop, cellLeft, cellRight);
          if (clipped.length >= 3) {
            cellPolygon = clipped;
          }
        }

        const hectares = calculatePolygonHectares(cellPolygon);

        let suffix = '';
        if (namingPattern === 'nato') {
          suffix = NATO_PHONETIC[count % NATO_PHONETIC.length];
        } else if (namingPattern === 'matrix') {
          suffix = `${rowLetters[r % rowLetters.length]}${c + 1}`;
        } else if (namingPattern === 'compass') {
          if (rows === 2 && cols === 2) {
            const compassLabels = ['NW (Nord-West)', 'NO (Nord-Ost)', 'SW (Süd-West)', 'SO (Süd-Ost)'];
            suffix = compassLabels[count];
          } else if (rows === 2 && cols === 1) {
            suffix = r === 0 ? 'Nord' : 'Süd';
          } else if (rows === 1 && cols === 2) {
            suffix = c === 0 ? 'West' : 'Ost';
          } else {
            suffix = `${count + 1}`;
          }
        } else {
          suffix = `${count + 1}`;
        }

        const name = basePrefix.trim() ? `${basePrefix.trim()} ${suffix}` : suffix;
        const color = SECTOR_PALETTE[count % SECTOR_PALETTE.length];

        list.push({
          name,
          color,
          status: 'open',
          priority,
          polygon: cellPolygon,
          areaHectares: hectares,
          notes: notes ? `${notes} (Rasterfeld ${r + 1}/${c + 1})` : `Automatisches Teilgebiet (${r + 1}/${c + 1})`,
          assignedUserIds: [],
          assignedEquipment: [],
        });

        count++;
      }
    }

    return list;
  }, [boundingBox, rows, cols, namingPattern, basePrefix, priority, notes]);

  const totalHectares = useMemo(() => {
    return generatedSectors.reduce((sum, s) => sum + (s.areaHectares || 0), 0);
  }, [generatedSectors]);

  const handleApply = () => {
    if (generatedSectors.length === 0) return;
    onApplySectors(generatedSectors);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#1E293B] border border-blue-500/50 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Suchgebiet in Sektoren unterteilen
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400">
                  {generatedSectors.length} Teilsektoren
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {boundingBox.isFromPolygon
                  ? `Aus gezeichnetem Umriss (${polygonPoints?.length} Punkte) • Gesamtfläche ca. ${totalHectares.toFixed(1)} ha`
                  : `Planquadrat-Raster um Einsatzort • Gesamtfläche ca. ${totalHectares.toFixed(1)} ha`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs font-mono">
          {/* Preset Buttons */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Schnellauswahl Raster-Aufteilung:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  setRows(2);
                  setCols(2);
                  setNamingPattern('nato');
                }}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  rows === 2 && cols === 2
                    ? 'bg-blue-600/30 border-blue-500 text-white ring-1 ring-blue-500'
                    : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">4 Sektoren</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">2 × 2</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal">Quadranten (Alpha bis Delta)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRows(2);
                  setCols(1);
                  setNamingPattern('compass');
                }}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  rows === 2 && cols === 1
                    ? 'bg-blue-600/30 border-blue-500 text-white ring-1 ring-blue-500'
                    : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">2 Sektoren</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">2 × 1</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal">Nord / Süd Halbierung</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRows(1);
                  setCols(2);
                  setNamingPattern('compass');
                }}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  rows === 1 && cols === 2
                    ? 'bg-blue-600/30 border-blue-500 text-white ring-1 ring-blue-500'
                    : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">2 Sektoren</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">1 × 2</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal">West / Ost Halbierung</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRows(3);
                  setCols(2);
                  setNamingPattern('matrix');
                }}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  rows === 3 && cols === 2
                    ? 'bg-blue-600/30 border-blue-500 text-white ring-1 ring-blue-500'
                    : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">6 Sektoren</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">3 × 2</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal">Matrix (A1 bis C2)</span>
              </button>
            </div>
          </div>

          {/* Detailed Custom Grid Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/80">
            <div>
              <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Zeilen (Nord ↔ Süd):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={rows}
                  onChange={(e) => setRows(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="font-bold text-blue-400 w-6 text-center">{rows}</span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Spalten (West ↔ Ost):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={cols}
                  onChange={(e) => setCols(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="font-bold text-blue-400 w-6 text-center">{cols}</span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Namensschema:
              </label>
              <select
                value={namingPattern}
                onChange={(e) => setNamingPattern(e.target.value as any)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="nato">NATO (Alpha, Bravo, Charlie...)</option>
                <option value="matrix">Planquadrate (A1, A2, B1, B2...)</option>
                <option value="compass">Himmelsrichtung (NW, NO, SW, SO)</option>
                <option value="numbers">Nummeriert (1, 2, 3, 4...)</option>
              </select>
            </div>
          </div>

          {/* Sektor-Präfix & Priorität */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Basis-Name / Präfix:
              </label>
              <input
                type="text"
                value={basePrefix}
                onChange={(e) => setBasePrefix(e.target.value)}
                placeholder="z.B. Sektor, Wald Nord, Absuchbereich"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-sans"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Standard-Priorität:
              </label>
              <div className="flex gap-2">
                {(['high', 'medium', 'low'] as SectorPriority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-1.5 rounded-lg border text-[11px] font-bold uppercase transition cursor-pointer ${
                      priority === p
                        ? p === 'high'
                          ? 'bg-red-500/20 text-red-400 border-red-500'
                          : p === 'medium'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500'
                          : 'bg-blue-500/20 text-blue-400 border-blue-500'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {p === 'high' ? 'Hoch' : p === 'medium' ? 'Mittel' : 'Niedrig'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Generated Sectors Grid Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                Vorschau der generierten Sektoren ({generatedSectors.length}):
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                ca. {(totalHectares / generatedSectors.length).toFixed(1)} ha pro Sektor
              </span>
            </div>

            <div
              className="grid gap-2 p-3 bg-slate-950/80 rounded-xl border border-slate-800 max-h-48 overflow-y-auto"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              }}
            >
              {generatedSectors.map((sector, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg border flex flex-col justify-between gap-1 shadow-sm transition hover:scale-[1.01]"
                  style={{
                    backgroundColor: `${sector.color}15`,
                    borderColor: `${sector.color}60`,
                  }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-white truncate">{sector.name}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: sector.color }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1">
                    <span>📏 ca. {sector.areaHectares} ha</span>
                    <span className="text-slate-500">Offen</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-700 bg-slate-900/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer border border-slate-700 text-xs uppercase tracking-wider"
          >
            Abbrechen
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition cursor-pointer flex items-center gap-2 shadow-lg shadow-blue-600/30 text-xs uppercase tracking-wider"
          >
            <Check className="w-4 h-4" />
            <span>{generatedSectors.length} Sektoren anlegen & Karte aktualisieren</span>
          </button>
        </div>
      </div>
    </div>
  );
};
