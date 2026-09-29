import html2canvas from 'html2canvas';
import { SearchOperation, UserLocationState, TrackingTestSession, GpsPoint, getUserTrackColor, User } from '../types';

// ─── OSM Tile Helpers ────────────────────────────────────────────────────────

/** Convert lat/lng to OSM tile x/y at given zoom */
export function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

/** Convert OSM tile x/y to lat/lng (top-left corner of tile) */
export function tileToLatLng(x: number, y: number, zoom: number): { lat: number; lng: number } {
  const n = Math.pow(2, zoom);
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
}

/** Pick a zoom level so the bounding box covers the canvas with high detail */
export function pickZoom(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  canvasW: number,
  canvasH: number
): number {
  for (let z = 17; z >= 11; z--) {
    const tl = latLngToTile(maxLat, minLng, z);
    const br = latLngToTile(minLat, maxLng, z);
    const tilesX = br.x - tl.x + 1;
    const tilesY = br.y - tl.y + 1;
    if (tilesX >= 1 && tilesY >= 1 && tilesX * 256 <= canvasW * 1.6 && tilesY * 256 <= canvasH * 1.6) {
      return z;
    }
  }
  return 14;
}

/** Load a single OSM tile as HTMLImageElement with timeout */
export function loadTileImage(z: number, x: number, y: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 4000);
  });
}

function calculateDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Checks whether a canvas is predominantly black (i.e. blank / CORS-blocked).
 */
function isCanvasBlack(canvas: HTMLCanvasElement): boolean {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    const sampleW = Math.min(canvas.width, 200);
    const sampleH = Math.min(canvas.height, 200);
    const { data } = ctx.getImageData(0, 0, sampleW, sampleH);
    let darkPixels = 0;
    const total = data.length / 16;
    for (let i = 0; i < data.length; i += 16) {
      if (data[i] < 25 && data[i + 1] < 25 && data[i + 2] < 25) darkPixels++;
    }
    return total > 0 && darkPixels / total > 0.85;
  } catch {
    return true;
  }
}

interface TrackRenderInfo {
  id: string;
  userId: string;
  userName: string;
  callSign: string;
  color: string;
  equipmentIcon: string;
  points: GpsPoint[];
  distanceMeters: number;
  isLive: boolean;
  phaseLabel?: string;
}

function getEquipmentIcon(equipment?: string[]): string {
  if (!equipment || equipment.length === 0) return '🚶';
  if (equipment.includes('drone')) return '🚁';
  if (equipment.includes('k9_mantrailer')) return '🐕';
  if (equipment.includes('k9_area')) return '🐾';
  if (equipment.includes('quad')) return '🚜';
  if (equipment.includes('boat')) return '🚤';
  if (equipment.includes('flir')) return '🌡️';
  return '🚶';
}

/**
 * Generates an operational tactical map snapshot with real OpenStreetMap tiles,
 * complete with sectors, all user movement profiles in distinct colors,
 * directional arrows along the tracks, start/finish markers, and a rich multi-user legend.
 */
