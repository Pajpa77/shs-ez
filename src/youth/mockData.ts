import { YouthUser, YouthOperation } from './types';
import { VEREINSBUERO_LOCATION } from '../mockData';

export const INITIAL_YOUTH_USERS: YouthUser[] = [
  {
    id: 'youth-felix',
    name: 'Felix (14 J.)',
    username: 'felix',
    pin: '1234',
    age: 14,
    callSign: 'Jungspürer Felix',
    role: 'youth_member',
    team: 'jugend',
    guardianContact: '+49 170 9876543 (Mutter)',
    notes: 'Seit 1 Jahr in der Jugendgruppe. Übt Flächensuche.',
    isActive: false,
    memberCardCode: 'SHS-Y-101',
    arrivalStatus: 'in_transit',
    trackColor: '#38bdf8', // Helles Blau
  },
  {
    id: 'youth-lena',
    name: 'Lena (13 J.)',
    username: 'lena',
    pin: '1234',
    age: 13,
    callSign: 'Jungspürerin Lena',
    role: 'youth_member',
    team: 'jugend',
    guardianContact: '+49 171 1122334 (Vater)',
    notes: 'Ersthelfer-Grundkurs absolviert.',
    isActive: false,
    memberCardCode: 'SHS-Y-102',
    arrivalStatus: 'in_transit',
    trackColor: '#a855f7', // Lila
  },
  {
    id: 'youth-tim',
    name: 'Tim (15 J.)',
    username: 'tim',
    pin: '1234',
    age: 15,
    callSign: 'Jungspürer Tim',
    role: 'youth_member',
    team: 'jugend',
    guardianContact: '+49 172 4455667 (Eltern)',
    notes: 'Interesse an Kartennavigation & Funk.',
    isActive: false,
    trackColor: '#34d399', // Grün
  },
  {
    id: 'youth-sophie',
    name: 'Sophie (12 J.)',
    username: 'sophie',
    pin: '1234',
    age: 12,
    callSign: 'Jungspürerin Sophie',
    role: 'youth_member',
    team: 'jugend',
    guardianContact: '+49 173 7788990 (Mutter)',
    notes: 'Begleithund-Übungen.',
    isActive: false,
    trackColor: '#f43f5e', // Rosa / Pink
  },
];

export const INITIAL_YOUTH_OPERATIONS: YouthOperation[] = [
  {
    id: 'youth-op-training-1',
    title: 'Jugendübung: Erste Orientierung & Fundanzeige',
    type: 'youth_only',
    status: 'planned',
    createdAt: new Date().toISOString(),
    leaderName: 'Maria (Jugendleiterin)',
    locationName: 'Vereinsgelände Bernburg & angrenzendes Waldstück',
    headquartersLocation: {
      lat: 51.798,
      lng: 11.74,
      address: 'Sammelpunkt / EZ Jugend: Bernburg Parkplatz Waldkante',
    },
    geofenceRadiusMeters: 1200,
    trainingGoal: 'Kartenlesen im Gelände, Funkdisziplin und sicheres Melden von Fundstücken',
    missingTarget: {
      name: 'Übungspuppe Max & Rucksack',
      description: 'Große wetterfeste Übungspuppe mit gelber Warnweste und rotem Rucksack.',
    },
    sectors: [
      {
        id: 'sector-j1',
        name: 'Sektor Waldweg Nord',
        polygon: [
          [51.798, 11.735],
          [51.802, 11.738],
          [51.801, 11.745],
          [51.796, 11.741],
        ],
        status: 'open',
        assignedTeam: 'jugend',
        assignedMemberNames: ['Felix', 'Tim'],
        color: '#38bdf8',
      },
      {
        id: 'sector-j2',
        name: 'Sektor Lichtung Süd',
        polygon: [
          [51.794, 11.736],
          [51.797, 11.740],
          [51.795, 11.746],
          [51.791, 11.742],
        ],
        status: 'open',
        assignedTeam: 'jugend',
        assignedMemberNames: ['Lena', 'Sophie'],
        color: '#a855f7',
      },
    ],
    findings: [],
    logs: [
      {
        id: 'log-1',
        operationId: 'youth-op-training-1',
        timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        authorName: 'Maria',
        text: 'Übung für Jugendgruppe angelegt. Einsatzzentrale (📡 EZ) festgelegt. Status: Geplant (⚪ Bereitschaft).',
        category: 'status',
      },
    ],
    participantIds: ['youth-felix', 'youth-lena', 'youth-tim', 'youth-sophie'],
  },
];
