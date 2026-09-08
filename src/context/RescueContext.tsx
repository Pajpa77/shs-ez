import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  User,
  SearchOperation,
  SearchSector,
  Finding,
  ChatMessage,
  UserLocationState,
  GpsPoint,
  OperationType,
  SectorStatus,
  FindingCategory,
  FindingUrgency,
  EquipmentType,
  UserRole,
  OperationLogEntry,
  ArchivedSearchTrack,
  TrackingTestSession,
  isFirstAdmin,
  isOwner,
  getUserTrackColor,
  TACTICAL_TRACK_COLORS,
} from '../types';
import { useWakeLock } from '../hooks/useWakeLock';
import {
  INITIAL_USERS,
  INITIAL_OPERATIONS,
  INITIAL_USER_LOCATIONS,
  INITIAL_CHAT_MESSAGES,
  VEREINSBUERO_LOCATION,
} from '../mockData';
import {
  db,
  isFirebaseConfigured,
  serializeOperationForFirestore,
  deserializeOperationFromFirestore,
  serializeLocationForFirestore,
  deserializeLocationFromFirestore,
  serializeChatForFirestore,
  serializeUserForFirestore,
  deserializeUserFromFirestore,
  safeFirestoreWrite,
  getIsQuotaExhausted,
  setQuotaExhausted,
  onQuotaExhaustedChange,
  isQuotaError,
} from '../lib/firebase';
import { captureTacticalMapScreenshot } from '../lib/mapSnapshotHelper';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

export interface ConfirmModalOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  onConfirm: () => void;
}

interface RescueContextType {
  // Authentication & Users
  currentUser: User | null;
  allUsers: User[];
  login: (username: string, password?: string) => boolean;
  logout: () => void;
  requestLogout: () => void;
  confirmLogout: () => void;
  cancelLogout: () => void;
  isLogoutConfirmOpen: boolean;
  authNotification: { type: 'login' | 'logout'; message: string; timestamp: string } | null;
  clearAuthNotification: () => void;
  switchUser: (userId: string) => void;
  createUser: (userData: Omit<User, 'id' | 'isActive'>) => User;
  updateUser: (userId: string, updates: Partial<User>) => void;
  deleteUser: (userId: string) => void;
  removeUserFromOperation: (userId: string) => void;
  setUserActiveStatus: (userId: string, isActive: boolean) => void;
  deactivateAllUsers: (includeSelf?: boolean) => void;

  // Global In-App Confirm Modal (Replaces browser window.confirm)
  confirmModalState: ConfirmModalOptions | null;
  showConfirmModal: (options: ConfirmModalOptions) => void;
  dismissConfirmModal: () => void;

  // Operations
  currentOperation: SearchOperation | null;
  allOperations: SearchOperation[];
  isOperationActive: boolean;
  isOperationPaused: boolean;
  setCurrentOperationId: (id: string) => void;
  createOperation: (data: Partial<SearchOperation> & { title: string; type: OperationType }) => SearchOperation;
  updateOperation: (id: string, updates: Partial<SearchOperation> | ((prevOp: SearchOperation) => Partial<SearchOperation>)) => void;
  pauseOperation: (id: string, reason?: string, snapshotUrl?: string) => Promise<void> | void;
  resumeOperation: (id: string) => void;
  saveMapSnapshot: (operationId: string, dataUrl: string, label?: string) => void;
  endOperation: (
    id: string,
    notes?: string,
    outcome?: 'person_alive' | 'person_transferred' | 'aborted' | 'person_deceased' | 'exercise_completed',
    mapSnapshotUrl?: string
  ) => Promise<void> | void;
  reactivateOperation: (
    id: string,
    options?: {
      phaseTitle?: string;
      notes?: string;
      newCommander?: string;
      activatedUserIds?: string[];
      keepSearchedSectors?: boolean;
      preserveHistoricalTracks?: boolean;
    }
  ) => SearchOperation | null;
  deleteOperation: (id: string) => void;

  // Sectors & Suchgebiet
  updateSearchArea: (
    polygon: [number, number][],
    name?: string,
    hectares?: number,
    notes?: string
  ) => void;
  deleteSearchArea: () => void;
  addSector: (sector: Omit<SearchSector, 'id' | 'operationId'> & { id?: string }) => SearchSector;
  addMultipleSectors: (sectors: Omit<SearchSector, 'id' | 'operationId'>[]) => SearchSector[];
  updateSector: (sectorId: string, updates: Partial<SearchSector>) => void;
  setSectorStatus: (sectorId: string, status: SectorStatus) => void;
  assignSectorUsers: (sectorId: string, userIds: string[]) => void;
  deleteSector: (sectorId: string) => void;

  // Findings
  findings: Finding[];
  reportFinding: (data: {
    category: FindingCategory;
    title: string;
    description: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    urgency: FindingUrgency;
    location?: GpsPoint;
  }) => Finding;
  verifyFinding: (
    findingId: string,
    status: 'verified' | 'false_alarm' | 'pending' | boolean,
    adminNotes?: string
  ) => void;
  deleteFinding: (findingId: string) => void;

  // GPS & Live Tracking
  userLocations: Record<string, UserLocationState>;
  myLocation: GpsPoint | null;
  isRealGpsActive: boolean;
  toggleRealGps: () => void;
  isSimulatorRunning: boolean;
  toggleSimulator: () => void;
  updateMyLocationManual: (lat: number, lng: number) => void;
  clearGpsTracks: (userId?: string) => void;

  // Chat
  chatMessages: ChatMessage[];
  unreadChatCount: number;
  lastReadChatTimestamp: number;
  markChatAsRead: () => void;
  sendChatMessage: (data: {
    text: string;
    channel: string;
    operationId?: string;
    isDirect?: boolean;
    recipientId?: string;
    isAlert?: boolean;
    attachmentUrl?: string;
    includeLocation?: boolean;
    audioUrl?: string;
    audioDuration?: number;
    isVoiceMessage?: boolean;
  }) => void;
  sendEmergencyAlert: (customMessage: string) => void;

  // Cloud Sync State
  isCloudSynced: boolean;
  cloudSyncStatus: 'connected' | 'connecting' | 'offline' | 'quota_exceeded';
  isQuotaExceeded: boolean;

  // Audio / Emergency alerts
  playAlertSound: (type?: string) => void;
  activeAlertNotification: { title: string; message: string; timestamp: string } | null;
  setActiveAlertNotification: React.Dispatch<React.SetStateAction<{ title: string; message: string; timestamp: string } | null>>;
  dismissAlertNotification: () => void;

  // EZ Arrival & Readiness Monitoring
  userArrivalStatuses: Record<string, 'in_transit' | 'ez_reached' | 'ready'>;
  confirmUserReady: (userId: string) => void;
  setUserArrivalStatus: (userId: string, status: 'in_transit' | 'ez_reached' | 'ready') => void;
  getUserArrivalStatus: (userId: string) => 'in_transit' | 'ez_reached' | 'ready';
  calculateDistanceToEzMeters: (lat: number, lng: number) => number | null;

  // Global Selected Responder State
  selectedUser: User | null;
  setSelectedUser: (user: User | null) => void;

  // UI Scaling
  uiScale: number;
  setUiScale: (scale: number) => void;

  // Tracking Test
  activeTrackingTest: TrackingTestSession | null;
  startTrackingTest: (user: User, duration: 10 | 20 | 30) => void;
  stopTrackingTest: () => void;
  saveTrackingTestResult: (save: boolean) => void;
}

const RescueContext = createContext<RescueContextType | undefined>(undefined);

const STORAGE_KEY_USERS = 'rescue_app_users_slk_v4';
const STORAGE_KEY_OPERATIONS = 'rescue_app_operations_slk_v4';
const STORAGE_KEY_ACTIVE_OP = 'rescue_app_active_op_id_slk_v4';
const STORAGE_KEY_CURRENT_USER = 'rescue_app_current_user_id_slk_v4';
const STORAGE_KEY_LOCATIONS = 'rescue_app_locations_slk_v4';
const STORAGE_KEY_CHAT = 'rescue_app_chat_slk_v4';
const STORAGE_KEY_LAST_READ_CHAT = 'rescue_app_last_read_chat_slk_v4';

