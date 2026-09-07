import html2canvas from 'html2canvas';
import { SearchOperation, UserLocationState } from '../types';

/**
 * Captures a high-resolution screenshot of the tactical map container.
 * If the map DOM element is not mounted, generates a clean tactical map schema preview canvas.
 */
export async function captureTacticalMapScreenshot(
  fallbackOperation?: SearchOperation | null,
  userLocations?: Record<string, UserLocationState>
): Promise<string | null> {
  // Always use the reliable 2D Tactical Lagekarten-Snapshot instead of html2canvas
  // html2canvas is extremely brittle with Leaflet's 3D transforms and cross-origin tiles,
  // often resulting in blank or broken images. The fallback renderer guarantees a crisp,
  // professional tactical schema map.
  
  if (fallbackOperation) {
    try {
      return generateTacticalCanvasFallback(fallbackOperation, userLocations);
    } catch (fallbackErr) {
      console.warn('[mapSnapshotHelper] Tactical canvas fallback failed:', fallbackErr);
    }
  }

  // If already has existing mapSnapshotUrl, return that
  if (fallbackOperation?.mapSnapshotUrl && fallbackOperation.mapSnapshotUrl.startsWith('data:image')) {
    return fallbackOperation.mapSnapshotUrl;
  }

  return null;
}

/**
 * Renders a stylized vector tactical map schema if the Leaflet DOM is unmounted or in background.
 */
function generateTacticalCanvasFallback(
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
