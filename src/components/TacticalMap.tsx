import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import { captureTacticalMapScreenshot } from '../lib/mapSnapshotHelper';
import { useRescue } from '../context/RescueContext';
import {
  SearchSector,
  Finding,
  User,
  EquipmentType,
  SectorStatus,
  UserLocationState,
  SearchOperation,
  getUserTrackColor,
  TACTICAL_TRACK_COLORS,
  getUserConnectionStatus,
  getSignalFreshnessText,
} from '../types';
import { VEREINSBUERO_LOCATION } from '../mockData';
import { TacticalWeatherOverlay } from './TacticalWeatherOverlay';
import {
  Layers,
  MapPin,
  Compass,
  Maximize2,
  Navigation,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Plus,
  Shield,
  Phone,
  MessageSquare,
  Sparkles,
  PenTool,
  Edit3,
  RotateCcw,
  Trash2,
  Check,
  MousePointer,
  Camera,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  X,
  CloudSun,
  FileText,
  GripVertical,
  Move,
} from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';

interface TacticalMapProps {
  operation?: SearchOperation | null;
  mode?: 'live' | 'archive' | 'report';
  readOnly?: boolean;
  onOpenFindingDetails?: (finding: Finding) => void;
  onOpenFindingDetail?: (finding: Finding) => void;
  onOpenSectorEditor?: (sector?: SearchSector) => void;
  onStartFreehandDrawing?: () => void;
  onOpenDirectChat?: (user: User) => void;
  isDrawingSector?: boolean;
  onFinishDrawing?: (coords: [number, number][]) => void;
  onCancelDrawing?: () => void;
  onSaveSnapshot?: (dataUrl: string) => void;
  onSelectArchiveOp?: (opId: string) => void;
  /** Controls map tile brightness: true = light tiles, false = dark-filtered tiles */
  isMapLight?: boolean;
}