export async function generateTacticalMapWithRealMap(
  op: SearchOperation,
  userLocations?: Record<string, UserLocationState>,
  allUsers?: User[],
  filterUserId?: string
): Promise<string> {
  const CANVAS_W = 1400;
  const CANVAS_H = 920;
  const HEADER_H = 62;
  const FOOTER_H = 135;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Resolve users list
  let resolvedUsers = allUsers;
  if (!resolvedUsers || resolvedUsers.length === 0) {
    try {
      const raw = localStorage.getItem('rescue_app_users_slk_v4') || localStorage.getItem('rescue_app_users');
      if (raw) resolvedUsers = JSON.parse(raw);
    } catch {}
  }
  const usersMap = new Map<string, User>((resolvedUsers || []).map((u) => [u.id, u]));

  // 1. Gather all tracks (Archived Phase 1 + Live Phase 2)
  const tracksList: TrackRenderInfo[] = [];

  // 1a. Historical / Archived tracks (e.g. Suchphase 1)
  if (op.archivedTracks) {
      op.archivedTracks.forEach((t) => {
        if (filterUserId && t.userId !== filterUserId) return;
        const validPoints = t.points.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number');
        if (validPoints.length < 2) return;

        let totalDist = 0;
        for (let i = 1; i < validPoints.length; i++) {
          const d = L.latLng(validPoints[i - 1].lat, validPoints[i - 1].lng).distanceTo(
            L.latLng(validPoints[i].lat, validPoints[i].lng)
          );
          const tDiff = validPoints[i].timestamp - validPoints[i - 1].timestamp;
          if (d <= 1200 && tDiff <= 15 * 60 * 1000) totalDist += d;
        }

        const user = usersMap.get(t.userId);
        const color = user ? getUserTrackColor(user, resolvedUsers) : '#94a3b8';

        tracksList.push({
        id: t.id || `archived-${t.userId}-${Date.now()}`,
        userId: t.userId,
        userName: t.userName || user?.name || 'Einsatzkraft',
        callSign: t.callSign || user?.callSign || 'Unit',
        color,
        equipmentIcon: getEquipmentIcon(user?.equipment),
        points: validPoints,
        distanceMeters: totalDist,
        isLive: false,
        phaseLabel: t.phaseLabel || 'Suchphase 1 (Referenz)',
      });
    });
  }

  // 1b. Live tracks (Phase 2 if user already had archived track, else active track)
  if (userLocations) {
      const isPhase2 = op.archivedTracks && op.archivedTracks.length > 0;
      Object.entries(userLocations).forEach(([uId, locState]) => {
        if (filterUserId && uId !== filterUserId) return;
        const activePoints = (locState.activeTrack || []).filter(
          (p) => typeof p.lat === 'number' && typeof p.lng === 'number'
        );
        if (activePoints.length >= 2) {
          let totalDist = 0;
          for (let i = 1; i < activePoints.length; i++) {
            const d = L.latLng(activePoints[i - 1].lat, activePoints[i - 1].lng).distanceTo(
              L.latLng(activePoints[i].lat, activePoints[i].lng)
            );
            const tDiff = activePoints[i].timestamp - activePoints[i - 1].timestamp;
            if (d <= 1200 && tDiff <= 15 * 60 * 1000) totalDist += d;
          }

          const user = usersMap.get(uId);
          const color = user ? getUserTrackColor(user, resolvedUsers) : '#94a3b8';

          tracksList.push({
        id: `live-${uId}`,
        userId: uId,
        userName: user?.name || 'Einsatzkraft',
        callSign: user?.callSign || 'Unit',
        color,
        equipmentIcon: getEquipmentIcon(user?.equipment),
        points: activePoints,
        distanceMeters: totalDist,
        isLive: locState.isLive ?? true,
        phaseLabel: isPhase2 ? 'Suchphase 2 (Aktiv)' : 'Suchphase (Aktiv)',
      });
        }
    });
  }

  // 2. Collect Bounding Coordinates (Sectors, HQ, Findings, Tracks)
  const coords: [number, number][] = [];
  op.sectors?.forEach((s) =>
    s.polygon?.forEach((p) => {
      if (p && typeof p[0] === 'number' && typeof p[1] === 'number' && !isNaN(p[0]) && !isNaN(p[1])) {
        coords.push([p[0], p[1]]);
      }
    })
  );

  if (op.headquartersLocation?.lat && typeof op.headquartersLocation.lat === 'number' && !isNaN(op.headquartersLocation.lat)) {
    coords.push([op.headquartersLocation.lat, op.headquartersLocation.lng]);
  }

  op.findings?.forEach((f) => {
    if (f.location?.lat && typeof f.location.lat === 'number' && !isNaN(f.location.lat)) {
      coords.push([f.location.lat, f.location.lng]);
    }
  });

  tracksList.forEach((trk) => {
    trk.points.forEach((pt) => {
      coords.push([pt.lat, pt.lng]);
    });
  });

  // Calculate extent
  let minLat = 51.84, maxLat = 51.86, minLng = 11.62, maxLng = 11.65;
  if (coords.length > 0) {
    minLat = Math.min(...coords.map((c) => c[0]));
    maxLat = Math.max(...coords.map((c) => c[0]));
    minLng = Math.min(...coords.map((c) => c[1]));
    maxLng = Math.max(...coords.map((c) => c[1]));
  }

  // Add 30% padding so markers, labels and arrows are never clipped at edges
  const latSpanRaw = Math.max(0.003, maxLat - minLat);
  const lngSpanRaw = Math.max(0.003, maxLng - minLng);
  const cLat = (minLat + maxLat) / 2;
  const cLng = (minLng + maxLng) / 2;
  minLat = cLat - (latSpanRaw / 2) * 1.35;
  maxLat = cLat + (latSpanRaw / 2) * 1.35;
  minLng = cLng - (lngSpanRaw / 2) * 1.35;
  maxLng = cLng + (lngSpanRaw / 2) * 1.35;

  const availW = CANVAS_W;
  const availH = CANVAS_H - HEADER_H - FOOTER_H;

  const zoom = pickZoom(minLat, maxLat, minLng, maxLng, availW, availH);
  const tileTopLeft = latLngToTile(maxLat, minLng, zoom);
  const tileBottomRight = latLngToTile(minLat, maxLng, zoom);

  const TILE_SIZE = 256;
  const originTilePixX = tileTopLeft.x * TILE_SIZE;
  const originTilePixY = tileTopLeft.y * TILE_SIZE;

  function latLngToPixel(lat: number, lng: number): { px: number; py: number } {
    const n = Math.pow(2, zoom);
    const px = ((lng + 180) / 360) * n * TILE_SIZE;
    const latRad = (lat * Math.PI) / 180;
    const py = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * TILE_SIZE;
    return { px, py };
  }

  const tilesX = Math.max(1, tileBottomRight.x - tileTopLeft.x + 1);
  const tilesY = Math.max(1, tileBottomRight.y - tileTopLeft.y + 1);
  const totalTilePxW = tilesX * TILE_SIZE;
  const totalTilePxH = tilesY * TILE_SIZE;

  const scaleX = availW / totalTilePxW;
  const scaleY = availH / totalTilePxH;
  const scale = Math.min(scaleX, scaleY, 1.6);

  const scaledTileW = TILE_SIZE * scale;
  const scaledTileH = TILE_SIZE * scale;
  const tileAreaW = tilesX * scaledTileW;
  const tileAreaH = tilesY * scaledTileH;
  const tileOffsetX = (CANVAS_W - tileAreaW) / 2;
  const tileOffsetY = HEADER_H + (availH - tileAreaH) / 2;

  function toCanvas(lat: number, lng: number): [number, number] {
    const { px, py } = latLngToPixel(lat, lng);
    const cx = tileOffsetX + (px - originTilePixX) * scale;
    const cy = tileOffsetY + (py - originTilePixY) * scale;
    return [cx, cy];
  }

  // 3. Render base background (Clean light map terrain placeholder, NEVER black!)
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Subtle coordinate grid on placeholder
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_W; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, HEADER_H); ctx.lineTo(x, CANVAS_H - FOOTER_H); ctx.stroke();
  }
  for (let y = HEADER_H; y < CANVAS_H - FOOTER_H; y += 50) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
  }

  // 4. Load & draw OpenStreetMap tiles
  const tilePromises: Promise<void>[] = [];
  for (let tx = 0; tx < tilesX; tx++) {
    for (let ty = 0; ty < tilesY; ty++) {
      const tileX = tileTopLeft.x + tx;
      const tileY = tileTopLeft.y + ty;
      tilePromises.push(
        loadTileImage(zoom, tileX, tileY).then((img) => {
          if (img) {
            ctx.drawImage(
              img,
              tileOffsetX + tx * scaledTileW,
              tileOffsetY + ty * scaledTileH,
              scaledTileW,
              scaledTileH
            );
          }
        })
      );
    }
  }

  try {
    await Promise.all(tilePromises);
  } catch {}

  // 5. Draw Sectors
  op.sectors?.forEach((sec) => {
    if (!sec.polygon || sec.polygon.length < 3) return;
    const validPoly = sec.polygon.filter(
      (pt) => pt && typeof pt[0] === 'number' && typeof pt[1] === 'number' && !isNaN(pt[0]) && !isNaN(pt[1])
    );
    if (validPoly.length < 3) return;

    ctx.beginPath();
    validPoly.forEach((pt, idx) => {
      const [sx, sy] = toCanvas(pt[0], pt[1]);
      if (idx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();

    ctx.fillStyle =
      sec.status === 'searched'
        ? 'rgba(16, 185, 129, 0.22)'
        : sec.status === 'in_progress'
        ? 'rgba(245, 158, 11, 0.22)'
        : 'rgba(59, 130, 246, 0.18)';
    ctx.fill();

    ctx.strokeStyle = sec.status === 'searched' ? '#059669' : sec.status === 'in_progress' ? '#d97706' : '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Sector Name Badge
    const [lx, ly] = toCanvas(validPoly[0][0], validPoly[0][1]);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';
    const tagText = `📐 ${sec.name} (${sec.status === 'searched' ? 'Abgesucht' : sec.status === 'in_progress' ? 'In Suche' : 'Offen'})`;
    const textWidth = ctx.measureText(tagText).width;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(lx + 4, ly - 18, textWidth + 12, 20);
    ctx.strokeStyle = sec.status === 'searched' ? '#10b981' : '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(lx + 4, ly - 18, textWidth + 12, 20);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(tagText, lx + 10, ly - 4);
  });

  // 6. Draw Tracks with User Colors, High-Contrast Casing, Direction Arrows, and Start/Finish Points
  tracksList.forEach((track) => {
    const pts = track.points;
    if (pts.length < 2) return;

    // A) Dark High-Contrast Outline
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [cx, cy] = toCanvas(p.lat, p.lng);
      if (i === 0) {
        ctx.moveTo(cx, cy);
      } else {
        const prev = pts[i - 1];
        const dist = calculateDistanceMeters(prev.lat, prev.lng, p.lat, p.lng);
        const tDiff = prev.timestamp && p.timestamp
          ? Math.abs(new Date(p.timestamp).getTime() - new Date(prev.timestamp).getTime())
          : 0;
        if (dist > 800 || tDiff > 15 * 60 * 1000) {
          ctx.moveTo(cx, cy);
        } else {
          ctx.lineTo(cx, cy);
        }
      }
    });
    ctx.stroke();

    // B) Main Colored Track Line
    ctx.strokeStyle = track.color;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [cx, cy] = toCanvas(p.lat, p.lng);
      if (i === 0) {
        ctx.moveTo(cx, cy);
      } else {
        const prev = pts[i - 1];
        const dist = calculateDistanceMeters(prev.lat, prev.lng, p.lat, p.lng);
        const tDiff = prev.timestamp && p.timestamp
          ? Math.abs(new Date(p.timestamp).getTime() - new Date(prev.timestamp).getTime())
          : 0;
        if (dist > 800 || tDiff > 15 * 60 * 1000) {
          ctx.moveTo(cx, cy);
        } else {
          ctx.lineTo(cx, cy);
        }
      }
    });
    ctx.stroke();

    // C) Direction Arrows along Track
    const step = Math.max(1, Math.min(15, Math.floor(pts.length / 10)));
    for (let i = 0; i < pts.length - 1; i += step) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dist = calculateDistanceMeters(p1.lat, p1.lng, p2.lat, p2.lng);
      const tDiff = p1.timestamp && p2.timestamp
        ? Math.abs(new Date(p2.timestamp).getTime() - new Date(p1.timestamp).getTime())
        : 0;
      if (dist < 1.5 || dist > 800 || tDiff > 15 * 60 * 1000) continue;

      const [ax, ay] = toCanvas(p1.lat, p1.lng);
      const [bx, by] = toCanvas(p2.lat, p2.lng);
      const angle = Math.atan2(by - ay, bx - ax);

      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(angle);

      // Sharp directional chevron
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-6, -5);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-6, 5);
      ctx.closePath();

      ctx.fillStyle = track.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.restore();
    }

    // D) Start Point (Green circle)
    const [sx, sy] = toCanvas(pts[0].lat, pts[0].lng);
    ctx.fillStyle = '#16a34a';
    ctx.beginPath(); ctx.arc(sx, sy, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

    // E) End Point (Black circle with ring)
    const lastPt = pts[pts.length - 1];
    const [ex, ey] = toCanvas(lastPt.lat, lastPt.lng);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.arc(ex, ey, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
  });

  // 7. Draw HQ / ELZ Marker
  if (op.headquartersLocation?.lat && typeof op.headquartersLocation.lat === 'number' && !isNaN(op.headquartersLocation.lat)) {
    const [hx, hy] = toCanvas(op.headquartersLocation.lat, op.headquartersLocation.lng);
    ctx.fillStyle = '#dc2626';
    ctx.beginPath(); ctx.arc(hx, hy, 8.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(hx + 12, hy - 11, 75, 20);
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1; ctx.strokeRect(hx + 12, hy - 11, 75, 20);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 11px sans-serif';
    ctx.fillText('🏢 ELZ / HQ', hx + 16, hy + 3);
  }

  // 8. Draw Findings
  op.findings?.forEach((f) => {
    if (!f.location?.lat || typeof f.location.lat !== 'number' || isNaN(f.location.lat)) return;
    const [fx, fy] = toCanvas(f.location.lat, f.location.lng);
    ctx.fillStyle = '#eab308';
    ctx.beginPath(); ctx.arc(fx, fy, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; ctx.stroke();

    const title = `🚩 ${f.title}`;
    const tw = ctx.measureText(title).width;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(fx + 10, fy - 10, tw + 10, 18);
    ctx.fillStyle = '#fef08a'; ctx.font = 'bold 10px sans-serif';
    ctx.fillText(title, fx + 14, fy + 3);
  });

  // 9. OSM Legal Attribution Tag
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(CANVAS_W - 200, CANVAS_H - FOOTER_H - 18, 195, 16);
  ctx.fillStyle = '#334155';
  ctx.font = '9px sans-serif';
  ctx.fillText('© OpenStreetMap contributors', CANVAS_W - 195, CANVAS_H - FOOTER_H - 6);

  // 10. Top Header Bar
  const headerGrad = ctx.createLinearGradient(0, 0, 0, HEADER_H);
  headerGrad.addColorStop(0, '#0f172a');
  headerGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, CANVAS_W, HEADER_H);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, CANVAS_W, HEADER_H);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`🗺️ EINSATZ-LAGEKARTE • ${op.title.toUpperCase()} • #${op.id.slice(-6).toUpperCase()}`, 24, 38);

  const timeStr = new Date().toLocaleString('de-DE');
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`STAND: ${timeStr}`, CANVAS_W - 270, 38);

  // Status Badge in Header
  const statusLabel = op.status === 'paused' ? 'EINSATZ PAUSIERT' : op.status === 'completed' ? 'BEENDET' : 'AKTIV';
  const statusColor = op.status === 'paused' ? '#f59e0b' : op.status === 'completed' ? '#ef4444' : '#10b981';
  ctx.fillStyle = statusColor;
  ctx.fillRect(CANVAS_W - 460, 18, 165, 26);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(statusLabel, CANVAS_W - 445, 35);

  // 11. Bottom Multi-User Legend & Stats Bar
  const footerY = CANVAS_H - FOOTER_H;
  const footerGrad = ctx.createLinearGradient(0, footerY, 0, CANVAS_H);
  footerGrad.addColorStop(0, '#1e293b');
  footerGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = footerGrad;
  ctx.fillRect(0, footerY, CANVAS_W, FOOTER_H);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0, footerY, CANVAS_W, FOOTER_H);

  // Header line in legend (1 User = 1 Spur)
  const consolidatedUserTracks = new Map<string, TrackRenderInfo>();
  tracksList.forEach((trk) => {
    if (consolidatedUserTracks.has(trk.userId)) {
      const existing = consolidatedUserTracks.get(trk.userId)!;
      existing.distanceMeters += trk.distanceMeters;
      existing.points = [...existing.points, ...trk.points];
      existing.isLive = existing.isLive || trk.isLive;
      existing.phaseLabel = 'Suchphase 1 + 2';
    } else {
      consolidatedUserTracks.set(trk.userId, { ...trk });
    }
  });
  const legendTracks = Array.from(consolidatedUserTracks.values());

  const totalAllDistance = tracksList.reduce((sum, t) => sum + t.distanceMeters, 0);
  const totalDistStr = totalAllDistance > 1000 ? `${(totalAllDistance / 1000).toFixed(2)} km` : `${Math.round(totalAllDistance)} m`;

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`🧭 TRACKING-LEGENDE & SUCHERGEBNIS (${legendTracks.length} ${legendTracks.length === 1 ? 'Suchspur' : 'Suchspuren'})`, 24, footerY + 22);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`Gesamte Suchstrecke: ${totalDistStr} | Sektoren: ${op.sectors?.length || 0} | Fundmeldungen: ${op.findings?.length || 0}`, CANVAS_W - 680, footerY + 22);

  // Render individual user legend cards in columns (up to 4 per row, 2 rows) - 1 User = 1 Karte!
  const legendStartX = 24;
  const legendStartY = footerY + 34;
  const colWidth = 320;
  const rowHeight = 36;

  legendTracks.slice(0, 8).forEach((trk, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const cardX = legendStartX + col * colWidth;
    const cardY = legendStartY + row * rowHeight;

    // User color badge swatch
    ctx.fillStyle = trk.color;
    ctx.fillRect(cardX, cardY + 4, 16, 16);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cardX, cardY + 4, 16, 16);

    // Direction arrow indicator in legend swatch
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cardX + 13, cardY + 12);
    ctx.lineTo(cardX + 8, cardY + 8);
    ctx.lineTo(cardX + 8, cardY + 16);
    ctx.closePath();
    ctx.fill();

    // Name + Equipment
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px sans-serif';
    const distText = trk.distanceMeters > 1000 ? `${(trk.distanceMeters / 1000).toFixed(2)} km` : `${Math.round(trk.distanceMeters)} m`;
    ctx.fillText(`${trk.equipmentIcon} ${trk.userName} (${trk.callSign})`, cardX + 24, cardY + 16);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(`${distText} • ${trk.points.length} Pkt. • ${trk.phaseLabel || (trk.isLive ? 'Live' : 'Gesichert')}`, cardX + 24, cardY + 28);
  });

  // Bottom key summary
  const keyY = footerY + FOOTER_H - 12;
  ctx.fillStyle = '#64748b';
  ctx.font = '10px monospace';
  ctx.fillText('SYMBOLE: 🟢 Startpunkt | ⚫ Endpunkt / Letzte Pos. | ➡️ Laufrichtung | 🏢 ELZ / Einsatzleitung | 🚩 Fundmeldung | 📐 Suchsektor', 24, keyY);

  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Clean vector fallback if offline or DOM unmounted.
 * Renders on a clean, light topographic schema, NEVER a pitch-black grid!
 */
