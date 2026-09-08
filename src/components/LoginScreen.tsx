import React, { useState, useEffect, useMemo } from 'react';
import { useRescue } from '../context/RescueContext';
import { User, EquipmentType, UserRole } from '../types';
import {
  Shield,
  User as UserIcon,
  Key,
  Compass,
  Radio,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  UserPlus,
  Car,
  Phone,
  Dog,
  ArrowRight,
  Info,
  Check,
  Lock,
  ChevronDown,
  ChevronUp,
  Search,
  Smartphone,
  RotateCcw,
  X,
  Clock,
  ShieldCheck,
  Users,
} from 'lucide-react';

const STORAGE_KEY_REMEMBERED_DEVICE = 'rescue_app_remembered_device_user_id_slk_v4';

const EQUIPMENT_OPTIONS: { id: EquipmentType; label: string; icon: string }[] = [
  { id: 'foot_search', label: 'Fußsucher', icon: '🚶' },
  { id: 'k9_area', label: 'Flächensuchhund', icon: '🐕' },
  { id: 'k9_mantrailer', label: 'Mantrailer', icon: '🐾' },
  { id: 'drone', label: 'Drohne', icon: '🚁' },
  { id: 'first_aid', label: 'Ersthelfer', icon: '🩹' },
  { id: 'flir', label: 'Wärmebild', icon: '🎯' },
];

