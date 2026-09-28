import React, { useState, useEffect, useRef } from 'react';
import { Download, WifiOff, CheckCircle2, AlertCircle, X, Layers, RefreshCw, HardDrive } from 'lucide-react';
import {
  OfflineBaseMapType,
  TileCoordinates,
  OfflineCacheProgress,
  calculateTilesForBounds,
  downloadTilesToCache,
  getCachedTileCount,
} from '../lib/offlineTileCache';

interface OfflineMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  operationTitle?: string;
  searchBounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
}

export const OfflineMapModal: React.FC<OfflineMapModalProps> = ({
  isOpen,
  onClose,
  operationTitle = 'Aktiver Einsatz',
  searchBounds,
}) => {
  const [mapType, setMapType] = useState<OfflineBaseMapType>('osm');
  const [zoomPreset, setZoomPreset] = useState<'standard' | 'high'>('standard');
  const [progress, setProgress] = useState<OfflineCacheProgress | null>(null);
  const [cachedCount, setCachedCount] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Default to central region if no search area exists yet (e.g. Aschersleben 51.756, 11.453 +/- 0.05)
  const effectiveBounds = searchBounds || {
    minLat: 51.72,
    maxLat: 51.79,
    minLng: 11.40,
    maxLng: 11.50,
  };

  const minZoom = 13;
  const maxZoom = zoomPreset === 'standard' ? 15 : 16;

  const plannedTiles: TileCoordinates[] = React.useMemo(() => {
    return calculateTilesForBounds(effectiveBounds, minZoom, maxZoom);
  }, [effectiveBounds, minZoom, maxZoom]);

  const estimatedMb = (plannedTiles.length * 0.025).toFixed(1);

  useEffect(() => {
    if (isOpen) {
      getCachedTileCount(mapType).then(setCachedCount);
    }
  }, [isOpen, mapType]);

  if (!isOpen) return null;

  const handleStartDownload = async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setProgress({
      totalTiles: plannedTiles.length,
      completedTiles: 0,
      failedTiles: 0,
      percent: 0,
      isRunning: true,
      isComplete: false,
    });

    try {
      await downloadTilesToCache({
        tiles: plannedTiles,
        mapType,
        signal: controller.signal,
        onProgress: (p) => setProgress(p),
      });
      const newCount = await getCachedTileCount(mapType);
      setCachedCount(newCount);
    } catch (err: any) {
      console.warn('Offline download interrupted:', err);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setProgress((prev) => (prev ? { ...prev, isRunning: false } : null));
  };

  return (
    <div className="fixed inset-0 z-[2500] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden font-sans text-slate-100 flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900/90 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <WifiOff className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>Einsatzgebiet offline sichern</span>
              </h3>
              <p className="text-xs text-slate-400">
                Puffert alle Kartenkacheln vorab auf das Smartphone für Einsätze im tiefen Funkloch.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleCancelDownload();
              onClose();
            }}
            className="h-8 w-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Info Banner */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono block">EINSATZRAUM</span>
              <span className="font-bold text-white truncate block">{operationTitle}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">AKTUELLES OFFLINE-DEPOT</span>
              <span className="font-mono font-bold text-emerald-400 flex items-center justify-end gap-1">
                <HardDrive className="w-3.5 h-3.5" />
                {cachedCount} Kacheln
              </span>
            </div>
          </div>

          {/* Map Style Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase font-mono block">Karten-Typ zum Puffern:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'osm', label: '🗺️ OSM', sub: 'Standard' },
                { id: 'topo', label: '🏔️ Topo', sub: 'Höhenlinien' },
                { id: 'satellite', label: '🛰️ Satellit', sub: 'Luftbild' },
              ].map((item) => (
                <button
                  key={item.id}
                  disabled={progress?.isRunning}
                  onClick={() => setMapType(item.id as OfflineBaseMapType)}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer disabled:opacity-50 ${
                    mapType === item.id
                      ? 'bg-blue-600 border-blue-400 text-white font-bold shadow'
                      : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-bold">{item.label}</div>
                  <div className="text-[10px] opacity-75 font-mono">{item.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Detail Depth */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase font-mono block">Detailtiefe (Zoomstufen):</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={progress?.isRunning}
                onClick={() => setZoomPreset('standard')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer disabled:opacity-50 ${
                  zoomPreset === 'standard'
                    ? 'bg-amber-950/40 border-amber-500 text-white font-bold shadow'
                    : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="text-xs font-bold">Standard (Zoom 13–15)</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Sehr schnell • Ideal für Übersicht &amp; Hauptwege
                </div>
              </button>

              <button
                disabled={progress?.isRunning}
                onClick={() => setZoomPreset('high')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer disabled:opacity-50 ${
                  zoomPreset === 'high'
                    ? 'bg-amber-950/40 border-amber-500 text-white font-bold shadow'
                    : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="text-xs font-bold">Detailreich (Zoom 13–16)</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Hochauflösend • Waldpfade &amp; Details im Nahbereich
                </div>
              </button>
            </div>
          </div>

          {/* Calculated Statistics Banner */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 text-slate-300">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Berechneter Umfang:</span>
            </div>
            <div className="text-white font-bold">
              <span>{plannedTiles.length} Kacheln</span>
              <span className="text-slate-400 font-normal ml-1.5">(ca. ~{estimatedMb} MB)</span>
            </div>
          </div>

          {/* Progress Bar */}
          {progress && (
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-900 border border-slate-700">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 flex items-center gap-1.5">
                  {progress.isRunning && <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
                  {progress.isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>
                    {progress.isRunning
                      ? `Lade Kacheln herunter (${progress.completedTiles}/${progress.totalTiles})...`
                      : progress.isComplete
                      ? `✓ ${progress.completedTiles} Kacheln erfolgreich offline gesichert!`
                      : 'Download abgebrochen.'}
                  </span>
                </span>
                <span className="font-bold text-white">{progress.percent}%</span>
              </div>

              <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 ${
                    progress.isComplete ? 'bg-emerald-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-700/80 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              handleCancelDownload();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 cursor-pointer"
          >
            Schließen
          </button>

          {progress?.isRunning ? (
            <button
              onClick={handleCancelDownload}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer"
            >
              Abbrechen
            </button>
          ) : (
            <button
              onClick={handleStartDownload}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{progress?.isComplete ? 'Erneut puffern' : 'Jetzt Kacheln herunterladen'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
