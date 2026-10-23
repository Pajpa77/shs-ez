import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  YouthUser,
  YouthOperation,
  YouthChatMessage,
  YouthLogEntry,
  YouthFinding,
  YouthSector,
  YouthTeam,
  YouthSosAlert,
} from './types';
import { INITIAL_YOUTH_USERS, INITIAL_YOUTH_OPERATIONS } from './mockData';
import { User, GpsPoint, isUserAdmin } from '../types';
import { startCapacitorBackgroundGps, stopCapacitorBackgroundGps } from '../lib/capacitorGps';
import { useWakeLock } from '../hooks/useWakeLock';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

interface YouthLocationState {
  currentPosition?: GpsPoint;
  trackHistory: GpsPoint[];
}

interface YouthContextType {
  currentYouthUser: YouthUser | null;
  allYouthUsers: YouthUser[];
  currentYouthOperation: YouthOperation | null;
  allYouthOperations: YouthOperation[];
  activeYouthOperation: YouthOperation | null;
  isExerciseActive: boolean;
  isExercisePaused: boolean;
  chatMessages: YouthChatMessage[];
  youthLocations: Record<string, YouthLocationState>;
  
  // Auth
  loginYouthUser: (usernameOrId: string, pin: string) => boolean;
  loginAdultAsYouthAdmin: (adultUser: User) => boolean;
  loginAdultIntoJointExercise: (adultUser: User) => boolean;
  logoutYouth: () => void;

  // User Management (Admin only)
  createYouthUser: (data: Omit<YouthUser, 'id' | 'isActive'>) => YouthUser;
  updateYouthUser: (id: string, updates: Partial<YouthUser>) => void;
  deleteYouthUser: (id: string) => void;
  setUserReady: (userId: string, status: 'in_transit' | 'ez_reached' | 'ready') => void;
  scanBarcodeReady: (code: string) => { success: boolean; user?: YouthUser; message: string };

  // Operation / Exercise Management
  selectOperation: (id: string) => void;
  createYouthOperation: (data: {
    title: string;
    type: 'youth_only' | 'joint';
    locationName: string;
    trainingGoal: string;
    missingTargetName: string;
    missingTargetDescription: string;
    headquartersLocation?: { lat: number; lng: number; address?: string };
    geofenceRadiusMeters?: number;
  }) => YouthOperation;
  updateYouthOperation: (id: string, updates: Partial<YouthOperation>) => void;
  startYouthOperation: (id: string) => void;
  pauseYouthOperation: (id: string, reason?: string) => void;
  resumeYouthOperation: (id: string) => void;
  endYouthOperation: (id: string, notes?: string) => void;
  deleteYouthOperation: (id: string) => void;

  // In-Exercise Actions
  sendChatMessage: (text: string, channel?: 'all' | 'jugend' | 'erwachsene' | 'leitung') => void;
  reportFinding: (title: string, description?: string, photoUrl?: string) => void;
  updateSectorStatus: (sectorId: string, status: 'open' | 'in_progress' | 'searched') => void;
  
  // SOS & Notfall-Pfeife
  activeSosAlert: YouthSosAlert | null;
  triggerSosAlert: () => void;
  dismissSosAlert: () => void;
}

const YouthContext = createContext<YouthContextType | undefined>(undefined);

const STORAGE_USERS = 'rescue_youth_users_v7';
const STORAGE_OPS = 'rescue_youth_operations_v7';
const STORAGE_ACTIVE_USER = 'rescue_youth_active_user_v7';
const STORAGE_CURRENT_OP_ID = 'rescue_youth_current_op_id_v7';
const STORAGE_CHAT = 'rescue_youth_chat_v7';
const STORAGE_LOCATIONS = 'rescue_youth_locations_v7';

