import { GpsPoint } from '../types';

export type YouthUserRole = 'youth_member' | 'youth_admin' | 'adult_participant';
export type YouthTeam = 'jugend' | 'erwachsene' | 'leitung';

export interface YouthAddress {
  street?: string;
  zip?: string;
  city?: string;
}

export interface YouthEmergencyContacts {
  motherName?: string;
  motherPhone?: string;
  fatherName?: string;
  fatherPhone?: string;
  otherContact?: string;
}

export interface YouthHeadquartersLocation {
  lat: number;
  lng: number;
  address?: string;
}

export interface YouthUser {
  id: string;
  name: string;
  username: string;
  pin: string; // 4-stellige PIN für einfachen Login der Kinder
  age?: number;
  callSign: string;
  role: YouthUserRole;
  team: YouthTeam;
  operationalRole?: 'ez_command' | 'searcher'; // In der EZ vs. Als Sucher (für Admins)
  photoUrl?: string; // Profilfoto / Avatar
  guardianContact?: string; // Telefonnummer der Erziehungsberechtigten für Notfälle (Kurzfassung)
  guardianContacts?: YouthEmergencyContacts; // Detaillierte Kontakte (Mutter, Vater etc.)
  birthDate?: string; // Geburtsdatum (YYYY-MM-DD)
  phone?: string; // Eigene Handynummer des Jugendlichen
  address?: YouthAddress; // Anschrift (Straße, PLZ, Ort)
  allergies?: string; // Allergien (z.B. Wespenstich, Pollen, Nüsse)
  medications?: string; // Regelmäßige Medikamente
  tetanusVaccinated?: boolean; // Tetanus-Impfschutz vorhanden?
  isSwimmer?: boolean; // Schwimmer / Nichtschwimmer (wichtig für Zeltlager an Gewässern)
  swimmingBadge?: string; // z.B. Seepferdchen, Bronze, Silber, Gold
  dietaryNotes?: string; // Ernährung (vegetarisch, laktosefrei, etc. für Zeltlager)
  notes?: string;
  isActive: boolean;
  arrivalStatus?: 'in_transit' | 'ez_reached' | 'ready';
  memberCardCode?: string; // Barcode / Mitglieds-Code (z.B. "SHS-Y-1001")
  currentLocation?: GpsPoint;
  trackColor?: string;
  lastSeen?: string;
  lastHeartbeat?: number;
  isAdultAccount?: boolean; // Kennzeichnung falls via Erwachsenen-Account beigetreten
  adultOriginalId?: string;
  assignedSquadId?: string; // Zugeordneter Trupp / Untergruppe
}

export type YouthOperationType = 'youth_only' | 'joint'; // Reine Jugend-Übung vs. Gemeinsame Übung (Erwachsene vs. Jugend)
export type YouthOperationStatus = 'planned' | 'active' | 'paused' | 'completed';

// Szenario-Modus für flexible Gruppenaufteilung
export type YouthScenarioMode =
  | 'multi_sector' // 1 Gruppe, 1 Suchgebiet, aufgeteilt auf mehrere Sektoren (z.B. Trupp 1 in Sektor A, Trupp 2 in Sektor B)
  | 'speed_challenge' // 2 oder 3 Gruppen, gleiches Suchgebiet = 1 Sektor, Wettlauf auf Zeit: wer findet Ziel zuerst?
  | 'joint_teams'; // Flexible gemeinsame Teams (nicht nur starr Erwachsene vs. Jugend, sondern z.B. gemischte Trupps)

export interface YouthSquad {
  id: string;
  name: string; // z.B. "Trupp 1 - Spürnasen", "Trupp 2 - Fährtenfüchse", "Team Erwachsene"
  color: string; // Hex-Farbe für Sektoren/Markierungen
  memberIds: string[]; // Zugeordnete Kinder / Helfer
  assignedSectorIds?: string[]; // Zugeordnete Sektoren
  targetFoundAt?: string; // Zeitstempel bei Fund (für Zeit-Challenge)
  score?: number;
}

export interface YouthClue {
  id: string;
  title: string;
  hint: string;
  location: GpsPoint;
  radiusMeters: number;
  unlockedByTeam?: YouthTeam;
  unlockedAt?: string;
}

export interface YouthSosAlert {
  id: string;
  userId: string;
  userName: string;
  userCallSign: string;
  timestamp: string;
  location?: GpsPoint;
  resolved: boolean;
}

export interface YouthSector {
  id: string;
  name: string; // z.B. "Sektor A - Waldweg"
  polygon: [number, number][]; // [[lat, lng], ...]
  status: 'open' | 'in_progress' | 'searched';
  assignedTeam: YouthTeam | 'all';
  assignedSquadId?: string; // Spezifischer Trupp
  assignedMemberNames?: string[];
  color?: string;
  notes?: string;
}

export interface YouthFinding {
  id: string;
  operationId: string;
  title: string; // z.B. "Rucksack gefunden", "Puppe Max entdeckt"
  description?: string;
  finderId: string;
  finderName: string;
  finderTeam: YouthTeam;
  finderSquadId?: string;
  timestamp: string;
  location?: GpsPoint;
  photoUrl?: string;
  verified: boolean;
}

export interface YouthChatMessage {
  id: string;
  operationId: string;
  senderId: string;
  senderName: string;
  senderTeam: YouthTeam;
  channel: 'all' | 'jugend' | 'erwachsene' | 'leitung';
  text: string;
  timestamp: string;
}

export interface YouthLogEntry {
  id: string;
  operationId: string;
  timestamp: string;
  authorName: string;
  text: string;
  category: 'status' | 'finding' | 'radio' | 'team';
}

export interface YouthOperation {
  id: string;
  title: string;
  type: YouthOperationType;
  status: YouthOperationStatus;
  scenarioMode?: YouthScenarioMode; // Szenario-Modus (Sektor-Aufteilung, Zeit-Wettkampf etc.)
  squads?: YouthSquad[]; // Flexible Trupps / Gruppen
  createdAt: string;
  completedAt?: string;
  pausedAt?: string;
  pausedReason?: string;
  leaderName: string; // Name des leitenden Erwachsenen-Admins
  locationName: string; // Treffpunkt / Suchgebiet
  headquartersLocation: YouthHeadquartersLocation; // 📡 Einsatzzentrale (EZ) / Sammelpunkt der Übung
  ezAdminIds?: string[]; // Admins, die in der EZ eingeteilt sind (werden im EZ-Pin gebündelt)
  trainingGoal: string; // Übungsziel (z.B. "Orientierung mit Karte & Funk", "Fundanzeige")
  missingTarget: {
    name: string; // z.B. "Übungspuppe Max", "Vermisster Rucksack", "Helfer Versteck"
    description: string;
    photoUrl?: string;
  };
  sectors: YouthSector[];
  findings: YouthFinding[];
  clues?: YouthClue[]; // Schnitzeljagd / Fährten-Hinweise
  geofenceRadiusMeters?: number; // Übungsraum-Grenze in Metern um den Treffpunkt / EZ
  logs: YouthLogEntry[];
  participantIds: string[];
  externalNotes?: string;
}
