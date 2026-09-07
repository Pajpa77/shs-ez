import React, { useState, useEffect, useRef } from 'react';
import { useRescue } from '../context/RescueContext';
import { OperationType, MissingPerson, SearchOperation, EquipmentType } from '../types';
import { compressImageFile } from '../lib/imageUtils';
import {
  AlertTriangle,
  X,
  Compass,
  User,
  Shield,
  MapPin,
  Save,
  Radio,
  Sparkles,
  Camera,
  Upload,
  Trash2,
  Home,
  Navigation,
  Search,
  Check,
  Edit3,
  Users,
  Wrench,
  Package,
  CheckSquare,
  Square,
  Plus,
  Building2,
  Cloud,
} from 'lucide-react';
import { VEREINSBUERO_LOCATION } from '../mockData';
import { fetchRescueWeather } from '../lib/weatherService';

const AVAILABLE_EQUIPMENT: { type: EquipmentType; label: string; icon: string; desc: string }[] = [
  { type: 'drone', label: 'Drohne / UAS', icon: '🚁', desc: 'Flugdrohnen mit Kamera' },
  { type: 'k9_mantrailer', label: 'Mantrailer K9', icon: '🐕', desc: 'Personenspürhunde nach Individualgeruch' },
  { type: 'k9_area', label: 'Flächensuchhund K9', icon: '🐾', desc: 'Flächensuchhunde im Freigelände' },
  { type: 'k9_cadaver', label: 'Leichenspürhund K9', icon: '🐕‍🦺', desc: 'Spezialisierte K9-Kräfte' },
  { type: 'flir', label: 'FLIR / Wärmebild', icon: '🌡️', desc: 'Infrarot- & Thermalsensorik' },
  { type: 'quad', label: 'Quad / ATV', icon: '🚜', desc: 'Geländefahrzeuge für schweres Terrain' },
  { type: 'boat', label: 'Boot / Wasserrettung', icon: '🚤', desc: 'Boote für Gewässerabschnitte' },
  { type: 'foot_search', label: 'Fußtrupp', icon: '🚶', desc: 'Kammweg- & Waldsuche zu Fuß' },
  { type: 'first_aid', label: 'Sanitäter / Notfall', icon: '🩹', desc: 'Medizinische Erstversorgung' },
];

interface OperationCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit';
  operationToEdit?: SearchOperation | null;
  onStartDrawingSector?: () => void;
}