// Distance calculation between GPS coordinates
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper to strip undefined values so Firestore does not reject writes
function cleanForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export const YouthProvider: React.FC<{ children: React.ReactNode; adultUsers: User[] }> = ({
  children,
  adultUsers,
}) => {
  // ── 1. Load Youth Users (Cloud Firestore & LocalStorage Sync) ─────────────
  const [allYouthUsers, setAllYouthUsers] = useState<YouthUser[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_USERS);
      const isInitialized = localStorage.getItem('rescue_youth_users_initialized_v7');
      if (saved) return JSON.parse(saved);
      if (isInitialized) return []; // User previously modified accounts, don't resurrect mock data
    } catch {}
    return INITIAL_YOUTH_USERS;
  });

  const isInitialUsersLoadRef = useRef(true);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_USERS, JSON.stringify(allYouthUsers));
      localStorage.setItem('rescue_youth_users_initialized_v7', 'true');
    } catch {}

    if (isInitialUsersLoadRef.current) {
      isInitialUsersLoadRef.current = false;
      return;
    }

    try {
      setDoc(
        doc(db, 'settings', 'youth_users'),
        cleanForFirestore({
          users: allYouthUsers,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      ).catch((err) => console.warn('Firestore youth_users sync error:', err));
    } catch (err) {
      console.warn('Could not sync youth_users to Firestore:', err);
    }
  }, [allYouthUsers]);

  // Realtime Cloud Firestore listener for youth users
  useEffect(() => {
    try {
      const unsub = onSnapshot(
        doc(db, 'settings', 'youth_users'),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data && Array.isArray(data.users)) {
              setAllYouthUsers(data.users);
              try {
                localStorage.setItem(STORAGE_USERS, JSON.stringify(data.users));
                localStorage.setItem('rescue_youth_users_initialized_v7', 'true');
              } catch {}
            }
          } else {
            // Document does not exist in Firestore yet: If local storage already has users, seed them to Firestore
            try {
              const saved = localStorage.getItem(STORAGE_USERS);
              const isInit = localStorage.getItem('rescue_youth_users_initialized_v7');
              if (saved || isInit) {
                const existingUsers = saved ? JSON.parse(saved) : [];
                setDoc(
                  doc(db, 'settings', 'youth_users'),
                  cleanForFirestore({
                    users: existingUsers,
                    updatedAt: new Date().toISOString(),
                  }),
                  { merge: true }
                ).catch(() => {});
              }
            } catch {}
          }
        },
        (err) => {
          console.warn('Firestore youth_users listener error:', err);
        }
      );
      return () => unsub();
    } catch {}
  }, []);

  // ── 2. Load Youth Operations (Cloud Firestore & LocalStorage Sync) ──────────
  const [allYouthOperations, setAllYouthOperations] = useState<YouthOperation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_OPS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_YOUTH_OPERATIONS;
  });

  const isInitialOpsLoadRef = useRef(true);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_OPS, JSON.stringify(allYouthOperations));
    } catch {}

    if (isInitialOpsLoadRef.current) {
      isInitialOpsLoadRef.current = false;
      return;
    }

    try {
      setDoc(
        doc(db, 'settings', 'youth_operations'),
        cleanForFirestore({
          operations: allYouthOperations,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      ).catch((err) => console.warn('Firestore youth_operations sync error:', err));
    } catch (err) {
      console.warn('Could not sync youth_operations to Firestore:', err);
    }
  }, [allYouthOperations]);

  // Realtime Cloud Firestore listener for youth operations
  useEffect(() => {
    try {
      const unsub = onSnapshot(
        doc(db, 'settings', 'youth_operations'),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data && Array.isArray(data.operations)) {
              setAllYouthOperations(data.operations);
              try {
                localStorage.setItem(STORAGE_OPS, JSON.stringify(data.operations));
              } catch {}
            }
          } else {
            // Seed operations if document does not exist yet
            try {
              const saved = localStorage.getItem(STORAGE_OPS);
              if (saved) {
                const existingOps = JSON.parse(saved);
                setDoc(
                  doc(db, 'settings', 'youth_operations'),
                  cleanForFirestore({
                    operations: existingOps,
                    updatedAt: new Date().toISOString(),
                  }),
                  { merge: true }
                ).catch(() => {});
              }
            } catch {}
          }
        },
        (err) => {
          console.warn('Firestore youth_operations listener error:', err);
        }
      );
      return () => unsub();
    } catch {}
  }, []);

  // ── 3. Active User & Current Operation ────────────────────────────────────
  // Startet immer ohne automatischen Login, um versehentliches Reingehen ohne PIN zu verhindern
  const [currentYouthUser, setCurrentYouthUser] = useState<YouthUser | null>(null);

  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_ACTIVE_USER);
    } catch {}
  }, []);

  const [currentOpId, setCurrentOpId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_CURRENT_OP_ID) || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CURRENT_OP_ID, currentOpId);
    } catch {}
  }, [currentOpId]);

  const activeYouthOperation = useMemo(() => {
    return allYouthOperations.find((op) => op.status === 'active' || op.status === 'paused') || null;
  }, [allYouthOperations]);

  const currentYouthOperation = useMemo(() => {
    if (currentOpId) {
      const found = allYouthOperations.find((op) => op.id === currentOpId);
      if (found) return found;
    }
    return activeYouthOperation || (allYouthOperations.length > 0 ? allYouthOperations[0] : null);
  }, [currentOpId, allYouthOperations, activeYouthOperation]);

  const isExerciseActive = activeYouthOperation?.status === 'active';
  const isExercisePaused = activeYouthOperation?.status === 'paused';

  // ── 4. Chat Messages ───────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<YouthChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CHAT);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'msg-init-1',
        operationId: 'youth-op-initial',
        senderId: 'youth-admin-1',
        senderName: 'Jugendleitung',
        senderTeam: 'leitung',
        channel: 'all',
        text: 'Willkommen zur Übung der Spürhunde-Jugendgruppe! Meldet euch nach Ankunft bereit.',
        timestamp: '14:00',
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CHAT, JSON.stringify(chatMessages));
    } catch {}
  }, [chatMessages]);

  // ── 5. Tracking / GPS Locations (Identisch zur Haupt-App) ───────────────────
  const [youthLocations, setYouthLocations] = useState<Record<string, YouthLocationState>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LOCATIONS);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_LOCATIONS, JSON.stringify(youthLocations));
    } catch {}
  }, [youthLocations]);

  // Keep mobile screen awake and background audio heartbeat alive when user is ready (Status Grün) or exercise is active/paused
  const isWakeLockActive = Boolean(
    currentYouthUser?.isActive &&
      (isExerciseActive || isExercisePaused || currentYouthUser?.arrivalStatus === 'ready')
  );
  useWakeLock(isWakeLockActive);

  // Sync currentYouthUser whenever allYouthUsers changes (e.g. admin or barcode scan sets ready)
  useEffect(() => {
    if (!currentYouthUser) return;
    const target = allYouthUsers.find((u) => u.id === currentYouthUser.id);
    if (target && target.arrivalStatus !== currentYouthUser.arrivalStatus) {
      setCurrentYouthUser((prev) => (prev ? { ...prev, arrivalStatus: target.arrivalStatus } : null));
    }
  }, [allYouthUsers, currentYouthUser?.id]);

  const watchIdRef = useRef<number | null>(null);
  const nativeWatcherIdRef = useRef<string | null>(null);
  const latestPositionRef = useRef<GpsPoint | null>(null);

  // Process incoming GPS coordinate using the exact main app rules
  const handleIncomingGpsPoint = useCallback(
    (pos: any) => {
      if (!currentYouthUser) return;

      const accuracyVal = Math.round(pos.coords?.accuracy || 10);
      // In outdoor forest searches, accept coordinates up to 80m accuracy
      if (accuracyVal > 80) {
        console.warn('GPS reading rejected due to low accuracy:', accuracyVal);
        return;
      }

      const point: GpsPoint = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        timestamp: new Date().toISOString(),
        accuracy: accuracyVal,
        speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : undefined,
        altitude: pos.coords.altitude ? Math.round(pos.coords.altitude) : undefined,
      };

      latestPositionRef.current = point;

      setYouthLocations((prev) => {
        const userLoc = prev[currentYouthUser.id] || { trackHistory: [] };
        
        // Exact Haupt-App Rule:
        // Record track lines ONLY IF exercise is active AND member is set to ready!
        const isReady = currentYouthUser.arrivalStatus === 'ready';
        const isRecording = isExerciseActive && isReady;

        let nextHistory = userLoc.trackHistory;

        if (isRecording) {
          const lastPoint = userLoc.trackHistory[userLoc.trackHistory.length - 1];
          if (lastPoint) {
            const dist = calculateDistanceMeters(lastPoint.lat, lastPoint.lng, point.lat, point.lng);
            const timeDiffSec = Math.abs(new Date(point.timestamp).getTime() - new Date(lastPoint.timestamp).getTime()) / 1000;

            // Filter teleport / spike glitches (> 1500m in < 5s)
            if (!(dist > 1500 && timeDiffSec < 5)) {
              // Record point if moved at least 0.5m or 2 seconds passed
              if (dist >= 0.5 || timeDiffSec >= 2) {
                nextHistory = [...userLoc.trackHistory, point].slice(-1000);
              }
            }
          } else {
            nextHistory = [point];
          }
        }

        return {
          ...prev,
          [currentYouthUser.id]: {
            currentPosition: point,
            trackHistory: nextHistory,
          },
        };
      });
    },
    [currentYouthUser, isExerciseActive]
  );

  // Initialize Dual-Engine GPS (Native Background Capacitor GPS + Browser watchPosition fallback)
  useEffect(() => {
    if (!currentYouthUser) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (nativeWatcherIdRef.current !== null) {
        stopCapacitorBackgroundGps(nativeWatcherIdRef.current);
        nativeWatcherIdRef.current = null;
      }
      return;
    }

    // 1. Native Capacitor Background Geolocation (keeps tracking with screen locked / app in background)
    startCapacitorBackgroundGps(handleIncomingGpsPoint).then((id) => {
      if (id) {
        nativeWatcherIdRef.current = id;
      }
    });

    // 2. Browser watchPosition as high-accuracy active watcher
    if ('geolocation' in navigator) {
      // Immediate one-shot fix for instant location availability
      navigator.geolocation.getCurrentPosition(
        (pos) => handleIncomingGpsPoint(pos),
        (err) => console.warn('Youth initial GPS warning:', err.message),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => handleIncomingGpsPoint(pos),
        (err) => console.warn('Youth GPS watch warning:', err.message),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
      );
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (nativeWatcherIdRef.current !== null) {
        stopCapacitorBackgroundGps(nativeWatcherIdRef.current);
        nativeWatcherIdRef.current = null;
      }
    };
  }, [currentYouthUser?.id, handleIncomingGpsPoint]);

  // ── 6. Auth Functions ─────────────────────────────────────────────────────
  const loginYouthUser = useCallback(
    (usernameOrId: string, pin: string): boolean => {
      const cleanInput = usernameOrId.trim().toLowerCase();
      const cleanPin = pin.trim();

      const found = allYouthUsers.find(
        (u) =>
          (u.id.toLowerCase() === cleanInput ||
            u.username.toLowerCase() === cleanInput ||
            u.name.toLowerCase() === cleanInput ||
            (u.memberCardCode && u.memberCardCode.toLowerCase() === cleanInput)) &&
          u.pin === cleanPin
      );

      if (found) {
        const updated: YouthUser = {
          ...found,
          isActive: true,
          lastSeen: 'Gerade eben',
          lastHeartbeat: Date.now(),
        };
        setAllYouthUsers((prev) => prev.map((u) => (u.id === found.id ? updated : u)));
        setCurrentYouthUser(updated);
        return true;
      }
      return false;
    },
    [allYouthUsers]
  );

  const loginAdultAsYouthAdmin = useCallback(
    (adultUser: User): boolean => {
      if (!isUserAdmin(adultUser)) {
        return false;
      }

      // Create a virtual session as youth admin without polluting adult DB
      const adminSession: YouthUser = {
        id: `youth-admin-${adultUser.id}`,
        name: `${adultUser.name} (Leitung)`,
        username: adultUser.username,
        pin: 'admin',
        callSign: `Jugendleitung ${adultUser.name}`,
        role: 'youth_admin',
        team: 'leitung',
        notes: 'Verifizierter Erwachsenen-Admin der App',
        isActive: true,
        isAdultAccount: true,
        adultOriginalId: adultUser.id,
        trackColor: '#f59e0b', // Amber / Gelb-Gold
        lastSeen: 'Online',
        lastHeartbeat: Date.now(),
      };

      setCurrentYouthUser(adminSession);
      return true;
    },
    []
  );

  const loginAdultIntoJointExercise = useCallback(
    (adultUser: User): boolean => {
      // Create an adult participant session within youth module
      const adultParticipantSession: YouthUser = {
        id: `adult-part-${adultUser.id}`,
        name: adultUser.name,
        username: adultUser.username,
        pin: 'adult',
        callSign: adultUser.callSign || `Erwachsener ${adultUser.name}`,
        role: 'adult_participant',
        team: 'erwachsene',
        notes: `Erwachsene Einsatzkraft (${adultUser.organization || 'Spürhunde Salzlandkreis'})`,
        isActive: true,
        isAdultAccount: true,
        adultOriginalId: adultUser.id,
        trackColor: '#10b981', // Emerald / Grün für Team Erwachsene
        lastSeen: 'Online',
        lastHeartbeat: Date.now(),
      };

      setCurrentYouthUser(adultParticipantSession);
      return true;
    },
    []
  );

  const logoutYouth = useCallback(() => {
    if (currentYouthUser) {
      setAllYouthUsers((prev) =>
        prev.map((u) =>
          u.id === currentYouthUser.id
            ? { ...u, isActive: false, arrivalStatus: 'in_transit', lastSeen: 'Abgemeldet' }
            : u
        )
      );
    }
    setCurrentYouthUser(null);
  }, [currentYouthUser]);

  // ── 7. User Management (Admin only) ───────────────────────────────────────
  const createYouthUser = useCallback(
    (data: Omit<YouthUser, 'id' | 'isActive'>): YouthUser => {
      const id = `youth-${Date.now()}`;
      const newUser: YouthUser = {
        ...data,
        id,
        isActive: false,
        memberCardCode: data.memberCardCode || `SHS-Y-${Math.floor(100 + Math.random() * 900)}`,
        trackColor: data.trackColor || '#38bdf8',
      };
      setAllYouthUsers((prev) => {
        const next = [newUser, ...prev];
        try {
          localStorage.setItem(STORAGE_USERS, JSON.stringify(next));
          localStorage.setItem('rescue_youth_users_initialized_v7', 'true');
          setDoc(
            doc(db, 'settings', 'youth_users'),
            { users: next, updatedAt: new Date().toISOString() },
            { merge: true }
          ).catch(() => {});
        } catch {}
        return next;
      });
      return newUser;
    },
    []
  );

  const updateYouthUser = useCallback((id: string, updates: Partial<YouthUser>) => {
    setAllYouthUsers((prev) => {
      const next = prev.map((u) => (u.id === id ? { ...u, ...updates } : u));
      try {
        localStorage.setItem(STORAGE_USERS, JSON.stringify(next));
        localStorage.setItem('rescue_youth_users_initialized_v7', 'true');
        setDoc(
          doc(db, 'settings', 'youth_users'),
          { users: next, updatedAt: new Date().toISOString() },
          { merge: true }
        ).catch(() => {});
      } catch {}
      return next;
    });
    setCurrentYouthUser((prev) => (prev?.id === id ? { ...prev, ...updates } : prev));
  }, []);

  const deleteYouthUser = useCallback((id: string) => {
    setAllYouthUsers((prev) => {
      const next = prev.filter((u) => u.id !== id);
      try {
        localStorage.setItem(STORAGE_USERS, JSON.stringify(next));
        localStorage.setItem('rescue_youth_users_initialized_v7', 'true');
        setDoc(
          doc(db, 'settings', 'youth_users'),
          { users: next, updatedAt: new Date().toISOString() },
          { merge: true }
        ).catch(() => {});
      } catch {}
      return next;
    });
    setCurrentYouthUser((prev) => (prev?.id === id ? null : prev));
  }, []);

  const setUserReady = useCallback(
    (id: string, status: 'in_transit' | 'ez_reached' | 'ready') => {
      // Rule: Kids can ONLY be set to ready if an exercise is active AND they are logged in / online
      if (status === 'ready') {
        const isOpActive = activeYouthOperation?.status === 'active';
        if (!isOpActive) {
          console.warn('Bereitstellen abgelehnt: Keine aktive Übung gestartet!');
          return;
        }
        const target = allYouthUsers.find((u) => u.id === id);
        if (!target?.isActive) {
          console.warn(`Bereitstellen abgelehnt: ${target?.name || id} ist offline / nicht eingeloggt!`);
          return;
        }
      }

      setAllYouthUsers((prev) => prev.map((u) => (u.id === id ? { ...u, arrivalStatus: status } : u)));
      setCurrentYouthUser((prev) => (prev?.id === id ? { ...prev, arrivalStatus: status } : prev));
    },
    [activeYouthOperation, allYouthUsers]
  );

  const scanBarcodeReady = useCallback(
    (code: string): { success: boolean; user?: YouthUser; message: string } => {
      // 1. Guard: Active exercise required
      const isOpActive = activeYouthOperation?.status === 'active';
      if (!isOpActive) {
        return {
          success: false,
          message: 'Keine aktive Übung! Das Bereitstellen ist erst nach offiziellem Übungsstart möglich.',
        };
      }

      const cleanCode = code.trim().toLowerCase();
      const found = allYouthUsers.find(
        (u) =>
          u.id.toLowerCase() === cleanCode ||
          u.username.toLowerCase() === cleanCode ||
          (u.memberCardCode && u.memberCardCode.toLowerCase() === cleanCode)
      );

      if (!found) {
        return { success: false, message: `Kein Jugend-Mitglied mit Code "${code}" gefunden.` };
      }

      // 2. Guard: Member must be logged in / online
      if (!found.isActive) {
        return {
          success: false,
          user: found,
          message: `${found.name} ist offline / nicht eingeloggt! Erst in der App anmelden, dann bereitstellen.`,
        };
      }

      setUserReady(found.id, 'ready');
      return {
        success: true,
        user: found,
        message: `${found.name} (${found.callSign}) erfolgreich auf BEREIT gesetzt! Suchspur-Tracking aktiv.`,
      };
    },
    [activeYouthOperation, allYouthUsers, setUserReady]
  );

  // ── 8. Exercise / Operation Management ────────────────────────────────────
  const selectOperation = useCallback((id: string) => {
    setCurrentOpId(id);
  }, []);

  const createYouthOperation = useCallback(
    (data: {
      title: string;
      type: 'youth_only' | 'joint';
      locationName: string;
      trainingGoal: string;
      missingTargetName: string;
      missingTargetDescription: string;
      headquartersLocation?: { lat: number; lng: number; address?: string };
      geofenceRadiusMeters?: number;
    }): YouthOperation => {
      const id = `youth-op-${Date.now()}`;
      const defaultHq = data.headquartersLocation || {
        lat: 51.798,
        lng: 11.74,
        address: data.locationName || 'Sammelpunkt / EZ der Jugendübung',
      };
      const radius = data.geofenceRadiusMeters || 1200;

      const newOp: YouthOperation = {
        id,
        title: data.title,
        type: data.type,
        status: 'planned', // Always starts as planned (⚪)
        createdAt: new Date().toISOString(),
        leaderName: currentYouthUser?.name || 'Jugendleitung',
        locationName: data.locationName,
        headquartersLocation: defaultHq,
        geofenceRadiusMeters: radius,
        ezAdminIds: currentYouthUser?.role === 'youth_admin' ? [currentYouthUser.id] : [],
        trainingGoal: data.trainingGoal,
        missingTarget: {
          name: data.missingTargetName,
          description: data.missingTargetDescription,
        },
        sectors: [
          {
            id: `sec-${Date.now()}-1`,
            name: 'Sektor A (Übungsgebiet)',
            polygon: [
              [defaultHq.lat - 0.003, defaultHq.lng - 0.005],
              [defaultHq.lat + 0.004, defaultHq.lng - 0.002],
              [defaultHq.lat + 0.003, defaultHq.lng + 0.005],
              [defaultHq.lat - 0.002, defaultHq.lng + 0.003],
            ],
            status: 'open',
            assignedTeam: 'all',
            color: '#38bdf8',
          },
        ],
        findings: [],
        logs: [
          {
            id: `log-${Date.now()}`,
            operationId: id,
            timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
            authorName: currentYouthUser?.name || 'Jugendleitung',
            text: `Übung angelegt (${data.type === 'joint' ? '🟣 Gemeinsam' : '🟡 Nur Jugend'}). Sammelpunkt/EZ festgelegt: ${defaultHq.address || 'Vor Ort'} (Sicherheitsradius: ${radius}m).`,
            category: 'status',
          },
        ],
        participantIds: allYouthUsers.map((u) => u.id),
      };

      setAllYouthOperations((prev) => {
        const next = [newOp, ...prev];
        try {
          localStorage.setItem(STORAGE_OPS, JSON.stringify(next));
          setDoc(
            doc(db, 'settings', 'youth_operations'),
            { operations: next, updatedAt: new Date().toISOString() },
            { merge: true }
          ).catch(() => {});
        } catch {}
        return next;
      });
      setCurrentOpId(id);
      return newOp;
    },
    [currentYouthUser?.name, allYouthUsers]
  );

  const updateYouthOperation = useCallback((id: string, updates: Partial<YouthOperation>) => {
    setAllYouthOperations((prev) => {
      const next = prev.map((op) => (op.id === id ? { ...op, ...updates } : op));
      try {
        localStorage.setItem(STORAGE_OPS, JSON.stringify(next));
        setDoc(
          doc(db, 'settings', 'youth_operations'),
          { operations: next, updatedAt: new Date().toISOString() },
          { merge: true }
        ).catch(() => {});
      } catch {}
      return next;
    });
  }, []);

  const startYouthOperation = useCallback(
    (id: string) => {
      setAllYouthOperations((prev) =>
        prev.map((op) => {
          if (op.id === id) {
            const logEntry: YouthLogEntry = {
              id: `log-${Date.now()}`,
              operationId: id,
              timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
              authorName: currentYouthUser?.name || 'Jugendleitung',
              text: 'Übung offiziell GESTARTET! GPS-Suchspuraufzeichnung aktiv.',
              category: 'status',
            };
            return {
              ...op,
              status: 'active',
              logs: [...op.logs, logEntry],
            };
          }
          return op;
        })
      );
    },
    [currentYouthUser?.name]
  );

  const pauseYouthOperation = useCallback(
    (id: string, reason?: string) => {
      setAllYouthOperations((prev) =>
        prev.map((op) => {
          if (op.id === id) {
            const logEntry: YouthLogEntry = {
              id: `log-${Date.now()}`,
              operationId: id,
              timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
              authorName: currentYouthUser?.name || 'Jugendleitung',
              text: `Übung PAUSIERT. Grund: ${reason || 'Besprechung / Trinkpause'}`,
              category: 'status',
            };
            return {
              ...op,
              status: 'paused',
              pausedAt: new Date().toISOString(),
              pausedReason: reason,
              logs: [...op.logs, logEntry],
            };
          }
          return op;
        })
      );
    },
    [currentYouthUser?.name]
  );

  const resumeYouthOperation = useCallback(
    (id: string) => {
      setAllYouthOperations((prev) =>
        prev.map((op) => {
          if (op.id === id) {
            const logEntry: YouthLogEntry = {
              id: `log-${Date.now()}`,
              operationId: id,
              timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
              authorName: currentYouthUser?.name || 'Jugendleitung',
              text: 'Übung FORTGESETZT. GPS-Aufzeichnung läuft wieder.',
              category: 'status',
            };
            return {
              ...op,
              status: 'active',
              logs: [...op.logs, logEntry],
            };
          }
          return op;
        })
      );
    },
    [currentYouthUser?.name]
  );

  const endYouthOperation = useCallback(
    (id: string, notes?: string) => {
      setAllYouthOperations((prev) =>
        prev.map((op) => {
          if (op.id === id) {
            const logEntry: YouthLogEntry = {
              id: `log-${Date.now()}`,
              operationId: id,
              timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
              authorName: currentYouthUser?.name || 'Jugendleitung',
              text: `Übung BEENDET & archiviert. Notiz: ${notes || 'Erfolgreich abgeschlossen'}`,
              category: 'status',
            };
            return {
              ...op,
              status: 'completed',
              completedAt: new Date().toISOString(),
              externalNotes: notes,
              logs: [...op.logs, logEntry],
            };
          }
          return op;
        })
      );

      // Reset arrival status of all members to in_transit when exercise concludes
      setAllYouthUsers((prev) =>
        prev.map((u) => ({
          ...u,
          arrivalStatus: 'in_transit',
        }))
      );
    },
    [currentYouthUser?.name]
  );

  const deleteYouthOperation = useCallback((id: string) => {
    setAllYouthOperations((prev) => {
      const next = prev.filter((op) => op.id !== id);
      try {
        localStorage.setItem(STORAGE_OPS, JSON.stringify(next));
        setDoc(
          doc(db, 'settings', 'youth_operations'),
          { operations: next, updatedAt: new Date().toISOString() },
          { merge: true }
        ).catch(() => {});
      } catch {}
      return next;
    });
  }, []);

  // ── 9. In-Exercise Actions ────────────────────────────────────────────────
  const sendChatMessage = useCallback(
    (text: string, channel: 'all' | 'jugend' | 'erwachsene' | 'leitung' = 'all') => {
      if (!text.trim() || !currentYouthUser) return;
      const msg: YouthChatMessage = {
        id: `ymsg-${Date.now()}`,
        operationId: currentYouthOperation?.id || 'general',
        senderId: currentYouthUser.id,
        senderName: currentYouthUser.name,
        senderTeam: currentYouthUser.team,
        channel,
        text: text.trim(),
        timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, msg]);
    },
    [currentYouthUser, currentYouthOperation?.id]
  );

  const reportFinding = useCallback(
    (title: string, description?: string, photoUrl?: string) => {
      if (!currentYouthOperation || !currentYouthUser) return;
      const finding: YouthFinding = {
        id: `yfind-${Date.now()}`,
        operationId: currentYouthOperation.id,
        title,
        description,
        finderId: currentYouthUser.id,
        finderName: currentYouthUser.name,
        finderTeam: currentYouthUser.team,
        timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        location: youthLocations[currentYouthUser.id]?.currentPosition,
        photoUrl,
        verified: false,
      };

      const logEntry: YouthLogEntry = {
        id: `log-${Date.now()}`,
        operationId: currentYouthOperation.id,
        timestamp: finding.timestamp,
        authorName: currentYouthUser.name,
        text: `🎉 FUND GEMELDET durch ${currentYouthUser.name} (${currentYouthUser.team === 'jugend' ? 'Team Jugend' : 'Team Erwachsene'}): "${title}"`,
        category: 'finding',
      };

      setAllYouthOperations((prev) =>
        prev.map((op) =>
          op.id === currentYouthOperation.id
            ? {
                ...op,
                findings: [finding, ...op.findings],
                logs: [...op.logs, logEntry],
              }
            : op
        )
      );
    },
    [currentYouthOperation, currentYouthUser, youthLocations]
  );

  const updateSectorStatus = useCallback(
    (sectorId: string, status: 'open' | 'in_progress' | 'searched') => {
      if (!currentYouthOperation) return;
      setAllYouthOperations((prev) =>
        prev.map((op) => {
          if (op.id === currentYouthOperation.id) {
            return {
              ...op,
              sectors: op.sectors.map((s) => (s.id === sectorId ? { ...s, status } : s)),
            };
          }
          return op;
        })
      );
    },
    [currentYouthOperation]
  );

  // ── 10. SOS & Notfall-Pfeife (Mit Sofort-GPS & Karten-Pin) ───────────────────
  const [activeSosAlert, setActiveSosAlert] = useState<YouthSosAlert | null>(null);

  const triggerSosAlert = useCallback(() => {
    if (!currentYouthUser) return;

    // 1. Synthesize piercing emergency whistle / alarm siren
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        const now = ctx.currentTime;
        // 4 x Durchdringender Doppelton (Notfall-Trillerpfeife)
        for (let i = 0; i < 4; i++) {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = 'sawtooth';
          osc2.type = 'triangle';
          const startTime = now + (i * 0.35);

          osc1.frequency.setValueAtTime(2800, startTime);
          osc1.frequency.linearRampToValueAtTime(3600, startTime + 0.15);
          osc1.frequency.linearRampToValueAtTime(2800, startTime + 0.3);

          osc2.frequency.setValueAtTime(2850, startTime);
          osc2.frequency.linearRampToValueAtTime(3650, startTime + 0.15);
          osc2.frequency.linearRampToValueAtTime(2850, startTime + 0.3);

          gain.gain.setValueAtTime(0.5, startTime);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.32);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          osc1.start(startTime);
          osc1.stop(startTime + 0.32);
          osc2.start(startTime);
          osc2.stop(startTime + 0.32);
        }
      }
    } catch (e) {
      console.warn('SOS whistle audio error:', e);
    }

    // 2. Fetch reliable current GPS position for the SOS alert
    const fallbackLocation = youthLocations[currentYouthUser.id]?.currentPosition || latestPositionRef.current || {
      lat: 51.798,
      lng: 11.74,
      timestamp: new Date().toISOString(),
      accuracy: 10,
    };

    const alert: YouthSosAlert = {
      id: `sos-${Date.now()}`,
      userId: currentYouthUser.id,
      userName: currentYouthUser.name,
      userCallSign: currentYouthUser.callSign,
      timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      location: fallbackLocation,
      resolved: false,
    };

    // Set active SOS alert
    setActiveSosAlert(alert);

    // If device geolocation is reachable right now, try to refresh coordinate immediately
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const freshPoint: GpsPoint = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: new Date().toISOString(),
            accuracy: Math.round(pos.coords.accuracy || 10),
          };
          latestPositionRef.current = freshPoint;
          setActiveSosAlert((prev) => (prev ? { ...prev, location: freshPoint } : null));
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }

    // 3. Post into Exercise Logbuch
    if (currentYouthOperation) {
      const logEntry: YouthLogEntry = {
        id: `log-${Date.now()}`,
        operationId: currentYouthOperation.id,
        timestamp: alert.timestamp,
        authorName: currentYouthUser.name,
        text: `🚨 NOTFALL-PFEIFE / SOS AUSGELÖST durch ${currentYouthUser.name} (${currentYouthUser.callSign})! Position auf der Karte markiert.`,
        category: 'status',
      };
      setAllYouthOperations((prev) =>
        prev.map((op) => (op.id === currentYouthOperation.id ? { ...op, logs: [...op.logs, logEntry] } : op))
      );
    }
  }, [currentYouthUser, youthLocations, currentYouthOperation]);

  const dismissSosAlert = useCallback(() => {
    setActiveSosAlert(null);
  }, []);

  const value = {
    currentYouthUser,
    allYouthUsers,
    currentYouthOperation,
    allYouthOperations,
    activeYouthOperation,
    isExerciseActive,
    isExercisePaused,
    chatMessages,
    youthLocations,
    loginYouthUser,
    loginAdultAsYouthAdmin,
    loginAdultIntoJointExercise,
    logoutYouth,
    createYouthUser,
    updateYouthUser,
    deleteYouthUser,
    setUserReady,
    scanBarcodeReady,
    selectOperation,
    createYouthOperation,
    updateYouthOperation,
    startYouthOperation,
    pauseYouthOperation,
    resumeYouthOperation,
    endYouthOperation,
    deleteYouthOperation,
    sendChatMessage,
    reportFinding,
    updateSectorStatus,
    activeSosAlert,
    triggerSosAlert,
    dismissSosAlert,
  };

  return <YouthContext.Provider value={value}>{children}</YouthContext.Provider>;
};

export const useYouth = () => {
  const context = useContext(YouthContext);
  if (!context) {
    throw new Error('useYouth must be used within a YouthProvider');
  }
  return context;
};
