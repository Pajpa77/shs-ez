import { SearchOperation, User, UserLocationState, ChatMessage } from './types';

// Einsatzleitung & Admins für Spürhunde-Salzlandkreis e.V.
export const INITIAL_USERS: User[] = [
  {
    id: 'user-maria',
    username: 'maria',
    password: 'admin123',
    name: 'Maria',
    role: 'admin',
    isAdmin: true,
    isFirstAdmin: true,
    isOwner: true,
    canLeadOperations: true,
    callSign: 'First-Admin Maria (Owner)',
    licensePlate: 'SLK-EL 1',
    memberId: 'SHS-100001',
    phone: '+49 170 1234567',
    photoUrl: '',
    organization: 'Spürhunde-Salzlandkreis e.V.',
    equipment: ['first_aid'],
    customEquipmentNotes: 'First Admin, App-Owner & Gesamteinsatzleitung (Unantastbar)',
    isActive: false,
    batteryLevel: 100,
    lastSeen: 'Online',
  },
  {
    id: 'user-jule',
    username: 'jule',
    password: 'sucher123',
    name: 'Jule',
    role: 'responder',
    callSign: 'K9 Jule / Leichenspürhund',
    licensePlate: 'SLK-SH 7',
    memberId: 'SHS-100002',
    phone: '+49 171 7890123',
    photoUrl: '',
    organization: 'Spürhunde-Salzlandkreis e.V.',
    equipment: ['k9_cadaver'],
    customEquipmentTags: ['Leichenspürhund (HRD)'],
    customEquipmentNotes: 'Spezialisierter Leichen- & Kadaverspürhund',
    isActive: false,
    batteryLevel: 94,
    lastSeen: 'Abgemeldet',
  },
  {
    id: 'user-gast',
    username: 'gast',
    password: 'gast',
    name: 'Gast / Beobachter',
    role: 'observer',
    callSign: 'Beobachter (Nur Zusehen)',
    licensePlate: '',
    phone: '',
    photoUrl: '',
    organization: 'Gastzugang (Leseansicht)',
    equipment: [],
    customEquipmentNotes: 'Betrachter ohne Feldeinsatz',
    isActive: false,
    batteryLevel: 100,
    lastSeen: 'Abgemeldet',
  },
  {
    id: 'user-jens',
    username: 'jens',
    password: 'admin123',
    name: 'Jens',
    role: 'admin',
    callSign: 'Einsatzleitung Jens (Admin)',
    licensePlate: 'SLK-EL 2',
    phone: '+49 170 2345678',
    photoUrl: '',
    organization: 'Spürhunde-Salzlandkreis e.V.',
    equipment: ['first_aid'],
    customEquipmentNotes: 'Einsatzleitung, Admin & Lagekarte',
    isActive: false,
    batteryLevel: 100,
    lastSeen: 'Abgemeldet',
  },
  {
    id: 'user-micha',
    username: 'micha',
    password: 'admin123',
    name: 'Micha',
    role: 'admin',
    callSign: 'Einsatzleitung Micha (Admin)',
    licensePlate: 'SLK-EL 3',
    phone: '+49 170 3456789',
    photoUrl: '',
    organization: 'Spürhunde-Salzlandkreis e.V.',
    equipment: ['first_aid'],
    customEquipmentNotes: 'Einsatzleitung, Admin & EZ',
    isActive: false,
    batteryLevel: 100,
    lastSeen: 'Abgemeldet',
  },
];

// Vereinsbüro Spürhunde-Salzlandkreis e.V.
const DEFAULT_VEREINSBUERO_BASE = {
  lat: 51.756800, // Exakt Hohe Straße 15, 06449 Aschersleben (Vereinshaus Spürhunde)
  lng: 11.453497,
  address: 'Vereinsbüro Spürhunde-Salzlandkreis e.V., Hohe Straße 15, 06449 Aschersleben',
};

export const getSavedVereinsbueroLocation = (): { lat: number; lng: number; address: string } => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('shs_vereinsbuero_location');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number' && !isNaN(parsed.lat) && !isNaN(parsed.lng)) {
          return {
            lat: parsed.lat,
            lng: parsed.lng,
            address: parsed.address || DEFAULT_VEREINSBUERO_BASE.address,
          };
        }
      }
    } catch {
      // fallback
    }
  }
  return { ...DEFAULT_VEREINSBUERO_BASE };
};

export const saveSavedVereinsbueroLocation = (loc: { lat: number; lng: number; address?: string }) => {
  const updated = {
    lat: Number(loc.lat.toFixed(6)),
    lng: Number(loc.lng.toFixed(6)),
    address: loc.address || VEREINSBUERO_LOCATION.address,
  };
  VEREINSBUERO_LOCATION.lat = updated.lat;
  VEREINSBUERO_LOCATION.lng = updated.lng;
  VEREINSBUERO_LOCATION.address = updated.address;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('shs_vereinsbuero_location', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('shs_vereinsbuero_updated', { detail: updated }));
    } catch (e) {
      console.error('Failed to save vereinsbuero location', e);
    }
  }
};

