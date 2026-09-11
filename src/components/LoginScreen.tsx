import React, { useState, useEffect, useMemo } from 'react';
import { useRescue } from '../context/RescueContext';
import { User, EquipmentType, UserRole } from '../types';
import { getOpTheme } from './Navbar';
import { SniffingDogAnimation } from './SniffingDogAnimation';
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

  // Dynamic status theme for the "SPÜRHUNDE-SALZLANDKREIS E.V." badge:
  // - weiß leuchten wenn alles inaktiv
  // - gelb während einer übung
  // - wenn 1 einsatz aktiv ist übernimm diese farbe (z.B. Blau)
  // - bei mehreren aktiven einsätzen rot blinken
  // - bei gleichzeitigen übung und einsatz orange
  const loginStatusTheme = useMemo(() => {
    const activeRealOps = (allOperations || []).filter(
      (o) => o.status === 'active' && o.type !== 'exercise'
    );
    const activeExercises = (allOperations || []).filter(
      (o) => o.status === 'active' && o.type === 'exercise'
    );

    const realCount = activeRealOps.length;
    const exerciseCount = activeExercises.length;

    // 1. Gleichzeitige Übung und Einsatz -> Orange blinken
    if (realCount > 0 && exerciseCount > 0) {
      return {
        dotBg: 'bg-orange-500',
        pingBg: 'bg-orange-400',
        animatePing: true,
        glow: 'shadow-[0_0_12px_rgba(249,115,22,0.8)]',
        badgeBg: 'bg-orange-950/70 border-orange-700/60 text-orange-300',
        title: `Lage: Gleichzeitig ${realCount} Realeinsatz und ${exerciseCount} Übung aktiv`,
      };
    }

    // 2. Mehrere aktive Einsätze -> Rot blinken
    if (realCount > 1) {
      return {
        dotBg: 'bg-red-500',
        pingBg: 'bg-red-400',
        animatePing: true,
        glow: 'shadow-[0_0_12px_rgba(239,68,68,0.8)]',
        badgeBg: 'bg-red-950/70 border-red-700/60 text-red-300',
        title: `Lage: ${realCount} aktive Realeinsätze laufen`,
      };
    }

    // 3. Genau 1 Realeinsatz aktiv -> Übernimm diese Farbe (aus taktischer Farbpalette)
    if (realCount === 1) {
      const singleOp = activeRealOps[0];
      const opTheme = getOpTheme(singleOp, allOperations || []);
      return {
        dotBg: opTheme.dotBg,
        pingBg: opTheme.pingBg,
        animatePing: true,
        glow: 'shadow-[0_0_12px_rgba(59,130,246,0.8)]',
        badgeBg: `${opTheme.badge}`,
        title: `Lage: 1 Realeinsatz aktiv (${opTheme.colorName}) - ${singleOp.title}`,
      };
    }

    // 4. Nur Übung(en) aktiv -> Gelb blinken
    if (exerciseCount > 0) {
      return {
        dotBg: 'bg-amber-400',
        pingBg: 'bg-amber-300',
        animatePing: true,
        glow: 'shadow-[0_0_12px_rgba(251,191,36,0.8)]',
        badgeBg: 'bg-amber-950/70 border-amber-700/60 text-amber-300',
        title: `Lage: ${exerciseCount === 1 ? '1 Übung' : `${exerciseCount} Übungen`} aktiv`,
      };
    }

    // 5. Alles inaktiv -> Weiß leuchten lassen (Bereitschaft)
    return {
      dotBg: 'bg-white',
      pingBg: 'bg-white',
      animatePing: false,
      glow: 'shadow-[0_0_10px_rgba(255,255,255,0.85)]',
      badgeBg: 'bg-blue-950/60 border-blue-700/50 text-blue-300',
      title: 'Lage: Bereitschaft (Kein aktiver Einsatz)',
    };
  }, [allOperations]);

  const activeOperations = useMemo(() => {
    return allOperations.filter((op) => op.status === 'active' || op.status === 'paused');
  }, [allOperations]);

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

  // 2-step flow: pendingSessionMode is set when user picks role (active/observer) but there are
  // multiple active operations → user must then pick which operation to join.
  const [pendingSessionMode, setPendingSessionMode] = useState<'active' | 'observer' | null>(null);

  // Initialize selectedUser if in device unlock mode
  useEffect(() => {
    if (loginMode === 'device_unlock' && rememberedUser) {
      setSelectedUser(rememberedUser);
      setUsername(rememberedUser.username);
    }
  }, [loginMode, rememberedUser]);

  /**
   * Called once both role (active/observer) AND target operation are known.
   * Single canonical place for all login finalization state changes.
   */
  const handleFinalizeLogin = (user: User, sessionMode: 'active' | 'observer', targetOpId?: string) => {
    // Update role first
    if (sessionMode === 'observer') {
      updateUser(user.id, { role: 'observer' });
    } else {
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
      allOperations.forEach((op) => {
        if (op.status === 'active' || op.status === 'paused') {
          const participantIds = op.participantIds || [];
          if (op.id === finalOpId) {
            if (!participantIds.includes(user.id)) {
              updateOperation(op.id, { participantIds: [...participantIds, user.id] });
            }
          } else {
            if (participantIds.includes(user.id)) {
              updateOperation(op.id, {
                participantIds: participantIds.filter((id) => id !== user.id),
              });
            }
          }
        }
      });
    }

    const success = login(user.username, password, finalOpId || undefined);

    if (success && rememberThisDevice) {
      try {
        localStorage.setItem(STORAGE_KEY_REMEMBERED_DEVICE, user.id);
      } catch {}
    }

    setPendingSessionMode(null);
    setVerifiedUser(null);
  };

  /**
   * Role button click: if single op → finalize immediately, else → show op picker.
   */
  const handleRoleSelected = (mode: 'active' | 'observer') => {
    if (!verifiedUser) return;
    if (activeOperations.length <= 1) {
      handleFinalizeLogin(verifiedUser, mode, activeOperations[0]?.id);
    } else {
      setPendingSessionMode(mode);
    }
  };

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

    // Check password BEFORE session check
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

    // Success – reset security counters
    setFailedAttempts(0);
    setForceLogoutTarget(null);

    // Observer accounts skip the role picker – finalize directly as observer.
    // For multiple ops show op picker, for single op finalize immediately.
    if (foundUser.role === 'observer') {
      if (activeOperations.length > 1) {
        setVerifiedUser(foundUser);
        setPendingSessionMode('observer');
      } else {
        handleFinalizeLogin(foundUser, 'observer', activeOperations[0]?.id);
      }
    } else {
      setVerifiedUser(foundUser);
    }
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
      // Multiple operations → set as verifiedUser and show the full selector
      // (role is already known: observer → skip role picker, go straight to op picker)
      setVerifiedUser(guestUser);
      setPendingSessionMode('observer');
    } else {
      // Single operation → login directly
      const finalOpId = activeOperations[0]?.id || '';
      if (finalOpId) {
        allOperations.forEach((op) => {
          if (op.status === 'active' || op.status === 'paused') {
            const participantIds = op.participantIds || [];
            if (op.id === finalOpId) {
              if (!participantIds.includes(guestUser!.id)) {
                updateOperation(op.id, { participantIds: [...participantIds, guestUser!.id] });
              }
            } else {
              if (participantIds.includes(guestUser!.id)) {
                updateOperation(op.id, {
                  participantIds: participantIds.filter((id) => id !== guestUser!.id),
                });
              }
            }
          }
        });
      }
      login(guestUser.username, '', finalOpId || undefined);
    }
  };

  const handleClearSelection = () => {
    setSelectedUser(null);
    setUsername('');
    setPassword('');
    setErrorMsg('');
    setVerifiedUser(null);
    setPendingSessionMode(null);
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
    setPendingSessionMode(null);
  };

  const hasActiveOps = activeOperations.length > 0;

  return (
    <div
      className="w-full min-h-full bg-reflex-blue text-white flex flex-col justify-start items-center p-3 sm:p-6 relative font-sans pt-4 sm:pt-12 pb-28 sm:pb-36"
      style={{ backgroundColor: '#001489' }}
    >
      {/* Background ambient Pantone Reflex Blue tactical styling */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,50,220,0.85)_0%,#000B52_100%)] pointer-events-none" />

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10 py-4 mb-12">
        {/* Left Side: System Branding & Mission Overview */}
        <div className="md:col-span-5 bg-[#000E66]/95 border-2 border-[#1E35D4] rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl shadow-blue-950/80 overflow-hidden relative">
          {/* Subtle background glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(60,110,255,0.15)_0%,transparent_70%)] pointer-events-none" />

          <div className="space-y-6 relative z-10">
            {/* Logo Block */}
            <div className="flex flex-col items-center gap-4">
              {/* Logo with white-bg removal via invert+screen */}
              <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-slate-950 border-2 border-blue-400/50 shadow-xl ring-2 ring-blue-500/30 shrink-0 flex items-center justify-center">
                <img
                  src="/logo-shs.jpg"
                  alt="Spürhunde Salzlandkreis"
                  className="w-full h-full object-contain"
                  style={{ filter: 'invert(1) brightness(0.82) contrast(1.1)', mixBlendMode: 'screen' }}
                />
              </div>
              <div className="flex flex-col items-center gap-1.5 text-center">
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border text-[10px] font-bold font-mono whitespace-nowrap transition-all shadow-sm ${loginStatusTheme.badgeBg}`}
                  title={loginStatusTheme.title}
                >
                  <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
                    {loginStatusTheme.animatePing && (
                      <span
                        className={`absolute inline-flex h-full w-full rounded-full ${loginStatusTheme.pingBg} animate-ping opacity-75`}
                      />
                    )}
                    <span
                      className={`relative inline-flex h-2 w-2 rounded-full ${loginStatusTheme.dotBg} ${loginStatusTheme.glow} border border-slate-900/40`}
                    />
                  </span>
                  <span>SPÜRHUNDE-SALZLANDKREIS E.V.</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight uppercase">
                  Einsatzzentrale
                </h1>
                <h2 className="text-sm font-bold text-cyan-300 uppercase tracking-widest font-mono">
                  SHS-EZ (Reflex Blue Edition)
                </h2>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-blue-700/60 text-xs text-blue-100">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 flex items-center justify-center font-bold text-xs shrink-0">
                  🚨
                </div>
                <span>Echtzeit-GPS-Tracking mit automatischer Suchstrecken-Aufzeichnung</span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center font-bold text-xs shrink-0">
                  ✅
                </div>
                <span>Suchsektoren-Aufteilung mit visueller Markierung abgesuchter Flächen</span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center justify-center font-bold text-xs shrink-0">
                  🐕
                </div>
                <span>Koordinierung von Suchhunde-Teams, Drohnen &amp; externen Helfern</span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center justify-center font-bold text-xs shrink-0">
                  🗄️
                </div>
                <span>Lückenloses Behördenprotokoll &amp; Dokumentation für Polizei und Leitstelle</span>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-blue-700/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-blue-200 font-mono">
            <div className="flex items-center gap-2">
              <span className="font-bold text-cyan-300">v2.7 (Türkiser Suchhund)</span>
              <button
                type="button"
                onClick={() => {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
                  }
                  if ('caches' in window) {
                    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
                  }
                  localStorage.removeItem('shs_ez_cache_version');
                  window.location.reload();
                }}
                className="px-2 py-0.5 rounded bg-blue-900/90 hover:bg-blue-800 text-cyan-300 border border-cyan-400/50 text-[10px] font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
                title="Erzwingt das sofortige Leeren aller alten Caches und holt die neuste Version vom Server"
              >
                <span>🔄 App-Update erzwingen</span>
              </button>
            </div>
            <span className="text-emerald-300 font-bold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Einsatzbereit</span>
            </span>
          </div>
        </div>

        {/* Right Side: Login Form & Quick Profile Selection */}
        <div className="md:col-span-7 bg-[#000E66]/95 border-2 border-[#1E35D4] rounded-2xl p-5 sm:p-7 shadow-2xl shadow-blue-950/80 flex flex-col justify-between">
          <div>
            {/* Auth Notification / Logout Banner */}
            {authNotification && (
              <div className={`mb-4 p-3.5 rounded-xl border text-xs flex items-center justify-between font-mono animate-in fade-in duration-200 ${
                authNotification.type === 'logout'
                  ? 'bg-slate-50 dark:bg-amber-950/80 border-amber-600 text-amber-200 shadow-lg'
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
              <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-amber-950/80 border border-amber-600 text-amber-300 text-xs flex items-center gap-2 font-mono">
                <Clock className="w-4 h-4 shrink-0 animate-spin text-amber-400" />
                <span>Sicherheitssperre aktiv: Bitte warten Sie {lockoutSeconds}s.</span>
              </div>
            )}

            {/* VERIFIED USER STEP: Role Selection & Operation Picker */}
            {verifiedUser ? (
              <div className="space-y-4 font-mono animate-in fade-in duration-200">
                <div className="p-4 rounded-2xl bg-blue-950/30 border-2 border-blue-500/70 space-y-4 shadow-xl">

                  {/* Header: verified identity */}
                  <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <span className="font-bold text-sm text-white uppercase block leading-tight">
                          Anmeldung erfolgreich
                        </span>
                        <span className="text-xs text-blue-300 font-sans">
                          {verifiedUser.name}{verifiedUser.callSign ? ` (${verifiedUser.callSign})` : ''}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
                    >
                      Abbrechen
                    </button>
                  </div>

                  {/* ── STEP 2: Operation picker (only shown when pendingSessionMode is set) ── */}
                  {pendingSessionMode !== null ? (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                          ⚠️ An welchem Einsatz / welcher Übung nimmst du teil?
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 font-sans leading-relaxed">
                        Es sind mehrere Einsätze/Übungen gleichzeitig aktiv. Bitte wähle deinen:
                      </p>

                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {activeOperations.map((op) => {
                          const isExercise = op.type === 'exercise';
                          return (
                            <button
                              key={op.id}
                              type="button"
                              onClick={() => handleFinalizeLogin(verifiedUser, pendingSessionMode, op.id)}
                              className={`w-full p-3 rounded-xl border-2 text-left transition cursor-pointer flex flex-col gap-1.5 group shadow ${
                                isExercise
                                  ? 'bg-purple-950/40 border-purple-600/60 hover:border-purple-400 hover:bg-purple-950/60'
                                  : 'bg-red-950/40 border-red-600/60 hover:border-red-400 hover:bg-red-950/60'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-white truncate flex-1 mr-2">
                                  {op.title}
                                </span>
                                <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border shrink-0 ${
                                  isExercise
                                    ? 'bg-purple-950 text-purple-300 border-purple-700'
                                    : 'bg-red-950 text-red-300 border-red-700'
                                }`}>
                                  {isExercise ? '🟣 Übung' : '🚨 Einsatz'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-sans">
                                <span>Leiter: {op.commander || 'Nicht angegeben'}</span>
                                <span className="font-mono">{op.participantIds?.length || 0} Kräfte</span>
                              </div>
                              <div className={`w-full py-1.5 px-2 rounded-lg text-white font-bold text-[10px] uppercase font-mono text-center flex items-center justify-center gap-1 mt-1 ${
                                isExercise ? 'bg-purple-700 group-hover:bg-purple-600' : 'bg-red-700 group-hover:bg-red-600'
                              }`}>
                                <span>
                                  {pendingSessionMode === 'observer' ? '👁️ Als Betrachter beitreten' : '🦺 Als aktive Kraft beitreten'}
                                </span>
                                <ArrowRight className="w-3 h-3" />
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => setPendingSessionMode(null)}
                        className="w-full py-2 text-[11px] text-slate-400 hover:text-slate-200 transition underline text-center cursor-pointer"
                      >
                        ← Zurück zur Funktionswahl
                      </button>
                    </div>
                  ) : (
                    /* ── STEP 1: Role picker ── */
                    <>
                      <p className="text-xs text-slate-300 font-sans">
                        Bitte wählen Sie Ihre Funktion für diese Einsatzsitzung:
                      </p>

                      <div className="grid grid-cols-1 gap-3 pt-1">
                        {/* Option 1: Aktiver User */}
                        <button
                          type="button"
                          onClick={() => handleRoleSelected('active')}
                          className="p-4 rounded-xl bg-[#000840] hover:bg-[#001073] border-2 border-emerald-500/80 hover:border-emerald-400 text-left transition cursor-pointer flex flex-col justify-between gap-3 group shadow-lg"
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
                            <p className="text-[11px] text-blue-100 mt-2 font-sans leading-relaxed">
                              Nimmt aktiv am Einsatz teil. GPS-Tracking, Sektorzuweisung, Fundmeldungen &amp; Chat passend zur Rolle (<span className="text-emerald-300 font-bold">{verifiedUser.role === 'admin' || verifiedUser.role === 'einsatzleitung' ? 'Einsatzleitung' : 'Einsatzkraft'}</span>).
                            </p>
                          </div>
                          <div className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 group-hover:bg-emerald-500 text-white font-bold text-xs uppercase font-mono text-center flex items-center justify-center gap-1.5 shadow">
                            <span>Als aktiver User {activeOperations.length > 1 ? '→ Einsatz wählen' : 'starten'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        </button>

                        {/* Option 2: Betrachter */}
                        <button
                          type="button"
                          onClick={() => handleRoleSelected('observer')}
                          className="p-4 rounded-xl bg-[#000840] hover:bg-[#001073] border-2 border-purple-500/80 hover:border-purple-400 text-left transition cursor-pointer flex flex-col justify-between gap-3 group shadow-lg"
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
                            <p className="text-[11px] text-blue-100 mt-2 font-sans leading-relaxed">
                              Nimmt <strong>nicht</strong> aktiv am Einsatz teil und wird keinen Sektoren zugeteilt. Sieht alle Live-Aktionen auf der Karte, Lageberichte und kann den Chat mitlesen.
                            </p>
                          </div>
                          <div className="w-full py-2.5 px-3 rounded-lg bg-purple-600 group-hover:bg-purple-500 text-white font-bold text-xs uppercase font-mono text-center flex items-center justify-center gap-1.5 shadow">
                            <span>Als Betrachter {activeOperations.length > 1 ? '→ Einsatz wählen' : 'starten'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        </button>

                        {/* Option 3: Trackingtest */}
                        <div className="space-y-2 pt-2 mt-2 border-t border-blue-700/60">
                          <div className="flex items-center gap-2 mb-1 px-1">
                            <div className="h-px flex-1 bg-blue-700/60" />
                            <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest">Alternativ</span>
                            <div className="h-px flex-1 bg-blue-700/60" />
                          </div>

                          <button
                            type="button"
                            onClick={() => setShowTestDuration(!showTestDuration)}
                            className="w-full p-4 rounded-xl bg-[#000840] hover:bg-[#001073] border-2 border-cyan-400/80 hover:border-cyan-300 text-left transition cursor-pointer flex flex-col justify-between gap-3 group shadow-lg"
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold uppercase flex items-center gap-2 text-cyan-200">
                                  <span>🛰️</span> Persönlicher Trackingtest
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded font-mono border font-bold bg-cyan-950 text-cyan-300 border-cyan-700">
                                  Testmodus
                                </span>
                              </div>
                              <p className="text-[11px] text-blue-100 mt-2 font-sans leading-relaxed">
                                Überprüft die GPS-Funktion und Genauigkeit deines Geräts im Vorfeld (10-30 Min). Erstellt am Ende ein Prüfprotokoll mit Karte zur Bestätigung.
                              </p>
                            </div>
                            {!showTestDuration && (
                              <div className="w-full py-2.5 px-3 rounded-lg bg-cyan-600 group-hover:bg-cyan-500 text-white font-bold text-xs uppercase font-mono text-center flex items-center justify-center gap-1.5 shadow">
                                <span>Testdauer wählen &amp; starten</span>
                                <ChevronDown className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </button>

                          {showTestDuration && (
                            <div className="p-3 rounded-xl bg-[#000529] border border-cyan-400/60 animate-in slide-in-from-top-2 duration-200">
                              <span className="block text-[10px] font-bold text-cyan-300 uppercase tracking-widest mb-3 text-center">
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
                                    className="py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg transition cursor-pointer"
                                  >
                                    {d} Min.
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowTestDuration(false)}
                                className="w-full mt-3 py-1.5 text-[10px] text-blue-200 hover:text-white transition underline"
                              >
                                Abbrechen
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* PRIMARY CREDENTIAL INPUT VIEW */
              <div className="space-y-4">
                {/* 1. Dedicated Device Unlock View */}
                {loginMode === 'device_unlock' && rememberedUser && !selectedUser ? (
                  <div className="space-y-3 font-mono">
                    <div className="p-4 rounded-2xl bg-[#000E66] border-2 border-[#2B42F2] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4 text-cyan-400" />
                          <span>Persönliches Einsatzgerät</span>
                        </span>
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
                          <Check className="w-3 h-3" />
                          <span>Hinterlegt</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-3 p-3 rounded-xl bg-[#000840] border border-[#2B42F2]/60">
                        <div className="h-12 w-12 rounded-xl overflow-hidden border border-[#2B42F2] bg-[#001489] flex items-center justify-center shrink-0">
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
                          <div className="text-xs text-cyan-300 font-mono">{rememberedUser.callSign}</div>
                          <div className="text-[10px] text-blue-200 truncate mt-0.5">
                            {rememberedUser.organization || 'Spürhunde-Salzlandkreis e.V.'}
                          </div>
                        </div>
                      </div>

                      <form onSubmit={handleVerifyCredentials} className="space-y-3 pt-1">
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-blue-100 uppercase tracking-wider">
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
                              className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-[#00073B] border-2 border-[#2B42F2] focus:border-cyan-400 text-white placeholder-blue-300/50 text-sm focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-3 text-cyan-300 hover:text-white cursor-pointer"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={lockoutSeconds > 0}
                          className="w-full py-2.5 rounded-xl bg-[#2B42F2] hover:bg-blue-600 disabled:bg-blue-900/40 text-white font-bold text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Identität verifizieren</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </form>

                      <div className="pt-2 border-t border-[#1E35D4]/40 flex items-center justify-between text-[11px] text-blue-200">
                        <button
                          type="button"
                          onClick={() => {
                            setLoginMode('direct');
                            handleClearSelection();
                          }}
                          className="text-cyan-300 hover:text-white underline cursor-pointer"
                        >
                          Nicht {rememberedUser.name}? Anderer Login
                        </button>
                        <button
                          type="button"
                          onClick={handleDisconnectDevice}
                          className="text-red-300 hover:text-red-200 transition cursor-pointer"
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
                    className="p-4 rounded-2xl bg-[#000E66] border-2 border-[#2B42F2] space-y-3.5 font-mono shadow-xl"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-cyan-400" />
                        <span>Identitätsprüfung</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleClearSelection}
                        className="text-[11px] text-blue-200 hover:text-white underline cursor-pointer flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        <span>Anderes Profil</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#000840] border border-[#2B42F2]/60">
                      <div className="h-11 w-11 rounded-xl overflow-hidden border border-[#2B42F2] bg-[#001489] flex items-center justify-center shrink-0">
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
                        <div className="flex items-center gap-2 text-[11px] text-blue-200">
                          <span className="text-cyan-300 font-mono">
                            {selectedUser.callSign || selectedUser.username}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-blue-100 uppercase tracking-wider">
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
                          className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-[#00073B] border-2 border-[#2B42F2] focus:border-cyan-400 text-white placeholder-blue-300/50 text-sm focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-cyan-300 hover:text-white cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-blue-100">
                      <input
                        type="checkbox"
                        checked={rememberThisDevice}
                        onChange={(e) => setRememberThisDevice(e.target.checked)}
                        className="rounded text-cyan-400 focus:ring-0 cursor-pointer h-4 w-4 bg-[#00073B] border-[#2B42F2]"
                      />
                      <span>Dieses Einsatzgerät für {selectedUser.name} merken</span>
                    </label>

                    <button
                      type="submit"
                      disabled={lockoutSeconds > 0}
                      className="w-full py-2.5 rounded-xl bg-[#2B42F2] hover:bg-blue-600 disabled:bg-blue-900/40 text-white font-bold text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
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
                        <label className="block text-[11px] font-bold text-blue-100 uppercase tracking-wider">
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
                            className="w-full pl-3 pr-8 py-2.5 rounded-xl bg-[#00073B] border-2 border-[#2B42F2] text-white placeholder-blue-300/50 text-xs focus:outline-none focus:border-cyan-400 font-mono"
                          />
                          <UserIcon className="w-3.5 h-3.5 text-cyan-400 absolute right-3 top-3 pointer-events-none" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-blue-100 uppercase tracking-wider">
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
                            className="w-full pl-3 pr-8 py-2.5 rounded-xl bg-[#00073B] border-2 border-[#2B42F2] text-white placeholder-blue-300/50 text-xs focus:outline-none focus:border-cyan-400 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-2.5 text-cyan-300 hover:text-white transition cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer text-xs text-blue-100 pt-1">
                        <input
                          type="checkbox"
                          checked={rememberThisDevice}
                          onChange={(e) => setRememberThisDevice(e.target.checked)}
                          className="rounded text-cyan-400 focus:ring-0 cursor-pointer h-4 w-4 bg-[#00073B] border-[#2B42F2]"
                        />
                        <span>Dieses Gerät als mein persönliches Einsatzgerät merken</span>
                      </label>

                      <button
                        type="submit"
                        disabled={lockoutSeconds > 0}
                        className="w-full py-2.5 rounded-xl bg-[#2B42F2] hover:bg-blue-600 disabled:bg-blue-900/40 text-white font-bold text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider font-mono"
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
      <SniffingDogAnimation />
    </div>
  );
};
