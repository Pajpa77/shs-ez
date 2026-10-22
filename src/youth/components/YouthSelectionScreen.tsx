import React, { useState } from 'react';
import { useYouth } from '../YouthContext';
import { User, isUserAdmin } from '../../types';
import {
  Shield,
  Users,
  Compass,
  ArrowLeft,
  Key,
  Lock,
  Sparkles,
  ChevronRight,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';

interface YouthSelectionScreenProps {
  adultUsers: User[];
  onExitYouthModule: () => void;
  onStartTrackingTest?: (user: User, duration: 10 | 20 | 30) => void;
}

export const YouthSelectionScreen: React.FC<YouthSelectionScreenProps> = ({
  adultUsers,
  onExitYouthModule,
  onStartTrackingTest,
}) => {
  const {
    allYouthUsers,
    activeYouthOperation,
    allYouthOperations,
    loginYouthUser,
    loginAdultAsYouthAdmin,
    loginAdultIntoJointExercise,
  } = useYouth();

  const [activeTab, setActiveTab] = useState<'kids' | 'admin' | 'adult_joint'>('kids');
  
  // Kids PIN login state - pre-select first kid so PIN field & Start button are immediately visible
  const [selectedKidId, setSelectedKidId] = useState<string>(allYouthUsers[0]?.id || '');
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  // Trackingtest state for kids
  const [showYouthTestDuration, setShowYouthTestDuration] = useState<boolean>(false);

  // Adult login state
  const [adultUsername, setAdultUsername] = useState<string>('');
  const [adultPassword, setAdultPassword] = useState<string>('');
  const [adultError, setAdultError] = useState<string>('');

  // Confirmation dialog to prevent accidentally leaving to main app
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  // Status Badge for current Youth Operation
  const youthStatusBadge = (() => {
    if (!activeYouthOperation) {
      const planned = allYouthOperations.find((op) => op.status === 'planned');
      if (planned) {
        return {
          bg: 'bg-slate-800 border-slate-600 text-white',
          dot: 'bg-white',
          text: `⚪ Geplante Übung: ${planned.title}`,
        };
      }
      return {
        bg: 'bg-slate-900 border-slate-700 text-slate-300',
        dot: 'bg-slate-400',
        text: '⚪ Bereitschaft (Keine aktive Übung)',
      };
    }

    if (activeYouthOperation.status === 'active') {
      if (activeYouthOperation.type === 'joint') {
        return {
          bg: 'bg-purple-950/90 border-purple-500 text-purple-200 animate-pulse',
          dot: 'bg-purple-400',
          text: `🟣 Gemeinsame Übung AKTIV: ${activeYouthOperation.title}`,
        };
      }
      return {
        bg: 'bg-yellow-950/90 border-yellow-500 text-yellow-200 animate-pulse',
        dot: 'bg-yellow-400',
        text: `🟡 Jugend-Übung AKTIV: ${activeYouthOperation.title}`,
      };
    }

    // Paused
    return {
      bg: 'bg-orange-950/90 border-orange-500 text-orange-200',
      dot: 'bg-orange-400',
      text: `🟠 Übung PAUSIERT: ${activeYouthOperation.title}`,
    };
  })();

  const handleKidPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (!selectedKidId) {
      setPinError('Bitte wähle zuerst deinen Namen aus.');
      return;
    }
    const success = loginYouthUser(selectedKidId, pinInput);
    if (!success) {
      setPinError('Falsche PIN. Bitte frage deine Jugendleitung!');
      setPinInput('');
    }
  };

  const handleAdultAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdultError('');
    const foundAdult = adultUsers.find(
      (u) =>
        u.username.toLowerCase() === adultUsername.trim().toLowerCase() ||
        u.name.toLowerCase() === adultUsername.trim().toLowerCase()
    );

    if (!foundAdult) {
      setAdultError('Erwachsenen-Benutzerkonto nicht gefunden.');
      return;
    }

    if (!isUserAdmin(foundAdult)) {
      setAdultError('Nur Erwachsene mit Admin-Rechten der Einsatzzentrale dürfen die Jugendgruppe leiten.');
      return;
    }

    // Check password
    const pass = adultPassword.trim();
    if (foundAdult.password && foundAdult.password !== pass) {
      setAdultError('Ungültiges Kennwort.');
      return;
    }
    if (!foundAdult.password && pass !== 'admin123') {
      setAdultError('Ungültiges Kennwort.');
      return;
    }

    loginAdultAsYouthAdmin(foundAdult);
  };

  const handleAdultJointLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdultError('');
    const foundAdult = adultUsers.find(
      (u) =>
        u.username.toLowerCase() === adultUsername.trim().toLowerCase() ||
        u.name.toLowerCase() === adultUsername.trim().toLowerCase()
    );

    if (!foundAdult) {
      setAdultError('Erwachsenen-Benutzerkonto nicht gefunden.');
      return;
    }

    // Check password
    const pass = adultPassword.trim();
    if (foundAdult.password && foundAdult.password !== pass) {
      setAdultError('Ungültiges Kennwort.');
      return;
    }
    if (!foundAdult.password && pass !== 'sucher123' && pass !== 'admin123') {
      setAdultError('Ungültiges Kennwort.');
      return;
    }

    loginAdultIntoJointExercise(foundAdult);
  };

  return (
    <div
      className="w-full min-h-full bg-[#000E66] text-white flex flex-col justify-start items-center p-2.5 sm:p-5 pt-3 sm:pt-6 pb-36 sm:pb-44 relative font-sans"
      style={{
        background: 'radial-gradient(circle at center, #001A9E 0%, #000B52 100%)',
      }}
    >
      {/* Top Header & Back Button */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-2 z-10 shrink-0">
        <button
          type="button"
          onClick={() => setShowExitConfirm(true)}
          className="px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer shadow-lg active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Einsatzzentrale</span>
        </button>

        <span className="text-[10px] sm:text-[11px] font-mono font-bold text-amber-300 bg-amber-950/80 border border-amber-600/60 px-2 py-0.5 rounded-full shadow-sm">
          👶 U18 – Nur Übungsbetrieb
        </span>
      </div>

      {/* Confirmation Modal: Really leave to main app? */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#000E66] border-2 border-cyan-400 rounded-3xl max-w-sm w-full p-5 text-white space-y-3.5 shadow-2xl text-center">
            <div className="text-3xl">↩️</div>
            <h3 className="text-base font-bold text-white font-mono uppercase">
              Zurück zur Haupt-Einsatzzentrale?
            </h3>
            <p className="text-xs text-blue-200 leading-relaxed font-sans">
              Möchtest du den Bereich der Spürhunde-Jugendgruppe wirklich verlassen und zur Haupt-App der Erwachsenen zurückkehren?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold uppercase cursor-pointer"
              >
                In Jugend bleiben
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false);
                  onExitYouthModule();
                }}
                className="flex-1 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black font-mono text-xs uppercase cursor-pointer shadow-lg"
              >
                Ja, zurück
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Card */}
      <div className="w-full max-w-2xl bg-[#000B52]/95 border-2 border-cyan-400/70 rounded-3xl p-3 sm:p-5 shadow-2xl relative z-10 flex flex-col gap-3">
        {/* Banner Title */}
        <div className="flex flex-col items-center text-center gap-1 border-b border-blue-700/60 pb-2.5">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-xl shadow-lg">
            🎒
          </div>
          <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight uppercase">
            Spürhunde Jugendgruppe
          </h1>
          <p className="text-[10px] sm:text-xs text-cyan-200 font-mono">
            SHS-EZ Nachwuchs &amp; Ausbildungszentrale
          </p>

          {/* Dynamic Youth Exercise Status */}
          <div className={`mt-0.5 px-2.5 py-0.5 rounded-xl border text-[10px] sm:text-[11px] font-bold font-mono flex items-center gap-1.5 shadow-sm ${youthStatusBadge.bg}`}>
            <span className={`w-2 h-2 rounded-full ${youthStatusBadge.dot}`} />
            <span>{youthStatusBadge.text}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#00083D] rounded-2xl border border-blue-900 text-xs font-mono font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('kids');
              setAdultError('');
            }}
            className={`py-1.5 px-2 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'kids'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>🎒</span>
            <span className="truncate">Jugend (U18)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setPinError('');
            }}
            className={`py-1.5 px-2 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="truncate">Jugend-Admin</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('adult_joint');
              setPinError('');
            }}
            className={`py-1.5 px-2 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'adult_joint'
                ? 'bg-purple-600 text-white shadow-md font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>🦺</span>
            <span className="truncate">Gemeinsam</span>
          </button>
        </div>

        {/* ── TAB 1: KIDS LOGIN ── */}
        {activeTab === 'kids' && (
          <div className="space-y-2.5 animate-in fade-in duration-200">
            <div className="text-center">
              <span className="text-[11px] sm:text-xs text-slate-300 font-sans block">
                Tippe auf deinen Namen und gib deine 4-stellige PIN ein:
              </span>
            </div>

            {/* Quick Kid Buttons - 4-spaltig in einer platzsparenden Reihe */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {allYouthUsers.map((kid) => {
                const isSelected = selectedKidId === kid.id;
                return (
                  <button
                    key={kid.id}
                    type="button"
                    onClick={() => {
                      setSelectedKidId(kid.id);
                      setPinError('');
                    }}
                    className={`p-1.5 sm:p-2 rounded-2xl border-2 flex flex-col items-center gap-1 transition cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 shadow-md ring-2 ring-cyan-400/50'
                        : 'bg-[#00083D] border-blue-900 hover:border-blue-600 text-slate-300'
                    }`}
                  >
                    <div
                      className="w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-bold text-white text-xs sm:text-sm shadow overflow-hidden border-2"
                      style={{
                        backgroundColor: kid.trackColor || '#38bdf8',
                        borderColor: isSelected ? '#38bdf8' : 'transparent',
                      }}
                    >
                      {kid.photoUrl ? (
                        <img
                          src={kid.photoUrl}
                          alt={kid.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{kid.name.charAt(0)}</span>
                      )}
                    </div>
                    <span className="text-[11px] sm:text-xs font-bold text-white truncate max-w-full">
                      {kid.name.split(' ')[0]}
                    </span>
                    <span className="text-[9px] text-cyan-300 font-mono">
                      {kid.age ? `${kid.age} J.` : 'Jugend'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* PIN Form - kompakt dimensioniert, Button & Feld vollständig nebeneinander */}
            <form
              onSubmit={handleKidPinSubmit}
              className="p-2.5 sm:p-3 rounded-2xl bg-[#00083D] border border-cyan-500/60 space-y-2 shadow-lg"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-cyan-200 font-mono flex items-center gap-1.5 truncate">
                  <Key className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                  <span className="truncate">
                    PIN für {allYouthUsers.find((k) => k.id === selectedKidId)?.name || 'dein Profil'}:
                  </span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">Standard: 1234</span>
              </div>

              <div className="flex items-center gap-2 w-full">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="PIN eingeben"
                  className="min-w-0 flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-center font-mono font-bold text-sm sm:text-base text-white tracking-widest focus:outline-none focus:border-cyan-400 placeholder:text-slate-500 placeholder:tracking-normal placeholder:font-sans placeholder:text-xs"
                />
                <button
                  type="submit"
                  className="shrink-0 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black font-mono text-xs uppercase tracking-wider transition cursor-pointer shadow-md flex items-center justify-center gap-1 active:scale-95 whitespace-nowrap"
                >
                  <span>Start</span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
              </div>

              {pinError && (
                <div className="p-2 rounded-xl bg-red-950/90 border border-red-500 text-red-200 text-[11px] font-mono flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                  <span>{pinError}</span>
                </div>
              )}
            </form>

            {/* ── SEPARATE FUNKTION: PERSÖNLICHER TRACKINGTEST FÜR KIDS ── */}
            <div className="space-y-1.5 pt-2 border-t border-blue-900/80">
              <div className="flex items-center gap-2 mb-0.5 px-1">
                <div className="h-px flex-1 bg-cyan-700/50" />
                <span className="text-[9px] font-bold text-cyan-300 uppercase tracking-widest font-mono">
                  Separate Funktion (Jederzeit verfügbar)
                </span>
                <div className="h-px flex-1 bg-cyan-700/50" />
              </div>

              <div className="w-full p-3 rounded-2xl bg-[#000840] border-2 border-cyan-400 text-left shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-bold uppercase flex items-center gap-1.5 text-cyan-200">
                    <span>🛰️</span> Persönlicher Trackingtest (GPS)
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded font-mono border font-bold bg-cyan-950 text-cyan-300 border-cyan-700">
                    10 / 20 / 30 Min.
                  </span>
                </div>
                <p className="text-[10px] text-blue-100 font-sans leading-relaxed">
                  Zeichnet deine eigene GPS-Spur auf der Karte auf, misst Strecke &amp; Zeit und erstellt dir dein Testprotokoll.
                </p>

                <div className="pt-1 space-y-1.5">
                  <span className="block text-[10px] font-bold text-cyan-300 uppercase tracking-wider font-mono text-center">
                    Testdauer wählen &amp; starten:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[10, 20, 30].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          const kidUser = allYouthUsers.find((k) => k.id === selectedKidId) || allYouthUsers[0];
                          const convertedUser: User = {
                            id: kidUser.id,
                            name: `${kidUser.name} (Jugend)`,
                            username: kidUser.username,
                            role: 'responder',
                            callSign: kidUser.callSign || `Jungspürer ${kidUser.name.split(' ')[0]}`,
                            licensePlate: 'JUGEND-GPS',
                            phone: kidUser.phone || '',
                            photoUrl: kidUser.photoUrl || '',
                            equipment: [],
                          };
                          if (onStartTrackingTest) {
                            onStartTrackingTest(convertedUser, d as 10 | 20 | 30);
                          }
                        }}
                        className="py-2.5 px-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 font-black font-mono text-xs uppercase flex items-center justify-center gap-1 shadow-md transition cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{d} Min.</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: YOUTH ADMIN LOGIN ── */}
        {activeTab === 'admin' && (
          <form
            onSubmit={handleAdultAdminLogin}
            autoComplete="off"
            className="space-y-4 animate-in fade-in duration-200"
          >
            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/50 text-xs text-amber-200 leading-relaxed font-sans">
              🛡️ <strong>Jugendleitung / Adminboard:</strong> Melde dich mit deinem bestehenden Erwachsenen-Admin-Account der App an. Es werden keine Daten der Erwachsenen in den Jugendbereich übertragen.
            </div>

            {/* Quick Admin Profile Selection */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 font-mono block">Schnellauswahl Admin:</span>
              <div className="flex flex-wrap gap-1.5">
                {adultUsers.filter(isUserAdmin).map((admin) => (
                  <button
                    key={admin.id}
                    type="button"
                    onClick={() => {
                      setAdultUsername(admin.username);
                      setAdultError('');
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-mono transition cursor-pointer flex items-center gap-1.5 ${
                      adultUsername.toLowerCase() === admin.username.toLowerCase()
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow'
                        : 'bg-[#00083D] border-blue-900 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span>🛡️</span>
                    <span>{admin.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Admin Benutzername / Funkrufname:</label>
                <input
                  type="text"
                  name="youth_admin_user"
                  autoComplete="off"
                  value={adultUsername}
                  onChange={(e) => setAdultUsername(e.target.value)}
                  placeholder="z.B. maria oder jens"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#00083D] border border-blue-900 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Kennwort / PIN:</label>
                <input
                  type="text"
                  name="youth_admin_secret"
                  autoComplete="off"
                  data-lpignore="true"
                  style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties}
                  value={adultPassword}
                  onChange={(e) => setAdultPassword(e.target.value)}
                  placeholder="Dein App-Kennwort"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#00083D] border border-blue-900 text-white focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>
            </div>

            {adultError && (
              <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-600 text-red-300 text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{adultError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider transition cursor-pointer shadow-lg flex items-center justify-center gap-2"
            >
              <Shield className="w-4 h-4" />
              <span>Als Jugend-Admin anmelden</span>
            </button>
          </form>
        )}

        {/* ── TAB 3: JOINT EXERCISE (TEAM ERWACHSENE) ── */}
        {activeTab === 'adult_joint' && (
          <form
            onSubmit={handleAdultJointLogin}
            autoComplete="off"
            className="space-y-4 animate-in fade-in duration-200"
          >
            <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/60 text-xs text-purple-200 leading-relaxed font-sans">
              🦺 <strong>Gemeinsame Übung („Erwachsene vs. Jugend“):</strong> Hier können sich erwachsene Einsatzkräfte mit ihrem bestehenden Account anmelden, um an der Übung der Jugendgruppe als Team Erwachsene teilzunehmen.
            </div>

            {/* Quick Adult Profile Selection */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 font-mono block">Schnellauswahl Erwachsene:</span>
              <div className="flex flex-wrap gap-1.5">
                {adultUsers.filter(u => u.role !== 'observer').map((adult) => (
                  <button
                    key={adult.id}
                    type="button"
                    onClick={() => {
                      setAdultUsername(adult.username);
                      setAdultError('');
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-mono transition cursor-pointer flex items-center gap-1.5 ${
                      adultUsername.toLowerCase() === adult.username.toLowerCase()
                        ? 'bg-purple-600 text-white border-purple-400 font-bold shadow'
                        : 'bg-[#00083D] border-blue-900 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span>🦺</span>
                    <span>{adult.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Erwachsenen-Benutzername / Funkrufname:</label>
                <input
                  type="text"
                  name="youth_joint_user"
                  autoComplete="off"
                  value={adultUsername}
                  onChange={(e) => setAdultUsername(e.target.value)}
                  placeholder="z.B. jule, jens, maria..."
                  className="w-full px-4 py-2.5 rounded-xl bg-[#00083D] border border-blue-900 text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Kennwort:</label>
                <input
                  type="text"
                  name="youth_joint_secret"
                  autoComplete="off"
                  data-lpignore="true"
                  style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties}
                  value={adultPassword}
                  onChange={(e) => setAdultPassword(e.target.value)}
                  placeholder="Kennwort"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#00083D] border border-blue-900 text-white focus:outline-none focus:border-purple-400 font-mono"
                />
              </div>
            </div>

            {adultError && (
              <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-600 text-red-300 text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{adultError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold font-mono text-xs uppercase tracking-wider transition cursor-pointer shadow-lg flex items-center justify-center gap-2"
            >
              <span>🦺 Als Team Erwachsene beitreten</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
