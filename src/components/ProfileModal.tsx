import React, { useState, useEffect, useRef } from 'react';
import { useRescue } from '../context/RescueContext';
import { EquipmentType, isFirstAdmin } from '../types';
import { compressImageFile } from '../lib/imageUtils';
import {
  User,
  X,
  Save,
  Car,
  Phone,
  Radio,
  Camera,
  Upload,
  CheckCircle,
  Battery,
  Shield,
  Link as LinkIcon,
  Trash2,
  Lock,
  Key,
  Eye,
  EyeOff,
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EQUIPMENT_OPTIONS: { id: EquipmentType; label: string; icon: string }[] = [
  { id: 'drone', label: 'Drohne / UAS', icon: '🚁' },
  { id: 'k9_mantrailer', label: 'K9 Mantrailer (Fährtenhund)', icon: '🐕' },
  { id: 'k9_area', label: 'K9 Flächensuchhund', icon: '🐾' },
  { id: 'k9_cadaver', label: 'K9 Leichenspürhund (HRD)', icon: '🐕‍🦺' },
  { id: 'quad', label: 'Quad / ATV Gelände', icon: '🚜' },
  { id: 'boat', label: 'Boot / Wasserrettung', icon: '🚤' },
  { id: 'foot_search', label: 'Fußsuchtrupp', icon: '🚶' },
  { id: 'flir', label: 'Wärmebildkamera', icon: '🌡️' },
  { id: 'first_aid', label: 'Sanitätsausrüstung', icon: '🩹' },
];

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, updateUser } = useRescue();

  const [name, setName] = useState('');
  const [callSign, setCallSign] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [phone, setPhone] = useState('');
  const [organization, setOrganization] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [equipment, setEquipment] = useState<EquipmentType[]>([]);
  const [customEquipmentTags, setCustomEquipmentTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [customEquipmentNotes, setCustomEquipmentNotes] = useState('');
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [batteryCharging, setBatteryCharging] = useState<boolean>(false);
  const [hasHardwareBattery, setHasHardwareBattery] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Security & Password / PIN State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const lastUserIdRef = useRef<string | null>(null);
  const prevIsOpenRef = useRef<boolean>(false);

  useEffect(() => {
    const isOpening = isOpen && !prevIsOpenRef.current;
    const isUserIdChanged = currentUser?.id !== lastUserIdRef.current;

    if (isOpening || isUserIdChanged) {
      if (currentUser) {
        setName(currentUser.name || '');
        setCallSign(currentUser.callSign || '');
        setLicensePlate(currentUser.licensePlate || '');
        setPhone(currentUser.phone || '');
        setOrganization(currentUser.organization || '');
        setPhotoUrl(currentUser.photoUrl || '');
        setEquipment(currentUser.equipment || ['foot_search']);
        setCustomEquipmentTags(currentUser.customEquipmentTags || []);
        setCustomEquipmentNotes(currentUser.customEquipmentNotes || '');
        setBatteryLevel(currentUser.batteryLevel ?? 100);
        setBatteryCharging(Boolean(currentUser.batteryCharging));
        setShowUrlInput(false);
        setCustomUrl('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordChange(false);
        setPasswordError('');
      }
      lastUserIdRef.current = currentUser?.id ?? null;
    }
    prevIsOpenRef.current = isOpen;
  }, [currentUser?.id, isOpen]);

  // Query hardware battery status
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any)
        .getBattery()
        .then((battery: any) => {
          setHasHardwareBattery(true);
          const update = () => {
            const lvl = Math.round((battery.level || 1) * 100);
            setBatteryLevel(lvl);
            setBatteryCharging(Boolean(battery.charging));
          };
          update();
          battery.addEventListener('levelchange', update);
          battery.addEventListener('chargingchange', update);
        })
        .catch(() => {
          setHasHardwareBattery(false);
        });
    }
  }, []);

  if (!isOpen || !currentUser) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      // Auto compress to lightweight base64 so it easily persists in Firestore without size limit errors
      const compressedDataUrl = await compressImageFile(file, 280, 0.82);
      setPhotoUrl(compressedDataUrl);
    } catch (err) {
      console.warn('Error compressing profile image:', err);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrl.trim()) {
      setPhotoUrl(customUrl.trim());
      setShowUrlInput(false);
      setCustomUrl('');
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleEquipment = (eq: EquipmentType) => {
    setEquipment((prev) =>
      prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]
    );
  };

  const handleAddCustomTag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const tag = newTagInput.trim();
    if (tag && !customEquipmentTags.includes(tag)) {
      setCustomEquipmentTags([...customEquipmentTags, tag]);
      setNewTagInput('');
    }
  };

  const handleRemoveCustomTag = (tagToRemove: string) => {
    setCustomEquipmentTags(customEquipmentTags.filter((t) => t !== tagToRemove));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.trim()) {
      if (newPassword.trim().length < 4) {
        setPasswordError('Das Kennwort / die PIN muss mindestens 4 Zeichen lang sein.');
        return;
      }
      if (newPassword.trim() !== confirmPassword.trim()) {
        setPasswordError('Die Kennwörter stimmen nicht überein.');
        return;
      }
    }

    updateUser(currentUser.id, {
      name: name.trim(),
      callSign: callSign.trim() || name.trim(),
      licensePlate: licensePlate.trim(),
      phone: phone.trim(),
      organization: organization.trim(),
      photoUrl: photoUrl.trim(),
      equipment,
      customEquipmentTags,
      customEquipmentNotes: customEquipmentNotes.trim(),
      batteryLevel,
      batteryCharging,
      ...(newPassword.trim() ? { password: newPassword.trim() } : {}),
    });

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto font-sans">
      <div className="bg-[#1E293B] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-xl text-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900/90 p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-800 text-blue-400 border border-slate-700 flex items-center justify-center font-bold text-xl">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white uppercase tracking-wide">Mein Einsatzprofil & Daten</h2>
                {isFirstAdmin(currentUser) && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold flex items-center gap-1">
                    <span>👑</span>
                    <span>First Admin / App-Owner</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono">
                {isFirstAdmin(currentUser)
                  ? 'Du bist der unantastbare App-Owner. Nur du kannst dein eigenes Profil und deine Rechte ändern.'
                  : 'Diese Angaben werden auf der Lagekarte für die Einsatzleitung angezeigt'}
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

        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          {savedSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500 text-emerald-300 font-bold flex items-center gap-2 font-mono">
              <CheckCircle className="w-4 h-4" />
              <span>Profil erfolgreich aktualisiert & gespeichert!</span>
            </div>
          )}

          {/* Photo selection with Custom Upload and Camera */}
          <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-slate-300 uppercase tracking-wider font-mono text-[11px]">
                Profilfoto:
              </label>
              <span className="text-[10px] text-slate-400 font-mono">Eigenes Foto hochladen oder initiales Symbol</span>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Active Photo or Clean Initials Badge */}
              <div className="relative group shrink-0">
                <div className="h-20 w-20 rounded-2xl overflow-hidden border-2 border-blue-500 shadow-xl bg-slate-950 flex items-center justify-center">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-blue-700 to-indigo-900 flex flex-col items-center justify-center text-white">
                      <span className="text-2xl font-black font-mono">{name ? name.charAt(0).toUpperCase() : 'M'}</span>
                      <span className="text-[9px] font-mono text-blue-200 mt-0.5 font-semibold">Kein Foto</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-slate-950/75 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-blue-300 transition rounded-2xl cursor-pointer"
                  title="Neues Foto aufnehmen / hochladen"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-[9px] font-mono mt-1 font-bold">Ändern</span>
                </button>
              </div>

              {/* Upload Controls */}
              <div className="flex-1 space-y-2 w-full">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="profile-photo-upload"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="profile-photo-upload"
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition cursor-pointer flex items-center gap-1.5 font-mono text-[11px] shadow"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isCompressing ? 'Wird optimiert...' : 'Foto aufnehmen / hochladen'}</span>
                  </label>

                  {photoUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="px-3 py-2 rounded-xl bg-red-950/70 hover:bg-red-900 text-red-300 font-bold transition cursor-pointer flex items-center gap-1.5 font-mono text-[11px] border border-red-800/60"
                      title="Foto entfernen und Initialen verwenden"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Foto entfernen</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer flex items-center gap-1.5 font-mono text-[11px] border border-slate-700"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Bildlink</span>
                  </button>
                </div>

                {showUrlInput && (
                  <div className="flex items-center gap-2 mt-2 animate-in fade-in duration-150">
                    <input
                      type="url"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://... (Bildlink)"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCustomUrl}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-xs cursor-pointer"
                    >
                      OK
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Name & Funkrufname */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1 font-mono uppercase tracking-wider">Mein Name *:</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1 font-mono uppercase tracking-wider">Funkrufname (Callsign):</label>
              <input
                type="text"
                value={callSign}
                onChange={(e) => setCallSign(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {/* License plate & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1 font-mono uppercase tracking-wider">KFZ-Kennzeichen:</label>
              <input
                type="text"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                placeholder="z.B. M-RD 112"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1 font-mono uppercase tracking-wider">Mobiltelefon:</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+49 171 1234567"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1 font-mono uppercase tracking-wider">Organisation / Staffel:</label>
            <input
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Equipment Selection */}
          <div>
            <label className="block font-bold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
              Meine Ausrüstung & Hilfsmittel (wird auf Karten-Pin vermerkt):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EQUIPMENT_OPTIONS.map((eq) => {
                const isSelected = equipment.includes(eq.id);
                return (
                  <button
                    type="button"
                    key={eq.id}
                    onClick={() => toggleEquipment(eq.id)}
                    className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center gap-1.5 font-mono ${
                      isSelected
                        ? 'bg-blue-500/20 border-blue-500 text-blue-200'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{eq.icon}</span>
                    <span className="text-[10px] font-semibold">{eq.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Equipment Tags (Individuelle Hilfsmittel) */}
          <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700 space-y-2">
            <label className="block font-bold text-slate-300 uppercase tracking-wider font-mono text-[11px]">
              Individuelle Hilfsmittel / Spezialausrüstung (Freitext-Tags):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={handleAddCustomTag}
                placeholder="z.B. Leichenspürhund, Wasserortung, FLIR XT2, etc."
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={handleAddCustomTag}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs font-mono transition cursor-pointer"
              >
                + Hinzufügen
              </button>
            </div>

            {customEquipmentTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {customEquipmentTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/80 border border-blue-600/50 text-blue-200 text-xs font-mono"
                  >
                    <span>🦮 {tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomTag(tag)}
                      className="hover:text-red-400 text-slate-400 ml-0.5 cursor-pointer"
                      title="Entfernen"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-500 font-mono italic">
                Keine individuellen Tags definiert. Tippen Sie ein Hilfsmittel ein und drücken Sie Enter.
              </p>
            )}
          </div>

          {/* Equipment Notes */}
          <div>
            <label className="block font-bold text-slate-300 mb-1 font-mono uppercase tracking-wider">
              Zusätzliche Notizen zur Ausrüstung:
            </label>
            <input
              type="text"
              value={customEquipmentNotes}
              onChange={(e) => setCustomEquipmentNotes(e.target.value)}
              placeholder="z.B. Hundeführerin mit 2x K9 Kadaverspürhund & Funkgerät"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          {/* Real Device Battery Status & Telemetry */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-700 space-y-2 font-mono">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Battery className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                  Geräte-Akkustand (Lagekarte & Leitstelle):
                </span>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                batteryLevel > 40
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : batteryLevel > 15
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : 'bg-red-950 text-red-300 border border-red-800'
              }`}>
                {batteryLevel}% {batteryCharging ? '⚡ (Wird geladen)' : '🔋'}
              </span>
            </div>

            {hasHardwareBattery ? (
              <p className="text-[10px] text-emerald-400">
                ✅ Live-Hardware-Akkustand wird automatisch über Ihren Browser/Smartphone abgefragt.
              </p>
            ) : (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Aktuellen Akkustand des Handys/Geräts anpassen:</span>
                  <span className="font-bold text-slate-200">{batteryLevel}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={batteryLevel}
                  onChange={(e) => setBatteryLevel(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <p className="text-[10px] text-slate-500 italic">
                  Tipp: Passen Sie den Schieberegler an Ihren tatsächlichen Smartphone-Akkustand an.
                </p>
              </div>
            )}
          </div>

          {/* Security & Password / PIN Settings */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-700 space-y-2.5 font-mono">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                  Zugangssicherheit & Persönliche PIN / Kennwort:
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordChange(!showPasswordChange);
                  setPasswordError('');
                }}
                className="text-[11px] text-blue-400 hover:text-blue-300 underline font-bold cursor-pointer"
              >
                {showPasswordChange ? 'Abbrechen' : 'Kennwort / PIN ändern'}
              </button>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              Schütze deinen Zugang vor unbefugter Nutzung durch andere Helfer. Mit deinem eigenen Kennwort oder einer 4-stelligen PIN kann sich niemand sonst unter deinem Namen anmelden.
            </p>

            {showPasswordChange && (
              <div className="pt-2 border-t border-slate-800 space-y-2.5">
                {passwordError && (
                  <div className="p-2 rounded-lg bg-red-950/80 border border-red-700 text-red-300 text-[11px]">
                    {passwordError}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="block text-[10px] text-slate-300 uppercase tracking-wider font-bold">
                      Neues Kennwort / PIN (mind. 4 Zeichen):
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Neues Kennwort..."
                        className="w-full px-3 py-1.5 pr-8 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-200"
                      >
                        {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] text-slate-300 uppercase tracking-wider font-bold">
                      Kennwort bestätigen:
                    </label>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Wiederholen..."
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>
                <div className="text-[10px] text-amber-400/90 italic">
                  Hinweis: Wird beim Klick auf "Profil speichern" übernommen.
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-700 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer border border-slate-700 uppercase tracking-wider font-mono text-xs"
            >
              Schließen
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition cursor-pointer flex items-center gap-1.5 shadow uppercase tracking-wider font-mono text-xs"
            >
              <Save className="w-3.5 h-3.5" />
              Profil speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
