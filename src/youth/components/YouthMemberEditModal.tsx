import React, { useState, useRef } from 'react';
import { YouthUser, YouthAddress, YouthEmergencyContacts } from '../types';
import {
  X,
  Camera,
  Upload,
  User,
  Heart,
  Phone,
  MapPin,
  Calendar,
  Waves,
  Shield,
  Save,
  Trash2,
  Sparkles,
} from 'lucide-react';

interface YouthMemberEditModalProps {
  member: YouthUser | null; // null = neu anlegen, sonst bearbeiten
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: Partial<YouthUser> & { id?: string }) => void;
  isSelfEdit?: boolean; // Wenn das Kind sein eigenes Profil bearbeitet (kein Löschen erlaubt!)
}

export const YouthMemberEditModal: React.FC<YouthMemberEditModalProps> = ({
  member,
  isOpen,
  onClose,
  onSave,
  isSelfEdit = false,
}) => {
  const isEditing = Boolean(member);

  // Form State
  const [name, setName] = useState(member?.name || '');
  const [username, setUsername] = useState(member?.username || '');
  const [pin, setPin] = useState(member?.pin || '1234');
  const [age, setAge] = useState<number>(member?.age || 14);
  const [birthDate, setBirthDate] = useState(member?.birthDate || '');
  const [callSign, setCallSign] = useState(member?.callSign || '');
  const [phone, setPhone] = useState(member?.phone || '');
  const [memberCardCode, setMemberCardCode] = useState(
    member?.memberCardCode || `SHS-Y-${Math.floor(100 + Math.random() * 900)}`
  );
  const [trackColor, setTrackColor] = useState(member?.trackColor || '#38bdf8');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(member?.photoUrl);

  // Address
  const [street, setStreet] = useState(member?.address?.street || '');
  const [zip, setZip] = useState(member?.address?.zip || '');
  const [city, setCity] = useState(member?.address?.city || '');

  // Emergency / Parents
  const [motherName, setMotherName] = useState(member?.guardianContacts?.motherName || '');
  const [motherPhone, setMotherPhone] = useState(
    member?.guardianContacts?.motherPhone || member?.guardianContact || ''
  );
  const [fatherName, setFatherName] = useState(member?.guardianContacts?.fatherName || '');
  const [fatherPhone, setFatherPhone] = useState(member?.guardianContacts?.fatherPhone || '');

  // Health / Welfare
  const [allergies, setAllergies] = useState(member?.allergies || '');
  const [medications, setMedications] = useState(member?.medications || '');
  const [tetanusVaccinated, setTetanusVaccinated] = useState(
    member?.tetanusVaccinated !== undefined ? member.tetanusVaccinated : true
  );
  const [isSwimmer, setIsSwimmer] = useState(
    member?.isSwimmer !== undefined ? member.isSwimmer : true
  );
  const [swimmingBadge, setSwimmingBadge] = useState(member?.swimmingBadge || 'Bronze');
  const [dietaryNotes, setDietaryNotes] = useState(member?.dietaryNotes || '');
  const [notes, setNotes] = useState(member?.notes || '');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Photo File Upload / Camera capture
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const calculatedUsername = username.trim() || name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const calculatedCallSign = callSign.trim() || `Jungspürer ${name.split(' ')[0]}`;

    const address: YouthAddress = {
      street: street.trim(),
      zip: zip.trim(),
      city: city.trim(),
    };

    const guardianContacts: YouthEmergencyContacts = {
      motherName: motherName.trim(),
      motherPhone: motherPhone.trim(),
      fatherName: fatherName.trim(),
      fatherPhone: fatherPhone.trim(),
    };

    // Primary guardian contact string fallback
    const primaryContact = motherPhone.trim() || fatherPhone.trim() || member?.guardianContact || '';

    const payload: Partial<YouthUser> & { id?: string } = {
      ...(member ? { id: member.id } : {}),
      name: name.trim(),
      username: calculatedUsername,
      pin: pin.trim() || '1234',
      age: Number(age) || 14,
      birthDate: birthDate || undefined,
      callSign: calculatedCallSign,
      phone: phone.trim() || undefined,
      memberCardCode: memberCardCode.trim(),
      trackColor,
      photoUrl,
      address,
      guardianContact: primaryContact,
      guardianContacts,
      allergies: allergies.trim() || undefined,
      medications: medications.trim() || undefined,
      tetanusVaccinated,
      isSwimmer,
      swimmingBadge: swimmingBadge.trim() || undefined,
      dietaryNotes: dietaryNotes.trim() || undefined,
      notes: notes.trim() || undefined,
      role: 'youth_member',
      team: 'jugend',
      isActive: member?.isActive || false,
    };

    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#000E66] border border-cyan-400/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-900 bg-[#00083D]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-500/30">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                {isSelfEdit
                  ? 'Mein eigenes Profil bearbeiten'
                  : isEditing
                  ? `Jugend-Profil: ${member?.name}`
                  : 'Neues Jugend-Mitglied aufnehmen'}
              </h3>
              <p className="text-[11px] text-cyan-300 font-mono">
                {isSelfEdit
                  ? 'Profilfoto ändern, PIN festlegen & Notfalldaten pflegen'
                  : 'Stammdaten, Notfallkontakte & Gesundheits-Check für Zeltlager'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {/* SECTION 1: PHOTO & BASIC DATA */}
          <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start p-4 rounded-2xl bg-[#00083D] border border-blue-900">
            {/* Photo Avatar */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-blue-950 border-2 border-cyan-400 shadow-md flex items-center justify-center group">
                {photoUrl ? (
                  <img src={photoUrl} alt="Profil" className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center font-bold text-white text-2xl"
                    style={{ backgroundColor: trackColor }}
                  >
                    {name ? name.charAt(0).toUpperCase() : '?'}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-cyan-300 transition text-[10px] font-mono"
                >
                  <Camera className="w-5 h-5 mb-1" />
                  <span>Foto ändern</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[10px] font-mono text-cyan-300 hover:text-white bg-blue-900/60 px-2 py-0.5 rounded border border-blue-700"
                >
                  Foto hochladen
                </button>
                {photoUrl && (
                  <button
                    type="button"
                    onClick={() => setPhotoUrl(undefined)}
                    className="text-[10px] font-mono text-rose-300 hover:text-rose-100 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800"
                    title="Foto entfernen"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Basic Info Inputs */}
            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Vor- &amp; Nachname *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z.B. Felix Müller"
                  className="w-full px-3 py-2 rounded-xl bg-[#000E66] border border-blue-800 text-white font-medium focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Funkrufname *
                </label>
                <input
                  type="text"
                  value={callSign}
                  onChange={(e) => setCallSign(e.target.value)}
                  placeholder="z.B. Jungspürer Felix"
                  className="w-full px-3 py-2 rounded-xl bg-[#000E66] border border-blue-800 text-white font-mono focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-cyan-400" />
                  <span>Geburtsdatum</span>
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => {
                    setBirthDate(e.target.value);
                    if (e.target.value) {
                      const birth = new Date(e.target.value);
                      const now = new Date();
                      let diff = now.getFullYear() - birth.getFullYear();
                      if (
                        now.getMonth() < birth.getMonth() ||
                        (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
                      ) {
                        diff--;
                      }
                      if (diff > 0 && diff < 19) setAge(diff);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#000E66] border border-blue-800 text-white font-mono focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Alter (Jahre)
                </label>
                <input
                  type="number"
                  min={6}
                  max={17}
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#000E66] border border-blue-800 text-white font-mono focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Login-PIN (4 Ziffern)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#000E66] border border-blue-800 text-amber-300 font-mono font-bold focus:border-cyan-400 focus:outline-none tracking-widest text-center"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Ausweis-Barcode-Code
                </label>
                <input
                  type="text"
                  value={memberCardCode}
                  onChange={(e) => setMemberCardCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#000E66] border border-blue-800 text-cyan-300 font-mono focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Eigene Handynummer des Kindes
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+49 17x xxxxxx"
                  className="w-full px-3 py-2 rounded-xl bg-[#000E66] border border-blue-800 text-white font-mono focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  GPS-Kartenfarbe
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={trackColor}
                    onChange={(e) => setTrackColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-blue-700 cursor-pointer bg-transparent"
                  />
                  <span className="text-xs font-mono text-slate-400">{trackColor}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: ADRESSE */}
          <div className="p-4 rounded-2xl bg-[#00083D] border border-blue-900 space-y-3 text-xs">
            <h4 className="font-bold text-white uppercase font-mono flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-400" />
              <span>Wohnanschrift</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[10px] text-slate-400 mb-1">Straße &amp; Hausnummer</label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Musterstr. 12"
                  className="w-full px-3 py-2 rounded-xl bg-[#000E66] border border-blue-800 text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-1 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">PLZ &amp; Ort</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      placeholder="06406"
                      className="w-20 px-2 py-2 rounded-xl bg-[#000E66] border border-blue-800 text-white font-mono text-center focus:border-cyan-400 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Bernburg"
                      className="flex-1 px-3 py-2 rounded-xl bg-[#000E66] border border-blue-800 text-white focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: ERZIEHUNGSBERECHTIGTE / NOTFALLKONTAKTE */}
          <div className="p-4 rounded-2xl bg-[#00083D] border border-blue-900 space-y-3 text-xs">
            <h4 className="font-bold text-white uppercase font-mono flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-400" />
              <span>Erziehungsberechtigte &amp; Notfallkontakte</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[#000E66] border border-blue-800/80 space-y-2">
                <span className="font-bold text-emerald-300 block text-[11px]">👩 Mutter / Erziehungsberechtigte</span>
                <div>
                  <input
                    type="text"
                    value={motherName}
                    onChange={(e) => setMotherName(e.target.value)}
                    placeholder="Name der Mutter"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#00083D] border border-blue-900 text-white focus:outline-none focus:border-emerald-400 mb-1.5"
                  />
                  <input
                    type="tel"
                    value={motherPhone}
                    onChange={(e) => setMotherPhone(e.target.value)}
                    placeholder="Notfallnummer Mutter (+49 ...)"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#00083D] border border-blue-900 text-emerald-300 font-mono focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#000E66] border border-blue-800/80 space-y-2">
                <span className="font-bold text-emerald-300 block text-[11px]">👨 Vater / Erziehungsberechtigter</span>
                <div>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    placeholder="Name des Vaters"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#00083D] border border-blue-900 text-white focus:outline-none focus:border-emerald-400 mb-1.5"
                  />
                  <input
                    type="tel"
                    value={fatherPhone}
                    onChange={(e) => setFatherPhone(e.target.value)}
                    placeholder="Notfallnummer Vater (+49 ...)"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#00083D] border border-blue-900 text-emerald-300 font-mono focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: GESUNDHEIT, ZELTLAGER & MEDIZINISCHES */}
          <div className="p-4 rounded-2xl bg-[#00083D] border border-blue-900 space-y-3 text-xs">
            <h4 className="font-bold text-white uppercase font-mono flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-400" />
              <span>Gesundheit &amp; Zeltlager-Informationen</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-rose-300 font-bold mb-1">
                  ⚠️ Bekannte Allergien / Unverträglichkeiten
                </label>
                <textarea
                  rows={2}
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="z.B. Wespen-/Bienenstich-Allergie (Notfallpen vorhanden), Pollen, Nüsse..."
                  className="w-full px-3 py-2 rounded-xl bg-[#000E66] border border-rose-900/60 text-white focus:border-rose-400 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-amber-300 font-bold mb-1">
                  💊 Regelmäßige Medikamente
                </label>
                <textarea
                  rows={2}
                  value={medications}
                  onChange={(e) => setMedications(e.target.value)}
                  placeholder="z.B. Asthma-Spray bei Bedarf, Tabletteneinnahme morgens..."
                  className="w-full px-3 py-2 rounded-xl bg-[#000E66] border border-amber-900/60 text-white focus:border-amber-400 focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* Checks: Schwimmer, Tetanus */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#000E66] border border-blue-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSwimmer}
                  onChange={(e) => setIsSwimmer(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-500 focus:ring-0"
                />
                <div>
                  <span className="font-bold text-white block text-xs flex items-center gap-1">
                    <Waves className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Schwimmer</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {isSwimmer ? 'Darf ins Wasser / Boot' : 'Nichtschwimmer (Aufsicht!)'}
                  </span>
                </div>
              </label>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Schwimmabzeichen</label>
                <select
                  value={swimmingBadge}
                  onChange={(e) => setSwimmingBadge(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#000E66] border border-blue-800 text-white font-mono focus:border-cyan-400 focus:outline-none"
                >
                  <option value="Kein Abzeichen">Kein Abzeichen</option>
                  <option value="Seepferdchen">Seepferdchen</option>
                  <option value="Bronze">Freischwimmer (Bronze)</option>
                  <option value="Silber">Silber</option>
                  <option value="Gold">Gold</option>
                  <option value="Rettungsschwimmer">Junior-Rettungsschwimmer</option>
                </select>
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#000E66] border border-blue-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tetanusVaccinated}
                  onChange={(e) => setTetanusVaccinated(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-0"
                />
                <div>
                  <span className="font-bold text-white block text-xs flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tetanus-Schutz</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {tetanusVaccinated ? 'Aktuell geimpft' : '⚠️ Impfung prüfen!'}
                  </span>
                </div>
              </label>
            </div>

            {/* Zeltlager Ernährung & Notizen */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  🥗 Verpflegung / Essensbesonderheiten (Zeltlager)
                </label>
                <input
                  type="text"
                  value={dietaryNotes}
                  onChange={(e) => setDietaryNotes(e.target.value)}
                  placeholder="z.B. vegetarisch, kein Schweinefleisch, laktosefrei..."
                  className="w-full px-3 py-2 rounded-xl bg-[#000E66] border border-blue-800 text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  📝 Sonstige Anmerkungen der Jugendleitung
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="z.B. Besitzt eigenen Kompass, übt gerne K9-Spur..."
                  className="w-full px-3 py-2 rounded-xl bg-[#000E66] border border-blue-800 text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-blue-900">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs uppercase transition cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs uppercase flex items-center gap-2 transition cursor-pointer shadow-lg"
            >
              <Save className="w-4 h-4" />
              <span>{isEditing ? 'Änderungen speichern' : 'Mitglied aufnehmen'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