export function generateTacticalCanvasFallback(
  op: SearchOperation,
  userLocations?: Record<string, UserLocationState>,
  allUsers?: User[]
): string {
  const width = 1400;
  const height = 920;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Clean light topographic background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  // Subtle coordinate grid
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  const gridSize = 45;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x, height - 120); ctx.stroke();
  }
  for (let y = 60; y < height - 120; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // Top Title Bar
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, 60);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width, 60);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`🗺️ LAGEKARTE • ${op.title.toUpperCase()} • #${op.id.slice(-6).toUpperCase()}`, 24, 38);

  const timeStr = new Date().toLocaleString('de-DE');
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`STAND: ${timeStr}`, width - 260, 38);

  const statusLabel = op.status === 'paused' ? 'EINSATZ PAUSIERT' : op.status === 'completed' ? 'BEENDET' : 'AKTIV';
  const statusColor = op.status === 'paused' ? '#f59e0b' : op.status === 'completed' ? '#ef4444' : '#10b981';
  ctx.fillStyle = statusColor;
  ctx.fillRect(width - 450, 18, 160, 26);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(statusLabel, width - 435, 35);

  // Collect bounding box
  const coords: [number, number][] = [];
  op.sectors?.forEach((s) => s.polygon?.forEach((p) => {
    if (p && typeof p[0] === 'number' && typeof p[1] === 'number' && !isNaN(p[0]) && !isNaN(p[1])) {
      coords.push([p[0], p[1]]);
    }
  }));
  if (op.headquartersLocation?.lat && typeof op.headquartersLocation.lat === 'number' && !isNaN(op.headquartersLocation.lat)) {
    coords.push([op.headquartersLocation.lat, op.headquartersLocation.lng]);
  }
  op.findings?.forEach((f) => {
    if (f.location?.lat && typeof f.location.lat === 'number' && !isNaN(f.location.lat)) {
      coords.push([f.location.lat, f.location.lng]);
    }
  });

  // Tracks list (Archived Phase 1 + Live Phase 2)
  const allTracks: TrackRenderInfo[] = [];
  if (op.archivedTracks) {
    op.archivedTracks.forEach((t) => {
      if (t.points && t.points.length > 1) {
        t.points.forEach((pt) => coords.push([pt.lat, pt.lng]));
        allTracks.push({
          id: t.id,
          userId: t.userId,
          userName: t.userName || 'Einsatzkraft',
          callSign: t.callSign || 'Unit',
          color: t.color || getUserTrackColor(t.userId, allUsers),
          equipmentIcon: '🚶',
          points: t.points,
          distanceMeters: 0,
          isLive: false,
          phaseLabel: t.phaseLabel || 'Suchphase 1',
        });
      }
    });
  }

  if (userLocations) {
    Object.entries(userLocations).forEach(([uId, locState]) => {
      const history = (locState.trackHistory || []).filter(
        (p) => typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng) &&
               (!p.operationId || !op.id || p.operationId === op.id)
      );
      if (history.length > 1) {
        const archivedForUser = op.archivedTracks?.find((at) => at.userId === uId);
        let activePoints = history;
        let isPhase2 = false;

        if (archivedForUser && archivedForUser.points.length > 0) {
          const lastArchivedTime = new Date(archivedForUser.points[archivedForUser.points.length - 1].timestamp).getTime();
          const newer = history.filter((p) => new Date(p.timestamp).getTime() > lastArchivedTime + 2000);
          if (newer.length >= 2) {
            activePoints = newer;
            isPhase2 = true;
          } else {
            return;
          }
        }

        activePoints.forEach((pt) => coords.push([pt.lat, pt.lng]));
        allTracks.push({
          id: `live-${uId}`,
          userId: uId,
          userName: 'Einsatzkraft',
          callSign: 'Unit',
          color: getUserTrackColor(uId, allUsers),
          equipmentIcon: '🚶',
          points: activePoints,
          distanceMeters: 0,
          isLive: locState.isLive ?? true,
          phaseLabel: isPhase2 ? 'Suchphase 2 (Live)' : 'Live',
        });
      }
    });
  }

  let minLat = 51.84, maxLat = 51.86, minLng = 11.62, maxLng = 11.65;
  if (coords.length > 0) {
    minLat = Math.min(...coords.map((c) => c[0]));
    maxLat = Math.max(...coords.map((c) => c[0]));
    minLng = Math.min(...coords.map((c) => c[1]));
    maxLng = Math.max(...coords.map((c) => c[1]));
  }
  const latSpan = Math.max(0.003, maxLat - minLat);
  const lngSpan = Math.max(0.003, maxLng - minLng);

  const padX = 70;
  const padY = 80;
  const plotW = width - padX * 2;
  const plotH = height - padY - 140;

  const toScreen = (lat: number, lng: number): [number, number] => {
    const x = padX + ((lng - minLng) / lngSpan) * plotW;
    const y = padY + plotH - ((lat - minLat) / latSpan) * plotH;
    return [x, y];
  };

  // Sectors
  op.sectors?.forEach((sec) => {
    if (!sec.polygon || sec.polygon.length < 3) return;
    ctx.beginPath();
    sec.polygon.forEach((pt, idx) => {
      const [sx, sy] = toScreen(pt[0], pt[1]);
      if (idx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.fillStyle = sec.status === 'searched' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.15)';
    ctx.fill();
    ctx.strokeStyle = sec.status === 'searched' ? '#059669' : '#2563eb';
    ctx.lineWidth = 2;
    ctx.stroke();

    const [lx, ly] = toScreen(sec.polygon[0][0], sec.polygon[0][1]);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`📐 ${sec.name}`, lx + 6, ly - 6);
  });

  // Tracks with arrows
  allTracks.forEach((trk) => {
    if (trk.points.length < 2) return;
    ctx.strokeStyle = trk.color;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    trk.points.forEach((pt, idx) => {
      const [tx, ty] = toScreen(pt.lat, pt.lng);
      if (idx === 0) {
        ctx.moveTo(tx, ty);
      } else {
        const prev = trk.points[idx - 1];
        const dist = calculateDistanceMeters(prev.lat, prev.lng, pt.lat, pt.lng);
        const tDiff = prev.timestamp && pt.timestamp
          ? Math.abs(new Date(pt.timestamp).getTime() - new Date(prev.timestamp).getTime())
          : 0;
        if (dist > 800 || tDiff > 15 * 60 * 1000) {
          ctx.moveTo(tx, ty);
        } else {
          ctx.lineTo(tx, ty);
        }
      }
    });
    ctx.stroke();

    // Arrows
    const step = Math.max(1, Math.floor(trk.points.length / 8));
    for (let i = 0; i < trk.points.length - 1; i += step) {
      const p1 = trk.points[i];
      const p2 = trk.points[i + 1];
      const dist = calculateDistanceMeters(p1.lat, p1.lng, p2.lat, p2.lng);
      const tDiff = p1.timestamp && p2.timestamp
        ? Math.abs(new Date(p2.timestamp).getTime() - new Date(p1.timestamp).getTime())
        : 0;
      if (dist < 1.5 || dist > 800 || tDiff > 15 * 60 * 1000) continue;

      const [ax, ay] = toScreen(p1.lat, p1.lng);
      const [bx, by] = toScreen(p2.lat, p2.lng);
      const angle = Math.atan2(by - ay, bx - ax);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(8, 0); ctx.lineTo(-5, -4); ctx.lineTo(-5, 4); ctx.closePath();
      ctx.fillStyle = trk.color; ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }

    // Start / End
    const [sx, sy] = toScreen(trk.points[0].lat, trk.points[0].lng);
    ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
    const lastPt = trk.points[trk.points.length - 1];
    const [ex, ey] = toScreen(lastPt.lat, lastPt.lng);
    ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill();
  });

  // HQ
  if (op.headquartersLocation?.lat) {
    const [hx, hy] = toScreen(op.headquartersLocation.lat, op.headquartersLocation.lng);
    ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(hx, hy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 11px sans-serif';
    ctx.fillText('🏢 ELZ / HQ', hx + 12, hy + 4);
  }

  // Findings
  op.findings?.forEach((f) => {
    if (!f.location?.lat) return;
    const [fx, fy] = toScreen(f.location.lat, f.location.lng);
    ctx.fillStyle = '#eab308'; ctx.beginPath(); ctx.arc(fx, fy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 10px sans-serif';
    ctx.fillText(`🚩 ${f.title}`, fx + 10, fy + 4);
  });

  // Footer Legend
  const footerY = height - 120;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, footerY, width, 120);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0, footerY, width, 120);

  // Consolidate tracks per user: 1 User = 1 Spur (Bewegungsprofil)
  const consolidatedFallback = new Map<string, TrackRenderInfo>();
  allTracks.forEach((trk) => {
    if (consolidatedFallback.has(trk.userId)) {
      const existing = consolidatedFallback.get(trk.userId)!;
      existing.points = [...existing.points, ...trk.points];
      existing.phaseLabel = 'Suchphase 1 + 2';
    } else {
      consolidatedFallback.set(trk.userId, { ...trk });
    }
  });
  const legendFallbackTracks = Array.from(consolidatedFallback.values());

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`🧭 TRACKING-LEGENDE (${legendFallbackTracks.length} ${legendFallbackTracks.length === 1 ? 'Suchspur' : 'Suchspuren'})`, 24, footerY + 24);

  legendFallbackTracks.slice(0, 8).forEach((trk, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const cardX = 24 + col * 320;
    const cardY = footerY + 38 + row * 34;

    ctx.fillStyle = trk.color;
    ctx.fillRect(cardX, cardY, 14, 14);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(cardX, cardY, 14, 14);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`${trk.userName} (${trk.callSign})`, cardX + 22, cardY + 11);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(`${trk.points.length} Punkte • ${trk.phaseLabel || 'Spur'}`, cardX + 22, cardY + 24);
  });

  return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * Primary screenshot function: generates a high-resolution real OpenStreetMap snapshot
 * with all tracks, direction arrows, and user legend.
 */