// Calculate geodesic area in hectares for a polygon
function calculatePolygonHectares(coords: [number, number][]): number {
  if (coords.length < 3) return 0;
  const R = 6378137; // meters
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const lat1 = (coords[i][0] * Math.PI) / 180;
    const lat2 = (coords[j][0] * Math.PI) / 180;
    const lon1 = (coords[i][1] * Math.PI) / 180;
    const lon2 = (coords[j][1] * Math.PI) / 180;
    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  area = (Math.abs(area) * R * R) / 2.0;
  return Number((area / 10000).toFixed(1)); // m^2 to hectares
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

interface TileLayerConfig {
  name: string;
  url: string;
  overlayUrl?: string;
  attribution: string;
  subdomains?: string[] | string;
  maxZoom?: number;
}

// Tile layers configurations (All 100% free, reliable, no API key required)
const TILE_LAYERS: Record<'osm' | 'hybrid' | 'satellite' | 'topo', TileLayerConfig> = {
  osm: {
    name: 'Standard Straße & Wald (OSM)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19,
  },
  topo: {
    name: 'Topografie & Höhenlinien',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Kartendaten: &copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | Kartendarstellung: &copy; <a href="http://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 17,
  },
  satellite: {
    name: 'Satellit (Luftbild)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  hybrid: {
    name: 'Satellit + Straßennamen',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    overlayUrl: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
    attribution: '&copy; Esri, Maxar, &copy; OpenStreetMap',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 19,
  },
};

// Helper for responder icon based on equipment
function getEquipmentBadge(equipment: EquipmentType[] = []): { icon: string; label: string; color: string } {
  if (equipment.includes('drone')) return { icon: '🚁', label: 'Drohne / UAS', color: '#06b6d4' };
  if (equipment.includes('k9_cadaver')) return { icon: '🐕‍🦺', label: 'Leichenspürhund K9', color: '#6366f1' };
  if (equipment.includes('k9_mantrailer')) return { icon: '🐕', label: 'Mantrailer K9', color: '#f97316' };
  if (equipment.includes('k9_area')) return { icon: '🐾', label: 'Flächensuchhund', color: '#eab308' };
  if (equipment.includes('quad')) return { icon: '🚜', label: 'Quad / ATV', color: '#a855f7' };
  if (equipment.includes('boat')) return { icon: '🚤', label: 'Boot / Wasser', color: '#3b82f6' };
  if (equipment.includes('foot_search')) return { icon: '🚶', label: 'Fußtrupp', color: '#10b981' };
  return { icon: '👤', label: 'Einsatzkraft', color: '#64748b' };
}

// User track color mapping - expanded to 16 high-contrast tactical colors
const USER_COLORS = TACTICAL_TRACK_COLORS;

export const TacticalMap: React.FC<TacticalMapProps> = ({
  operation: propOperation,
  mode = 'live',
  readOnly = false,
  onOpenFindingDetails,
  onOpenFindingDetail,
  onOpenSectorEditor,
  onStartFreehandDrawing,
  onOpenDirectChat,
  isDrawingSector = false,
  onFinishDrawing,
  onCancelDrawing,
  onSaveSnapshot,
  onSelectArchiveOp,
  isMapLight = true,
}) => {
  const {
    currentOperation: globalOperation,
    allUsers,
    userLocations,
    currentUser,
    myLocation,
    setSectorStatus,
    deleteSector,
    updateSearchArea,
    clearGpsTracks,
    saveMapSnapshot,
    selectedUser,
    setSelectedUser,
    activeTrackingTest,
  } = useRescue();

  const currentOperation = propOperation !== undefined ? propOperation : globalOperation;
  const isArchiveMode = mode === 'archive' || currentOperation?.status === 'completed';

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const activeTileLayerRef = useRef<L.Layer | null>(null);

  // Layer groups for smooth updating
  const sectorsLayerRef = useRef<L.FeatureGroup | null>(null);
  const respondersLayerRef = useRef<L.FeatureGroup | null>(null);
  const tracksLayerRef = useRef<L.FeatureGroup | null>(null);
  const findingsLayerRef = useRef<L.FeatureGroup | null>(null);
  const plsLayerRef = useRef<L.FeatureGroup | null>(null);
  const drawLayerRef = useRef<L.FeatureGroup | null>(null);
  const ezLayerRef = useRef<L.FeatureGroup | null>(null);

  // Map state - Default to OpenStreetMap for maximum clarity of street names & paths
  const [activeBaseMap, setActiveBaseMap] = useState<'osm' | 'hybrid' | 'satellite' | 'topo'>('osm');
  const [showTracks, setShowTracks] = useState(true);
  const [showSectors, setShowSectors] = useState(true);
  const [showResponders, setShowResponders] = useState(!isArchiveMode);
  const [showInactiveResponders, setShowInactiveResponders] = useState(false);
  const [showFindings, setShowFindings] = useState(true);
  const [showFalseAlarms, setShowFalseAlarms] = useState(false);
  const [showRadiusRings, setShowRadiusRings] = useState(!isArchiveMode);
  const [showWeatherOverlay, setShowWeatherOverlay] = useState(true);
  const [isWeatherModalOpenMobile, setIsWeatherModalOpenMobile] = useState(false);
  const [isLayersOpenMobile, setIsLayersOpenMobile] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [desktopSidebarTab, setDesktopSidebarTab] = useState<'layers' | 'tracks' | 'actions'>('layers');

  // Draggable Hooks for Floating Map Panels & Cards
  const {
    dragRef: sidebarDragRef,
    position: sidebarPos,
    isDragging: isSidebarDragging,
    dragProps: sidebarDragProps,
  } = useDraggable({ storageKey: 'tactical_map_sidebar' });

  const {
    dragRef: sectorCardDragRef,
    position: sectorCardPos,
    dragProps: sectorCardDragProps,
  } = useDraggable({ storageKey: 'sector_detail_card' });

  const {
    dragRef: userCardDragRef,
    position: userCardPos,
    dragProps: userCardDragProps,
  } = useDraggable({ storageKey: 'user_detail_card' });

  const {
    dragRef: weatherDragRef,
    position: weatherPos,
    dragProps: weatherDragProps,
  } = useDraggable({ storageKey: 'weather_widget' });
  const [drawnPoints, setDrawnPoints] = useState<[number, number][]>([]);
  const [drawMode, setDrawMode] = useState<'pen' | 'click'>('pen');
  const [strokeHistory, setStrokeHistory] = useState<[number, number][][]>([]);
  const [selectedSector, setSelectedSector] = useState<SearchSector | null>(null);
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);
  const [snapshotSavedNotice, setSnapshotSavedNotice] = useState(false);
  const isAdminOrEL = currentUser?.role === 'admin' || currentUser?.role === 'einsatzleitung';

  // EZ Navigation Modal state for interactive coordination transfer to GPS/Navi apps
  const [ezNavData, setEzNavData] = useState<{
    lat: number;
    lng: number;
    address: string;
    title: string;
    isStandbyOffice: boolean;
    operationTitle?: string;
    commander?: string;
  } | null>(null);
  const [copiedCoords, setCopiedCoords] = useState(false);

  // Target coordinates for weather monitoring (Prioritizes PLS / Last Seen -> EZ -> first Sector -> Vereinsbüro)
  const weatherTarget = useMemo(() => {
    if (currentOperation?.missingPerson?.lastSeenLocation?.lat && currentOperation?.missingPerson?.lastSeenLocation?.lng) {
      return {
        lat: currentOperation.missingPerson.lastSeenLocation.lat,
        lng: currentOperation.missingPerson.lastSeenLocation.lng,
        title: currentOperation.missingPerson.lastSeenLocation.address || `Einsatzort (${currentOperation.title})`,
      };
    }
    if (currentOperation?.headquartersLocation?.lat && currentOperation?.headquartersLocation?.lng) {
      return {
        lat: currentOperation.headquartersLocation.lat,
        lng: currentOperation.headquartersLocation.lng,
        title: currentOperation.headquartersLocation.address || 'Einsatzzentrale',
      };
    }
    if (currentOperation?.sectors && currentOperation.sectors.length > 0 && currentOperation.sectors[0].polygon.length > 0) {
      const firstCoord = currentOperation.sectors[0].polygon[0];
      return {
        lat: firstCoord[0],
        lng: firstCoord[1],
        title: currentOperation.sectors[0].name || 'Suchsektor',
      };
    }
    return {
      lat: VEREINSBUERO_LOCATION.lat,
      lng: VEREINSBUERO_LOCATION.lng,
      title: 'Vereinsbüro Aschersleben',
    };
  }, [currentOperation]);

  interface TrackSummaryItem {
    userId: string;
    name: string;
    callSign: string;
    color: string;
    pointCount: number;
    distanceMeters: number;
    isLive: boolean;
    isDrone: boolean;
    equipmentIcon: string;
    boundsPoints: [number, number][];
  }

  // Aggregated summary of all search tracks on map (Live and Archived)
  const trackSummaries = useMemo<TrackSummaryItem[]>(() => {
    const list: TrackSummaryItem[] = [];
    const seenUserIds = new Set<string>();

    // 1. Live tracks from userLocations
    Object.entries(userLocations).forEach(([userId, locState]) => {
      const history = locState.trackHistory || [];
      if (history.length < 2) return;
      seenUserIds.add(userId);

      const user = allUsers.find((u) => u.id === userId);
      const color = getUserTrackColor(user || userId, allUsers);
      const isDrone = Boolean(user?.equipment?.includes('drone'));

      let totalDist = 0;
      for (let i = 1; i < history.length; i++) {
        const d = calculateDistanceMeters(history[i - 1].lat, history[i - 1].lng, history[i].lat, history[i].lng);
        if (d <= 1200) totalDist += d;
      }

      list.push({
        userId,
        name: user?.name || 'Suchkraft',
        callSign: user?.callSign || 'Unit',
        color,
        pointCount: history.length,
        distanceMeters: totalDist,
        isLive: locState.isLive,
        isDrone,
        equipmentIcon: isDrone ? '🚁' : user?.equipment?.includes('k9_mantrailer') ? '🐕' : '🚶',
        boundsPoints: history.map((p) => [p.lat, p.lng]),
      });
    });

    // 2. Archived tracks from currentOperation
    if (currentOperation?.archivedTracks) {
      currentOperation.archivedTracks.forEach((t) => {
        if (!t.points || t.points.length < 2) return;
        if (seenUserIds.has(t.userId)) return;
        seenUserIds.add(t.userId);

        const user = allUsers.find((u) => u.id === t.userId);
        const color = t.color || getUserTrackColor(user || t.userId, allUsers);
        const isDrone = Boolean(user?.equipment?.includes('drone'));

        let totalDist = 0;
        for (let i = 1; i < t.points.length; i++) {
          const d = calculateDistanceMeters(t.points[i - 1].lat, t.points[i - 1].lng, t.points[i].lat, t.points[i].lng);
          if (d <= 1200) totalDist += d;
        }

        list.push({
          userId: t.userId,
          name: t.userName || user?.name || 'Suchkraft',
          callSign: t.callSign || user?.callSign || 'Unit',
          color,
          pointCount: t.points.length,
          distanceMeters: totalDist,
          isLive: false,
          isDrone,
          equipmentIcon: isDrone ? '🚁' : '🚶',
          boundsPoints: t.points.map((p) => [p.lat, p.lng]),
        });
      });
    }

    return list;
  }, [userLocations, allUsers, currentOperation]);

  const zoomToTrack = useCallback((points: [number, number][]) => {
    if (!mapInstanceRef.current || points.length < 2) return;
    const bounds = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]));
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  }, []);


  // Universal navigation launcher (Google Maps, Apple Maps, Android Geo Intent)
  const handleOpenNavigation = useCallback((lat: number, lng: number, label: string) => {
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(navigator.userAgent);

    if (isAndroid) {
      // Universal Android geo intent - triggers whichever navi app user has installed
      window.location.href = `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})`;
    } else if (isIOS) {
      window.location.href = `maps://?daddr=${lat},${lng}&q=${encodeURIComponent(label)}`;
    } else {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        '_blank',
        'noopener,noreferrer'
      );
    }
  }, []);

  const handleCopyCoordinates = useCallback((lat: number, lng: number) => {
    const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedCoords(true);
        setTimeout(() => setCopiedCoords(false), 2500);
      });
    }
  }, []);

  const captureMapSnapshot = async () => {
    if (!currentOperation) return;
    setIsCapturingSnapshot(true);
    try {
      const dataUrl = await captureTacticalMapScreenshot(currentOperation, userLocations);
      if (dataUrl) {
        if (onSaveSnapshot) {
          onSaveSnapshot(dataUrl);
        } else {
          saveMapSnapshot(currentOperation.id, dataUrl, 'Lagebild');
        }
        setSnapshotSavedNotice(true);
        setTimeout(() => setSnapshotSavedNotice(false), 3500);
      }
    } catch (err) {
      console.error('Lagekarten-Snapshot fehlgeschlagen:', err);
    } finally {
      setIsCapturingSnapshot(false);
    }
  };

  // Automatische Erfassung des Einsatzstart-Screenshots (gesamter Suchbereich / ausgewählter Bereich)
  const hasAttemptedStartSnapshotRef = useRef(false);
  useEffect(() => {
    if (!currentOperation || currentOperation.status !== 'active') return;
    if (!currentOperation.searchAreaPolygon || currentOperation.searchAreaPolygon.length < 3) return;

    const existingSnaps = currentOperation.mapSnapshots || [];
    const hasStartSnap = existingSnaps.some((s) => s.label === 'Einsatzstart');
    if (hasStartSnap || hasAttemptedStartSnapshotRef.current) return;

    hasAttemptedStartSnapshotRef.current = true;

    const timer = setTimeout(async () => {
      try {
        console.log('Automatischer Snapshot der Lagekarte bei Einsatzstart wird erfasst...');
        const dataUrl = await captureTacticalMapScreenshot(currentOperation, userLocations);
        if (dataUrl) {
          saveMapSnapshot(currentOperation.id, dataUrl, 'Einsatzstart');
        }
      } catch (err) {
        console.error('Automatischer Einsatzstart-Snapshot fehlgeschlagen:', err);
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [currentOperation?.id, currentOperation?.searchAreaPolygon, currentOperation?.mapSnapshots, userLocations]);

  // Grouped / co-located responders for rapid switching when inspecting a responder
  const nearbyResponders = useMemo(() => {
    if (!selectedUser) return [];
    const myPos = userLocations[selectedUser.id]?.currentPosition;
    if (!myPos) return [];
    return allUsers.filter((u) => {
      if (u.id === selectedUser.id) return false;
      const uLoc = userLocations[u.id];
      if (!uLoc) return false;
      // Show online or inactive if showInactiveResponders is set
      const isOnline = u.isActive && (uLoc.isLive || u.id === currentUser?.id);
      if (!isOnline && !showInactiveResponders) return false;

      const dLat = uLoc.currentPosition.lat - myPos.lat;
      const dLng = uLoc.currentPosition.lng - myPos.lng;
      // ~0.0003 deg is approx 30m radius
      return (dLat * dLat + dLng * dLng) < 0.00035 * 0.00035;
    });
  }, [selectedUser, userLocations, allUsers, currentUser, showInactiveResponders]);

  const isPenDrawingRef = useRef(false);
  const currentStrokeRef = useRef<[number, number][]>([]);

  // Function to create tile layer or hybrid layer group
  const createTileLayer = (key: 'osm' | 'hybrid' | 'satellite' | 'topo'): L.Layer => {
    const config = TILE_LAYERS[key] || TILE_LAYERS.osm;
    const maxNative = config.maxZoom || 19;
    if (key === 'hybrid' && 'overlayUrl' in config && config.overlayUrl) {
      const baseSat = L.tileLayer(config.url, {
        attribution: config.attribution,
        maxZoom: 22,
        maxNativeZoom: maxNative,
        crossOrigin: true,
      });
      const labelsOverlay = L.tileLayer(config.overlayUrl, {
        subdomains: config.subdomains || ['a', 'b', 'c', 'd'],
        maxZoom: 22,
        maxNativeZoom: maxNative,
        pane: 'overlayPane',
        opacity: 1,
        crossOrigin: true,
      });
      return L.layerGroup([baseSat, labelsOverlay]);
    }
    return L.tileLayer(config.url, {
      attribution: config.attribution,
      subdomains: config.subdomains || ['a', 'b', 'c'],
      maxZoom: 22,
      maxNativeZoom: maxNative,
      crossOrigin: true,
    });
  };

  // Initial map setup
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    let defaultLat = VEREINSBUERO_LOCATION.lat;
    let defaultLng = VEREINSBUERO_LOCATION.lng;

    if (currentOperation?.missingPerson?.lastSeenLocation?.lat) {
      defaultLat = currentOperation.missingPerson.lastSeenLocation.lat;
      defaultLng = currentOperation.missingPerson.lastSeenLocation.lng;
    } else if (currentOperation?.headquartersLocation?.lat) {
      defaultLat = currentOperation.headquartersLocation.lat;
      defaultLng = currentOperation.headquartersLocation.lng;
    }

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 13,
      maxZoom: 22,
      zoomControl: false,
      preferCanvas: true, // HTML5 Canvas vector renderer: tracks scale smoothly and instantly during zoom!
    });

    // Custom zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial base tile layer
    const initialLayer = createTileLayer(activeBaseMap).addTo(map);
    activeTileLayerRef.current = initialLayer;

    // Initialize layer groups
    sectorsLayerRef.current = L.featureGroup().addTo(map);
    tracksLayerRef.current = L.featureGroup().addTo(map);
    respondersLayerRef.current = L.featureGroup().addTo(map);
    findingsLayerRef.current = L.featureGroup().addTo(map);
    plsLayerRef.current = L.featureGroup().addTo(map);
    drawLayerRef.current = L.featureGroup().addTo(map);
    ezLayerRef.current = L.featureGroup().addTo(map);

    mapInstanceRef.current = map;

    // ResizeObserver ensures Leaflet updates viewport if container dimensions or tab layout shifts
    let resizeObserver: ResizeObserver | null = null;
    if (mapContainerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    // In standby / readiness mode, map remains centered on Vereinsbüro Aschersleben (Hohe Straße 15).
    // Automatic browser geolocation flyTo is disabled so the map never jumps away unexpectedly.

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Auto-center map on user location when Tracking Test is active or updates
  useEffect(() => {
    if (!mapInstanceRef.current || !activeTrackingTest || !activeTrackingTest.isActive) return;
    const pts = activeTrackingTest.trackPoints;
    if (pts.length > 0) {
      const latest = pts[pts.length - 1];
      const currentZoom = mapInstanceRef.current.getZoom();
      mapInstanceRef.current.setView([latest.lat, latest.lng], Math.max(16, currentZoom));
    } else if (myLocation) {
      mapInstanceRef.current.setView([myLocation.lat, myLocation.lng], 16);
    }
  }, [activeTrackingTest?.isActive, activeTrackingTest?.trackPoints.length, myLocation]);

  // Fit bounds to operation area (sectors, findings, tracks, PLS) especially in archive or when operation changes
  useEffect(() => {
    if (!mapInstanceRef.current || !currentOperation) return;

    const allPoints: [number, number][] = [];

    // Sectors
    currentOperation.sectors?.forEach((sec) => {
      sec.polygon?.forEach((pt) => allPoints.push(pt));
    });
    // Findings
    currentOperation.findings?.forEach((f) => {
      if (f.location?.lat) allPoints.push([f.location.lat, f.location.lng]);
    });
    // PLS & Home
    if (currentOperation.missingPerson?.lastSeenLocation?.lat) {
      allPoints.push([
        currentOperation.missingPerson.lastSeenLocation.lat,
        currentOperation.missingPerson.lastSeenLocation.lng,
      ]);
    }
    if (currentOperation.missingPerson?.homeAddress?.lat) {
      allPoints.push([
        currentOperation.missingPerson.homeAddress.lat,
        currentOperation.missingPerson.homeAddress.lng,
      ]);
    }
    // HQ
    if (currentOperation.headquartersLocation?.lat) {
      allPoints.push([
        currentOperation.headquartersLocation.lat,
        currentOperation.headquartersLocation.lng,
      ]);
    }
    // Archived tracks
    currentOperation.archivedTracks?.forEach((track) => {
      track.points?.forEach((p) => allPoints.push([p.lat, p.lng]));
    });

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else {
      mapInstanceRef.current.setView([VEREINSBUERO_LOCATION.lat, VEREINSBUERO_LOCATION.lng], 13);
    }
  }, [currentOperation?.id, isArchiveMode]);

  // Update base tile layer on switcher change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (activeTileLayerRef.current) {
      mapInstanceRef.current.removeLayer(activeTileLayerRef.current);
    }
    const newLayer = createTileLayer(activeBaseMap).addTo(mapInstanceRef.current);
    activeTileLayerRef.current = newLayer;
  }, [activeBaseMap]);

  // Apply light/dark filter to map tiles only (.leaflet-tile-pane).
  // Markers, sectors, and overlays are in separate panes and are unaffected.
  useEffect(() => {
    const applyFilter = () => {
      const tilePane = mapContainerRef.current?.querySelector('.leaflet-tile-pane') as HTMLElement | null;
      if (tilePane) {
        tilePane.style.filter = isMapLight
          ? 'none'
          : 'invert(1) hue-rotate(180deg) brightness(0.82) saturate(0.9)';
      }
    };
    // Apply immediately and also after a short delay (tiles may not be in DOM yet on first render)
    applyFilter();
    const t = setTimeout(applyFilter, 300);
    return () => clearTimeout(t);
  }, [isMapLight]);

  // Handle Sector Drawing (Freehand Pen and Click Vertex Modes)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isDrawingSector) return;

    if (drawMode === 'click') {
      // Click Mode: Add single vertex on click
      map.dragging.enable();
      map.touchZoom.enable();

      const handleClick = (e: L.LeafletMouseEvent) => {
        const newPt: [number, number] = [e.latlng.lat, e.latlng.lng];
        setDrawnPoints((prev) => {
          const next = [...prev, newPt];
          setStrokeHistory((h) => [...h, next]);
          return next;
        });
      };

      map.on('click', handleClick);
      return () => {
        map.off('click', handleClick);
      };
    } else {
      // Pen / Freehand Mode: Drag continuous stroke
      // Disable map dragging so touch/pen draws on canvas
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();

      const container = map.getContainer();

      const startStroke = (latlng: L.LatLng) => {
        isPenDrawingRef.current = true;
        const pt: [number, number] = [latlng.lat, latlng.lng];
        currentStrokeRef.current = [pt];
        setDrawnPoints([pt]);
      };

      const moveStroke = (latlng: L.LatLng) => {
        if (!isPenDrawingRef.current) return;
        const last = currentStrokeRef.current[currentStrokeRef.current.length - 1];
        if (!last) return;

        // Add point if moved at least ~4-5 meters (approx 0.00004 deg)
        const dLat = Math.abs(latlng.lat - last[0]);
        const dLng = Math.abs(latlng.lng - last[1]);
        if (dLat > 0.000035 || dLng > 0.000035) {
          const newPt: [number, number] = [latlng.lat, latlng.lng];
          currentStrokeRef.current.push(newPt);
          setDrawnPoints([...currentStrokeRef.current]);
        }
      };

      const endStroke = () => {
        if (!isPenDrawingRef.current) return;
        isPenDrawingRef.current = false;
        if (currentStrokeRef.current.length > 2) {
          const finished = [...currentStrokeRef.current];
          setStrokeHistory((h) => [...h, finished]);
        }
      };

      // Leaflet mouse event handlers
      const handleMouseDown = (e: L.LeafletMouseEvent) => {
        startStroke(e.latlng);
      };
      const handleMouseMove = (e: L.LeafletMouseEvent) => {
        moveStroke(e.latlng);
      };
      const handleMouseUp = () => {
        endStroke();
      };

      // Native Touch / Pointer event handlers for Apple Pencil / Stylus
      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          const touch = e.touches[0];
          const rect = container.getBoundingClientRect();
          const point = L.point(touch.clientX - rect.left, touch.clientY - rect.top);
          const latlng = map.containerPointToLatLng(point);
          startStroke(latlng);
          e.preventDefault();
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (isPenDrawingRef.current && e.touches.length === 1) {
          const touch = e.touches[0];
          const rect = container.getBoundingClientRect();
          const point = L.point(touch.clientX - rect.left, touch.clientY - rect.top);
          const latlng = map.containerPointToLatLng(point);
          moveStroke(latlng);
          e.preventDefault();
        }
      };

      const handleTouchEnd = (e: TouchEvent) => {
        if (isPenDrawingRef.current) {
          endStroke();
          e.preventDefault();
        }
      };

      map.on('mousedown', handleMouseDown);
      map.on('mousemove', handleMouseMove);
      map.on('mouseup', handleMouseUp);

      container.addEventListener('touchstart', handleTouchStart, { passive: false });
      container.addEventListener('touchmove', handleTouchMove, { passive: false });
      container.addEventListener('touchend', handleTouchEnd, { passive: false });

      return () => {
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.off('mousedown', handleMouseDown);
        map.off('mousemove', handleMouseMove);
        map.off('mouseup', handleMouseUp);
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDrawingSector, drawMode]);

  // Render temporary drawing polygon & vertex markers & area label
  useEffect(() => {
    if (!drawLayerRef.current) return;
    drawLayerRef.current.clearLayers();

    if (drawnPoints.length === 0) return;

    // Draw vertex points only in click mode or for start/end
    if (drawMode === 'click') {
      drawnPoints.forEach((pt, idx) => {
        const marker = L.circleMarker(pt, {
          radius: 5,
          color: '#3b82f6',
          fillColor: '#60a5fa',
          fillOpacity: 1,
          weight: 2,
        });
        marker.bindTooltip(`Punkt ${idx + 1}`, { permanent: false });
        drawLayerRef.current?.addLayer(marker);
      });
    } else {
      // Start marker for pen
      if (drawnPoints.length > 0) {
        const startMarker = L.circleMarker(drawnPoints[0], {
          radius: 6,
          color: '#3b82f6',
          fillColor: '#93c5fd',
          fillOpacity: 0.9,
          weight: 2,
        });
        drawLayerRef.current.addLayer(startMarker);
      }
    }

    if (drawnPoints.length > 1) {
      // Draw line or polygon preview
      const poly = L.polygon(drawnPoints, {
        color: '#3b82f6',
        dashArray: drawMode === 'click' ? '6, 6' : undefined,
        fillColor: '#3b82f6',
        fillOpacity: 0.25,
        weight: 3.5,
      });
      drawLayerRef.current.addLayer(poly);

      // Centroid area label
      if (drawnPoints.length >= 3) {
        const ha = calculatePolygonHectares(drawnPoints);
        const center = poly.getBounds().getCenter();
        const areaLabel = L.marker(center, {
          icon: L.divIcon({
            className: 'custom-area-label',
            html: `<div style="background:#0F172A;color:#60a5fa;border:1px solid #3b82f6;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:bold;font-family:monospace;white-space:nowrap;box-shadow:0 4px 10px rgba(0,0,0,0.5);">📐 ca. ${ha} ha</div>`,
            iconSize: [80, 24],
            iconAnchor: [40, 12],
          }),
        });
        drawLayerRef.current.addLayer(areaLabel);
      }
    }
  }, [drawnPoints, drawMode]);

  // Render Point Last Seen (PLS), Home Address, Range Rings & HQ
  useEffect(() => {
    if (!plsLayerRef.current || !currentOperation || activeTrackingTest?.isActive) return;
    plsLayerRef.current.clearLayers();

    const pls = currentOperation.missingPerson?.lastSeenLocation;
    const home = currentOperation.missingPerson?.homeAddress;

    // 1. PLS & Range Rings
    if (pls) {
      if (showRadiusRings) {
        // Range rings: 500m, 1000m, 2000m
        const rings = [
          { radius: 500, label: '500m Kernzone', color: '#ef4444', dash: '4, 4', opacity: 0.35 },
          { radius: 1000, label: '1.000m Nahbereich', color: '#f59e0b', dash: '6, 6', opacity: 0.25 },
          { radius: 2000, label: '2.000m Erweiterter Suchbereich', color: '#3b82f6', dash: '8, 8', opacity: 0.15 },
        ];

        rings.forEach((r) => {
          const circle = L.circle([pls.lat, pls.lng], {
            radius: r.radius,
            color: r.color,
            dashArray: r.dash,
            fillColor: r.color,
            fillOpacity: r.opacity,
            weight: 1.5,
          });
          circle.bindTooltip(r.label, { sticky: true, className: 'tactical-tooltip' });
          plsLayerRef.current?.addLayer(circle);
        });
      }

      // PLS Marker icon
      const plsIcon = L.divIcon({
        className: 'custom-pls-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute h-10 w-10 rounded-full bg-red-500/30 animate-ping"></span>
            <div class="relative flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-xl ring-2 ring-white font-bold text-xs">
              PLS
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const mp = currentOperation.missingPerson;
      const plsPhotoHtml = mp?.photoUrl && mp.photoUrl.trim() !== ''
        ? `<div style="width: 100%; height: 160px; max-height: 180px; border-radius: 10px; overflow: hidden; margin-bottom: 10px; background: #0f172a; border: 1px solid #cbd5e1; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
            <img src="${mp.photoUrl}" alt="${mp.name || 'Vermisste Person'}" style="width: 100%; height: 100%; object-fit: cover; display: block;" referrerpolicy="no-referrer" />
           </div>`
        : `<div style="width: 100%; height: 60px; border-radius: 8px; margin-bottom: 8px; background: #fee2e2; border: 1px dashed #f87171; display: flex; align-items: center; justify-content: center; color: #b91c1c; font-size: 11px; font-weight: 600;">
            Kein Foto hinterlegt
           </div>`;

      const plsMarker = L.marker([pls.lat, pls.lng], { icon: plsIcon });
      plsMarker.bindPopup(`
        <div style="min-width: 250px; max-width: 300px; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc; padding: 2px;">
          ${plsPhotoHtml}
          <div style="font-size: 10px; font-weight: 800; color: #f87171; display: flex; align-items: center; gap: 4px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
            <span>📍 LETZTER SICHTUNGSPUNKT (PLS)</span>
          </div>
          <div style="font-size: 15px; font-weight: 700; color: #ffffff; line-height: 1.2;">
            ${mp?.name || 'Unbekannt'}${mp?.age ? ` (${mp.age} Jahre)` : ''}
          </div>
          <div style="font-size: 12px; color: #cbd5e1; font-weight: 500; margin-top: 4px; line-height: 1.3;">
            ${pls.address}
          </div>
          ${pls.description ? `<div style="font-size: 11px; color: #94a3b8; font-style: italic; margin-top: 4px; background: #0f172a; padding: 4px 6px; border-radius: 4px; border: 1px solid #334155;">${pls.description}</div>` : ''}
          ${mp?.clothing ? `<div style="font-size: 11px; color: #cbd5e1; margin-top: 5px;"><strong>Bekleidung:</strong> ${mp.clothing}</div>` : ''}
          ${mp?.medicalConditions && mp.medicalConditions.length > 0 ? `<div style="font-size: 11px; color: #fca5a5; background: #450a0a; border: 1px solid #7f1d1d; padding: 3px 6px; border-radius: 4px; margin-top: 5px;"><strong>⚠️ Medizinisch:</strong> ${mp.medicalConditions.join(', ')}</div>` : ''}
          <div style="font-size: 11px; color: #94a3b8; margin-top: 6px; font-family: monospace;">
            Sichtung: <strong style="color: #ffffff;">${mp?.lastSeenTime || 'Unbekannt'}</strong>
          </div>
          <div style="font-size: 10px; color: #64748b; font-family: monospace; margin-top: 6px; border-top: 1px solid #334155; padding-top: 4px;">
            GPS: ${pls.lat.toFixed(5)}, ${pls.lng.toFixed(5)}
          </div>
        </div>
      `, { maxWidth: 320, minWidth: 260 });
      plsLayerRef.current.addLayer(plsMarker);
    }

    // 2. Home Address Marker (Wohnanschrift)
    if (home && home.lat !== undefined && home.lng !== undefined && home.address) {
      const homeIcon = L.divIcon({
        className: 'custom-home-marker',
        html: `
          <div class="relative flex items-center justify-center group">
            <div class="relative flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow-xl ring-2 ring-amber-200 font-bold text-sm">
              🏠
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const mp = currentOperation.missingPerson;
      const homePhotoHtml = mp?.photoUrl && mp.photoUrl.trim() !== ''
        ? `<div style="width: 100%; height: 160px; max-height: 180px; border-radius: 10px; overflow: hidden; margin-bottom: 10px; background: #0f172a; border: 1px solid #334155; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">
            <img src="${mp.photoUrl}" alt="${mp.name || 'Vermisste Person'}" style="width: 100%; height: 100%; object-fit: cover; display: block;" referrerpolicy="no-referrer" />
           </div>`
        : `<div style="width: 100%; height: 60px; border-radius: 8px; margin-bottom: 8px; background: #451a03; border: 1px dashed #f59e0b; display: flex; align-items: center; justify-content: center; color: #fbbf24; font-size: 11px; font-weight: 600;">
            Kein Foto hinterlegt
           </div>`;

      const homeMarker = L.marker([home.lat, home.lng], { icon: homeIcon });
      homeMarker.bindPopup(`
        <div style="min-width: 250px; max-width: 300px; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc; padding: 2px;">
          ${homePhotoHtml}
          <div style="font-size: 10px; font-weight: 800; color: #fbbf24; display: flex; align-items: center; gap: 4px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
            <span>🏠 WOHNADRESSE DER PERSON</span>
          </div>
          <div style="font-size: 15px; font-weight: 700; color: #ffffff; line-height: 1.2;">
            ${mp?.name || 'Unbekannt'}${mp?.age ? ` (${mp.age} Jahre)` : ''}
          </div>
          <div style="font-size: 12px; color: #cbd5e1; font-weight: 500; margin-top: 4px; line-height: 1.3;">
            ${home.address}
          </div>
          ${home.notes ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 4px; background: #0f172a; padding: 4px 6px; border-radius: 4px; border: 1px solid #334155;"><strong>Hinweis:</strong> ${home.notes}</div>` : ''}
          ${mp?.clothing ? `<div style="font-size: 11px; color: #cbd5e1; margin-top: 5px;"><strong>Bekleidung:</strong> ${mp.clothing}</div>` : ''}
          ${mp?.description ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 4px;"><strong>Merkmale:</strong> ${mp.description}</div>` : ''}
          ${mp?.medicalConditions && mp.medicalConditions.length > 0 ? `<div style="font-size: 11px; color: #fca5a5; background: #450a0a; border: 1px solid #7f1d1d; padding: 3px 6px; border-radius: 4px; margin-top: 5px;"><strong>⚠️ Medizinisch:</strong> ${mp.medicalConditions.join(', ')}</div>` : ''}
          <div style="font-size: 10px; color: #64748b; font-family: monospace; margin-top: 6px; border-top: 1px solid #334155; padding-top: 4px;">
            GPS: ${home.lat.toFixed(5)}, ${home.lng.toFixed(5)}
          </div>
        </div>
      `, { maxWidth: 320, minWidth: 260 });
      plsLayerRef.current.addLayer(homeMarker);

      // 3. If both Home and PLS exist, draw tactical connecting line
      if (pls && pls.lat && pls.lng) {
        const distMeters = calculateDistanceMeters(home.lat, home.lng, pls.lat, pls.lng);
        const distKm = (distMeters / 1000).toFixed(2);

        const homeToPlsLine = L.polyline(
          [
            [home.lat, home.lng],
            [pls.lat, pls.lng],
          ],
          {
            color: '#f59e0b',
            weight: 2,
            dashArray: '5, 8',
            opacity: 0.8,
          }
        );

        // Midpoint badge
        const midLat = (home.lat + pls.lat) / 2;
        const midLng = (home.lng + pls.lng) / 2;
        const distBadge = L.marker([midLat, midLng], {
          icon: L.divIcon({
            className: 'custom-dist-badge',
            html: `<div style="background:#1e293b;color:#fcd34d;border:1px solid #f59e0b;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:bold;font-family:monospace;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.5);">Distanz: ${distKm} km</div>`,
            iconSize: [80, 20],
            iconAnchor: [40, 10],
          }),
        });

        plsLayerRef.current.addLayer(homeToPlsLine);
        plsLayerRef.current.addLayer(distBadge);
      }
    }

  }, [currentOperation, showRadiusRings, allUsers, userLocations, activeTrackingTest]);

  // Render EZ / Vereinsbüro Marker (Dedicated Layer)
  useEffect(() => {
    if (!ezLayerRef.current) return;
    ezLayerRef.current.clearLayers();
    if (activeTrackingTest?.isActive) return;

    let hqLat = VEREINSBUERO_LOCATION.lat;
    let hqLng = VEREINSBUERO_LOCATION.lng;
    let hqAddress = VEREINSBUERO_LOCATION.address;
    let hqTitle = '📡 EZ';
    let isStandbyOffice = true;

    if (currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused')) {
      isStandbyOffice = false;
      if (
        currentOperation.headquartersLocation?.lat &&
        currentOperation.headquartersLocation?.lng
      ) {
        hqLat = currentOperation.headquartersLocation.lat;
        hqLng = currentOperation.headquartersLocation.lng;
        hqAddress = currentOperation.headquartersLocation.address || 'EZ / EZ vor Ort';
      } else {
        hqLat = VEREINSBUERO_LOCATION.lat;
        hqLng = VEREINSBUERO_LOCATION.lng;
        hqAddress = VEREINSBUERO_LOCATION.address;
      }
      hqTitle = '📡 EZ';
    }

    const hqIcon = L.divIcon({
      className: 'custom-hq-marker',
      html: isStandbyOffice
        ? `
          <div class="flex items-center justify-center px-2 py-1 rounded-lg bg-indigo-950 text-indigo-200 border border-indigo-400 font-bold text-xs shadow-xl ring-2 ring-indigo-500/50 whitespace-nowrap">
            📡 EZ
          </div>
        `
        : `
          <div class="relative flex items-center justify-center">
            <span class="absolute h-10 w-10 rounded-full bg-indigo-500/40 animate-ping"></span>
            <div class="relative flex items-center justify-center px-2.5 py-1 rounded-xl bg-indigo-700 text-white shadow-xl ring-2 ring-white font-black text-xs whitespace-nowrap">
              📡 EZ
            </div>
          </div>
        `,
      iconSize: [64, 30],
      iconAnchor: [32, 15],
    });

    const hqMarker = L.marker([hqLat, hqLng], {
      icon: hqIcon,
      zIndexOffset: 1200,
    });

    const markerNavData = {
      lat: hqLat,
      lng: hqLng,
      address: hqAddress,
      title: hqTitle,
      isStandbyOffice,
      operationTitle: currentOperation?.title,
      commander: currentOperation?.commander,
    };

    // Direct click/tap on EZ on the map opens the coordinate navigation transfer modal
    hqMarker.on('click', () => {
      setEzNavData(markerNavData);
    });

    hqMarker.bindPopup(`
      <div class="p-2.5 text-slate-100 font-sans min-w-[220px]">
        <div class="font-bold text-indigo-400 text-sm flex items-center gap-1.5">
          <span>${isStandbyOffice ? '📡' : '🚨'}</span>
          <span>${hqTitle}</span>
        </div>
        <div class="text-xs text-slate-300 mt-1 font-medium">${hqAddress}</div>
        <div class="text-[10px] text-slate-400 font-mono mt-0.5">${hqLat.toFixed(5)}° N, ${hqLng.toFixed(5)}° E</div>
        ${!isStandbyOffice && currentOperation ? `<div class="text-xs text-slate-300 mt-1.5 bg-slate-800/80 border border-slate-700 p-1.5 rounded">Einsatz: <strong class="text-white">${currentOperation.title}</strong><br/>Leitung: <strong class="text-white">${currentOperation.commander}</strong></div>` : `<div class="text-[11px] text-emerald-400 font-medium mt-1">🟢 Status: Bereitschaft am Vereinsbüro</div>`}
        <div class="mt-2.5 pt-2 border-t border-slate-700">
          <a
            href="https://www.google.com/maps/dir/?api=1&destination=${hqLat},${hqLng}"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow transition no-underline text-center"
          >
            🧭 In Navi-App öffnen
          </a>
        </div>
      </div>
    `);
    ezLayerRef.current.addLayer(hqMarker);
  }, [currentOperation, activeTrackingTest]);

  // Render Search Sectors (Suchsektoren)
  useEffect(() => {
    if (!sectorsLayerRef.current || !currentOperation) return;
    sectorsLayerRef.current.clearLayers();

    if (!showSectors || activeTrackingTest?.isActive) return;

    // 1. Render Master Search Area (Haupt-Suchgebiet) if defined
    if (currentOperation.searchAreaPolygon && currentOperation.searchAreaPolygon.length >= 3) {
      const searchAreaPoly = L.polygon(currentOperation.searchAreaPolygon, {
        color: '#a855f7',
        weight: 3,
        dashArray: '8, 8',
        fillColor: '#c084fc',
        fillOpacity: 0.08,
      });

      const saLats = currentOperation.searchAreaPolygon.map((p) => p[0]);
      const saLngs = currentOperation.searchAreaPolygon.map((p) => p[1]);
      const saCenterLat = saLats.reduce((a, b) => a + b, 0) / saLats.length;
      const saCenterLng = saLngs.reduce((a, b) => a + b, 0) / saLngs.length;

      const totalHectares = currentOperation.searchAreaHectares || calculatePolygonHectares(currentOperation.searchAreaPolygon);

      const saBadgeIcon = L.divIcon({
        className: 'search-area-center-label',
        html: `
          <div class="transform -translate-x-1/2 -translate-y-1/2 px-3 py-1 rounded-full text-xs font-mono font-bold shadow-lg flex items-center gap-1.5 whitespace-nowrap bg-purple-950/90 text-purple-200 border border-purple-500 ring-2 ring-purple-500/30">
            <span>🗺️ ${currentOperation.searchAreaName || 'Haupt-Suchgebiet'}</span>
            <span class="text-[10px] text-purple-300 font-normal">(${totalHectares.toFixed(1)} ha)</span>
          </div>
        `,
        iconSize: [0, 0],
      });

      const saLabelMarker = L.marker([saCenterLat, saCenterLng], { icon: saBadgeIcon, interactive: false });

      sectorsLayerRef.current.addLayer(searchAreaPoly);
      sectorsLayerRef.current.addLayer(saLabelMarker);
    }

    currentOperation.sectors.forEach((sector) => {
      const isSearched = sector.status === 'searched';
      const isInProgress = sector.status === 'in_progress';
      const isSuspicious = sector.status === 'suspicious';

      // Colors based on requested specification:
      // "wenn ein gebiet als abgesucht gilt, soll dieser grün markiert werden können"
      let strokeColor = '#3b82f6';
      let fillColor = '#3b82f6';
      let fillOpacity = 0.2;

      if (isSearched) {
        strokeColor = '#16a34a';
        fillColor = '#22c55e'; // Vibrant Green
        fillOpacity = 0.35;
      } else if (isInProgress) {
        strokeColor = '#d97706';
        fillColor = '#f59e0b';
        fillOpacity = 0.25;
      } else if (isSuspicious) {
        strokeColor = '#dc2626';
        fillColor = '#ef4444';
        fillOpacity = 0.3;
      }

      const polygon = L.polygon(sector.polygon, {
        color: strokeColor,
        weight: isSearched ? 3 : 2,
        fillColor: fillColor,
        fillOpacity: fillOpacity,
        dashArray: isSearched ? undefined : isInProgress ? '4, 4' : undefined,
      });

      // Find assigned users
      const assignedUsers = allUsers.filter((u) => sector.assignedUserIds?.includes(u.id));
      const equipmentBadges = (sector.assignedEquipment || []).map((eq) => getEquipmentBadge([eq])).map((b) => b.icon).join(' ');

      // Center centroid for sector label
      const lats = sector.polygon.map((p) => p[0]);
      const lngs = sector.polygon.map((p) => p[1]);
      const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

      // Custom sector name & status badge in center
      const labelIcon = L.divIcon({
        className: 'sector-center-label',
        html: `
          <div class="cursor-pointer transform -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 rounded-full text-xs font-bold shadow-md flex items-center gap-1.5 whitespace-nowrap border ${
            isSearched
              ? 'bg-emerald-900/90 text-emerald-100 border-emerald-500 ring-2 ring-emerald-400/40'
              : isInProgress
              ? 'bg-amber-950/90 text-amber-200 border-amber-500'
              : 'bg-[#1E293B]/95 text-slate-100 border-slate-600'
          }">
            <span>${isSearched ? '✅' : isInProgress ? '⏳' : '🎯'}</span>
            <span>${sector.name}</span>
            ${equipmentBadges ? `<span class="opacity-90 ml-0.5">${equipmentBadges}</span>` : ''}
          </div>
        `,
        iconSize: [0, 0],
      });

      const labelMarker = L.marker([centerLat, centerLng], { icon: labelIcon, interactive: true });

      const handleSectorClick = () => {
        setSelectedSector(sector);
        setSelectedUser(null);
      };

      polygon.on('click', handleSectorClick);
      labelMarker.on('click', handleSectorClick);

      sectorsLayerRef.current?.addLayer(polygon);
      sectorsLayerRef.current?.addLayer(labelMarker);
    });
  }, [currentOperation, allUsers, showSectors]);

  // Render GPS Movement Trails (Suchspuren / Tracks) - Live & Archiviert (Phase 1 / Reaktiviert) & TrackingTest
  useEffect(() => {
    if (!tracksLayerRef.current) return;
    tracksLayerRef.current.clearLayers();

    // 1. Render active Trackingtest tracks (unconditionally so test track is ALWAYS visible on map)
    if (activeTrackingTest && activeTrackingTest.trackPoints.length >= 2) {
      const points: [number, number][] = activeTrackingTest.trackPoints.map(p => [p.lat, p.lng]);
      
      // Background glow line for high contrast
      const glowPolyline = L.polyline(points, {
        color: '#0f172a',
        weight: 7,
        opacity: 0.7,
        smoothFactor: 0,
      });
      tracksLayerRef.current.addLayer(glowPolyline);

      // Main active test polyline (Vibrant Blue with smoothFactor 0 for zero zoom loss)
      const polyline = L.polyline(points, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.95,
        smoothFactor: 0,
      });

      polyline.bindTooltip(
        `⏱️ Trackingtest: ${activeTrackingTest.userName} • ${activeTrackingTest.trackPoints.length} Wegpunkte`,
        { sticky: true, permanent: true, className: 'tactical-tooltip-test' }
      );

      tracksLayerRef.current.addLayer(polyline);

      // Start & End markers for the active test
      const startPt = activeTrackingTest.trackPoints[0];
      const latestPt = activeTrackingTest.trackPoints[activeTrackingTest.trackPoints.length - 1];

      if (startPt) {
        const startMarker = L.circleMarker([startPt.lat, startPt.lng], {
          radius: 7,
          color: '#16a34a',
          fillColor: '#4ade80',
          fillOpacity: 1,
          weight: 2,
        });
        startMarker.bindTooltip('🚀 Test Startpunkt', { permanent: false });
        tracksLayerRef.current.addLayer(startMarker);
      }

      if (latestPt && activeTrackingTest.trackPoints.length > 1) {
        const latestMarker = L.circleMarker([latestPt.lat, latestPt.lng], {
          radius: 8,
          color: '#2563eb',
          fillColor: '#60a5fa',
          fillOpacity: 1,
          weight: 3,
        });
        latestMarker.bindTooltip('📍 Aktueller Test-Standort', { permanent: false });
        tracksLayerRef.current.addLayer(latestMarker);
      }
    }

    if (!showTracks) return;

    // Track which user tracks have been rendered to prevent double-drawing identical lines
    const renderedTrackUserIds = new Set<string>();

    // 2. Render historical / archived search tracks (from previous search phases or saved on pause/end)
    if (currentOperation?.archivedTracks && currentOperation.archivedTracks.length > 0 && !activeTrackingTest?.isActive) {
      currentOperation.archivedTracks.forEach((archivedTrack) => {
        if (!archivedTrack.points || archivedTrack.points.length < 2) return;

        // If the live user location currently has equal or more points, let live renderer draw the full extended track
        const liveLoc = userLocations[archivedTrack.userId];
        const isCurrentlyLiveWithMore =
          !isArchiveMode &&
          liveLoc?.trackHistory &&
          liveLoc.trackHistory.length >= archivedTrack.points.length;

        if (isCurrentlyLiveWithMore) {
          return; // Skip archived version so the live extended track is shown seamlessly
        }

        renderedTrackUserIds.add(archivedTrack.userId);

        const segments: [number, number][][] = [];
        let currentSeg: [number, number][] = [];

        for (let i = 0; i < archivedTrack.points.length; i++) {
          const pt = archivedTrack.points[i];
          if (currentSeg.length === 0) {
            currentSeg.push([pt.lat, pt.lng]);
          } else {
            const prevPt = currentSeg[currentSeg.length - 1];
            const dist = calculateDistanceMeters(prevPt[0], prevPt[1], pt.lat, pt.lng);
            if (dist > 1200) {
              if (currentSeg.length > 1) {
                segments.push(currentSeg);
              }
              currentSeg = [[pt.lat, pt.lng]];
            } else {
              currentSeg.push([pt.lat, pt.lng]);
            }
          }
        }
        if (currentSeg.length > 1) {
          segments.push(currentSeg);
        }

        const isPausedOrEnded = currentOperation.status === 'paused' || currentOperation.status === 'completed';
        const isPhase1 = archivedTrack.phaseLabel?.includes('Suchphase 1') || archivedTrack.phaseLabel?.includes('Phase 1');

        segments.forEach((seg) => {
          const polyline = L.polyline(seg, {
            color: archivedTrack.color || getUserTrackColor(archivedTrack.userId, allUsers),
            weight: 3.5,
            opacity: 0.85,
            smoothFactor: 0,
            dashArray: isPhase1 && currentOperation.status === 'active' ? '8, 6' : undefined,
          });

          polyline.bindTooltip(
            `📍 Bewegungsprofil: ${archivedTrack.userName} (${archivedTrack.callSign}) • ${archivedTrack.points.length} Wegpunkte (${archivedTrack.phaseLabel || 'Gesichert'})`,
            { sticky: true }
          );

          tracksLayerRef.current?.addLayer(polyline);
        });
      });
    }

    // 3. Render user tracks from userLocations (in active or paused mode)
    if (!isArchiveMode || (currentOperation?.archivedTracks?.length || 0) === 0) {
      (Object.entries(userLocations) as [string, UserLocationState][]).forEach(([userId, locState]) => {
        if (activeTrackingTest?.isActive) {
          return;
        }

        const history = locState.trackHistory;
        if (!history || history.length < 2) return;

        // If this user track was already rendered in full via archivedTracks, avoid duplicate draw
        if (renderedTrackUserIds.has(userId) && (currentOperation?.archivedTracks?.find(t => t.userId === userId)?.points.length || 0) >= history.length) {
          return;
        }

        const user = allUsers.find((u) => u.id === userId);
        const isDrone = user?.equipment?.includes('drone');
        const trackColor = getUserTrackColor(user || userId, allUsers);

        const isPaused = currentOperation?.status === 'paused';
        const isCompleted = currentOperation?.status === 'completed';
        const modeLabel = isPaused ? 'Pausiert' : isCompleted ? 'Abgeschlossen' : locState.isLive ? 'Live' : 'Gesichert';

        // Draw track segments with gap-awareness for Funklöcher (> 45s signal loss)
        for (let i = 1; i < history.length; i++) {
          const prevPt = history[i - 1];
          const currPt = history[i];
          const dist = calculateDistanceMeters(prevPt.lat, prevPt.lng, currPt.lat, currPt.lng);

          // Skip extreme teleports / map bounds jumps (> 1200m)
          if (dist > 1200) {
            continue;
          }

          const timeDiffMs = Math.abs(new Date(currPt.timestamp).getTime() - new Date(prevPt.timestamp).getTime());
          const isGap = currPt.isGapStart || timeDiffMs >= 45000;

          if (isGap) {
            // Render high-contrast dark outline for gap segment
            const gapGlow = L.polyline(
              [
                [prevPt.lat, prevPt.lng],
                [currPt.lat, currPt.lng],
              ],
              {
                color: '#0f172a',
                weight: isDrone ? 5 : 6,
                opacity: 0.6,
                smoothFactor: 0,
                dashArray: '6, 6',
              }
            );
            tracksLayerRef.current?.addLayer(gapGlow);

            // Render Funkloch-Lücke gestrichelt in der eigenen User-Farbe
            const gapPolyline = L.polyline(
              [
                [prevPt.lat, prevPt.lng],
                [currPt.lat, currPt.lng],
              ],
              {
                color: trackColor, // Eigene User-Farbe!
                weight: isDrone ? 3 : 3.5,
                opacity: 0.9,
                smoothFactor: 0,
                dashArray: '6, 6', // Gestrichelt im Funklochbereich
              }
            );
            const gapSec = currPt.gapDurationSec || Math.round(timeDiffMs / 1000);
            const gapMin = Math.max(1, Math.round(gapSec / 60));
            gapPolyline.bindTooltip(
              `⚠️ Funkloch-Lücke (ca. ${gapMin} Min. ohne Signal, simulierter Verlauf): ${user?.name || 'Sucher'} (${user?.callSign || 'Unit'})`,
              { sticky: true }
            );
            tracksLayerRef.current?.addLayer(gapPolyline);
          } else {
            // Render high-contrast dark outline segment for maximum visibility on satellite/topo maps
            const glowPolyline = L.polyline(
              [
                [prevPt.lat, prevPt.lng],
                [currPt.lat, currPt.lng],
              ],
              {
                color: '#0f172a',
                weight: isDrone ? 5 : 6,
                opacity: 0.6,
                smoothFactor: 0,
              }
            );
            tracksLayerRef.current?.addLayer(glowPolyline);

            // Render normal continuous movement segment
            const segPolyline = L.polyline(
              [
                [prevPt.lat, prevPt.lng],
                [currPt.lat, currPt.lng],
              ],
              {
                color: trackColor,
                weight: isDrone ? 3 : 3.5,
                opacity: 0.95,
                smoothFactor: 0,
                dashArray: isDrone ? '4, 4' : undefined,
              }
            );
            segPolyline.bindTooltip(
              `📍 Bewegungsprofil (${modeLabel}): ${user?.name || 'Sucher'} (${user?.callSign || 'Unit'}) • ${history.length} Wegpunkte`,
              { sticky: true }
            );
            tracksLayerRef.current?.addLayer(segPolyline);
          }
        }
      });
    }
  }, [userLocations, allUsers, currentOperation, showTracks, showInactiveResponders, isArchiveMode, activeTrackingTest]);

  // Render Active Responders / Units Pins (with Spiderfy radial layout for co-located responders)
  useEffect(() => {
    if (!respondersLayerRef.current) return;
    respondersLayerRef.current.clearLayers();

    if (!showResponders || isArchiveMode) return;

    interface RenderableResponder {
      userId: string;
      user: User;
      locState: UserLocationState;
      idx: number;
      isOnline: boolean;
      isMe: boolean;
      trackColor: string;
      origLat: number;
      origLng: number;
    }

    const renderList: RenderableResponder[] = [];
    const targetUserIds = new Set<string>();
    Object.keys(userLocations).forEach((id) => targetUserIds.add(id));
    allUsers.filter((u) => u.isActive).forEach((u) => targetUserIds.add(u.id));

    targetUserIds.forEach((userId) => {
      // If tracking test is active, ONLY render the current user doing the test
      if (activeTrackingTest?.isActive) {
        if (userId !== activeTrackingTest.userId) return;
      }

      const user = allUsers.find((u) => u.id === userId);
      if (!user) return;

      // Only display active / logged-in users unless showInactiveResponders is active
      const isOnline = user.isActive;
      if (!isOnline && !showInactiveResponders) return;

      let locState = userLocations[userId];
      if (!locState && user.id === currentUser?.id && myLocation) {
        locState = {
          userId: user.id,
          currentPosition: myLocation,
          isLive: true,
          lastUpdated: new Date().toISOString(),
          trackHistory: [],
        };
      }

      if (!locState || !locState.currentPosition) return;

      renderList.push({
        userId,
        user,
        locState,
        idx: renderList.length,
        isOnline,
        isMe: user.id === currentUser?.id,
        trackColor: getUserTrackColor(user || userId, allUsers),
        origLat: locState.currentPosition.lat,
        origLng: locState.currentPosition.lng,
      });
    });

    // Group nearby/stacked responders into spatial clusters (within ~22 meters)
    const clusters: RenderableResponder[][] = [];
    renderList.forEach((item) => {
      let placed = false;
      for (const cl of clusters) {
        const rep = cl[0];
        const dLat = item.origLat - rep.origLat;
        const dLng = item.origLng - rep.origLng;
        // ~0.00020 deg is approx 20 meters
        if (dLat * dLat + dLng * dLng < 0.00020 * 0.00020) {
          cl.push(item);
          placed = true;
          break;
        }
      }
      if (!placed) {
        clusters.push([item]);
      }
    });

    clusters.forEach((cluster) => {
      const isCluster = cluster.length > 1;
      const centerLat = cluster.reduce((sum, r) => sum + r.origLat, 0) / cluster.length;
      const centerLng = cluster.reduce((sum, r) => sum + r.origLng, 0) / cluster.length;

      if (isCluster) {
        // Draw subtle gathering center indicator hub
        const hubMarker = L.circleMarker([centerLat, centerLng], {
          radius: 6,
          color: '#38bdf8',
          fillColor: '#0284c7',
          fillOpacity: 0.9,
          weight: 2,
        });
        hubMarker.bindTooltip(
          `<div class="text-[10px] font-mono font-bold text-slate-100 bg-[#1E293B] px-1.5 py-0.5 rounded border border-cyan-500 shadow-md">📍 Sammelpunkt (${cluster.length} Kräfte)</div>`,
          { direction: 'top', className: 'tactical-tooltip', opacity: 0.95 }
        );
        respondersLayerRef.current?.addLayer(hubMarker);
      }

      cluster.forEach((item, itemIdx) => {
        const N = cluster.length;
        let markerLat = item.origLat;
        let markerLng = item.origLng;

        if (isCluster) {
          // Disperse in circle around the gathering point (Spiderfy)
          const radius = 0.00022 + Math.min(N - 2, 4) * 0.000035; // ~24-38 meters
          const angle = (2 * Math.PI * itemIdx) / N - Math.PI / 2;
          markerLat = centerLat + radius * Math.sin(angle);
          markerLng = centerLng + (radius * Math.cos(angle)) / Math.cos((centerLat * Math.PI) / 180);

          // Draw guide leg line from hub to dispersed pin
          const leg = L.polyline(
            [
              [centerLat, centerLng],
              [markerLat, markerLng],
            ],
            {
              color: item.isMe ? '#38bdf8' : item.isOnline ? '#60a5fa' : '#64748b',
              weight: 1.5,
              dashArray: '3, 4',
              opacity: 0.75,
            }
          );
          respondersLayerRef.current?.addLayer(leg);
        }

        const badge = getEquipmentBadge(item.user.equipment);
        const assignedSector = currentOperation?.sectors.find(
          (s) => s.id === item.user.assignedSectorId || s.assignedUserIds?.includes(item.user.id)
        );
        const connStatus = getUserConnectionStatus(item.user);
        const freshnessText = getSignalFreshnessText(item.user);

        const sectorTag = activeTrackingTest?.isActive
          ? `<span class="text-sky-300 font-bold ml-1 font-mono">📡 TEST</span>`
          : assignedSector
          ? `<span class="text-amber-300 font-bold ml-1">🎯 ${assignedSector.name}</span>`
          : '';
        const clusterBadge = isCluster ? `<span class="bg-blue-600 text-white rounded-full px-1 text-[9px] font-mono shadow ml-1">${itemIdx + 1}/${N}</span>` : '';

        const statusBadgeHtml = !item.isOnline
          ? '<span class="text-slate-400 font-normal">(Abgemeldet)</span>'
          : connStatus === 'active'
          ? '<span class="text-emerald-400 font-bold">🟢</span>'
          : connStatus === 'stale'
          ? `<span class="text-amber-300 font-bold">🟡 Funkloch (${freshnessText})</span>`
          : `<span class="text-rose-400 font-bold">🔴 Signal weg (${freshnessText})</span>`;

        const outerGlowClass = item.isMe
          ? 'bg-cyan-500/40 animate-ping'
          : !item.isOnline
          ? 'bg-slate-500/20'
          : connStatus === 'active'
          ? 'bg-emerald-500/20'
          : connStatus === 'stale'
          ? 'bg-amber-500/40 animate-pulse'
          : 'bg-rose-500/30';

        const avatarBorderClass = !item.isOnline
          ? 'border-slate-400 opacity-60'
          : connStatus === 'active'
          ? 'border-white'
          : connStatus === 'stale'
          ? 'border-amber-400 ring-2 ring-amber-400/50'
          : 'border-rose-500 ring-2 ring-rose-500/50';

        // Render Accuracy Confidence Halo for selected responder or current user
        const posAcc = item.locState.currentPosition?.accuracy;
        if (posAcc && posAcc > 0 && posAcc <= 100) {
          const isSelected = selectedUser?.id === item.userId;
          if (isSelected || (item.isMe && item.isOnline)) {
            const accuracyCircle = L.circle([item.origLat, item.origLng], {
              radius: posAcc,
              color: item.isMe ? '#06b6d4' : item.trackColor,
              fillColor: item.isMe ? '#06b6d4' : item.trackColor,
              fillOpacity: 0.12,
              weight: 1,
              dashArray: '3, 3',
            });
            accuracyCircle.bindTooltip(
              `🎯 GPS-Genauigkeit: ±${posAcc}m (${item.user.name})`,
              { sticky: true }
            );
            respondersLayerRef.current?.addLayer(accuracyCircle);
          }
        }

        // Custom animated responder pin with photo/equipment & connection status
        const iconHtml = `
          <div class="relative group cursor-pointer">
            <div class="absolute -inset-1.5 rounded-full ${outerGlowClass}"></div>
            <div class="relative flex items-center justify-center h-10 w-10 rounded-full border-2 ${avatarBorderClass} shadow-2xl overflow-hidden" style="background-color: ${item.trackColor};">
              ${
                item.user.photoUrl
                  ? `<img src="${item.user.photoUrl}" alt="${item.user.name}" class="h-full w-full object-cover" />`
                  : `<span class="text-white font-bold text-xs">${item.user.name.charAt(0)}</span>`
              }
            </div>
            <!-- Sub-badge with equipment icon -->
            <div class="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#1E293B] text-xs border border-white/50 shadow">
              ${badge.icon}
            </div>
            <!-- Call sign banner with Sector, Cluster Position & Connection Status -->
            <div class="absolute top-11 left-1/2 transform -translate-x-1/2 px-2 py-0.5 rounded ${item.isOnline ? 'bg-[#1E293B]/95 text-white' : 'bg-slate-800/90 text-slate-300'} text-[10px] font-semibold border border-slate-700 whitespace-nowrap shadow-md flex items-center gap-1">
              <span>${item.user.callSign}</span>
              ${clusterBadge}
              ${sectorTag}
              ${statusBadgeHtml}
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'custom-responder-marker',
          html: iconHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const marker = L.marker([markerLat, markerLng], {
          icon: customIcon,
          zIndexOffset: item.isMe ? 1000 : item.isOnline ? 500 : 100,
        });

        marker.on('click', () => {
          setSelectedUser(item.user);
          setSelectedSector(null);
        });

        respondersLayerRef.current?.addLayer(marker);
      });
    });
  }, [userLocations, allUsers, currentUser, currentOperation, showResponders, showInactiveResponders, activeTrackingTest]);

  // Render Findings (Fundmeldungen) - Filters false alarms during active operation to prevent confusion
  useEffect(() => {
    if (!findingsLayerRef.current || !currentOperation) return;
    findingsLayerRef.current.clearLayers();

    if (!showFindings || activeTrackingTest?.isActive) return;

    const visibleFindings = (currentOperation.findings || []).filter((finding) => {
      if (showFalseAlarms) return true;
      return finding.status !== 'false_alarm';
    });

    visibleFindings.forEach((finding) => {
      const isCritical = finding.urgency === 'critical';
      const isPerson = finding.category.startsWith('person');
      const isFalseAlarm = finding.status === 'false_alarm';

      const findingIcon = L.divIcon({
        className: 'custom-finding-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer">
            ${isFalseAlarm ? '' : `<span class="absolute h-10 w-10 rounded-full ${isCritical ? 'bg-red-500/50 animate-ping' : 'bg-amber-500/30'}"></span>`}
            <div class="relative flex h-9 w-9 items-center justify-center rounded-full ${
              isFalseAlarm
                ? 'bg-slate-700 opacity-75 ring-1 ring-red-400'
                : isPerson
                ? 'bg-red-600'
                : isCritical
                ? 'bg-amber-600'
                : 'bg-emerald-600'
            } text-white shadow-2xl ring-2 ring-white text-base">
              ${isFalseAlarm ? '❌' : isPerson ? '🚨' : finding.category === 'clothing' ? '👕' : finding.category === 'trail_scent' ? '🐾' : '🚩'}
            </div>
            <div class="absolute -top-6 left-1/2 transform -translate-x-1/2 px-2 py-0.5 rounded ${
              isFalseAlarm ? 'bg-[#1E293B] text-slate-400 border border-slate-700' : 'bg-red-950/90 text-red-200 border border-red-500'
            } text-[10px] font-bold whitespace-nowrap shadow">
              ${isFalseAlarm ? 'FEHLALARM' : `FUND #${finding.id.slice(-3)}`}
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([finding.location.lat, finding.location.lng], {
        icon: findingIcon,
        zIndexOffset: isFalseAlarm ? 600 : 1200,
      });

      marker.on('click', () => {
        if (onOpenFindingDetail) {
          onOpenFindingDetail(finding);
        } else if (onOpenFindingDetails) {
          onOpenFindingDetails(finding);
        }
      });

      findingsLayerRef.current?.addLayer(marker);
    });
  }, [currentOperation, showFindings, showFalseAlarms, onOpenFindingDetails, onOpenFindingDetail, activeTrackingTest]);

  // Center on selected user when they change
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedUser) return;
    const userLoc = userLocations[selectedUser.id];
    if (userLoc) {
      const { lat, lng } = userLoc.currentPosition;
      mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1.2 });
    }
  }, [selectedUser, userLocations]);

  // Center on user position
  const handleCenterOnMe = () => {
    if (!mapInstanceRef.current || !currentUser) return;
    const myPos = userLocations[currentUser.id]?.currentPosition;
    if (myPos) {
      mapInstanceRef.current.flyTo([myPos.lat, myPos.lng], 16, { duration: 1.2 });
    }
  };

  // Center on operation overview
  const handleFitBounds = () => {
    if (!mapInstanceRef.current) return;
    const allPoints: [number, number][] = [];

    if (currentOperation) {
      if (currentOperation.searchAreaPolygon) {
        currentOperation.searchAreaPolygon.forEach((pt) => allPoints.push(pt));
      }
      if (currentOperation.sectors) {
        currentOperation.sectors.forEach((sec) => {
          if (sec.polygon) sec.polygon.forEach((pt) => allPoints.push(pt));
        });
      }
      if (currentOperation.findings) {
        currentOperation.findings.forEach((f) => {
          if (f.location) allPoints.push([f.location.lat, f.location.lng]);
        });
      }
      if (currentOperation.missingPerson?.lastSeenLocation) {
        allPoints.push([currentOperation.missingPerson.lastSeenLocation.lat, currentOperation.missingPerson.lastSeenLocation.lng]);
      }
      if (currentOperation.headquartersLocation) {
        allPoints.push([currentOperation.headquartersLocation.lat, currentOperation.headquartersLocation.lng]);
      }
      if (currentOperation.archivedTracks) {
        currentOperation.archivedTracks.forEach((t) => {
          if (t.points) t.points.forEach((pt) => allPoints.push([pt.lat, pt.lng]));
        });
      }
      if (userLocations) {
        Object.values(userLocations).forEach((loc) => {
          if (loc.trackHistory) loc.trackHistory.forEach((pt) => allPoints.push([pt.lat, pt.lng]));
        });
      }
    }

    // If tracking test is active, ONLY fit bounds to the test track!
    if (activeTrackingTest?.isActive && activeTrackingTest.trackPoints.length > 0) {
      allPoints.length = 0; // Clear other points
      activeTrackingTest.trackPoints.forEach(pt => allPoints.push([pt.lat, pt.lng]));
    }

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
    } else {
      mapInstanceRef.current.setView([VEREINSBUERO_LOCATION.lat, VEREINSBUERO_LOCATION.lng], 13);
    }
  };

  useEffect(() => {
    const onForceFitBounds = () => handleFitBounds();
    window.addEventListener('ForceFitBounds', onForceFitBounds);
    return () => window.removeEventListener('ForceFitBounds', onForceFitBounds);
  }, [currentOperation, activeTrackingTest, userLocations]);

  return (
    <div className="relative w-full h-full min-h-[500px] overflow-hidden bg-[#0F172A] select-none">
      {/* Map DOM Container */}
      <div id="tactical-leaflet-map" ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Drawing Mode Banner Overlay */}
      {isDrawingSector && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] w-[95%] max-w-2xl bg-[#1E293B]/95 text-slate-100 p-3 sm:p-4 rounded-2xl shadow-2xl border border-blue-500/80 backdrop-blur-md flex flex-col gap-3 font-sans">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <PenTool className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  Sektor-Zeichnen
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400 font-normal">
                    {drawMode === 'pen' ? '🖊️ Freihand / Stift (Stylus/Touch)' : '📐 Punkt-für-Punkt (Klick)'}
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400 font-mono">
                  {drawMode === 'pen'
                    ? 'Mit Pen, Finger oder Maus eine geschlossene Kontur über das Suchgebiet ziehen.'
                    : 'Auf die Karte tippen, um nacheinander Eckpunkte zu setzen.'}
                </p>
              </div>
            </div>

            {/* Live Stats Badge */}
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                📍 {drawnPoints.length} Punkte
              </span>
              {drawnPoints.length >= 3 && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-950 border border-emerald-600 text-emerald-300 font-bold">
                  📏 {calculatePolygonHectares(drawnPoints)} ha
                </span>
              )}
            </div>
          </div>

          {/* Controls Bar: Mode Switcher + Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
            {/* Draw Mode Switcher */}
            <div className="flex items-center p-0.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setDrawMode('pen')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  drawMode === 'pen'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                Freihand / Stift
              </button>
              <button
                type="button"
                onClick={() => setDrawMode('click')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  drawMode === 'click'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <MousePointer className="w-3.5 h-3.5" />
                Eckpunkte (Klick)
              </button>
            </div>

            {/* Actions: Undo, Clear, Cancel, Save */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  if (strokeHistory.length > 1) {
                    const nextH = strokeHistory.slice(0, -1);
                    setStrokeHistory(nextH);
                    setDrawnPoints(nextH[nextH.length - 1] || []);
                  } else {
                    setStrokeHistory([]);
                    setDrawnPoints([]);
                  }
                }}
                disabled={drawnPoints.length === 0}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 border border-slate-700 transition cursor-pointer text-[11px]"
                title="Letzten Schritt rückgängig machen"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Rückgängig
              </button>

              <button
                type="button"
                onClick={() => {
                  setDrawnPoints([]);
                  setStrokeHistory([]);
                }}
                disabled={drawnPoints.length === 0}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 border border-slate-700 transition cursor-pointer text-[11px]"
                title="Zeichnung leeren"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Löschen
              </button>

              <button
                type="button"
                onClick={() => {
                  setDrawnPoints([]);
                  setStrokeHistory([]);
                  if (onCancelDrawing) onCancelDrawing();
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer text-[11px] font-bold"
              >
                Abbrechen
              </button>

              <button
                type="button"
                onClick={() => {
                  if (drawnPoints.length >= 3 && onFinishDrawing) {
                    onFinishDrawing(drawnPoints);
                    setDrawnPoints([]);
                    setStrokeHistory([]);
                  }
                }}
                disabled={drawnPoints.length < 3}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg font-bold transition cursor-pointer shadow text-[11px] uppercase tracking-wider"
              >
                <Check className="w-3.5 h-3.5" />
                Sektor übernehmen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETED OPERATION ARCHIVE BANNER / PROTOKOLL */}
      {isArchiveMode && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[950] max-w-xl w-[94%] sm:w-auto bg-[#1E293B]/95 backdrop-blur-md border border-amber-500/50 rounded-2xl px-4 py-2.5 shadow-2xl text-slate-200 flex flex-wrap items-center justify-between gap-3 font-sans">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <div className="font-bold text-amber-300 uppercase tracking-wider font-mono text-[10px]">
                Einsatzprotokoll & Lagekarte (Archiv)
              </div>
              <div className="text-slate-300 font-mono text-[11px]">
                {currentOperation?.closingNotes
                  ? currentOperation.closingNotes
                  : 'Sektoren, Fundstellen und Bewegungsprofile der Suchtrupps'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={captureMapSnapshot}
              disabled={isCapturingSnapshot}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg transition cursor-pointer shrink-0 disabled:opacity-50"
              title="Aktuellen Kartenausschnitt mit allen Spuren und Sektoren als Bild für das Protokoll speichern"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{isCapturingSnapshot ? 'Erfasse Bild...' : '📸 Snapshot speichern'}</span>
            </button>

            {onSelectArchiveOp && currentOperation && (
              <button
                type="button"
                onClick={() => onSelectArchiveOp(currentOperation.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition cursor-pointer shrink-0"
                title="Formelles Einsatzprotokoll als PDF anzeigen und exportieren"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>📋 Protokoll PDF</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Snapshot saved notice toast */}
      {snapshotSavedNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1100] bg-emerald-800/95 backdrop-blur-md text-white px-4 py-2 rounded-xl shadow-2xl font-bold text-xs flex items-center gap-2 border border-emerald-400 animate-in fade-in zoom-in-95 duration-200">
          <Check className="w-4 h-4 text-emerald-300" />
          <span>Lagekarten-Snapshot erfolgreich im Einsatzprotokoll hinterlegt!</span>
        </div>
      )}

      {/* MOBILE FLOATING ACTION BAR (Top, compact, unobstructed view for smartphone searchers) */}
      <div className="md:hidden absolute top-2 left-2 z-[900] flex items-center gap-1.5 pointer-events-none">
        <div className="flex items-center gap-1.5 pointer-events-auto bg-[#1E293B]/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-700 shadow-xl">
          <button
            onClick={handleCenterOnMe}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer border border-blue-500/40 font-mono"
            title="Auf mein GPS zentrieren"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>GPS</span>
          </button>

          <button
            onClick={() => {
              const isOpActive = currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused');
              const hq = isOpActive && currentOperation.headquartersLocation?.lat && currentOperation.headquartersLocation?.lng
                ? currentOperation.headquartersLocation
                : VEREINSBUERO_LOCATION;
              setEzNavData({
                lat: hq.lat,
                lng: hq.lng,
                address: hq.address || (isOpActive ? 'EZ vor Ort' : VEREINSBUERO_LOCATION.address),
                title: '📡 EZ',
                isStandbyOffice: !isOpActive,
                operationTitle: currentOperation?.title,
                commander: currentOperation?.commander,
              });
            }}
            className="flex items-center gap-1 px-2 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer border border-indigo-500/40 font-mono"
            title="Navigation zur Einsatzzentrale öffnen"
          >
            <Compass className="w-3.5 h-3.5 text-indigo-400" />
            <span>EZ</span>
          </button>

          <button
            onClick={() => setIsWeatherModalOpenMobile(true)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer font-mono ${
              isWeatherModalOpenMobile
                ? 'bg-amber-600 text-white'
                : 'bg-amber-600/30 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40'
            }`}
            title="Lokale Einsatz-Wetterdaten anzeigen"
          >
            <CloudSun className="w-3.5 h-3.5 text-amber-400" />
            <span>Wetter</span>
          </button>

          <button
            onClick={() => setIsLayersOpenMobile(true)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer font-mono ${
              isLayersOpenMobile
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
            }`}
            title="Kartenebenen konfigurieren"
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Ebenen</span>
          </button>
        </div>
      </div>

      {/* MOBILE LAYERS MODAL SHEET (Clean drawer that doesn't permanently block map) */}
      {isLayersOpenMobile && (
        <div
          className="md:hidden fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsLayersOpenMobile(false);
          }}
        >
          <div className="bg-[#1E293B] border border-slate-700 rounded-2xl p-4 w-full max-w-sm shadow-2xl space-y-3.5 text-slate-200 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
              <span className="flex items-center gap-2 font-bold text-white text-xs uppercase tracking-wider font-mono">
                <Layers className="w-4 h-4 text-blue-400" />
                Lagekarten-Ebenen & Ansicht
              </span>
              <button
                onClick={() => setIsLayersOpenMobile(false)}
                className="h-7 w-7 rounded-lg bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center text-xs border border-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowSectors((v) => !v)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition text-left cursor-pointer font-semibold text-xs ${
                  showSectors ? 'bg-blue-500/20 text-blue-300 border border-blue-400' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700'
                }`}
              >
                <span>Sektoren ({currentOperation?.sectors.length || 0})</span>
                {showSectors ? <Eye className="w-3.5 h-3.5 text-blue-400" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setShowTracks((v) => !v)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition text-left cursor-pointer font-semibold text-xs ${
                  showTracks ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700'
                }`}
              >
                <span>Suchspuren</span>
                {showTracks ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setShowResponders((v) => !v)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition text-left cursor-pointer font-semibold text-xs ${
                  showResponders ? 'bg-orange-500/20 text-orange-300 border border-orange-400' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700'
                }`}
              >
                <span>Sucher ({Object.keys(userLocations).length})</span>
                {showResponders ? <Eye className="w-3.5 h-3.5 text-orange-400" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setShowFindings((v) => !v)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition text-left cursor-pointer font-semibold text-xs ${
                  showFindings ? 'bg-red-500/20 text-red-300 border border-red-400' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700'
                }`}
              >
                <span>Funde ({currentOperation?.findings.filter((f) => showFalseAlarms || f.status !== 'false_alarm').length || 0})</span>
                {showFindings ? <Eye className="w-3.5 h-3.5 text-red-400" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* False alarm toggle */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">Fehlalarme archiviert</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {showFalseAlarms ? 'Fehlalarme werden auf Karte angezeigt' : 'Auf der Einsatzkarte ausgeblendet'}
                </div>
              </div>
              <button
                onClick={() => setShowFalseAlarms((v) => !v)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold font-mono transition cursor-pointer ${
                  showFalseAlarms
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
              >
                {showFalseAlarms ? 'Sichtbar' : 'Ausgeblendet'}
              </button>
            </div>

            {/* Inactive responders toggle */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">Abgemeldete Kräfte</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {showInactiveResponders ? 'Werden ausgegraut auf Karte angezeigt' : 'Ausgeblendet (Nur aktive & eingeloggte Kräfte)'}
                </div>
              </div>
              <button
                onClick={() => setShowInactiveResponders((v) => !v)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold font-mono transition cursor-pointer ${
                  showInactiveResponders
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
              >
                {showInactiveResponders ? 'Sichtbar' : 'Ausgeblendet'}
              </button>
            </div>

            {/* Weather overlay toggle */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <CloudSun className="w-3.5 h-3.5 text-amber-400" />
                  Einsatzort-Wetter & Impact
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {showWeatherOverlay ? 'Wetter-Widget & Spurlagen-Analyse aktiv' : 'Ausgeblendet'}
                </div>
              </div>
              <button
                onClick={() => setShowWeatherOverlay((v) => !v)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold font-mono transition cursor-pointer ${
                  showWeatherOverlay
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
              >
                {showWeatherOverlay ? 'Sichtbar' : 'Ausgeblendet'}
              </button>
            </div>

            {/* Base Map selection */}
            <div className="pt-2 border-t border-slate-700 space-y-1.5">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">KARTEN-BASIS:</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'osm', label: '🗺️ Standard OSM' },
                  { id: 'topo', label: '🏔️ Topografie (Höhenlinien)' },
                  { id: 'hybrid', label: '🛰️ Satellit Hybrid' },
                  { id: 'satellite', label: '📡 Satellit Foto' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveBaseMap(item.id as any)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition cursor-pointer ${
                      activeBaseMap === item.id
                        ? 'bg-blue-600 text-white font-bold shadow'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Suchspuren-Legende Mobile */}
            {trackSummaries.length > 0 && (
              <div className="pt-2 border-t border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400">
                  <span>🗺️ SUCHSPUREN ({trackSummaries.length}):</span>
                  <span className="text-emerald-400 font-bold">
                    {(trackSummaries.reduce((sum, t) => sum + t.distanceMeters, 0) / 1000).toFixed(1)} km
                  </span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {trackSummaries.map((item) => (
                    <div
                      key={item.userId}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-white/80"
                          style={{ backgroundColor: item.color }}
                        />
                        <div className="truncate text-[11px]">
                          <span className="font-bold text-white">{item.name}</span>
                          <span className="text-slate-400 font-mono ml-1">({item.callSign})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                        <span className="text-white font-bold">
                          {item.distanceMeters >= 1000 ? `${(item.distanceMeters / 1000).toFixed(1)} km` : `${Math.round(item.distanceMeters)} m`}
                        </span>
                        <button
                          onClick={() => {
                            zoomToTrack(item.boundsPoints);
                            setIsLayersOpenMobile(false);
                          }}
                          className="px-1.5 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-[9px] cursor-pointer"
                          title="Fokus auf Spur"
                        >
                          🔍
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setIsLayersOpenMobile(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl uppercase tracking-wider font-mono cursor-pointer transition shadow"
            >
              Fertig & Zurück zur Karte
            </button>
          </div>
        </div>
      )}

      {/* DESKTOP / TABLET COLLAPSED TOGGLE */}
      {isDesktopSidebarCollapsed && (
        <div className="hidden md:flex absolute top-4 left-4 z-[900]">
          <button
            onClick={() => setIsDesktopSidebarCollapsed(false)}
            className="flex items-center gap-2 px-3 py-2 bg-[#1E293B]/95 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl shadow-xl backdrop-blur-md text-xs font-bold transition cursor-pointer font-mono group"
            title="Lagekarten-Tools und Ebenen einblenden"
          >
            <Layers className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
            <span>Kartentools</span>
            <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">▶</span>
          </button>
        </div>
      )}

      {/* DESKTOP / TABLET FLOATING TACTICAL SIDEBAR */}
      {!isDesktopSidebarCollapsed && (
        <div
          ref={sidebarDragRef}
          style={sidebarPos ? { position: 'fixed', left: `${sidebarPos.x}px`, top: `${sidebarPos.y}px`, zIndex: 950 } : undefined}
          className={`hidden md:flex ${sidebarPos ? '' : 'absolute top-4 left-4 z-[900]'} flex-col gap-2 max-w-[290px] w-[290px] max-h-[calc(100vh-140px)] overflow-y-auto pr-1 select-none scrollbar-thin transition-all ${isSidebarDragging ? 'shadow-2xl shadow-blue-500/20 scale-[1.01]' : ''}`}
        >
          {/* Header Tab Bar */}
          <div
            {...sidebarDragProps}
            className="bg-[#1E293B]/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-700 shadow-xl flex items-center justify-between text-xs font-mono touch-none cursor-grab active:cursor-grabbing"
          >
            <div className="p-1 text-slate-400 hover:text-white shrink-0" title="Sidebar verschieben (Ziehen)">
              <GripVertical className="w-3.5 h-3.5" />
            </div>
            <div className="flex gap-1 flex-1 min-w-0">
              <button
                onClick={() => setDesktopSidebarTab('layers')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  desktopSidebarTab === 'layers'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Kartenebenen & Stile"
              >
                <Layers className="w-3.5 h-3.5" />
                Ebenen
              </button>
              <button
                onClick={() => setDesktopSidebarTab('tracks')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  desktopSidebarTab === 'tracks'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Suchspuren-Legende & Kräfte"
              >
                <span>🗺️</span>
                Spuren {trackSummaries.length > 0 && `(${trackSummaries.length})`}
              </button>
              <button
                onClick={() => setDesktopSidebarTab('actions')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  desktopSidebarTab === 'actions'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Aktionen & GPS-Fokus"
              >
                <Navigation className="w-3.5 h-3.5" />
                Aktionen
              </button>
            </div>
            <button
              onClick={() => setIsDesktopSidebarCollapsed(true)}
              className="text-slate-400 hover:text-white px-2 py-1 rounded text-[11px] bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer ml-1"
              title="Sidebar minimieren"
            >
              ◀
            </button>
          </div>

          {/* TAB 1: LAYERS */}
          {desktopSidebarTab === 'layers' && (
            <div className="bg-[#1E293B]/95 backdrop-blur-md p-3 rounded-xl border border-slate-700 shadow-xl flex flex-col gap-2.5 text-xs text-slate-300">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setShowSectors((v) => !v)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition text-left cursor-pointer font-medium text-[11px] ${
                    showSectors ? 'bg-blue-500/20 text-blue-300 border border-blue-400' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700'
                  }`}
                >
                  {showSectors ? <Eye className="w-3 h-3 text-blue-400" /> : <EyeOff className="w-3 h-3" />}
                  Sektoren ({currentOperation?.sectors.length || 0})
                </button>

                <button
                  onClick={() => setShowTracks((v) => !v)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition text-left cursor-pointer font-medium text-[11px] ${
                    showTracks ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700'
                  }`}
                >
                  {showTracks ? <Eye className="w-3 h-3 text-emerald-400" /> : <EyeOff className="w-3 h-3" />}
                  Suchspuren
                </button>

                <button
                  onClick={() => setShowResponders((v) => !v)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition text-left cursor-pointer font-medium text-[11px] ${
                    showResponders ? 'bg-orange-500/20 text-orange-300 border border-orange-400' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700'
                  }`}
                >
                  {showResponders ? <Eye className="w-3 h-3 text-orange-400" /> : <EyeOff className="w-3 h-3" />}
                  Units ({Object.keys(userLocations).length})
                </button>

                <button
                  onClick={() => setShowFindings((v) => !v)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition text-left cursor-pointer font-medium text-[11px] ${
                    showFindings ? 'bg-red-500/20 text-red-300 border border-red-400' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700'
                  }`}
                >
                  {showFindings ? <Eye className="w-3 h-3 text-red-400" /> : <EyeOff className="w-3 h-3" />}
                  Funde ({currentOperation?.findings.filter((f) => showFalseAlarms || f.status !== 'false_alarm').length || 0})
                </button>
              </div>

              {/* Toggle to view false alarms */}
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-700/80">
                <span className="text-slate-400 font-mono text-[10px]">Fehlalarme:</span>
                <button
                  onClick={() => setShowFalseAlarms((v) => !v)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition cursor-pointer ${
                    showFalseAlarms ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                  }`}
                >
                  {showFalseAlarms ? '✓ Eingeblendet' : 'Ausgeblendet'}
                </button>
              </div>

              {/* Toggle to view inactive responders */}
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-700/80">
                <span className="text-slate-400 font-mono text-[10px]">Abgemeldete Kräfte:</span>
                <button
                  onClick={() => setShowInactiveResponders((v) => !v)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition cursor-pointer ${
                    showInactiveResponders ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                  }`}
                >
                  {showInactiveResponders ? '✓ Sichtbar' : 'Ausgeblendet'}
                </button>
              </div>

              {/* Toggle to view weather overlay */}
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-700/80">
                <span className="text-slate-400 font-mono text-[10px] flex items-center gap-1">
                  <CloudSun className="w-3 h-3 text-amber-400" />
                  Einsatz-Wetter:
                </span>
                <button
                  onClick={() => setShowWeatherOverlay((v) => !v)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition cursor-pointer ${
                    showWeatherOverlay ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                  }`}
                >
                  {showWeatherOverlay ? '✓ Eingeblendet' : 'Ausgeblendet'}
                </button>
              </div>

              <div className="pt-2 border-t border-slate-700 flex flex-col gap-1.5">
                <span className="text-[10px] text-slate-400 uppercase font-mono">KARTENSTIL:</span>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { id: 'osm', label: 'OSM' },
                    { id: 'topo', label: 'Topo' },
                    { id: 'hybrid', label: 'Hybrid' },
                    { id: 'satellite', label: 'Satellit' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveBaseMap(item.id as any)}
                      className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition cursor-pointer text-center ${
                        activeBaseMap === item.id
                          ? 'bg-blue-600 text-white font-bold shadow'
                          : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SUCHSPUREN / TRACKS LEGENDE */}
          {desktopSidebarTab === 'tracks' && (
            <div className="bg-[#1E293B]/95 backdrop-blur-md p-3 rounded-xl border border-slate-700 shadow-xl flex flex-col gap-2.5 text-xs text-slate-300">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-700">
                <div className="flex items-center gap-1.5 font-bold text-white text-[11px] uppercase tracking-wider font-mono">
                  <span>🗺️</span>
                  <span>Suchspuren ({trackSummaries.length})</span>
                </div>
                <button
                  onClick={() => setShowTracks((v) => !v)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition cursor-pointer ${
                    showTracks
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                  title={showTracks ? 'Suchspuren auf Karte ausblenden' : 'Suchspuren einblenden'}
                >
                  {showTracks ? '✓ Sichtbar' : 'Aus'}
                </button>
              </div>

              {trackSummaries.length === 0 ? (
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg text-center text-slate-400 text-[11px] font-mono leading-relaxed">
                  Noch keine Suchspuren aufgezeichnet. Einsatzkräfte mit Status Grün zeichnen automatisch ihre Wege auf.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-0.5 scrollbar-thin">
                  {trackSummaries.map((item) => {
                    const distKm = (item.distanceMeters / 1000).toFixed(2);
                    const distLabel = item.distanceMeters >= 1000 ? `${distKm} km` : `${Math.round(item.distanceMeters)} m`;

                    return (
                      <div
                        key={item.userId}
                        className="bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700/80 rounded-lg p-2 transition flex flex-col gap-1.5 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            {/* Distinct color swatch */}
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0 border-2 border-white/80 shadow"
                              style={{ backgroundColor: item.color }}
                              title={`Spurfarbe: ${item.color}`}
                            />
                            <div className="min-w-0">
                              <div className="font-bold text-white text-xs truncate flex items-center gap-1">
                                <span>{item.equipmentIcon}</span>
                                <span className="truncate">{item.name}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">
                                {item.callSign}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 border ${
                              item.isLive
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            }`}
                          >
                            {item.isLive ? '🟢 Live' : '📁 Phase 1'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] font-mono">
                          <div className="text-slate-300">
                            <span className="font-bold text-white">{distLabel}</span>
                            <span className="text-slate-400"> ({item.pointCount} Pkt.)</span>
                          </div>
                          <button
                            onClick={() => zoomToTrack(item.boundsPoints)}
                            className="px-2 py-0.5 bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white rounded text-[10px] font-bold font-mono transition cursor-pointer border border-blue-500/40 flex items-center gap-1"
                            title="Auf diese Suchspur zentrieren"
                          >
                            <span>🔍 Fokus</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Total distance footer */}
              {trackSummaries.length > 0 && (
                <div className="pt-2 border-t border-slate-700 flex items-center justify-between font-mono text-[10px]">
                  <span className="text-slate-400">Gesamte Suchstrecke:</span>
                  <span className="font-bold text-emerald-400 text-[11px]">
                    {(trackSummaries.reduce((sum, t) => sum + t.distanceMeters, 0) / 1000).toFixed(2)} km
                  </span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ACTIONS */}
          {desktopSidebarTab === 'actions' && (
            <div className="bg-[#1E293B]/95 backdrop-blur-md p-3 rounded-xl border border-slate-700 shadow-xl flex flex-col gap-2 text-xs text-slate-300">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={handleCenterOnMe}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer font-mono"
                  title="Auf meinen Standort zentrieren"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Mein GPS
                </button>
                <button
                  onClick={captureMapSnapshot}
                  disabled={isCapturingSnapshot}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer font-mono disabled:opacity-50"
                  title="Lagekarten-Snapshot für Einsatzbericht / Protokoll erfassen"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {isCapturingSnapshot ? 'Erfasse...' : 'Snapshot'}
                </button>

                <button
                  onClick={() => {
                    const hq = (currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused')) && currentOperation.headquartersLocation
                      ? currentOperation.headquartersLocation
                      : VEREINSBUERO_LOCATION;
                    if (mapInstanceRef.current && hq.lat && hq.lng) {
                      mapInstanceRef.current.setView([hq.lat, hq.lng], 16);
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer font-mono"
                  title="Auf Einsatzzentrale (EZ) zentrieren"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  EZ Fokus
                </button>
                <button
                  onClick={() => {
                    const isOpActive = currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused');
                    const hq = isOpActive && currentOperation.headquartersLocation?.lat && currentOperation.headquartersLocation?.lng
                      ? currentOperation.headquartersLocation
                      : VEREINSBUERO_LOCATION;
                    setEzNavData({
                      lat: hq.lat,
                      lng: hq.lng,
                      address: hq.address || (isOpActive ? 'EZ vor Ort' : VEREINSBUERO_LOCATION.address),
                      title: '📡 EZ',
                      isStandbyOffice: !isOpActive,
                      operationTitle: currentOperation?.title,
                      commander: currentOperation?.commander,
                    });
                  }}
                  className="col-span-2 flex items-center justify-center gap-1.5 px-2.5 py-2 bg-indigo-950/70 hover:bg-indigo-900 text-indigo-200 text-xs font-bold rounded-lg border border-indigo-700/80 transition cursor-pointer font-mono"
                  title="Navigation zur Einsatzzentrale öffnen"
                >
                  <Compass className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Navi zur EZ (Koordinatenübermittlung)</span>
                </button>
              </div>

              {isAdminOrEL && !isDrawingSector && (
                <div className="pt-2 border-t border-slate-700 flex gap-1.5">
                  {onStartFreehandDrawing && (
                    <button
                      onClick={() => onStartFreehandDrawing()}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow transition cursor-pointer font-mono"
                      title="Freihand-Suchsektor einzeichnen"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      Zeichnen 🖊️
                    </button>
                  )}
                  {onOpenSectorEditor && (
                    <button
                      onClick={() => onOpenSectorEditor()}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition cursor-pointer font-mono"
                      title="Sektor per Dialog erstellen"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Sektor +
                    </button>
                  )}
                </div>
              )}

              {/* Direct focus jump buttons for active responders */}
              <div className="pt-2 border-t border-slate-700">
                <span className="text-[10px] text-slate-400 font-mono block mb-1.5 uppercase font-bold">SCHNELLSPRUNG KRÄFTE:</span>
                <div className="flex flex-wrap gap-1">
                  {allUsers
                    .filter((u) => u.isActive)
                    .map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          const loc = userLocations[u.id]?.currentPosition;
                          if (loc && mapInstanceRef.current) {
                            mapInstanceRef.current.flyTo([loc.lat, loc.lng], 16, { duration: 1.2 });
                          }
                        }}
                        className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] font-semibold rounded-lg border border-slate-700 transition cursor-pointer font-mono"
                        title={`Fokus auf ${u.name} (${u.callSign})`}
                      >
                        <MapPin className="w-3 h-3 text-emerald-400" />
                        {u.callSign}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Sector Details Card (When a sector is clicked) */}
      {selectedSector && (
        <div
          ref={sectorCardDragRef}
          style={sectorCardPos ? { position: 'fixed', left: `${sectorCardPos.x}px`, top: `${sectorCardPos.y}px`, zIndex: 1100 } : undefined}
          className={`${sectorCardPos ? '' : 'fixed sm:absolute bottom-20 sm:bottom-24 right-2 sm:right-6 left-2 sm:left-auto z-[1100]'} sm:w-[420px] max-w-[calc(100vw-1rem)] max-h-[min(480px,calc(100vh-120px))] bg-[#1E293B]/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl text-slate-100 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200`}
        >
          <>
            {/* Card Header */}
            <div
              {...sectorCardDragProps}
              className="flex items-center justify-between gap-2 p-3 pb-2.5 border-b border-slate-700 bg-slate-900/80 touch-none cursor-grab active:cursor-grabbing"
            >
              <div className="p-1 text-slate-400 hover:text-white shrink-0" title="Karte verschieben (Ziehen)">
                <GripVertical className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {selectedSector.status === 'searched' ? '✅' : selectedSector.status === 'in_progress' ? '⏳' : '🎯'}
                  </span>
                  <h3 className="font-bold text-sm text-slate-100 truncate">{selectedSector.name}</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Fläche: ca. {selectedSector.areaHectares || 25} ha • Priorität: {selectedSector.priority.toUpperCase()}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setSelectedSector(null)}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer"
                  title="Schließen"
                >
                  ✕
                </button>
              </div>
            </div>

              {/* Scrollable Body */}
              <div className="p-3.5 space-y-2.5 text-xs max-h-[min(380px,calc(100vh-280px))] overflow-y-auto scrollbar-thin">
                {/* Status indicator */}
                <div className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/80">
                  <span className="text-slate-400 font-mono text-[11px]">STATUS:</span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px] ${
                      selectedSector.status === 'searched'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500'
                        : selectedSector.status === 'in_progress'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500'
                    }`}
                  >
                    {selectedSector.status === 'searched'
                      ? '✅ ABGESUCHT (Grün)'
                      : selectedSector.status === 'in_progress'
                      ? '⏳ In Suche'
                      : 'Offen'}
                  </span>
                </div>

                {selectedSector.notes && (
                  <div className="bg-slate-900/50 p-2.5 rounded-lg text-slate-300 italic border border-slate-700/50">
                    "{selectedSector.notes}"
                  </div>
                )}

                {/* Assigned Responders */}
                <div>
                  <span className="font-semibold text-slate-400 block mb-1 font-mono text-[10px] uppercase">Zugewiesene Einheiten:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSector.assignedUserIds && selectedSector.assignedUserIds.length > 0 ? (
                      allUsers
                        .filter((u) => selectedSector.assignedUserIds.includes(u.id))
                        .map((u) => {
                          const badge = getEquipmentBadge(u.equipment);
                          return (
                            <span
                              key={u.id}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-mono"
                            >
                              <span>{badge.icon}</span>
                              <span className="font-bold">{u.callSign}</span>
                            </span>
                          );
                        })
                    ) : (
                      <span className="text-slate-500 italic text-[11px]">Noch keine Einheiten zugeteilt</span>
                    )}
                  </div>
                </div>

                {/* Clear Status Details */}
                {selectedSector.clearedAt && (
                  <div className="text-[11px] text-emerald-400 bg-emerald-950/30 p-2 rounded-lg border border-emerald-900/50 font-mono">
                    Freigegeben am: {new Date(selectedSector.clearedAt).toLocaleTimeString()} von {selectedSector.clearedBy || 'Sucher'}
                  </div>
                )}
              </div>

              {/* Sticky Action Footer */}
              <div className="p-3 border-t border-slate-700 bg-[#1E293B] flex gap-2 shrink-0 shadow-lg">
                <button
                  onClick={() => {
                    const nextStatus: SectorStatus = selectedSector.status === 'searched' ? 'in_progress' : 'searched';
                    setSectorStatus(selectedSector.id, nextStatus);
                    setSelectedSector({ ...selectedSector, status: nextStatus });
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow ${
                    selectedSector.status === 'searched'
                      ? 'bg-amber-600 hover:bg-amber-500 text-slate-950'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {selectedSector.status === 'searched' ? 'Status zurücksetzen' : 'Als abgesucht markieren (Grün)'}
                </button>

                {isAdminOrEL && onOpenSectorEditor && (
                  <button
                    onClick={() => {
                      onOpenSectorEditor(selectedSector);
                      setSelectedSector(null);
                    }}
                    className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold cursor-pointer border border-slate-600 font-mono"
                  >
                    Edit
                  </button>
                )}

                {isAdminOrEL && (
                  <button
                    onClick={() => {
                      if (window.confirm(`🚨 Sektor "${selectedSector.name}" wirklich endgültig löschen?`)) {
                        deleteSector(selectedSector.id);
                        setSelectedSector(null);
                      }
                    }}
                    className="px-3 py-2.5 bg-red-950/80 hover:bg-red-900 text-red-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer border border-red-800/80 font-mono transition"
                    title="Sektor löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </>
        </div>
      )}

      {/* Floating Tactical User / Responder Card (When a responder pin is clicked) */}
      {selectedUser && (
        <div
          ref={userCardDragRef}
          style={userCardPos ? { position: 'fixed', left: `${userCardPos.x}px`, top: `${userCardPos.y}px`, zIndex: 1100 } : undefined}
          className={`${userCardPos ? '' : 'fixed sm:absolute bottom-20 sm:bottom-24 right-2 sm:right-6 left-2 sm:left-auto z-[1100]'} sm:w-[420px] max-w-[calc(100vw-1rem)] max-h-[min(480px,calc(100vh-120px))] bg-[#1E293B]/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl text-slate-100 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200`}
        >
          <>
            {/* Card Header */}
            <div
              {...userCardDragProps}
              className="flex items-center justify-between gap-3 p-3 pb-2.5 border-b border-slate-700 bg-slate-900/80 touch-none cursor-grab active:cursor-grabbing"
            >
              <div className="p-1 text-slate-400 hover:text-white shrink-0" title="Karte verschieben (Ziehen)">
                <GripVertical className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-blue-500 shadow-md bg-slate-800 flex items-center justify-center shrink-0">
                  {selectedUser.photoUrl ? (
                    <img src={selectedUser.photoUrl} alt={selectedUser.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-bold text-base text-white uppercase">{selectedUser.name.charAt(0)}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-white truncate">{selectedUser.name}</h3>
                  <div className="text-xs text-blue-400 font-mono font-bold">{selectedUser.callSign}</div>
                  <div className="text-[10px] text-slate-400 truncate">{selectedUser.organization || 'Einsatzkraft'}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer"
                  title="Schließen"
                >
                  ✕
                </button>
              </div>
            </div>

              {/* Scrollable Body */}
              <div className="p-3.5 space-y-2.5 text-xs max-h-[min(380px,calc(100vh-280px))] overflow-y-auto scrollbar-thin">
                <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/80">
                  <div>
                    <span className="text-slate-400 text-[10px] block font-mono">KFZ-KENNZEICHEN</span>
                    <span className="font-mono font-bold text-slate-200 text-xs">
                      {selectedUser.licensePlate || 'Nicht angegeben'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block font-mono">AKKUSTAND</span>
                    <span className="font-bold text-emerald-400 text-xs">
                      🔋 {selectedUser.batteryLevel ?? 100}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block font-mono">AKTUELLER SEKTOR</span>
                    <span className="font-semibold text-amber-400 text-xs truncate block">
                      {currentOperation?.sectors.find((s) => s.id === selectedUser.assignedSectorId || s.assignedUserIds?.includes(selectedUser.id))?.name
                        ? `🎯 ${currentOperation?.sectors.find((s) => s.id === selectedUser.assignedSectorId || s.assignedUserIds?.includes(selectedUser.id))?.name}`
                        : 'Kein Sektor'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block font-mono">LETZTER GPS-PING</span>
                    <span className="text-slate-300 text-xs font-mono">
                      {userLocations[selectedUser.id]?.lastUpdated
                        ? new Date(userLocations[selectedUser.id].lastUpdated).toLocaleTimeString()
                        : 'Online'}
                    </span>
                  </div>
                </div>

                {selectedUser.customEquipmentNotes && (
                  <div className="bg-slate-900/50 p-2.5 rounded-xl text-slate-300 border border-slate-700/50">
                    <span className="font-semibold text-slate-400 block text-[10px] font-mono">SPEZIAL-AUSRÜSTUNG / HILFSMITTEL:</span>
                    {selectedUser.customEquipmentNotes}
                  </div>
                )}

                {/* Quick Switcher for other responders at the same gathering point */}
                {nearbyResponders.length > 0 && (
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-blue-500/40 shadow-inner">
                    <span className="text-blue-300 text-[10px] block font-mono font-bold mb-1.5 flex items-center justify-between">
                      <span>👥 WEITERE KRÄFTE AN DIESEM STANDORT ({nearbyResponders.length})</span>
                      <span className="text-[9px] text-slate-400 font-normal">Auswählen</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {nearbyResponders.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            setSelectedUser(u);
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-blue-900/60 hover:border-blue-400 text-slate-200 border border-slate-700 rounded-lg text-[10px] font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: u.isActive ? '#10b981' : '#64748b' }}></span>
                          <span className="text-white">{u.callSign}</span>
                          <span className="text-slate-400 text-[9px]">({u.name})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sticky Action Footer */}
              <div className="p-3 border-t border-slate-700 bg-[#1E293B] flex gap-2 shrink-0 shadow-lg">
                {selectedUser.phone && (
                  <a
                    href={`tel:${selectedUser.phone}`}
                    className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-700"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    Anrufen
                  </a>
                )}
                {onOpenDirectChat && (
                  <button
                    onClick={() => {
                      onOpenDirectChat(selectedUser);
                      setSelectedUser(null);
                    }}
                    className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Direktfunk
                  </button>
                )}
              </div>
            </>
        </div>
      )}

      {/* EZ COORDINATES & NAVIGATION MODAL (Interactive Intent to Navigation Apps) */}
      {ezNavData && (
        <div
          className="fixed inset-0 z-[5000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 font-sans"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEzNavData(null);
          }}
        >
          <div className="bg-[#1E293B] border border-indigo-500/50 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col text-slate-100 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-950/90 via-slate-900 to-indigo-950/90 border-b border-indigo-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/50 text-indigo-300 flex items-center justify-center text-xl shrink-0 shadow-inner">
                  🧭
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm sm:text-base uppercase tracking-wide truncate">
                      Navigation zur Einsatzzentrale
                    </h3>
                  </div>
                  <div className="text-[11px] text-indigo-300 font-mono flex items-center gap-1.5 truncate">
                    <span>{ezNavData.isStandbyOffice ? '📡 Vereinsbüro Aschersleben (Bereitschaft)' : '🚨 Einsatz-EZ vor Ort'}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setEzNavData(null)}
                className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer border border-slate-700 shrink-0"
                title="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
              {/* Target Location Card */}
              <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-slate-400">
                    Zielort & Adresse
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    ezNavData.isStandbyOffice
                      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-600/50'
                      : 'bg-indigo-950/70 text-indigo-300 border-indigo-500/50'
                  }`}>
                    {ezNavData.isStandbyOffice ? 'Standard-Büro' : 'Einsatz-Standort'}
                  </span>
                </div>

                <div className="font-bold text-sm sm:text-base text-white leading-snug">
                  {ezNavData.address}
                </div>

                {ezNavData.operationTitle && !ezNavData.isStandbyOffice && (
                  <div className="text-[11px] text-slate-300 bg-slate-800/60 p-2 rounded-lg border border-slate-700/60">
                    Einsatz: <strong className="text-white">{ezNavData.operationTitle}</strong>
                    {ezNavData.commander && <> • Leitung: <strong className="text-white">{ezNavData.commander}</strong></>}
                  </div>
                )}

                {/* GPS Coordinates & Live Distance */}
                <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block text-[9px]">GPS-KOORDINATEN</span>
                      <span className="text-slate-200 font-bold">
                        {ezNavData.lat.toFixed(6)}, {ezNavData.lng.toFixed(6)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopyCoordinates(ezNavData.lat, ezNavData.lng)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition cursor-pointer text-[10px] flex items-center gap-1 shrink-0"
                      title="Koordinaten in Zwischenablage kopieren"
                    >
                      {copiedCoords ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Kopiert</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Kopieren</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[9px]">ENTFERNUNG (MEIN STANDORT)</span>
                    {myLocation ? (
                      (() => {
                        const R = 6371e3;
                        const φ1 = (myLocation.lat * Math.PI) / 180;
                        const φ2 = (ezNavData.lat * Math.PI) / 180;
                        const Δφ = ((ezNavData.lat - myLocation.lat) * Math.PI) / 180;
                        const Δλ = ((ezNavData.lng - myLocation.lng) * Math.PI) / 180;
                        const a =
                          Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                          Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        const d = R * c;
                        const dText = d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`;
                        const isReached = d <= 500;
                        return (
                          <div className="flex items-center gap-1.5">
                            <span className="text-white font-bold">{dText}</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                              isReached ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-600' : 'bg-blue-900/60 text-blue-300 border border-blue-600'
                            }`}>
                              {isReached ? '✅ EZ erreicht' : '🚗 In Anfahrt'}
                            </span>
                          </div>
                        );
                      })()
                    ) : (
                      <span className="text-slate-400">GPS nicht aktiv</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Primary Action Button (Universal Mobile / OS Navi Launch) */}
              <div>
                <button
                  onClick={() => handleOpenNavigation(ezNavData.lat, ezNavData.lng, ezNavData.title)}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl transition cursor-pointer flex items-center justify-center gap-2 border border-blue-400/50 uppercase tracking-wide font-mono"
                >
                  <span>🚗</span>
                  <span>In Standard-Navi-App öffnen</span>
                  <ExternalLink className="w-4 h-4 ml-1" />
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-1 font-mono">
                  Startet automatisch Ihre Standard-Navigations-App (Google Maps, Apple Maps, Waze etc.)
                </p>
              </div>

              {/* Dedicated App Shortcuts */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">
                  Oder App direkt auswählen:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${ezNavData.lat},${ezNavData.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500/60 transition cursor-pointer text-slate-200 hover:text-white flex items-center gap-2 text-xs font-mono font-bold no-underline"
                  >
                    <span className="text-lg">🗺️</span>
                    <div>
                      <div>Google Maps</div>
                      <div className="text-[9px] text-slate-400 font-normal">Route starten</div>
                    </div>
                  </a>

                  <a
                    href={`https://maps.apple.com/?daddr=${ezNavData.lat},${ezNavData.lng}&q=${encodeURIComponent(ezNavData.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500/60 transition cursor-pointer text-slate-200 hover:text-white flex items-center gap-2 text-xs font-mono font-bold no-underline"
                  >
                    <span className="text-lg">🍏</span>
                    <div>
                      <div>Apple Maps</div>
                      <div className="text-[9px] text-slate-400 font-normal">Karten-App</div>
                    </div>
                  </a>

                  <a
                    href={`https://waze.com/ul?ll=${ezNavData.lat},${ezNavData.lng}&navigate=yes`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500/60 transition cursor-pointer text-slate-200 hover:text-white flex items-center gap-2 text-xs font-mono font-bold no-underline"
                  >
                    <span className="text-lg">🚙</span>
                    <div>
                      <div>Waze</div>
                      <div className="text-[9px] text-slate-400 font-normal">Echtzeit-Verkehr</div>
                    </div>
                  </a>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 bg-slate-900/80 border-t border-slate-700/80 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  if (mapInstanceRef.current && ezNavData) {
                    mapInstanceRef.current.setView([ezNavData.lat, ezNavData.lng], 16);
                    setEzNavData(null);
                  }
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-mono font-semibold transition cursor-pointer border border-slate-700 flex items-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                <span>Auf Karte zentrieren</span>
              </button>

              <button
                onClick={() => setEzNavData(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-bold transition cursor-pointer border border-slate-700 uppercase"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DESKTOP / TABLET FLOATING WEATHER OVERLAY (Top-Right of Map, Draggable) */}
      {showWeatherOverlay && (
        <div
          ref={weatherDragRef}
          {...weatherDragProps}
          style={weatherPos ? { position: 'fixed', left: `${weatherPos.x}px`, top: `${weatherPos.y}px`, zIndex: 900 } : undefined}
          className={`hidden md:block ${weatherPos ? '' : 'absolute top-14 right-4 z-[900]'} w-[340px] max-w-[calc(100vw-1rem)] animate-in fade-in slide-in-from-top-2 duration-200 touch-none cursor-grab active:cursor-grabbing`}
        >
          <div className="relative group">
            <div
              className="absolute top-2 left-2 z-[950] p-1 rounded-md bg-slate-900/80 text-slate-400 hover:text-white border border-slate-700"
              title="Wetter-Widget verschieben (Ziehen)"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>
            <TacticalWeatherOverlay
              lat={weatherTarget.lat}
              lng={weatherTarget.lng}
              locationTitle={weatherTarget.title}
              onClose={() => setShowWeatherOverlay(false)}
            />
          </div>
        </div>
      )}

      {/* MOBILE WEATHER MODAL SHEET (On-demand view on smartphones) */}
      {isWeatherModalOpenMobile && (
        <div
          className="md:hidden fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsWeatherModalOpenMobile(false);
          }}
        >
          <div className="w-full max-w-sm animate-in slide-in-from-bottom duration-200">
            <TacticalWeatherOverlay
              lat={weatherTarget.lat}
              lng={weatherTarget.lng}
              locationTitle={weatherTarget.title}
              onClose={() => setIsWeatherModalOpenMobile(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
