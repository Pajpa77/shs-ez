export type UserRole = 'admin' | 'einsatzleitung' | 'responder' | 'observer' | 'group_leader';

export type EquipmentType =
  | 'drone'
  | 'k9_mantrailer'
  | 'k9_area'
  | 'k9_cadaver'
  | 'quad'
  | 'boat'
  | 'flir'
  | 'foot_search'
  | 'first_aid';

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  isAdmin?: boolean; // Erlaubt die Kombination: Einsatzleitung mit Admin-Rechten
  canLeadOperations?: boolean; // Erlaubt operativer Einsatzleiter zu sein
  callSign: string; // Funkrufname (e.g. "Kater 1/4", "Sucher Alpha")
  licensePlate: string; // KFZ-Kennzeichen (e.g. "M-RD 204")
  photoUrl: string;
  phone: string;
  equipment: EquipmentType[];
  customEquipmentTags?: string[]; // Individuelle Hilfsmittel / Freitext-Tags (z.B. "Leichenspürhund", "FLIR XT2", "Schlauchboot")
  customEquipmentNotes?: string;
  organization?: string; // e.g. DRK, BRK, DLRG, Bergwacht, Feuerwehr, THW, Rettungshundestaffel
  assignedSectorId?: string;
  groupId?: string;
  isActive: boolean;
  batteryLevel?: number;
  batteryCharging?: boolean;
  lastSeen?: string;
  activeSessionId?: string;
  lastHeartbeat?: number; // Timestamp des letzten Heartbeats in ms
  arrivalStatus?: 'in_transit' | 'ez_reached' | 'ready';
  currentLocation?: GpsPoint;
  trackColor?: string; // Individuelle Suchspur-Farbe für die Lagekarte
  dogInfo?: { name?: string; breed?: string; qualification?: string };
  lastTrackingTest?: {
    passed: boolean;
    date: string;
    pointsCount: number;
    distanceMeters: number;
    durationMinutes: number;
  };
  isFirstAdmin?: boolean; // First Admin & App-Owner (unantastbar)
  isOwner?: boolean; // App-Owner (unantastbar vor anderen Admins)
  updatedAt?: string;
}

export const isFirstAdmin = (user: User | null | undefined): boolean => {
  if (!user || !user.id) return false;
  
  // Strictly enforce the hardcoded First-Admin Maria by ID
  if (user.id === 'user-maria') return true;
  
  // Also check if the flag is explicitly set
  if (user.isFirstAdmin === true || user.isOwner === true) return true;
  
  // Match by username/name ONLY if the ID also starts with 'user-maria' 
  // (to prevent accidental takeovers by new users named Maria)
  const uname = (user.username || '').toLowerCase();
  const name = (user.name || '').toLowerCase();
  
  if (uname === 'maria' || name === 'maria') {
    // If it's a legacy account or the specific seeded one, allow it
    if (user.id === 'user-maria' || user.id.startsWith('user-maria-')) return true;
  }
  
  return false;
};

export const isOwner = isFirstAdmin;

export const isUserAdmin = (user: User | null | undefined): boolean => {
  return Boolean(user && (user.role === 'admin' || user.isAdmin === true || isFirstAdmin(user)));
};

export const isUserEL = (user: User | null | undefined): boolean => {
  return Boolean(user && (user.role === 'einsatzleitung' || user.role === 'admin' || user.canLeadOperations === true));
};

export const isUserAdminOrEL = (user: User | null | undefined): boolean => {
  return isUserAdmin(user) || isUserEL(user);
};

export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: string;
  accuracy?: number; // in meters
  speed?: number; // in km/h
  altitude?: number;
}

export interface UserLocationState {
  userId: string;
  currentPosition: GpsPoint;
  trackHistory: GpsPoint[]; // GPS Bewegungsprofil / Breadcrumbs
  isLive: boolean;
  lastUpdated: string;
}

export type OperationType = 'operation' | 'exercise' | 'live_search'; // Einsatz vs. Übung
export type OperationStatus = 'active' | 'paused' | 'completed' | 'archived';