export async function captureTacticalMapScreenshot(
  fallbackOperation?: SearchOperation | null,
  userLocations?: Record<string, UserLocationState>,
  allUsers?: User[],
  filterUserId?: string
): Promise<string | null> {
  // If an operation is provided, always generate the high-res crisp OSM map snapshot!
  if (fallbackOperation) {
    try {
      const snap = await generateTacticalMapWithRealMap(fallbackOperation, userLocations, allUsers, filterUserId);
      if (snap && snap.startsWith('data:image')) {
        return snap;
      }
    } catch (err) {
      console.warn('[mapSnapshotHelper] generateTacticalMapWithRealMap failed, trying fallback:', err);
    }
  }

  // Fallback to DOM html2canvas if available and not blacked out
  const mapElement = document.getElementById('tactical-leaflet-map');
  if (mapElement) {
    try {
      window.dispatchEvent(new CustomEvent('ForceFitBounds'));
      await new Promise((resolve) => setTimeout(resolve, 600));

      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: 2,
      });

      if (!isCanvasBlack(canvas)) {
        return canvas.toDataURL('image/jpeg', 0.88);
      }
      console.warn('[mapSnapshotHelper] html2canvas produced a black canvas (CORS tiles), using OSM fallback');
    } catch (e) {
      console.warn('[mapSnapshotHelper] html2canvas failed:', e);
    }
  }

  if (fallbackOperation) {
    return generateTacticalCanvasFallback(fallbackOperation, userLocations, allUsers, filterUserId);
  }

  if (fallbackOperation?.mapSnapshotUrl && fallbackOperation.mapSnapshotUrl.startsWith('data:image')) {
    return fallbackOperation.mapSnapshotUrl;
  }

  return null;
}

