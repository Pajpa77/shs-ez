import { SearchSector, Finding } from '../types';

export interface ImportedTrack {
  id: string;
  name: string;
  points: { lat: number; lng: number; altitude?: number; timestamp?: string }[];
  distanceMeters: number;
}

export interface ImportedSector {
  id: string;
  name: string;
  polygon: [number, number][]; // [lat, lng] Leaflet format
  areaHectares?: number;
}

export interface ImportedWaypoint {
  id: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
}

export interface GeoImportResult {
  filename: string;
  tracks: ImportedTrack[];
  sectors: ImportedSector[];
  waypoints: ImportedWaypoint[];
  rawFormat: 'gpx' | 'kml' | 'unknown';
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculatePolygonAreaHectares(polygon: [number, number][]): number {
  if (polygon.length < 3) return 0;
  const R = 6378137;
  let area = 0;
  const len = polygon.length;
  for (let i = 0; i < len; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % len];
    const x1 = (p1[1] * Math.PI) / 180 * Math.cos(((p1[0] + p2[0]) / 2 * Math.PI) / 180) * R;
    const y1 = (p1[0] * Math.PI) / 180 * R;
    const x2 = (p2[1] * Math.PI) / 180 * Math.cos(((p1[0] + p2[0]) / 2 * Math.PI) / 180) * R;
    const y2 = (p2[0] * Math.PI) / 180 * R;
    area += x1 * y2 - x2 * y1;
  }
  return Math.round((Math.abs(area) / 2 / 10000) * 10) / 10;
}

/**
 * Parses GPX or KML content from a string and returns normalized tracks, sectors, and waypoints.
 */
export function parseGeoFile(content: string, filename = 'Import'): GeoImportResult {
  const result: GeoImportResult = {
    filename,
    tracks: [],
    sectors: [],
    waypoints: [],
    rawFormat: 'unknown',
  };

  if (!content || !content.trim()) return result;

  const parser = new DOMParser();
  const xml = parser.parseFromString(content, 'text/xml');

  if (xml.getElementsByTagName('parsererror').length > 0) {
    console.error('[GeoImport] XML Parse error');
    return result;
  }

  const isGpx = xml.getElementsByTagName('gpx').length > 0 || content.includes('<trk') || content.includes('<wpt');
  const isKml = xml.getElementsByTagName('kml').length > 0 || content.includes('<Placemark') || content.includes('<Polygon');

  if (isGpx) {
    result.rawFormat = 'gpx';
    parseGpxDocument(xml, result);
  } else if (isKml) {
    result.rawFormat = 'kml';
    parseKmlDocument(xml, result);
  }

  return result;
}

function parseGpxDocument(xml: Document, result: GeoImportResult) {
  // 1. Parse Waypoints
  const wpts = xml.getElementsByTagName('wpt');
  for (let i = 0; i < wpts.length; i++) {
    const el = wpts[i];
    const lat = parseFloat(el.getAttribute('lat') || '');
    const lng = parseFloat(el.getAttribute('lon') || '');
    if (isNaN(lat) || isNaN(lng)) continue;

    const name = el.getElementsByTagName('name')[0]?.textContent?.trim() || `Wegpunkt ${i + 1}`;
    const desc = el.getElementsByTagName('desc')[0]?.textContent?.trim() || '';

    result.waypoints.push({
      id: `wpt-${Date.now()}-${i}`,
      name,
      description: desc,
      lat,
      lng,
    });
  }

  // 2. Parse Tracks
  const trks = xml.getElementsByTagName('trk');
  for (let t = 0; t < trks.length; t++) {
    const trkEl = trks[t];
    const name = trkEl.getElementsByTagName('name')[0]?.textContent?.trim() || `Spur ${t + 1}`;
    const trkpts = trkEl.getElementsByTagName('trkpt');
    const points: { lat: number; lng: number; altitude?: number; timestamp?: string }[] = [];
    let distance = 0;

    for (let p = 0; p < trkpts.length; p++) {
      const ptEl = trkpts[p];
      const lat = parseFloat(ptEl.getAttribute('lat') || '');
      const lng = parseFloat(ptEl.getAttribute('lon') || '');
      if (isNaN(lat) || isNaN(lng)) continue;

      const eleText = ptEl.getElementsByTagName('ele')[0]?.textContent;
      const timeText = ptEl.getElementsByTagName('time')[0]?.textContent;
      const altitude = eleText ? parseFloat(eleText) : undefined;
      const timestamp = timeText ? new Date(timeText).toISOString() : undefined;

      const pt = { lat, lng, altitude, timestamp };
      if (points.length > 0) {
        const last = points[points.length - 1];
        distance += calculateDistance(last.lat, last.lng, lat, lng);
      }
      points.push(pt);
    }

    if (points.length >= 2) {
      // Check if track is closed polygon (first and last point within 15 meters)
      const first = points[0];
      const last = points[points.length - 1];
      const isClosed = points.length >= 4 && calculateDistance(first.lat, first.lng, last.lat, last.lng) < 15;

      if (isClosed) {
        // Also provide as a candidate sector
        const polygon: [number, number][] = points.map((pt) => [pt.lat, pt.lng]);
        result.sectors.push({
          id: `sec-imp-${Date.now()}-${t}`,
          name: name.startsWith('Sektor') ? name : `Sektor ${name}`,
          polygon,
          areaHectares: calculatePolygonAreaHectares(polygon),
        });
      }

      result.tracks.push({
        id: `trk-${Date.now()}-${t}`,
        name,
        points,
        distanceMeters: Math.round(distance),
      });
    }
  }

  // 3. Parse Routes as Tracks if present
  const rtes = xml.getElementsByTagName('rte');
  for (let r = 0; r < rtes.length; r++) {
    const rteEl = rtes[r];
    const name = rteEl.getElementsByTagName('name')[0]?.textContent?.trim() || `Route ${r + 1}`;
    const rtepts = rteEl.getElementsByTagName('rtept');
    const points: { lat: number; lng: number; altitude?: number }[] = [];
    let distance = 0;

    for (let p = 0; p < rtepts.length; p++) {
      const ptEl = rtepts[p];
      const lat = parseFloat(ptEl.getAttribute('lat') || '');
      const lng = parseFloat(ptEl.getAttribute('lon') || '');
      if (isNaN(lat) || isNaN(lng)) continue;

      const pt = { lat, lng };
      if (points.length > 0) {
        const last = points[points.length - 1];
        distance += calculateDistance(last.lat, last.lng, lat, lng);
      }
      points.push(pt);
    }

    if (points.length >= 2) {
      result.tracks.push({
        id: `rte-${Date.now()}-${r}`,
        name,
        points,
        distanceMeters: Math.round(distance),
      });
    }
  }
}