export type SectorStatus = 'open' | 'in_progress' | 'searched' | 'suspicious';
export type SectorPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface SearchSector {
  id: string;
  operationId: string;
  name: string; // z.B. "Sektor A - Waldstück Nord"
  polygon: [number, number][]; // [[lat, lng], ...]
  status: SectorStatus; // 'open' | 'in_progress' | 'searched' (grün) | 'suspicious'
  priority: SectorPriority;
  assignedUserIds: string[];
  assignedGroupName?: string;
  assignedEquipment: EquipmentType[];
  notes?: string;
  color?: string;
  areaHectares?: number;
  areaM2?: number;
  assignedUserNames?: string[];
  clearedAt?: string;
  clearedBy?: string;
}

export interface SearchTeam {
  id: string;
  operationId: string;
  name: string; // z.B. "Suchtrupp Alpha"
  leaderUserId: string; // Truppführer (eingeloggter User)
  memberUserIds: string[]; // Sucher (eingeloggte User)
  externalVolunteersCount: number; // Anzahl freiw. Helfer (einmalige Helfer ohne Account)
  sectorIds: string[]; // Mehrere Suchsektoren zugeteilt
  notes?: string;
}

export interface MissingPerson {
  name: string;
  age: number;
  gender: 'male' | 'female' | 'diverse';
  photoUrl: string;
  lastSeenTime: string;
  lastSeenLocation: {
    lat: number;
    lng: number;
    address: string;
    description?: string;
  };
  homeAddress?: {
    lat?: number;
    lng?: number;
    address: string;
    notes?: string;
  };
  clothing: string;
  description: string;
  medicalConditions: string[]; // e.g. "Demenz", "Diabetiker", "Herzkrank"
  specialRisks?: string;
  emergencyContact?: string;
  policeCaseId?: string;
}

export type FindingCategory =
  | 'person_alive'
  | 'person_injured'
  | 'person_deceased'
  | 'clothing'
  | 'trail_scent'
  | 'personal_item'
  | 'drone_thermal'
  | 'witness_tip'
  | 'other';

export type FindingUrgency = 'standard' | 'high' | 'critical';

export interface Finding {
  id: string;
  operationId: string;
  userId: string;
  userName: string;
  userCallSign: string;
  userLicensePlate?: string;
  timestamp: string;
  location: GpsPoint;
  category: FindingCategory;
  title: string;
  description: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  urgency: FindingUrgency;
  verified: boolean;
  status?: 'pending' | 'verified' | 'false_alarm';
  archivedAt?: string;
  adminNotes?: string;
}

export interface ChatMessage {
  id: string;
  operationId: string; // Operation-ID oder 'general' für allgemeinen Vereinsfunk
  senderId: string;
  senderName: string;
  senderCallSign: string;
  senderRole: UserRole;
  senderPhotoUrl?: string;
  channel: 'all' | 'admins' | 'general' | string; // 'all', 'admins', 'general', or sectorId / direct target
  isDirect: boolean;
  recipientId?: string;
  text: string;
  timestamp: string;
  isAlert?: boolean;
  location?: GpsPoint;
  attachmentUrl?: string;
  audioUrl?: string;
  audioDuration?: number; // seconds
  isVoiceMessage?: boolean;
}

export interface OperationLogEntry {
  id: string;
  operationId: string;
  timestamp: string;
  authorName: string;
  authorRole: UserRole;
  category: 'status' | 'finding' | 'sector' | 'member' | 'radio' | 'general' | 'end' | 'pause';
  text: string;
  snapshotUrl?: string; // Lagekarten-Screenshot zum Zeitpunkt des Protokolleintrags
}

export interface ArchivedSearchTrack {
  id: string;
  userId: string;
  userName: string;
  callSign: string;
  color?: string;
  phaseLabel?: string; // z.B. "Suchphase 1 (24.08.)", "Erstsuche"
  recordedAt: string;
  points: GpsPoint[];
}

export interface TrackingTestSession {
  userId: string;
  userName: string;
  startTime: string;
  durationMinutes: 10 | 20 | 30;
  endTime: string;
  isActive: boolean;
  isCompleted: boolean;
  trackPoints: GpsPoint[];
  snapshotUrl?: string;
}