export const RescueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Clear any legacy test data from previous versions
  useEffect(() => {
    try {
      const legacyKeys = [
        'rescue_app_users_v2',
        'rescue_app_operations_v2',
        'rescue_app_active_op_id_v2',
        'rescue_app_current_user_id_v2',
        'rescue_app_locations_v2',
        'rescue_app_chat_v2',
        'rescue_app_users_v1',
      ];
      legacyKeys.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
  }, []);

  // 1. Local State with fallbacks
  const [allUsers, setAllUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USERS);
      let list: User[] = [];
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            // Robust filter to prevent null/undefined elements or corrupted objects
            list = parsed.filter((u) => u && typeof u === 'object' && typeof u.id === 'string');
          }
        } catch (jsonErr) {
          console.error('Error parsing saved users JSON:', jsonErr);
        }
      }
      
      if (list.length === 0) {
        list = [...INITIAL_USERS];
      } else {
        const existingIds = new Set(list.map((u: User) => u.id));
        const missing = INITIAL_USERS.filter((u) => u && u.id && !existingIds.has(u.id));
        if (missing.length > 0) {
          list = [...list, ...missing];
        }
      }

      // Re-apply any individually backed-up profiles (photo, info)
      list = list.map((u) => {
        if (!u || !u.id) return u;
        try {
          const profileBackup = localStorage.getItem(`rescuetrack_user_profile_${u.id}`);
          if (profileBackup) {
            const parsedProfile = JSON.parse(profileBackup);
            if (parsedProfile && typeof parsedProfile === 'object') {
              return { ...u, ...parsedProfile };
            }
          }
        } catch {
          // ignore
        }
        return u;
      });

      const savedCurrUser = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
      list = list.map((u) => {
        if (!u || !u.id) return u;
        
        const uname = (u.username || '').toLowerCase();
        const rname = (u.name || '').toLowerCase();

        // Enforce Maria as First-Admin / Owner
        const isMaria = u.id === 'user-maria' || uname === 'maria' || rname === 'maria';
        
        // Enforce Jens as Admin (requested in earlier context)
        const isJens = u.id === 'user-jens' || uname === 'jens' || rname === 'jens';

        if (isMaria) {
          return {
            ...u,
            role: 'admin' as const,
            isAdmin: true,
            isFirstAdmin: true,
            isOwner: true,
            canLeadOperations: true,
            isActive: savedCurrUser ? u.id === savedCurrUser : u.isActive,
          };
        }

        if (isJens) {
          return {
            ...u,
            role: 'admin' as const,
            isAdmin: true,
            isActive: savedCurrUser ? u.id === savedCurrUser : u.isActive,
          };
        }

        return {
          ...u,
          isActive: savedCurrUser ? u.id === savedCurrUser : u.isActive,
        };
      });
      return list;
    } catch (err) {
      console.error('CRITICAL: Error initializing allUsers state:', err);
      return [...INITIAL_USERS];
    }
  });

  const STORAGE_KEY_DELETED_OPS = 'rescue_deleted_op_ids_slk_v4';
  const STORAGE_KEY_DELETED_SECTORS = 'rescue_deleted_sector_ids_slk_v4';
  const STORAGE_KEY_HAS_SEEDED_OPS = 'rescue_has_seeded_ops_slk_v4';

  const deletedOpIdsRef = useRef<Set<string>>((() => {
    try {
      const saved = localStorage.getItem('rescue_deleted_op_ids_slk_v4');
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  })());

  const deletedSectorIdsRef = useRef<Set<string>>((() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DELETED_SECTORS);
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  })());

  const cleanSectors = (sectors: SearchSector[] = []): SearchSector[] => {
    if (!Array.isArray(sectors)) return [];
    return sectors.filter((s) => !deletedSectorIdsRef.current.has(s.id));
  };

  const cleanOperation = (op: SearchOperation): SearchOperation => {
    if (!op) return op;
    return {
      ...op,
      sectors: cleanSectors(op.sectors),
    };
  };

  const [allOperations, setAllOperations] = useState<SearchOperation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_OPERATIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed
            .filter(
              (op: SearchOperation) =>
                !deletedOpIdsRef.current.has(op.id) &&
                op.id !== 'op-1788338712628' &&
                op.id !== 'op-1788338712629'
            )
            .map((op: SearchOperation) => {
              const cleanedOp = {
                ...op,
                sectors: cleanSectors(op.sectors),
              };
              if (cleanedOp.id === 'op-salzland-001') {
                return {
                  ...cleanedOp,
                  status: 'completed' as const,
                  headquartersLocation: VEREINSBUERO_LOCATION,
                  missingPerson: cleanedOp.missingPerson
                    ? {
                        ...cleanedOp.missingPerson,
                        lastSeenLocation: VEREINSBUERO_LOCATION,
                        homeAddress: VEREINSBUERO_LOCATION,
                      }
                    : undefined,
                };
              }
              if (
                cleanedOp.headquartersLocation &&
                Math.abs(cleanedOp.headquartersLocation.lat - 51.845) < 0.01 &&
                Math.abs(cleanedOp.headquartersLocation.lng - 11.635) < 0.01
              ) {
                return {
                  ...cleanedOp,
                  headquartersLocation: VEREINSBUERO_LOCATION,
                };
              }
              return cleanedOp;
            });
        }
      }
      return INITIAL_OPERATIONS.filter((op) => !deletedOpIdsRef.current.has(op.id)).map((op) => ({
        ...op,
        sectors: cleanSectors(op.sectors),
      }));
    } catch {
      return INITIAL_OPERATIONS.filter((op) => !deletedOpIdsRef.current.has(op.id)).map((op) => ({
        ...op,
        sectors: cleanSectors(op.sectors),
      }));
    }
  });

  const [currentOperationId, setCurrentOperationIdState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_OP);
      if (saved === 'op-salzland-001' || saved === 'op-1788338712628' || saved === 'op-1788338712629') {
        try {
          localStorage.removeItem(STORAGE_KEY_ACTIVE_OP);
        } catch {}
        return '';
      }
      return saved || '';
    } catch {
      return '';
    }
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
      return saved && saved.startsWith('user-') ? saved : '';
    } catch {
      return '';
    }
  });

  const [userLocations, setUserLocations] = useState<Record<string, UserLocationState>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LOCATIONS);
      return saved ? JSON.parse(saved) : INITIAL_USER_LOCATIONS;
    } catch {
      return INITIAL_USER_LOCATIONS;
    }
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CHAT);
      return saved ? JSON.parse(saved) : INITIAL_CHAT_MESSAGES;
    } catch {
      return INITIAL_CHAT_MESSAGES;
    }
  });

  const [lastReadChatTimestamp, setLastReadChatTimestamp] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAST_READ_CHAT);
      return saved ? parseInt(saved, 10) : Date.now();
    } catch {
      return Date.now();
    }
  });

  const markChatAsRead = useCallback(() => {
    const now = Date.now();
    setLastReadChatTimestamp(now);
    try {
      localStorage.setItem(STORAGE_KEY_LAST_READ_CHAT, String(now));
    } catch {}
  }, []);

  const [isRealGpsActive, setIsRealGpsActive] = useState<boolean>(true);
  const [isSimulatorRunning, setIsSimulatorRunning] = useState<boolean>(false);
  const [myLocation, setMyLocation] = useState<GpsPoint | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'connected' | 'connecting' | 'offline' | 'quota_exceeded'>(() =>
    getIsQuotaExhausted() ? 'quota_exceeded' : 'offline'
  );
  const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(() => getIsQuotaExhausted());
  const [activeAlertNotification, setActiveAlertNotification] = useState<{
    title: string;
    message: string;
    timestamp: string;
  } | null>(null);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [authNotification, setAuthNotification] = useState<{
    type: 'login' | 'logout';
    message: string;
    timestamp: string;
  } | null>(null);

  // Global In-App Confirm Modal State
  const [confirmModalState, setConfirmModalState] = useState<ConfirmModalOptions | null>(null);

  const showConfirmModal = useCallback((options: ConfirmModalOptions) => {
    setConfirmModalState(options);
  }, []);

  const dismissConfirmModal = useCallback(() => {
    setConfirmModalState(null);
  }, []);

  const requestLogout = () => {
    if (!currentUser) return;
    setIsLogoutConfirmOpen(true);
  };

  const cancelLogout = () => {
    setIsLogoutConfirmOpen(false);
  };

  const confirmLogout = () => {
    if (!currentUser) return;
    const userId = currentUser.id;
    const userName = currentUser.name;
    const userCallSign = currentUser.callSign;
    const userRole = currentUser.role;

    // Guard: During active or paused operations, BOTH the last Admin AND the last Einsatzleitung must remain logged in
    const isOpRunning = currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused');
    if (isOpRunning) {
      const isLeadAdmin = currentUser.role === 'admin' || currentUser.isAdmin;
      const isLeadEL = currentUser.role === 'einsatzleitung' || currentUser.canLeadOperations;

      if (isLeadAdmin) {
        const otherActiveAdmins = allUsers.filter(
          (u) => (u.role === 'admin' || u.isAdmin) && u.isActive && u.id !== userId
        ).length;
        if (otherActiveAdmins === 0) {
          setIsLogoutConfirmOpen(false);
          playAlertSound('alert');
          setActiveAlertNotification({
            title: '⚠️ Abmeldung verweigert (Letzter Administrator)',
            message: 'Während eines laufenden oder pausierten Einsatzes muss stets mindestens ein Administrator aktiv eingeloggt bleiben! Bitte ernennen Sie eine andere Einsatzkraft zum Admin oder beenden Sie den Einsatz.',
            timestamp: new Date().toLocaleTimeString(),
          });
          return;
        }
      }

      if (isLeadEL) {
        const otherActiveELs = allUsers.filter(
          (u) => (u.role === 'einsatzleitung' || u.canLeadOperations) && u.isActive && u.id !== userId
        ).length;
        if (otherActiveELs === 0) {
          setIsLogoutConfirmOpen(false);
          playAlertSound('alert');
          setActiveAlertNotification({
            title: '⚠️ Abmeldung verweigert (Letzte Einsatzleitung)',
            message: 'Während eines laufenden oder pausierten Einsatzes muss stets mindestens eine Einsatzleitung aktiv eingeloggt bleiben! Bitte übergeben Sie die Einsatzleitung oder beenden Sie den Einsatz.',
            timestamp: new Date().toLocaleTimeString(),
          });
          return;
        }
      }
    }

    if (currentOperation) {
      const logEntry: OperationLogEntry = {
        id: `log-${Date.now()}`,
        operationId: currentOperation.id,
        timestamp: new Date().toISOString(),
        authorName: userName,
        authorRole: userRole,
        category: 'status',
        text: `Benutzer abgemeldet: ${userName} (${userCallSign}) hat das System verlassen.`,
      };
      updateOperation(currentOperation.id, (prevOp) => ({
        logs: [logEntry, ...(prevOp.logs || [])],
      }));
    }

    setUserActiveStatus(userId, false);
    setCurrentUserId('');
    setIsLogoutConfirmOpen(false);
    playAlertSound('alert');
    setAuthNotification({
      type: 'logout',
      message: `Erfolgreich abgemeldet: ${userName} (${userCallSign || userRole}) hat das System verlassen.`,
      timestamp: new Date().toLocaleTimeString(),
    });

    try {
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
      localStorage.removeItem('rescue_app_remembered_device_user_id_slk_v4');
    } catch {
      // ignore
    }
  };

  const clearAuthNotification = () => {
    setAuthNotification(null);
  };

  const [userArrivalStatuses, setUserArrivalStatuses] = useState<Record<string, 'in_transit' | 'ez_reached' | 'ready'>>(() => {
    try {
      const saved = localStorage.getItem('rescue_app_arrival_statuses_slk_v4');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('rescue_app_arrival_statuses_slk_v4', JSON.stringify(userArrivalStatuses));
    } catch {}
  }, [userArrivalStatuses]);

  // Global Selected Responder State
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // UI Scaling
  const [uiScale, setUiScaleState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('rescue_ui_scale_v1');
      return saved ? parseFloat(saved) : 1.0;
    } catch {
      return 1.0;
    }
  });

  const [activeTrackingTest, setActiveTrackingTestState] = useState<TrackingTestSession | null>(null);
  const activeTrackingTestRef = useRef<TrackingTestSession | null>(null);

  const setActiveTrackingTest = useCallback((session: TrackingTestSession | null | ((prev: TrackingTestSession | null) => TrackingTestSession | null)) => {
    setActiveTrackingTestState(prev => {
      const next = typeof session === 'function' ? session(prev) : session;
      activeTrackingTestRef.current = next;
      return next;
    });
  }, []);

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const watchPositionIdRef = useRef<number | null>(null);
  const isInitialCloudSyncRef = useRef<boolean>(true);
  const hasSeededOpsRef = useRef<boolean>(false);
  const hasSeededUsersRef = useRef<boolean>(false);
  const currentUserIdRef = useRef<string>(currentUserId);
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);
  const lastCloudGpsSyncRef = useRef<{ timestamp: number; lat: number; lng: number }>({
    timestamp: 0,
    lat: 0,
    lng: 0,
  });

  // Maximum GPS track points stored per responder (10,000 points = approx. 30-50 km search movement without data loss)
  const MAX_TRACK_POINTS = 10000;

  // Track global quota exhaustion changes
  useEffect(() => {
    const unsub = onQuotaExhaustedChange((exhausted) => {
      setIsQuotaExceeded(exhausted);
      if (exhausted) {
        setCloudSyncStatus('quota_exceeded');
      }
    });
    return unsub;
  }, []);

  // Derived active objects
  const currentUser = useMemo(() => {
    if (!currentUserId || allUsers.length === 0) return null;
    return allUsers.find((u) => u.id === currentUserId) || null;
  }, [currentUserId, allUsers]);

  // Keep mobile screen awake via Screen Wake Lock API during active GPS recording (Status Grün) or Tracking Test
  const isTrackingWakeLockActive = Boolean(
    (isRealGpsActive &&
      (currentUser?.arrivalStatus === 'ready' ||
        (currentUser?.id && userArrivalStatuses[currentUser.id] === 'ready'))) ||
      activeTrackingTest?.isActive
  );
  useWakeLock(isTrackingWakeLockActive);

  // Single active device session ID to prevent double login / session conflicts
  const deviceSessionId = useMemo(() => {
    try {
      const deviceId = localStorage.getItem('rescue_app_device_id_v1') || `dev-${Math.random().toString(36).substring(2, 9)}`;
      try {
        localStorage.setItem('rescue_app_device_id_v1', deviceId);
      } catch {}

      let id = sessionStorage.getItem('rescue_device_session_id');
      if (!id) {
        id = `${deviceId}:session-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
        sessionStorage.setItem('rescue_device_session_id', id);
      }
      return id;
    } catch {
      return `session-${Math.random().toString(36).substring(2, 11)}-${Date.now()}`;
    }
  }, []);

  // Continuous heartbeat for active session so stale sessions never block login
  useEffect(() => {
    if (!currentUser || !currentUser.isActive) return;

    const ping = () => {
      const now = Date.now();
      updateUser(currentUser.id, {
        activeSessionId: deviceSessionId,
        lastHeartbeat: now,
        isActive: true,
      });
    };

    // Immediate ping on mount/login
    ping();
    const interval = setInterval(ping, 20000);
    return () => clearInterval(interval);
  }, [currentUser?.id, currentUser?.isActive, deviceSessionId]);

  // Real-time check to prevent simultaneous double logins on the same account from ANOTHER device
  useEffect(() => {
    if (!currentUser || !currentUser.isActive || !currentUser.activeSessionId) return;

    const deviceId = localStorage.getItem('rescue_app_device_id_v1') || '';
    const isSameDevice =
      currentUser.activeSessionId === deviceSessionId ||
      (deviceId !== '' && currentUser.activeSessionId.startsWith(deviceId));

    const isLiveOnOtherDevice =
      !isSameDevice &&
      Boolean(currentUser.lastHeartbeat) &&
      Date.now() - (currentUser.lastHeartbeat || 0) < 45000;

    if (isLiveOnOtherDevice) {
      console.log('Simultaneous double login detected from another device, logging out current device session.');
      
      // Perform local-only logout
      setCurrentUserId('');
      setIsLogoutConfirmOpen(false);
      try {
        localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
        localStorage.removeItem('rescue_app_remembered_device_user_id_slk_v4');
      } catch {}
      
      playAlertSound('alert');
      setActiveAlertNotification({
        title: '⚠️ Sitzung beendet',
        message: 'Ihre Verbindung wurde getrennt, da sich dieses Benutzerkonto auf einem anderen aktiven Gerät angemeldet hat.',
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  }, [currentUser?.activeSessionId, currentUser?.lastHeartbeat, currentUser?.isActive, deviceSessionId]);

  const currentOperation =
    (currentOperationId
      ? allOperations.find(
          (op) =>
            op.id === currentOperationId &&
            !deletedOpIdsRef.current.has(op.id) &&
            (op.status === 'active' || op.status === 'paused')
        )
      : null) ||
    allOperations.find((op) => !deletedOpIdsRef.current.has(op.id) && op.status === 'active') ||
    allOperations.find((op) => !deletedOpIdsRef.current.has(op.id) && op.status === 'paused') ||
    null;

  const unreadChatCount = useMemo(() => {
    return chatMessages.filter((m) => {
      const msgTime = new Date(m.timestamp).getTime();
      const isRelevantOp =
        m.operationId === 'general' ||
        (currentOperation && m.operationId === currentOperation.id);
      return (
        isRelevantOp &&
        msgTime > lastReadChatTimestamp &&
        m.senderId !== currentUser?.id
      );
    }).length;
  }, [chatMessages, lastReadChatTimestamp, currentUser?.id, currentOperation?.id]);

  const isOperationActive = Boolean(currentOperation && currentOperation.status === 'active');
  const isOperationPaused = Boolean(currentOperation && currentOperation.status === 'paused');
  const findings = currentOperation ? currentOperation.findings : [];

  const calculateDistanceToEzMeters = useCallback((lat: number, lng: number): number | null => {
    const ez = (currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused') && currentOperation.headquartersLocation)
      ? currentOperation.headquartersLocation
      : VEREINSBUERO_LOCATION;
    return calculateDistanceMeters(ez.lat, ez.lng, lat, lng);
  }, [currentOperation]);

  // Local Storage Persistence
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(allUsers));
  }, [allUsers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_OPERATIONS, JSON.stringify(allOperations));
  }, [allOperations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ACTIVE_OP, currentOperationId);
  }, [currentOperationId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CURRENT_USER, currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LOCATIONS, JSON.stringify(userLocations));
  }, [userLocations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(chatMessages));
  }, [chatMessages]);

  // Web Audio alert sounds synthesized
  const playAlertSound = useCallback((type: string = 'alert') => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      if (type === 'emergency_alarm') {
        const now = ctx.currentTime;
        // Super sharp, piercing double-oscillator siren sound that sweeps quickly and repeats 4 times
        for (let i = 0; i < 4; i++) {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc1.type = 'sawtooth';
          osc2.type = 'sawtooth';
          const startTime = now + (i * 0.28);
          
          osc1.frequency.setValueAtTime(1400, startTime);
          osc1.frequency.linearRampToValueAtTime(2600, startTime + 0.12);
          osc1.frequency.linearRampToValueAtTime(1400, startTime + 0.24);
          
          osc2.frequency.setValueAtTime(1450, startTime);
          osc2.frequency.linearRampToValueAtTime(2650, startTime + 0.12);
          osc2.frequency.linearRampToValueAtTime(1450, startTime + 0.24);
          
          gain.gain.setValueAtTime(0.35, startTime);
          gain.gain.exponentialRampToValueAtTime(0.005, startTime + 0.26);
          
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          
          osc1.start(startTime);
          osc1.stop(startTime + 0.26);
          osc2.start(startTime);
          osc2.stop(startTime + 0.26);
        }
      } else if (type === 'chat_all') {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'chat_admins') {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(783.99, now); // G5
        osc.frequency.setValueAtTime(987.77, now + 0.08); // B5
        osc.frequency.setValueAtTime(1174.66, now + 0.16); // D6
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'chat_direct') {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type !== 'alert' && type !== 'finding' && type !== 'radio' && type !== 'cb_tx_start' && type !== 'cb_tx_end' && type !== 'cb_roger' && type !== 'notification' && type.trim().length > 0) {
        // Sector specific channel or unique channel: calculate dynamic frequency from hash!
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        let hash = 0;
        for (let i = 0; i < type.length; i++) {
          hash = type.charCodeAt(i) + ((hash << 5) - hash);
        }
        const freqIndex = Math.abs(hash) % 7;
        // Perfect heptatonic scale pitches: F5, G5, A5, B5, C6, D6, E6
        const baseFreq = [698.46, 783.99, 880.00, 987.77, 1046.50, 1174.66, 1318.51][freqIndex];
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.setValueAtTime(baseFreq * 1.25, now + 0.12); // ascending dynamic interval
        
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.32);
      } else if (type === 'notification') {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.12); // A5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'cb_tx_start') {
        const now = ctx.currentTime;
        const bufferSize = Math.floor(ctx.sampleRate * 0.08);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.15;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        noise.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
      } else if (type === 'cb_tx_end' || type === 'cb_roger') {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1150, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'finding') {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.15);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.45);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
      } else if (type === 'alert') {
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(1046.5, now);
        gain1.gain.setValueAtTime(0.25, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.15);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1318.5, now + 0.18);
        gain2.gain.setValueAtTime(0.25, now + 0.18);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.18);
        osc2.stop(now + 0.35);
      } else {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      }
    } catch {
      // AudioContext might be guarded
    }
  }, []);

  // Set initial cloud sync flag to false after 4s timeout to allow real-time transition alerts
  useEffect(() => {
    const timer = setTimeout(() => {
      isInitialCloudSyncRef.current = false;
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  // Multi-tab BroadcastChannel sync setup
  useEffect(() => {
    try {
      const channel = new BroadcastChannel('rescue_mission_channel_v2');
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === 'SYNC_LOCATIONS') {
          setUserLocations(payload);
        } else if (type === 'NEW_FINDING') {
          playAlertSound('finding');
          setActiveAlertNotification({
            title: '🚨 NEUER FUND GEMELDET!',
            message: `${payload.userName} (${payload.userCallSign}): "${payload.title}"`,
            timestamp: new Date().toLocaleTimeString(),
          });
          setAllOperations((prev) =>
            prev.map((op) =>
              op.id === payload.operationId ? { ...op, findings: [payload, ...op.findings] } : op
            )
          );
        } else if (type === 'NEW_CHAT') {
          if (payload.isAlert) {
            playAlertSound('emergency_alarm');
          } else if (payload.isVoiceMessage) {
            playAlertSound('cb_roger');
          } else if (payload.isDirect) {
            playAlertSound('chat_direct');
          } else if (payload.channel === 'all') {
            playAlertSound('chat_all');
          } else if (payload.channel === 'admins') {
            playAlertSound('chat_admins');
          } else {
            playAlertSound(payload.channel);
          }
          setChatMessages((prev) => [...prev, payload]);
        } else if (type === 'SECTOR_STATUS') {
          setAllOperations((prev) =>
            prev.map((op) =>
              op.id === payload.operationId
                ? {
                    ...op,
                    sectors: op.sectors.map((sec) =>
                      sec.id === payload.sectorId
                        ? { ...sec, status: payload.status, clearedAt: payload.clearedAt, clearedBy: payload.clearedBy }
                        : sec
                    ),
                  }
                : op
            )
          );
        } else if (type === 'OPERATION_ENDED') {
          playAlertSound('alert');
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setActiveAlertNotification({
            title: '🛑 EINSATZ BEENDET: ' + payload.outcomeText,
            message: payload.message || 'Alle Kräfte: Suche sofort einstellen und am Sammelpunkt melden!',
            timestamp: new Date().toLocaleTimeString(),
          });
          setAllOperations((prev) =>
            prev.map((op) => (op.id === payload.operationId ? { ...op, status: 'completed' } : op))
          );
          // Automatically set non-admin users to inactive
          setAllUsers((prev) =>
            prev.map((u) =>
              u.role === 'admin' || u.role === 'einsatzleitung'
                ? u
                : {
                    ...u,
                    isActive: false,
                    lastSeen: `Abgemeldet (Einsatzende ${timeStr})`,
                    assignedSectorId: undefined,
                  }
            )
          );
          setUserLocations((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((uid) => {
              if (next[uid]) {
                next[uid] = { ...next[uid], isLive: false };
              }
            });
            return next;
          });
        } else if (type === 'OPERATION_DELETED') {
          setAllOperations((prev) => prev.filter((op) => op.id !== payload.operationId));
        } else if (type === 'SECTOR_DELETED') {
          const { operationId, sectorId } = payload;
          deletedSectorIdsRef.current.add(sectorId);
          try {
            localStorage.setItem(STORAGE_KEY_DELETED_SECTORS, JSON.stringify(Array.from(deletedSectorIdsRef.current)));
          } catch {}
          setAllOperations((prevOps) =>
            prevOps.map((op) => {
              if (op.id === operationId) {
                return {
                  ...op,
                  sectors: cleanSectors(op.sectors.filter((s) => s.id !== sectorId)),
                };
              }
              return op;
            })
          );
          setAllUsers((prev) =>
            prev.map((u) => (u.assignedSectorId === sectorId ? { ...u, assignedSectorId: undefined } : u))
          );
        } else if (type === 'USER_UPDATED') {
          setAllUsers((prev) => {
            const localU = prev.find((u) => u.id === payload.id);
            if (localU && !isInitialCloudSyncRef.current) {
              if (payload.isActive && !localU.isActive) {
                playAlertSound('notification');
                if (payload.id !== currentUserIdRef.current) {
                  setActiveAlertNotification({
                    title: '🟢 Neuer Benutzer angemeldet',
                    message: `${payload.name} (${payload.callSign || payload.role}) hat sich soeben eingeloggt.`,
                    timestamp: new Date().toLocaleTimeString(),
                  });
                }
              } else if (!payload.isActive && localU.isActive) {
                playAlertSound('alert');
                if (payload.id !== currentUserIdRef.current) {
                  setActiveAlertNotification({
                    title: '⚠️ Benutzer abgemeldet / offline',
                    message: `${payload.name} (${payload.callSign || payload.role}) hat das System verlassen.`,
                    timestamp: new Date().toLocaleTimeString(),
                  });
                }
              }
            }
            const exists = prev.some((u) => u.id === payload.id);
            if (exists) {
              return prev.map((u) => (u.id === payload.id ? { ...u, ...payload } : u));
            }
            return [...prev, payload];
          });
        } else if (type === 'USER_DELETED') {
          setAllUsers((prev) => prev.filter((u) => u.id !== payload.userId));
          setUserLocations((prev) => {
            const next = { ...prev };
            delete next[payload.userId];
            return next;
          });
        } else if (type === 'LOGOUT_OTHERS') {
          setAllUsers((prev) =>
            prev.map((u) =>
              u.id === payload.keptUserId
                ? { ...u, isActive: true }
                : { ...u, isActive: false, lastSeen: 'Abgemeldet' }
            )
          );
        }
      };

      return () => {
        channel.close();
      };
    } catch {
      // BroadcastChannel optional
    }
  }, [playAlertSound]);

  // Real Hardware Battery Status detection
  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    if ('getBattery' in navigator) {
      (navigator as any)
        .getBattery()
        .then((battery: any) => {
          const updateHardwareBattery = () => {
            const level = Math.round((battery.level || 1) * 100);
            const isCharging = Boolean(battery.charging);

            setAllUsers((prev) =>
              prev.map((u) =>
                u.id === currentUserId
                  ? { ...u, batteryLevel: level, batteryCharging: isCharging }
                  : u
              )
            );
          };

          updateHardwareBattery();
          battery.addEventListener('levelchange', updateHardwareBattery);
          battery.addEventListener('chargingchange', updateHardwareBattery);
        })
        .catch(() => {
          // Battery API denied or unavailable
        });
    }
  }, [currentUserId]);

  // --- Real-time Firebase Cloud Database Synchronization ---
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setCloudSyncStatus('offline');
      return;
    }

    if (getIsQuotaExhausted()) {
      setCloudSyncStatus('quota_exceeded');
    }

    try {
      // 1. Sync Operations collection
      const opsCol = collection(db, 'operations');
      const unsubOps = onSnapshot(
        opsCol,
        (snapshot) => {
          if (!getIsQuotaExhausted()) {
            setCloudSyncStatus('connected');
          }

          // Handle explicit deletions from Firestore
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'removed') {
              const removedId = change.doc.id;
              deletedOpIdsRef.current.add(removedId);
              setAllOperations((prev) => prev.filter((o) => o.id !== removedId));
            }
          });

          if (!snapshot.empty) {
            const cloudOps: SearchOperation[] = [];
            snapshot.forEach((docSnap) => {
              try {
                if (!deletedOpIdsRef.current.has(docSnap.id) && docSnap.id !== 'op-1788338712628' && docSnap.id !== 'op-1788338712629') {
                  const op = deserializeOperationFromFirestore(docSnap.data());
                  op.sectors = cleanSectors(op.sectors);
                  if (op.id === 'op-salzland-001') {
                    op.status = 'completed';
                    op.headquartersLocation = VEREINSBUERO_LOCATION;
                    if (op.missingPerson) {
                      op.missingPerson.lastSeenLocation = VEREINSBUERO_LOCATION;
                      op.missingPerson.homeAddress = VEREINSBUERO_LOCATION;
                    }
                  } else if (
                    op.headquartersLocation &&
                    Math.abs(op.headquartersLocation.lat - 51.845) < 0.01 &&
                    Math.abs(op.headquartersLocation.lng - 11.635) < 0.01
                  ) {
                    op.headquartersLocation = VEREINSBUERO_LOCATION;
                  }
                  cloudOps.push(op);
                }
              } catch (err) {
                console.warn('Error deserializing operation:', err);
              }
            });
            if (cloudOps.length > 0) {
              setAllOperations((prevLocalOps) => {
                const cloudMap = new Map(cloudOps.map((o) => [o.id, o]));
                const merged: SearchOperation[] = [];
                const processedIds = new Set<string>();

                prevLocalOps.forEach((localOp) => {
                  if (deletedOpIdsRef.current.has(localOp.id)) return;
                  processedIds.add(localOp.id);
                  const cloudOp = cloudMap.get(localOp.id);
                  if (!cloudOp) {
                    merged.push(cleanOperation(localOp));
                  } else {
                    const localTime = localOp.updatedAt ? new Date(localOp.updatedAt).getTime() : 0;
                    const cloudTime = cloudOp.updatedAt ? new Date(cloudOp.updatedAt).getTime() : 0;
                    if (cloudTime >= localTime) {
                      merged.push(cleanOperation({ ...localOp, ...cloudOp }));
                    } else {
                      merged.push(cleanOperation(localOp));
                    }
                  }
                });

                // Add any cloud operations not in local state
                cloudOps.forEach((cloudOp) => {
                  if (!deletedOpIdsRef.current.has(cloudOp.id) && !processedIds.has(cloudOp.id)) {
                    merged.push(cleanOperation(cloudOp));
                  }
                });

                // Sort: active operations first (newest to oldest), then completed operations
                merged.sort((a, b) => {
                  if (a.status === 'active' && b.status !== 'active') return -1;
                  if (a.status !== 'active' && b.status === 'active') return 1;
                  return (
                    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                  );
                });

                return merged;
              });
            }
          } else if (
            !hasSeededOpsRef.current &&
            !localStorage.getItem(STORAGE_KEY_HAS_SEEDED_OPS) &&
            deletedOpIdsRef.current.size === 0 &&
            !getIsQuotaExhausted()
          ) {
            // Seed initial operation to Firebase strictly ONCE across the app lifecycle
            hasSeededOpsRef.current = true;
            try {
              localStorage.setItem(STORAGE_KEY_HAS_SEEDED_OPS, 'true');
            } catch {}
            INITIAL_OPERATIONS.forEach((op) => {
              if (!deletedOpIdsRef.current.has(op.id)) {
                const payload = serializeOperationForFirestore(op);
                safeFirestoreWrite(
                  () => setDoc(doc(db, 'operations', op.id), payload, { merge: true }),
                  'seed_operations'
                );
              }
            });
          }
        },
        (err) => {
          if (isQuotaError(err)) {
            setQuotaExhausted(true);
            setCloudSyncStatus('quota_exceeded');
          } else {
            console.warn('Firestore Operations listener warning:', err);
            setCloudSyncStatus('offline');
          }
        }
      );

      // 2. Sync Live Locations collection
      const locsCol = collection(db, 'user_locations');
      const unsubLocs = onSnapshot(
        locsCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const cloudLocs: Record<string, UserLocationState> = {};
            snapshot.forEach((docSnap) => {
              try {
                const data = deserializeLocationFromFirestore(docSnap.data());
                if (data.userId) {
                  cloudLocs[data.userId] = data;
                }
              } catch (err) {
                console.warn('Error deserializing location:', err);
              }
            });
            setUserLocations((prev) => ({ ...prev, ...cloudLocs }));
          }
        },
        (err) => {
          if (isQuotaError(err)) {
            setQuotaExhausted(true);
            setCloudSyncStatus('quota_exceeded');
          } else {
            console.warn('Firestore Locations listener warning:', err);
          }
        }
      );

      // 3. Sync Chat Messages collection
      let isInitialChatLoad = true;
      const chatCol = collection(db, 'chat_messages');
      const unsubChat = onSnapshot(
        chatCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const cloudChat: ChatMessage[] = [];
            snapshot.forEach((docSnap) => {
              cloudChat.push(docSnap.data() as ChatMessage);
            });
            cloudChat.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            if (!isInitialChatLoad) {
              snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                  const msg = change.doc.data() as ChatMessage;
                  if (msg && msg.senderId !== currentUserIdRef.current) {
                    if (msg.isAlert) {
                      playAlertSound('emergency_alarm');
                    } else if (msg.isVoiceMessage) {
                      playAlertSound('cb_roger');
                    } else if (msg.isDirect) {
                      playAlertSound('chat_direct');
                    } else if (msg.channel === 'all') {
                      playAlertSound('chat_all');
                    } else if (msg.channel === 'admins') {
                      playAlertSound('chat_admins');
                    } else {
                      playAlertSound(msg.channel);
                    }

                    if (msg.isAlert) {
                      setActiveAlertNotification({
                        title: '🚨 DRINGENDER FUNKSPRUCH / ALARM',
                        message: `${msg.senderName} (${msg.senderCallSign}): "${msg.text || 'Notfallmeldung'}"`,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      });
                    }

                    if (msg.isVoiceMessage && msg.audioUrl) {
                      try {
                        const audio = new Audio(msg.audioUrl);
                        audio.play().catch((err) => {
                          console.log('Audio autoplay restricted by browser:', err);
                        });
                      } catch (e) {
                        console.warn('Audio play error:', e);
                      }
                    }
                  }
                }
              });
            } else {
              isInitialChatLoad = false;
            }

            if (cloudChat.length > 0) {
              setChatMessages(cloudChat);
            }
          } else {
            isInitialChatLoad = false;
          }
        },
        (err) => {
          if (isQuotaError(err)) {
            setQuotaExhausted(true);
            setCloudSyncStatus('quota_exceeded');
          } else {
            console.warn('Firestore Chat listener warning:', err);
          }
        }
      );

      // 4. Sync Users / Personnel profiles in real time
      const usersCol = collection(db, 'users');
      const unsubUsers = onSnapshot(
        usersCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const cloudUsers: User[] = [];
            snapshot.forEach((docSnap) => {
              try {
                const u = deserializeUserFromFirestore(docSnap.data());
                cloudUsers.push(u);
              } catch (err) {
                console.warn('Error deserializing user from Firestore:', err);
              }
            });
            if (cloudUsers.length > 0) {
              setAllUsers((prevLocalUsers) => {
                const localMap = new Map<string, User>(prevLocalUsers.map((u) => [u.id, u]));
                
                if (!isInitialCloudSyncRef.current) {
                  const newlyActive: User[] = [];
                  const newlyOffline: User[] = [];

                  cloudUsers.forEach((cloudU) => {
                    const localU = localMap.get(cloudU.id);
                    if (localU) {
                      if (cloudU.isActive && !localU.isActive) {
                        if (cloudU.id !== currentUserIdRef.current) {
                          newlyActive.push(cloudU);
                        }
                      } else if (!cloudU.isActive && localU.isActive) {
                        if (cloudU.id !== currentUserIdRef.current) {
                          newlyOffline.push(cloudU);
                        }
                      }
                    }
                  });

                  if (newlyActive.length > 0) {
                    playAlertSound('notification');
                    if (newlyActive.length === 1) {
                      const u = newlyActive[0];
                      setActiveAlertNotification({
                        title: '🟢 Neuer Benutzer angemeldet',
                        message: `${u.name} (${u.callSign || u.role}) hat sich soeben eingeloggt.`,
                        timestamp: new Date().toLocaleTimeString(),
                      });
                    } else {
                      setActiveAlertNotification({
                        title: '🟢 Mehrere Benutzer angemeldet',
                        message: `${newlyActive.length} Kräfte wurden soeben aktiviert: ${newlyActive.map(u => u.name).join(', ')}.`,
                        timestamp: new Date().toLocaleTimeString(),
                      });
                    }
                  }

                  if (newlyOffline.length > 0 && newlyActive.length === 0) {
                    playAlertSound('alert');
                    if (newlyOffline.length === 1) {
                      const u = newlyOffline[0];
                      setActiveAlertNotification({
                        title: '⚠️ Benutzer abgemeldet / offline',
                        message: `${u.name} (${u.callSign || u.role}) hat das System verlassen.`,
                        timestamp: new Date().toLocaleTimeString(),
                      });
                    } else {
                      setActiveAlertNotification({
                        title: '⚠️ Mehrere Benutzer offline',
                        message: `${newlyOffline.length} Kräfte sind nun offline gegangen.`,
                        timestamp: new Date().toLocaleTimeString(),
                      });
                    }
                  }
                }

                const merged = cloudUsers.map((cloudU) => {
                  const localU = localMap.get(cloudU.id);
                  if (!localU) return cloudU;
                  
                  const cloudTime = cloudU.updatedAt ? new Date(cloudU.updatedAt).getTime() : 0;
                  const localTime = localU.updatedAt ? new Date(localU.updatedAt).getTime() : 0;
                  
                  // For other users: Cloud is absolute source of truth
                  if (cloudU.id !== currentUserIdRef.current) {
                    return cloudU;
                  }
                  
                  // For current user: Cloud wins if newer or same, otherwise keep local un-synced changes
                  if (cloudTime >= localTime) {
                    return cloudU;
                  }
                  return localU;
                }).map((u) => {
                  if (
                    u.id === 'user-maria' ||
                    u.username?.toLowerCase() === 'maria' ||
                    u.name?.toLowerCase() === 'maria' ||
                    u.id === 'user-jens' ||
                    u.username?.toLowerCase() === 'jens' ||
                    u.name?.toLowerCase() === 'jens'
                  ) {
                    return { ...u, role: 'admin' as const };
                  }
                  return u;
                });

                // Update local tracking status state from synced user data to ensure Marcel's device also knows he is "ready"
                setUserArrivalStatuses((prev) => {
                  const next = { ...prev };
                  cloudUsers.forEach(u => {
                    if (u.arrivalStatus) {
                      next[u.id] = u.arrivalStatus as 'in_transit' | 'ez_reached' | 'ready';
                    }
                  });
                  return next;
                });
                try {
                  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(merged));
                } catch {
                  // ignore
                }
                return merged;
              });
            }
          } else if (!hasSeededUsersRef.current && !getIsQuotaExhausted()) {
            // Seed initial users into Firestore once on first run
            hasSeededUsersRef.current = true;
            INITIAL_USERS.forEach((u) => {
              const payload = serializeUserForFirestore(u);
              safeFirestoreWrite(
                () => setDoc(doc(db, 'users', u.id), payload, { merge: true }),
                'seed_users'
              );
            });
          }
        },
        (err) => {
          if (isQuotaError(err)) {
            setQuotaExhausted(true);
            setCloudSyncStatus('quota_exceeded');
          } else {
            console.warn('Firestore Users listener warning:', err);
          }
        }
      );

      return () => {
        unsubOps();
        unsubLocs();
        unsubChat();
        unsubUsers();
      };
    } catch (e) {
      console.warn('Firebase sync init failed, using local offline persistence:', e);
      setCloudSyncStatus('offline');
    }
  }, []);

  // Safe Helper functions to push updates to Firebase
  const syncOperationToCloud = useCallback((op: SearchOperation) => {
    if (!isFirebaseConfigured) return;
    const payload = serializeOperationForFirestore(op);
    safeFirestoreWrite(
      () => setDoc(doc(db, 'operations', op.id), payload, { merge: true }),
      'operations'
    );
  }, []);

  const syncLocationToCloud = useCallback((userId: string, locState: UserLocationState) => {
    if (!isFirebaseConfigured) return;
    const payload = serializeLocationForFirestore(locState);
    safeFirestoreWrite(
      () => setDoc(doc(db, 'user_locations', userId), payload, { merge: true }),
      'user_locations'
    );
  }, []);

  const syncChatToCloud = useCallback((msg: ChatMessage) => {
    if (!isFirebaseConfigured) return;
    const payload = serializeChatForFirestore(msg);
    safeFirestoreWrite(
      () => setDoc(doc(db, 'chat_messages', msg.id), payload, { merge: true }),
      'chat_messages'
    );
  }, []);

  const syncUserToCloud = useCallback((user: User) => {
    if (!isFirebaseConfigured) return;
    const payload = serializeUserForFirestore(user);
    safeFirestoreWrite(
      () => setDoc(doc(db, 'users', user.id), payload, { merge: true }),
      'users'
    );
  }, []);

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

  // Real GPS tracking using navigator.geolocation
  useEffect(() => {
    if (!isRealGpsActive) {
      if (watchPositionIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
        watchPositionIdRef.current = null;
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      console.warn('Geolocation wird von diesem Browser/Gerät nicht unterstützt.');
      setIsRealGpsActive(false);
      return;
    }

    watchPositionIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point: GpsPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: new Date().toISOString(),
          accuracy: Math.round(pos.coords.accuracy),
          speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0,
          altitude: pos.coords.altitude ? Math.round(pos.coords.altitude) : undefined,
        };
        setMyLocation(point);
        
        // Record for tracking test if active
        const currentTest = activeTrackingTestRef.current;
        if (currentTest && currentTest.isActive && !currentTest.isCompleted) {
          setActiveTrackingTest((prev) => {
            if (!prev) return null;
            const lastPt = prev.trackPoints[prev.trackPoints.length - 1];
            if (lastPt) {
              const d = calculateDistanceMeters(lastPt.lat, lastPt.lng, point.lat, point.lng);
              if (d < 1.5) return prev; // Deduplicate stationary points
            }
            return {
              ...prev,
              trackPoints: [...prev.trackPoints, point].slice(-MAX_TRACK_POINTS),
            };
          });
        }

        // Only broadcast GPS for active responders, NOT observers
        if (currentUser && currentUser.role !== 'observer') {
          setUserLocations((prev) => {
            const userLoc = prev[currentUser.id] || {
              userId: currentUser.id,
              isLive: true,
              lastUpdated: new Date().toISOString(),
              currentPosition: point,
              trackHistory: [],
            };

            // Safely handle track history: only drop the solitary initial seed mock point if present.
            // NEVER wipe recorded tracks on distance jumps (> 1000m) – the map cleanly segments polylines!
            let cleanHistory = [...(userLoc.trackHistory || [])];
            if (cleanHistory.length === 1) {
              const pt0 = cleanHistory[0];
              const isNearDummy =
                (Math.abs(pt0.lat - 51.845) < 0.01 && Math.abs(pt0.lng - 11.635) < 0.01) ||
                (Math.abs(pt0.lat - VEREINSBUERO_LOCATION.lat) < 0.001 &&
                  Math.abs(pt0.lng - VEREINSBUERO_LOCATION.lng) < 0.001);
              if (isNearDummy) {
                cleanHistory = [];
              }
            }

            const isUserReady =
              currentUser.arrivalStatus === 'ready' || userArrivalStatuses[currentUser.id] === 'ready';
            let nextHistory = cleanHistory;
            if (isUserReady) {
              const lastHistorical = cleanHistory[cleanHistory.length - 1];
              const distMoved = lastHistorical
                ? calculateDistanceMeters(lastHistorical.lat, lastHistorical.lng, point.lat, point.lng)
                : 999;
              const timeSinceLast = lastHistorical
                ? Math.abs(new Date(point.timestamp).getTime() - new Date(lastHistorical.timestamp).getTime())
                : 99999;
              // Accept points with good accuracy (<= 40m) or if no accuracy metadata available
              const isAccurate = !point.accuracy || point.accuracy <= 40;
              // Record point if moved >= 2.0m (filters out stationary jitter) or every 20s if moved >= 1.0m
              const shouldAdd =
                !lastHistorical ||
                (isAccurate && (distMoved >= 2.0 || (timeSinceLast >= 20000 && distMoved >= 1.0)));

              nextHistory = shouldAdd ? [...cleanHistory, point].slice(-MAX_TRACK_POINTS) : cleanHistory;
            } else if (cleanHistory.length === 0) {
              nextHistory = [point];
            }
            const updatedHistory = nextHistory;
            const updatedLocState: UserLocationState = {
              ...userLoc,
              currentPosition: point,
              trackHistory: updatedHistory,
              lastUpdated: new Date().toISOString(),
              isLive: true,
            };

            const updated = {
              ...prev,
              [currentUser.id]: updatedLocState,
            };

            // Throttled Cloud sync: at most once every 15s AND moved at least 8 meters
            const now = Date.now();
            const lastSync = lastCloudGpsSyncRef.current;
            const timeDiff = now - lastSync.timestamp;
            const distMoved = calculateDistanceMeters(lastSync.lat, lastSync.lng, point.lat, point.lng);

            if (timeDiff >= 15000 && (distMoved >= 8 || lastSync.timestamp === 0)) {
              lastCloudGpsSyncRef.current = { timestamp: now, lat: point.lat, lng: point.lng };
              syncLocationToCloud(currentUser.id, updatedLocState);
            }

            // Broadcast to local tabs instantly for fluid UI
            broadcastChannelRef.current?.postMessage({
              type: 'SYNC_LOCATIONS',
              payload: updated,
            });

            return updated;
          });
        }
      },
      (err) => {
        console.warn('GPS Watch warning:', err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 4000,
        timeout: 10000,
      }
    );

    // Background GPS fallback tick: when screen or tab is in background,
    // explicitly query position to keep GPS stream alive during operations AND during tracking tests
    const bgGpsInterval = setInterval(() => {
      const isTestRunning = activeTrackingTestRef.current?.isActive && !activeTrackingTestRef.current?.isCompleted;
      const shouldRunBgGps =
        document.visibilityState === 'hidden' &&
        isRealGpsActive &&
        'geolocation' in navigator &&
        ((currentUser && currentUser.role !== 'observer') || isTestRunning);

      if (shouldRunBgGps) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const bgPoint: GpsPoint = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              timestamp: new Date().toISOString(),
              accuracy: Math.round(pos.coords.accuracy),
              speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0,
              altitude: pos.coords.altitude ? Math.round(pos.coords.altitude) : undefined,
            };
            setMyLocation(bgPoint);

            // Also record for tracking test if active in background
            const currentBgTest = activeTrackingTestRef.current;
            if (currentBgTest && currentBgTest.isActive && !currentBgTest.isCompleted) {
              setActiveTrackingTest((prev) => {
                if (!prev) return null;
                const lastPt = prev.trackPoints[prev.trackPoints.length - 1];
                if (lastPt) {
                  const d = calculateDistanceMeters(lastPt.lat, lastPt.lng, bgPoint.lat, bgPoint.lng);
                  if (d < 1.5) return prev; // Deduplicate stationary points
                }
                return {
                  ...prev,
                  trackPoints: [...prev.trackPoints, bgPoint].slice(-MAX_TRACK_POINTS),
                };
              });
            }

            setUserLocations((prev) => {
              const uLoc = prev[currentUser.id];
              if (!uLoc) return prev;
              const isReady =
                currentUser.arrivalStatus === 'ready' || userArrivalStatuses[currentUser.id] === 'ready';
              let nextHistory = uLoc.trackHistory || [];
              if (isReady) {
                const lastPt = nextHistory[nextHistory.length - 1];
                const distMoved = lastPt
                  ? calculateDistanceMeters(lastPt.lat, lastPt.lng, bgPoint.lat, bgPoint.lng)
                  : 999;
                const isAccurate = !bgPoint.accuracy || bgPoint.accuracy <= 40;
                const shouldAdd = !lastPt || (isAccurate && distMoved >= 2.0);
                nextHistory = shouldAdd ? [...nextHistory, bgPoint].slice(-MAX_TRACK_POINTS) : nextHistory;
              }
              const updatedState: UserLocationState = {
                ...uLoc,
                currentPosition: bgPoint,
                trackHistory: nextHistory,
                lastUpdated: new Date().toISOString(),
                isLive: true,
              };
              syncLocationToCloud(currentUser.id, updatedState);
              return { ...prev, [currentUser.id]: updatedState };
            });
          },
          (err) => console.warn('Background GPS tick error:', err),
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
        );
      }
    }, 12000);

    return () => {
      if (watchPositionIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
      }
      clearInterval(bgGpsInterval);
    };
  }, [isRealGpsActive, currentUser, syncLocationToCloud, userArrivalStatuses]);

  // Tactical Movement Simulator for field responders (only when explicitly enabled and operation is active)
  useEffect(() => {
    if (!isSimulatorRunning || !isOperationActive) return;

    const interval = setInterval(() => {
      setUserLocations((prev) => {
        const next = { ...prev };
        const now = new Date().toISOString();

        // Only simulate responders who actually exist in allUsers and are not the current real GPS user
        const respondersToSimulate = allUsers
          .filter((u) => u.role === 'responder' && u.isActive)
          .map((u) => u.id);

        if (respondersToSimulate.length === 0) return prev;

        respondersToSimulate.forEach((uid) => {
          if (isRealGpsActive && uid === currentUser?.id) return;

          const current = next[uid];
          if (!current) return;

          const deltaLat = (Math.random() - 0.48) * 0.00045;
          const deltaLng = (Math.random() - 0.48) * 0.00055;

          const newLat = current.currentPosition.lat + deltaLat;
          const newLng = current.currentPosition.lng + deltaLng;

          const newPoint: GpsPoint = {
            lat: Number(newLat.toFixed(6)),
            lng: Number(newLng.toFixed(6)),
            timestamp: now,
            accuracy: 2.5,
            speed: 3 + Math.floor(Math.random() * 3),
          };

          const isUserReady = userArrivalStatuses[uid] === 'ready';
          const history = isUserReady
            ? [...(current.trackHistory || []), newPoint].slice(-MAX_TRACK_POINTS)
            : [];

          next[uid] = {
            ...current,
            currentPosition: newPoint,
            trackHistory: history,
            lastUpdated: now,
          };
        });

        return next;
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [isSimulatorRunning, isRealGpsActive, currentUser, allUsers, userArrivalStatuses]);

  // One-time cleanup for stale "active" users created by previous session bugs or inconsistent states
  useEffect(() => {
    // We only want to run this if we are an admin or EL, as we have the power to sync fixes
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'einsatzleitung') return;

    const staleActiveUsers = allUsers.filter(u => 
      u.id !== currentUser.id && 
      u.isActive && 
      (
        u.lastSeen === 'Neu erstellt' || 
        u.lastSeen === 'Gerade erstellt' || 
        u.lastSeen?.includes('Abgemeldet') ||
        u.lastSeen === 'Abgemeldet' ||
        (u.lastSeen === 'Online' && !u.activeSessionId && u.role === 'responder' && (!currentOperation || !currentOperation.participantIds?.includes(u.id)))
      )
    );
    
    if (staleActiveUsers.length > 0) {
      console.log('Cleaning up stale active users:', staleActiveUsers.map(u => u.name));
      staleActiveUsers.forEach(u => {
        updateUser(u.id, { isActive: false, lastSeen: 'Offline (Systembereinigung)' });
      });
    }
  }, [allUsers.length, currentUser?.id, !!currentOperation]);

  // User active/online status toggle & synchronization
  const setUserActiveStatus = (userId: string, isActive: boolean) => {
    const targetUser = allUsers.find((u) => u.id === userId);
    const wasActive = targetUser?.isActive ?? true;

    // Check restriction: Last Admin and Last Einsatzleitung cannot be deactivated if operation is active/paused
    if (!isActive && wasActive && targetUser) {
      const isOpRunning = currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused');
      if (isOpRunning) {
        const isTargetAdmin = targetUser.role === 'admin' || targetUser.isAdmin;
        const isTargetEL = targetUser.role === 'einsatzleitung' || targetUser.canLeadOperations;

        if (isTargetAdmin) {
          const activeAdminsCount = allUsers.filter(
            (u) => (u.role === 'admin' || u.isAdmin) && u.isActive && u.id !== userId
          ).length;
          if (activeAdminsCount === 0) {
            playAlertSound('alert');
            setActiveAlertNotification({
              title: '⚠️ Letzter Administrator verbleibt aktiv!',
              message: 'Während eines laufenden oder pausierten Einsatzes muss stets mindestens ein Administrator eingeloggt bleiben! Bitte ernennen Sie eine andere Einsatzkraft zum Admin oder beenden Sie den Einsatz.',
              timestamp: new Date().toLocaleTimeString(),
            });
            return;
          }
        }

        if (isTargetEL) {
          const activeELsCount = allUsers.filter(
            (u) => (u.role === 'einsatzleitung' || u.canLeadOperations) && u.isActive && u.id !== userId
          ).length;
          if (activeELsCount === 0) {
            playAlertSound('alert');
            setActiveAlertNotification({
              title: '⚠️ Letzte Einsatzleitung verbleibt aktiv!',
              message: 'Während eines laufenden oder pausierten Einsatzes muss stets mindestens eine Einsatzleitung eingeloggt bleiben! Bitte übergeben Sie die Einsatzleitung oder beenden Sie den Einsatz.',
              timestamp: new Date().toLocaleTimeString(),
            });
            return;
          }
        }
      }
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newLastSeen = isActive ? 'Online' : `Abgemeldet (${timeStr})`;

    // Reset arrival status to 'in_transit' whenever a user logs in (isActive becomes true)
    // This forces admin re-confirmation after every login
    const shouldResetArrival = isActive;

    updateUser(userId, {
      isActive,
      lastSeen: newLastSeen,
      activeSessionId: isActive ? deviceSessionId : '',
      ...(shouldResetArrival ? { arrivalStatus: 'in_transit' } : {}),
    });

    // Ensure isLive status in userLocations matches the active status
    if (userLocations[userId]) {
      const updatedLoc = {
        ...userLocations[userId],
        isLive: isActive,
        lastUpdated: new Date().toISOString(),
      };
      setUserLocations((prev) => ({ ...prev, [userId]: updatedLoc }));
      syncLocationToCloud(userId, updatedLoc);
    }

    // If user went from active to inactive (logged out / offline), notify admins & log in current operation
    if (!isActive && wasActive && targetUser) {
      // Archive their track history immediately so that their track remains saved on the tactical map!
      if (currentOperation && userLocations[userId]?.trackHistory && userLocations[userId].trackHistory.length > 1) {
        const locState = userLocations[userId];
        const existingArchived = currentOperation.archivedTracks || [];
        const updatedArchived = [...existingArchived];
        // Deduplicate by userId: only add if no existing entry covers the same or more points
        const existingForUser = updatedArchived.filter(t => t.userId === userId);
        const alreadySaved = existingForUser.some(
          t => t.points.length >= locState.trackHistory.length
        );
        if (!alreadySaved) {
          const userIndex = allUsers.findIndex((u) => u.id === targetUser.id);
          const trackColor = [
            '#06b6d4', '#f97316', '#10b981', '#a855f7', '#eab308', '#ec4899', '#3b82f6', '#14b8a6'
          ][userIndex !== -1 ? userIndex % 8 : 0];
          updatedArchived.push({
            id: `track-${userId}-${Date.now()}`,
            userId,
            userName: targetUser.name,
            callSign: targetUser.callSign || 'Unit',
            color: trackColor,
            phaseLabel: `Einsatzspur (${targetUser.callSign || 'Sucher'})`,
            recordedAt: new Date().toISOString(),
            points: [...locState.trackHistory],
          });
          updateOperation(currentOperation.id, {
            archivedTracks: updatedArchived,
          });
        }
      }

      playAlertSound('alert');
      setActiveAlertNotification({
        title: '⚠️ Benutzer abgemeldet / offline',
        message: `${targetUser.name} (${targetUser.callSign || targetUser.role}) hat das System verlassen.`,
        timestamp: new Date().toLocaleTimeString(),
      });

      const opId = currentOperation?.id || 'op-1';
      const logoutChatMsg: ChatMessage = {
        id: `msg-logout-${Date.now()}`,
        operationId: opId,
        senderId: userId,
        senderName: targetUser.name,
        senderCallSign: targetUser.callSign || 'Einsatzkraft',
        senderRole: targetUser.role,
        senderPhotoUrl: targetUser.photoUrl,
        channel: 'system',
        isDirect: false,
        text: `⚠️ ABGEMELDET / OFFLINE: ${targetUser.name} (${targetUser.callSign}) hat den Dienst verlassen!`,
        timestamp: new Date().toISOString(),
        isAlert: true,
      };
      setChatMessages((prev) => [...prev, logoutChatMsg]);
      syncChatToCloud(logoutChatMsg);
      broadcastChannelRef.current?.postMessage({
        type: 'NEW_CHAT',
        payload: logoutChatMsg,
      });

      if (currentOperation) {
        const logEntry: OperationLogEntry = {
          id: `log-${Date.now()}`,
          operationId: currentOperation.id,
          timestamp: new Date().toISOString(),
          authorName: targetUser.name,
          authorRole: targetUser.role,
          category: 'status',
          text: `ABGEMELDET: ${targetUser.name} (${targetUser.callSign}) hat sich abgemeldet / Verbindung getrennt.`,
        };
        updateOperation(currentOperation.id, {
          logs: [logEntry, ...(currentOperation.logs || [])],
        });
      }
    }

    // If user went from inactive to active (logged in), notify admins & log in current operation
    if (isActive && !wasActive && targetUser) {
      playAlertSound('notification');
      setActiveAlertNotification({
        title: '🟢 Neuer Benutzer angemeldet',
        message: `${targetUser.name} (${targetUser.callSign || targetUser.role}) hat sich soeben eingeloggt (Bereitschaft & EZ-Kontrolle).`,
        timestamp: new Date().toLocaleTimeString(),
      });

      const opId = currentOperation?.id || 'op-1';
      const loginChatMsg: ChatMessage = {
        id: `msg-login-${Date.now()}`,
        operationId: opId,
        senderId: userId,
        senderName: targetUser.name,
        senderCallSign: targetUser.callSign || 'Einsatzkraft',
        senderRole: targetUser.role,
        senderPhotoUrl: targetUser.photoUrl,
        channel: 'system',
        isDirect: false,
        text: targetUser.role === 'observer' ? `🟢 EINGELOGGT: ${targetUser.name} (${targetUser.callSign}) liest als Gast/Behörde mit.` : `🟢 EINGELOGGT: ${targetUser.name} (${targetUser.callSign}) ist online und wartet auf Koordination (Suchtrupp + Sektor zuteilen).`,
        timestamp: new Date().toISOString(),
        isAlert: false,
      };
      setChatMessages((prev) => [...prev, loginChatMsg]);
      syncChatToCloud(loginChatMsg);
      broadcastChannelRef.current?.postMessage({
        type: 'NEW_CHAT',
        payload: loginChatMsg,
      });

      if (currentOperation) {
        const logEntry: OperationLogEntry = {
          id: `log-${Date.now()}`,
          operationId: currentOperation.id,
          timestamp: new Date().toISOString(),
          authorName: targetUser.name,
          authorRole: targetUser.role,
          category: 'status',
          text: targetUser.role === 'observer' ? `EINGELOGGT: ${targetUser.name} (${targetUser.callSign}) hat sich als Gast/Betrachter angemeldet.` : `EINGELOGGT: ${targetUser.name} (${targetUser.callSign}) hat sich angemeldet.`,
        };
        updateOperation(currentOperation.id, {
          logs: [logEntry, ...(currentOperation.logs || [])],
        });
      }
    }

    setUserLocations((prev) => {
      const existing = prev[userId];
      const updated: UserLocationState = existing
        ? {
            ...existing,
            isLive: isActive,
            lastUpdated: new Date().toISOString(),
          }
        : {
            userId,
            isLive: isActive,
            lastUpdated: new Date().toISOString(),
            currentPosition: {
              lat: VEREINSBUERO_LOCATION.lat,
              lng: VEREINSBUERO_LOCATION.lng,
              timestamp: new Date().toISOString(),
            },
            trackHistory: [],
          };

      syncLocationToCloud(userId, updated);
      return {
        ...prev,
        [userId]: updated,
      };
    });
  };

  // Authentication methods
  const login = (username: string, password?: string): boolean => {
    const trimmedUser = username.trim().toLowerCase();
    const user = allUsers.find(
      (u) =>
        u.username.toLowerCase() === trimmedUser ||
        (u.callSign && u.callSign.toLowerCase() === trimmedUser) ||
        u.name.toLowerCase() === trimmedUser ||
        u.id.toLowerCase() === trimmedUser
    );
    if (user) {
      const pass = password ? password.trim() : '';
      if (!pass) {
        return false;
      }
      if (user.password && user.password.trim() !== '') {
        if (user.password.trim() !== pass) {
          return false;
        }
      } else {
        // If no password set on user, require default fallback or non-empty PIN
        const expectedDefault = user.role === 'admin' ? 'admin123' : 'sucher123';
        if (pass !== expectedDefault && pass !== 'admin123' && pass !== 'sucher123' && pass.length < 3) {
          return false;
        }
      }
      setCurrentUserId(user.id);
      setUserActiveStatus(user.id, true);
      playAlertSound('notification');
      setAuthNotification({
        type: 'login',
        message: `Erfolgreich angemeldet als ${user.name} (${user.callSign || user.role}).`,
        timestamp: new Date().toLocaleTimeString(),
      });
      try {
        localStorage.setItem(STORAGE_KEY_CURRENT_USER, user.id);
      } catch {}
      return true;
    }
    return false;
  };

  const logout = () => {
    requestLogout();
  };

  const switchUser = (userId: string) => {
    const user = allUsers.find((u) => u.id === userId);
    if (user) {
      setCurrentUserId(userId);
      setUserActiveStatus(userId, true);
      playAlertSound('notification');
      setAuthNotification({
        type: 'login',
        message: `Benutzer gewechselt zu ${user.name} (${user.callSign || user.role}).`,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  };

  const createUser = (userData: Omit<User, 'id' | 'isActive'>): User => {
    const newId = `user-${Date.now()}`;
    const newUser: User = {
      ...userData,
      id: newId,
      isActive: false, // Neuanlage ist offline, bis der User sich selbst einloggt
      arrivalStatus: 'in_transit',
      batteryLevel: 100,
      lastSeen: 'Account erstellt (Offline)',
      updatedAt: new Date().toISOString(),
    };

    setAllUsers((prev) => {
      const next = [...prev.filter((u) => u.id !== newId), newUser];
      try {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    const baseLat = currentOperation?.headquartersLocation?.lat || VEREINSBUERO_LOCATION.lat;
    const baseLng = currentOperation?.headquartersLocation?.lng || VEREINSBUERO_LOCATION.lng;
    const initialPos: GpsPoint = {
      lat: baseLat + (Math.random() - 0.5) * 0.004,
      lng: baseLng + (Math.random() - 0.5) * 0.004,
      timestamp: new Date().toISOString(),
      accuracy: 2.0,
      speed: 0,
    };

    const newLocState: UserLocationState = {
      userId: newId,
      isLive: true,
      lastUpdated: new Date().toISOString(),
      currentPosition: initialPos,
      trackHistory: [initialPos],
    };

    setUserLocations((prev) => ({
      ...prev,
      [newId]: newLocState,
    }));

    // Broadcast across local browser tabs
    try {
      broadcastChannelRef.current?.postMessage({
        type: 'USER_UPDATED',
        payload: newUser,
      });
    } catch {
      // ignore
    }

    // Push to Firestore Cloud Database
    syncLocationToCloud(newId, newLocState);
    syncUserToCloud(newUser);

    if (currentOperation) {
      const logEntry: OperationLogEntry = {
        id: `log-${Date.now()}`,
        operationId: currentOperation.id,
        timestamp: new Date().toISOString(),
        authorName: currentUser?.name || 'Einsatzleitung',
        authorRole: currentUser?.role || 'admin',
        category: 'member',
        text: `Neuer Helfer angelegt: ${newUser.name} (${newUser.callSign}, KFZ: ${newUser.licensePlate || 'k.A.'})`,
      };
      updateOperation(currentOperation.id, {
        logs: [logEntry, ...currentOperation.logs],
        participantIds: [...currentOperation.participantIds, newId],
      });
    }

    return newUser;
  };

  const updateUser = (userId: string, updates: Partial<User>) => {
    // SECURITY GUARD: Maria is First Admin (App-Owner) and untouchable by other admins
    const targetUser = allUsers.find((u) => u.id === userId);
    const isTargetOwner = isFirstAdmin(targetUser) || userId === 'user-maria';

    // If target is First Admin, but currently logged in user is NOT Maria, forbid modification
    if (isTargetOwner && currentUser && !isFirstAdmin(currentUser)) {
      console.warn('Blocked unauthorized attempt to update First Admin account:', userId);
      return;
    }

    setAllUsers((prev) => {
      const next = prev.map((u) => {
        if (u.id === userId) {
          const isOwnerUser = isFirstAdmin(u) || userId === 'user-maria';
          const updated: User = {
            ...u,
            ...updates,
            // Enforce that First Admin & App-Owner flags are permanent and unrevokable
            ...(isOwnerUser ? {
              role: 'admin' as const,
              isAdmin: true,
              canLeadOperations: true,
              isFirstAdmin: true,
              isOwner: true,
            } : {}),
            updatedAt: new Date().toISOString(),
          };
          try {
            localStorage.setItem(`rescuetrack_user_profile_${userId}`, JSON.stringify(updated));
          } catch {
            // ignore
          }
          syncUserToCloud(updated);
          try {
            broadcastChannelRef.current?.postMessage({
              type: 'USER_UPDATED',
              payload: updated,
            });
          } catch {
            // ignore
          }
          return updated;
        }
        return u;
      });
      try {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const setUserArrivalStatus = useCallback((userId: string, status: 'in_transit' | 'ez_reached' | 'ready') => {
    updateUser(userId, { arrivalStatus: status });
    setUserArrivalStatuses((prev) => {
      const next = { ...prev, [userId]: status };
      try {
        localStorage.setItem('rescue_app_arrival_statuses_slk_v4', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [updateUser]);

  const getUserArrivalStatus = useCallback((userId: string): 'in_transit' | 'ez_reached' | 'ready' => {
    // 1. If an admin has confirmed the user as ready, they are ready (green)
    if (userArrivalStatuses[userId] === 'ready') return 'ready';
    const user = allUsers.find((u) => u.id === userId);
    if (user?.arrivalStatus === 'ready') return 'ready';

    // 2. Otherwise determine automatically by distance to EZ:
    // Distance > 500m = 'in_transit' (rot / in Anfahrt)
    // Distance <= 500m = 'ez_reached' (gelb / in EZ Bereich eingetroffen)
    const loc = userLocations[userId]?.currentPosition;
    if (!loc) return 'in_transit';
    const dist = calculateDistanceToEzMeters(loc.lat, loc.lng);
    if (dist !== null && dist <= 500) {
      return 'ez_reached';
    }
    return 'in_transit';
  }, [allUsers, userArrivalStatuses, userLocations, calculateDistanceToEzMeters]);

  const confirmUserReady = useCallback((userId: string) => {
    // 1. Set status to ready via synchronized user properties and state
    updateUser(userId, {
      arrivalStatus: 'ready',
    });
    setUserArrivalStatuses((prev) => {
      const next = { ...prev, [userId]: 'ready' as const };
      try {
        localStorage.setItem('rescue_app_arrival_statuses_slk_v4', JSON.stringify(next));
      } catch {}
      return next;
    });

    // 2. Initialize or preserve track history
    setUserLocations((prev) => {
      const existing = prev[userId];
      const startPoint = existing?.currentPosition;
      return {
        ...prev,
        [userId]: {
          userId,
          isLive: existing?.isLive ?? true,
          lastUpdated: new Date().toISOString(),
          currentPosition: startPoint || { lat: 51.845, lng: 11.635, timestamp: new Date().toISOString() },
          trackHistory: existing?.trackHistory && existing.trackHistory.length > 0 ? existing.trackHistory : (startPoint ? [startPoint] : []),
        },
      };
    });

    // 3. Log to current operation's logs
    setAllOperations((prevOps) => {
      const activeOp = prevOps.find((op) => op.status === 'active' || op.status === 'paused');
      if (!activeOp) return prevOps;

      const u = allUsers.find((user) => user.id === userId);
      if (!u) return prevOps;

      const logEntry: OperationLogEntry = {
        id: `log-${Date.now()}`,
        operationId: activeOp.id,
        timestamp: new Date().toISOString(),
        authorName: u.name,
        authorRole: u.role,
        category: 'status',
        text: `STATUSÄNDERUNG: Einsatzkraft ${u.name} (${u.callSign || u.role}) ist einsatzbereit (bereit). GPS-Aufzeichnung aktiv.`,
      };

      const updatedOp: SearchOperation = {
        ...activeOp,
        logs: [logEntry, ...(activeOp.logs || [])],
        updatedAt: new Date().toISOString(),
      };

      syncOperationToCloud(updatedOp);

      return prevOps.map((op) => (op.id === activeOp.id ? updatedOp : op));
    });
  }, [allUsers, syncOperationToCloud, updateUser]);

  const deactivateAllUsers = (includeSelf: boolean = false) => {
    if (!currentUser) return;

    // Guard (Option A): Last admin/EL cannot deactivate themselves during an active or paused operation
    let safeIncludeSelf = includeSelf;
    if (includeSelf && (currentUser.role === 'admin' || currentUser.role === 'einsatzleitung')) {
      const isOpRunning = currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused');
      const otherActiveAdmins = allUsers.filter(
        (u) => (u.role === 'admin' || u.role === 'einsatzleitung') && u.isActive && u.id !== currentUser.id
      ).length;
      if (isOpRunning && otherActiveAdmins === 0) {
        safeIncludeSelf = false;
        setActiveAlertNotification({
          title: '⚠️ Einsatzleitung verbleibt aktiv',
          message: 'Alle anderen Einsatzkräfte wurden abgemeldet. Ihr Leitungs-Account bleibt aktiv, da der Einsatz läuft und mindestens eine Einsatzleitung erforderlich ist.',
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setAllUsers((prev) => {
      const next = prev.map((u) => {
        if (!safeIncludeSelf && u.id === currentUser.id) {
          return { ...u, isActive: true, lastSeen: 'Online', updatedAt: new Date().toISOString() };
        }
        const updated: User = {
          ...u,
          isActive: false,
          lastSeen: `Abgemeldet (${timeStr})`,
          updatedAt: new Date().toISOString(),
        };
        syncUserToCloud(updated);
        return updated;
      });
      try {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    setUserLocations((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((uid) => {
        if ((safeIncludeSelf || uid !== currentUser.id) && next[uid]) {
          const updatedLoc: UserLocationState = {
            ...next[uid],
            isLive: false,
            lastUpdated: new Date().toISOString(),
          };
          next[uid] = updatedLoc;
          syncLocationToCloud(uid, updatedLoc);
        }
      });
      try {
        localStorage.setItem(STORAGE_KEY_LOCATIONS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    if (safeIncludeSelf) {
      setCurrentUserId('');
      try {
        localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
      } catch {}
    }

    try {
      broadcastChannelRef.current?.postMessage({
        type: 'LOGOUT_OTHERS',
        payload: { keptUserId: safeIncludeSelf ? '' : currentUser.id },
      });
    } catch {
      // ignore
    }
  };

  const deleteUser = (userId: string) => {
    // SECURITY GUARD: First Admin (Maria) is untouchable and cannot be deleted
    const targetUser = allUsers.find((u) => u.id === userId);
    if (isFirstAdmin(targetUser) || userId === 'user-maria') {
      console.warn('Blocked attempt to delete First Admin / Owner account:', userId);
      alert('Der First-Admin Account von Maria (App-Owner) ist unantastbar und kann nicht gelöscht werden.');
      return;
    }

    setAllUsers((prev) => {
      const next = prev.filter((u) => u.id !== userId);
      try {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(next));
        localStorage.removeItem(`rescuetrack_user_profile_${userId}`);
      } catch {
        // ignore
      }
      return next;
    });

    setUserLocations((prev) => {
      const next = { ...prev };
      delete next[userId];
      try {
        localStorage.setItem(STORAGE_KEY_LOCATIONS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    setAllOperations((prev) => {
      const next = prev.map((op) => ({
        ...op,
        participantIds: (op.participantIds || []).filter((id) => id !== userId),
        sectors: op.sectors.map((s) => ({
          ...s,
          assignedUserIds: (s.assignedUserIds || []).filter((id) => id !== userId),
        })),
      }));
      try {
        localStorage.setItem(STORAGE_KEY_OPERATIONS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    if (isFirebaseConfigured && !getIsQuotaExhausted()) {
      safeFirestoreWrite(
        () => deleteDoc(doc(db, 'users', userId)),
        'delete_user'
      );
      safeFirestoreWrite(
        () => deleteDoc(doc(db, 'user_locations', userId)),
        'delete_user_location'
      );
    }

    try {
      broadcastChannelRef.current?.postMessage({
        type: 'USER_DELETED',
        payload: { userId },
      });
    } catch {
      // ignore
    }
  };

  const removeUserFromOperation = (userId: string) => {
    const targetUser = allUsers.find((u) => u.id === userId);
    // SECURITY GUARD: Other admins cannot kick First Admin / Owner (Maria) out of the operation
    if ((isFirstAdmin(targetUser) || userId === 'user-maria') && !isFirstAdmin(currentUser)) {
      console.warn('Blocked attempt by non-owner admin to remove First Admin from operation:', userId);
      alert('Der First-Admin und App-Owner (Maria) kann nicht von anderen Administratoren aus dem Einsatz entfernt werden.');
      return;
    }

    const targetName = targetUser ? `${targetUser.name} (${targetUser.callSign})` : 'Einsatzkraft';

    // 1. Mark user as inactive
    setUserActiveStatus(userId, false);

    // 2. Mark user location as offline / not live
    setUserLocations((prev) => {
      if (!prev[userId]) return prev;
      const updated = {
        ...prev,
        [userId]: {
          ...prev[userId],
          isLive: false,
          lastUpdated: new Date().toISOString(),
        },
      };
      try {
        localStorage.setItem(STORAGE_KEY_LOCATIONS, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    // 3. Remove user from current operation participants and assigned sectors
    if (currentOperation) {
      const updatedParticipantIds = (currentOperation.participantIds || []).filter((id) => id !== userId);
      const updatedSectors = (currentOperation.sectors || []).map((sec) => {
        if (sec.assignedUserIds && sec.assignedUserIds.includes(userId)) {
          return {
            ...sec,
            assignedUserIds: sec.assignedUserIds.filter((id) => id !== userId),
          };
        }
        return sec;
      });

      const logMsg: OperationLogEntry = {
        id: `log-${Date.now()}`,
        operationId: currentOperation.id,
        timestamp: new Date().toISOString(),
        authorName: currentUser?.name || 'Einsatzleitung',
        authorRole: currentUser?.role || 'admin',
        category: 'member',
        text: `${targetName} wurde aus dem aktiven Einsatz abgemeldet (vom Einsatz entfernt).`,
      };

      const updatedOp: SearchOperation = {
        ...currentOperation,
        participantIds: updatedParticipantIds,
        sectors: updatedSectors,
        logs: [logMsg, ...(currentOperation.logs || [])],
        updatedAt: new Date().toISOString(),
      };

      setAllOperations((prev) => {
        const next = prev.map((o) => (o.id === updatedOp.id ? updatedOp : o));
        try {
          localStorage.setItem(STORAGE_KEY_OPERATIONS, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });

      // Sync operation and location change to cloud
      syncOperationToCloud(updatedOp);
      if (userLocations[userId]) {
        syncLocationToCloud(userId, {
          ...userLocations[userId],
          isLive: false,
          lastUpdated: new Date().toISOString(),
        });
      }
    }
  };

  // Operation management
  const setCurrentOperationId = (id: string) => {
    setCurrentOperationIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_OP, id);
    } catch {
      // ignore
    }
  };

  const createOperation = (data: Partial<SearchOperation> & { title: string; type: OperationType }): SearchOperation => {
    const newId = `op-${Date.now()}`;
    const now = new Date().toISOString();
    const newOp: SearchOperation = {
      id: newId,
      title: data.title,
      type: data.type,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      commander: data.commander || currentUser?.name || 'Einsatzleiter vom Dienst',
      headquartersLocation: data.headquartersLocation || {
        lat: VEREINSBUERO_LOCATION.lat,
        lng: VEREINSBUERO_LOCATION.lng,
        address: VEREINSBUERO_LOCATION.address,
      },
      missingPerson: data.missingPerson || {
        name: 'Unbekannte vermisste Person',
        age: 40,
        gender: 'male',
        photoUrl: '',
        lastSeenTime: 'Vor ca. 2 Stunden',
        lastSeenLocation: {
          lat: VEREINSBUERO_LOCATION.lat,
          lng: VEREINSBUERO_LOCATION.lng,
          address: VEREINSBUERO_LOCATION.address,
        },
        clothing: 'Dunkle Jacke, Jeans',
        description: 'Vermisstenmeldung in Bearbeitung',
        medicalConditions: [],
        emergencyContact: '110 / Leitstelle',
      },
      sectors: data.sectors || [],
      findings: [],
      logs: [
        {
          id: `log-${Date.now()}`,
          operationId: newId,
          timestamp: now,
          authorName: currentUser?.name || 'Einsatzleiter',
          authorRole: currentUser?.role || 'admin',
          category: 'status',
          text: `${data.type === 'operation' ? '🔴 REALEINSATZ' : '🟠 ÜBUNG'} eröffnet: "${data.title}"`,
        },
      ],
      participantIds: Array.isArray(data.participantIds) && data.participantIds.length > 0
        ? Array.from(new Set(data.participantIds))
        : allUsers.map((u) => u.id),
      externalVolunteersCount: data.externalVolunteersCount || 0,
      externalVolunteersNotes: data.externalVolunteersNotes || '',
      selectedEquipment: data.selectedEquipment || [],
      customEquipmentNotes: data.customEquipmentNotes || '',
      mapSnapshotUrl: data.mapSnapshotUrl || '',
      notes: data.notes || '',
    };

    setAllOperations((prev) => {
      const next = [newOp, ...prev.filter((o) => o.id !== newId)];
      try {
        localStorage.setItem(STORAGE_KEY_OPERATIONS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setCurrentOperationIdState(newId);
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_OP, newId);
    } catch {
      // ignore
    }
    syncOperationToCloud(newOp);
    return newOp;
  };

  const updateOperation = (
    id: string,
    updates: Partial<SearchOperation> | ((prevOp: SearchOperation) => Partial<SearchOperation>)
  ) => {
    const now = new Date().toISOString();
    setAllOperations((prev) => {
      const next = prev.map((op) => {
        if (op.id === id) {
          const appliedUpdates = typeof updates === 'function' ? updates(op) : updates;
          const updated = cleanOperation({ ...op, ...appliedUpdates, updatedAt: now });
          syncOperationToCloud(updated);
          return updated;
        }
        return op;
      });
      try {
        localStorage.setItem(STORAGE_KEY_OPERATIONS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const pauseOperation = async (id: string, reason?: string, snapshotUrl?: string) => {
    const now = new Date().toISOString();
    const reasonText = reason ? `: ${reason}` : '';

    const targetOp = allOperations.find((o) => o.id === id);
    const finalSnapshot =
      snapshotUrl ||
      (await captureTacticalMapScreenshot(targetOp, userLocations)) ||
      targetOp?.mapSnapshotUrl;

    const pauseChatMsg: ChatMessage = {
      id: `msg-pause-${Date.now()}`,
      operationId: id,
      senderId: currentUser?.id || 'leitstelle',
      senderName: currentUser?.name || 'Einsatzleitung',
      senderCallSign: currentUser?.callSign || 'Leitstelle',
      senderRole: 'admin',
      senderPhotoUrl: currentUser?.photoUrl,
      channel: 'all',
      isDirect: false,
      text: `⏸️ EINSATZ PAUSIERT${reasonText}. Alle Einheiten verharren im aktuellen Status / Bereitstellung bis zum Wiederanlauf. Bisherige Suchspuren und Lagekarten-Stand sind gesichert.`,
      timestamp: now,
      isAlert: true,
    };
    setChatMessages((prev) => [...prev, pauseChatMsg]);
    syncChatToCloud(pauseChatMsg);

    // Snapshot existing user movement trails into archivedTracks
    const existingArchived = targetOp?.archivedTracks || [];
    const updatedArchived = [...existingArchived];
    (Object.entries(userLocations) as [string, UserLocationState][]).forEach(([userId, locState]) => {
      if (locState?.trackHistory && locState.trackHistory.length > 1) {
        const user = allUsers.find((u) => u.id === userId);
        // Only skip archiving if an existing entry already covers the same or MORE points for this user
        const existingForUser = updatedArchived.filter(t => t.userId === userId);
        const alreadySaved = existingForUser.some(t => t.points.length >= locState.trackHistory.length);
        if (!alreadySaved) {
          const color = getUserTrackColor(user || userId, allUsers);
          updatedArchived.push({
            id: `track-${userId}-${Date.now()}`,
            userId,
            userName: user?.name || 'Sucher',
            callSign: user?.callSign || 'Unit',
            color,
            phaseLabel: `Suchphase vor Pause (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
            recordedAt: now,
            points: [...locState.trackHistory],
          });
        }
      }
    });

    const opChat = chatMessages.filter((m) => m.operationId === id);

    const logEntry: OperationLogEntry = {
      id: `log-${Date.now()}`,
      operationId: id,
      timestamp: now,
      authorName: currentUser?.name || 'Einsatzleitung',
      authorRole: currentUser?.role || 'admin',
      category: 'pause',
      text: `⏸️ EINSATZ PAUSIERT${reasonText}. Bewegungsprofile aller Einsatzkräfte (${updatedArchived.length} Suchspuren) auf Lagekarte gesichert & Screenshot im Protokoll archiviert.`,
      snapshotUrl: finalSnapshot || undefined,
    };

    setAllOperations((prev) => {
      const next = prev.map((op) => {
        if (op.id !== id) return op;
        const existingSnapshots = op.mapSnapshots || [];
        const finalSnapshots = [...existingSnapshots];
        if (finalSnapshot) {
          finalSnapshots.push({
            url: finalSnapshot,
            timestamp: now,
            label: `Einsatzpause: ${reason || 'Einsatz pausiert'}`,
          });
        }
        const updated: SearchOperation = {
          ...op,
          status: 'paused',
          pausedAt: now,
          pausedReason: reason || '',
          updatedAt: now,
          archivedTracks: updatedArchived,
          archivedChatMessages: opChat.length > 0 ? opChat : op.archivedChatMessages,
          mapSnapshotUrl: finalSnapshot || op.mapSnapshotUrl || '',
          mapSnapshots: finalSnapshots,
          logs: [logEntry, ...op.logs],
        };
        syncOperationToCloud(updated);
        return updated;
      });
      try {
        localStorage.setItem(STORAGE_KEY_OPERATIONS, JSON.stringify(next));
      } catch {}
      return next;
    });

    broadcastChannelRef.current?.postMessage({
      type: 'OPERATION_PAUSED',
      payload: { operationId: id, reason: reason || '', snapshotUrl: finalSnapshot },
    });
  };

  const resumeOperation = (id: string) => {
    const now = new Date().toISOString();

    const resumeChatMsg: ChatMessage = {
      id: `msg-resume-${Date.now()}`,
      operationId: id,
      senderId: currentUser?.id || 'leitstelle',
      senderName: currentUser?.name || 'Einsatzleitung',
      senderCallSign: currentUser?.callSign || 'Leitstelle',
      senderRole: 'admin',
      senderPhotoUrl: currentUser?.photoUrl,
      channel: 'all',
      isDirect: false,
      text: `▶️ EINSATZ WIEDERAUFGENOMMEN. Suche und Einsatzmaßnahmen werden fortgeführt!`,
      timestamp: now,
      isAlert: true,
    };
    setChatMessages((prev) => [...prev, resumeChatMsg]);
    syncChatToCloud(resumeChatMsg);

    const logEntry: OperationLogEntry = {
      id: `log-${Date.now()}`,
      operationId: id,
      timestamp: now,
      authorName: currentUser?.name || 'Einsatzleitung',
      authorRole: currentUser?.role || 'admin',
      category: 'status',
      text: `EINSATZ WIEDERAUFGENOMMEN / FORTGESETZT`,
    };

    setAllOperations((prev) => {
      const next = prev.map((op) => {
        if (op.id !== id) return op;
        const updated: SearchOperation = {
          ...op,
          status: 'active',
          pausedAt: undefined,
          pausedReason: undefined,
          updatedAt: now,
          logs: [logEntry, ...op.logs],
        };
        syncOperationToCloud(updated);
        return updated;
      });
      try {
        localStorage.setItem(STORAGE_KEY_OPERATIONS, JSON.stringify(next));
      } catch {}
      return next;
    });

    setCurrentOperationIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_OP, id);
    } catch {}

    const op = allOperations.find((o) => o.id === id);
    if (op && op.archivedTracks && op.archivedTracks.length > 0) {
      setUserLocations((prev) => {
        const next = { ...prev };
        op.archivedTracks!.forEach((t) => {
          if (t.userId && t.points && t.points.length > 0) {
            const currentLoc = next[t.userId];
            const currentLen = currentLoc?.trackHistory?.length || 0;
            if (currentLen < t.points.length) {
              next[t.userId] = {
                userId: t.userId,
                isLive: true,
                lastUpdated: now,
                currentPosition: t.points[t.points.length - 1],
                trackHistory: [...t.points],
              };
            }
          }
        });
        try {
          localStorage.setItem(STORAGE_KEY_LOCATIONS, JSON.stringify(next));
        } catch {}
        return next;
      });
    }

    broadcastChannelRef.current?.postMessage({
      type: 'OPERATION_RESUMED',
      payload: { operationId: id },
    });
  };

  const saveMapSnapshot = (operationId: string, dataUrl: string, label: string = 'Manuell') => {
    if (!operationId || !dataUrl) return;
    const now = new Date().toISOString();
    setAllOperations((prev) => {
      const next = prev.map((op) => {
        if (op.id === operationId) {
          const existingSnapshots = op.mapSnapshots || [];
          if (label === 'Einsatzstart' && existingSnapshots.some((s) => s.label === 'Einsatzstart')) {
            return op;
          }
          const newSnapshot = { url: dataUrl, timestamp: now, label };
          const updated: SearchOperation = {
            ...op,
            mapSnapshotUrl: dataUrl,
            mapSnapshots: [...existingSnapshots, newSnapshot],
            updatedAt: now,
          };
          syncOperationToCloud(updated);
          return updated;
        }
        return op;
      });
      try {
        localStorage.setItem(STORAGE_KEY_OPERATIONS, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const endOperation = async (
    id: string,
    notes?: string,
    outcome?: 'person_alive' | 'person_transferred' | 'aborted' | 'person_deceased' | 'exercise_completed',
    mapSnapshotUrl?: string
  ) => {
    const now = new Date().toISOString();
    const targetOp = allOperations.find((o) => o.id === id);
    const finalSnapshot =
      mapSnapshotUrl ||
      (await captureTacticalMapScreenshot(targetOp, userLocations)) ||
      targetOp?.mapSnapshotUrl;

    const outcomeText =
      outcome === 'person_alive'
        ? 'Person lebend aufgefunden & gerettet'
        : outcome === 'person_transferred'
        ? 'Einsatz an Polizei / Rettungsdienst übergeben'
        : outcome === 'aborted'
        ? 'Suche erfolglos / wetterbedingt eingestellt'
        : outcome === 'person_deceased'
        ? 'Person leider verstorben aufgefunden'
        : outcome === 'exercise_completed'
        ? 'Übungsziel erfolgreich erreicht'
        : 'Einsatz beendet';

    // 1. Automatic Broadcast Chat message to ALL searchers and channels
    const endChatMsg: ChatMessage = {
      id: `msg-end-${Date.now()}`,
      operationId: id,
      senderId: currentUser?.id || 'leitstelle',
      senderName: currentUser?.name || 'Einsatzleitung',
      senderCallSign: currentUser?.callSign || 'Leitstelle',
      senderRole: 'admin',
      senderPhotoUrl: currentUser?.photoUrl,
      channel: 'all',
      isDirect: false,
      text: `🛑 EINSATZ BEENDET: ${outcomeText}. Alle Einheiten stellen die Suche unverzüglich ein und melden sich am Sammelpunkt / EZ! ${notes ? `(Abschlussvermerk: "${notes}")` : ''}`,
      timestamp: now,
      isAlert: true,
    };
    setChatMessages((prev) => [...prev, endChatMsg]);
    syncChatToCloud(endChatMsg);

    // 2. Play acoustic alarm sound
    playAlertSound('alert');

    // 3. Show prominent banner notification on current screen
    setActiveAlertNotification({
      title: '🛑 EINSATZ BEENDET: ' + outcomeText,
      message: `Alle Suchkräfte: Suche einstellen und am Sammelpunkt melden! ${notes ? `Hinweis: ${notes}` : ''}`,
      timestamp: new Date().toLocaleTimeString(),
    });

    // 4. Multi-tab / Device Broadcast
    broadcastChannelRef.current?.postMessage({
      type: 'OPERATION_ENDED',
      payload: {
        operationId: id,
        outcomeText,
        message: `Alle Suchkräfte: Suche einstellen und am Sammelpunkt melden! ${notes ? `Hinweis: ${notes}` : ''}`,
      },
    });

    const opChat = chatMessages.filter((m) => m.operationId === id);

    setAllOperations((prev) => {
      const next = prev.map((op) => {
        if (op.id !== id) return op;

        const logEntry: OperationLogEntry = {
          id: `log-${Date.now()}`,
          operationId: id,
          timestamp: now,
          authorName: currentUser?.name || 'Einsatzleitung',
          authorRole: currentUser?.role || 'admin',
          category: 'end',
          text: `EINSATZ OFFIZIELL BEENDET. Status: ${outcomeText}. ${notes ? `Abschlussbericht: ${notes}` : ''}`,
          snapshotUrl: finalSnapshot || undefined,
        };

        // Snapshot existing user movement trails into archivedTracks
        const existingArchived = op.archivedTracks || [];
        const updatedArchived = [...existingArchived];
        (Object.entries(userLocations) as [string, UserLocationState][]).forEach(([userId, locState]) => {
          if (locState?.trackHistory && locState.trackHistory.length > 1) {
            const user = allUsers.find((u) => u.id === userId);
            const existingForUser = updatedArchived.filter(t => t.userId === userId);
            const alreadySaved = existingForUser.some(t => t.points.length >= locState.trackHistory.length);
            if (!alreadySaved) {
              updatedArchived.push({
                id: `track-${userId}-${Date.now()}`,
                userId,
                userName: user?.name || 'Sucher',
                callSign: user?.callSign || 'Unit',
                color: getUserTrackColor(user || userId, allUsers),
                phaseLabel: `Suchphase 1 (${new Date(op.createdAt).toLocaleDateString()})`,
                recordedAt: now,
                points: [...locState.trackHistory],
              });
            }
          }
        });

        const existingSnapshots = op.mapSnapshots || [];
        const finalSnapshots = [...existingSnapshots];
        if (finalSnapshot) {
          finalSnapshots.push({
            url: finalSnapshot,
            timestamp: now,
            label: `Einsatzende: ${outcomeText}`,
          });
        }

        const updated: SearchOperation = {
          ...op,
          status: 'completed',
          completedAt: now,
          updatedAt: now,
          outcome: outcome || (op.type === 'exercise' ? 'exercise_completed' : 'person_alive'),
          closingNotes: notes ? (op.closingNotes ? `${op.closingNotes}\n\n[Ergänzung ${new Date().toLocaleDateString()}]: ${notes}` : notes) : op.closingNotes,
          notes: notes ? `${op.notes ? `${op.notes}\n` : ''}${notes}` : op.notes,
          archivedTracks: updatedArchived,
          archivedChatMessages: opChat.length > 0 ? opChat : op.archivedChatMessages,
          mapSnapshotUrl: finalSnapshot || op.mapSnapshotUrl || '',
          mapSnapshots: finalSnapshots,
          logs: [logEntry, ...op.logs],
        };
        syncOperationToCloud(updated);
        return updated;
      });

      try {
        localStorage.setItem(STORAGE_KEY_OPERATIONS, JSON.stringify(next));
      } catch {
        // ignore
      }

      // Check remaining active or paused operations
      const remainingActiveOrPaused = next.find((op) => op.id !== id && (op.status === 'active' || op.status === 'paused'));
      const nextId = remainingActiveOrPaused ? remainingActiveOrPaused.id : '';
      setCurrentOperationIdState(nextId);
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_OP, nextId);
      } catch {
        // ignore
      }

      return next;
    });

    // 5. Automatically log out all non-admin users (responders, group leaders)
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setAllUsers((prev) => {
      const next = prev.map((u) => {
        if (u.role === 'admin' || u.role === 'einsatzleitung') {
          return u; // Admins and EL remain logged in
        }
        const updatedUser: User = {
          ...u,
          isActive: false,
          lastSeen: `Abgemeldet (Einsatzende ${timeStr})`,
          assignedSectorId: undefined,
          updatedAt: new Date().toISOString(),
        };
        syncUserToCloud(updatedUser);
        return updatedUser;
      });
      try {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    // 6. Turn off live GPS for all non-admins in userLocations
    setUserLocations((prev) => {
      const next = { ...prev };
      allUsers.forEach((u) => {
        if (u.role !== 'admin' && next[u.id]) {
          const updatedLoc: UserLocationState = {
            ...next[u.id],
            isLive: false,
            lastUpdated: new Date().toISOString(),
          };
          next[u.id] = updatedLoc;
          syncLocationToCloud(u.id, updatedLoc);
        }
      });
      try {
        localStorage.setItem(STORAGE_KEY_LOCATIONS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const reactivateOperation = useCallback((
    id: string,
    options?: {
      phaseTitle?: string;
      notes?: string;
      newCommander?: string;
      activatedUserIds?: string[];
      keepSearchedSectors?: boolean;
      preserveHistoricalTracks?: boolean;
    }
  ): SearchOperation | null => {
    console.log(`[RescueContext] Reactivating operation: ${id}`, options);
    
    const op = allOperations.find(o => o.id === id);
    if (!op) {
      console.warn(`[RescueContext] Operation not found for reactivation: ${id}`);
      return null;
    }

    const now = new Date().toISOString();

    // 1. Snapshot all current tracks into archivedTracks if not already archived
    const existingArchived = op.archivedTracks || [];
    const updatedArchived = [...existingArchived];

    (Object.entries(userLocations) as [string, UserLocationState][]).forEach(([userId, locState]) => {
      if (locState?.trackHistory && locState.trackHistory.length > 1) {
        const user = allUsers.find((u) => u.id === userId);
        const existingForUser = updatedArchived.filter((t) => t.userId === userId);
        const alreadySaved = existingForUser.some((t) => t.points.length >= locState.trackHistory.length);
        if (!alreadySaved) {
          const color = getUserTrackColor(user || userId, allUsers);
          
          updatedArchived.push({
            id: `track-${userId}-${Date.now()}`,
            userId,
            userName: user?.name || 'Sucher',
            callSign: user?.callSign || 'Unit',
            color,
            phaseLabel: op.completedAt ? `Suchphase 1 (${new Date(op.completedAt).toLocaleDateString('de-DE')})` : 'Phase 1',
            recordedAt: now,
            points: [...locState.trackHistory],
          });
        }
      }
    });

    const shouldPreserve = options?.preserveHistoricalTracks !== false;
    const finalArchived = shouldPreserve ? updatedArchived : [];

    const phaseTitle = options?.phaseTitle?.trim() || `Suchphase ${(finalArchived.length > 0 ? 2 : 1)} (Fortsetzung)`;

    // 2. Add rich log entry
    const logEntry: OperationLogEntry = {
      id: `log-${Date.now()}`,
      operationId: id,
      timestamp: now,
      authorName: currentUser?.name || 'Einsatzleitung',
      authorRole: currentUser?.role || 'admin',
      category: 'status',
      text: `🔄 EINSATZ REAKTIVIERT: "${phaseTitle}". Suche wird mit angepasster Kräfteaufteilung fortgesetzt. Bisherige Suchspuren (${finalArchived.length}) und abgesuchte Sektoren (${op.sectors.filter((s) => s.status === 'searched').length}) bleiben als Referenz auf der Lagekarte erhalten. ${options?.notes ? `Hinweis: "${options.notes}"` : ''}`,
    };

    // 3. Keep searched sectors as 'searched' (green) or reset to 'open' if explicitly requested
    const sectors = op.sectors.map((sec) => ({
      ...sec,
      status: options?.keepSearchedSectors === false && sec.status === 'searched' ? ('open' as SectorStatus) : sec.status,
    }));

    const updated: SearchOperation = {
      ...op,
      status: 'active',
      completedAt: undefined,
      outcome: undefined,
      closingNotes: undefined,
      commander: options?.newCommander || currentUser?.name || op.commander,
      sectors,
      archivedTracks: finalArchived,
      logs: [logEntry, ...op.logs],
      updatedAt: now,
    };

    // Update state
    setAllOperations((prev) => {
      const next = prev.map((o) => (o.id === id ? updated : o));
      try {
        localStorage.setItem(STORAGE_KEY_OPERATIONS, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });

    // Sync to cloud
    syncOperationToCloud(updated);

    // 4. Set as active operation
    setCurrentOperationId(id);

    // Restore and prepare trackHistory for responders so new GPS recordings extend the movement profile seamlessly
    if (shouldPreserve) {
      setUserLocations((prev) => {
        const next = { ...prev };
        (finalArchived || []).forEach((t) => {
          if (t.userId && t.points && t.points.length > 0) {
            const currentLoc = next[t.userId];
            const currentLen = currentLoc?.trackHistory?.length || 0;
            if (currentLen < t.points.length) {
              next[t.userId] = {
                userId: t.userId,
                isLive: true,
                lastUpdated: now,
                currentPosition: t.points[t.points.length - 1],
                trackHistory: [...t.points],
              };
            }
          }
        });
        try {
          localStorage.setItem(STORAGE_KEY_LOCATIONS, JSON.stringify(next));
        } catch {}
        return next;
      });
    }

    // 5. Activate selected users if provided
    if (options?.activatedUserIds && options.activatedUserIds.length > 0) {
      const selectedIds = new Set(options.activatedUserIds);
      setAllUsers((prev) => {
        const next = prev.map((u) => {
          if (selectedIds.has(u.id)) {
            const updatedUser: User = {
              ...u,
              isActive: true,
              lastSeen: 'Gerade eben',
              updatedAt: now,
            };
            syncUserToCloud(updatedUser);
            return updatedUser;
          }
          return u;
        });
        try {
          localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(next));
        } catch { /* ignore */ }
        return next;
      });
    }

    // 6. Broadcast chat alert
    const reactivateChatMsg: ChatMessage = {
      id: `msg-reactivate-${Date.now()}`,
      operationId: id,
      senderId: currentUser?.id || 'leitstelle',
      senderName: currentUser?.name || 'Einsatzleitung',
      senderCallSign: currentUser?.callSign || 'Leitstelle',
      senderRole: 'admin',
      senderPhotoUrl: currentUser?.photoUrl,
      channel: 'all',
      isDirect: false,
      text: `🚨 EINSATZ REAKTIVIERT: ${options?.phaseTitle || 'Neue Suchphase gestartet'}. Alle Einheiten: Lagekarte prüfen. Bisherige Suchspuren und abgesuchte Areale sind hinterlegt.`,
      timestamp: now,
      isAlert: true,
    };
    setChatMessages((prev) => [...prev, reactivateChatMsg]);
    syncChatToCloud(reactivateChatMsg);

    // 7. Acoustic Alert and Notification Banner
    playAlertSound('alert');
    setActiveAlertNotification({
      title: '🚨 EINSATZ REAKTIVIERT: ' + (options?.phaseTitle || 'Neue Suchphase'),
      message: 'Suche wird fortgeführt. Bisher abgesuchte Flächen & GPS-Pfade sind auf der Lagekarte sichtbar.',
      timestamp: new Date().toLocaleTimeString(),
    });

    // 8. Multi-tab broadcast
    broadcastChannelRef.current?.postMessage({
      type: 'OPERATION_REACTIVATED',
      payload: {
        operationId: id,
        phaseTitle: options?.phaseTitle || 'Neue Suchphase',
      },
    });

    return updated;
  }, [allOperations, allUsers, currentUser, userLocations, syncOperationToCloud, syncUserToCloud, syncChatToCloud, playAlertSound, setCurrentOperationId]);



  const deleteOperation = (id: string) => {
    deletedOpIdsRef.current.add(id);

    // Delete from Firestore Cloud Database
    safeFirestoreWrite(
      () => deleteDoc(doc(db, 'operations', id)),
      `delete_operation_${id}`
    );

    // Multi-tab broadcast
    broadcastChannelRef.current?.postMessage({
      type: 'OPERATION_DELETED',
      payload: { operationId: id },
    });

    setAllOperations((prev) => {
      const remaining = prev.filter((op) => op.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY_OPERATIONS, JSON.stringify(remaining));
      } catch {
        // ignore
      }

      if (currentOperationId === id) {
        const nextActive = remaining.find((op) => op.status === 'active' || op.status === 'paused');
        const nextOpId = nextActive ? nextActive.id : (remaining[0]?.id || '');
        setCurrentOperationIdState(nextOpId);
        try {
          localStorage.setItem(STORAGE_KEY_ACTIVE_OP, nextOpId);
        } catch {
          // ignore
        }
      }
      return remaining;
    });
  };

  // Sector & Suchgebiet management
  const updateSearchArea = (
    polygon: [number, number][],
    name?: string,
    hectares?: number,
    notes?: string
  ) => {
    if (!currentOperation) return;

    const logEntry: OperationLogEntry = {
      id: `log-${Date.now()}`,
      operationId: currentOperation.id,
      timestamp: new Date().toISOString(),
      authorName: currentUser?.name || 'Einsatzleitung',
      authorRole: currentUser?.role || 'admin',
      category: 'sector',
      text: `Haupt-Suchgebiet aktualisiert (${polygon.length} Punkte${hectares ? `, ${hectares.toFixed(1)} ha` : ''})`,
    };

    updateOperation(currentOperation.id, {
      searchAreaPolygon: polygon,
      searchAreaName: name || currentOperation.searchAreaName || 'Haupt-Suchgebiet',
      searchAreaHectares: hectares !== undefined ? hectares : currentOperation.searchAreaHectares,
      searchAreaNotes: notes !== undefined ? notes : currentOperation.searchAreaNotes,
      logs: [logEntry, ...currentOperation.logs],
    });
  };

  const deleteSearchArea = () => {
    if (!currentOperation) return;
    const logEntry: OperationLogEntry = {
      id: `log-${Date.now()}`,
      operationId: currentOperation.id,
      timestamp: new Date().toISOString(),
      authorName: currentUser?.name || 'Einsatzleitung',
      authorRole: currentUser?.role || 'admin',
      category: 'sector',
      text: `Haupt-Suchgebiet gelöscht`,
    };

    updateOperation(currentOperation.id, {
      searchAreaPolygon: [],
      searchAreaHectares: 0,
      searchAreaName: '',
      searchAreaNotes: '',
      logs: [logEntry, ...currentOperation.logs],
    });
  };

  const addSector = (sectorData: Omit<SearchSector, 'id' | 'operationId'> & { id?: string }): SearchSector => {
    if (!currentOperation) throw new Error('Kein aktiver Einsatz gewählt');
    const newId = sectorData.id || `sec-${Date.now()}`;
    const assignedUserIds = sectorData.assignedUserIds || [];
    const newSector: SearchSector = {
      ...sectorData,
      id: newId,
      operationId: currentOperation.id,
      status: sectorData.status || 'open',
      priority: sectorData.priority || 'medium',
      assignedUserIds,
      assignedEquipment: sectorData.assignedEquipment || [],
    };

    const logEntry: OperationLogEntry = {
      id: `log-${Date.now()}`,
      operationId: currentOperation.id,
      timestamp: new Date().toISOString(),
      authorName: currentUser?.name || 'Einsatzleitung',
      authorRole: currentUser?.role || 'admin',
      category: 'sector',
      text: `Neuer Suchsektor angelegt: "${newSector.name}" (${newSector.priority.toUpperCase()})`,
    };

    updateOperation(currentOperation.id, (prevOp) => ({
      sectors: [...(prevOp.sectors || []), newSector],
      logs: [logEntry, ...(prevOp.logs || [])],
    }));

    if (assignedUserIds.length > 0) {
      setAllUsers((prev) => {
        const next = prev.map((u) => {
          if (assignedUserIds.includes(u.id)) {
            const updatedUser = { ...u, assignedSectorId: newId, updatedAt: new Date().toISOString() };
            syncUserToCloud(updatedUser);
            return updatedUser;
          }
          return u;
        });
        try {
          localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    }

    return newSector;
  };

  const addMultipleSectors = (sectorsData: Omit<SearchSector, 'id' | 'operationId'>[]): SearchSector[] => {
    if (!currentOperation || sectorsData.length === 0) return [];
    const now = Date.now();
    const createdSectors: SearchSector[] = sectorsData.map((s, idx) => ({
      ...s,
      id: `sec-${now}-${idx}`,
      operationId: currentOperation.id,
      status: s.status || 'open',
      priority: s.priority || 'medium',
      assignedUserIds: s.assignedUserIds || [],
      assignedEquipment: s.assignedEquipment || [],
    }));

    const logEntry: OperationLogEntry = {
      id: `log-${now}`,
      operationId: currentOperation.id,
      timestamp: new Date().toISOString(),
      authorName: currentUser?.name || 'Einsatzleitung',
      authorRole: currentUser?.role || 'admin',
      category: 'sector',
      text: `${createdSectors.length} neue Suchsektoren angelegt (${createdSectors.map((s) => s.name).join(', ')})`,
    };

    updateOperation(currentOperation.id, (prevOp) => ({
      sectors: [...(prevOp.sectors || []), ...createdSectors],
      logs: [logEntry, ...(prevOp.logs || [])],
    }));
    return createdSectors;
  };

  const updateSector = (sectorId: string, updates: Partial<SearchSector>) => {
    if (!currentOperation) return;
    updateOperation(currentOperation.id, (prevOp) => ({
      sectors: (prevOp.sectors || []).map((sec) => (sec.id === sectorId ? { ...sec, ...updates } : sec)),
    }));

    if (updates.assignedUserIds !== undefined) {
      const assignedIds = updates.assignedUserIds;
      setAllUsers((prev) => {
        const next = prev.map((u) => {
          if (assignedIds.includes(u.id)) {
            const updatedUser = { ...u, assignedSectorId: sectorId, updatedAt: new Date().toISOString() };
            syncUserToCloud(updatedUser);
            return updatedUser;
          } else if (u.assignedSectorId === sectorId) {
            const updatedUser = { ...u, assignedSectorId: undefined, updatedAt: new Date().toISOString() };
            syncUserToCloud(updatedUser);
            return updatedUser;
          }
          return u;
        });
        try {
          localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
  };

  const setSectorStatus = (sectorId: string, status: SectorStatus) => {
    if (!currentOperation) return;
    const now = new Date().toISOString();
    const sector = currentOperation.sectors.find((s) => s.id === sectorId);
    if (!sector) return;

    const isCleared = status === 'searched';
    const updates: Partial<SearchSector> = {
      status,
      clearedAt: isCleared ? now : undefined,
      clearedBy: isCleared ? `${currentUser?.name} (${currentUser?.callSign})` : undefined,
      color: isCleared ? '#22c55e' : status === 'in_progress' ? '#f59e0b' : status === 'suspicious' ? '#ef4444' : '#3b82f6',
    };

    const logEntry: OperationLogEntry = {
      id: `log-${Date.now()}`,
      operationId: currentOperation.id,
      timestamp: now,
      authorName: currentUser?.name || 'Einsatzkraft',
      authorRole: currentUser?.role || 'responder',
      category: 'sector',
      text: `Sektor "${sector.name}" Status geändert: ${status === 'searched' ? '✅ ABGESUCHT (Grün)' : status.toUpperCase()}`,
    };

    updateOperation(currentOperation.id, (prevOp) => ({
      sectors: (prevOp.sectors || []).map((s) => (s.id === sectorId ? { ...s, ...updates } : s)),
      logs: [logEntry, ...(prevOp.logs || [])],
    }));

    broadcastChannelRef.current?.postMessage({
      type: 'SECTOR_STATUS',
      payload: {
        operationId: currentOperation.id,
        sectorId,
        status,
        clearedAt: updates.clearedAt,
        clearedBy: updates.clearedBy,
      },
    });
  };

  const assignSectorUsers = (sectorId: string, userIds: string[]) => {
    if (!currentOperation) return;
    const sector = currentOperation.sectors.find((s) => s.id === sectorId);
    if (!sector) return;

    const assignedUsers = allUsers.filter((u) => userIds.includes(u.id));
    const equipmentList: EquipmentType[] = Array.from(new Set(assignedUsers.flatMap((u) => u.equipment || []))) as EquipmentType[];

    const updatedSectors = currentOperation.sectors.map((s) =>
      s.id === sectorId
        ? {
            ...s,
            assignedUserIds: userIds,
            assignedEquipment: equipmentList,
            status: s.status === 'open' && userIds.length > 0 ? ('in_progress' as SectorStatus) : s.status,
          }
        : s
    );

    setAllUsers((prev) => {
      const next = prev.map((u) => {
        if (userIds.includes(u.id)) {
          const updatedUser = { ...u, assignedSectorId: sectorId, updatedAt: new Date().toISOString() };
          syncUserToCloud(updatedUser);
          return updatedUser;
        } else if (u.assignedSectorId === sectorId) {
          const updatedUser = { ...u, assignedSectorId: undefined, updatedAt: new Date().toISOString() };
          syncUserToCloud(updatedUser);
          return updatedUser;
        }
        return u;
      });
      try {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    const logEntry: OperationLogEntry = {
      id: `log-${Date.now()}`,
      operationId: currentOperation.id,
      timestamp: new Date().toISOString(),
      authorName: currentUser?.name || 'Einsatzleitung',
      authorRole: currentUser?.role || 'admin',
      category: 'sector',
      text: `Sektor "${sector.name}" zugewiesen an: ${assignedUsers.map((u) => u.callSign).join(', ') || 'Keine'}`,
    };

    updateOperation(currentOperation.id, (prevOp) => ({
      sectors: (prevOp.sectors || []).map((s) =>
        s.id === sectorId
          ? {
              ...s,
              assignedUserIds: userIds,
              assignedEquipment: equipmentList,
              status: s.status === 'open' && userIds.length > 0 ? ('in_progress' as SectorStatus) : s.status,
            }
          : s
      ),
      logs: [logEntry, ...(prevOp.logs || [])],
    }));
  };

  const deleteSector = (sectorId: string) => {
    if (!currentOperation) return;
    const sector = currentOperation.sectors.find((s) => s.id === sectorId);
    if (!sector) return;

    deletedSectorIdsRef.current.add(sectorId);
    try {
      localStorage.setItem(STORAGE_KEY_DELETED_SECTORS, JSON.stringify(Array.from(deletedSectorIdsRef.current)));
    } catch {}

    setAllUsers((prev) => {
      const next = prev.map((u) => {
        if (u.assignedSectorId === sectorId) {
          const updatedUser = { ...u, assignedSectorId: undefined, updatedAt: new Date().toISOString() };
          syncUserToCloud(updatedUser);
          return updatedUser;
        }
        return u;
      });
      try {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    const logEntry: OperationLogEntry = {
      id: `log-${Date.now()}`,
      operationId: currentOperation.id,
      timestamp: new Date().toISOString(),
      authorName: currentUser?.name || 'Einsatzleitung',
      authorRole: currentUser?.role || 'admin',
      category: 'sector',
      text: `Suchsektor gelöscht: "${sector.name}"`,
    };

    broadcastChannelRef.current?.postMessage({
      type: 'SECTOR_DELETED',
      payload: { operationId: currentOperation.id, sectorId },
    });

    updateOperation(currentOperation.id, (prevOp) => ({
      sectors: cleanSectors((prevOp.sectors || []).filter((s) => s.id !== sectorId)),
      logs: [logEntry, ...(prevOp.logs || [])],
    }));
  };

  // Findings & Fundmeldungen
  const reportFinding = (data: {
    category: FindingCategory;
    title: string;
    description: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    urgency: FindingUrgency;
    location?: GpsPoint;
  }): Finding => {
    if (!currentOperation) throw new Error('Kein aktiver Einsatz');

    const userLoc = currentUser ? userLocations[currentUser.id]?.currentPosition : null;
    const location: GpsPoint =
      data.location ||
      userLoc ||
      myLocation || {
        lat: currentOperation.headquartersLocation?.lat || VEREINSBUERO_LOCATION.lat,
        lng: currentOperation.headquartersLocation?.lng || VEREINSBUERO_LOCATION.lng,
        timestamp: new Date().toISOString(),
        accuracy: 2.0,
      };

    const newFinding: Finding = {
      id: `find-${Date.now()}`,
      operationId: currentOperation.id,
      userId: currentUser?.id || 'unknown',
      userName: currentUser?.name || 'Einsatzkraft',
      userCallSign: currentUser?.callSign || 'Helfer',
      userLicensePlate: currentUser?.licensePlate,
      timestamp: new Date().toISOString(),
      location,
      category: data.category,
      title: data.title,
      description: data.description,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType || 'image',
      urgency: data.urgency,
      verified: false,
    };

    const logEntry: OperationLogEntry = {
      id: `log-${Date.now()}`,
      operationId: currentOperation.id,
      timestamp: new Date().toISOString(),
      authorName: currentUser?.name || 'Einsatzkraft',
      authorRole: currentUser?.role || 'responder',
      category: 'finding',
      text: `🚨 NEUER FUND: "${data.title}" von ${currentUser?.callSign} bei GPS: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)} gemeldet!`,
    };

    updateOperation(currentOperation.id, (prevOp) => ({
      findings: [newFinding, ...(prevOp.findings || [])],
      logs: [logEntry, ...(prevOp.logs || [])],
    }));

    const chatMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      operationId: currentOperation.id,
      senderId: currentUser?.id || 'sys',
      senderName: currentUser?.name || 'Fundmeldung',
      senderCallSign: currentUser?.callSign || 'Einsatzkraft',
      senderRole: currentUser?.role || 'responder',
      channel: 'all',
      isDirect: false,
      text: `🚨 FUND GEMELDET: ${data.title} (${data.category.toUpperCase()}) - ${data.description.substring(0, 80)}...`,
      timestamp: new Date().toISOString(),
      isAlert: true,
      location,
      attachmentUrl: data.mediaUrl,
    };
    sendChatMessage(chatMsg);

    playAlertSound('finding');
    setActiveAlertNotification({
      title: '🚨 NEUER FUND GEMELDET!',
      message: `${currentUser?.name} (${currentUser?.callSign}): "${data.title}"`,
      timestamp: new Date().toLocaleTimeString(),
    });

    broadcastChannelRef.current?.postMessage({
      type: 'NEW_FINDING',
      payload: newFinding,
    });

    return newFinding;
  };

  const verifyFinding = (
    findingId: string,
    statusOrBool: 'verified' | 'false_alarm' | 'pending' | boolean,
    adminNotes?: string
  ) => {
    if (!currentOperation) return;

    let targetStatus: 'verified' | 'false_alarm' | 'pending';
    let isVerified = false;
    let archivedAt: string | undefined = undefined;

    if (statusOrBool === true || statusOrBool === 'verified') {
      targetStatus = 'verified';
      isVerified = true;
    } else if (statusOrBool === false || statusOrBool === 'false_alarm') {
      targetStatus = 'false_alarm';
      isVerified = false;
      archivedAt = new Date().toISOString();
    } else {
      targetStatus = 'pending';
      isVerified = false;
    }

    const finding = currentOperation.findings.find((f) => f.id === findingId);
    const findingTitle = finding?.title || `Fund #${findingId.slice(-4)}`;

    const logText =
      targetStatus === 'verified'
        ? `Fund "${findingTitle}" von Einsatzleitung als RELEVANT verifiziert. ${adminNotes ? `Notiz: ${adminNotes}` : ''}`
        : targetStatus === 'false_alarm'
        ? `Fund "${findingTitle}" von Einsatzleitung als FEHLALARM markiert (im laufenden Einsatz ausgeblendet & archiviert). ${adminNotes ? `Notiz: ${adminNotes}` : ''}`
        : `Status für Fund "${findingTitle}" zurückgesetzt (In Prüfung).`;

    const logEntry: OperationLogEntry = {
      id: `log-${Date.now()}`,
      operationId: currentOperation.id,
      timestamp: new Date().toISOString(),
      authorName: currentUser?.name || 'Einsatzleitung',
      authorRole: currentUser?.role || 'admin',
      category: 'finding',
      text: logText,
    };

    updateOperation(currentOperation.id, (prevOp) => ({
      findings: (prevOp.findings || []).map((f) =>
        f.id === findingId
          ? {
              ...f,
              verified: isVerified,
              status: targetStatus,
              archivedAt: targetStatus === 'false_alarm' ? (f.archivedAt || archivedAt) : undefined,
              adminNotes: adminNotes !== undefined ? adminNotes : f.adminNotes,
            }
          : f
      ),
      logs: [logEntry, ...(prevOp.logs || [])],
    }));
  };

  const deleteFinding = (findingId: string) => {
    if (!currentOperation) return;
    updateOperation(currentOperation.id, (prevOp) => ({
      findings: (prevOp.findings || []).filter((f) => f.id !== findingId),
    }));
  };

  // GPS controls
  const toggleRealGps = () => {
    setIsRealGpsActive((prev) => !prev);
  };

  const toggleSimulator = () => {
    setIsSimulatorRunning((prev) => !prev);
  };

  const updateMyLocationManual = (lat: number, lng: number) => {
    const point: GpsPoint = {
      lat,
      lng,
      timestamp: new Date().toISOString(),
      accuracy: 1.5,
    };
    setMyLocation(point);
    if (currentUser) {
      setUserLocations((prev) => {
        const userLoc = prev[currentUser.id] || {
          userId: currentUser.id,
          isLive: true,
          lastUpdated: new Date().toISOString(),
          currentPosition: point,
          trackHistory: [],
        };
        const updatedLocState: UserLocationState = {
          ...userLoc,
          currentPosition: point,
          trackHistory: [...userLoc.trackHistory, point],
          lastUpdated: new Date().toISOString(),
        };
        syncLocationToCloud(currentUser.id, updatedLocState);
        return {
          ...prev,
          [currentUser.id]: updatedLocState,
        };
      });
    }
  };

  const clearGpsTracks = (userId?: string) => {
    setUserLocations((prev) => {
      if (userId) {
        const target = prev[userId];
        if (!target) return prev;
        const updatedTarget = { ...target, trackHistory: [target.currentPosition] };
        syncLocationToCloud(userId, updatedTarget);
        return {
          ...prev,
          [userId]: updatedTarget,
        };
      } else {
        const reset: Record<string, UserLocationState> = {};
        (Object.entries(prev) as [string, UserLocationState][]).forEach(([id, loc]) => {
          reset[id] = { ...loc, trackHistory: [loc.currentPosition] };
          syncLocationToCloud(id, reset[id]);
        });
        return reset;
      }
    });
  };

  // Chat
  const sendChatMessage = (data: {
    text: string;
    channel: string;
    operationId?: string;
    isDirect?: boolean;
    recipientId?: string;
    isAlert?: boolean;
    attachmentUrl?: string;
    includeLocation?: boolean;
    audioUrl?: string;
    audioDuration?: number;
    isVoiceMessage?: boolean;
  }) => {
    if (!currentUser) return;

    const opId = data.operationId || currentOperation?.id || 'general';

    let loc: GpsPoint | undefined;
    if (data.includeLocation) {
      loc = userLocations[currentUser.id]?.currentPosition || myLocation || undefined;
    }

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      operationId: opId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderCallSign: currentUser.callSign,
      senderRole: currentUser.role,
      senderPhotoUrl: currentUser.photoUrl,
      channel: data.channel,
      isDirect: !!data.isDirect,
      recipientId: data.recipientId,
      text: data.text,
      timestamp: new Date().toISOString(),
      isAlert: data.isAlert,
      location: loc,
      attachmentUrl: data.attachmentUrl,
      audioUrl: data.audioUrl,
      audioDuration: data.audioDuration,
      isVoiceMessage: data.isVoiceMessage,
    };

    setChatMessages((prev) => [...prev, newMsg]);
    syncChatToCloud(newMsg);
    if (data.isAlert) {
      playAlertSound('emergency_alarm');
    } else if (data.isVoiceMessage) {
      playAlertSound('cb_roger');
    } else if (data.isDirect) {
      playAlertSound('chat_direct');
    } else if (data.channel === 'all') {
      playAlertSound('chat_all');
    } else if (data.channel === 'admins') {
      playAlertSound('chat_admins');
    } else {
      playAlertSound(data.channel);
    }

    // Protocol logging: Automatically log communication involving Einsatzleitung into Operation Logs
    if (opId && opId !== 'general') {
      const recipientUser = data.recipientId ? allUsers.find((u) => u.id === data.recipientId) : undefined;
      const isSenderEL = currentUser.role === 'admin' || currentUser.role === 'einsatzleitung';
      const isRecipientEL = recipientUser?.role === 'admin' || recipientUser?.role === 'einsatzleitung';
      const isELChannel = data.channel === 'admins';

      if (isSenderEL || isRecipientEL || isELChannel) {
        const logText = data.isDirect
          ? `[FUNK/DIREKT] ${currentUser.name} (${currentUser.callSign}) ➔ ${recipientUser ? `${recipientUser.name} (${recipientUser.callSign})` : 'EL'}: "${data.text || (data.isVoiceMessage ? '🎙️ CB-Sprachnachricht' : 'Anhang')}"`
          : isELChannel
          ? `[FÜHRUNGSFUNK EL] ${currentUser.name} (${currentUser.callSign}): "${data.text || (data.isVoiceMessage ? '🎙️ CB-Sprachnachricht' : 'Anhang')}"`
          : `[EINSATZFUNK] ${currentUser.name} (${currentUser.callSign}): "${data.text || (data.isVoiceMessage ? '🎙️ CB-Sprachnachricht' : 'Anhang')}"`;

        const logEntry: OperationLogEntry = {
          id: `log-chat-${Date.now()}`,
          operationId: opId,
          timestamp: new Date().toISOString(),
          authorName: currentUser.name,
          authorRole: currentUser.role,
          category: 'radio',
          text: logText,
        };

        setAllOperations((prevOps) => {
          return prevOps.map((op) => {
            if (op.id === opId) {
              const updatedOp: SearchOperation = {
                ...op,
                logs: [logEntry, ...(op.logs || [])],
                updatedAt: new Date().toISOString(),
              };
              syncOperationToCloud(updatedOp);
              return updatedOp;
            }
            return op;
          });
        });
      }
    }

    broadcastChannelRef.current?.postMessage({
      type: 'NEW_CHAT',
      payload: newMsg,
    });
  };

  const sendEmergencyAlert = (customMessage: string) => {
    if (!currentOperation) return;
    playAlertSound('emergency_alarm');
    setActiveAlertNotification({
      title: '🚨 EINSATZALARM / DRINGENDE DURCHSAGE',
      message: customMessage || 'Dringender Notfall- oder Einsatzalarm durch die Einsatzleitung!',
      timestamp: new Date().toLocaleTimeString(),
    });

    const alertMsg: ChatMessage = {
      id: `msg-alert-${Date.now()}`,
      operationId: currentOperation.id,
      senderId: currentUser?.id || 'admin',
      senderName: currentUser?.name || 'Einsatzleitung',
      senderCallSign: currentUser?.callSign || 'EZ',
      senderRole: currentUser?.role || 'admin',
      senderPhotoUrl: currentUser?.photoUrl,
      channel: 'all',
      isDirect: false,
      text: `🚨 EINSATZALARM: ${customMessage}`,
      timestamp: new Date().toISOString(),
      isAlert: true,
    };

    setChatMessages((prev) => [...prev, alertMsg]);
    syncChatToCloud(alertMsg);
    broadcastChannelRef.current?.postMessage({
      type: 'NEW_CHAT',
      payload: alertMsg,
    });

    const logEntry: OperationLogEntry = {
      id: `log-${Date.now()}`,
      operationId: currentOperation.id,
      timestamp: new Date().toISOString(),
      authorName: currentUser?.name || 'Einsatzleitung',
      authorRole: currentUser?.role || 'admin',
      category: 'status',
      text: `🚨 EINSATZALARM AUSGELÖST: "${customMessage}"`,
    };
    updateOperation(currentOperation.id, {
      logs: [logEntry, ...(currentOperation.logs || [])],
    });
  };

  const setUiScale = useCallback((scale: number) => {
    const clamped = Math.max(0.75, Math.min(2.5, scale));
    setUiScaleState(clamped);
    try {
      localStorage.setItem('rescue_ui_scale_v1', String(clamped));
    } catch {}
  }, []);

  const startTrackingTest = useCallback((user: User, duration: 10 | 20 | 30) => {
    const now = new Date();
    const endTime = new Date(now.getTime() + duration * 60000);
    
    const session: TrackingTestSession = {
      userId: user.id,
      userName: user.name,
      startTime: now.toISOString(),
      durationMinutes: duration,
      endTime: endTime.toISOString(),
      isActive: true,
      isCompleted: false,
      trackPoints: [],
    };
    
    setActiveTrackingTest(session);
    // Automatically switch to responder mode for tracking
    updateUser(user.id, { role: 'responder', isActive: true });
    setUserArrivalStatuses(prev => ({ ...prev, [user.id]: 'ready' }));
    setIsRealGpsActive(true);
    setCurrentUserId(user.id);

    // Immediately fetch a GPS position so the marker appears on the map right away,
    // before watchPosition delivers its first update (which can take several seconds).
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const initPoint: GpsPoint = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: new Date().toISOString(),
            accuracy: Math.round(pos.coords.accuracy),
            speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0,
            altitude: pos.coords.altitude ? Math.round(pos.coords.altitude) : undefined,
          };
          setMyLocation(initPoint);
          // Seed userLocations so the responder marker renders immediately
          setUserLocations(prev => ({
            ...prev,
            [user.id]: {
              userId: user.id,
              isLive: true,
              lastUpdated: new Date().toISOString(),
              currentPosition: initPoint,
              trackHistory: [initPoint],
            },
          }));
          // Also add as first trackPoint to the session
          setActiveTrackingTest(prev =>
            prev ? { ...prev, trackPoints: [initPoint] } : null
          );
        },
        (err) => console.warn('[TrackingTest] Initial GPS fetch failed:', err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
      );
    }
  }, [updateUser]);

  const stopTrackingTest = useCallback(() => {
    setActiveTrackingTest((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        isActive: false,
        isCompleted: true,
      };
    });
  }, []);

  const saveTrackingTestResult = useCallback((save: boolean) => {
    const testSession = activeTrackingTestRef.current;
    if (testSession && testSession.userId) {
      if (save) {
        const pts = testSession.trackPoints || [];
        let totalDist = 0;
        for (let i = 1; i < pts.length; i++) {
          totalDist += calculateDistanceMeters(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
        }
        updateUser(testSession.userId, {
          lastTrackingTest: {
            passed: pts.length >= 5,
            date: new Date().toISOString(),
            pointsCount: pts.length,
            distanceMeters: Math.round(totalDist),
            durationMinutes: testSession.durationMinutes,
          },
          isActive: false,
        });
      } else {
        updateUser(testSession.userId, { isActive: false });
      }

      setUserLocations((prev) => {
        const target = prev[testSession.userId];
        if (!target) return prev;
        const updatedTarget = { ...target, trackHistory: [target.currentPosition] };
        syncLocationToCloud(testSession.userId, updatedTarget);
        return {
          ...prev,
          [testSession.userId]: updatedTarget,
        };
      });
    }

    setActiveTrackingTest(null);
    confirmLogout();
  }, [confirmLogout, updateUser, syncLocationToCloud]);

  // Tracking Test Timer Logic
  useEffect(() => {
    if (!activeTrackingTest || !activeTrackingTest.isActive || activeTrackingTest.isCompleted) return;

    const checkTimer = setInterval(() => {
      const now = new Date();
      const endTime = new Date(activeTrackingTest.endTime);
      
      if (now >= endTime) {
        setActiveTrackingTest(prev => prev ? { ...prev, isActive: false, isCompleted: true } : null);
        clearInterval(checkTimer);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(checkTimer);
  }, [activeTrackingTest]);

  const dismissAlertNotification = () => {
    setActiveAlertNotification(null);
  };

  return (
    <RescueContext.Provider
      value={{
        currentUser,
        allUsers,
        login,
        logout,
        switchUser,
        createUser,
        updateUser,
        deleteUser,
        removeUserFromOperation,
        setUserActiveStatus,
        deactivateAllUsers,

        confirmModalState,
        showConfirmModal,
        dismissConfirmModal,

        currentOperation,
        allOperations,
        isOperationActive,
        isOperationPaused,
        setCurrentOperationId,
        createOperation,
        updateOperation,
        pauseOperation,
        resumeOperation,
        saveMapSnapshot,
        endOperation,
        reactivateOperation,
        deleteOperation,

        updateSearchArea,
        deleteSearchArea,
        addSector,
        addMultipleSectors,
        updateSector,
        setSectorStatus,
        assignSectorUsers,
        deleteSector,

        findings,
        reportFinding,
        verifyFinding,
        deleteFinding,

        userLocations,
        myLocation,
        isRealGpsActive,
        toggleRealGps,
        isSimulatorRunning,
        toggleSimulator,
        updateMyLocationManual,
        clearGpsTracks,

        chatMessages,
        unreadChatCount,
        lastReadChatTimestamp,
        markChatAsRead,
        sendChatMessage,
        sendEmergencyAlert,

        isCloudSynced: cloudSyncStatus === 'connected',
        cloudSyncStatus,
        isQuotaExceeded,

        playAlertSound,
        activeAlertNotification,
        setActiveAlertNotification,
        dismissAlertNotification,
        isLogoutConfirmOpen,
        requestLogout,
        confirmLogout,
        cancelLogout,
        authNotification,
        clearAuthNotification,

        userArrivalStatuses,
        setUserArrivalStatus,
        confirmUserReady,
        getUserArrivalStatus,
        calculateDistanceToEzMeters,

        selectedUser,
        setSelectedUser,
        uiScale,
        setUiScale,

        activeTrackingTest,
        startTrackingTest,
        stopTrackingTest,
        saveTrackingTestResult,
      }}
    >
      {children}
    </RescueContext.Provider>
  );
};

export const useRescue = () => {
  const context = useContext(RescueContext);
  if (!context) {
    throw new Error('useRescue must be used within a RescueProvider');
  }
  return context;
};
