import React, { useState, useEffect, useRef } from 'react';
import { useRescue } from '../context/RescueContext';
import { User, UserRole, EquipmentType, isFirstAdmin, isOwner } from '../types';
import { compressImageFile } from '../lib/imageUtils';
import {
  Users,
  Key,
  Shield,
  X,
  Save,
  Car,
  Phone,
  Camera,
  Radio,
  CheckCircle,
  Upload,
  Link as LinkIcon,
  Trash2,
  LogOut,
  AlertTriangle,
  Eye,
} from 'lucide-react';

interface UserManagementModalProps {
  userToEdit: User | null;
  isOpen: boolean;
  onClose: () => void;
}

const EQUIPMENT_OPTIONS: { id: EquipmentType; label: string; icon: string }[] = [
  { id: 'drone', label: 'Drohne / UAS Pilot', icon: '🚁' },
  { id: 'k9_mantrailer', label: 'K9 Mantrailer (Fährtenhund)', icon: '🐕' },
  { id: 'k9_area', label: 'K9 Flächensuchhund', icon: '🐾' },
  { id: 'k9_cadaver', label: 'K9 Leichenspürhund (HRD)', icon: '🐕‍🦺' },
  { id: 'quad', label: 'Quad / ATV Fahrer', icon: '🚜' },
  { id: 'boat', label: 'Boot / Wasserrettung', icon: '🚤' },
  { id: 'foot_search', label: 'Fußsuchtrupp (Suchkette)', icon: '🚶' },
  { id: 'flir', label: 'Wärmebild / FLIR Kamera', icon: '🌡️' },
  { id: 'first_aid', label: 'Sanitäter / Ersthelfer', icon: '🩹' },
];

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  userToEdit,
  isOpen,
  onClose,
}) => {
  const { createUser, updateUser, deleteUser, currentUser, allUsers, currentOperation, removeUserFromOperation, deactivateAllUsers } = useRescue();

  const [activeUser, setActiveUser] = useState<User | null>(userToEdit);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('sucher123');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('responder');
  const [isAlsoAdmin, setIsAlsoAdmin] = useState(false);
  const [callSign, setCallSign] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [phone, setPhone] = useState('');
  const [organization, setOrganization] = useState('Spürhunde-Salzlandkreis e.V.');
  const [photoUrl, setPhotoUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [equipment, setEquipment] = useState<EquipmentType[]>(['foot_search']);
  const [customEquipmentTags, setCustomEquipmentTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [customEquipmentNotes, setCustomEquipmentNotes] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const userFileInputRef = useRef<HTMLInputElement | null>(null);

  const populateForm = (user: User | null) => {
    setStatusMessage(null);
    setActiveUser(user);
    if (user) {
      setUsername(user.username);
      setPassword(user.password || 'sucher123');
      setName(user.name);
      setRole(user.role);
      setIsAlsoAdmin(Boolean(user.isAdmin || user.role === 'admin'));
      setCallSign(user.callSign);
      setLicensePlate(user.licensePlate || '');
      setPhone(user.phone || '');
      setOrganization(user.organization || 'Spürhunde-Salzlandkreis e.V.');
      setPhotoUrl(user.photoUrl || '');
      setEquipment(user.equipment || ['foot_search']);
      setCustomEquipmentTags(user.customEquipmentTags || []);
      setCustomEquipmentNotes(user.customEquipmentNotes || '');
    } else {
      setUsername('');
      setPassword('sucher123');
      setName('');
      setRole('responder');
      setIsAlsoAdmin(false);
      setCallSign('Sucher ' + Math.floor(10 + Math.random() * 90));
      setLicensePlate('SLK-' + Math.floor(100 + Math.random() * 900));
      setPhone('+49 170 ' + Math.floor(1000000 + Math.random() * 9000000));
      setOrganization('Spürhunde-Salzlandkreis e.V.');
      setPhotoUrl('');
      setEquipment(['k9_mantrailer']);
      setCustomEquipmentTags([]);
      setCustomEquipmentNotes('');
    }
    setShowUrlInput(false);
    setCustomUrl('');
  };

  useEffect(() => {
    populateForm(userToEdit);
  }, [userToEdit, isOpen]);

  if (!isOpen) return null;

  // Explicit admin-only guard clause
  if (currentUser?.role !== 'admin' && currentUser?.role !== 'einsatzleitung') {
    return (
      <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-sans">
        <div className="bg-[#1E293B] border border-red-500/50 rounded-2xl p-6 max-w-md text-center space-y-4 shadow-2xl text-slate-100">
          <div className="w-12 h-12 rounded-full bg-red-600/20 text-red-400 mx-auto flex items-center justify-center border border-red-500/40">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white uppercase tracking-wide">Zugriff verweigert (Admin-Bereich)</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Nur Administratoren und Einsatzleiter (Rolle: <span className="font-mono text-red-400 font-bold">admin</span> / <span className="font-mono text-blue-400 font-bold">einsatzleitung</span>) dürfen Einsatzkräfte verwalten, Accounts anlegen, Rollen zuweisen oder Profile löschen.
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const compressed = await compressImageFile(file, 280, 0.82);
      setPhotoUrl(compressed);
    } catch (err) {
      console.warn('Error compressing photo:', err);
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
    if (userFileInputRef.current) {
      userFileInputRef.current.value = '';
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

  const isTargetOwner = Boolean(activeUser && isFirstAdmin(activeUser));
  const isCurrentUserOwner = Boolean(currentUser && isFirstAdmin(currentUser));
  const isTargetOwnerProtected = Boolean(isTargetOwner && !isCurrentUserOwner);
  const isTargetOwnerAndMe = Boolean(isTargetOwner && isCurrentUserOwner);

  const handleDeleteUser = () => {
    setStatusMessage(null);
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'einsatzleitung') {
      setStatusMessage({ type: 'error', text: 'Aktion verweigert: Nur Administratoren dürfen Accounts löschen.' });
      return;
    }
    if (!activeUser) return;
    if (activeUser.id === currentUser?.id) {
      setStatusMessage({ type: 'error', text: 'Sie können Ihren eigenen aktuell aktiven Account nicht löschen.' });
      return;
    }
    if (isFirstAdmin(activeUser)) {
      setStatusMessage({ type: 'error', text: 'Aktion verweigert: Der First-Admin (Owner Maria) ist unantastbar und kann nicht gelöscht werden.' });
      return;
    }
    const confirmed = window.confirm(
      `Möchten Sie den Account von "${activeUser.name}" (${activeUser.callSign}) wirklich unwiderruflich löschen?`
    );
    if (confirmed) {
      deleteUser(activeUser.id);
      populateForm(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'einsatzleitung') {
      setStatusMessage({ type: 'error', text: 'Aktion verweigert: Nur Administratoren dürfen Accounts anlegen oder bearbeiten.' });
      return;
    }
    
    if (activeUser && isFirstAdmin(activeUser) && !isCurrentUserOwner) {
      setStatusMessage({ type: 'error', text: 'Aktion verweigert: Der First-Admin (Owner Maria) ist unantastbar und kann nur durch sich selbst bearbeitet werden.' });
      return;
    }

    if (!name.trim() || !username.trim()) {
      setStatusMessage({ type: 'error', text: 'Bitte füllen Sie Name und Benutzername aus.' });
      return;
    }

    const effectiveIsAdmin = role === 'admin' || isAlsoAdmin;
    const effectiveCanLead = role === 'einsatzleitung' || role === 'admin';

    if (activeUser) {
      updateUser(activeUser.id, {
        username: username.trim(),
        password: password.trim(),
        name: name.trim(),
        role,
        isAdmin: effectiveIsAdmin,
        canLeadOperations: effectiveCanLead,
        callSign: callSign.trim() || name.trim(),
        licensePlate: licensePlate.trim(),
        phone: phone.trim(),
        organization: organization.trim(),
        photoUrl,
        equipment,
        customEquipmentTags,
        customEquipmentNotes: customEquipmentNotes.trim(),
      });
    } else {
      createUser({
        username: username.trim(),
        password: password.trim(),
        name: name.trim(),
        role,
        isAdmin: effectiveIsAdmin,
        canLeadOperations: effectiveCanLead,
        callSign: callSign.trim() || name.trim(),
        licensePlate: licensePlate.trim(),
        phone: phone.trim(),
        organization: organization.trim(),
        photoUrl,
        equipment,
        customEquipmentTags,
        customEquipmentNotes: customEquipmentNotes.trim(),
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
            <div className="h-10 w-10 rounded-xl bg-slate-800 text-blue-400 border border-slate-700 flex items-center justify-center font-bold text-xl">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                {activeUser ? `Account bearbeiten: ${activeUser.name}` : 'Neuen Account anlegen & Zugangsdaten vergeben'}
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Einsatzleitung vergibt Logindaten, Funkrufnamen, KFZ und Hilfsmittel
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

        {/* Account Selector Bar for Admins */}
        <div className="bg-slate-950/60 p-2.5 border-b border-slate-700/80">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              👥 Account auswählen ({allUsers.length} registriert):
            </span>
            <button
              type="button"
              onClick={() => populateForm(null)}
              className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold font-mono transition cursor-pointer flex items-center gap-1 ${
                !activeUser
                  ? 'bg-blue-600 border-blue-400 text-white shadow'
                  : 'bg-slate-900 border-blue-500/40 text-blue-300 hover:bg-blue-900/40'
              }`}
            >
              <span>➕</span>
              <span>Neuen Account anlegen</span>
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              type="button"
              onClick={() => populateForm(null)}
              className={`px-2.5 py-1.5 rounded-xl border text-left transition shrink-0 cursor-pointer font-mono text-[11px] flex items-center gap-2 ${
                !activeUser
                  ? 'bg-blue-600/30 border-blue-400 text-white shadow ring-1 ring-blue-400'
                  : 'bg-slate-900 border-dashed border-blue-500/50 text-blue-300 hover:bg-slate-800'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-blue-600/40 text-blue-300 border border-blue-400/50 flex items-center justify-center font-bold text-xs">
                +
              </div>
              <div>
                <div className="font-bold">Neuer Account</div>
                <div className="text-[9px] text-slate-400 font-normal">Formular leeren</div>
              </div>
            </button>
            {allUsers.map((u) => {
              const isSelected = activeUser?.id === u.id;
              const isOwnerUser = isFirstAdmin(u);
              return (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => populateForm(u)}
                  className={`px-2.5 py-1.5 rounded-xl border text-left transition shrink-0 cursor-pointer font-mono text-[11px] flex items-center gap-2 ${
                    isSelected
                      ? isOwnerUser
                        ? 'bg-amber-500/25 border-amber-400 text-white shadow ring-1 ring-amber-400/50'
                        : 'bg-blue-500/25 border-blue-400 text-white shadow'
                      : isOwnerUser
                      ? 'bg-amber-950/40 border-amber-500/50 text-amber-200 hover:bg-amber-900/40'
                      : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] uppercase border ${
                    isOwnerUser
                      ? 'bg-amber-500/30 text-amber-200 border-amber-400/60'
                      : 'bg-slate-800 text-slate-200 border border-slate-600'
                  }`}>
                    {isOwnerUser ? '👑' : u.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold flex items-center gap-1">
                      <span>{u.name}</span>
                      {isOwnerUser ? (
                        <span className="text-[8px] px-1 py-0.2 rounded border font-mono font-bold bg-amber-500/20 text-amber-300 border-amber-400/60">
                          OWNER
                        </span>
                      ) : (u.role === 'admin' || u.role === 'einsatzleitung' || u.isAdmin) ? (
                        <span className={`text-[8px] px-1 py-0.2 rounded border font-mono font-bold ${
                          u.role === 'admin'
                            ? 'bg-red-950 text-red-300 border-red-800'
                            : u.isAdmin
                            ? 'bg-amber-950 text-amber-300 border-amber-800'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        }`}>
                          {u.role === 'admin' ? 'ADM' : u.isAdmin ? 'EL+ADM' : 'EL'}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[9px] text-slate-400 font-normal">
                      {u.callSign}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
          {/* Owner Protection Notification Banner */}
          {isTargetOwnerProtected && (
            <div className="p-3.5 rounded-xl bg-amber-950/80 border-2 border-amber-500/80 text-amber-200 text-xs font-mono flex items-start gap-3 shadow-lg">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0 text-base">
                👑
              </div>
              <div>
                <div className="font-bold text-amber-300 uppercase tracking-wide flex items-center gap-2">
                  <span>FIRST ADMIN & APP-OWNER (UNANTASTBAR)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/30 text-amber-200 border border-amber-400/60 font-bold">
                    Schreibgeschützt
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/90 mt-1 leading-relaxed">
                  Dieser Account gehört Maria (App-Owner). Als First Admin kann dieser Account von anderen Administratoren weder bearbeitet noch gelöscht werden. Nur Maria selbst darf ihren eigenen Account verwalten.
                </p>
              </div>
            </div>
          )}

          {isTargetOwnerAndMe && (
            <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/60 text-amber-200 text-xs font-mono flex items-start gap-3 shadow-md">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0 text-base">
                👑
              </div>
              <div>
                <div className="font-bold text-amber-300 uppercase tracking-wide flex items-center gap-2">
                  <span>DEIN FIRST-ADMIN ACCOUNT (APP-OWNER)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/30 text-amber-200 border border-amber-400/60 font-bold">
                    Unantastbar
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/90 mt-1 leading-relaxed">
                  Du bist als First Admin & App-Owner eingeloggt. Dein Account ist vor Eingriffen anderer Admins geschützt. Hier kannst du deine Zugangsdaten und Kontaktdaten pflegen.
                </p>
              </div>
            </div>
          )}

          {statusMessage && (
            <div
              className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                statusMessage.type === 'error'
                  ? 'bg-red-950/90 border-red-600 text-red-300'
                  : 'bg-emerald-950/90 border-emerald-600 text-emerald-300'
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Credentials Section */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-3 font-mono">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">
              🔑 ZUGANGSDATEN FÜR EINSATZKRAFT
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">Benutzername (Login) *:</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="z.B. drohne_nord"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">Passwort *:</label>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Passwort eingeben"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Personal Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1 font-mono uppercase tracking-wider">Vollständiger Name *:</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Martin Huber"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="col-span-1 sm:col-span-2 space-y-1.5">
              <label className="block font-bold text-slate-300 mb-1 font-mono uppercase tracking-wider text-[11px] flex items-center justify-between">
                <span>Rolle & Berechtigungsstufe im System *:</span>
                <span className="text-[10px] text-slate-400 font-normal">Admins können Rollen jederzeit vergeben & entziehen</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 font-mono">
                <button
                  type="button"
                  onClick={() => setRole('responder')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1 ${
                    role === 'responder'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-200 shadow-sm ring-1 ring-blue-500/40'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-xs text-white">
                    <span>🦺 Sucher</span>
                    {role === 'responder' && <span className="text-[10px] text-blue-400">✓ Aktiv</span>}
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    Standard-Suchkraft mit GPS, Fundmeldungen & Chat.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('einsatzleitung')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1 ${
                    role === 'einsatzleitung'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200 shadow-sm ring-1 ring-emerald-500/40'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-xs text-emerald-300">
                    <span>📢 Einsatzleitung</span>
                    {role === 'einsatzleitung' && <span className="text-[10px] text-emerald-400">✓ Aktiv</span>}
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    Führungsrolle: Sektoren & Teamkoordinierung.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1 ${
                    role === 'admin'
                      ? 'bg-red-600/25 border-red-500 text-red-200 shadow-sm ring-1 ring-red-500/50'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-xs text-red-300">
                    <span>🛡️ System-Admin</span>
                    {role === 'admin' && <span className="text-[10px] text-red-400">👑 Admin</span>}
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    Volle Rechte: Accounts, Rollen, System-Logs.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('observer')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1 ${
                    role === 'observer'
                      ? 'bg-purple-600/25 border-purple-500 text-purple-200 shadow-sm ring-1 ring-purple-500/50'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-xs text-purple-300">
                    <span>👁️ Betrachter</span>
                    {role === 'observer' && <span className="text-[10px] text-purple-400">✓ Aktiv</span>}
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    Nur Leseansicht (Polizei, Gast). Kein GPS auf Karte.
                  </span>
                </button>
              </div>

              {/* Role Combination Feature (EL + Admin) */}
              <div className="mt-3 p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0 mt-0.5">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200 flex items-center gap-2 flex-wrap">
                      <span>Administrator-Rechte mit Einsatzleitung kombinieren</span>
                      {role === 'einsatzleitung' && isAlsoAdmin && (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full">
                          Kombiniert: EL + Admin
                        </span>
                      )}
                      {role === 'einsatzleitung' && !isAlsoAdmin && (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full">
                          Nur Einsatzleitung (kein Admin)
                        </span>
                      )}
                      {role === 'admin' && (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/40 rounded-full">
                          Voll-Administrator
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      Erlaubt dieser Person zusätzlich Benutzerkonten anzulegen, Rollen zu verwalten und System-Logs einzusehen.
                      Nicht jeder Einsatzleiter ist automatisch System-Administrator.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={role === 'admin' || isAlsoAdmin}
                    disabled={role === 'admin'}
                    onChange={(e) => setIsAlsoAdmin(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600 peer-disabled:opacity-60"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Tactical Details: Callsign, License Plate, Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1 font-mono uppercase tracking-wider">Funkrufname:</label>
              <input
                type="text"
                value={callSign}
                onChange={(e) => setCallSign(e.target.value)}
                placeholder="z.B. Kater 4/1"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

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
              <label className="block font-bold text-slate-300 mb-1 font-mono uppercase tracking-wider">Telefonnummer:</label>
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
              placeholder="z.B. BRK Rettungshundestaffel, Feuerwehr Drohnenteam"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Equipment & Special Assets */}
          <div>
            <label className="block font-bold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
              Hilfsmittel & Spezialausstattung:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono">
              {EQUIPMENT_OPTIONS.map((eq) => {
                const isSelected = equipment.includes(eq.id);
                return (
                  <button
                    type="button"
                    key={eq.id}
                    onClick={() => toggleEquipment(eq.id)}
                    className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? 'bg-blue-500/20 border-blue-500 text-blue-200'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-base">{eq.icon}</span>
                    <span className="text-[10px] font-semibold leading-tight">{eq.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Equipment Tags */}
          <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700 space-y-2">
            <label className="block font-bold text-slate-300 uppercase tracking-wider font-mono text-[11px]">
              Individuelle Hilfsmittel (Freitext-Tags):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={handleAddCustomTag}
                placeholder="z.B. Leichenspürhund, Wasserortungshund, Wärmebild FLIR"
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
                Keine individuellen Tags hinterlegt.
              </p>
            )}
          </div>

          {/* Equipment details */}
          <div>
            <label className="block font-bold text-slate-300 mb-1 font-mono uppercase tracking-wider">
              Details zur Ausrüstung (z.B. Drohnenmodell, Hundename & Rasse):
            </label>
            <input
              type="text"
              value={customEquipmentNotes}
              onChange={(e) => setCustomEquipmentNotes(e.target.value)}
              placeholder="z.B. DJI Matrice 350 mit Wärmebildkamera, oder Suchhund 'Bella' (Mantrailer)"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          {/* Photo Avatar Picker with Upload */}
          <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-slate-300 uppercase tracking-wider font-mono text-[11px]">
                Profilfoto:
              </label>
              <span className="text-[10px] text-slate-400 font-mono">Eigenes Foto oder Initialen</span>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative group shrink-0">
                <div className="h-16 w-16 rounded-xl overflow-hidden border-2 border-blue-500 shadow-lg bg-slate-950 flex items-center justify-center">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={name || 'Avatar'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-blue-700 to-indigo-900 flex flex-col items-center justify-center text-white">
                      <span className="text-xl font-black font-mono">{name ? name.charAt(0).toUpperCase() : 'U'}</span>
                      <span className="text-[8px] font-mono text-blue-200">Kein Foto</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => userFileInputRef.current?.click()}
                  className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-blue-300 transition rounded-xl cursor-pointer"
                  title="Foto hochladen"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 space-y-2 w-full">
                <input
                  type="file"
                  ref={userFileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="user-mgmt-photo-upload"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="user-mgmt-photo-upload"
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition cursor-pointer flex items-center gap-1.5 font-mono text-[11px] shadow"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isCompressing ? 'Wird optimiert...' : 'Foto hochladen'}</span>
                  </label>

                  {photoUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="px-3 py-1.5 rounded-xl bg-red-950/70 hover:bg-red-900 text-red-300 font-bold transition cursor-pointer flex items-center gap-1.5 font-mono text-[11px] border border-red-800/60"
                      title="Foto entfernen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Foto löschen</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer flex items-center gap-1.5 font-mono text-[11px] border border-slate-700"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Bildlink</span>
                  </button>
                </div>

                {showUrlInput && (
                  <div className="flex items-center gap-2 mt-2">
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

          {/* Actions */}
          <div className="pt-3 border-t border-slate-700 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (confirm('Möchten Sie wirklich ALLE aktiven Benutzer (inkl. Admins) abmelden? Alle laufenden Sitzungen werden beendet.')) {
                    deactivateAllUsers(true);
                  }
                }}
                className="px-3 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 uppercase tracking-wider font-mono shadow"
                title="Meldet alle Benutzer (auch Sie selbst) vom System ab"
              >
                <LogOut className="w-3.5 h-3.5" />
                Alle abmelden
              </button>

              {activeUser && currentUser?.role === 'admin' && activeUser.id !== currentUser.id && !isFirstAdmin(activeUser) && (
                <>
                  {(currentOperation?.participantIds?.includes(activeUser.id) || activeUser.isActive) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            `Möchten Sie "${activeUser.name}" (${activeUser.callSign}) wirklich aus dem aktuellen Einsatz abmelden?\n\nDer Account und alle Zugangsdaten bleiben erhalten.`
                          )
                        ) {
                          removeUserFromOperation(activeUser.id);
                          onClose();
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 hover:text-white font-bold transition cursor-pointer border border-amber-800/80 flex items-center gap-1.5 uppercase tracking-wider font-mono text-xs shadow"
                      title="Benutzer aus dem aktuellen Einsatz abmelden (Account bleibt in Datenbank)"
                    >
                      <LogOut className="w-3.5 h-3.5 text-amber-400" />
                      <span>Aus Einsatz entfernen</span>
                    </button>
                  )}

                  <details className="relative group">
                    <summary className="list-none px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-700 transition cursor-pointer text-xs font-mono flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Gefahrenzone: Löschen...</span>
                    </summary>
                    <div className="absolute bottom-full left-0 mb-2 p-3 bg-slate-900 border border-red-500/80 rounded-xl shadow-2xl z-20 w-64 text-xs font-mono space-y-2">
                      <div className="text-red-300 font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>Account unwiderruflich löschen</span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Dies löscht den Account komplett aus der Datenbank. Wenn Sie die Person nur aus dem Einsatz abmelden wollen, nutzen Sie stattdessen &quot;Aus Einsatz entfernen&quot;.
                      </p>
                      <button
                        type="button"
                        onClick={handleDeleteUser}
                        className="w-full py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition cursor-pointer text-center text-xs uppercase"
                      >
                        Ja, Account löschen
                      </button>
                    </div>
                  </details>
                </>
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
                disabled={isTargetOwnerProtected}
                className={`px-5 py-2 rounded-xl text-white font-bold transition flex items-center gap-1.5 shadow uppercase tracking-wider font-mono text-xs ${
                  isTargetOwnerProtected
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed border border-slate-600'
                    : 'bg-blue-600 hover:bg-blue-500 cursor-pointer'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                {isTargetOwnerProtected
                  ? 'Schreibgeschützt (Owner)'
                  : activeUser
                  ? 'Änderungen speichern'
                  : 'Account anlegen'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
