import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { SearchOperation, SearchSector, SearchTeam, Finding, OperationLogEntry, UserLocationState, GpsPoint, ChatMessage, User, ArchivedSearchTrack } from '../types';
import { VEREINSBUERO_LOCATION } from '../mockData';

// Silence verbose backoff warnings when quota limits or network glitches occur
try {
  setLogLevel('error');
} catch {
  // ignore
}

// Initialize Firebase App instance safely (singleton pattern)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore Database with designated custom databaseId if configured
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const isFirebaseConfigured = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);

export const FIREBASE_CONSOLE_QUOTA_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId || 'shs-ea'}/firestore/databases/${firebaseConfig.firestoreDatabaseId || '(default)'}/data?openUpgradeDialog=true`;

// Global Quota Exhaustion Manager
let isQuotaExhaustedState = false;
let lastQuotaErrorTimestamp = 0;
const quotaListeners = new Set<(exhausted: boolean) => void>();

export function getIsQuotaExhausted(): boolean {
  // If more than 60 seconds passed since last quota error, allow re-probing
  if (isQuotaExhaustedState && Date.now() - lastQuotaErrorTimestamp > 60000) {
    isQuotaExhaustedState = false;
    quotaListeners.forEach((cb) => cb(false));
  }
  return isQuotaExhaustedState;
}

export function setQuotaExhausted(exhausted: boolean = true) {
  isQuotaExhaustedState = exhausted;
  if (exhausted) {
    lastQuotaErrorTimestamp = Date.now();
  }
  quotaListeners.forEach((cb) => cb(exhausted));
}

export function resetQuotaExhaustedState() {
  setQuotaExhausted(false);
}

export function onQuotaExhaustedChange(cb: (exhausted: boolean) => void): () => void {
  quotaListeners.add(cb);
  return () => quotaListeners.delete(cb);
}

export function isQuotaError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as any)?.code;
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('Free daily write units') ||
    msg.includes('quota metric')
  );
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

/**
 * Executes a Firestore write safely.
 * Attempts the write, catches quota or network errors gracefully,
 * and clears the quota flag if the write succeeds.
 */
export async function safeFirestoreWrite<T>(
  writeFn: () => Promise<T>,
  contextName: string
): Promise<T | null> {
  try {
    const res = await writeFn();
    if (isQuotaExhaustedState) {
      setQuotaExhausted(false);
    }
    return res;
  } catch (err: any) {
    if (isQuotaError(err)) {
      setQuotaExhausted(true);
      console.warn(
        `[Firestore Quota] Tägliches Firestore-Schreibkontingent erreicht (${contextName}). App schaltet nahtlos auf lokalen Speicher und Browser-Funk um.`
      );
      return null;
    }
    handleFirestoreError(err, OperationType.WRITE, contextName);
    return null;
  }
}

/**
 * Helper to recursively remove undefined fields so Firestore setDoc/updateDoc never fails
 */
export function cleanUndefinedFields<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanUndefinedFields(item)) as unknown as T;
  }
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      result[key] = typeof val === 'object' && val !== null ? cleanUndefinedFields(val) : val;
    }
  }
  return result as T;
}

/**
 * User Profile Firestore Serialization & Deserialization
 */
export function serializeUserForFirestore(user: User): Record<string, any> {
  const data: Record<string, any> = {
    id: user.id,
    username: user.username || '',
    password: user.password || 'sucher123',
    name: user.name || '',
    role: user.role || 'responder',
    callSign: user.callSign || '',
    licensePlate: user.licensePlate || '',
    photoUrl: user.photoUrl || '',
    phone: user.phone || '',
    equipment: Array.isArray(user.equipment) ? user.equipment : ['foot_search'],
    customEquipmentTags: Array.isArray(user.customEquipmentTags) ? user.customEquipmentTags : [],
    customEquipmentNotes: user.customEquipmentNotes || '',
    organization: user.organization || '',
    assignedSectorId: user.assignedSectorId || '',
    isActive: user.isActive ?? true,
    batteryLevel: user.batteryLevel !== undefined ? user.batteryLevel : 100,
    batteryCharging: Boolean(user.batteryCharging),
    lastSeen: user.lastSeen || 'Online',
    activeSessionId: user.activeSessionId || '',
    lastHeartbeat: user.lastHeartbeat || 0,
    isAdmin: Boolean(user.isAdmin || user.role === 'admin' || user.isFirstAdmin),
    canLeadOperations: Boolean(user.canLeadOperations || user.role === 'einsatzleitung' || user.role === 'admin' || user.isFirstAdmin),
    isFirstAdmin: Boolean(user.isFirstAdmin || user.id === 'user-maria' || (user.username?.toLowerCase() === 'maria' && user.id === 'user-maria')),
    isOwner: Boolean(user.isOwner || user.id === 'user-maria' || (user.username?.toLowerCase() === 'maria' && user.id === 'user-maria')),
    arrivalStatus: user.arrivalStatus || '',
    updatedAt: new Date().toISOString(),
  };
  return cleanUndefinedFields(data);
}

export function deserializeUserFromFirestore(data: any): User {
  const uname = (data.username || '').toLowerCase();
  const rname = (data.name || '').toLowerCase();
  const isMaria = data.id === 'user-maria' || 
                  ((uname === 'maria' || rname === 'maria') && (data.id === 'user-maria' || (data.id && data.id.startsWith('user-maria-'))));
  
  return {
    id: data.id,
    username: data.username || '',
    password: data.password || 'sucher123',
    name: data.name || '',
    role: isMaria ? 'admin' : (data.role || 'responder'),
    isAdmin: isMaria ? true : (data.isAdmin !== undefined ? Boolean(data.isAdmin) : data.role === 'admin'),
    canLeadOperations: isMaria ? true : (data.canLeadOperations !== undefined ? Boolean(data.canLeadOperations) : (data.role === 'einsatzleitung' || data.role === 'admin')),
    isFirstAdmin: isMaria,
    isOwner: isMaria,
    callSign: data.callSign || '',
    licensePlate: data.licensePlate || '',
    photoUrl: data.photoUrl || '',
    phone: data.phone || '',
    equipment: Array.isArray(data.equipment) ? data.equipment : ['foot_search'],
    customEquipmentTags: Array.isArray(data.customEquipmentTags) ? data.customEquipmentTags : [],
    customEquipmentNotes: data.customEquipmentNotes || '',
    organization: data.organization || '',
    assignedSectorId: data.assignedSectorId || undefined,
    isActive: data.isActive ?? true,
    batteryLevel: data.batteryLevel !== undefined ? Number(data.batteryLevel) : 100,
    batteryCharging: Boolean(data.batteryCharging),
    lastSeen: data.lastSeen || 'Online',
    activeSessionId: data.activeSessionId || undefined,
    lastHeartbeat: data.lastHeartbeat !== undefined ? Number(data.lastHeartbeat) : undefined,
    arrivalStatus: data.arrivalStatus || undefined,
    updatedAt: data.updatedAt || undefined,
  };
}

/**
 * Firestore does not allow nested arrays (e.g. polygon: [[lat, lng], ...], or arrays inside array of maps).
 * We serialize nested array structures into clean JSON strings before saving to Firestore,
 * and deserialize them safely when reading back.
 */
export function serializeOperationForFirestore(op: SearchOperation): Record<string, any> {
  const data: Record<string, any> = {
    id: op.id,
    title: op.title || 'Einsatz',
    type: op.type || 'operation',
    status: op.status || 'active',
    createdAt: op.createdAt || new Date().toISOString(),
    commander: op.commander || 'Einsatzleitung',
    headquartersLocation: op.headquartersLocation || null,
    missingPerson: op.missingPerson ? JSON.stringify(op.missingPerson) : '',
    searchAreaPolygonJson: JSON.stringify(op.searchAreaPolygon || []),
    searchAreaHectares: typeof op.searchAreaHectares === 'number' ? op.searchAreaHectares : 0,
    searchAreaName: op.searchAreaName || '',
    searchAreaNotes: op.searchAreaNotes || '',
    sectorsJson: JSON.stringify(op.sectors || []),
    teamsJson: JSON.stringify(op.teams || []),
    findingsJson: JSON.stringify(op.findings || []),
    logsJson: JSON.stringify(op.logs || []),
    archivedTracksJson: JSON.stringify(op.archivedTracks || []),
    archivedChatMessagesJson: JSON.stringify(op.archivedChatMessages || []),
    participantIds: Array.isArray(op.participantIds) ? op.participantIds : [],
    externalVolunteersCount: typeof op.externalVolunteersCount === 'number' ? op.externalVolunteersCount : 0,
    externalVolunteersNotes: op.externalVolunteersNotes || '',
    selectedEquipment: Array.isArray(op.selectedEquipment) ? op.selectedEquipment : [],
    customEquipmentNotes: op.customEquipmentNotes || '',
    mapSnapshotUrl: op.mapSnapshotUrl || '',
    notes: op.notes || '',
    completedAt: op.completedAt || null,
    pausedAt: op.pausedAt || null,
    pausedReason: op.pausedReason || null,
    outcome: op.outcome || null,
    closingNotes: op.closingNotes || null,
    updatedAt: new Date().toISOString(),
  };
  return cleanUndefinedFields(data);
}

export function deserializeOperationFromFirestore(data: any): SearchOperation {
  let sectors: SearchSector[] = [];
  if (data.sectorsJson) {
    try {
      sectors = JSON.parse(data.sectorsJson);
    } catch (e) {
      console.warn('Error parsing sectorsJson:', e);
    }
  } else if (Array.isArray(data.sectors)) {
    sectors = data.sectors;
  }

  let teams: SearchTeam[] = [];
  if (data.teamsJson) {
    try {
      teams = JSON.parse(data.teamsJson);
    } catch (e) {
      console.warn('Error parsing teamsJson:', e);
    }
  } else if (Array.isArray(data.teams)) {
    teams = data.teams;
  }

  let findings: Finding[] = [];
  if (data.findingsJson) {
    try {
      findings = JSON.parse(data.findingsJson);
    } catch (e) {
      console.warn('Error parsing findingsJson:', e);
    }
  } else if (Array.isArray(data.findings)) {
    findings = data.findings;
  }

  let logs: OperationLogEntry[] = [];
  if (data.logsJson) {
    try {
      logs = JSON.parse(data.logsJson);
    } catch (e) {
      console.warn('Error parsing logsJson:', e);
    }
  } else if (Array.isArray(data.logs)) {
    logs = data.logs;
  }

  let archivedTracks: ArchivedSearchTrack[] = [];
  if (data.archivedTracksJson) {
    try {
      archivedTracks = JSON.parse(data.archivedTracksJson);
    } catch (e) {
      console.warn('Error parsing archivedTracksJson:', e);
    }
  } else if (Array.isArray(data.archivedTracks)) {
    archivedTracks = data.archivedTracks;
  }

  let archivedChatMessages: any[] = [];
  if (data.archivedChatMessagesJson) {
    try {
      archivedChatMessages = JSON.parse(data.archivedChatMessagesJson);
    } catch (e) {
      console.warn('Error parsing archivedChatMessagesJson:', e);
    }
  } else if (Array.isArray(data.archivedChatMessages)) {
    archivedChatMessages = data.archivedChatMessages;
  }

  let missingPerson = data.missingPerson;
  if (typeof data.missingPerson === 'string' && data.missingPerson.trim().startsWith('{')) {
    try {
      missingPerson = JSON.parse(data.missingPerson);
    } catch (e) {
      console.warn('Error parsing missingPerson:', e);
    }
  }

  let searchAreaPolygon: [number, number][] = [];
  if (data.searchAreaPolygonJson) {
    try {
      searchAreaPolygon = JSON.parse(data.searchAreaPolygonJson);
    } catch (e) {
      console.warn('Error parsing searchAreaPolygonJson:', e);
    }
  } else if (Array.isArray(data.searchAreaPolygon)) {
    searchAreaPolygon = data.searchAreaPolygon;
  }

  return {
    id: data.id,
    title: data.title || 'Einsatz',
    type: data.type || 'operation',
    status: data.status || 'active',
    createdAt: data.createdAt || new Date().toISOString(),
    commander: data.commander || 'Einsatzleitung',
    headquartersLocation: data.headquartersLocation || {
      lat: 51.75696,
      lng: 11.45352,
      address: 'Vereinsbüro Spürhunde-Salzlandkreis e.V., Hohe Straße 15, 06449 Aschersleben',
    },
    missingPerson: missingPerson || {
      name: 'Vermisste Person',
      age: 40,
      gender: 'male',
      photoUrl: '',
      lastSeenTime: '',
      lastSeenLocation: { lat: 51.75696, lng: 11.45352, address: 'Aschersleben' },
      clothing: '',
      description: '',
      medicalConditions: [],
    },
    searchAreaPolygon,
    searchAreaHectares: typeof data.searchAreaHectares === 'number' ? data.searchAreaHectares : 0,
    searchAreaName: data.searchAreaName || '',
    searchAreaNotes: data.searchAreaNotes || '',
    sectors,
    teams,
    findings,
    logs,
    archivedTracks,
    archivedChatMessages,
    participantIds: Array.isArray(data.participantIds) ? data.participantIds : [],
    externalVolunteersCount: typeof data.externalVolunteersCount === 'number' ? data.externalVolunteersCount : 0,
    externalVolunteersNotes: data.externalVolunteersNotes || '',
    selectedEquipment: Array.isArray(data.selectedEquipment) ? data.selectedEquipment : [],
    customEquipmentNotes: data.customEquipmentNotes || '',
    mapSnapshotUrl: data.mapSnapshotUrl || '',
    notes: data.notes || '',
    completedAt: data.completedAt || undefined,
    pausedAt: data.pausedAt || undefined,
    pausedReason: data.pausedReason || undefined,
    outcome: data.outcome || undefined,
    closingNotes: data.closingNotes || undefined,
    updatedAt: data.updatedAt || data.createdAt || undefined,
  };
}

export function serializeLocationForFirestore(loc: UserLocationState): Record<string, any> {
  const data: Record<string, any> = {
    userId: loc.userId,
    isLive: loc.isLive ?? true,
    lastUpdated: loc.lastUpdated || new Date().toISOString(),
    currentPosition: loc.currentPosition,
    trackHistoryJson: JSON.stringify(loc.trackHistory || []),
  };
  return cleanUndefinedFields(data);
}

export function deserializeLocationFromFirestore(data: any): UserLocationState {
  let trackHistory: GpsPoint[] = [];
  if (data.trackHistoryJson) {
    try {
      trackHistory = JSON.parse(data.trackHistoryJson);
    } catch (e) {
      console.warn('Error parsing trackHistoryJson:', e);
    }
  } else if (Array.isArray(data.trackHistory)) {
    trackHistory = data.trackHistory;
  }

  return {
    userId: data.userId,
    isLive: data.isLive ?? true,
    lastUpdated: data.lastUpdated || new Date().toISOString(),
    currentPosition: data.currentPosition || {
      lat: VEREINSBUERO_LOCATION.lat,
      lng: VEREINSBUERO_LOCATION.lng,
      timestamp: new Date().toISOString(),
    },
    trackHistory,
  };
}

export function serializeChatForFirestore(msg: ChatMessage): Record<string, any> {
  const clean: Record<string, any> = {
    id: msg.id,
    operationId: msg.operationId,
    senderId: msg.senderId,
    senderName: msg.senderName,
    senderCallSign: msg.senderCallSign,
    senderRole: msg.senderRole,
    channel: msg.channel,
    isDirect: Boolean(msg.isDirect),
    text: msg.text || '',
    timestamp: msg.timestamp || new Date().toISOString(),
    isAlert: Boolean(msg.isAlert),
  };
  if (msg.recipientId) clean.recipientId = msg.recipientId;
  if (msg.location) clean.location = msg.location;
  if (msg.attachmentUrl) clean.attachmentUrl = msg.attachmentUrl;
  if (msg.audioUrl) clean.audioUrl = msg.audioUrl;
  if (typeof msg.audioDuration === 'number') clean.audioDuration = msg.audioDuration;
  if (typeof msg.isVoiceMessage === 'boolean') clean.isVoiceMessage = msg.isVoiceMessage;
  return cleanUndefinedFields(clean);
}