export const LoginScreen: React.FC = () => {
  const {
    allUsers,
    login,
    createUser,
    updateUser,
    authNotification,
    clearAuthNotification,
    allOperations,
    setCurrentOperationId,
    updateOperation,
    setUserActiveStatus,
    isOperationActive,
    startTrackingTest,
  } = useRescue();

  const activeOperations = useMemo(() => {
    return allOperations.filter((op) => op.status === 'active' || op.status === 'paused');
  }, [allOperations]);

  // Selected active operation when there are multiple
  const [selectedOperationId, setSelectedOperationId] = useState<string>('');

  // Set default selected operation ID when activeOperations is loaded
  useEffect(() => {
    if (activeOperations.length > 0 && !selectedOperationId) {
      setSelectedOperationId(activeOperations[0].id);
    }
  }, [activeOperations, selectedOperationId]);

  // Device-level saved profile (personal smartphone / tablet)
  const [rememberedUserId, setRememberedUserId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_REMEMBERED_DEVICE) || '';
    } catch {
      return '';
    }
  });

  const rememberedUser = useMemo(() => {
    return rememberedUserId ? allUsers.find((u) => u.id === rememberedUserId) || null : null;
  }, [allUsers, rememberedUserId]);

  // Mode within login: 'device_unlock' (if device is remembered) or 'direct' (manual input)
  const [loginMode, setLoginMode] = useState<'device_unlock' | 'direct'>(() => {
    return rememberedUserId ? 'device_unlock' : 'direct';
  });

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rememberThisDevice, setRememberThisDevice] = useState<boolean>(true);

  // Verified user waiting for mode selection ('active' vs 'observer')
  const [verifiedUser, setVerifiedUser] = useState<User | null>(null);

  // Security brute-force lock
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Allow forcing logout of other devices
  const [forceLogoutTarget, setForceLogoutTarget] = useState<User | null>(null);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const [showTestDuration, setShowTestDuration] = useState(false);
  const [testDuration, setTestDuration] = useState<10 | 20 | 30>(10);

  // Initialize selectedUser if in device unlock mode
  useEffect(() => {
    if (loginMode === 'device_unlock' && rememberedUser) {
      setSelectedUser(rememberedUser);
      setUsername(rememberedUser.username);
    }
  }, [loginMode, rememberedUser]);

  const handleVerifyCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setForceLogoutTarget(null);

    if (lockoutSeconds > 0) {
      setErrorMsg(`Sicherheitssperre aktiv: Bitte warten Sie noch ${lockoutSeconds} Sekunden.`);
      return;
    }

    const targetUser = username.trim();
    if (!targetUser) {
      setErrorMsg('Bitte einen Benutzernamen, Funkrufnamen oder Ihr Profil angeben.');
      return;
    }

    if (!password) {
      setErrorMsg(`Bitte Ihr persönliches Kennwort oder die PIN eingeben.`);
      return;
    }

    const foundUser = allUsers.find(
      (u) =>
        u.username.toLowerCase() === targetUser.toLowerCase() ||
        (u.callSign && u.callSign.toLowerCase() === targetUser.toLowerCase()) ||
        u.name.toLowerCase() === targetUser.toLowerCase() ||
        u.id.toLowerCase() === targetUser.toLowerCase()
    );

    if (!foundUser) {
      handleFailedAttempt();
      return;
    }

    // NEW: Check password BEFORE session check to ensure only authorized users can force logout
    if (foundUser.password && foundUser.password !== password.trim()) {
      handleFailedAttempt();
      return;
    }

    // Default password check for users without custom password
    if (!foundUser.password || foundUser.password.trim() === '') {
      const isLeadership = foundUser.role === 'admin' || foundUser.role === 'einsatzleitung' || foundUser.isAdmin;
      const expectedDefault = isLeadership ? 'admin123' : 'sucher123';
      const pass = password.trim();
      if (pass !== expectedDefault && pass !== 'admin123' && pass !== 'sucher123' && pass !== 'el123' && pass.length < 3) {
        handleFailedAttempt();
        return;
      }
    }

    // Check for real double login from another active device
    // A session is ONLY active if it has an active session ID different from ours,
    // does not belong to the same local device ID, and has a fresh heartbeat (< 45 seconds).
    const deviceSessionId = sessionStorage.getItem('rescue_device_session_id') || '';
    const deviceId = localStorage.getItem('rescue_app_device_id_v1') || '';
    const now = Date.now();
    const isSameDevice =
      Boolean(foundUser.activeSessionId) &&
      (foundUser.activeSessionId === deviceSessionId ||
        (deviceId !== '' && foundUser.activeSessionId.startsWith(deviceId)));

    const isOtherSessionAlive =
      !isSameDevice &&
      foundUser.isActive &&
      Boolean(foundUser.activeSessionId) &&
      Boolean(foundUser.lastHeartbeat) &&
      now - (foundUser.lastHeartbeat || 0) < 45000;

    if (isOtherSessionAlive) {
      setErrorMsg('Dieses Benutzerkonto ist derzeit auf einem anderen aktiven Gerät angemeldet.');
      setForceLogoutTarget(foundUser);
      return;
    }

    // Success! Reset security counters and show participation mode selector
    setFailedAttempts(0);
    setForceLogoutTarget(null);
    setVerifiedUser(foundUser);
  };

  const handleFailedAttempt = () => {
    const nextAttempts = failedAttempts + 1;
    setFailedAttempts(nextAttempts);

    if (nextAttempts >= 3) {
      setLockoutSeconds(15);
      setErrorMsg('Sicherheitssperre: 3 Fehlversuche. Der Zugang ist für 15 Sekunden gesperrt.');
      setFailedAttempts(0);
    } else {
      setErrorMsg(
        `Ungültiges Kennwort oder PIN (${nextAttempts}/3 Versuchen). Bitte prüfen Sie Ihre Eingabe.`
      );
    }
  };

  const handleFinalizeLogin = (user: User, sessionMode: 'active' | 'observer', targetOpId?: string) => {
    const usersToActivate = [user];
    
    if (sessionMode === 'observer') {
      updateUser(user.id, { role: 'observer' });
    } else {
      // Restore active role if user was previously set to observer
      if (user.role === 'observer') {
        const isLead =
          user.username.toLowerCase().includes('admin') ||
          user.username.toLowerCase().includes('leitung') ||
          user.name.toLowerCase().includes('admin');
        const defaultLeadRole: UserRole = user.username.toLowerCase().includes('admin') ? 'admin' : 'einsatzleitung';
        updateUser(user.id, { role: isLead ? defaultLeadRole : 'responder' });
      }
    }

    const finalOpId = targetOpId || (activeOperations.length > 0 ? activeOperations[0].id : '');
    if (finalOpId) {
      setCurrentOperationId(finalOpId);
      
      // Update participants list for all active operations
      allOperations.forEach((op) => {
        if (op.status === 'active' || op.status === 'paused') {
          const isTarget = op.id === finalOpId;
          const participantIds = op.participantIds || [];
          if (isTarget) {
            const newUserIds = usersToActivate.map(u => u.id).filter(id => !participantIds.includes(id));
            if (newUserIds.length > 0) {
              updateOperation(op.id, { participantIds: [...participantIds, ...newUserIds] });
            }
          } else {
            const userIdsToRemove = usersToActivate.map(u => u.id).filter(id => participantIds.includes(id));
            if (userIdsToRemove.length > 0) {
              updateOperation(op.id, { participantIds: participantIds.filter(id => !userIdsToRemove.includes(id)) });
            }
          }
        }
      });
    }

    // Activate all selected users in the system
    // (Sammel-Anmeldung logic removed)

    // Perform actual login for the main user
    const success = login(user.username, password);

    if (success && rememberThisDevice) {
      try {
        localStorage.setItem(STORAGE_KEY_REMEMBERED_DEVICE, user.id);
      } catch {}
    }
  };

  const handleGuestObserverLogin = () => {
    let guestUser = allUsers.find((u) => u.username === 'gast.betrachter');
    if (!guestUser) {
      guestUser = createUser({
        name: 'Behörde / Polizei (Gast)',
        username: 'gast.betrachter',
        password: '',
        role: 'observer',
        callSign: 'Behörde (Lesemodus)',
        organization: 'Polizei / Behörde',
        phone: '',
        licensePlate: '',
        photoUrl: '',
        equipment: [],
      });
    }

    if (activeOperations.length > 1) {
      setVerifiedUser(guestUser);
    } else {
      const finalOpId = activeOperations[0]?.id || '';
      if (finalOpId) {
        setCurrentOperationId(finalOpId);
        // Add to participants list
        allOperations.forEach((op) => {
          if (op.status === 'active' || op.status === 'paused') {
            const isTarget = op.id === finalOpId;
            const participantIds = op.participantIds || [];
            if (isTarget) {
              if (!participantIds.includes(guestUser!.id)) {
                updateOperation(op.id, { participantIds: [...participantIds, guestUser!.id] });
              }
            } else {
              if (participantIds.includes(guestUser!.id)) {
                updateOperation(op.id, { participantIds: participantIds.filter(id => id !== guestUser!.id) });
              }
            }
          }
        });
      }
      login(guestUser.username, '');
    }
  };

  const handleClearSelection = () => {
    setSelectedUser(null);
    setUsername('');
    setPassword('');
    setErrorMsg('');
    setVerifiedUser(null);
  };

  const handleDisconnectDevice = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_REMEMBERED_DEVICE);
    } catch {}
    setRememberedUserId('');
    setSelectedUser(null);
    setUsername('');
    setPassword('');
    setLoginMode('direct');
    setVerifiedUser(null);
  };

  const hasActiveOps = activeOperations.length > 0;

  return (
    <div className="h-screen w-full bg-[#0F172A] text-black dark:text-slate-100 flex flex-col justify-start items-center p-3 sm:p-6 relative overflow-y-auto font-sans pt-8 sm:pt-16 pb-24 sm:pb-32">
      {/* Background ambient tactical styling */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08)_0%,rgba(15,23,42,0)_75%)] pointer-events-none" />

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10 py-4 mb-12">
        {/* Left Side: System Branding & Mission Overview */}
        <div className="md:col-span-5 bg-[#1E293B] border border-slate-700 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl overflow-hidden relative">
          {/* Subtle background glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.07)_0%,transparent_70%)] pointer-events-none" />

          <div className="space-y-6 relative z-10">
            {/* Logo Block */}
            <div className="flex flex-col items-center gap-4">
              {/* Logo with white-bg removal via invert+screen */}
              <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-slate-950 border border-slate-700/60 shadow-xl ring-1 ring-blue-500/20 shrink-0 flex items-center justify-center">
                <img
                  src="/logo-shs.jpg"
                  alt="Spürhunde Salzlandkreis"
                  className="w-full h-full object-contain"
                  style={{ filter: 'invert(1) brightness(0.82) contrast(1.1)', mixBlendMode: 'screen' }}
                />
              </div>
              <div className="flex flex-col items-center gap-1.5 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-950/60 border border-blue-700/50 text-blue-300 text-[10px] font-bold font-mono whitespace-nowrap">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
                  <span>SPÜRHUNDE-SALZLANDKREIS E.V.</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight uppercase">
                  Einsatzzentrale
                </h1>
                <h2 className="text-sm font-bold text-blue-400 uppercase tracking-widest font-mono">
                  SHS-EZ
                </h2>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-700/60 text-xs text-slate-300">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-red-500/20 text-red-400 border border-red-500/40 flex items-center justify-center font-bold text-xs shrink-0">
                  🚨
                </div>
                <span>Echtzeit-GPS-Tracking mit automatischer Suchstrecken-Aufzeichnung</span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs shrink-0">
                  ✅
                </div>
                <span>Suchsektoren-Aufteilung mit visueller Markierung abgesuchter Flächen</span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/40 flex items-center justify-center font-bold text-xs shrink-0">
                  🐕
                </div>
                <span>Koordinierung von Suchhunde-Teams, Drohnen & externen Helfern</span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center justify-center font-bold text-xs shrink-0">
                  🗄️
                </div>
                <span>Lückenloses Behördenprotokoll & Dokumentation für Polizei und Leitstelle</span>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-300 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            <span>Vereinsbüro Aschersleben</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Einsatzbereit</span>
            </span>
          </div>
        </div>

        {/* Right Side: Login Form & Quick Profile Selection */}
        <div className="md:col-span-7 bg-[#1E293B] border border-slate-300 dark:border-slate-700 rounded-2xl p-5 sm:p-7 shadow-2xl flex flex-col justify-between">
          <div>
            {/* Auth Notification / Logout Banner */}
            {authNotification && (
              <div className={`mb-4 p-3.5 rounded-xl border text-xs flex items-center justify-between font-mono animate-in fade-in duration-200 ${
                authNotification.type === 'logout'
                  ? 'bg-slate-50 dark:bg-[#0F172A]mber-950/80 border-amber-600 text-amber-200 shadow-lg'
                  : 'bg-emerald-950/80 border-emerald-600 text-emerald-200 shadow-lg'
              }`}>
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{authNotification.type === 'logout' ? '⚠️' : '🟢'}</span>
                  <div>
                    <div className="font-bold">{authNotification.message}</div>
                    <div className="text-[10px] opacity-80">{authNotification.timestamp}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearAuthNotification}
                  className="px-2.5 py-1 rounded bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-white transition cursor-pointer text-xs underline"
                >
                  Schließen
                </button>
              </div>
            )}

            {/* Header Title */}
            <div className="border-b border-slate-300 dark:border-slate-700 pb-3 mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
                  <Key className="w-4 h-4 text-blue-400" />
                  <span>Einsatz-Anmeldung</span>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  Authentifizierung für Einsatzkräfte & Führungsdienst
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-700 text-red-300 text-xs flex flex-col gap-3 font-mono">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMsg}</span>
                </div>
                
                {forceLogoutTarget && (
                  <button
                    type="button"
                    onClick={() => {
                      const user = forceLogoutTarget;
                      setForceLogoutTarget(null);
                      setErrorMsg('');
                      // Skip active session check and proceed to participation mode selector
                      setFailedAttempts(0);
                      setVerifiedUser(user);
                    }}
                    className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition text-[10px] uppercase tracking-wider shadow-lg flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Andere Sitzungen beenden & hier anmelden</span>
                  </button>
                )}
              </div>
            )}

            {lockoutSeconds > 0 && (
              <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-[#0F172A]mber-950/80 border border-amber-600 text-amber-300 text-xs flex items-center gap-2 font-mono">
                <Clock className="w-4 h-4 shrink-0 animate-spin text-amber-400" />
                <span>Sicherheitssperre aktiv: Bitte warten Sie {lockoutSeconds}s.</span>
              </div>
            )}

            {/* VERIFIED USER STEP: Participation Choice */}
            {verifiedUser ? (
              <div className="space-y-4 font-mono animate-in fade-in duration-200">
                <div className="p-4 rounded-2xl bg-blue-950/30 border-2 border-blue-500/70 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-700/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <span className="font-bold text-sm text-white uppercase block leading-tight">
                          Anmeldung erfolgreich
                        </span>
                        <span className="text-xs text-blue-300 font-sans">
                          {verifiedUser.name} {verifiedUser.callSign ? `(${verifiedUser.callSign})` : ''}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVerifiedUser(null)}
                      className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200 underline cursor-pointer"
                    >
                      Abbrechen
                    </button>
                  </div>

                  {activeOperations.length > 1 && (
                    <div className="space-y-3 pb-3 border-b border-slate-300 dark:border-slate-700/80">
                      <span className="block text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                        ⚠️ Mehrere aktive Einsätze gefunden:
                      </span>
                      <p className="text-[10px] text-slate-700 dark:text-slate-300 font-sans leading-relaxed">
                        Bitte wählen Sie den gewünschten Einsatz, für den Sie sich anmelden möchten:
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {activeOperations.map((op) => {
                          const isSelected = selectedOperationId === op.id;
                          return (
                            <button
                              key={op.id}
                              type="button"
                              onClick={() => setSelectedOperationId(op.id)}
                              className={`w-full p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1.5 ${
                                isSelected
                                  ? 'bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/30 text-white'
                                  : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold truncate">
                                  {op.title}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                  op.type === 'exercise'
                                    ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                    : 'bg-red-950 text-red-300 border border-red-800'
                                }`}>
                                  {op.type === 'exercise' ? 'Übung' : 'Einsatz'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-sans">
                                <span>Leiter: {op.commander || 'Nicht angegeben'}</span>
                                <span className="font-mono">{op.participantIds?.length || 0} Kräfte</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-slate-700 dark:text-slate-300 font-sans">
                    Bitte wählen Sie Ihre gewünschte Funktion für diese Einsatzsitzung:
                  </p>

                  <div className="grid grid-cols-1 gap-3 pt-1">
                    {/* Option 1: Aktiver User */}
                    <button
                      type="button"
                      onClick={() => handleFinalizeLogin(verifiedUser, 'active', selectedOperationId)}
                      className="p-4 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800 border-2 border-emerald-500/60 hover:border-emerald-400 text-left transition cursor-pointer flex flex-col justify-between gap-3 group shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-white uppercase flex items-center gap-2">
                            <span>🦺</span> Als aktiver User
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold">
                            Einsatzteilnehmer
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-2 font-sans leading-relaxed">
                          Nimmt aktiv am Einsatz teil. GPS-Tracking, Sektorzuweisung, Fundmeldungen & Chat passend zur Rolle (<span className="text-emerald-300 font-bold">{verifiedUser.role === 'admin' ? 'Einsatzleitung' : 'Einsatzkraft'}</span>).
                        </p>
                      </div>
                      <div className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 group-hover:bg-emerald-500 text-white font-bold text-xs uppercase font-mono text-center flex items-center justify-center gap-1.5 shadow">
                        <span>Als aktiver User starten</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </button>

                    {/* Option 2: Betrachter */}
                    <button
                      type="button"
                      onClick={() => handleFinalizeLogin(verifiedUser, 'observer', selectedOperationId)}
                      className="p-4 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800 border-2 border-purple-500/60 hover:border-purple-400 text-left transition cursor-pointer flex flex-col justify-between gap-3 group shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-purple-200 uppercase flex items-center gap-2">
                            <span>👁️</span> Als Betrachter
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-purple-950 text-purple-300 border border-purple-700 font-bold">
                            Nur Leseansicht
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-2 font-sans leading-relaxed">
                          Nimmt <strong>nicht</strong> aktiv am Einsatz teil und wird keinen Sektoren zugeteilt. Sieht alle Live-Aktionen auf der Karte, Lageberichte und kann den Chat mitlesen.
                        </p>
                      </div>
                      <div className="w-full py-2.5 px-3 rounded-lg bg-purple-600 group-hover:bg-purple-500 text-white font-bold text-xs uppercase font-mono text-center flex items-center justify-center gap-1.5 shadow">
                        <span>Als Betrachter starten</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </button>

                    {/* Option 3: Trackingtest */}
                    <div className="space-y-2 pt-2 mt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <div className="h-px flex-1 bg-slate-50 dark:bg-slate-800"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Alternativ</span>
                        <div className="h-px flex-1 bg-slate-50 dark:bg-slate-800"></div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setShowTestDuration(!showTestDuration)}
                        className="w-full p-4 rounded-xl bg-white dark:bg-slate-900 border-2 border-blue-500/60 hover:border-blue-400 hover:bg-slate-50 dark:bg-slate-800 text-left transition cursor-pointer flex flex-col justify-between gap-3 group shadow-md"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold uppercase flex items-center gap-2 text-blue-200">
                              <span>🛰️</span> Persönlicher Trackingtest
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded font-mono border font-bold bg-blue-950 text-blue-300 border-blue-700">
                              Testmodus
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-sans leading-relaxed">
                            Überprüft die GPS-Funktion und Genauigkeit deines Geräts im Vorfeld (10-30 Min). Erstellt am Ende ein Prüfprotokoll mit Karte zur Bestätigung.
                          </p>
                        </div>
                        {!showTestDuration && (
                          <div className="w-full py-2.5 px-3 rounded-lg bg-blue-600 group-hover:bg-blue-500 text-white font-bold text-xs uppercase font-mono text-center flex items-center justify-center gap-1.5 shadow">
                            <span>Testdauer wählen & starten</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </button>

                      {showTestDuration && (
                        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-blue-500/40 animate-in slide-in-from-top-2 duration-200">
                          <span className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3 text-center">
                            Wähle die Testdauer:
                          </span>
                          <div className="grid grid-cols-3 gap-2">
                            {[10, 20, 30].map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => {
                                  if (verifiedUser) {
                                    setTestDuration(d as 10 | 20 | 30);
                                    startTrackingTest(verifiedUser, d as 10 | 20 | 30);
                                  }
                                }}
                                className="py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition cursor-pointer"
                              >
                                {d} Min.
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowTestDuration(false)}
                            className="w-full mt-3 py-1.5 text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200 transition underline"
                          >
                            Abbrechen
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* PRIMARY CREDENTIAL INPUT VIEW */
              <div className="space-y-4">
                {/* 1. Dedicated Device Unlock View */}
                {loginMode === 'device_unlock' && rememberedUser && !selectedUser ? (
                  <div className="space-y-3 font-mono">
                    <div className="p-4 rounded-2xl bg-blue-950/30 border-2 border-blue-500/70 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4 text-blue-400" />
                          <span>Persönliches Einsatzgerät</span>
                        </span>
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
                          <Check className="w-3 h-3" />
                          <span>Hinterlegt</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700">
                        <div className="h-12 w-12 rounded-xl overflow-hidden border border-slate-400 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          {rememberedUser.photoUrl ? (
                            <img
                              src={rememberedUser.photoUrl}
                              alt={rememberedUser.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xl font-bold text-white uppercase">
                              {rememberedUser.name.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-base text-white truncate">{rememberedUser.name}</div>
                          <div className="text-xs text-blue-400 font-mono">{rememberedUser.callSign}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {rememberedUser.organization || 'Spürhunde-Salzlandkreis e.V.'}
                          </div>
                        </div>
                      </div>

                      <form onSubmit={handleVerifyCredentials} className="space-y-3 pt-1">
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">
                            PIN oder Kennwort für {rememberedUser.name}:
                          </label>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              autoFocus
                              required
                              disabled={lockoutSeconds > 0}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="PIN / Kennwort eingeben..."
                              className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border-2 border-blue-500/60 focus:border-blue-400 text-black dark:text-slate-100 text-sm focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200 cursor-pointer"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={lockoutSeconds > 0}
                          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-100 dark:bg-slate-700 text-white font-bold text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Identität verifizieren</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </form>

                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <button
                          type="button"
                          onClick={() => {
                            setLoginMode('direct');
                            handleClearSelection();
                          }}
                          className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
                        >
                          Nicht {rememberedUser.name}? Anderer Login
                        </button>
                        <button
                          type="button"
                          onClick={handleDisconnectDevice}
                          className="text-slate-500 hover:text-red-400 transition cursor-pointer"
                        >
                          Gerät entkoppeln
                        </button>
                      </div>
                    </div>
                  </div>
                ) : selectedUser ? (
                  /* 2. Specific Profile Verification Dialog */
                  <form
                    onSubmit={handleVerifyCredentials}
                    className="p-4 rounded-2xl bg-blue-950/40 border-2 border-blue-500/80 space-y-3.5 font-mono shadow-xl"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-blue-400" />
                        <span>Identitätsprüfung</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleClearSelection}
                        className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200 underline cursor-pointer flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        <span>Anderes Profil</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700">
                      <div className="h-11 w-11 rounded-xl overflow-hidden border border-slate-400 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        {selectedUser.photoUrl ? (
                          <img
                            src={selectedUser.photoUrl}
                            alt={selectedUser.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-lg font-bold text-white uppercase">
                            {selectedUser.name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-white truncate">{selectedUser.name}</div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="text-blue-400 font-mono">
                            {selectedUser.callSign || selectedUser.username}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">
                        Kennwort oder PIN für {selectedUser.name}:
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          autoFocus
                          required
                          disabled={lockoutSeconds > 0}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Kennwort oder PIN..."
                          className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border-2 border-blue-500/60 focus:border-blue-400 text-black dark:text-slate-100 text-sm focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={rememberThisDevice}
                        onChange={(e) => setRememberThisDevice(e.target.checked)}
                        className="rounded text-blue-500 focus:ring-0 cursor-pointer h-4 w-4 bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                      />
                      <span>Dieses Einsatzgerät für {selectedUser.name} merken</span>
                    </label>

                    <button
                      type="submit"
                      disabled={lockoutSeconds > 0}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-100 dark:bg-slate-700 text-white font-bold text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Anmeldung prüfen</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  /* 3. General Login Hub (Direct Login) */
                  <div className="space-y-4 font-mono">
                    {/* DIRECT SECURE LOGIN FORM */}
                    <form onSubmit={handleVerifyCredentials} className="space-y-3.5 pt-1">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Benutzername / Funkrufname / Name:
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            autoFocus
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="z.B. maria, jule, oder Sucher 1"
                            className="w-full pl-3 pr-8 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-black dark:text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                          />
                          <UserIcon className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-3 pointer-events-none" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Persönliches Kennwort oder PIN:
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            disabled={lockoutSeconds > 0}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Persönliches Kennwort oder PIN..."
                            className="w-full pl-3 pr-8 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-black dark:text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-700 dark:text-slate-300 transition cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 pt-1">
                        <input
                          type="checkbox"
                          checked={rememberThisDevice}
                          onChange={(e) => setRememberThisDevice(e.target.checked)}
                          className="rounded text-blue-500 focus:ring-0 cursor-pointer h-4 w-4 bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                        />
                        <span>Dieses Gerät als mein persönliches Einsatzgerät merken</span>
                      </label>

                      <button
                        type="submit"
                        disabled={lockoutSeconds > 0}
                        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-100 dark:bg-slate-700 text-white font-bold text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider font-mono"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Weiter zur Teilnahme-Wahl</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
