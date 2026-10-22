import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useYouth } from '../YouthContext';
import {
  Compass,
  MapPin,
  Sparkles,
  Navigation,
  Layers,
  PenTool,
  Check,
  X,
  ShieldAlert,
  AlertTriangle,
  CloudSun,
  Moon,
  Sun,
  ChevronDown,
  GripVertical,
} from 'lucide-react';
import { TacticalWeatherOverlay } from '../../components/TacticalWeatherOverlay';

// Basemap layer configurations matching main TacticalMap
const YOUTH_TILE_LAYERS: Record<'osm' | 'hybrid' | 'satellite' | 'topo', { name: string; url: string; roadsUrl?: string; attribution: string; maxZoom: number }> = {
  osm: {
    name: 'Standard (OSM)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  },
  topo: {
    name: 'Topografie & Höhenlinien',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap',
    maxZoom: 17,
  },
  satellite: {
    name: 'Satellit (Luftbild)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar',
    maxZoom: 19,
  },
  hybrid: {
    name: 'Satellit + Wege/Straßen',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    roadsUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar',
    maxZoom: 19,
  },
};

interface YouthTacticalMapProps {
  onOpenFindingModal: () => void;
  // Drawing mode triggers from parent / modal
  drawingSectorData?: { name: string; targetTeam: 'jugend' | 'erwachsene' | 'all' } | null;
  onFinishDrawingSector?: (coords: [number, number][]) => void;
  onCancelDrawingSector?: () => void;
}

export const YouthTacticalMap: React.FC<YouthTacticalMapProps> = ({
  onOpenFindingModal,
  drawingSectorData,
  onFinishDrawingSector,
  onCancelDrawingSector,
}) => {
  const {
    currentYouthUser,
    allYouthUsers,
    currentYouthOperation,
    updateYouthOperation,
    isExerciseActive,
    isExercisePaused,
    youthLocations,
    activeSosAlert,
    triggerSosAlert,
    dismissSosAlert,
  } = useYouth();

  const [showSosConfirm, setShowSosConfirm] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const tracksLayerRef = useRef<L.LayerGroup | null>(null);
  const sectorsLayerRef = useRef<L.LayerGroup | null>(null);
  const geofenceLayerRef = useRef<L.LayerGroup | null>(null);
  const drawingLayerRef = useRef<L.LayerGroup | null>(null);
  const sosLayerRef = useRef<L.LayerGroup | null>(null);
  const ezLayerRef = useRef<L.LayerGroup | null>(null);

  // Toast notice for EZ movement
  const [ezToast, setEzToast] = useState<string | null>(null);

  // Basemap & Layer control state (wie in der Hauptapp)
  const [activeBaseMap, setActiveBaseMap] = useState<'osm' | 'topo' | 'satellite' | 'hybrid'>('osm');
  const [isMapLight, setIsMapLight] = useState<boolean>(false);
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);
  const [showWeatherOverlay, setShowWeatherOverlay] = useState<boolean>(false);
  const [showAero, setShowAero] = useState<boolean>(false);
  const [aeroLegendOpen, setAeroLegendOpen] = useState<boolean>(false);
  const baseTileLayerRef = useRef<L.Layer | null>(null);
  const roadsTileLayerRef = useRef<L.Layer | null>(null);
  const aeroLayerRef = useRef<L.Layer | null>(null);

  // Sector drawing state
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const drawingPointsRef = useRef<[number, number][]>([]);
  drawingPointsRef.current = drawingPoints;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on current operation EZ or default
    const initialCenter: [number, number] = [
      currentYouthOperation?.headquartersLocation?.lat || 51.798,
      currentYouthOperation?.headquartersLocation?.lng || 11.74,
    ];
    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 15,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    const tracksGroup = L.layerGroup().addTo(map);
    const sectorsGroup = L.layerGroup().addTo(map);
    const geofenceGroup = L.layerGroup().addTo(map);
    const drawingGroup = L.layerGroup().addTo(map);
    const sosGroup = L.layerGroup().addTo(map);
    const ezGroup = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    markersLayerRef.current = markersGroup;
    tracksLayerRef.current = tracksGroup;
    sectorsLayerRef.current = sectorsGroup;
    geofenceLayerRef.current = geofenceGroup;
    drawingLayerRef.current = drawingGroup;
    sosLayerRef.current = sosGroup;
    ezLayerRef.current = ezGroup;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Basemap & Satellite Layer dynamically
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
      baseTileLayerRef.current = null;
    }
    if (roadsTileLayerRef.current) {
      map.removeLayer(roadsTileLayerRef.current);
      roadsTileLayerRef.current = null;
    }

    const cfg = YOUTH_TILE_LAYERS[activeBaseMap];
    const newBase = L.tileLayer(cfg.url, {
      maxZoom: cfg.maxZoom,
      attribution: cfg.attribution,
    }).addTo(map);
    newBase.bringToBack();
    baseTileLayerRef.current = newBase;

    if (activeBaseMap === 'hybrid' && cfg.roadsUrl) {
      const roads = L.tileLayer(cfg.roadsUrl, {
        maxZoom: cfg.maxZoom,
      }).addTo(map);
      roadsTileLayerRef.current = roads;
    }
  }, [activeBaseMap]);

  // Apply light/dark filter to OSM / Topo tiles (like in main TacticalMap)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const tilePane = map.getPane('tilePane');
    if (!tilePane) return;

    const shouldInvert = !isMapLight && activeBaseMap !== 'satellite' && activeBaseMap !== 'hybrid';
    tilePane.style.filter = shouldInvert
      ? 'invert(1) hue-rotate(180deg) brightness(0.82) saturate(0.9)'
      : 'none';
  }, [isMapLight, activeBaseMap]);

  // Luftraum / Drohnen-Geozonen Layer (dipul / DFS wie in der Hauptapp)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (showAero) {
      if (!aeroLayerRef.current) {
        const dipulLayers =
          'bahnanlagen,behoerden,binnenwasserstrassen,bundesautobahnen,bundesstrassen,diplomatische_vertretungen,ffh-gebiete,flugbeschraenkungsgebiete,flughaefen,flugplaetze,freibaeder,haengegleiter,inaktive_temporaere_betriebseinschraenkungen,industrieanlagen,internationale_organisationen,justizvollzugsanstalten,kontrollzonen,kraftwerke,krankenhaeuser,labore,militaerische_anlagen,modellflugplaetze,nationalparks,naturschutzgebiete,polizei,schifffahrtsanlagen,seewasserstrassen,sicherheitsbehoerden,stromleitungen,temporaere_betriebseinschraenkungen,umspannwerke,vogelschutzgebiete,windkraftanlagen,wohngrundstuecke';

        aeroLayerRef.current = (L.tileLayer as any).wms('https://uas-betrieb.de/geoservices/dipul/wms', {
          layers: dipulLayers,
          format: 'image/png',
          transparent: true,
          maxZoom: 22,
          attribution: '&copy; DFS / dipul',
        });
      }

      if (aeroLayerRef.current && !map.hasLayer(aeroLayerRef.current)) {
        map.addLayer(aeroLayerRef.current);
      }
    } else {
      if (aeroLayerRef.current && map.hasLayer(aeroLayerRef.current)) {
        map.removeLayer(aeroLayerRef.current);
      }
    }
  }, [showAero]);

  // Handle map click during drawing mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (!drawingSectorData) return;
      const newPoint: [number, number] = [Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))];
      setDrawingPoints((prev) => [...prev, newPoint]);
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [drawingSectorData]);

  // Render in-progress drawing points & line
  useEffect(() => {
    const drawingGroup = drawingLayerRef.current;
    if (!drawingGroup) return;

    drawingGroup.clearLayers();

    if (!drawingSectorData || drawingPoints.length === 0) return;

    // Draw vertex markers
    drawingPoints.forEach((pt, index) => {
      const circle = L.circleMarker(pt, {
        radius: 6,
        color: '#f59e0b',
        fillColor: '#fef08a',
        fillOpacity: 0.9,
        weight: 2,
      });
      circle.bindTooltip(`Punkt ${index + 1}`, { permanent: false, direction: 'top' });
      circle.addTo(drawingGroup);
    });

    // Draw polyline or polygon
    if (drawingPoints.length > 2) {
      const poly = L.polygon(drawingPoints, {
        color: '#f59e0b',
        fillColor: '#f59e0b',
        fillOpacity: 0.25,
        weight: 3,
        dashArray: '6, 6',
      });
      poly.addTo(drawingGroup);
    } else if (drawingPoints.length === 2) {
      const line = L.polyline(drawingPoints, {
        color: '#f59e0b',
        weight: 3,
        dashArray: '6, 6',
      });
      line.addTo(drawingGroup);
    }
  }, [drawingPoints, drawingSectorData]);

  // ── 📡 EINSATZZENTRALE (EZ) & SICHERHEITSGRENZE RENDERN ──
  useEffect(() => {
    const ezGroup = ezLayerRef.current;
    const geofenceGroup = geofenceLayerRef.current;
    const map = mapInstanceRef.current;
    if (!ezGroup || !geofenceGroup || !map || !currentYouthOperation) return;

    ezGroup.clearLayers();
    geofenceGroup.clearLayers();

    const hq = currentYouthOperation.headquartersLocation || {
      lat: 51.798,
      lng: 11.74,
      address: currentYouthOperation.locationName || 'Sammelpunkt / EZ der Übung',
    };

    const radius = currentYouthOperation.geofenceRadiusMeters || 1200;
    const isAdmin = currentYouthUser?.role === 'youth_admin';

    // 1. Render Geofence Circle around EZ (Sicherheitsgrenze) - NUR während aktiver oder pausierter Übung!
    if (isExerciseActive || isExercisePaused) {
      const geofenceCircle = L.circle([hq.lat, hq.lng], {
        radius,
        color: '#f59e0b',
        fillColor: '#f59e0b',
        fillOpacity: 0.05,
        weight: 2,
        dashArray: '8, 8',
      });
      geofenceCircle.bindTooltip(
        `🛡️ Sicherheitsgrenze (${radius}m um 📡 EZ)`,
        { permanent: false, direction: 'top', className: 'font-mono text-xs' }
      );
      geofenceCircle.addTo(geofenceGroup);
    }

    // 2. Count Admins currently stationed in EZ
    const ezAdmins = allYouthUsers.filter((u) => {
      const isEzRole = u.operationalRole === 'ez_command' || currentYouthOperation.ezAdminIds?.includes(u.id);
      return u.isActive && isEzRole;
    });

    const badgeHtml = ezAdmins.length > 0
      ? `<span style="margin-left:4px;padding:1px 6px;background:#10b981;color:#000;font-weight:900;border-radius:10px;font-size:10px;">${ezAdmins.length}</span>`
      : '';

    // 3. Render 📡 EZ Pin (Draggable for Admins!)
    const ezIcon = L.divIcon({
      className: 'youth-ez-pin',
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.6));transform:translate(-50%, -100%);">
          <div style="display:flex;align-items:center;gap:4px;padding:4px 9px;border-radius:12px;background:#001A9E;color:#ffffff;font-weight:900;font-size:11px;font-family:sans-serif;white-space:nowrap;border:2px solid #22d3ee;box-shadow:0 0 12px rgba(34,211,238,0.5);">
            <span>📡 EZ</span>
            ${badgeHtml}
          </div>
          <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #22d3ee;margin-top:-1px;"></div>
        </div>
      `,
      iconSize: [80, 40],
      iconAnchor: [40, 40],
    });

    const ezMarker = L.marker([hq.lat, hq.lng], {
      icon: ezIcon,
      draggable: Boolean(isAdmin),
      zIndexOffset: 1000,
    });

    ezMarker.bindPopup(`
      <div style="font-family:sans-serif;font-size:12px;color:#0f172a;">
        <strong style="color:#001A9E;font-size:13px;">📡 Einsatzzentrale (EZ) & Sammelpunkt</strong><br/>
        Standort: <strong>${hq.address || 'Übungs-EZ vor Ort'}</strong><br/>
        Sicherheitsradius: <strong>${radius} Meter</strong><br/>
        GPS: ${hq.lat.toFixed(5)}, ${hq.lng.toFixed(5)}<br/>
        ${isAdmin ? '<span style="color:#0284c7;font-size:11px;margin-top:4px;display:block;">💡 Admin-Tipp: Pin gedrückt halten zum Verschieben der EZ!</span>' : ''}
      </div>
    `);

    // Handle Drag & Drop of EZ Pin by Admin to move Sammelpunkt
    ezMarker.on('dragend', (e: any) => {
      const newPos = e.target.getLatLng();
      const roundedLat = Number(newPos.lat.toFixed(6));
      const roundedLng = Number(newPos.lng.toFixed(6));

      const updatedHq = {
        lat: roundedLat,
        lng: roundedLng,
        address: `${currentYouthOperation.locationName} (Sammelpunkt neu justiert)`,
      };

      updateYouthOperation(currentYouthOperation.id, {
        headquartersLocation: updatedHq,
      });

      setEzToast(`📡 Einsatzzentrale (EZ) auf neue GPS-Position verlegt! (${roundedLat}, ${roundedLng})`);
      setTimeout(() => setEzToast(null), 4000);
    });

    ezMarker.addTo(ezGroup);
  }, [
    currentYouthOperation?.headquartersLocation,
    currentYouthOperation?.geofenceRadiusMeters,
    currentYouthOperation?.ezAdminIds,
    allYouthUsers,
    currentYouthUser?.role,
    isExerciseActive,
    isExercisePaused,
  ]);

  // Update Active SOS Emergency Alert Pin & Pulsing Radius
  useEffect(() => {
    const sosGroup = sosLayerRef.current;
    const map = mapInstanceRef.current;
    if (!sosGroup || !map) return;

    sosGroup.clearLayers();

    if (!activeSosAlert || !activeSosAlert.location) return;

    const { lat, lng } = activeSosAlert.location;

    // Pulsing outer red alert circle
    const alertCircle = L.circle([lat, lng], {
      radius: 40,
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 0.35,
      weight: 3,
      dashArray: '6, 6',
    });
    alertCircle.addTo(sosGroup);

    // High-visibility emergency marker pin
    const sosIcon = L.divIcon({
      className: 'sos-alert-pin',
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%, -100%);">
          <div style="background:#dc2626;color:#ffffff;border:3px solid #ffffff;border-radius:14px;padding:4px 8px;font-size:12px;font-weight:900;font-family:sans-serif;box-shadow:0 0 20px #ef4444;display:flex;align-items:center;gap:4px;white-space:nowrap;animation:pulse 1s infinite;">
            <span style="font-size:14px;">🚨</span>
            <span>SOS: ${activeSosAlert.userName}</span>
          </div>
          <div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:10px solid #dc2626;margin-top:-1px;"></div>
        </div>
      `,
      iconSize: [36, 48],
      iconAnchor: [18, 48],
    });

    const sosMarker = L.marker([lat, lng], { icon: sosIcon, zIndexOffset: 9999 });
    sosMarker.bindPopup(`
      <div style="font-family:sans-serif;font-size:12px;color:#1e293b;">
        <strong style="color:#dc2626;">🚨 NOTFALL-PFEIFE / SOS AKTIV</strong><br/>
        Name: <strong>${activeSosAlert.userName}</strong><br/>
        Funkrufname: ${activeSosAlert.userCallSign}<br/>
        Alarmzeit: ${activeSosAlert.timestamp}<br/>
        Koordinaten: ${lat.toFixed(5)}, ${lng.toFixed(5)}
      </div>
    `);
    sosMarker.addTo(sosGroup);

    // Auto pan/zoom to SOS alert location
    map.flyTo([lat, lng], 17, { duration: 1.2 });
  }, [activeSosAlert]);

  // Update Sectors
  useEffect(() => {
    const sectorsGroup = sectorsLayerRef.current;
    const map = mapInstanceRef.current;
    if (!sectorsGroup || !map || !currentYouthOperation) return;

    sectorsGroup.clearLayers();

    currentYouthOperation.sectors.forEach((sec) => {
      if (!sec.polygon || sec.polygon.length < 3) return;

      const isSearched = sec.status === 'searched';
      const color = sec.color || (isSearched ? '#10b981' : sec.assignedTeam === 'erwachsene' ? '#10b981' : '#38bdf8');

      const polygon = L.polygon(sec.polygon, {
        color,
        fillColor: color,
        fillOpacity: isSearched ? 0.35 : 0.18,
        weight: 3,
        dashArray: isSearched ? undefined : '5, 5',
      });

      polygon.bindTooltip(
        `<b>${sec.name}</b><br/>Status: ${isSearched ? 'Abgesucht' : 'Offen'}<br/>Team: ${sec.assignedTeam}`,
        {
          permanent: false,
          direction: 'center',
          className: 'font-mono text-xs',
        }
      );

      polygon.addTo(sectorsGroup);
    });
  }, [currentYouthOperation?.sectors]);

  // Update User Markers, Tracks, and Findings
  useEffect(() => {
    const markersGroup = markersLayerRef.current;
    const tracksGroup = tracksLayerRef.current;
    const map = mapInstanceRef.current;
    if (!markersGroup || !tracksGroup || !map) return;

    markersGroup.clearLayers();
    tracksGroup.clearLayers();

    // 1. Render all active users with their locations
    Object.entries(youthLocations).forEach(([userId, locState]) => {
      const user = allYouthUsers.find((u) => u.id === userId) || (userId === currentYouthUser?.id ? currentYouthUser : null);
      if (!locState.currentPosition) return;

      // Haupt-App-Regel: Admins in der EZ haben keinen eigenen Pin & keine Spur, sondern sitzen im 📡 EZ Pin!
      const isEzAdmin = user?.operationalRole === 'ez_command' || currentYouthOperation?.ezAdminIds?.includes(userId);
      if (isEzAdmin) return;

      const isMe = userId === currentYouthUser?.id;
      const isAdult = user?.team === 'erwachsene' || user?.isAdultAccount;
      const isAdmin = user?.role === 'youth_admin' || user?.team === 'leitung';
      const userColor = user?.trackColor || (isAdult ? '#10b981' : isAdmin ? '#f59e0b' : '#38bdf8');
      const iconSymbol = isAdmin ? '🛡️' : isAdult ? '🦺' : '🎒';

      // Custom HTML Marker Pin (Reines Foto-Avatar-Pin wie in der Hauptapp - ohne doppelten Namensbalken)
      const userPhoto = user?.photoUrl;
      const initialLetter = (user?.name || 'T').charAt(0).toUpperCase();
      const avatarBorderColor = isMe ? '#38bdf8' : userColor;

      const icon = L.divIcon({
        className: 'custom-youth-pin',
        html: `
          <div style="position:relative;width:40px;height:40px;cursor:pointer;transform:translate(-50%, -50%);">
            <div style="width:40px;height:40px;border-radius:50%;border:2.5px solid ${avatarBorderColor};background-color:${userColor};box-shadow:0 4px 12px rgba(0,0,0,0.6);overflow:hidden;display:flex;align-items:center;justify-content:center;">
              ${
                userPhoto
                  ? `<img src="${userPhoto}" alt="${user?.name || ''}" style="width:100%;height:100%;object-fit:cover;" />`
                  : `<span style="color:#fff;font-weight:900;font-size:15px;text-shadow:0 1px 2px rgba(0,0,0,0.6);">${initialLetter}</span>`
              }
            </div>
            ${isMe ? '<div style="position:absolute;bottom:-2px;right:-2px;background:#0284c7;color:#fff;border-radius:6px;padding:1px 4px;font-size:8px;font-weight:900;font-family:monospace;border:1.5px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.5);">DU</div>' : ''}
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([locState.currentPosition.lat, locState.currentPosition.lng], { icon });
      marker.bindPopup(`
        <div style="font-family:sans-serif;font-size:12px;">
          <strong>${iconSymbol} ${user?.name || 'Teilnehmer'}</strong><br/>
          Rolle: ${isAdmin ? 'Jugend-Admin' : isAdult ? 'Team Erwachsene' : 'Team Jugend'}<br/>
          Funkrufname: ${user?.callSign || '-'}<br/>
          Status: ${user?.arrivalStatus === 'ready' ? '🟢 Bereit (im Suchbereich)' : '⚪ Wartet / Anfahrt'}<br/>
          Stand: ${new Date(locState.currentPosition.timestamp).toLocaleTimeString('de-DE')}
        </div>
      `);
      marker.addTo(markersGroup);

      // Track line (Breadcrumbs)
      if (locState.trackHistory && locState.trackHistory.length > 1) {
        const polyline = L.polyline(
          locState.trackHistory.map((pt) => [pt.lat, pt.lng]),
          {
            color: userColor,
            weight: 4,
            opacity: 0.8,
            dashArray: isAdult ? '6, 6' : undefined,
          }
        );
        polyline.addTo(tracksGroup);
      }
    });

    // 2. Render Findings (Fundstücke / Puppe)
    if (currentYouthOperation?.findings) {
      currentYouthOperation.findings.forEach((finding) => {
        if (!finding.location) return;

        const findingIcon = L.divIcon({
          className: 'finding-pin',
          html: `
            <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%, -100%);">
              <div style="background:#f43f5e;color:#fff;border:2px solid #fff;border-radius:12px;padding:3px 7px;font-size:11px;font-weight:900;box-shadow:0 3px 8px rgba(0,0,0,0.5);display:flex;align-items:center;gap:3px;white-space:nowrap;">
                <span>🎯</span>
                <span>${finding.title}</span>
              </div>
              <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid #f43f5e;margin-top:-1px;"></div>
            </div>
          `,
          iconSize: [30, 42],
          iconAnchor: [15, 42],
        });

        const findingMarker = L.marker([finding.location.lat, finding.location.lng], { icon: findingIcon });
        findingMarker.bindPopup(`
          <div style="font-family:sans-serif;font-size:12px;">
            <strong>🎯 ${finding.title}</strong><br/>
            Gefunden von: ${finding.finderName} (${finding.finderTeam === 'jugend' ? '🎒 Jugend' : '🦺 Erwachsene'})<br/>
            Uhrzeit: ${finding.timestamp}<br/>
            ${finding.description ? `Notiz: ${finding.description}` : ''}
          </div>
        `);
        findingMarker.addTo(markersGroup);
      });
    }
  }, [youthLocations, allYouthUsers, currentYouthUser, currentYouthOperation?.findings, currentYouthOperation?.ezAdminIds]);

  // Center on current user
  const handleCenterOnMe = () => {
    if (!mapInstanceRef.current || !currentYouthUser) return;
    const myLoc = youthLocations[currentYouthUser.id]?.currentPosition;
    if (myLoc) {
      mapInstanceRef.current.setView([myLoc.lat, myLoc.lng], 16, { animate: true });
    }
  };

  // Center on 📡 EZ
  const handleCenterOnEz = () => {
    if (!mapInstanceRef.current) return;
    const hq = currentYouthOperation?.headquartersLocation || {
      lat: 51.798,
      lng: 11.74,
    };
    mapInstanceRef.current.setView([hq.lat, hq.lng], 16, { animate: true });
  };

  // Check geofence around EZ - NUR während aktiver Übung! (Im Bereitschaftszustand gibt es keine Sicherheitszone)
  const myLoc = currentYouthUser ? youthLocations[currentYouthUser.id]?.currentPosition : null;
  const hqCenter = currentYouthOperation?.headquartersLocation
    ? [currentYouthOperation.headquartersLocation.lat, currentYouthOperation.headquartersLocation.lng]
    : [51.798, 11.74];
  const geofenceRadius = currentYouthOperation?.geofenceRadiusMeters || 1200;
  const isOutOfGeofence = isExerciseActive && myLoc && mapInstanceRef.current
    ? mapInstanceRef.current.distance([myLoc.lat, myLoc.lng], hqCenter as any) > geofenceRadius
    : false;

  const jugendFindings = currentYouthOperation?.findings.filter((f) => f.finderTeam === 'jugend').length || 0;
  const erwachseneFindings = currentYouthOperation?.findings.filter((f) => f.finderTeam === 'erwachsene').length || 0;

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Toast Notice when EZ moved */}
      {ezToast && (
        <div className="absolute top-4 left-4 right-4 z-[700] p-3 rounded-2xl bg-cyan-500 text-slate-950 font-black font-mono text-xs shadow-2xl flex items-center gap-2 animate-fadeIn border-2 border-white">
          <span>📡</span>
          <span>{ezToast}</span>
        </div>
      )}

      {/* Drawing Toolbar Overlay */}
      {drawingSectorData && (
        <div className="absolute top-4 left-4 right-4 z-[600] p-3.5 rounded-2xl bg-[#000E66]/95 border-2 border-amber-400 text-white shadow-2xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div>
            <div className="flex items-center gap-2">
              <PenTool className="w-4 h-4 text-amber-300 animate-pulse" />
              <span className="font-bold text-xs uppercase font-mono text-amber-300">
                Sektor-Zeichenmodus aktiv: {drawingSectorData.name}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Klicke auf die Karte, um die Eckpunkte des Sektors zu setzen ({drawingPoints.length} Punkte gesetzt).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={drawingPoints.length < 3}
              onClick={() => {
                if (onFinishDrawingSector && drawingPoints.length >= 3) {
                  onFinishDrawingSector(drawingPoints);
                  setDrawingPoints([]);
                }
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold font-mono text-xs uppercase flex items-center gap-1.5 transition cursor-pointer shadow-lg"
            >
              <Check className="w-4 h-4" />
              <span>Sektor speichern ({drawingPoints.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDrawingPoints([]);
                if (onCancelDrawingSector) onCancelDrawingSector();
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs uppercase flex items-center gap-1 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Abbrechen</span>
            </button>
          </div>
        </div>
      )}

      {/* Active SOS Alert Banner across top of map */}
      {activeSosAlert && (
        <div className="absolute top-3 left-3 right-3 z-[650] p-3 rounded-2xl bg-red-600 border-2 border-white text-white shadow-2xl animate-pulse flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl">🚨</span>
            <div className="min-w-0">
              <span className="font-black text-xs uppercase font-mono block truncate">
                NOTFALL-ALARM: {activeSosAlert.userName} ({activeSosAlert.userCallSign})
              </span>
              <span className="text-[10px] text-red-100 font-mono block">
                Position auf Karte fixiert • {activeSosAlert.timestamp} Uhr
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissSosAlert}
            className="px-3 py-1.5 rounded-xl bg-white text-slate-950 font-black font-mono text-[10px] uppercase transition cursor-pointer shadow shrink-0"
          >
            Entwarnung / Schließen
          </button>
        </div>
      )}

      {/* Top Banner: Joint Exercise Challenge Scores */}
      {currentYouthOperation?.type === 'joint' && !drawingSectorData && !activeSosAlert && (
        <div className="absolute top-4 left-4 right-4 z-[500] p-2.5 rounded-2xl bg-[#000E66]/90 border border-purple-500/60 shadow-xl backdrop-blur-md flex items-center justify-between text-xs text-white">
          <div className="flex items-center gap-2">
            <span className="text-sm">🏆</span>
            <span className="font-black uppercase tracking-wider text-purple-300">Challenge-Stand:</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-cyan-300 font-bold flex items-center gap-1">
              <span>🎒 Jugend:</span>
              <span className="text-white bg-blue-900 px-2 py-0.5 rounded-lg border border-blue-700">{jugendFindings}</span>
            </span>
            <span className="text-emerald-300 font-bold flex items-center gap-1">
              <span>🦺 Erwachsene:</span>
              <span className="text-white bg-emerald-950 px-2 py-0.5 rounded-lg border border-emerald-700">{erwachseneFindings}</span>
            </span>
          </div>
        </div>
      )}

      {/* Geofence Out-Of-Bounds Warning Banner - NUR wenn Übung aktiv ist */}
      {isExerciseActive && isOutOfGeofence && !activeSosAlert && !drawingSectorData && (
        <div className="absolute top-16 left-4 right-4 z-[500] p-3 rounded-2xl bg-amber-500 border-2 border-white text-slate-950 font-bold text-xs shadow-2xl flex items-center justify-between gap-2 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span>Sicherheitsgrenze überschritten: Du entfernst dich zu weit von der 📡 EZ! Bitte halte an oder melde dich per Funk.</span>
          </div>
        </div>
      )}

      {/* Floating Controls Right */}
      <div className="absolute top-16 right-4 z-[500] flex flex-col gap-2">
        {/* Ebenen- / Kartenstil & Wetter-Schalter */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLayerMenu((v) => !v)}
            className="p-3 rounded-2xl bg-[#000E66]/90 border border-cyan-400 text-cyan-300 hover:text-white shadow-xl transition cursor-pointer flex flex-col items-center justify-center backdrop-blur-md"
            title="Kartenansicht, Luftbild & Wetter"
          >
            <Layers className="w-5 h-5" />
            <span className="text-[8px] font-mono font-bold mt-0.5">EBENEN</span>
          </button>

          {/* Layer Menu Dropdown */}
          {showLayerMenu && (
            <div className="absolute right-0 top-14 w-60 p-3 bg-[#000B52]/95 border-2 border-cyan-400/80 rounded-2xl shadow-2xl backdrop-blur-md z-[600] space-y-3 font-sans animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-blue-800 pb-2">
                <span className="text-xs font-bold font-mono text-cyan-300 uppercase">Kartenansicht</span>
                <button
                  type="button"
                  onClick={() => setShowLayerMenu(false)}
                  className="p-1 rounded-lg hover:bg-blue-900 text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tag / Nacht Umschaltung & Wetter */}
              <div className="grid grid-cols-2 gap-1.5 font-mono">
                <button
                  type="button"
                  onClick={() => setIsMapLight(!isMapLight)}
                  className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 text-amber-300 border border-blue-800 text-[10px] font-bold transition cursor-pointer"
                  title="Tag-/Nachtkarte umschalten"
                >
                  {isMapLight ? <Moon className="w-3.5 h-3.5 text-amber-400" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{isMapLight ? 'Nachtkarte' : 'Tagkarte'}</span>
                </button>

                {/* Wetter Widget Umschalter */}
                <button
                  type="button"
                  onClick={() => {
                    setShowWeatherOverlay(!showWeatherOverlay);
                    setShowLayerMenu(false);
                  }}
                  className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                    showWeatherOverlay
                      ? 'bg-amber-600 text-white border-amber-400'
                      : 'bg-blue-950/80 hover:bg-blue-900 text-amber-300 border-blue-800'
                  }`}
                  title="Wetter & Wind einblenden"
                >
                  <CloudSun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Wetter</span>
                </button>
              </div>

              {/* Luftraum / Drohnen-Zonen Schalter (Lernziel: Vor dem Start prüfen!) */}
              <div className="pt-1 border-t border-blue-800">
                <button
                  type="button"
                  onClick={() => setShowAero(!showAero)}
                  className={`w-full py-1.5 px-2.5 rounded-xl border text-[10px] font-mono font-bold transition cursor-pointer flex items-center justify-between ${
                    showAero
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                      : 'bg-blue-950/80 hover:bg-blue-900 text-indigo-300 border-blue-800'
                  }`}
                  title="Offizielle Drohnen-Flugzonen (dipul / DFS) einblenden"
                >
                  <span className="flex items-center gap-1.5">
                    <span>🛸</span>
                    <span>Luftraum &amp; Drohnenzonen</span>
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/30">
                    {showAero ? 'AN' : 'AUS'}
                  </span>
                </button>
              </div>

              {/* Kartenstil / Luftbild / Topo */}
              <div className="space-y-1 pt-1 border-t border-blue-800">
                <span className="text-[10px] text-cyan-200 uppercase font-mono block">Kartenstil / Luft:</span>
                <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
                  {[
                    { id: 'osm', label: 'Standard (OSM)' },
                    { id: 'topo', label: 'Topografie' },
                    { id: 'satellite', label: 'Luftbild Foto' },
                    { id: 'hybrid', label: 'Satellit Hybrid' },
                  ].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => {
                        setActiveBaseMap(style.id as any);
                        setShowLayerMenu(false);
                      }}
                      className={`p-1.5 rounded-lg text-left transition cursor-pointer font-bold ${
                        activeBaseMap === style.id
                          ? 'bg-cyan-500 text-slate-950 shadow'
                          : 'bg-blue-950/60 hover:bg-blue-900 text-slate-200 border border-blue-800/60'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Zentrieren auf 📡 EZ */}
        <button
          type="button"
          onClick={handleCenterOnEz}
          className="p-3 rounded-2xl bg-[#000E66]/90 border border-cyan-400 text-cyan-300 hover:text-white shadow-xl transition cursor-pointer flex flex-col items-center justify-center backdrop-blur-md"
          title="Zur Einsatzzentrale (📡 EZ) springen"
        >
          <span className="text-base">📡</span>
          <span className="text-[8px] font-mono font-bold mt-0.5">EZ</span>
        </button>

        {/* Zentrieren auf Mein Standort */}
        <button
          type="button"
          onClick={handleCenterOnMe}
          className="p-3 rounded-2xl bg-[#000E66]/90 border border-cyan-400 text-cyan-300 hover:text-white shadow-xl transition cursor-pointer flex flex-col items-center justify-center backdrop-blur-md"
          title="Mein Standort"
        >
          <Navigation className="w-5 h-5" />
          <span className="text-[8px] font-mono font-bold mt-0.5">ICH</span>
        </button>

        {/* SOS Pfeife Button */}
        <button
          type="button"
          onClick={() => setShowSosConfirm(true)}
          className="p-3 rounded-2xl bg-red-600 hover:bg-red-500 border-2 border-white text-white shadow-xl transition cursor-pointer flex flex-col items-center justify-center animate-pulse"
          title="Notfall-Pfeife / SOS Hilfe rufen"
        >
          <span className="text-lg">🚨</span>
          <span className="text-[9px] font-black font-mono mt-0.5">SOS</span>
        </button>
      </div>

      {/* SOS Confirm Dialog */}
      {showSosConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#000B52] border-2 border-red-500 rounded-3xl max-w-sm w-full p-6 text-white space-y-4 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-red-600/30 border-2 border-red-500 mx-auto flex items-center justify-center text-3xl">
              🚨
            </div>
            <h3 className="text-lg font-black text-red-300 font-mono uppercase">
              Notfall-Pfeife aktivieren?
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Dies erzeugt einen lauten Pfeifton und alarmiert sofort die Jugendleitung und alle Begleiter mit deinem genauen GPS-Standort.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSosConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-mono text-xs font-bold cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerSosAlert();
                  setShowSosConfirm(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold cursor-pointer shadow-lg uppercase"
              >
                Hilfe rufen!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Weather Overlay (wie in der Hauptapp) */}
      {showWeatherOverlay && (
        <div className="fixed inset-0 z-[1100] bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-in fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-3xl shadow-2xl border-2 border-amber-400/80 bg-[#000E66]">
            <TacticalWeatherOverlay
              lat={currentYouthOperation?.headquartersLocation?.lat || 51.798}
              lng={currentYouthOperation?.headquartersLocation?.lng || 11.74}
              locationTitle={currentYouthOperation?.locationName || 'Übungsgelände'}
              onClose={() => setShowWeatherOverlay(false)}
            />
          </div>
        </div>
      )}

      {/* Big Action: Fund melden (Kids & Searchers) */}
      {!drawingSectorData && (
        <div className="absolute bottom-5 left-4 right-4 z-[500] flex items-center justify-center pointer-events-none">
          <button
            type="button"
            onClick={onOpenFindingModal}
            className="pointer-events-auto px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black font-mono text-sm uppercase tracking-wider transition cursor-pointer shadow-2xl border-2 border-rose-300 flex items-center gap-2 transform active:scale-95 animate-in slide-in-from-bottom-3"
          >
            <span className="text-xl">🎉</span>
            <span>Fundstück melden 🎒</span>
          </button>
        </div>
      )}

      {/* DRÖHNCHEN & LUFTRAUM-SCHULUNGS-LEGENDE (Aero-Layer aktiv) */}
      {showAero && (
        <div className="absolute bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:bottom-6 sm:w-80 z-[600] select-none font-sans">
          {!aeroLegendOpen ? (
            <div className="flex items-center justify-between bg-slate-900/95 backdrop-blur-md border border-indigo-400 rounded-2xl p-2.5 shadow-2xl">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg shrink-0">🛸</span>
                <div className="min-w-0">
                  <span className="font-bold text-xs text-indigo-300 block truncate font-mono">
                    Drohnen-Luftraumprüfung (dipul)
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate">
                    Vor dem Start: Rote Zonen prüfen!
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAeroLegendOpen(true)}
                className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[10px] font-bold uppercase transition cursor-pointer shrink-0 shadow"
              >
                Erklärung 🔼
              </button>
            </div>
          ) : (
            <div className="w-full bg-[#000E66]/95 border-2 border-indigo-400 rounded-3xl p-4 shadow-2xl backdrop-blur-md text-xs text-slate-200 space-y-3 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-indigo-900 pb-2">
                <div className="flex items-center gap-1.5 font-bold font-mono text-indigo-300 text-xs uppercase">
                  <span>🛸</span>
                  <span>Dröhnchen-Checkliste &amp; LuftVO</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAeroLegendOpen(false)}
                  className="p-1 rounded-lg hover:bg-blue-900 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-[11px] leading-relaxed">
                <div className="p-2 rounded-xl bg-red-950/70 border border-red-500/60 flex items-start gap-2">
                  <span className="text-base shrink-0">🚫</span>
                  <div>
                    <b className="text-red-300 block font-mono">Rote Zonen = Flugverbot!</b>
                    <span className="text-slate-300">
                      Hier darf privat oder ohne Sondergenehmigung niemals gestartet werden (z. B. Naturschutzgebiet, Autobahn, Bahnstrecke, Flugplatz).
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-emerald-950/70 border border-emerald-500/60 flex items-start gap-2">
                  <span className="text-base shrink-0">🦺</span>
                  <div>
                    <b className="text-emerald-300 block font-mono">Was lernen wir für später?</b>
                    <span className="text-slate-300">
                      Erwachsene Rettungskräfte (BOS) dürfen im echten Einsatz mit Genehmigung und Einweisung (§ 21k LuftVO) fliegen – bei der Übung gilt aber: Erst Luftkarte prüfen, dann starten!
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-indigo-900 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Quelle: DFS / dipul</span>
                <button
                  type="button"
                  onClick={() => setAeroLegendOpen(false)}
                  className="text-cyan-300 hover:underline cursor-pointer font-bold"
                >
                  Verstanden 🔽
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
