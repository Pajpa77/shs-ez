import { GpsPoint, ArchivedSearchTrack, SearchOperation } from '../types';

function escapeXml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
}

/**
 * Exports a single searcher / K9 dog track as a standard GPX 1.1 file
 * Compatible with Garmin GPS handhelds (Alpha, Astro, GPSMAP), QGIS, CalTopo, OsmAnd, etc.
 */
export function exportSingleTrackAsGpx(options: {
  points: GpsPoint[];
  callSign: string;
  userName?: string;
  operationTitle?: string;
}): void {
  const { points, callSign, userName, operationTitle } = options;
  if (!points || points.length === 0) {
    alert('Keine GPS-Punkte für diesen Sucher vorhanden.');
    return;
  }

  const safeCallSign = escapeXml(callSign || 'Sucher');
  const safeUserName = escapeXml(userName || '');
  const safeOpTitle = escapeXml(operationTitle || 'Sucheinsatz');
  const creationTime = new Date().toISOString();

  let trackPointsXml = '';
  for (const pt of points) {
    if (typeof pt.lat !== 'number' || typeof pt.lng !== 'number') continue;
    const eleXml = typeof pt.altitude === 'number' ? `\n        <ele>${pt.altitude.toFixed(1)}</ele>` : '';
    const timeXml = pt.timestamp ? `\n        <time>${pt.timestamp}</time>` : '';
    const speedXml = typeof pt.speed === 'number' ? `\n        <cmt>Geschwindigkeit: ${pt.speed} km/h</cmt>` : '';
    trackPointsXml += `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lng.toFixed(6)}">${eleXml}${timeXml}${speedXml}\n      </trkpt>\n`;
  }

  const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SHS-EZ Rettungshunde &amp; Einsatzleitsystem (Spürhunde-Salzlandkreis e.V.)"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Suchspur ${safeCallSign} - ${safeOpTitle}</name>
    <desc>Aufgezeichnete Rettungshunde- / Suchkraftspur für ${safeUserName} (${safeCallSign})</desc>
    <time>${creationTime}</time>
  </metadata>
  <trk>
    <name>${safeCallSign} (${safeUserName})</name>
    <desc>Einsatz: ${safeOpTitle} | Punkte: ${points.length}</desc>
    <type>Search and Rescue Track</type>
    <trkseg>
${trackPointsXml}    </trkseg>
  </trk>
</gpx>`;

  const blob = new Blob([gpxContent], { type: 'application/gpx+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `suchspur_${sanitizeFilename(callSign)}_${dateStr}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports all archived tracks of an operation as a consolidated multi-track GPX 1.1 file
 */
export function exportOperationTracksAsGpx(operation: SearchOperation): void {
  const tracks = operation.archivedTracks || [];
  if (tracks.length === 0) {
    alert('Dieser Einsatz enthält keine archivierten Suchspuren.');
    return;
  }

  const safeOpTitle = escapeXml(operation.title || 'Einsatz');
  const creationTime = new Date().toISOString();

  let trkBlocksXml = '';
  for (const track of tracks) {
    if (!track.points || track.points.length === 0) continue;
    const safeName = escapeXml(track.callSign || track.userName || track.userId);
    let ptsXml = '';
    for (const pt of track.points) {
      if (typeof pt.lat !== 'number' || typeof pt.lng !== 'number') continue;
      const eleXml = typeof pt.altitude === 'number' ? `\n        <ele>${pt.altitude.toFixed(1)}</ele>` : '';
      const timeXml = pt.timestamp ? `\n        <time>${pt.timestamp}</time>` : '';
      ptsXml += `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lng.toFixed(6)}">${eleXml}${timeXml}\n      </trkpt>\n`;
    }

    trkBlocksXml += `  <trk>
    <name>${safeName}</name>
    <desc>Rettungshund / Suchkraft: ${escapeXml(track.userName || '')} (${safeName})</desc>
    <trkseg>
${ptsXml}    </trkseg>
  </trk>\n`;
  }

  const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SHS-EZ Rettungshunde &amp; Einsatzleitsystem (Spürhunde-Salzlandkreis e.V.)"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Gesamteinsatz Spuren: ${safeOpTitle}</name>
    <desc>Alle aufgezeichneten Such- und Hundespuren aus dem Einsatz ${safeOpTitle}</desc>
    <time>${creationTime}</time>
  </metadata>
${trkBlocksXml}</gpx>`;

  const blob = new Blob([gpxContent], { type: 'application/gpx+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = (operation.createdAt || new Date().toISOString()).slice(0, 10);
  a.download = `einsatz_alle_spuren_${sanitizeFilename(operation.title)}_${dateStr}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