export interface SearchOperation {
  id: string;
  title: string;
  type: OperationType; // 'operation' (Einsatz) | 'exercise' (Übung)
  status: OperationStatus;
  createdAt: string;
  completedAt?: string;
  pausedAt?: string;
  pausedReason?: string;
  outcome?: 'person_alive' | 'person_transferred' | 'aborted' | 'person_deceased' | 'exercise_completed';
  closingNotes?: string;
  weatherConditions?: string;
  commander: string;
  ezAdminIds?: string[]; // Admins assigned to EZ (at least one required)
  headquartersLocation?: {
    lat: number;
    lng: number;
    address: string;
    description?: string;
  };
  missingPerson: MissingPerson;
  searchAreaPolygon?: [number, number][]; // Gesamt-Suchgebiet Umriss
  searchAreaHectares?: number;
  searchAreaName?: string;
  searchAreaNotes?: string;
  phase?: number;
  description?: string;
  sectors: SearchSector[];
  teams?: SearchTeam[];
  findings: Finding[];
  logs: OperationLogEntry[];
  participantIds: string[];
  externalVolunteersCount?: number; // Freiwillige Helfer ohne App
  externalVolunteersNotes?: string; // z.B. Organisationen / Gruppen (Feuerwehr, DLRG)
  selectedEquipment?: EquipmentType[]; // Im Einsatz-Editor ausgewähltes Einsatzmaterial
  customEquipmentNotes?: string;
  mapSnapshotUrl?: string; // Gespeicherter Kartenscreenshot mit allen Aufzeichnungen
  mapSnapshot?: string;
  mapSnapshots?: { url: string; timestamp: string; label: string }[];
  archivedTracks?: ArchivedSearchTrack[];
  archivedChatMessages?: ChatMessage[]; // Vollständig gesicherter Einsatz-Funk- und Chatverlauf
  notes?: string;
  updatedAt?: string;
}

// 16 hochkontrastreiche taktische Farben für Suchspuren (auf OSM-, Topo- und Satellitenkarten optimal unterscheidbar)
export const TACTICAL_TRACK_COLORS = [
  '#06b6d4', // 1. Türkis / Cyan (Standard maria)
  '#f97316', // 2. Leuchtendes Orange
  '#10b981', // 3. Smaragdgrün
  '#a855f7', // 4. Kräftiges Violett
  '#eab308', // 5. Warmer Bernsteingold
  '#ec4899', // 6. Magenta / Pink
  '#3b82f6', // 7. Klares Königsblau
  '#14b8a6', // 8. Helles Teal / Minzgrün
  '#ef4444', // 9. Signalrot
  '#84cc16', // 10. Limette / Hellgrün
  '#6366f1', // 11. Indigo
  '#f43f5e', // 12. Koralle / Rose
  '#ea580c', // 13. Rostorange
  '#0284c7', // 14. Himmelblau
  '#d946ef', // 15. Fuchsia
  '#facc15', // 16. Sonnengelb
];

/**
 * Liefert eine feste, unveränderliche Spurfarbe für einen Benutzer.
 * 1. Priorität: Individuell gesetztes `user.trackColor`
 * 2. Priorität: Fester Index in allUsers (Reihenfolge bleibt stabil)
 * 3. Fallback: Deterministischer Hash des user.id Strings
 */
export function getUserTrackColor(user?: Partial<User> | string | null, allUsers?: User[]): string {
  if (!user) return TACTICAL_TRACK_COLORS[0];

  if (typeof user === 'object' && user.trackColor) {
    return user.trackColor;
  }

  const userId = typeof user === 'string' ? user : user.id;
  if (!userId) return TACTICAL_TRACK_COLORS[0];

  if (allUsers && allUsers.length > 0) {
    const idx = allUsers.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      return TACTICAL_TRACK_COLORS[idx % TACTICAL_TRACK_COLORS.length];
    }
  }

  // Deterministischer Hash des User-IDs für garantiert konsistente Farben
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  const colorIdx = Math.abs(hash) % TACTICAL_TRACK_COLORS.length;
  return TACTICAL_TRACK_COLORS[colorIdx];
}
