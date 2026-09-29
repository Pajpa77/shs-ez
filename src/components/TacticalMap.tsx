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
  OperationLogEntry,
  isUserAdminOrEL,
  TrackSummaryItem,
} from '../types';
import { VEREINSBUERO_LOCATION, saveSavedVereinsbueroLocation, getSavedVereinsbueroLocation } from '../mockData';
import { computeTrackSummaries } from '../lib/trackHelper';
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
  Pause,
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
  Save,
  Building2,
  Search,
  FileUp,
  WifiOff,
} from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';
import { GeoImportModal } from './GeoImportModal';
import { OfflineMapModal } from './OfflineMapModal';
import { ImportedTrack, ImportedWaypoint } from '../lib/geoImport';

function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeImageUrl(url: unknown): string {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('data:image/')) {
    return escapeHtml(trimmed);
  }
  return '';
}

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
    updateOperation,
    playAlertSound,
    addMultipleSectors,
    reportFinding,
    showConfirmModal,
    operationalRole,
    toggleOperationalRole,
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
  const [isGeoImportOpen, setIsGeoImportOpen] = useState(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [externalImportedTracks, setExternalImportedTracks] = useState<ImportedTrack[]>([]);
  const [isMobileScreen, setIsMobileScreen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || window.innerHeight <= 500;
  });
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || window.innerHeight <= 500;
  });
  const [desktopSidebarTab, setDesktopSidebarTab] = useState<'layers' | 'tracks' | 'actions'>('layers');
  const [isTrackLegendExpanded, setIsTrackLegendExpanded] = useState(false);

  // Handle device orientation changes and responsive resizing for smartphone view (hoch <-> quer)
  useEffect(() => {
    const handleViewportChange = () => {
      const mobile = window.innerWidth < 768 || window.innerHeight <= 500;
      setIsMobileScreen(mobile);
      if (mobile) {
        setIsDesktopSidebarCollapsed(true);
      }
      setIsLayersOpenMobile(false);
      setIsWeatherModalOpenMobile(false);
      setShowWeatherOverlay(false);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };

    const handleOrientation = () => {
      handleViewportChange();
      setTimeout(handleViewportChange, 80);
      setTimeout(handleViewportChange, 200);
      setTimeout(handleViewportChange, 350);
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleOrientation);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleOrientation);
    };
  }, []);

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
  const isAdminOrEL = Boolean(currentUser && isUserAdminOrEL(currentUser));
  const canManageOps = isAdminOrEL;

  // EZ Navigation Modal state for interactive coordination transfer to GPS/Navi apps
  const [ezNavData, setEzNavData] = useState<{
    lat: number;
    lng: number;
    address: string;
    title: string;
    isStandbyOffice: boolean;
    operationTitle?: string;
    commander?: string;
    ezResponders?: User[];
  } | null>(null);
  const [copiedCoords, setCopiedCoords] = useState(false);

  // EZ Inline Editing & Repositioning on Tactical Map
  const isDrawingSectorRef = useRef(isDrawingSector);
  isDrawingSectorRef.current = isDrawingSector;

  const [isEditingEz, setIsEditingEz] = useState(false);
  const [editEzAddress, setEditEzAddress] = useState('');
  const [editEzLat, setEditEzLat] = useState<number | ''>('');
  const [editEzLng, setEditEzLng] = useState<number | ''>('');
  const [isGeocodingEz, setIsGeocodingEz] = useState(false);
  const [ezGeocodeStatus, setEzGeocodeStatus] = useState<'idle' | 'success' | 'not_found'>('idle');
  const [ezModalSuccess, setEzModalSuccess] = useState('');

  // Mode for placing EZ by tapping the map
  const [isPlacingEzMode, setIsPlacingEzMode] = useState(false);
  const isPlacingEzModeRef = useRef(false);
  isPlacingEzModeRef.current = isPlacingEzMode;

  // Modal for confirming EZ move after Long-Press or Tap
  const [ezMoveModal, setEzMoveModal] = useState<{
    lat: number;
    lng: number;
    address: string;
    description: string;
    isStandby: boolean;
    isLoadingAddress: boolean;
  } | null>(null);

  const [dismissEzWarning, setDismissEzWarning] = useState(false);
  const [ezToastNotice, setEzToastNotice] = useState<string>('');

  // Reverse Geocoding helper via OpenStreetMap Nominatim
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'de' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.address) {
          const a = data.address;
          const street = a.road || a.pedestrian || a.footway || a.path || a.cycleway || '';
          const num = a.house_number || '';
          const city = a.city || a.town || a.village || a.municipality || a.suburb || '';
          const postcode = a.postcode || '';
          const parts = [
            [street, num].filter(Boolean).join(' '),
            [postcode, city].filter(Boolean).join(' ')
          ].filter(Boolean);
          if (parts.length > 0) return parts.join(', ');
        }
        if (data.display_name) {
          return data.display_name.split(',').slice(0, 3).join(', ').trim();
        }
      }
    } catch (e) {
      console.warn('Reverse geocoding failed', e);
    }
    return `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  };

  const geocodeEzAddress = async (query: string) => {
    if (!query.trim()) return;
    setIsGeocodingEz(true);
    setEzGeocodeStatus('idle');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        { headers: { 'Accept-Language': 'de' } }
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        setEditEzLat(Number(Number(item.lat).toFixed(6)));
        setEditEzLng(Number(Number(item.lon).toFixed(6)));
        setEzGeocodeStatus('success');
      } else {
        setEzGeocodeStatus('not_found');
      }
    } catch {
      setEzGeocodeStatus('not_found');
    } finally {
      setIsGeocodingEz(false);
    }
  };

  // Trigger modal when user long-presses anywhere on map or taps in placement mode
  const triggerEzRepositionModal = useCallback(async (lat: number, lng: number) => {
    const isOpActive = Boolean(currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused'));
    const roundedLat = Number(lat.toFixed(6));
    const roundedLng = Number(lng.toFixed(6));

    setEzMoveModal({
      lat: roundedLat,
      lng: roundedLng,
      address: 'Ermittle Adresse...',
      description: isOpActive ? 'EZ vor Ort / Bereitstellungsraum' : 'Vereinshaus Aschersleben',
      isStandby: !isOpActive,
      isLoadingAddress: true,
    });

    playAlertSound('notification');

    const detectedAddress = await reverseGeocode(roundedLat, roundedLng);
    setEzMoveModal((prev) => (prev ? { ...prev, address: detectedAddress, isLoadingAddress: false } : null));
  }, [currentOperation, playAlertSound]);

  const handleConfirmEzMove = (customAddress?: string, customDesc?: string) => {
    if (!ezMoveModal) return;
    const { lat, lng, isStandby } = ezMoveModal;
    const finalAddress = (customAddress !== undefined ? customAddress : ezMoveModal.address).trim() || VEREINSBUERO_LOCATION.address;
    const finalDesc = (customDesc !== undefined ? customDesc : ezMoveModal.description).trim();

    if (isStandby) {
      // Save permanent Vereinsbüro position (Vereinshaus)
      saveSavedVereinsbueroLocation({
        lat,
        lng,
        address: finalAddress,
      });
      if (currentOperation) {
        updateOperation(currentOperation.id, {
          headquartersLocation: {
            lat,
            lng,
            address: finalAddress,
            description: finalDesc || 'Vereinshaus Aschersleben',
          },
        });
      }
      setEzToastNotice(`🏢 Standard-EZ erfolgreich auf Vereinshaus gespeichert (${lat.toFixed(5)}, ${lng.toFixed(5)})!`);
      setTimeout(() => setEzToastNotice(''), 4500);
    } else if (currentOperation) {
      // Active operation HQ move
      const newHq = {
        lat,
        lng,
        address: finalAddress,
        description: finalDesc || 'EZ vor Ort / Bereitstellungsraum',
      };
      const logEntry: OperationLogEntry = {
        id: `log-${Date.now()}`,
        operationId: currentOperation.id,
        timestamp: new Date().toISOString(),
        authorName: currentUser?.name || 'Einsatzleitung',
        authorRole: currentUser?.role || 'admin',
        category: 'general',
        text: `📡 Einsatzzentrale im Gelände/Parkplatz neu positioniert: ${finalAddress} (GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)})`,
      };
      updateOperation(currentOperation.id, (prevOp) => ({
        headquartersLocation: newHq,
        logs: [logEntry, ...(prevOp.logs || [])],
      }));
      setEzToastNotice(`📡 EZ für Einsatz „${currentOperation.title}“ erfolgreich an neuen Standort verlegt!`);
      setTimeout(() => setEzToastNotice(''), 4500);
    }

    playAlertSound('success');
    setEzMoveModal(null);
    setIsPlacingEzMode(false);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], Math.max(16, mapInstanceRef.current.getZoom()));
    }
  };

  const handleSetEzToPls = async (lat: number, lng: number, label: string) => {
    if (!currentOperation) return;
    const detectedAddr = await reverseGeocode(lat, lng);
    const newHq = {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      address: detectedAddr || label || 'Einsatzzentrale am Einsatzort',
      description: `EZ vor Ort (${label})`,
    };
    const logEntry: OperationLogEntry = {
      id: `log-${Date.now()}`,
      operationId: currentOperation.id,
      timestamp: new Date().toISOString(),
      authorName: currentUser?.name || 'Einsatzleitung',
      authorRole: currentUser?.role || 'admin',
      category: 'general',
      text: `📡 EZ-Standort von Aschersleben an den Einsatzort verlegt: ${newHq.address} (GPS: ${newHq.lat.toFixed(5)}, ${newHq.lng.toFixed(5)})`,
    };
    updateOperation(currentOperation.id, (prevOp) => ({
      headquartersLocation: newHq,
      logs: [logEntry, ...(prevOp.logs || [])],
    }));
    playAlertSound('success');
    setDismissEzWarning(true);
    setEzToastNotice(`✅ EZ erfolgreich an den Einsatzort verlegt! Alle Einsatzkräfte navigieren ab sofort direkt hierher.`);
    setTimeout(() => setEzToastNotice(''), 5000);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([newHq.lat, newHq.lng], 16);
    }
  };

  // Check if active operation EZ is mistakenly left in Aschersleben while search area is elsewhere
  const ezDistanceWarning = useMemo(() => {
    if (!currentOperation || (currentOperation.status !== 'active' && currentOperation.status !== 'paused')) {
      return null;
    }
    const hq = currentOperation.headquartersLocation;
    if (!hq || typeof hq.lat !== 'number' || typeof hq.lng !== 'number') return null;

    // Check if HQ is near Vereinsbüro Aschersleben (< 800m)
    const distToVereinsbuero = calculateDistanceMeters(hq.lat, hq.lng, VEREINSBUERO_LOCATION.lat, VEREINSBUERO_LOCATION.lng);
    const isHqInAschersleben = distToVereinsbuero < 800;
    if (!isHqInAschersleben) return null;

    // Check if PLS is > 2000m away
    const pls = currentOperation.missingPerson?.lastSeenLocation;
    if (pls?.lat && pls?.lng) {
      const distToPls = calculateDistanceMeters(hq.lat, hq.lng, pls.lat, pls.lng);
      if (distToPls > 2000) {
        return {
          distKm: distToPls / 1000,
          targetLat: pls.lat,
          targetLng: pls.lng,
          targetLabel: pls.address || pls.description || 'Letzter Sichtort (PLS)',
        };
      }
    }

    // Check if sectors are > 2000m away
    if (Array.isArray(currentOperation.sectors) && currentOperation.sectors.length > 0) {
      for (const sec of currentOperation.sectors) {
        if (Array.isArray(sec.polygon) && sec.polygon.length > 0) {
          const p0 = sec.polygon[0];
          const distToSec = calculateDistanceMeters(hq.lat, hq.lng, p0[0], p0[1]);
          if (distToSec > 2000) {
            return {
              distKm: distToSec / 1000,
              targetLat: p0[0],
              targetLng: p0[1],
              targetLabel: `Sektor ${sec.name}`,
            };
          }
        }
      }
    }

    return null;
  }, [currentOperation]);

  const handleSaveEzFromMapModal = (e: React.MouseEvent) => {
    e.preventDefault();
    const lat = typeof editEzLat === 'number' && !isNaN(editEzLat) ? editEzLat : VEREINSBUERO_LOCATION.lat;
    const lng = typeof editEzLng === 'number' && !isNaN(editEzLng) ? editEzLng : VEREINSBUERO_LOCATION.lng;
    const address = editEzAddress.trim() || VEREINSBUERO_LOCATION.address;

    const isStandby = !currentOperation || (currentOperation.status !== 'active' && currentOperation.status !== 'paused');

    if (isStandby) {
      saveSavedVereinsbueroLocation({ lat, lng, address });
      if (currentOperation) {
        updateOperation(currentOperation.id, {
          headquartersLocation: {
            lat,
            lng,
            address,
            description: 'Vereinshaus Aschersleben',
          },
        });
      }
      setEzModalSuccess('✅ Vereinsbüro-Position erfolgreich gespeichert!');
    } else {
      const newHq = {
        lat,
        lng,
        address,
        description: currentOperation.headquartersLocation?.description || 'EZ vor Ort',
      };

      const now = new Date().toISOString();
      const logEntry: OperationLogEntry = {
        id: `log-${Date.now()}`,
        operationId: currentOperation.id,
        timestamp: now,
        authorName: currentUser?.name || 'Einsatzleitung',
        authorRole: currentUser?.role || 'admin',
        category: 'general',
        text: `EZ-Standort auf Lagekarte verschoben: ${address} (GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)})`,
      };

      updateOperation(currentOperation.id, (prevOp) => ({
        headquartersLocation: newHq,
        logs: [logEntry, ...(prevOp.logs || [])],
      }));
      setEzModalSuccess('✅ EZ-Standort erfolgreich gespeichert & übernommen!');
    }

    playAlertSound('success');
    setEzNavData((prev) =>
      prev
        ? {
            ...prev,
            lat,
            lng,
            address,
            isStandbyOffice: isStandby,
          }
        : null
    );

    setIsEditingEz(false);
    setTimeout(() => setEzModalSuccess(''), 4000);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], 16);
    }
  };

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

  // Bounding box for offline tile caching
  const operationSearchBounds = useMemo(() => {
    const sectors = currentOperation?.sectors || [];
    if (sectors.length === 0) {
      if (weatherTarget.lat && weatherTarget.lng) {
        return {
          minLat: weatherTarget.lat - 0.03,
          maxLat: weatherTarget.lat + 0.03,
          minLng: weatherTarget.lng - 0.04,
          maxLng: weatherTarget.lng + 0.04,
        };
      }
      return undefined;
    }
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    sectors.forEach((sec) => {
      sec.polygon.forEach(([lat, lng]) => {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      });
    });
    if (minLat > maxLat) return undefined;
    return {
      minLat: minLat - 0.006,
      maxLat: maxLat + 0.006,
      minLng: minLng - 0.008,
      maxLng: maxLng + 0.008,
    };
  }, [currentOperation, weatherTarget]);

  const handleImportSectors = (newSectors: Omit<SearchSector, 'id' | 'operationId'>[]) => {
    addMultipleSectors(newSectors);
  };

  const handleImportTracks = (tracks: ImportedTrack[]) => {
    setExternalImportedTracks((prev) => [...prev, ...tracks]);
  };

  const handleImportWaypoints = (waypoints: ImportedWaypoint[]) => {
    waypoints.forEach((w) => {
      reportFinding({
        title: w.name,
        description: w.description || 'Importierter GPX/KML Wegpunkt / Hinweis',
        category: 'other',
        urgency: 'standard',
        location: { lat: w.lat, lng: w.lng, timestamp: new Date().toISOString() },
      });
    });
  };

  // Aggregated summary of all search tracks on map (unified via trackHelper)
  const trackSummaries = useMemo<TrackSummaryItem[]>(() => {
    return computeTrackSummaries(currentOperation, userLocations, allUsers);
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
      const dataUrl = await captureTacticalMapScreenshot(currentOperation, userLocations, allUsers);
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
        const dataUrl = await captureTacticalMapScreenshot(currentOperation, userLocations, allUsers);
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
    if (!mapInstanceRef.current) return;
    if (!currentOperation || currentOperation.status === 'completed') {
      // Nach Einsatzende oder in Bereitschaft: Immer automatisch Standardansicht Vereinsbüro Aschersleben (Hohe Str. 15)
      mapInstanceRef.current.setView([VEREINSBUERO_LOCATION.lat, VEREINSBUERO_LOCATION.lng], 13);
      return;
    }

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
  }, [currentOperation?.id, currentOperation?.status, isArchiveMode]);

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

  // EZ Repositioning via Long-Press (Mobile Hold & Desktop Right-Click) or Tap in Placement Mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Desktop Contextmenu (Right click) or native mobile long-press
    const handleContextMenu = (e: L.LeafletMouseEvent) => {
      if (isDrawingSectorRef.current || mode === 'archive') return;
      L.DomEvent.preventDefault(e.originalEvent);
      triggerEzRepositionModal(e.latlng.lat, e.latlng.lng);
    };

    // 2. Click in Placement Mode
    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (isPlacingEzModeRef.current && !isDrawingSectorRef.current && mode !== 'archive') {
        triggerEzRepositionModal(e.latlng.lat, e.latlng.lng);
        setIsPlacingEzMode(false);
      }
    };

    map.on('contextmenu', handleContextMenu);
    map.on('click', handleMapClick);

    // 3. Touchhold detector for Touchscreens (iOS Safari, Android Chrome)
    const container = map.getContainer();
    let touchTimer: any = null;
    let startX = 0;
    let startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || isDrawingSectorRef.current || mode === 'archive') return;
      const target = e.target as HTMLElement;
      if (target && (target.closest('.custom-hq-marker') || target.closest('.leaflet-marker-icon'))) {
        return;
      }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      touchTimer = setTimeout(() => {
        touchTimer = null;
        if (!mapInstanceRef.current) return;
        const rect = container.getBoundingClientRect();
        const pt = L.point(startX - rect.left, startY - rect.top);
        const latlng = mapInstanceRef.current.containerPointToLatLng(pt);
        if (navigator.vibrate) {
          navigator.vibrate([40, 50, 40]);
        }
        triggerEzRepositionModal(latlng.lat, latlng.lng);
      }, 550);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!touchTimer) return;
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dx > 10 || dy > 10) {
        clearTimeout(touchTimer);
        touchTimer = null;
      }
    };

    const onTouchEnd = () => {
      if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
      }
    };

    // Custom event listener from popup buttons
    const handleCustomPlaceMode = () => {
      setIsPlacingEzMode(true);
    };
    window.addEventListener('shs-place-ez-mode', handleCustomPlaceMode);

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      map.off('contextmenu', handleContextMenu);
      map.off('click', handleMapClick);
      window.removeEventListener('shs-place-ez-mode', handleCustomPlaceMode);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [triggerEzRepositionModal, mode]);

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
      const safePlsPhotoUrl = sanitizeImageUrl(mp?.photoUrl);
      const safeMpName = escapeHtml(mp?.name || 'Vermisste Person');
      const safePlsAddress = escapeHtml(pls.address);
      const safePlsDesc = escapeHtml(pls.description);
      const safeClothing = escapeHtml(mp?.clothing);
      const safeMedical = (mp?.medicalConditions || []).map(escapeHtml).join(', ');
      const safeLastSeenTime = escapeHtml(mp?.lastSeenTime || 'Unbekannt');

      const plsPhotoHtml = safePlsPhotoUrl
        ? `<div style="width: 100%; height: 160px; max-height: 180px; border-radius: 10px; overflow: hidden; margin-bottom: 10px; background: #0f172a; border: 1px solid #cbd5e1; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
            <img src="${safePlsPhotoUrl}" alt="${safeMpName}" style="width: 100%; height: 100%; object-fit: cover; display: block;" referrerpolicy="no-referrer" />
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
            ${safeMpName}${mp?.age ? ` (${Number(mp.age)} Jahre)` : ''}
          </div>
          <div style="font-size: 12px; color: #cbd5e1; font-weight: 500; margin-top: 4px; line-height: 1.3;">
            ${safePlsAddress}
          </div>
          ${safePlsDesc ? `<div style="font-size: 11px; color: #94a3b8; font-style: italic; margin-top: 4px; background: #0f172a; padding: 4px 6px; border-radius: 4px; border: 1px solid #334155;">${safePlsDesc}</div>` : ''}
          ${safeClothing ? `<div style="font-size: 11px; color: #cbd5e1; margin-top: 5px;"><strong>Bekleidung:</strong> ${safeClothing}</div>` : ''}
          ${safeMedical ? `<div style="font-size: 11px; color: #fca5a5; background: #450a0a; border: 1px solid #7f1d1d; padding: 3px 6px; border-radius: 4px; margin-top: 5px;"><strong>⚠️ Medizinisch:</strong> ${safeMedical}</div>` : ''}
          <div style="font-size: 11px; color: #94a3b8; margin-top: 6px; font-family: monospace;">
            Sichtung: <strong style="color: #ffffff;">${safeLastSeenTime}</strong>
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
      const safeHomePhotoUrl = sanitizeImageUrl(mp?.photoUrl);
      const safeMpName = escapeHtml(mp?.name || 'Vermisste Person');
      const safeHomeAddress = escapeHtml(home.address);
      const safeHomeNotes = escapeHtml(home.notes);
      const safeClothing = escapeHtml(mp?.clothing);
      const safeDesc = escapeHtml(mp?.description);
      const safeMedical = (mp?.medicalConditions || []).map(escapeHtml).join(', ');

      const homePhotoHtml = safeHomePhotoUrl
        ? `<div style="width: 100%; height: 160px; max-height: 180px; border-radius: 10px; overflow: hidden; margin-bottom: 10px; background: #0f172a; border: 1px solid #334155; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">
            <img src="${safeHomePhotoUrl}" alt="${safeMpName}" style="width: 100%; height: 100%; object-fit: cover; display: block;" referrerpolicy="no-referrer" />
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
            ${safeMpName}${mp?.age ? ` (${Number(mp.age)} Jahre)` : ''}
          </div>
          <div style="font-size: 12px; color: #cbd5e1; font-weight: 500; margin-top: 4px; line-height: 1.3;">
            ${safeHomeAddress}
          </div>
          ${safeHomeNotes ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 4px; background: #0f172a; padding: 4px 6px; border-radius: 4px; border: 1px solid #334155;"><strong>Hinweis:</strong> ${safeHomeNotes}</div>` : ''}
          ${safeClothing ? `<div style="font-size: 11px; color: #cbd5e1; margin-top: 5px;"><strong>Bekleidung:</strong> ${safeClothing}</div>` : ''}
          ${safeDesc ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 4px;"><strong>Merkmale:</strong> ${safeDesc}</div>` : ''}
          ${safeMedical ? `<div style="font-size: 11px; color: #fca5a5; background: #450a0a; border: 1px solid #7f1d1d; padding: 3px 6px; border-radius: 4px; margin-top: 5px;"><strong>⚠️ Medizinisch:</strong> ${safeMedical}</div>` : ''}
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

    // Kräfte in der EZ ermitteln (NUR bei einem AKTIVEN Einsatz UND nach Bestätigung auf 🟢 Bereit in der EZ)
    const isOperationActive = Boolean(currentOperation && currentOperation.status === 'active');
    const ezResponders = isOperationActive
      ? allUsers.filter((u) => {
          if (!u.isActive) return false;
          const isEzRole = u.operationalRole === 'ez_command' || userLocations[u.id]?.operationalRole === 'ez_command';
          const isReady = u.arrivalStatus === 'ready' || u.arrivalStatus === 'ez_reached';
          return isEzRole && isReady;
        })
      : [];

    const responderCountBadge = ezResponders.length > 0
      ? `<span class="ml-1 px-1.5 py-0.2 bg-emerald-500 text-slate-950 font-black rounded-full text-[10px] shadow">${ezResponders.length}</span>`
      : '';

    const pinWidth = ezResponders.length > 0 ? 86 : 68;
    const pinHeight = 36;
    const hqIcon = L.divIcon({
      className: 'custom-hq-marker',
      html: `
        <div style="display:flex; flex-direction:column; align-items:center; width:${pinWidth}px; height:${pinHeight}px; pointer-events:auto; filter:drop-shadow(0 2px 5px rgba(0,0,0,0.5)); transform:translateZ(0);">
          <div style="display:flex; align-items:center; justify-content:center; gap:4px; padding:3px 8px; border-radius:10px; background:${isStandbyOffice ? '#1e1b4b' : '#3730a3'}; color:#ffffff; font-weight:800; font-size:11px; white-space:nowrap; border:1.5px solid ${isStandbyOffice ? '#818cf8' : '#ffffff'}; box-shadow:0 2px 6px rgba(0,0,0,0.4); line-height:1.2;">
            <span>${isStandbyOffice ? '🏢' : '📡'} EZ</span>
            ${responderCountBadge}
          </div>
          <div style="width:0; height:0; border-left:5px solid transparent; border-right:5px solid transparent; border-top:7px solid ${isStandbyOffice ? '#818cf8' : '#ffffff'}; margin-top:-1px;"></div>
          <div style="width:5px; height:5px; border-radius:50%; background:#ffffff; border:1.5px solid ${isStandbyOffice ? '#818cf8' : '#4338ca'}; margin-top:-2px; box-shadow:0 0 3px rgba(0,0,0,0.8);"></div>
        </div>
      `,
      iconSize: [pinWidth, pinHeight],
      iconAnchor: [pinWidth / 2, pinHeight],
      popupAnchor: [0, -pinHeight],
    });

    const canManageOps = isUserAdminOrEL(currentUser);
    const isDraggableHq = canManageOps && mode !== 'archive';

    const hqMarker = L.marker([hqLat, hqLng], {
      icon: hqIcon,
      draggable: isDraggableHq,
      zIndexOffset: 1200,
      title: isDraggableHq ? '📡 EZ (Gedrückt halten & verschieben zum Feinjustieren)' : '📡 EZ',
    });

    const applyEzReposition = async (newLat: number, newLng: number) => {
      const roundedLat = Number(newLat.toFixed(6));
      const roundedLng = Number(newLng.toFixed(6));

      if (currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused')) {
        const detectedAddr = await reverseGeocode(roundedLat, roundedLng);
        const updatedHq = {
          lat: roundedLat,
          lng: roundedLng,
          address: detectedAddr || currentOperation.headquartersLocation?.address || 'Einsatzzentrale vor Ort',
          description: currentOperation.headquartersLocation?.description || 'Mit Finger auf Karte verschoben',
        };
        const logEntry: OperationLogEntry = {
          id: `log-${Date.now()}`,
          operationId: currentOperation.id,
          timestamp: new Date().toISOString(),
          authorName: currentUser?.name || 'Einsatzleitung',
          authorRole: currentUser?.role || 'admin',
          category: 'general',
          text: `📡 EZ-Standort im Gelände/Parkplatz neu positioniert: ${updatedHq.address} (GPS: ${roundedLat.toFixed(5)}, ${roundedLng.toFixed(5)})`,
        };
        updateOperation(currentOperation.id, (prevOp) => ({
          headquartersLocation: updatedHq,
          logs: [logEntry, ...(prevOp.logs || [])],
        }));
        setEzToastNotice(`📡 EZ erfolgreich auf ${updatedHq.address} verschoben!`);
        setTimeout(() => setEzToastNotice(''), 4500);
        playAlertSound('notification');
      } else {
        // Standby: Vereinshaus Aschersleben
        saveSavedVereinsbueroLocation({
          lat: roundedLat,
          lng: roundedLng,
        });
        if (currentOperation) {
          updateOperation(currentOperation.id, {
            headquartersLocation: {
              lat: roundedLat,
              lng: roundedLng,
              address: VEREINSBUERO_LOCATION.address,
              description: 'Vereinshaus Aschersleben',
            },
          });
        }
        setEzToastNotice(`🏢 Standard-EZ (Vereinshaus) erfolgreich auf ${roundedLat.toFixed(5)}, ${roundedLng.toFixed(5)} gespeichert!`);
        setTimeout(() => setEzToastNotice(''), 4500);
        playAlertSound('notification');
      }
    };

    if (isDraggableHq) {
      hqMarker.on('dragend', async (e: L.LeafletEvent) => {
        hqMarker.dragging.disable();
        const el = hqMarker.getElement();
        if (el) el.classList.remove('ring-4', 'ring-emerald-400', 'scale-110');
        const marker = e.target as L.Marker;
        const newPos = marker.getLatLng();
        triggerEzRepositionModal(newPos.lat, newPos.lng);
      });
    }

    // Long-Press handler directly on the EZ Pin (Finger 500ms gedrückt halten schaltet Verschieben frei)
    setTimeout(() => {
      const el = hqMarker.getElement();
      if (!el || !isDraggableHq) return;

      let longPressTimer: any = null;
      let startX = 0;
      let startY = 0;

      const clearTimer = () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      };

      const handlePressStart = (e: TouchEvent | MouseEvent) => {
        if ('touches' in e && e.touches.length !== 1) return;
        if ('button' in e && e.button !== 0) return;
        const pt = 'touches' in e ? e.touches[0] : e;
        startX = pt.clientX;
        startY = pt.clientY;

        clearTimer();
        longPressTimer = setTimeout(() => {
          longPressTimer = null;
          if (navigator.vibrate) navigator.vibrate([40, 50, 40]);
          playAlertSound('notification');

          // Unlock dragging on the marker!
          hqMarker.dragging.enable();
          el.classList.add('ring-4', 'ring-emerald-400', 'scale-110');
          setEzToastNotice('📍 EZ freigeschaltet! Ziehe die Pin an die gewünschte Stelle.');
          setTimeout(() => setEzToastNotice(''), 4000);
        }, 500);
      };

      const handlePressMove = (e: TouchEvent | MouseEvent) => {
        if (!longPressTimer) return;
        const pt = 'touches' in e ? e.touches[0] : e;
        const dx = Math.abs(pt.clientX - startX);
        const dy = Math.abs(pt.clientY - startY);
        if (dx > 8 || dy > 8) {
          clearTimer();
        }
      };

      const handlePressEnd = () => {
        clearTimer();
      };

      el.addEventListener('touchstart', handlePressStart, { passive: true });
      el.addEventListener('touchmove', handlePressMove, { passive: true });
      el.addEventListener('touchend', handlePressEnd, { passive: true });
      el.addEventListener('touchcancel', handlePressEnd, { passive: true });
      el.addEventListener('mousedown', handlePressStart);
      el.addEventListener('mousemove', handlePressMove);
      el.addEventListener('mouseup', handlePressEnd);
    }, 50);

    const markerNavData = {
      lat: hqLat,
      lng: hqLng,
      address: hqAddress,
      title: hqTitle,
      isStandbyOffice,
      operationTitle: currentOperation?.title,
      commander: currentOperation?.commander,
      ezResponders,
    };

    // Direct click/tap on EZ on the map opens the coordinate navigation transfer modal
    hqMarker.on('click', () => {
      setEzNavData(markerNavData);
    });

    const ezRespondersListHtml = ezResponders.length > 0
      ? `
        <div class="mt-2 pt-2 border-t border-slate-700/80">
          <div class="text-[11px] font-bold text-indigo-300 flex items-center justify-between mb-1">
            <span>🏢 Kräfte in der EZ:</span>
            <span class="px-1.5 py-0.2 bg-indigo-900/80 text-indigo-200 rounded font-mono text-[10px]">${ezResponders.length}</span>
          </div>
          <div class="space-y-1 max-h-32 overflow-y-auto pr-1">
            ${ezResponders.map(r => `
              <div class="flex items-center justify-between bg-slate-800/90 px-1.5 py-1 rounded text-[11px] border border-slate-700/60">
                <div class="font-medium text-slate-200 flex items-center gap-1">
                  <span>${r.operationalRole === 'ez_command' ? '🏢' : '👤'}</span>
                  <span>${escapeHtml(r.name)}</span>
                </div>
                <span class="text-[10px] text-slate-400 font-mono">${escapeHtml(r.callSign || 'EZ')}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `
      : '';

    const dragHintHtml = isDraggableHq
      ? `<div class="mt-2 text-[10px] text-amber-300 bg-amber-950/70 p-1.5 rounded border border-amber-700/60 text-center font-mono">📍 EZ mit dem Finger ziehen & verschieben</div>`
      : '';

    hqMarker.bindPopup(`
      <div class="p-2.5 text-slate-100 font-sans min-w-[220px]">
        <div class="font-bold text-indigo-400 text-sm flex items-center gap-1.5">
          <span>${isStandbyOffice ? '📡' : '🚨'}</span>
          <span>${escapeHtml(hqTitle)}</span>
        </div>
        <div class="text-xs text-slate-300 mt-1 font-medium">${escapeHtml(hqAddress)}</div>
        <div class="text-[10px] text-slate-400 font-mono mt-0.5">${hqLat.toFixed(5)}° N, ${hqLng.toFixed(5)}° E</div>
        ${!isStandbyOffice && currentOperation ? `<div class="text-xs text-slate-300 mt-1.5 bg-slate-800/80 border border-slate-700 p-1.5 rounded">Einsatz: <strong class="text-white">${escapeHtml(currentOperation.title)}</strong><br/>Leitung: <strong class="text-white">${escapeHtml(currentOperation.commander)}</strong></div>` : `<div class="text-[11px] text-emerald-400 font-medium mt-1">🟢 Status: Bereitschaft am Vereinsbüro</div>`}
        ${ezRespondersListHtml}
        ${dragHintHtml}
        <div class="mt-2.5 pt-2 border-t border-slate-700 space-y-1.5">
          <a
            href="https://www.google.com/maps/dir/?api=1&destination=${hqLat},${hqLng}"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow transition no-underline text-center"
          >
            🧭 In Navi-App öffnen
          </a>
          ${canManageOps ? `
            <button
              type="button"
              onclick="window.dispatchEvent(new CustomEvent('shs-place-ez-mode'))"
              class="w-full py-1 px-2 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 font-mono text-[11px] cursor-pointer transition text-center"
            >
              📍 EZ per Kartentipp verlegen
            </button>
          ` : ''}
        </div>
      </div>
    `);
    ezLayerRef.current.addLayer(hqMarker);

    }, [currentOperation, activeTrackingTest, allUsers, userLocations, currentUser, updateOperation, playAlertSound]);

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
            <span>🗺️ ${escapeHtml(currentOperation.searchAreaName || 'Haupt-Suchgebiet')}</span>
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
            <span>${escapeHtml(sector.name)}</span>
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

  // Helper to render directional chevrons/arrows along GPS tracks (like sports/tracking watches)
  const renderTrackDirectionArrows = (
    points: { lat: number; lng: number }[],
    trackColor: string,
    layerGroup: L.LayerGroup
  ) => {
    if (!points || points.length < 2) return;
    const step = Math.max(1, Math.min(14, Math.floor(points.length / 10)));
    for (let i = 0; i < points.length - 1; i += step) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const d = calculateDistanceMeters(p1.lat, p1.lng, p2.lat, p2.lng);
      if (d < 1.5 || d > 800) continue;

      const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
      const dLng = (p2.lng - p1.lng) * (Math.PI / 180);
      const y = Math.sin(dLng) * Math.cos((p2.lat * Math.PI) / 180);
      const x =
        Math.cos((p1.lat * Math.PI) / 180) * Math.sin((p2.lat * Math.PI) / 180) -
        Math.sin((p1.lat * Math.PI) / 180) * Math.cos((p2.lat * Math.PI) / 180) * Math.cos(dLng);
      const angleDeg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

      const arrowIcon = L.divIcon({
        className: 'track-arrow-marker',
        html: `<div style="transform: rotate(${angleDeg}deg); width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; pointer-events: none;">
          <svg viewBox="0 0 12 12" width="12" height="12" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.85));">
            <path d="M 6 0 L 12 11 L 6 8 L 0 11 Z" fill="${trackColor}" stroke="#ffffff" stroke-width="1.2" />
          </svg>
        </div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const marker = L.marker([p1.lat, p1.lng], { icon: arrowIcon, interactive: false });
      layerGroup.addLayer(marker);
    }
  };

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

      // Start & End markers for the active test (start=green, end=black, small, no label)
      const startPt = activeTrackingTest.trackPoints[0];
      const latestPt = activeTrackingTest.trackPoints[activeTrackingTest.trackPoints.length - 1];

      if (startPt) {
        const startMarker = L.circleMarker([startPt.lat, startPt.lng], {
          radius: 4,
          color: '#ffffff',
          fillColor: '#16a34a',
          fillOpacity: 1,
          weight: 1.5,
        });
        tracksLayerRef.current.addLayer(startMarker);
      }

      if (latestPt && activeTrackingTest.trackPoints.length > 1) {
        const latestMarker = L.circleMarker([latestPt.lat, latestPt.lng], {
          radius: 4,
          color: '#ffffff',
          fillColor: '#000000',
          fillOpacity: 1,
          weight: 1.5,
        });
        tracksLayerRef.current.addLayer(latestMarker);
      }

      // Add direction arrows
      renderTrackDirectionArrows(activeTrackingTest.trackPoints, '#38bdf8', tracksLayerRef.current);
    }

    if (!showTracks) return;

    // Track which user tracks have been rendered to prevent double-drawing identical lines
    const renderedTrackUserIds = new Set<string>();

    // 2. Render historical / archived search tracks (from previous search phases or saved on pause/end)
    if (currentOperation?.archivedTracks && currentOperation.archivedTracks.length > 0 && !activeTrackingTest?.isActive) {
      currentOperation.archivedTracks.forEach((archivedTrack) => {
        if (!archivedTrack.points || archivedTrack.points.length < 2) return;

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
            const prevTimestamp = archivedTrack.points[i - 1]?.timestamp;
            const currTimestamp = pt.timestamp;
            const timeDiff = prevTimestamp && currTimestamp ? Math.abs(new Date(currTimestamp).getTime() - new Date(prevTimestamp).getTime()) : 0;
            // Break segments on large teleports (> 800m) or long pauses (> 15 min)
            if (dist > 800 || timeDiff > 15 * 60 * 1000) {
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

        const isPhase1 = archivedTrack.phaseLabel?.includes('Suchphase 1') || archivedTrack.phaseLabel?.includes('Phase 1');
        const trackColor = archivedTrack.color || getUserTrackColor(archivedTrack.userId, allUsers);

        segments.forEach((seg) => {
          // High-contrast outline casing
          const casing = L.polyline(seg, {
            color: '#0f172a',
            weight: 5.5,
            opacity: 0.6,
            smoothFactor: 0,
            dashArray: isPhase1 && currentOperation.status === 'active' ? '8, 6' : undefined,
          });
          tracksLayerRef.current?.addLayer(casing);

          const polyline = L.polyline(seg, {
            color: trackColor,
            weight: 3.5,
            opacity: isPhase1 && currentOperation.status === 'active' ? 0.8 : 0.9,
            smoothFactor: 0,
            dashArray: isPhase1 && currentOperation.status === 'active' ? '8, 6' : undefined,
          });

          polyline.bindTooltip(
            `📍 Bewegungsprofil: ${archivedTrack.userName} (${archivedTrack.callSign}) • ${archivedTrack.points.length} Wegpunkte (${archivedTrack.phaseLabel || 'Suchphase 1 Referenz'})`,
            { sticky: true }
          );

          tracksLayerRef.current?.addLayer(polyline);
        });

        // Start & End markers for archived track (start=green, end=black, radius 4, no label)
        const startPt = archivedTrack.points[0];
        const endPt = archivedTrack.points[archivedTrack.points.length - 1];
        if (startPt) {
          const startMarker = L.circleMarker([startPt.lat, startPt.lng], {
            radius: 4,
            color: '#ffffff',
            fillColor: '#16a34a',
            fillOpacity: 1,
            weight: 1.5,
          });
          startMarker.bindTooltip(
            `🟢 Startpunkt (Phase 1): ${archivedTrack.userName}`,
            { sticky: true }
          );
          tracksLayerRef.current?.addLayer(startMarker);
        }
        if (endPt && archivedTrack.points.length > 1) {
          const endMarker = L.circleMarker([endPt.lat, endPt.lng], {
            radius: 4,
            color: '#ffffff',
            fillColor: '#000000',
            fillOpacity: 1,
            weight: 1.5,
          });
          endMarker.bindTooltip(
            `⚫ Stand/Ende (Phase 1): ${archivedTrack.userName}`,
            { sticky: true }
          );
          tracksLayerRef.current?.addLayer(endMarker);
        }

        // Direction arrows along archived track
        if (tracksLayerRef.current) {
          renderTrackDirectionArrows(
            archivedTrack.points,
            trackColor,
            tracksLayerRef.current
          );
        }
      });
    }

    // 3. Render user tracks from userLocations (ausschließlich bei aktivem oder pausiertem Einsatz)
    const isOpRunning = Boolean(currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused'));
    if (!isOpRunning && !isArchiveMode) {
      // Ohne aktiven Einsatz werden keinerlei Suchspuren auf der Karte angezeigt (saubere Karte)
      return;
    }

    if (!isArchiveMode || (currentOperation?.archivedTracks?.length || 0) === 0) {
      (Object.entries(userLocations) as [string, UserLocationState][]).forEach(([userId, locState]) => {
        if (activeTrackingTest?.isActive) {
          return;
        }

        const user = allUsers.find((u) => u.id === userId);

        // Nur Einsatzkräfte berücksichtigen, die tatsächlich am aktuellen Einsatz teilnehmen
        // Verhindert phantom-/alte Spuren von Nicht-Teilnehmern (z.B. Madleen)
        const isParticipant =
          (currentOperation?.participantIds && currentOperation.participantIds.length > 0)
            ? currentOperation.participantIds.includes(userId)
            : Boolean(user?.isActive || locState.isLive);

        if (!isParticipant) {
          return;
        }

        // Suchpunkte müssen strikt zum aktuellen Einsatz gehören!
        const history = (locState.trackHistory || []).filter(
          pt => currentOperation?.id && pt.operationId === currentOperation.id
        );
        if (!history || history.length < 2) return;

        // Check if user already has an archived track from previous phase
        const archivedForUser = currentOperation?.archivedTracks?.find((at) => at.userId === userId);
        let activeHistory = history;
        let isPhase2 = false;

        if (archivedForUser && archivedForUser.points.length > 0) {
          const lastArchivedTime = new Date(archivedForUser.points[archivedForUser.points.length - 1].timestamp).getTime();
          const newer = history.filter((p) => new Date(p.timestamp).getTime() > lastArchivedTime + 2000);
          if (newer.length >= 2) {
            activeHistory = newer;
            isPhase2 = true;
          } else {
            // No new points recorded yet in Phase 2
            return;
          }
        }

        const isDrone = user?.equipment?.includes('drone');
        const trackColor = getUserTrackColor(user || userId, allUsers);

        const isPaused = currentOperation?.status === 'paused';
        const isCompleted = currentOperation?.status === 'completed';
        const modeLabel = isPhase2 ? 'Suchphase 2 (Live)' : isPaused ? 'Pausiert' : isCompleted ? 'Abgeschlossen' : locState.isLive ? 'Live' : 'Gesichert';

        // Draw track segments with gap-awareness for Funklöcher (> 45s signal loss)
        for (let i = 1; i < activeHistory.length; i++) {
          const prevPt = activeHistory[i - 1];
          const currPt = activeHistory[i];
          const dist = calculateDistanceMeters(prevPt.lat, prevPt.lng, currPt.lat, currPt.lng);

          const timeDiffMs = Math.abs(new Date(currPt.timestamp).getTime() - new Date(prevPt.timestamp).getTime());

          // Skip extreme teleports / map bounds jumps (> 800m) or overnight gaps (> 15 min): DO NOT DRAW A LINE
          if (dist > 800 || timeDiffMs > 15 * 60 * 1000) {
            continue;
          }

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
                color: trackColor,
                weight: isDrone ? 3 : 3.5,
                opacity: 0.9,
                smoothFactor: 0,
                dashArray: '6, 6',
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
              `📍 Bewegungsprofil (${modeLabel}): ${user?.name || 'Sucher'} (${user?.callSign || 'Unit'}) • ${activeHistory.length} Wegpunkte`,
              { sticky: true }
            );
            tracksLayerRef.current?.addLayer(segPolyline);
          }
        }

        // Render Start point (green) for this user's active track
        const startPt = activeHistory[0];
        if (startPt) {
          const startMarker = L.circleMarker([startPt.lat, startPt.lng], {
            radius: 4,
            color: '#ffffff',
            fillColor: '#16a34a',
            fillOpacity: 1,
            weight: 1.5,
          });
          startMarker.bindTooltip(
            `🟢 Startpunkt (${isPhase2 ? 'Suchphase 2' : 'Start'}): ${user?.name || 'Sucher'}`,
            { sticky: true }
          );
          tracksLayerRef.current?.addLayer(startMarker);
        }

        // If operation is paused or completed, render End point (black)
        if ((isPaused || isCompleted) && activeHistory.length > 1) {
          const endPt = activeHistory[activeHistory.length - 1];
          if (endPt) {
            const endMarker = L.circleMarker([endPt.lat, endPt.lng], {
              radius: 4,
              color: '#ffffff',
              fillColor: '#000000',
              fillOpacity: 1,
              weight: 1.5,
            });
            endMarker.bindTooltip(
              `⚫ Endpunkt / Letzte Position: ${user?.name || 'Sucher'}`,
              { sticky: true }
            );
            tracksLayerRef.current?.addLayer(endMarker);
          }
        }

        // Direction arrows along live track
        if (tracksLayerRef.current) {
          renderTrackDirectionArrows(activeHistory, trackColor, tracksLayerRef.current);
        }
      });
    }

    // Render external imported tracks (e.g. from police / forestry GPX/KML import)
    if (showTracks && externalImportedTracks.length > 0) {
      externalImportedTracks.forEach((trk) => {
        const latlngs: [number, number][] = trk.points.map((p) => [p.lat, p.lng]);
        if (latlngs.length >= 2) {
          const extPolyline = L.polyline(latlngs, {
            color: '#38BDF8',
            weight: 3.5,
            opacity: 0.9,
            dashArray: '6, 6',
          });
          extPolyline.bindPopup(`
            <div style="font-family: system-ui, sans-serif; min-width: 170px;">
              <div style="font-weight: 800; font-size: 13px; color: #0284c7; margin-bottom: 2px;">
                📁 ${escapeHtml(trk.name)}
              </div>
              <div style="font-size: 11px; color: #64748b; font-family: monospace;">
                Externe Referenzspur (GPX/KML)<br/>
                ${trk.points.length} Punkte • ${(trk.distanceMeters / 1000).toFixed(2)} km
              </div>
            </div>
          `);
          tracksLayerRef.current?.addLayer(extPolyline);
        }
      });
    }
  }, [userLocations, allUsers, currentOperation, showTracks, showInactiveResponders, isArchiveMode, activeTrackingTest, externalImportedTracks]);

  // Render Active Responders / Units Pins (with Spiderfy radial layout for co-located responders)
  useEffect(() => {
    if (!respondersLayerRef.current) return;
    respondersLayerRef.current.clearLayers();

    if (!showResponders || mode === 'archive') return;

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

      // In EZ verbleibende Kräfte (Leitstand / EZ-Personal) werden NUR bei AKTIVEM Einsatz
      // und ERST NACH BESTÄTIGUNG auf 🟢 BEREIT im EZ-Pin gebündelt.
      // Außerhalb von Einsätzen oder vor 🟢 Bereit-Bestätigung wird IMMER ihr eigener User-Pin angezeigt!
      const isOperationActive = Boolean(currentOperation && currentOperation.status === 'active');
      const isEzStaff =
        isOperationActive &&
        (user.operationalRole === 'ez_command' || userLocations[userId]?.operationalRole === 'ez_command') &&
        (user.arrivalStatus === 'ready' || user.arrivalStatus === 'ez_reached');

      // If user is explicitly selected, NEVER skip them (even if EZ staff) so their location is visible!
      if (isEzStaff && selectedUser?.id !== userId) return;

      // Only display active / logged-in users unless showInactiveResponders is active OR user is a participant of current operation OR user is explicitly selected
      const isParticipant = Boolean(
        currentOperation && (
          currentOperation.participantIds?.includes(userId) ||
          currentOperation.archivedTracks?.some(t => t.userId === userId) ||
          (userLocations[userId]?.trackHistory?.length || 0) > 0
        )
      );
      const isOnline = user.isActive;
      const isSelected = selectedUser?.id === userId;
      if (!isOnline && !showInactiveResponders && !isParticipant && !isSelected) return;

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

      // If active user or selected user has no location yet, provide a fallback location so they ARE VISIBLE!
      if ((!locState || !locState.currentPosition) && (user.isActive || isSelected)) {
        const fallbackPos =
          currentOperation?.archivedTracks?.find(t => t.userId === userId)?.points?.slice(-1)[0] ||
          currentOperation?.headquartersLocation ||
          VEREINSBUERO_LOCATION;

        locState = {
          userId: user.id,
          currentPosition: {
            lat: fallbackPos.lat,
            lng: fallbackPos.lng,
            timestamp: new Date().toISOString(),
          },
          isLive: user.isActive,
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

        const isOperationActive = Boolean(currentOperation && currentOperation.status === 'active');
        const isEzCommand =
          isOperationActive &&
          (item.locState.operationalRole === 'ez_command' || item.user.operationalRole === 'ez_command') &&
          (item.user.arrivalStatus === 'ready' || item.user.arrivalStatus === 'ez_reached');

        const badge = isEzCommand
          ? { icon: '🏢', label: 'EZ-Leitstand', color: '#6366f1' }
          : getEquipmentBadge(item.user.equipment);

        const ezBadge = isEzCommand
          ? `<span class="bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded text-[9px] shadow border border-indigo-400">🏢 EZ</span>`
          : '';

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

        const isPaused = currentOperation?.status === 'paused';
        const statusBadgeHtml = isPaused
          ? '<span class="text-amber-300 font-bold">⏸️ Stand bei Pause</span>'
          : !item.isOnline
          ? `<span class="text-slate-400 font-normal">⚫ Offline (${freshnessText})</span>`
          : connStatus === 'active'
          ? '<span class="text-emerald-400 font-bold">🟢</span>'
          : connStatus === 'stale'
          ? `<span class="text-amber-300 font-bold">🟡 Funkloch (${freshnessText})</span>`
          : `<span class="text-rose-400 font-bold">🔴 Signal weg (${freshnessText})</span>`;

        const outerGlowClass = item.isMe
          ? 'bg-cyan-500/40 animate-ping'
          : isPaused
          ? 'bg-amber-500/30'
          : !item.isOnline
          ? 'bg-slate-500/20'
          : connStatus === 'active'
          ? 'bg-emerald-500/20'
          : connStatus === 'stale'
          ? 'bg-amber-500/40 animate-pulse'
          : 'bg-rose-500/30';

        const avatarBorderClass = isPaused
          ? 'border-amber-400 ring-2 ring-amber-400/40'
          : !item.isOnline
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
        const safeUserPhoto = sanitizeImageUrl(item.user.photoUrl);
        const safeUserName = escapeHtml(item.user.name);
        const safeCallSign = escapeHtml(item.user.callSign);

        const iconHtml = `
          <div class="relative group cursor-pointer">
            <div class="absolute -inset-1.5 rounded-full ${outerGlowClass}"></div>
            <div class="relative flex items-center justify-center h-10 w-10 rounded-full border-2 ${avatarBorderClass} shadow-2xl overflow-hidden" style="background-color: ${item.trackColor};">
              ${
                safeUserPhoto
                  ? `<img src="${safeUserPhoto}" alt="${safeUserName}" class="h-full w-full object-cover" />`
                  : `<span class="text-white font-bold text-xs">${escapeHtml(item.user.name.charAt(0))}</span>`
              }
            </div>
            <!-- Sub-badge with equipment icon -->
            <div class="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ${isEzCommand ? 'bg-indigo-900 text-white border-indigo-400' : 'bg-[#1E293B] text-xs border border-white/50'} shadow">
              ${badge.icon}
            </div>
            <!-- Call sign banner with Sector, Cluster Position & Connection Status -->
            <div class="absolute top-11 left-1/2 transform -translate-x-1/2 px-2 py-0.5 rounded ${item.isOnline ? 'bg-[#1E293B]/95 text-white' : 'bg-slate-800/90 text-slate-300'} text-[10px] font-semibold border border-slate-700 whitespace-nowrap shadow-md flex items-center gap-1">
              <span>${safeCallSign}</span>
              ${ezBadge}
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

  // Center on selected user when they change & ensure responders layer is active
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedUser) return;
    setShowResponders(true); // Always activate responders layer so they can be seen!

    const userLoc = userLocations[selectedUser.id];
    const targetPos =
      userLoc?.currentPosition ||
      userLoc?.trackHistory?.slice(-1)[0] ||
      currentOperation?.archivedTracks?.find((t) => t.userId === selectedUser.id)?.points?.slice(-1)[0] ||
      currentOperation?.headquartersLocation ||
      VEREINSBUERO_LOCATION;

    if (targetPos && typeof targetPos.lat === 'number' && typeof targetPos.lng === 'number') {
      mapInstanceRef.current.flyTo([targetPos.lat, targetPos.lng], 16, { duration: 1.2 });
    }
  }, [selectedUser, userLocations, currentOperation]);

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
          if (loc.trackHistory) {
            loc.trackHistory
              .filter((pt) => pt.operationId === currentOperation?.id)
              .forEach((pt) => allPoints.push([pt.lat, pt.lng]));
          }
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

      {/* PAUSED OPERATION BANNER */}
      {currentOperation?.status === 'paused' && !isArchiveMode && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[950] max-w-xl w-[94%] sm:w-auto bg-[#1E293B]/95 backdrop-blur-md border border-amber-500/70 rounded-2xl px-4 py-2.5 shadow-2xl text-slate-200 flex flex-wrap items-center justify-between gap-3 font-sans animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Pause className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <div className="font-bold text-amber-300 uppercase tracking-wider font-mono text-[10px] flex items-center gap-1.5">
                <span>⏸️ Einsatz pausiert / unterbrochen</span>
                {currentOperation.pausedReason && (
                  <span className="text-amber-400 font-normal">({currentOperation.pausedReason})</span>
                )}
              </div>
              <div className="text-slate-300 text-[11px] leading-snug">
                Positionen der Kräfte zeigen den Stand zur Pause. Tracking im Feld ist pausiert.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={captureMapSnapshot}
              disabled={isCapturingSnapshot}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg transition cursor-pointer shrink-0 disabled:opacity-50 font-mono"
              title="Aktuellen Stand als Lagebild im Protokoll speichern"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{isCapturingSnapshot ? 'Erfasse...' : '📸 Lagebild sichern'}</span>
            </button>
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

      {/* EZ Toast notification */}
      {ezToastNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1150] bg-indigo-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-xl shadow-2xl font-bold text-xs flex items-center gap-2 border border-indigo-400 animate-in fade-in zoom-in-95 duration-200">
          <Check className="w-4 h-4 text-indigo-300" />
          <span>{ezToastNotice}</span>
        </div>
      )}

      {/* Placement mode banner */}
      {isPlacingEzMode && (
        <div className="absolute top-16 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md z-[1100] bg-indigo-950/95 border-2 border-indigo-400 text-white p-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xl animate-pulse">🎯</span>
            <div className="text-xs">
              <strong className="block text-indigo-200">EZ-Platzierungsmodus aktiv</strong>
              <span className="text-slate-300 text-[11px]">Tippen Sie auf die Karte (z. B. Parkplatz oder Vereinshaus), um die EZ exakt dort zu platzieren.</span>
            </div>
          </div>
          <button
            onClick={() => setIsPlacingEzMode(false)}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-800 hover:bg-indigo-700 text-white text-xs font-bold border border-indigo-500/60 shrink-0 cursor-pointer"
          >
            Abbrechen
          </button>
        </div>
      )}

      {/* Warning banner: EZ is still in Aschersleben while active operation is out of town */}
      {ezDistanceWarning && !dismissEzWarning && (
        <div className="absolute top-16 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-2xl z-[1050] bg-rose-950/95 border-2 border-rose-500 text-white p-3.5 rounded-2xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="text-2xl shrink-0">🚨</span>
              <div className="text-xs space-y-1">
                <div className="font-black text-rose-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <span>Achtung: EZ steht noch in Aschersleben!</span>
                  <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-mono text-[9px] font-bold">
                    {ezDistanceWarning.distKm.toFixed(1)} km entfernt
                  </span>
                </div>
                <p className="text-rose-100/90 text-[11px] leading-tight">
                  Einsatzkräfte, die auf <strong>„Route zur EZ“ / „Navi“</strong> tippen, werden aktuell nach <strong>Aschersleben</strong> geleitet statt zum Einsatzort ({ezDistanceWarning.targetLabel})!
                </p>
              </div>
            </div>
            <button
              onClick={() => setDismissEzWarning(true)}
              className="text-rose-300 hover:text-white p-1 rounded-lg hover:bg-rose-800/50 transition cursor-pointer text-sm"
              title="Hinweis ausblenden"
            >
              ✕
            </button>
          </div>
          <div className="mt-2.5 pt-2 border-t border-rose-800/80 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => handleSetEzToPls(ezDistanceWarning.targetLat, ezDistanceWarning.targetLng, ezDistanceWarning.targetLabel)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer transition"
            >
              <span>📍 EZ an Einsatzort ({ezDistanceWarning.targetLabel}) verlegen</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPlacingEzMode(true);
                setDismissEzWarning(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-600 shadow flex items-center gap-1.5 cursor-pointer transition"
            >
              <span>🗺️ Auf Parkplatz/Karte platzieren</span>
            </button>
          </div>
        </div>
      )}

      {/* MOBILE FLOATING ACTION BAR (Top, compact, unobstructed view for smartphone searchers in portrait and landscape) */}
      {isMobileScreen && (
        <div className="absolute top-2 left-2 z-[900] flex items-center gap-1.5 pointer-events-none">
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

            {canManageOps && mode !== 'archive' && (
              <button
                onClick={() => setIsPlacingEzMode((prev) => !prev)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border font-mono ${
                  isPlacingEzMode
                    ? 'bg-indigo-600 text-white border-white animate-pulse'
                    : 'bg-indigo-950/70 text-indigo-300 border-indigo-700/60'
                }`}
                title="Einsatzzentrale auf Karte platzieren (oder langes Drücken)"
              >
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                <span>EZ Ort</span>
              </button>
            )}

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
      )}

      {/* MOBILE LAYERS MODAL SHEET (Clean drawer that doesn't permanently block map) */}
      {isLayersOpenMobile && (
        <div
          className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsLayersOpenMobile(false);
          }}
        >
          <div className="bg-[#1E293B] border border-slate-700 rounded-2xl p-4 w-full max-w-sm max-h-[85vh] overflow-y-auto shadow-2xl space-y-3.5 text-slate-200 animate-in slide-in-from-bottom duration-200">
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

            {/* Taktische Werkzeuge: Offline-Puffer & Import */}
            <div className="pt-2 border-t border-slate-700 space-y-1.5">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">EINSATZ-WERKZEUGE:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setIsLayersOpenMobile(false);
                    setIsGeoImportOpen(true);
                  }}
                  className="px-2.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer font-mono"
                  title="Externe GPX / KML Spuren & Sektoren importieren"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  <span>GPX/KML Import</span>
                </button>

                <button
                  onClick={() => {
                    setIsLayersOpenMobile(false);
                    setIsOfflineModalOpen(true);
                  }}
                  className="px-2.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer font-mono"
                  title="Kartenkacheln für das Funkloch vorab puffern"
                >
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Offline sichern</span>
                </button>
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
                      key={`${item.userId}-${item.phaseLabel || 'track'}`}
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
                          <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {item.phaseLabel?.includes('Phase 1') ? 'Phase 1' : item.phaseLabel?.includes('Phase 2') ? 'Phase 2' : item.isLive ? 'Live' : 'Gesichert'}
                          </span>
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
      {!isMobileScreen && isDesktopSidebarCollapsed && (
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
      {!isMobileScreen && !isDesktopSidebarCollapsed && (
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

              {/* Taktische Werkzeuge: Offline-Puffer & GPX/KML Import */}
              <div className="pt-2 border-t border-slate-700/80 space-y-1">
                <span className="text-[10px] text-slate-400 font-mono uppercase block">WERKZEUGE:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setIsGeoImportOpen(true)}
                    className="px-2 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer font-mono"
                    title="Externe GPX / KML Spuren & Sektoren importieren"
                  >
                    <FileUp className="w-3 h-3" />
                    <span>GPX/KML</span>
                  </button>

                  <button
                    onClick={() => setIsOfflineModalOpen(true)}
                    className="px-2 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer font-mono"
                    title="Kartenkacheln für das Funkloch vorab puffern"
                  >
                    <WifiOff className="w-3 h-3" />
                    <span>Offline</span>
                  </button>
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
                        key={`${item.userId}-${item.phaseLabel || 'track'}`}
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
                              item.phaseLabel?.includes('Phase 1')
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : item.isLive
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            }`}
                          >
                            {item.phaseLabel?.includes('Phase 1')
                              ? '📁 Phase 1 (Gestern)'
                              : item.phaseLabel?.includes('Phase 2')
                              ? '🟢 Phase 2 (Heute)'
                              : item.isLive
                              ? '🟢 Live'
                              : '📁 Gesichert'}
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

                {canManageOps && mode !== 'archive' && (
                  <button
                    onClick={() => setIsPlacingEzMode((prev) => !prev)}
                    className={`col-span-2 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer font-mono ${
                      isPlacingEzMode
                        ? 'bg-indigo-600 text-white shadow ring-2 ring-indigo-400 animate-pulse'
                        : 'bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/80'
                    }`}
                    title="Einsatzzentrale auf Karte platzieren (oder langes Drücken auf Karte)"
                  >
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{isPlacingEzMode ? 'Tippen Sie auf die Karte...' : '📍 EZ auf Karte platzieren / verschieben'}</span>
                  </button>
                )}
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
                      showConfirmModal({
                        title: 'Sektor löschen',
                        message: `Möchten Sie den Sektor "${selectedSector.name}" wirklich unwiderruflich löschen?`,
                        confirmLabel: 'Löschen',
                        isDanger: true,
                        onConfirm: () => {
                          deleteSector(selectedSector.id);
                          setSelectedSector(null);
                        },
                      });
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
              <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Zielort & Adresse</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isAdminOrEL && !isEditingEz && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEzNavData(null);
                            setIsPlacingEzMode(true);
                            setEzToastNotice('📍 Tippe mit dem Finger auf die gewünschte Stelle auf der Karte!');
                            setTimeout(() => setEzToastNotice(''), 5000);
                          }}
                          className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[10px] font-bold flex items-center gap-1 transition cursor-pointer shadow"
                          title="EZ mit dem Finger auf der Karte frei platzieren"
                        >
                          <span>✋ Mit Finger verschieben</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditEzAddress(ezNavData.address);
                            setEditEzLat(ezNavData.lat);
                            setEditEzLng(ezNavData.lng);
                            setIsEditingEz(true);
                            setEzGeocodeStatus('idle');
                          }}
                          className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[10px] font-bold flex items-center gap-1 transition cursor-pointer shadow"
                          title="EZ-Standort manuell anpassen"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Adresse</span>
                        </button>
                      </div>
                    )}
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      ezNavData.isStandbyOffice
                        ? 'bg-emerald-950/70 text-emerald-300 border-emerald-600/50'
                        : 'bg-indigo-950/70 text-indigo-300 border-indigo-500/50'
                    }`}>
                      {ezNavData.isStandbyOffice ? 'Standard-Büro' : 'Einsatz-Standort'}
                    </span>
                  </div>
                </div>

                {ezModalSuccess && (
                  <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>{ezModalSuccess}</span>
                  </div>
                )}

                {isEditingEz ? (
                  <div className="space-y-3 pt-1 border-t border-slate-800">
                    <div className="text-[11px] text-indigo-300 font-mono font-bold">
                      Standort der EZ neu festlegen:
                    </div>

                    {/* Schnellauswahl Vorlagen */}
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const savedHq = getSavedVereinsbueroLocation();
                          setEditEzAddress(savedHq.address);
                          setEditEzLat(savedHq.lat);
                          setEditEzLng(savedHq.lng);
                        }}
                        className="px-2 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700 text-[10px] font-mono transition cursor-pointer"
                      >
                        🏢 Vereinshaus Aschersleben
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEzNavData(null);
                          setIsPlacingEzMode(true);
                          setEzToastNotice('📍 Tippe mit dem Finger auf die Karte, um die EZ genau dort zu platzieren!');
                          setTimeout(() => setEzToastNotice(''), 5000);
                        }}
                        className="px-2 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 text-[10px] font-mono transition cursor-pointer flex items-center gap-1"
                      >
                        <span>✋ Mit Finger auf Karte setzen</span>
                      </button>
                      {currentOperation?.missingPerson?.lastSeenLocation && (
                        <button
                          type="button"
                          onClick={() => {
                            if (currentOperation.missingPerson?.lastSeenLocation?.address) {
                              setEditEzAddress(currentOperation.missingPerson.lastSeenLocation.address);
                            }
                            if (currentOperation.missingPerson?.lastSeenLocation?.lat) {
                              setEditEzLat(currentOperation.missingPerson.lastSeenLocation.lat);
                            }
                            if (currentOperation.missingPerson?.lastSeenLocation?.lng) {
                              setEditEzLng(currentOperation.missingPerson.lastSeenLocation.lng);
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-mono transition cursor-pointer"
                        >
                          📍 Wie Sichtort (PLS)
                        </button>
                      )}
                      {currentOperation?.missingPerson?.homeAddress && (
                        <button
                          type="button"
                          onClick={() => {
                            if (currentOperation.missingPerson?.homeAddress?.address) {
                              setEditEzAddress(currentOperation.missingPerson.homeAddress.address);
                            }
                            if (currentOperation.missingPerson?.homeAddress?.lat) {
                              setEditEzLat(currentOperation.missingPerson.homeAddress.lat);
                            }
                            if (currentOperation.missingPerson?.homeAddress?.lng) {
                              setEditEzLng(currentOperation.missingPerson.homeAddress.lng);
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-mono transition cursor-pointer"
                        >
                          🏠 Wie Wohnanschrift
                        </button>
                      )}
                      {myLocation && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditEzLat(Number(myLocation.lat.toFixed(6)));
                            setEditEzLng(Number(myLocation.lng.toFixed(6)));
                            setEditEzAddress('EZ vor Ort (Aktuelles GPS)');
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-mono transition cursor-pointer"
                        >
                          🧭 Mein GPS
                        </button>
                      )}
                    </div>

                    {/* Adresse & Geocoding */}
                    <div>
                      <label className="block text-slate-400 font-mono text-[10px] uppercase mb-1">
                        Adresse / Bereitstellungsraum:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editEzAddress}
                          onChange={(e) => {
                            setEditEzAddress(e.target.value);
                            setEzGeocodeStatus('idle');
                          }}
                          placeholder="z.B. Hohe Straße 15, Aschersleben oder Parkplatz"
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-sans"
                        />
                        <button
                          type="button"
                          disabled={isGeocodingEz || !editEzAddress.trim()}
                          onClick={() => geocodeEzAddress(editEzAddress)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 disabled:bg-slate-800 text-white text-[11px] font-mono font-bold flex items-center gap-1 transition cursor-pointer shrink-0"
                        >
                          {isGeocodingEz ? <Sparkles className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                          <span>Suchen</span>
                        </button>
                      </div>
                      {ezGeocodeStatus === 'success' && (
                        <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                          <Check className="w-3 h-3" /> Koordinaten gefunden.
                        </span>
                      )}
                      {ezGeocodeStatus === 'not_found' && (
                        <span className="text-[10px] text-amber-400 font-mono mt-0.5 block">
                          Adresse nicht gefunden. Bitte GPS manuell anpassen.
                        </span>
                      )}
                    </div>

                    {/* Koordinaten Inputs */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div>
                        <label className="block text-slate-400 text-[9px] uppercase">Breite (Lat):</label>
                        <input
                          type="number"
                          step="0.000001"
                          value={editEzLat}
                          onChange={(e) => setEditEzLat(Number(e.target.value))}
                          placeholder={String(VEREINSBUERO_LOCATION.lat)}
                          className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-[9px] uppercase">Länge (Lng):</label>
                        <input
                          type="number"
                          step="0.000001"
                          value={editEzLng}
                          onChange={(e) => setEditEzLng(Number(e.target.value))}
                          placeholder={String(VEREINSBUERO_LOCATION.lng)}
                          className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white text-xs"
                        />
                      </div>
                    </div>

                    {/* Speichern Button */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingEz(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition cursor-pointer"
                      >
                        Abbrechen
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEzFromMapModal}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-mono font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md uppercase tracking-wider"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>EZ-Standort speichern</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="font-bold text-sm sm:text-base text-white leading-snug">
                      {ezNavData.address}
                    </div>

                    {ezNavData.operationTitle && !ezNavData.isStandbyOffice && (
                      <div className="text-[11px] text-slate-300 bg-slate-800/60 p-2 rounded-lg border border-slate-700/60">
                        Einsatz: <strong className="text-white">{ezNavData.operationTitle}</strong>
                        {ezNavData.commander && <> • Leitung: <strong className="text-white">{ezNavData.commander}</strong></>}
                      </div>
                    )}
                  </>
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

                {/* Forces stationed / present in EZ */}
                {ezNavData.ezResponders && ezNavData.ezResponders.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <span>🏢</span>
                        <span>Eingetroffene Kräfte in der EZ:</span>
                      </span>
                      <span className="px-2 py-0.5 bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 rounded-full font-mono text-[10px] font-bold">
                        {ezNavData.ezResponders.length} aktiv
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                      {ezNavData.ezResponders.map((resp) => (
                        <div
                          key={resp.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-sm">{resp.operationalRole === 'ez_command' ? '🏢' : '👤'}</span>
                            <div className="truncate">
                              <div className="font-bold text-slate-200 truncate">{resp.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{resp.callSign || 'EZ-Leitstand'}</div>
                            </div>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 shrink-0">
                            {resp.operationalRole === 'ez_command' ? 'Leitung' : 'EZ da'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* OPERATIONAL ROLE SWITCHER FOR ADMIN / EL IN EZ MODAL */}
                {isAdminOrEL && currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused') && (
                  <div className="mb-3 p-3 rounded-xl bg-slate-900 border border-amber-500/50 flex items-center justify-between font-mono text-xs shadow-inner">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg shrink-0">{operationalRole === 'ez_command' ? '🏢' : '🚶'}</span>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-xs truncate">
                          {operationalRole === 'ez_command' ? 'Status: In der EZ' : 'Status: Sucher'}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {operationalRole === 'ez_command' ? 'Keine Trackingspur auf Karte' : 'Trackingspur wird live aufgezeichnet'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleOperationalRole()}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition border shadow cursor-pointer shrink-0 ${
                        operationalRole === 'ez_command'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400'
                      }`}
                      title={operationalRole === 'ez_command' ? 'Zu Sucher wechseln (Spur aufzeichnen)' : 'In die EZ wechseln (Spur pausieren)'}
                    >
                      {operationalRole === 'ez_command' ? '🚶 Zu Sucher' : '🏢 Zu EZ'}
                    </button>
                  </div>
                )}

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

      {/* EZ MOVE / CONFIRMATION MODAL AFTER LONG-PRESS OR TAP */}
      {ezMoveModal && (
        <div
          className="fixed inset-0 z-[6000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150 font-sans"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEzMoveModal(null);
          }}
        >
          <div className="bg-[#1E293B] border-2 border-indigo-500 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col text-slate-100 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-b border-indigo-500/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/60 text-indigo-300 flex items-center justify-center text-xl shrink-0 shadow-inner">
                  📍
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-white text-sm sm:text-base uppercase tracking-wide">
                    {ezMoveModal.isStandby ? '🏢 Standard-EZ auf Vereinshaus positionieren' : '📡 Einsatzzentrale (EZ) verlegen'}
                  </h3>
                  <div className="text-[11px] text-indigo-300 font-mono">
                    {ezMoveModal.isStandby ? 'Standard-Standort für Bereitschaft (Hohe Str. 15)' : `Einsatz: ${currentOperation?.title}`}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setEzMoveModal(null)}
                className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer border border-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 space-y-4 text-xs">
              <p className="text-slate-300 text-xs">
                {ezMoveModal.isStandby
                  ? 'Möchten Sie die Standard-Position der Einsatzzentrale (Vereinsbüro Aschersleben) exakt auf diesen Punkt (z. B. auf das Vereinshaus statt auf die Straße) setzen und dauerhaft speichern?'
                  : 'Soll die Einsatzzentrale (EZ) an diesen genauen Punkt im Gelände (z. B. Waldparkplatz / Bereitstellungsraum) verlegt werden? Alle Einsatzkräfte navigieren ab sofort hierher.'}
              </p>

              {/* GPS Badge & Inputs */}
              <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between font-mono text-[11px] pb-2 border-b border-slate-800">
                  <span className="text-slate-400">GPS-Koordinaten:</span>
                  <span className="text-indigo-300 font-bold">
                    {ezMoveModal.lat.toFixed(6)}° N, {ezMoveModal.lng.toFixed(6)}° E
                  </span>
                </div>

                {/* Address field with reverse geocoding indicator */}
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                    {ezMoveModal.isLoadingAddress ? 'Ermittle Adresse über OpenStreetMap...' : 'Ermittelte Adresse / Standort:'}
                  </label>
                  <input
                    type="text"
                    value={ezMoveModal.address}
                    onChange={(e) => setEzMoveModal({ ...ezMoveModal, address: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                    placeholder="z.B. Waldparkplatz oder Hohe Straße 15"
                  />
                </div>

                {/* Description field */}
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                    Bezeichnung / Lagehinweis (optional):
                  </label>
                  <input
                    type="text"
                    value={ezMoveModal.description}
                    onChange={(e) => setEzMoveModal({ ...ezMoveModal, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                    placeholder={ezMoveModal.isStandby ? 'Vereinshaus Aschersleben' : 'z.B. Parkplatz Forsthaus / ELW 1'}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setEzMoveModal(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold font-mono transition cursor-pointer border border-slate-700 text-center"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmEzMove()}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold font-mono transition cursor-pointer shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{ezMoveModal.isStandby ? 'Auf Vereinshaus sichern' : 'EZ hierher verlegen'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DESKTOP / TABLET FLOATING WEATHER OVERLAY (Top-Right of Map, Draggable) */}
      {!isMobileScreen && showWeatherOverlay && (
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
          className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsWeatherModalOpenMobile(false);
          }}
        >
          <div className="w-full max-w-sm max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            <TacticalWeatherOverlay
              lat={weatherTarget.lat}
              lng={weatherTarget.lng}
              locationTitle={weatherTarget.title}
              onClose={() => setIsWeatherModalOpenMobile(false)}
            />
          </div>
        </div>
      )}

      {/* GeoImport Modal (GPX/KML) */}
      <GeoImportModal
        isOpen={isGeoImportOpen}
        onClose={() => setIsGeoImportOpen(false)}
        onImportSectors={handleImportSectors}
        onImportTracks={handleImportTracks}
        onImportWaypoints={handleImportWaypoints}
        activeOperationTitle={currentOperation?.title}
      />

      {/* Offline Map Pre-Caching Modal */}
      <OfflineMapModal
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
        operationTitle={currentOperation?.title}
        searchBounds={operationSearchBounds}
      />
    </div>
  );
};
