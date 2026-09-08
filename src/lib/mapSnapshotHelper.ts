import html2canvas from 'html2canvas';
import { SearchOperation, UserLocationState, TrackingTestSession, GpsPoint } from '../types';

/**
 * Captures a high-resolution screenshot of the tactical map container.
 * If the map DOM element is not mounted, generates a clean tactical map schema preview canvas.
 */
export async function captureTacticalMapScreenshot(
  fallbackOperation?: SearchOperation | null,
  userLocations?: Record<string, UserLocationState>
): Promise<string | null> {
  const mapElement = document.getElementById('tactical-leaflet-map');

  if (mapElement) {
    try {
      // Force the map to fit all tracks/sectors perfectly before snapshot
      window.dispatchEvent(new CustomEvent('ForceFitBounds'));

      // Give Leaflet time to animate the zoom and load new tiles
      await new Promise(resolve => setTimeout(resolve, 800));

      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: 2,
      });

      // CORS-Blackout detection: if html2canvas captured mostly black pixels
      // (which happens with cross-origin Leaflet tile layers), discard and fallback.
      if (!isCanvasBlack(canvas)) {
        return canvas.toDataURL('image/jpeg', 0.85);
      }
      console.warn('[mapSnapshotHelper] html2canvas produced a black canvas (CORS tiles), using vector fallback');
    } catch (e) {
      console.warn('[mapSnapshotHelper] html2canvas failed, falling back to schema', e);
    }
  }

  if (fallbackOperation) {
    try {
      return generateTacticalCanvasFallback(fallbackOperation, userLocations);
    } catch (fallbackErr) {
      console.warn('[mapSnapshotHelper] Tactical canvas fallback failed:', fallbackErr);
    }
  }

  if (fallbackOperation?.mapSnapshotUrl && fallbackOperation.mapSnapshotUrl.startsWith('data:image')) {
    return fallbackOperation.mapSnapshotUrl;
  }

  return null;
}

/**
 * Checks whether a canvas is predominantly black (i.e. blank / CORS-blocked).
 * Samples a 200×200 pixel region; if >85% of pixels are very dark, returns true.
 */
function isCanvasBlack(canvas: HTMLCanvasElement): boolean {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    const sampleW = Math.min(canvas.width, 200);
    const sampleH = Math.min(canvas.height, 200);
    const { data } = ctx.getImageData(0, 0, sampleW, sampleH);
    let darkPixels = 0;
    // Sample every 4th pixel (stride = 4 channels × 4 pixels = 16 bytes)
    const total = data.length / 16;
    for (let i = 0; i < data.length; i += 16) {
      if (data[i] < 25 && data[i + 1] < 25 && data[i + 2] < 25) darkPixels++;
    }
    return total > 0 && darkPixels / total > 0.85;
  } catch {
    return true;
  }
}

/**
 * Renders a stylized vector tactical map schema if the Leaflet DOM is unmounted or in background.
 */
