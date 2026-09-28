/**
 * Offline Tile Cacher for SHS-EZ
 * Pre-caches Leaflet map tiles into ServiceWorker CacheStorage for search areas with zero cell reception.
 */

export type OfflineBaseMapType = 'osm' | 'topo' | 'satellite';

export interface TileCoordinates {
  x: number;
  y: number;
  z: number;
}

export interface OfflineCacheProgress {
  totalTiles: number;
  completedTiles: number;
  failedTiles: number;
  percent: number;
  isRunning: boolean;
  isComplete: boolean;
  error?: string;
}

function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const rad = (lat * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n);
  return { x, y };
}

export function getTileUrl(type: OfflineBaseMapType, x: number, y: number, z: number): string {
  switch (type) {
    case 'topo':
      return `https://tile.opentopomap.org/${z}/${x}/${y}.png`;
    case 'satellite':
      return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    case 'osm':
    default:
      return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  }
}

export function getCacheName(type: OfflineBaseMapType): string {
  switch (type) {
    case 'topo':
      return 'opentopo-map-tiles-v1';
    case 'satellite':
      return 'esri-satellite-tiles-v1';
    case 'osm':
    default:
      return 'osm-map-tiles-v1';
  }
}

/**
 * Calculates all tile coordinates covering a bounding box between minZoom and maxZoom.
 */
export function calculateTilesForBounds(
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  minZoom = 13,
  maxZoom = 16
): TileCoordinates[] {
  const tiles: TileCoordinates[] = [];
  const { minLat, maxLat, minLng, maxLng } = bounds;

  for (let z = minZoom; z <= maxZoom; z++) {
    const nw = latLngToTile(maxLat, minLng, z);
    const se = latLngToTile(minLat, maxLng, z);

    const minX = Math.min(nw.x, se.x);
    const maxX = Math.max(nw.x, se.x);
    const minY = Math.min(nw.y, se.y);
    const maxY = Math.max(nw.y, se.y);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        tiles.push({ x, y, z });
      }
    }
  }

  return tiles;
}

/**
 * Downloads and caches tiles with progress reporting and abort support.
 */
export async function downloadTilesToCache(options: {
  tiles: TileCoordinates[];
  mapType: OfflineBaseMapType;
  onProgress: (progress: OfflineCacheProgress) => void;
  signal?: AbortSignal;
}): Promise<OfflineCacheProgress> {
  const { tiles, mapType, onProgress, signal } = options;
  const totalTiles = tiles.length;
  let completedTiles = 0;
  let failedTiles = 0;

  const progress: OfflineCacheProgress = {
    totalTiles,
    completedTiles: 0,
    failedTiles: 0,
    percent: 0,
    isRunning: true,
    isComplete: false,
  };

  if (totalTiles === 0) {
    progress.isRunning = false;
    progress.isComplete = true;
    onProgress(progress);
    return progress;
  }

  const cacheName = getCacheName(mapType);
  let cache: Cache | null = null;
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      cache = await caches.open(cacheName);
    } catch (e) {
      console.warn('CacheStorage open warning:', e);
    }
  }

  // Concurrency pool (up to 4 concurrent downloads)
  const CONCURRENCY = 4;
  let currentIndex = 0;

  const downloadWorker = async () => {
    while (currentIndex < totalTiles) {
      if (signal?.aborted) return;
      const idx = currentIndex++;
      const tile = tiles[idx];
      const url = getTileUrl(mapType, tile.x, tile.y, tile.z);

      try {
        if (cache) {
          // Check if already in cache
          const match = await cache.match(url);
          if (!match) {
            const resp = await fetch(url, { mode: 'no-cors', signal });
            if (resp.status === 200 || resp.type === 'opaque') {
              await cache.put(url, resp);
            }
          }
        } else {
          // Fallback via simple Image fetch to trigger browser cache
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = url;
          });
        }
        completedTiles++;
      } catch (err: any) {
        if (signal?.aborted) return;
        failedTiles++;
      }

      progress.completedTiles = completedTiles;
      progress.failedTiles = failedTiles;
      progress.percent = Math.round(((completedTiles + failedTiles) / totalTiles) * 100);
      onProgress({ ...progress });
    }
  };

  const workers = Array.from({ length: Math.min(CONCURRENCY, totalTiles) }, () => downloadWorker());
  await Promise.all(workers);

  progress.isRunning = false;
  progress.isComplete = !signal?.aborted;
  onProgress({ ...progress });
  return progress;
}

/**
 * Counts currently cached tiles in CacheStorage
 */
export async function getCachedTileCount(mapType: OfflineBaseMapType): Promise<number> {
  if (typeof window === 'undefined' || !('caches' in window)) return 0;
  try {
    const cache = await caches.open(getCacheName(mapType));
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}