export const OperationCreatorModal: React.FC<OperationCreatorModalProps> = ({
  isOpen,
  onClose,
  mode = 'create',
  operationToEdit,
  onStartDrawingSector,
}) => {
  const { createOperation, updateOperation, deleteOperation, currentOperation, currentUser, allUsers, getUserArrivalStatus } = useRescue();

  const [ezAdminIds, setEzAdminIds] = useState<string[]>([]);

  const targetOp = operationToEdit || (mode === 'edit' ? currentOperation : null);
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'einsatzleitung';
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [type, setType] = useState<OperationType>('live_search');
  const [title, setTitle] = useState('Vermisstensuche Salzlandkreis');
  const [commander, setCommander] = useState(currentUser?.name || 'Maria (Einsatzleitung)');

  // Missing person state
  const [personName, setPersonName] = useState('');
  const [personAge, setPersonAge] = useState<number | ''>('');
  const [gender, setGender] = useState<'male' | 'female' | 'diverse'>('diverse');
  const [clothing, setClothing] = useState('');
  const [description, setDescription] = useState('');
  const [medicalConditions, setMedicalConditions] = useState('');
  const [policeCaseId, setPoliceCaseId] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Wohnadresse der vermissten Person
  const [homeAddress, setHomeAddress] = useState('');
  const [homeLat, setHomeLat] = useState<number | ''>('');
  const [homeLng, setHomeLng] = useState<number | ''>('');
  const [homeNotes, setHomeNotes] = useState('');
  const [isGeocodingHome, setIsGeocodingHome] = useState(false);
  const [homeGeocodeStatus, setHomeGeocodeStatus] = useState<'idle' | 'success' | 'not_found' | 'error'>('idle');

  // 2. Letzter Sichtort (PLS)
  const [lastSeenAddress, setLastSeenAddress] = useState('Waldgebiet / Parkplatz, Salzlandkreis');
  const [lastSeenTime, setLastSeenTime] = useState('Heute ca. 14:00 Uhr');
  const [lastSeenLat, setLastSeenLat] = useState<number>(VEREINSBUERO_LOCATION.lat);
  const [lastSeenLng, setLastSeenLng] = useState<number>(VEREINSBUERO_LOCATION.lng);
  const [lastSeenDesc, setLastSeenDesc] = useState('');
  const [isGeocodingPLS, setIsGeocodingPLS] = useState(false);
  const [plsGeocodeStatus, setPlsGeocodeStatus] = useState<'idle' | 'success' | 'not_found' | 'error'>('idle');

  // 3. Standort der EZ (EZ / Führung vor Ort oder Vereinsbüro)
  const [hqAddress, setHqAddress] = useState(VEREINSBUERO_LOCATION.address);
  const [hqLat, setHqLat] = useState<number>(VEREINSBUERO_LOCATION.lat);
  const [hqLng, setHqLng] = useState<number>(VEREINSBUERO_LOCATION.lng);
  const [hqDescription, setHqDescription] = useState('Vereinsbüro Spürhunde-Salzlandkreis e.V.');
  const [isGeocodingHQ, setIsGeocodingHQ] = useState(false);
  const [hqGeocodeStatus, setHqGeocodeStatus] = useState<'idle' | 'success' | 'not_found' | 'error'>('idle');

  // 4. Kräfte, Teilnehmer & Freiwillige Helfer ohne App
  const [selectedResponders, setSelectedResponders] = useState<string[]>([]);
  const [externalVolunteersCount, setExternalVolunteersCount] = useState<number | ''>(0);
  const [externalVolunteersNotes, setExternalVolunteersNotes] = useState('');

  // 5. Ausrüstung & Einsatzmittel
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentType[]>(['drone', 'k9_mantrailer', 'foot_search']);
  const [customEquipmentNotes, setCustomEquipmentNotes] = useState('');
  const [weatherConditions, setWeatherConditions] = useState('');
  const [formError, setFormError] = useState('');

  const prevIsOpenRef = useRef(false);
  const prevTargetOpIdRef = useRef<string | null>(null);

  // Load existing data ONLY when modal transitions from closed to open, or when editing a different target operation
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    const targetOpId = targetOp?.id || null;
    const isNewTarget = mode === 'edit' && targetOpId !== prevTargetOpIdRef.current;

    if (isOpen && (!wasOpen || isNewTarget)) {
      if (mode === 'edit' && targetOp) {
        setType(targetOp.type || 'live_search');
        setTitle(targetOp.title || '');
        setCommander(targetOp.commander || currentUser?.name || 'Einsatzleitung');

        const mp = targetOp.missingPerson;
        if (mp) {
          setPersonName(mp.name || '');
          setPersonAge(mp.age !== undefined ? mp.age : '');
          setGender(mp.gender || 'diverse');
          setClothing(mp.clothing || '');
          setDescription(mp.description || '');
          setMedicalConditions(Array.isArray(mp.medicalConditions) ? mp.medicalConditions.join(', ') : '');
          setPoliceCaseId(mp.policeCaseId || '');
          setPhotoUrl(mp.photoUrl || '');

          if (mp.homeAddress) {
            setHomeAddress(mp.homeAddress.address || '');
            setHomeLat(mp.homeAddress.lat !== undefined ? mp.homeAddress.lat : '');
            setHomeLng(mp.homeAddress.lng !== undefined ? mp.homeAddress.lng : '');
            setHomeNotes(mp.homeAddress.notes || '');
          } else {
            setHomeAddress('');
            setHomeLat('');
            setHomeLng('');
            setHomeNotes('');
          }

          if (mp.lastSeenLocation) {
            setLastSeenAddress(mp.lastSeenLocation.address || '');
            setLastSeenLat(mp.lastSeenLocation.lat || VEREINSBUERO_LOCATION.lat);
            setLastSeenLng(mp.lastSeenLocation.lng || VEREINSBUERO_LOCATION.lng);
            setLastSeenDesc(mp.lastSeenLocation.description || '');
          }
          setLastSeenTime(mp.lastSeenTime || '');
        }

        if (targetOp.headquartersLocation) {
          setHqAddress(targetOp.headquartersLocation.address || VEREINSBUERO_LOCATION.address);
          setHqLat(targetOp.headquartersLocation.lat !== undefined ? targetOp.headquartersLocation.lat : VEREINSBUERO_LOCATION.lat);
          setHqLng(targetOp.headquartersLocation.lng !== undefined ? targetOp.headquartersLocation.lng : VEREINSBUERO_LOCATION.lng);
          setHqDescription(targetOp.headquartersLocation.description || '');
        } else {
          setHqAddress(VEREINSBUERO_LOCATION.address);
          setHqLat(VEREINSBUERO_LOCATION.lat);
          setHqLng(VEREINSBUERO_LOCATION.lng);
          setHqDescription('Vereinsbüro Spürhunde-Salzlandkreis e.V.');
        }

        setSelectedResponders(
          Array.isArray(targetOp.participantIds) && targetOp.participantIds.length > 0
            ? targetOp.participantIds
            : allUsers.map((u) => u.id)
        );
        setExternalVolunteersCount(targetOp.externalVolunteersCount !== undefined ? targetOp.externalVolunteersCount : 0);
        setExternalVolunteersNotes(targetOp.externalVolunteersNotes || '');
        setSelectedEquipment(
          Array.isArray(targetOp.selectedEquipment) && targetOp.selectedEquipment.length > 0
            ? targetOp.selectedEquipment
            : ['drone', 'k9_mantrailer', 'foot_search']
        );
        setCustomEquipmentNotes(targetOp.customEquipmentNotes || '');
        setWeatherConditions(targetOp.weatherConditions || '');
        setEzAdminIds(
          Array.isArray(targetOp.ezAdminIds) && targetOp.ezAdminIds.length > 0
            ? targetOp.ezAdminIds
            : allUsers.filter((u) => u.role === 'admin' || u.role === 'einsatzleitung').map((u) => u.id)
        );
      } else if (mode === 'create') {
        const defaultAdmins = allUsers.filter((u) => u.role === 'admin' || u.role === 'einsatzleitung').map((u) => u.id);
        setEzAdminIds(defaultAdmins.length > 0 ? defaultAdmins : (currentUser?.id ? [currentUser.id] : []));
        setType('live_search');
        setTitle('Vermisstensuche Salzlandkreis');
        setCommander(currentUser?.name ? `${currentUser.name} (${currentUser.callSign || 'Einsatzleitung'})` : 'Maria (Einsatzleitung)');
        setPersonName('');
        setPersonAge('');
        setGender('diverse');
        setClothing('');
        setDescription('');
        setMedicalConditions('');
        setPoliceCaseId('');
        setPhotoUrl('');
        setHomeAddress('');
        setHomeLat('');
        setHomeLng('');
        setHomeNotes('');
        setLastSeenAddress('Salzlandkreis, Sachsen-Anhalt');
        setLastSeenTime('Heute ca. 14:00 Uhr');
        setLastSeenLat(VEREINSBUERO_LOCATION.lat);
        setLastSeenLng(VEREINSBUERO_LOCATION.lng);
        setLastSeenDesc('');
        setHqAddress(VEREINSBUERO_LOCATION.address);
        setHqLat(VEREINSBUERO_LOCATION.lat);
        setHqLng(VEREINSBUERO_LOCATION.lng);
        setHqDescription('EZ / Bereitstellungsraum');

        const activeUsers = allUsers.filter((u) => u.isActive);
        setSelectedResponders(activeUsers.length > 0 ? activeUsers.map((u) => u.id) : allUsers.map((u) => u.id));
        setExternalVolunteersCount(0);
        setExternalVolunteersNotes('');
        setSelectedEquipment(['drone', 'k9_mantrailer', 'foot_search', 'first_aid']);
        setCustomEquipmentNotes('');
        setWeatherConditions('');
      }
      setHomeGeocodeStatus('idle');
      setPlsGeocodeStatus('idle');
    }

    prevIsOpenRef.current = isOpen;
    prevTargetOpIdRef.current = targetOpId;
  }, [isOpen, mode, targetOp?.id, allUsers, currentUser]);

  if (!isOpen) return null;

  // Explicit admin/EL guard clause
  if (currentUser?.role !== 'admin' && currentUser?.role !== 'einsatzleitung') {
    return (
      <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-sans">
        <div className="bg-[#1E293B] border border-red-500/50 rounded-2xl p-6 max-w-md text-center space-y-4 shadow-2xl text-slate-100">
          <div className="w-12 h-12 rounded-full bg-red-600/20 text-red-400 mx-auto flex items-center justify-center border border-red-500/40">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white uppercase tracking-wide">Zugriff verweigert (Admin-Bereich)</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Nur Einsatzleiter und Administratoren (Rolle: <span className="font-mono text-red-400 font-bold">admin</span> / <span className="font-mono text-blue-400 font-bold">einsatzleitung</span>) sind autorisiert, neue Sucheinsätze anzulegen oder bestehende Einsatzdaten zu bearbeiten.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs font-mono transition cursor-pointer border border-slate-700"
          >
            Schließen
          </button>
        </div>
      </div>
    );
  }

  // Free OpenStreetMap Nominatim Geocoding
  const geocodeAddress = async (
    query: string,
    target: 'home' | 'pls' | 'hq'
  ) => {
    if (!query.trim()) return;

    if (target === 'home') {
      setIsGeocodingHome(true);
      setHomeGeocodeStatus('idle');
    } else if (target === 'pls') {
      setIsGeocodingPLS(true);
      setPlsGeocodeStatus('idle');
    } else {
      setIsGeocodingHQ(true);
      setHqGeocodeStatus('idle');
    }

    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        {
          headers: {
            'Accept-Language': 'de',
          },
        }
      );
      if (!resp.ok) throw new Error('Geocoding request failed');
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        if (target === 'home') {
          setHomeLat(Number(lat.toFixed(6)));
          setHomeLng(Number(lon.toFixed(6)));
          setHomeGeocodeStatus('success');
        } else if (target === 'pls') {
          setLastSeenLat(Number(lat.toFixed(6)));
          setLastSeenLng(Number(lon.toFixed(6)));
          setPlsGeocodeStatus('success');
        } else {
          setHqLat(Number(lat.toFixed(6)));
          setHqLng(Number(lon.toFixed(6)));
          setHqGeocodeStatus('success');
        }
      } else {
        if (target === 'home') setHomeGeocodeStatus('not_found');
        else if (target === 'pls') setPlsGeocodeStatus('not_found');
        else setHqGeocodeStatus('not_found');
      }
    } catch (err) {
      console.warn('Geocoding error:', err);
      if (target === 'home') setHomeGeocodeStatus('error');
      else if (target === 'pls') setPlsGeocodeStatus('error');
      else setHqGeocodeStatus('error');
    } finally {
      if (target === 'home') setIsGeocodingHome(false);
      else if (target === 'pls') setIsGeocodingPLS(false);
      else setIsGeocodingHQ(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsCompressing(true);
      const compressed = await compressImageFile(file, 400, 0.82);
      setPhotoUrl(compressed);
    } catch (err) {
      console.warn('Error compressing photo:', err);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (currentUser?.role !== 'admin') {
      setFormError('Aktion verweigert: Nur Administratoren dürfen Einsätze anlegen oder bearbeiten.');
      return;
    }
    if (!title.trim() || !personName.trim()) {
      setFormError('Bitte Titel und Namen der vermissten Person eingeben.');
      return;
    }

    const latVal = typeof lastSeenLat === 'number' ? lastSeenLat : VEREINSBUERO_LOCATION.lat;
    const lngVal = typeof lastSeenLng === 'number' ? lastSeenLng : VEREINSBUERO_LOCATION.lng;

    const hqLatVal = typeof hqLat === 'number' ? hqLat : VEREINSBUERO_LOCATION.lat;
    const hqLngVal = typeof hqLng === 'number' ? hqLng : VEREINSBUERO_LOCATION.lng;

    const headquartersLocation = {
      lat: hqLatVal,
      lng: hqLngVal,
      address: hqAddress.trim() || VEREINSBUERO_LOCATION.address,
      description: hqDescription.trim() || undefined,
    };

    const missingPerson: MissingPerson = {
      name: personName.trim(),
      age: typeof personAge === 'number' ? personAge : 0,
      gender,
      clothing: clothing.trim(),
      description: description.trim(),
      medicalConditions: medicalConditions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      lastSeenLocation: {
        lat: latVal,
        lng: lngVal,
        address: lastSeenAddress.trim() || 'Einsatzgebiet',
        description: lastSeenDesc.trim() || undefined,
      },
      homeAddress: homeAddress.trim()
        ? {
            address: homeAddress.trim(),
            lat: typeof homeLat === 'number' ? homeLat : undefined,
            lng: typeof homeLng === 'number' ? homeLng : undefined,
            notes: homeNotes.trim() || undefined,
          }
        : undefined,
      lastSeenTime: lastSeenTime.trim() || 'Unbekannt',
      photoUrl,
      policeCaseId: policeCaseId.trim(),
    };

    let finalEzAdminIds = [...ezAdminIds];
    if (finalEzAdminIds.length === 0) {
      const availableAdmins = allUsers.filter((u) => u.role === 'admin' || u.role === 'einsatzleitung').map((u) => u.id);
      if (availableAdmins.length > 0) {
        finalEzAdminIds = availableAdmins;
      } else if (currentUser?.id) {
        finalEzAdminIds = [currentUser.id];
      } else {
        setFormError('Mindestens ein Administrator muss dem EZ zugeteilt werden.');
        return;
      }
    }

    const finalVolunteersCount = typeof externalVolunteersCount === 'number' ? externalVolunteersCount : 0;
    const finalParticipantIds = Array.from(new Set(selectedResponders));

    const extraFields = {
      participantIds: finalParticipantIds,
      externalVolunteersCount: finalVolunteersCount,
      externalVolunteersNotes: externalVolunteersNotes.trim(),
      selectedEquipment,
      customEquipmentNotes: customEquipmentNotes.trim(),
      weatherConditions: weatherConditions.trim(),
      ezAdminIds: finalEzAdminIds,
    };

    if (mode === 'edit' && targetOp) {
      updateOperation(targetOp.id, {
        title: title.trim(),
        type,
        commander: commander.trim(),
        missingPerson,
        headquartersLocation,
        ...extraFields,
      });
    } else {
      createOperation({
        title: title.trim(),
        type,
        commander: commander.trim(),
        missingPerson,
        headquartersLocation,
        ...extraFields,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto font-sans">
      <div className="bg-[#1E293B] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl text-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900/90 p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-xl border ${
              mode === 'edit'
                ? 'bg-blue-950 text-blue-400 border-blue-700'
                : 'bg-red-950 text-red-400 border-red-700'
            }`}>
              {mode === 'edit' ? <Edit3 className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                {mode === 'edit' ? 'Laufenden Einsatz bearbeiten' : 'Neue Suchaktion starten'}
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                {mode === 'edit'
                  ? 'Vermisstenprofil, Wohnadresse, Sichtort und Einsatzdaten aktualisieren'
                  : 'Einsatzleitung eröffnet Lage, erfasst Vermisstenprofil und setzt Einsatzschwerpunkte'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-red-950/90 border border-red-600 text-red-300 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* Operation Type Distinction: Realeinsatz vs Übung */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
              Einsatzart / Typ auswählen *:
            </label>
            <div className="grid grid-cols-2 gap-3 font-mono">
              <button
                type="button"
                onClick={() => setType('live_search')}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex items-center gap-3 ${
                  type === 'live_search'
                    ? 'bg-red-500/20 border-red-500 text-red-200 ring-1 ring-red-500/40 shadow-lg'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span className="text-2xl">🚨</span>
                <div>
                  <div className="font-bold text-sm text-red-400 uppercase">REALEINSATZ</div>
                  <div className="text-[10px] text-slate-300 font-sans">Akute Menschenrettung / Notfall</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('exercise')}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex items-center gap-3 ${
                  type === 'exercise'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-200 ring-1 ring-amber-500/40 shadow-lg'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span className="text-2xl">🟠</span>
                <div>
                  <div className="font-bold text-sm text-amber-400 uppercase">ÜBUNG / DRILL</div>
                  <div className="text-[10px] text-slate-300 font-sans">Staffelübung, Training</div>
                </div>
              </button>
            </div>
          </div>

          {/* Title & Commander */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
            <div>
              <label className="block font-bold text-slate-300 mb-1 text-[11px] uppercase tracking-wider">
                Einsatzbezeichnung *:
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Vermisstensuche Forst Süd"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1 text-[11px] uppercase tracking-wider">
                Einsatzleiter (EL) *:
              </label>
              <input
                type="text"
                required
                value={commander}
                onChange={(e) => setCommander(e.target.value)}
                placeholder="z.B. Maria (Einsatzleitung)"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Missing Person Dossier */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-3 font-mono">
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">
              👤 PROFIL DER VERMISSTEN PERSON
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                  Name der Person *:
                </label>
                <input
                  type="text"
                  required
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="Vorname Nachname"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                  Alter (Jahre):
                </label>
                <input
                  type="number"
                  value={personAge}
                  onChange={(e) => setPersonAge(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="z.B. 74"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                Bekleidung / Signalfarben:
              </label>
              <input
                type="text"
                value={clothing}
                onChange={(e) => setClothing(e.target.value)}
                placeholder="z.B. Rote Regenjacke, dunkle Hose, weiße Mütze"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-sans"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                Personenbeschreibung & Merkmale:
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Größe, Statur, Haare, Sehhilfe, Gehstock..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-sans"
              />
            </div>

            {/* Missing Person Photo */}
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg bg-slate-900 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                {photoUrl ? (
                  <img src={photoUrl} alt="Vermisste Person" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-slate-500" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="missing-person-photo-input"
                />
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="missing-person-photo-input"
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-[11px] cursor-pointer inline-flex items-center gap-1.5 transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isCompressing ? 'Wird optimiert...' : 'Foto hochladen'}</span>
                  </label>
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="px-2.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/50 font-bold text-[11px] cursor-pointer inline-flex items-center gap-1 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Entfernen</span>
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">Aktuelles Lichtbild der vermissten Person</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                  Medizinische Risiken / Vorerkrankungen:
                </label>
                <input
                  type="text"
                  value={medicalConditions}
                  onChange={(e) => setMedicalConditions(e.target.value)}
                  placeholder="z.B. Demenz, Diabetes, Herzbeschwerden"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                  Polizei-Aktenzeichen / Notruf-Ref:
                </label>
                <input
                  type="text"
                  value={policeCaseId}
                  onChange={(e) => setPoliceCaseId(e.target.value)}
                  placeholder="z.B. POL-SLK-2026-9812"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* 1. Wohnadresse der vermissten Person */}
          <div className="bg-slate-900 p-4 rounded-xl border border-amber-500/40 space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5" />
                🏠 1. WOHNADRESSE DER VERMISSTEN PERSON (HOME)
              </span>
              <span className="text-[9px] text-slate-400">Wird mit Haus-Symbol auf Karte markiert</span>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                  Wohnanschrift / Straße, Hausnr, Ort:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={homeAddress}
                    onChange={(e) => {
                      setHomeAddress(e.target.value);
                      setHomeGeocodeStatus('idle');
                    }}
                    placeholder="z.B. Markt 12, 39218 Schönebeck"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500 font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => geocodeAddress(homeAddress, 'home')}
                    disabled={isGeocodingHome || !homeAddress.trim()}
                    className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition shrink-0"
                    title="Koordinaten automatisch über OpenStreetMap ermitteln"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>{isGeocodingHome ? 'Sucht...' : 'Auf Karte finden'}</span>
                  </button>
                </div>
              </div>

              {/* Geocoding status message */}
              {homeGeocodeStatus === 'success' && (
                <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>Adresse erfolgreich lokalisiert (GPS: {homeLat}, {homeLng})</span>
                </div>
              )}
              {homeGeocodeStatus === 'not_found' && (
                <div className="text-[10px] text-amber-400">
                  ⚠️ Adresse nicht eindeutig gefunden. Bitte Ort ergänzen oder Koordinaten manuell eintragen.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-slate-400 text-[10px] uppercase">GPS Breite (Latitude):</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={homeLat}
                    onChange={(e) => setHomeLat(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="z.B. 51.848000"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px] uppercase">GPS Länge (Longitude):</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={homeLng}
                    onChange={(e) => setHomeLng(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="z.B. 11.628000"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Letzter Sichtort (PLS / Point of Last Seen) */}
          <div className="bg-slate-900 p-4 rounded-xl border border-blue-500/40 space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                📍 2. LETZTER SICHTUNGSORT (POINT LAST SEEN / PLS)
              </span>
              <span className="text-[9px] text-slate-400">Such-Ursprung mit Distanzringen (500m, 1km, 2km)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                  Letzter Ort / Adresse / Waldkante *:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={lastSeenAddress}
                    onChange={(e) => {
                      setLastSeenAddress(e.target.value);
                      setPlsGeocodeStatus('idle');
                    }}
                    placeholder="z.B. Wanderparkplatz Süd / Bierer Berg"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => geocodeAddress(lastSeenAddress, 'pls')}
                    disabled={isGeocodingPLS || !lastSeenAddress.trim()}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition shrink-0"
                    title="Koordinaten automatisch über OpenStreetMap ermitteln"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>{isGeocodingPLS ? 'Sucht...' : 'Auf Karte finden'}</span>
                  </button>
                </div>
              </div>

              {plsGeocodeStatus === 'success' && (
                <div className="sm:col-span-2 text-[10px] text-emerald-400 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>Sichtungsort erfolgreich lokalisiert (GPS: {lastSeenLat}, {lastSeenLng})</span>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                  Sichtungszeitpunkt *:
                </label>
                <input
                  type="text"
                  required
                  value={lastSeenTime}
                  onChange={(e) => setLastSeenTime(e.target.value)}
                  placeholder="z.B. Heute 14:30 Uhr"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                  Geländebeschreibung (optional):
                </label>
                <input
                  type="text"
                  value={lastSeenDesc}
                  onChange={(e) => setLastSeenDesc(e.target.value)}
                  placeholder="z.B. Dichter Mischwald, sumpfige Lichtung"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] uppercase">GPS Breite (Latitude):</label>
                <input
                  type="number"
                  step="0.000001"
                  value={lastSeenLat}
                  onChange={(e) => setLastSeenLat(Number(e.target.value))}
                  placeholder={String(VEREINSBUERO_LOCATION.lat)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[10px] uppercase">GPS Länge (Longitude):</label>
                <input
                  type="number"
                  step="0.000001"
                  value={lastSeenLng}
                  onChange={(e) => setLastSeenLng(Number(e.target.value))}
                  placeholder={String(VEREINSBUERO_LOCATION.lng)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* 3. Standort der EZ (EZ / Führung) */}
          <div className="bg-slate-900/60 p-4 rounded-xl border border-indigo-500/40 space-y-3 font-sans">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-slate-200 uppercase tracking-wider text-xs font-mono">
                  Standort der EZ (EZ / Führung)
                </span>
              </div>
              <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/60">
                Ortsfest auf Lagekarte
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              Bestimmt den festen Standort des EZ / der Einsatzleitung für diese Suche/Übung. Bleibt unabhängig vom GPS-Standort der Administratoren fixiert, da die Einsatzleitung selbst an der Suche teilnehmen kann.
            </p>

            {/* Schnellauswahl Vorlagen */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setHqAddress(VEREINSBUERO_LOCATION.address);
                  setHqLat(VEREINSBUERO_LOCATION.lat);
                  setHqLng(VEREINSBUERO_LOCATION.lng);
                  setHqDescription('Vereinsbüro Spürhunde-Salzlandkreis e.V.');
                }}
                className="px-2.5 py-1 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 text-[11px] font-mono transition cursor-pointer flex items-center gap-1.5"
              >
                <span>🏢 Vereinsbüro Aschersleben (Hohe Str. 15)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (lastSeenAddress) setHqAddress(lastSeenAddress);
                  if (typeof lastSeenLat === 'number') setHqLat(lastSeenLat);
                  if (typeof lastSeenLng === 'number') setHqLng(lastSeenLng);
                  setHqDescription('EZ am letzten Sichtungsort (PLS)');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-mono transition cursor-pointer flex items-center gap-1.5"
              >
                <span>📍 Wie letzter Sichtort (PLS)</span>
              </button>
              {homeAddress && (
                <button
                  type="button"
                  onClick={() => {
                    setHqAddress(homeAddress);
                    if (typeof homeLat === 'number') setHqLat(homeLat);
                    if (typeof homeLng === 'number') setHqLng(homeLng);
                    setHqDescription('EZ an Wohnanschrift');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-mono transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>🏠 Wie Wohnadresse</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        setHqLat(Number(pos.coords.latitude.toFixed(6)));
                        setHqLng(Number(pos.coords.longitude.toFixed(6)));
                        setHqDescription('EZ vor Ort (Aktuelles GPS)');
                      },
                      (err) => {
                        console.warn(`GPS-Abfrage fehlgeschlagen: ${err.message}`);
                        setFormError(`GPS-Abfrage nicht möglich: ${err.message}`);
                      }
                    );
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-mono transition cursor-pointer flex items-center gap-1.5"
              >
                <span>🧭 Eigener GPS-Standort</span>
              </button>
            </div>

            {/* Adresse & Geocoding */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider font-mono">
                Adresse / Bereitstellungsraum:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={hqAddress}
                  onChange={(e) => {
                    setHqAddress(e.target.value);
                    setHqGeocodeStatus('idle');
                  }}
                  placeholder="z.B. Hohe Straße 15, 06449 Aschersleben oder Waldparkplatz Forsthaus"
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 font-sans"
                />
                <button
                  type="button"
                  disabled={isGeocodingHQ || !hqAddress.trim()}
                  onClick={() => geocodeAddress(hqAddress, 'hq')}
                  className="px-3 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-600 disabled:bg-slate-800 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  {isGeocodingHQ ? (
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>Koordinaten suchen</span>
                </button>
              </div>
              {hqGeocodeStatus === 'success' && (
                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 mt-1">
                  <Check className="w-3 h-3" /> Koordinaten erfolgreich über Geocoding ermittelt.
                </span>
              )}
              {hqGeocodeStatus === 'not_found' && (
                <span className="text-[10px] text-amber-400 font-mono mt-1 block">
                  Adresse nicht gefunden. Bitte manuell anpassen oder GPS eintragen.
                </span>
              )}
            </div>

            {/* Zusatzbemerkung EZ */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider font-mono">
                Bezeichnung / Lagehinweis (optional):
              </label>
              <input
                type="text"
                value={hqDescription}
                onChange={(e) => setHqDescription(e.target.value)}
                placeholder="z.B. Weißer Sprinter (SLK-EL 1) am Parkplatz Haupteingang"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 font-sans"
              />
            </div>

            {/* Koordinaten */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-mono">EZ Breite (Latitude):</label>
                <input
                  type="number"
                  step="0.000001"
                  value={hqLat}
                  onChange={(e) => setHqLat(Number(e.target.value))}
                  placeholder={String(VEREINSBUERO_LOCATION.lat)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-mono">EZ Länge (Longitude):</label>
                <input
                  type="number"
                  step="0.000001"
                  value={hqLng}
                  onChange={(e) => setHqLng(Number(e.target.value))}
                  placeholder={String(VEREINSBUERO_LOCATION.lng)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Einsatzkräfte, Teilnehmer & Externe Helfer */}
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-slate-200 uppercase tracking-wider text-xs font-mono">
                  Eingesetzte Kräfte & Helfer
                </span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800/60">
                Stärke: {selectedResponders.length + (typeof externalVolunteersCount === 'number' ? externalVolunteersCount : 0)} Gesamt
              </span>
            </div>

            {/* App-Registrierte Kräfte */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">
                  App-Registrierte Einsatzkräfte ({selectedResponders.length} ausgewählt):
                </label>
                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      const activeIds = allUsers.filter((u) => u.isActive).map((u) => u.id);
                      setSelectedResponders(activeIds.length > 0 ? activeIds : allUsers.map((u) => u.id));
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  >
                    Aktive wählen
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedResponders(allUsers.filter((u) => u.role !== 'admin').map((u) => u.id))}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  >
                    Nur Sucher
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedResponders([])}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 transition cursor-pointer"
                  >
                    Keine
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {allUsers.map((u) => {
                  const isChecked = selectedResponders.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setSelectedResponders((prev) =>
                          isChecked ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                        );
                      }}
                      className={`flex items-center justify-between p-2 rounded-xl border text-left transition cursor-pointer ${
                        isChecked
                          ? 'bg-emerald-950/40 border-emerald-600/70 text-emerald-100 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate">
                            {u.callSign || u.name}
                            {u.callSign && <span className="font-normal text-[10px] text-slate-400 ml-1.5">({u.name})</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {u.role === 'admin' ? '🛡️ Einsatzleitung' : '🚶 Suchkraft'} • {u.isActive ? '🟢 Bereit' : '⚪ Inaktiv'}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Externe & Freiwillige Helfer ohne App */}
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-amber-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <span>👥 Freiwillige Helfer & Externe Kräfte (ohne App):</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">z.B. Feuerwehr, Jagdpächter, Zivilpersonen</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div className="sm:col-span-1">
                  <label className="block text-slate-400 text-[10px] uppercase font-mono mb-1">
                    Anzahl Helfer:
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={externalVolunteersCount}
                    onChange={(e) => setExternalVolunteersCount(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-bold text-sm font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-slate-400 text-[10px] uppercase font-mono mb-1">
                    Organisationen / Zuordnung / Notiz:
                  </label>
                  <input
                    type="text"
                    value={externalVolunteersNotes}
                    onChange={(e) => setExternalVolunteersNotes(e.target.value)}
                    placeholder="z.B. 10 Kameraden FFW Aschersleben, 3 Jagdpächter, 5 Zivilhelfer"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic">
                ℹ️ Diese externen Kräfte werden lückenlos im Einsatzprotokoll und Stärkenachweis erfasst, ohne doppelt gezählt zu werden.
              </p>
            </div>
          </div>

          {/* Einsatzausrüstung & Hilfsmittel (Auswählbar & Editierbar) */}
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-slate-200 uppercase tracking-wider text-xs font-mono">
                  Einsatzmittel & Ausrüstung (Auswählbar & Editierbar)
                </span>
              </div>
              <span className="text-[10px] text-cyan-400 font-mono">
                {selectedEquipment.length} Einsatzmittel aktiv
              </span>
            </div>

            {/* Ausrüstung Pills Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AVAILABLE_EQUIPMENT.map((item) => {
                const isSelected = selectedEquipment.includes(item.type);
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      setSelectedEquipment((prev) =>
                        isSelected ? prev.filter((t) => t !== item.type) : [...prev, item.type]
                      );
                    }}
                    className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                      isSelected
                        ? 'bg-cyan-950/50 border-cyan-500/70 text-cyan-200 ring-1 ring-cyan-500/30 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-lg leading-none">{item.icon}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-xs truncate leading-snug">{item.label}</div>
                      <div className="text-[9px] text-slate-400 truncate font-mono">{item.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Freitext Notizen für Sonderausrüstung */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider font-mono">
                Zusätzliche Spezialausrüstung / Bemerkungen:
              </label>
              <input
                type="text"
                value={customEquipmentNotes}
                onChange={(e) => setCustomEquipmentNotes(e.target.value)}
                placeholder="z.B. 2x DJI Matrice 300 RTK mit Wärmebild, 1x Führungsfahrzeug EZ 1, 4x Handsprechfunkgeräte 2m"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-sans"
              />
            </div>

            {/* Wetterbedingungen bei Einsatzstart */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-slate-300 font-semibold text-[11px] uppercase tracking-wider font-mono flex items-center gap-1">
                  <Cloud className="w-3.5 h-3.5 text-blue-400" />
                  <span>Wetterbedingungen bei Einsatzstart:</span>
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      // Fetch coordinates of HQ or fallback to Vereinsbüro
                      const lat = Number(hqLat) || VEREINSBUERO_LOCATION.lat;
                      const lng = Number(hqLng) || VEREINSBUERO_LOCATION.lng;
                      const report = await fetchRescueWeather(lat, lng);
                      if (report && report.current) {
                        const cur = report.current;
                        const formatted = `${cur.weatherIcon} ${cur.weatherDescription}, ${cur.temperature}°C (Gefühlt: ${cur.apparentTemperature}°C), Wind: ${cur.windSpeed} km/h, Feuchte: ${cur.relativeHumidity}%`;
                        setWeatherConditions(formatted);
                      }
                    } catch (err) {
                      console.warn('Wetterabruf fehlgeschlagen', err);
                      setWeatherConditions('⛅ Heiter, ca. 16°C, mäßiger Wind');
                    }
                  }}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 border border-slate-700 rounded text-[9px] font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                  <span>Wetter live abrufen</span>
                </button>
              </div>
              <input
                type="text"
                value={weatherConditions}
                onChange={(e) => setWeatherConditions(e.target.value)}
                placeholder="z.B. 🌤️ Leicht bewölkt, 16°C, Wind 12 km/h aus Nordost"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-sans"
              />
            </div>
          </div>

          {/* EZ Admin Zuteilung (Muss-Admin) & Live User Monitor */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-blue-500/30 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-slate-200 uppercase tracking-wider text-xs font-mono">
                  EZ-Zuteilung & Ankunftsmonitor (Muss-Admin erforderlich)
                </span>
              </div>
              <span className="text-[10px] text-blue-400 font-mono">
                {ezAdminIds.length} EZ-Admin(s) zugeteilt
              </span>
            </div>

            {/* EZ Admins selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 font-mono uppercase">
                🛡️ EZ-Administratoren (Mindestens 1 Administrator muss zugeteilt werden):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allUsers.filter((u) => u.role === 'admin' || u.role === 'einsatzleitung').map((adminUser) => {
                  const isAssigned = ezAdminIds.includes(adminUser.id);
                  return (
                    <button
                      key={adminUser.id}
                      type="button"
                      onClick={() => {
                        setEzAdminIds((prev) =>
                          isAssigned
                            ? prev.filter((id) => id !== adminUser.id)
                            : [...prev, adminUser.id]
                        );
                      }}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                        isAssigned
                          ? 'bg-blue-950/50 border-blue-500 text-blue-100 ring-1 ring-blue-500/30'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                          {adminUser.photoUrl ? (
                            <img src={adminUser.photoUrl} alt={adminUser.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs font-bold text-blue-400">
                              {adminUser.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-200">{adminUser.callSign || adminUser.name}</div>
                          <div className="text-[10px] text-slate-400">{adminUser.name} • {adminUser.isActive ? '🟢 Online' : '⚪ Offline'}</div>
                        </div>
                      </div>
                      <div className="text-xs font-mono font-bold">
                        {isAssigned ? '✅ EZ aktiv' : 'Zuteilen'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>


          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-700 flex items-center justify-between gap-2">
            <div>
              {mode === 'edit' && targetOp && isAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const confirmed = window.confirm(
                        `🚨 Einsatz "${targetOp.title}" wirklich endgültig löschen?\n\nAlle Sektoren, Funde und Protokolle werden gelöscht.`
                      );
                      if (confirmed) {
                        deleteOperation(targetOp.id);
                        onClose();
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 transition cursor-pointer flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider"
                    title="Einsatz löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Löschen</span>
                  </button>

                  {onStartDrawingSector && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onStartDrawingSector();
                      }}
                      className="px-3 py-2 rounded-xl bg-purple-950/50 hover:bg-purple-900/70 text-purple-200 border border-purple-700/60 transition cursor-pointer flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider"
                      title="Suchgebiet / Sektor auf Karte einzeichnen"
                    >
                      <span>📐 Suchgebiet zeichnen</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer border border-slate-700 uppercase tracking-wider font-mono text-xs"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className={`px-6 py-2.5 rounded-xl text-white font-bold transition cursor-pointer flex items-center gap-2 shadow uppercase tracking-wider font-mono text-xs ${
                  mode === 'edit'
                    ? 'bg-blue-600 hover:bg-blue-500'
                    : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                {mode === 'edit' ? <Save className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span>{mode === 'edit' ? 'Änderungen speichern' : 'Einsatz initialisieren & starten'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