const _initialHq = getSavedVereinsbueroLocation();
export const VEREINSBUERO_LOCATION = {
  lat: _initialHq.lat,
  lng: _initialHq.lng,
  address: _initialHq.address,
};

// Saubere Ausgangslage für Spürhunde-Salzlandkreis e.V.
export const INITIAL_OPERATIONS: SearchOperation[] = [
  {
    id: 'op-salzland-001',
    title: 'Einsatzbereit - Spürhunde-Salzlandkreis e.V.',
    type: 'operation',
    status: 'completed',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    commander: 'Maria (Einsatzleitung)',
    headquartersLocation: {
      lat: VEREINSBUERO_LOCATION.lat,
      lng: VEREINSBUERO_LOCATION.lng,
      address: VEREINSBUERO_LOCATION.address,
    },
    missingPerson: {
      name: 'Bereitschaftszustand (Keine aktive Suche)',
      age: 0,
      gender: 'diverse',
      photoUrl: '',
      lastSeenTime: 'Einsatzbereit',
      lastSeenLocation: {
        lat: VEREINSBUERO_LOCATION.lat,
        lng: VEREINSBUERO_LOCATION.lng,
        address: VEREINSBUERO_LOCATION.address,
        description: 'Vereinsbüro Aschersleben',
      },
      homeAddress: {
        lat: VEREINSBUERO_LOCATION.lat,
        lng: VEREINSBUERO_LOCATION.lng,
        address: VEREINSBUERO_LOCATION.address,
      },
      clothing: 'Wird bei Alarmierung eingetragen',
      description: 'System einsatzbereit für Spürhunde-Salzlandkreis e.V. Einsatzleitung: Maria, Jens & Micha.',
      medicalConditions: [],
      emergencyContact: 'Einsatzleitung Maria, Jens, Micha',
      policeCaseId: 'SLK-BEREIT',
    },
    sectors: [],
    findings: [],
    logs: [
      {
        id: 'log-init-1',
        operationId: 'op-salzland-001',
        timestamp: new Date().toISOString(),
        authorName: 'Maria',
        authorRole: 'admin',
        category: 'status',
        text: 'Einsatzleitsystem initialisiert für Spürhunde-Salzlandkreis e.V. (Vereinsbüro: Hohe Straße 15, 06449 Aschersleben). Bereit für neue Einsätze und Übungen.',
      },
    ],
    participantIds: ['user-maria'],
    externalVolunteersCount: 0,
    externalVolunteersNotes: '',
    selectedEquipment: ['k9_mantrailer', 'k9_cadaver', 'drone', 'first_aid', 'foot_search'],
    ezAdminIds: ['user-maria', 'user-jens', 'user-micha'],
    notes: 'Vereinsbüro in Aschersleben, Hohe Straße 15.',
  },
];

export const INITIAL_USER_LOCATIONS: Record<string, UserLocationState> = {
  'user-maria': {
    userId: 'user-maria',
    isLive: false,
    lastUpdated: new Date().toISOString(),
    currentPosition: {
      lat: VEREINSBUERO_LOCATION.lat,
      lng: VEREINSBUERO_LOCATION.lng,
      timestamp: new Date().toISOString(),
      accuracy: 2.0,
      speed: 0,
    },
    trackHistory: [
      { lat: VEREINSBUERO_LOCATION.lat, lng: VEREINSBUERO_LOCATION.lng, timestamp: new Date().toISOString() },
    ],
  },
  'user-jule': {
    userId: 'user-jule',
    isLive: false,
    lastUpdated: new Date().toISOString(),
    currentPosition: {
      lat: VEREINSBUERO_LOCATION.lat + 0.001,
      lng: VEREINSBUERO_LOCATION.lng + 0.0015,
      timestamp: new Date().toISOString(),
      accuracy: 2.5,
      speed: 0,
    },
    trackHistory: [],
  },
  'user-jens': {
    userId: 'user-jens',
    isLive: false,
    lastUpdated: new Date().toISOString(),
    currentPosition: {
      lat: VEREINSBUERO_LOCATION.lat,
      lng: VEREINSBUERO_LOCATION.lng,
      timestamp: new Date().toISOString(),
      accuracy: 2.0,
      speed: 0,
    },
    trackHistory: [],
  },
  'user-micha': {
    userId: 'user-micha',
    isLive: false,
    lastUpdated: new Date().toISOString(),
    currentPosition: {
      lat: VEREINSBUERO_LOCATION.lat,
      lng: VEREINSBUERO_LOCATION.lng,
      timestamp: new Date().toISOString(),
      accuracy: 2.0,
      speed: 0,
    },
    trackHistory: [],
  },
};

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [];