export function generateTacticalCanvasFallback(
  op: SearchOperation,
  userLocations?: Record<string, UserLocationState>
): string {
  const width = 1200;
  const height = 750;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background - Dark Tactical Grid
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  // Tactical Grid Lines
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Top Title Bar
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, width, 55);
  ctx.strokeStyle = '#334155';
  ctx.strokeRect(0, 0, width, 55);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`LAGEKARTEN-SNAPSHOT • ${op.title.toUpperCase()} • #${op.id.slice(-6).toUpperCase()}`, 24, 34);

  const timeStr = new Date().toLocaleString('de-DE');
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`STAND: ${timeStr}`, width - 260, 34);

  // Status Badge
  const statusLabel = op.status === 'paused' ? 'PAUSIERT' : op.status === 'completed' ? 'BEENDET' : 'AKTIV';
  ctx.fillStyle = op.status === 'paused' ? '#f59e0b' : op.status === 'completed' ? '#ef4444' : '#10b981';
  ctx.fillRect(width - 380, 16, 100, 24);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(statusLabel, width - 365, 32);

  // Collect bounding box coordinates from sectors, hq, and tracks with strict numeric validations
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
  op.archivedTracks?.forEach((t) => t.points?.forEach((pt) => {
    if (pt && typeof pt.lat === 'number' && typeof pt.lng === 'number' && !isNaN(pt.lat) && !isNaN(pt.lng)) {
      coords.push([pt.lat, pt.lng]);
    }
  }));
  if (userLocations) {
    Object.values(userLocations).forEach((loc) => {
      loc.trackHistory?.forEach((pt) => {
        if (pt && typeof pt.lat === 'number' && typeof pt.lng === 'number' && !isNaN(pt.lat) && !isNaN(pt.lng)) {
          coords.push([pt.lat, pt.lng]);
        }
      });
    });
  }

  let minLat = 51.74, maxLat = 51.77, minLng = 11.43, maxLng = 11.47;
  if (coords.length > 0) {
    minLat = Math.min(...coords.map((c) => c[0]));
    maxLat = Math.max(...coords.map((c) => c[0]));
    minLng = Math.min(...coords.map((c) => c[1]));
    maxLng = Math.max(...coords.map((c) => c[1]));
  }
  const latSpan = Math.max(0.005, maxLat - minLat);
  const lngSpan = Math.max(0.005, maxLng - minLng);

  const padX = 60;
  const padY = 80;
  const plotW = width - padX * 2;
  const plotH = height - padY - 80;

  const toScreen = (lat: number, lng: number): [number, number] => {
    const x = padX + ((lng - minLng) / lngSpan) * plotW;
    const y = padY + plotH - ((lat - minLat) / latSpan) * plotH;
    return [x, y];
  };

  // Draw Sectors
  op.sectors?.forEach((sec) => {
    if (!sec.polygon || sec.polygon.length < 3) return;
    const validPoly = sec.polygon.filter(
      (pt) => pt && typeof pt[0] === 'number' && typeof pt[1] === 'number' && !isNaN(pt[0]) && !isNaN(pt[1])
    );
    if (validPoly.length < 3) return;

    ctx.beginPath();
    validPoly.forEach((pt, idx) => {
      const [sx, sy] = toScreen(pt[0], pt[1]);
      if (idx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.fillStyle =
      sec.status === 'searched'
        ? 'rgba(16, 185, 129, 0.25)'
        : sec.status === 'in_progress'
        ? 'rgba(245, 158, 11, 0.25)'
        : 'rgba(59, 130, 246, 0.15)';
    ctx.fill();
    ctx.strokeStyle = sec.status === 'searched' ? '#10b981' : sec.status === 'in_progress' ? '#f59e0b' : '#3b82f6';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Sector label
    const [lx, ly] = toScreen(validPoly[0][0], validPoly[0][1]);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(sec.name, lx + 6, ly - 6);
  });

  // Draw Movement Trails / Tracks
  const allTracks = [...(op.archivedTracks || [])];
  if (userLocations) {
    Object.entries(userLocations).forEach(([uId, locState]) => {
      if (locState.trackHistory && locState.trackHistory.length > 1) {
        allTracks.push({
          id: `live-${uId}`,
          userId: uId,
          userName: 'Einsatzkraft',
          callSign: 'Unit',
          color: '#38bdf8',
          phaseLabel: 'Suchspur',
          recordedAt: new Date().toISOString(),
          points: locState.trackHistory,
        });
      }
    });
  }

  allTracks.forEach((track) => {
    if (!track.points || track.points.length < 2) return;
    const validPoints = track.points.filter(
      (pt) => pt && typeof pt.lat === 'number' && typeof pt.lng === 'number' && !isNaN(pt.lat) && !isNaN(pt.lng)
    );
    if (validPoints.length < 2) return;

    ctx.beginPath();
    validPoints.forEach((pt, i) => {
      const [tx, ty] = toScreen(pt.lat, pt.lng);
      if (i === 0) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    });
    ctx.strokeStyle = track.color || '#38bdf8';
    ctx.lineWidth = 3;
    ctx.stroke();
  });

  // Draw HQ / ELZ Marker
  if (op.headquartersLocation?.lat && typeof op.headquartersLocation.lat === 'number' && !isNaN(op.headquartersLocation.lat)) {
    const [hx, hy] = toScreen(op.headquartersLocation.lat, op.headquartersLocation.lng);
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(hx, hy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('ELZ / HQ', hx + 12, hy + 4);
  }

  // Draw Findings
  op.findings?.forEach((f) => {
    if (!f.location?.lat || typeof f.location.lat !== 'number' || isNaN(f.location.lat)) return;
    const [fx, fy] = toScreen(f.location.lat, f.location.lng);
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.arc(fx, fy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`🚩 ${f.title}`, fx + 8, fy + 3);
  });

  // Bottom Summary Legend
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, height - 50, width, 50);
  ctx.strokeStyle = '#334155';
  ctx.strokeRect(0, height - 50, width, 50);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px monospace';
  const tracksCount = allTracks.length;
  const sectorsCount = op.sectors?.length || 0;
  const findingsCount = op.findings?.length || 0;
  ctx.fillText(
    `DOKUMENTIERT: ${sectorsCount} Sektoren | ${tracksCount} Bewegungsprofile (Linien) | ${findingsCount} Fundmeldungen | Einsatzleitung: ${op.commander}`,
    24,
    height - 20
  );

  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Generates a standalone tactical canvas snapshot for a completed tracking test.
 * Uses pure Canvas 2D API – no html2canvas, no tile servers, no CORS issues.
 * Always produces a visible result regardless of map mount state.
 */
export function generateTrackingTestSnapshot(session: TrackingTestSession): string {
  const width = 1200;
  const height = 750;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const points: GpsPoint[] = session.trackPoints.filter(
    (p) => typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng)
  );

  // ── Background ────────────────────────────────────────────────────────────
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  // Tactical grid
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // ── Header bar ────────────────────────────────────────────────────────────
  ctx.fillStyle = '#1e3a5f';
  ctx.fillRect(0, 0, width, 58);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width, 58);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('GPS TRACKING-TEST • PRÜFPROTOKOLL', 20, 36);

  const dateStr = new Date(session.startTime).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`${dateStr} • ${session.durationMinutes} Min.`, width - 260, 36);

  // ── Coordinate mapping ────────────────────────────────────────────────────
  const padX = 70;
  const padY = 80;
  const plotW = width - padX * 2;
  const plotH = height - padY - 100;

  let minLat = 0, maxLat = 0, minLng = 0, maxLng = 0;
  const useDefaultExtent = points.length < 2;

  if (useDefaultExtent) {
    minLat = 51.74; maxLat = 51.76; minLng = 11.43; maxLng = 11.46;
  } else {
    minLat = Math.min(...points.map(p => p.lat));
    maxLat = Math.max(...points.map(p => p.lat));
    minLng = Math.min(...points.map(p => p.lng));
    maxLng = Math.max(...points.map(p => p.lng));
  }

  // Add 10 % padding around the bounding box so start/end markers aren't clipped
  const latSpan = Math.max(0.002, maxLat - minLat) * 1.2;
  const lngSpan = Math.max(0.002, maxLng - minLng) * 1.2;
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  minLat = centerLat - latSpan / 2;
  maxLat = centerLat + latSpan / 2;
  minLng = centerLng - lngSpan / 2;
  maxLng = centerLng + lngSpan / 2;

  const toScreen = (lat: number, lng: number): [number, number] => {
    const x = padX + ((lng - minLng) / lngSpan) * plotW;
    const y = padY + plotH - ((lat - minLat) / latSpan) * plotH;
    return [x, y];
  };

  // ── Plot area border ──────────────────────────────────────────────────────
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(padX, padY, plotW, plotH);

  // ── Coordinate axis labels (cardinal ticks) ───────────────────────────────
  ctx.fillStyle = '#475569';
  ctx.font = '10px monospace';
  const latTicks = 4;
  for (let i = 0; i <= latTicks; i++) {
    const lat = minLat + (latSpan * i) / latTicks;
    const [, sy] = toScreen(lat, minLng);
    ctx.fillText(lat.toFixed(4) + '°N', 4, sy + 4);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(padX, sy); ctx.lineTo(padX + plotW, sy); ctx.stroke();
  }
  const lngTicks = 5;
  for (let i = 0; i <= lngTicks; i++) {
    const lng = minLng + (lngSpan * i) / lngTicks;
    const [sx] = toScreen(minLat, lng);
    ctx.fillText(lng.toFixed(4) + '°E', sx - 24, padY + plotH + 16);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(sx, padY); ctx.lineTo(sx, padY + plotH); ctx.stroke();
  }

  // ── GPS Track line ────────────────────────────────────────────────────────
  if (points.length >= 2) {
    // Shadow / glow effect
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((pt, i) => {
      const [tx, ty] = toScreen(pt.lat, pt.lng);
      if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Direction arrow every ~20 points
    const step = Math.max(1, Math.floor(points.length / 12));
    ctx.fillStyle = '#60a5fa';
    for (let i = step; i < points.length - 1; i += step) {
      const [ax, ay] = toScreen(points[i].lat, points[i].lng);
      const [bx, by] = toScreen(points[i + 1].lat, points[i + 1].lng);
      const angle = Math.atan2(by - ay, bx - ax);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(8, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Start Marker (green) ──────────────────────────────────────────────────
  if (points.length >= 1) {
    const [sx, sy] = toScreen(points[0].lat, points[0].lng);
    ctx.fillStyle = '#10b981';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('START', sx + 13, sy + 4);
  }

  // ── End Marker (red) ──────────────────────────────────────────────────────
  if (points.length >= 2) {
    const last = points[points.length - 1];
    const [ex, ey] = toScreen(last.lat, last.lng);
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(ex, ey, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('ZIEL', ex + 13, ey + 4);
  }

  // ── No-data placeholder ───────────────────────────────────────────────────
  if (useDefaultExtent) {
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Keine GPS-Spur aufgezeichnet', width / 2, padY + plotH / 2);
    ctx.textAlign = 'left';
  }

  // ── Footer / legend bar ───────────────────────────────────────────────────
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, height - 70, width, 70);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, height - 70, width, 70);

  // Tester badge
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(20, height - 55, 6, 40);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`TESTER: ${session.userName.toUpperCase()}`, 34, height - 37);

  const startStr = new Date(session.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const endStr = new Date(session.endTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px monospace';
  ctx.fillText(`Zeitraum: ${startStr} – ${endStr}`, 34, height - 20);

  // Stats
  const totalDist = points.length >= 2
    ? points.slice(1).reduce((sum, pt, i) => {
        const prev = points[i];
        const dLat = (pt.lat - prev.lat) * 111320;
        const dLng = (pt.lng - prev.lng) * 111320 * Math.cos(prev.lat * Math.PI / 180);
        return sum + Math.sqrt(dLat * dLat + dLng * dLng);
      }, 0)
    : 0;
  const distLabel = totalDist > 1000
    ? (totalDist / 1000).toFixed(2) + ' km'
    : Math.round(totalDist) + ' m';

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`Distanz: ${distLabel}`, width / 2 - 120, height - 37);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px monospace';
  ctx.fillText(`${points.length} Wegpunkte aufgezeichnet`, width / 2 - 120, height - 20);

  // Track color legend
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(width - 180, height - 48, 30, 4);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px monospace';
  ctx.fillText('GPS-Spur', width - 140, height - 40);
  ctx.fillStyle = '#10b981';
  ctx.beginPath(); ctx.arc(width - 165, height - 24, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath(); ctx.arc(width - 145, height - 24, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Start / Ende', width - 133, height - 20);

  return canvas.toDataURL('image/jpeg', 0.9);
}