function parseKmlDocument(xml: Document, result: GeoImportResult) {
  const placemarks = xml.getElementsByTagName('Placemark');
  for (let i = 0; i < placemarks.length; i++) {
    const pm = placemarks[i];
    const name = pm.getElementsByTagName('name')[0]?.textContent?.trim() || `Objekt ${i + 1}`;
    const desc = pm.getElementsByTagName('description')[0]?.textContent?.trim() || '';

    // Check Polygon (Search Sector)
    const polygonEl = pm.getElementsByTagName('Polygon')[0];
    if (polygonEl) {
      const coordsText = polygonEl.getElementsByTagName('coordinates')[0]?.textContent?.trim() || '';
      const polygon = parseKmlCoordinates(coordsText);
      if (polygon.length >= 3) {
        result.sectors.push({
          id: `sec-kml-${Date.now()}-${i}`,
          name,
          polygon,
          areaHectares: calculatePolygonAreaHectares(polygon),
        });
      }
      continue;
    }

    // Check LineString (Tracks / Trails)
    const lineEl = pm.getElementsByTagName('LineString')[0];
    if (lineEl) {
      const coordsText = lineEl.getElementsByTagName('coordinates')[0]?.textContent?.trim() || '';
      const poly = parseKmlCoordinates(coordsText);
      if (poly.length >= 2) {
        let dist = 0;
        for (let j = 1; j < poly.length; j++) {
          dist += calculateDistance(poly[j - 1][0], poly[j - 1][1], poly[j][0], poly[j][1]);
        }
        result.tracks.push({
          id: `trk-kml-${Date.now()}-${i}`,
          name,
          points: poly.map(([lat, lng]) => ({ lat, lng })),
          distanceMeters: Math.round(dist),
        });
      }
      continue;
    }

    // Check Point (Waypoint / POI)
    const pointEl = pm.getElementsByTagName('Point')[0];
    if (pointEl) {
      const coordsText = pointEl.getElementsByTagName('coordinates')[0]?.textContent?.trim() || '';
      const parts = coordsText.split(',').map((s) => parseFloat(s.trim()));
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        // KML format is longitude, latitude, altitude
        result.waypoints.push({
          id: `wpt-kml-${Date.now()}-${i}`,
          name,
          description: desc,
          lat: parts[1],
          lng: parts[0],
        });
      }
    }
  }
}

function parseKmlCoordinates(str: string): [number, number][] {
  const result: [number, number][] = [];
  const tuples = str.trim().split(/\s+/);
  for (const t of tuples) {
    if (!t) continue;
    const parts = t.split(',').map((s) => parseFloat(s.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      // KML is Longitude, Latitude. Leaflet needs [Latitude, Longitude]
      result.push([parts[1], parts[0]]);
    }
  }
  return result;
}