/**
 * Generates a tracking-test snapshot with a real OpenStreetMap tile background.
 */
export async function generateTrackingTestSnapshotWithMap(session: TrackingTestSession): Promise<string> {
  const CANVAS_W = 1200;
  const CANVAS_H = 750;
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const points: GpsPoint[] = session.trackPoints.filter(
    (p) => typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng)
  );

  let minLat: number, maxLat: number, minLng: number, maxLng: number;
  const PAD_FACTOR = 0.35;

  if (points.length >= 2) {
    minLat = Math.min(...points.map((p) => p.lat));
    maxLat = Math.max(...points.map((p) => p.lat));
    minLng = Math.min(...points.map((p) => p.lng));
    maxLng = Math.max(...points.map((p) => p.lng));
  } else {
    const clat = points.length === 1 ? points[0].lat : 51.75;
    const clng = points.length === 1 ? points[0].lng : 11.45;
    minLat = clat - 0.003; maxLat = clat + 0.003;
    minLng = clng - 0.005; maxLng = clng + 0.005;
  }

  const latSpanRaw = Math.max(0.002, maxLat - minLat);
  const lngSpanRaw = Math.max(0.002, maxLng - minLng);
  const cLat = (minLat + maxLat) / 2;
  const cLng = (minLng + maxLng) / 2;
  minLat = cLat - (latSpanRaw / 2) * (1 + PAD_FACTOR);
  maxLat = cLat + (latSpanRaw / 2) * (1 + PAD_FACTOR);
  minLng = cLng - (lngSpanRaw / 2) * (1 + PAD_FACTOR);
  maxLng = cLng + (lngSpanRaw / 2) * (1 + PAD_FACTOR);

  const zoom = pickZoom(minLat, maxLat, minLng, maxLng, CANVAS_W, CANVAS_H);
  const tileTopLeft = latLngToTile(maxLat, minLng, zoom);
  const tileBottomRight = latLngToTile(minLat, maxLng, zoom);

  const TILE_SIZE = 256;
  const originTilePixX = tileTopLeft.x * TILE_SIZE;
  const originTilePixY = tileTopLeft.y * TILE_SIZE;

  function latLngToPixel(lat: number, lng: number): { px: number; py: number } {
    const n = Math.pow(2, zoom);
    const px = ((lng + 180) / 360) * n * TILE_SIZE;
    const latRad = (lat * Math.PI) / 180;
    const py = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * TILE_SIZE;
    return { px, py };
  }

  const tilesX = tileBottomRight.x - tileTopLeft.x + 1;
  const tilesY = tileBottomRight.y - tileTopLeft.y + 1;
  const totalTilePxW = tilesX * TILE_SIZE;
  const totalTilePxH = tilesY * TILE_SIZE;

  const HEADER_H = 58;
  const FOOTER_H = 70;
  const availW = CANVAS_W;
  const availH = CANVAS_H - HEADER_H - FOOTER_H;

  const scaleX = availW / totalTilePxW;
  const scaleY = availH / totalTilePxH;
  const scale = Math.min(scaleX, scaleY, 1.5);

  const scaledTileW = TILE_SIZE * scale;
  const scaledTileH = TILE_SIZE * scale;
  const tileAreaW = tilesX * scaledTileW;
  const tileAreaH = tilesY * scaledTileH;
  const tileOffsetX = (CANVAS_W - tileAreaW) / 2;
  const tileOffsetY = HEADER_H + (availH - tileAreaH) / 2;

  function toCanvas(lat: number, lng: number): [number, number] {
    const { px, py } = latLngToPixel(lat, lng);
    const cx = tileOffsetX + (px - originTilePixX) * scale;
    const cy = tileOffsetY + (py - originTilePixY) * scale;
    return [cx, cy];
  }

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const tilePromises: Promise<void>[] = [];
  for (let tx = 0; tx < tilesX; tx++) {
    for (let ty = 0; ty < tilesY; ty++) {
      const tileX = tileTopLeft.x + tx;
      const tileY = tileTopLeft.y + ty;
      tilePromises.push(
        loadTileImage(zoom, tileX, tileY).then((img) => {
          if (img) {
            ctx.drawImage(img, tileOffsetX + tx * scaledTileW, tileOffsetY + ty * scaledTileH, scaledTileW, scaledTileH);
          }
        })
      );
    }
  }

  try {
    await Promise.all(tilePromises);
  } catch {}

  // Header bar
  const headerGrad = ctx.createLinearGradient(0, 0, 0, HEADER_H);
  headerGrad.addColorStop(0, '#1e3a5f');
  headerGrad.addColorStop(1, '#0f2744');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, CANVAS_W, HEADER_H);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, CANVAS_W, HEADER_H);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('GPS TRACKING-TEST • PRÜFPROTOKOLL', 20, 36);

  const dateStr = new Date(session.startTime).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`${dateStr} • ${session.durationMinutes} Min.`, CANVAS_W - 260, 36);

  // GPS Track line
  if (points.length >= 2) {
    ctx.shadowColor = '#1d4ed8';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((pt, i) => {
      const [cx, cy] = toCanvas(pt.lat, pt.lng);
      if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
    });
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    points.forEach((pt, i) => {
      const [cx, cy] = toCanvas(pt.lat, pt.lng);
      if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
    });
    ctx.stroke();

    // Direction arrows
    const step = Math.max(1, Math.floor(points.length / 14));
    ctx.fillStyle = '#93c5fd';
    for (let i = step; i < points.length - 1; i += step) {
      const [ax, ay] = toCanvas(points[i].lat, points[i].lng);
      const [bx, by] = toCanvas(points[i + 1].lat, points[i + 1].lng);
      const angle = Math.atan2(by - ay, bx - ax);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(9, 0); ctx.lineTo(-5, -4); ctx.lineTo(-5, 4); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // Start Marker
  if (points.length >= 1) {
    const [sx, sy] = toCanvas(points[0].lat, points[0].lng);
    ctx.fillStyle = '#10b981';
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // End Marker
  if (points.length >= 2) {
    const last = points[points.length - 1];
    const [ex, ey] = toCanvas(last.lat, last.lng);
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // OSM Attribution
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(tileOffsetX + 2, tileOffsetY + tileAreaH - 16, 200, 14);
  ctx.fillStyle = '#333';
  ctx.font = '9px sans-serif';
  ctx.fillText('© OpenStreetMap contributors', tileOffsetX + 5, tileOffsetY + tileAreaH - 5);

  // Footer bar
  const footerY = CANVAS_H - FOOTER_H;
  const footerGrad = ctx.createLinearGradient(0, footerY, 0, CANVAS_H);
  footerGrad.addColorStop(0, '#1e293b');
  footerGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = footerGrad;
  ctx.fillRect(0, footerY, CANVAS_W, FOOTER_H);
  ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1;
  ctx.strokeRect(0, footerY, CANVAS_W, FOOTER_H);

  // Tester
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(20, footerY + 10, 5, 40);
  ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 13px monospace';
  ctx.fillText(`TESTER: ${session.userName.toUpperCase()}`, 34, footerY + 27);
  const startStr = new Date(session.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const endStr   = new Date(session.endTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  ctx.fillStyle = '#94a3b8'; ctx.font = '11px monospace';
  ctx.fillText(`Zeitraum: ${startStr} – ${endStr}`, 34, footerY + 46);

  // Stats
  const totalDist = points.length >= 2
    ? points.slice(1).reduce((sum, pt, i) => {
        const prev = points[i];
        const dLat = (pt.lat - prev.lat) * 111320;
        const dLng = (pt.lng - prev.lng) * 111320 * Math.cos(prev.lat * Math.PI / 180);
        return sum + Math.sqrt(dLat * dLat + dLng * dLng);
      }, 0)
    : 0;
  const distLabel = totalDist > 1000 ? (totalDist / 1000).toFixed(2) + ' km' : Math.round(totalDist) + ' m';

  ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 13px monospace';
  ctx.fillText(`Distanz: ${distLabel}`, CANVAS_W / 2 - 100, footerY + 27);
  ctx.fillStyle = '#94a3b8'; ctx.font = '11px monospace';
  ctx.fillText(`${points.length} Wegpunkte`, CANVAS_W / 2 - 100, footerY + 46);

  // Legend
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(CANVAS_W - 180, footerY + 20, 30, 4);
  ctx.fillStyle = '#94a3b8'; ctx.font = '11px monospace';
  ctx.fillText('GPS-Spur', CANVAS_W - 140, footerY + 26);
  ctx.fillStyle = '#10b981';
  ctx.beginPath(); ctx.arc(CANVAS_W - 165, footerY + 46, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.beginPath(); ctx.arc(CANVAS_W - 145, footerY + 46, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Start / Ende', CANVAS_W - 133, footerY + 50);

  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Legacy plain-canvas test snapshot generator.
 */
export function generateTrackingTestSnapshot(session: TrackingTestSession): string {
  return generateTacticalCanvasFallback({
    id: `test-${session.userId}-${Date.now()}`,
    title: `Tracking-Test ${session.userName}`,
    status: 'completed',
    type: 'exercise',
    createdAt: session.startTime,
    commander: session.userName,
    sectors: [],
    findings: [],
    logs: [],
    participantIds: [session.userId],
    archivedTracks: [{
      id: `trk-${session.userId}-${Date.now()}`,
      userId: session.userId,
      userName: session.userName,
      callSign: 'Test-Unit',
      color: '#3b82f6',
      recordedAt: session.endTime,
      points: session.trackPoints,
    }],
  } as unknown as SearchOperation);
}
