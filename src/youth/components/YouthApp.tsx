import React, { useState } from 'react';
import { useYouth } from '../YouthContext';
import { useWakeLock } from '../../hooks/useWakeLock';
import { YouthTacticalMap } from './YouthTacticalMap';
import { YouthChat } from './YouthChat';
import { YouthAdminBoard } from './YouthAdminBoard';
import { YouthKnowledgeCenter } from './YouthKnowledgeCenter';
import { YouthFindingModal } from './YouthFindingModal';
import { YouthQuizModal } from './YouthQuizModal';
import { YouthMemberCardModal } from './YouthMemberCardModal';
import { YouthMemberEditModal } from './YouthMemberEditModal';
import { generateYouthDiplomaPDF } from '../youthPdfExport';
import { YouthSector } from '../types';
import {
  Compass,
  Radio,
  Shield,
  LogOut,
  Target,
  ArrowLeft,
  Sparkles,
  Users,
  CheckCircle2,
  Clock,
  Layers,
  Award,
  BookOpen,
} from 'lucide-react';

interface YouthAppProps {
  onExitYouthModule: () => void;
}

export const YouthApp: React.FC<YouthAppProps> = ({ onExitYouthModule }) => {
  const {
    currentYouthUser,
    currentYouthOperation,
    activeYouthOperation,
    updateYouthOperation,
    updateYouthUser,
    logoutYouth,
  } = useYouth();

  const [activeTab, setActiveTab] = useState<'map' | 'chat' | 'tasks' | 'knowledge' | 'admin'>('map');
  const [isFindingModalOpen, setIsFindingModalOpen] = useState(false);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [isMemberCardModalOpen, setIsMemberCardModalOpen] = useState(false);
  const [isSelfProfileModalOpen, setIsSelfProfileModalOpen] = useState(false);

  // Keep phone screen awake and GPS heartbeat active during active/paused exercises or ready status (identisch zur Haupt-App)
  const isTrackingActive = Boolean(
    currentYouthUser?.isActive &&
      (currentYouthOperation?.status === 'active' ||
        currentYouthOperation?.status === 'paused' ||
        currentYouthUser?.arrivalStatus === 'ready')
  );
  useWakeLock(isTrackingActive);

  // Confirmation dialogs to avoid accidental exit/logout
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Map drawing state pass-through
  const [drawingSectorData, setDrawingSectorData] = useState<{
    name: string;
    targetTeam: 'jugend' | 'erwachsene' | 'all';
  } | null>(null);

  const isAdmin = currentYouthUser?.role === 'youth_admin';
  const isJoint = currentYouthOperation?.type === 'joint';

  // Dynamic Op Badge
  const statusTheme = (() => {
    if (!currentYouthOperation) {
      return { bg: 'bg-slate-800 text-slate-300 border-slate-700', text: '⚪ Bereitschaft' };
    }
    if (currentYouthOperation.status === 'active') {
      return isJoint
        ? { bg: 'bg-purple-950 text-purple-300 border-purple-500 animate-pulse', text: '🟣 Gemeinsam Aktiv' }
        : { bg: 'bg-amber-950 text-amber-300 border-amber-500 animate-pulse', text: '🟡 Jugend-Übung Aktiv' };
    }
    if (currentYouthOperation.status === 'paused') {
      return { bg: 'bg-orange-950 text-orange-300 border-orange-500', text: '🟠 Pausiert' };
    }
    return { bg: 'bg-slate-900 text-slate-300 border-slate-700', text: '⚪ Geplant' };
  })();

  const handleStartMapDrawing = (sectorName: string, targetTeam: 'jugend' | 'erwachsene' | 'all') => {
    setDrawingSectorData({ name: sectorName, targetTeam });
    setActiveTab('map');
  };

  const handleFinishDrawingSector = (coords: [number, number][]) => {
    if (!currentYouthOperation || !drawingSectorData) return;

    const newSector: YouthSector = {
      id: `sec-${Date.now()}`,
      name: drawingSectorData.name,
      polygon: coords,
      status: 'open',
      assignedTeam: drawingSectorData.targetTeam,
      color: drawingSectorData.targetTeam === 'erwachsene' ? '#10b981' : '#38bdf8',
    };

    const updatedSectors = [...(currentYouthOperation.sectors || []), newSector];
    updateYouthOperation(currentYouthOperation.id, { sectors: updatedSectors });

    setDrawingSectorData(null);
  };

  const handleCancelDrawingSector = () => {
    setDrawingSectorData(null);
  };

  return (
    <div className="flex flex-col h-[100dvh] w-screen bg-[#000529] text-white overflow-hidden font-sans select-none">
      {/* ── TOP YOUTH NAVIGATION BAR ── */}
      <header className="h-16 sm:h-20 bg-[#000E66] border-b-2 border-blue-900 flex items-center justify-between px-3 sm:px-6 z-20 shrink-0 shadow-xl gap-2">
        {/* Left: Branding & Role */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            className="p-2 sm:p-2.5 rounded-xl bg-blue-900/90 hover:bg-blue-800 text-cyan-300 transition flex items-center gap-1.5 cursor-pointer text-xs font-mono shrink-0 border border-blue-700/80 shadow-md active:scale-95"
            title="Zurück zum Hauptmenü (Bestätigung erforderlich)"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden md:inline">Einsatzzentrale</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl sm:text-3xl animate-bounce shrink-0">🐕</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-black text-sm sm:text-base tracking-wider font-mono text-cyan-300 uppercase leading-none truncate">
                  Spürhunde Jugend
                </h1>
                <span className="text-[10px] sm:text-xs bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded font-black font-mono shrink-0">
                  U18
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-blue-200 font-mono mt-0.5 truncate font-semibold">
                {currentYouthUser?.name || 'Gast'} ({currentYouthUser?.callSign || 'U18'})
              </p>
            </div>
          </div>
        </div>

        {/* Right: Op Status Pill & Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border shadow-sm ${statusTheme.bg}`}
          >
            <span>{statusTheme.text}</span>
          </div>

          {currentYouthUser && (
            <>
              {/* Profil & Foto bearbeiten für Kids - groß und übersichtlich im Hochformat */}
              <button
                type="button"
                onClick={() => setIsSelfProfileModalOpen(true)}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition cursor-pointer flex items-center gap-1.5 sm:gap-2 shadow-lg active:scale-95 border-2 border-white/60 shrink-0"
                title="Mein Profil bearbeiten & Foto ändern"
              >
                {currentYouthUser.photoUrl ? (
                  <img
                    src={currentYouthUser.photoUrl}
                    alt={currentYouthUser.name}
                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover border-2 border-slate-950 shadow-sm shrink-0"
                  />
                ) : (
                  <span className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-950 text-cyan-300 font-black text-xs sm:text-sm flex items-center justify-center shrink-0">
                    {currentYouthUser.name.charAt(0)}
                  </span>
                )}
                <span className="text-xs sm:text-sm font-mono font-black uppercase tracking-tight">Profil</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMemberCardModalOpen(true)}
                className="p-2 sm:p-2.5 rounded-2xl bg-blue-900/90 hover:bg-blue-800 text-amber-300 border border-blue-700/80 transition cursor-pointer shadow-md text-base sm:text-lg active:scale-95"
                title="Dienstausweis anzeigen"
              >
                <span>🪪</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="p-2 sm:p-2.5 rounded-2xl bg-slate-900 hover:bg-red-950 text-slate-400 hover:text-red-400 border border-slate-700/80 transition cursor-pointer shadow-md active:scale-95"
            title="Abmelden"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT VIEW ── */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {/* TAB 1: TACTICAL MAP */}
        {activeTab === 'map' && (
          <YouthTacticalMap
            onOpenFindingModal={() => setIsFindingModalOpen(true)}
            drawingSectorData={drawingSectorData}
            onFinishDrawingSector={handleFinishDrawingSector}
            onCancelDrawingSector={handleCancelDrawingSector}
          />
        )}

        {/* TAB 2: YOUTH RADIO CHAT */}
        {activeTab === 'chat' && <YouthChat />}

        {/* TAB 3: ADMIN BOARD (Admins only) */}
        {activeTab === 'admin' && isAdmin && (
          <YouthAdminBoard
            onNavigateToMap={() => setActiveTab('map')}
            onStartMapDrawing={handleStartMapDrawing}
          />
        )}

        {/* TAB 4: TASKS & MISSING PERSON BRIEFING */}
        {activeTab === 'tasks' && (
          <div className="flex-1 p-3 sm:p-8 overflow-y-auto max-w-3xl mx-auto w-full space-y-4 sm:space-y-6 pb-24">
            <div className="p-4 sm:p-6 rounded-3xl bg-[#000E66] border border-blue-900 shadow-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30 shrink-0">
                  <Target className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block">
                    Aktuelle Übungsaufgabe
                  </span>
                  <h2 className="text-base sm:text-xl font-black text-white">
                    {currentYouthOperation?.title || 'Bereitschaft / Noch keine Übung aktiv'}
                  </h2>
                </div>
              </div>

              {currentYouthOperation && (
                <div className="space-y-3 sm:space-y-4 text-xs font-sans border-t border-blue-900 pt-3 text-slate-200">
                  <div className="bg-[#00083D] p-3 sm:p-4 rounded-2xl border border-blue-900 space-y-1">
                    <span className="text-[10px] font-mono text-cyan-300 uppercase block font-bold">
                      🎯 Übungsziel &amp; Auftrag:
                    </span>
                    <p className="text-xs sm:text-sm font-medium text-white">
                      {currentYouthOperation.trainingGoal}
                    </p>
                  </div>

                  <div className="bg-[#00083D] p-3 sm:p-4 rounded-2xl border border-blue-900 space-y-2">
                    <span className="text-[10px] font-mono text-amber-300 uppercase block font-bold">
                      🧸 Zu findendes Zielobjekt:
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl sm:text-3xl">🦺</span>
                      <div>
                        <strong className="text-sm sm:text-base text-white block">
                          {currentYouthOperation.missingTarget.name}
                        </strong>
                        <p className="text-xs text-slate-300">
                          {currentYouthOperation.missingTarget.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 rounded-2xl bg-[#00083D] border border-blue-900">
                      <span className="text-[10px] text-slate-400 uppercase font-mono block">
                        📍 Treffpunkt:
                      </span>
                      <span className="font-bold text-white block mt-0.5">
                        {currentYouthOperation.locationName}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-[#00083D] border border-blue-900">
                      <span className="text-[10px] text-slate-400 uppercase font-mono block">
                        🛡️ Übungsleitung:
                      </span>
                      <span className="font-bold text-cyan-300 block mt-0.5">
                        {currentYouthOperation.leaderName}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Diplom Download Button */}
            {currentYouthUser && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => generateYouthDiplomaPDF(currentYouthUser, currentYouthOperation, 2500)}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black font-mono text-xs uppercase tracking-wider transition cursor-pointer shadow-xl flex items-center justify-center gap-2 transform active:scale-95"
                >
                  <Award className="w-4 h-4" />
                  <span>Mein Spürhunde-Diplom herunterladen (PDF)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: WISSEN, QUIZ & ERSTE HILFE LEITFADEN ── */}
        {activeTab === 'knowledge' && <YouthKnowledgeCenter />}
      </main>

      {/* ── BOTTOM NAVIGATION BAR ── */}
      <nav className="h-14 bg-[#000E66] border-t border-blue-900 flex items-center justify-around px-1 sm:px-6 z-20 shrink-0 font-mono text-[10px] select-none shadow-lg">
        <button
          type="button"
          onClick={() => setActiveTab('map')}
          className={`flex flex-col items-center justify-center min-w-[55px] py-1 px-2 rounded-xl transition cursor-pointer ${
            activeTab === 'map'
              ? 'text-cyan-300 bg-[#000529] font-bold border border-cyan-400/50 shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span className="mt-0.5">Karte</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center justify-center min-w-[55px] py-1 px-2 rounded-xl transition cursor-pointer ${
            activeTab === 'chat'
              ? 'text-cyan-300 bg-[#000529] font-bold border border-cyan-400/50 shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span className="mt-0.5">Übungsfunk</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          className={`flex flex-col items-center justify-center min-w-[55px] py-1 px-2 rounded-xl transition cursor-pointer ${
            activeTab === 'tasks'
              ? 'text-cyan-300 bg-[#000529] font-bold border border-cyan-400/50 shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Target className="w-4 h-4" />
          <span className="mt-0.5">Aufgabe</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('knowledge')}
          className={`flex flex-col items-center justify-center min-w-[55px] py-1 px-2 rounded-xl transition cursor-pointer ${
            activeTab === 'knowledge'
              ? 'text-yellow-300 bg-[#000529] font-bold border border-yellow-400/50 shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span className="mt-0.5">Wissen</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center justify-center min-w-[55px] py-1 px-2 rounded-xl transition cursor-pointer ${
              activeTab === 'admin'
                ? 'text-amber-300 bg-[#000529] font-bold border border-amber-500/60 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="mt-0.5">Admin</span>
          </button>
        )}
      </nav>

      {/* Safety Confirmation Modal: Exit to Main App */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-[#000E66] border border-cyan-400 rounded-3xl max-w-sm w-full p-5 text-white space-y-3.5 shadow-2xl text-center">
            <div className="text-3xl">↩️</div>
            <h3 className="text-base font-bold text-white font-mono uppercase">
              Zurück zum Hauptmenü?
            </h3>
            <p className="text-xs text-blue-200 leading-relaxed font-sans">
              Möchtest du den Bereich der Jugendgruppe verlassen und zur Startauswahl der SHS-EZ App zurückkehren?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-mono text-xs uppercase cursor-pointer"
              >
                Bleiben
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false);
                  onExitYouthModule();
                }}
                className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs uppercase cursor-pointer shadow"
              >
                Ja, verlassen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Confirmation Modal: Logout */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-[#000E66] border border-red-500 rounded-3xl max-w-sm w-full p-5 text-white space-y-3.5 shadow-2xl text-center">
            <div className="text-3xl">🚪</div>
            <h3 className="text-base font-bold text-red-300 font-mono uppercase">
              Wirklich abmelden?
            </h3>
            <p className="text-xs text-slate-200 leading-relaxed font-sans">
              Du wirst abgemeldet und musst deine 4-stellige PIN bzw. dein Passwort erneut eingeben.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-mono text-xs uppercase cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logoutYouth();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-xs uppercase cursor-pointer shadow"
              >
                Abmelden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finding Modal */}
      <YouthFindingModal
        isOpen={isFindingModalOpen}
        onClose={() => setIsFindingModalOpen(false)}
      />

      {/* Quiz Modal */}
      <YouthQuizModal
        isOpen={isQuizModalOpen}
        onClose={() => setIsQuizModalOpen(false)}
      />

      {/* Member Card Modal */}
      <YouthMemberCardModal
        member={currentYouthUser}
        isOpen={isMemberCardModalOpen}
        onClose={() => setIsMemberCardModalOpen(false)}
        onOpenEditProfile={() => setIsSelfProfileModalOpen(true)}
      />

      {/* Self Profile Edit Modal (Eigenes Profil bearbeiten, Löschen deaktiviert) */}
      {currentYouthUser && (
        <YouthMemberEditModal
          member={currentYouthUser}
          isOpen={isSelfProfileModalOpen}
          isSelfEdit={true}
          onClose={() => setIsSelfProfileModalOpen(false)}
          onSave={(updatedData) => {
            updateYouthUser(currentYouthUser.id, updatedData);
            setIsSelfProfileModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
