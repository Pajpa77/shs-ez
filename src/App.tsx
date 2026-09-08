import React, { useState, useEffect, Suspense, lazy } from 'react';
import { RescueProvider, useRescue } from './context/RescueContext';
import { useAlerts } from './hooks/useAlerts';
import { LoginScreen } from './components/LoginScreen';
import { Navbar } from './components/Navbar';
import { TacticalMap } from './components/TacticalMap';

// Lazy load heavy components
const OperationsArchive = lazy(() => import('./components/OperationsArchive').then(m => ({ default: m.OperationsArchive })));
const SectorOverview = lazy(() => import('./components/SectorOverview').then(m => ({ default: m.SectorOverview })));
const ChatPanel = lazy(() => import('./components/ChatPanel').then(m => ({ default: m.ChatPanel })));
const ResponderList = lazy(() => import('./components/ResponderList').then(m => ({ default: m.ResponderList })));
const MissionLog = lazy(() => import('./components/MissionLog').then(m => ({ default: m.MissionLog })));

// Lazy load modals
const FindingModal = lazy(() => import('./components/FindingModal').then(m => ({ default: m.FindingModal })));
const FindingDetailModal = lazy(() => import('./components/FindingDetailModal').then(m => ({ default: m.FindingDetailModal })));
const SectorEditorModal = lazy(() => import('./components/SectorEditorModal').then(m => ({ default: m.SectorEditorModal })));
const UserManagementModal = lazy(() => import('./components/UserManagement').then(m => ({ default: m.UserManagementModal })));
const OperationCreatorModal = lazy(() => import('./components/OperationCreatorModal').then(m => ({ default: m.OperationCreatorModal })));
const OperationDetailModal = lazy(() => import('./components/OperationDetailModal').then(m => ({ default: m.OperationDetailModal })));
const OperationEndModal = lazy(() => import('./components/OperationEndModal').then(m => ({ default: m.OperationEndModal })));
const OperationPauseModal = lazy(() => import('./components/OperationPauseModal').then(m => ({ default: m.OperationPauseModal })));
const ProfileModal = lazy(() => import('./components/ProfileModal').then(m => ({ default: m.ProfileModal })));
const ShareAppModal = lazy(() => import('./components/ShareAppModal').then(m => ({ default: m.ShareAppModal })));
const SearchTeamsModal = lazy(() => import('./components/SearchTeamsModal').then(m => ({ default: m.SearchTeamsModal })));
import { TrackingTestOverlay } from './components/TrackingTestOverlay';
import { QuotaNotificationBanner } from './components/QuotaNotificationBanner';
import { DroneFeedWidget } from './components/DroneFeedWidget';

import { useWakeLock } from './hooks/useWakeLock';
import { usePWAInstall } from './hooks/usePWAInstall';

import { Finding, SearchSector, User } from './types';
import {
  AlertTriangle,
  Layers,
  Plus,
  Moon,
  Sun,
  Compass,
  Radio,
  RadioTower,
  Video,
  User as UserIcon,
  Shield,
  Eye,
  CheckCircle2,
  FileText,
  Archive,
  MapPin,
  MessageSquare,
  Users,
  Minus,
} from 'lucide-react';

const MainApp: React.FC = () => {
  const {
    currentUser,
    currentOperation,
    isOperationActive,
    setSectorStatus,
    chatMessages,
    unreadChatCount,
    markChatAsRead,
    activeAlertNotification,
    setActiveAlertNotification,
    isLogoutConfirmOpen,
    cancelLogout,
    confirmLogout,
    authNotification,
    clearAuthNotification,
    uiScale,
    setUiScale,
    activeTrackingTest,
    isQuotaExhausted,
    setQuotaExhausted
  } = useRescue();

  // Initialize push notifications & vibration alerts
  useAlerts(currentOperation);


  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  
  // Prevent accidental page leave
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (currentUser) {
        // Most modern browsers require setting returnValue to a non-empty string to trigger the dialog
        // The actual string is usually ignored and replaced by a browser-default message
        event.preventDefault();
        event.returnValue = ''; 
        return '';
      }
    };

    const handleUnload = () => {
      if (currentUser) {
        // Best-effort cleanup: Ensure local session is cleared on actual close
        // This ensures the user is "logged out" from the local perspective
        localStorage.removeItem('rescue_app_current_user_id_slk_v4');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, [currentUser]);

  // Activate Wake Lock if operation is active OR tracking test is active
  const isTrackingActive = !!(isOperationActive || activeTrackingTest);
  useWakeLock(isTrackingActive);

  // Apply UI Scale to document root
  useEffect(() => {
    document.documentElement.style.setProperty('--ui-scale', uiScale.toString());
  }, [uiScale]);

  const [activeTab, setActiveTab] = useState<'admin' | 'map' | 'sectors' | 'chat' | 'responders' | 'log' | 'archive' | 'reports'>('map');
  const [selectedArchiveOpId, setSelectedArchiveOpId] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [showDroneFeed, setShowDroneFeed] = useState(false);

  // Apply Dark Mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    }
  }, [isDarkMode]);

  // Sync with OS Theme changes dynamically
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    
    // Modern event listener
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Automatically clear unread badge when opening chat
  useEffect(() => {
    if (activeTab === 'chat') {
      markChatAsRead();
    }
  }, [activeTab, markChatAsRead]);

  // Modals state
  const [isFindingModalOpen, setIsFindingModalOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [sectorToEdit, setSectorToEdit] = useState<SearchSector | null>(null);
  const [isSectorEditorOpen, setIsSectorEditorOpen] = useState(false);
  const [isDrawingSector, setIsDrawingSector] = useState(false);
  const [pendingPolygon, setPendingPolygon] = useState<[number, number][] | undefined>(undefined);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [isOperationCreatorOpen, setIsOperationCreatorOpen] = useState(false);
  const [operationCreatorMode, setOperationCreatorMode] = useState<'create' | 'edit'>('create');
  const [isOperationDetailModalOpen, setIsOperationDetailModalOpen] = useState(false);
  const [isOperationEndModalOpen, setIsOperationEndModalOpen] = useState(false);
  const [isOperationPauseModalOpen, setIsOperationPauseModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isShareAppModalOpen, setIsShareAppModalOpen] = useState(false);
  const [isSearchTeamsModalOpen, setIsSearchTeamsModalOpen] = useState(false);
  const [directChatTarget, setDirectChatTarget] = useState<User | null>(null);

  // If not authenticated, show login
  if (!currentUser) {
    return <LoginScreen />;
  }

  const isAdmin = currentUser.role === 'admin';

  const isAnyModalOpen =
    isFindingModalOpen ||
    !!selectedFinding ||
    isSectorEditorOpen ||
    isUserManagementOpen ||
    isOperationCreatorOpen ||
    isOperationDetailModalOpen ||
    isOperationEndModalOpen ||
    isOperationPauseModalOpen ||
    isProfileOpen ||
    isShareAppModalOpen ||
    isSearchTeamsModalOpen;

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col bg-[#0F172A] font-sans text-slate-900 dark:text-slate-200 overflow-hidden select-none">
      <TrackingTestOverlay />
      {/* Active Alert Notification Modal */}
      {activeAlertNotification && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-red-950/90 border-2 border-red-500 rounded-2xl max-w-md w-full p-6 shadow-2xl text-white space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-xl shrink-0 shadow animate-pulse">
                🚨
              </div>
              <div>
                <h3 className="font-bold text-base text-red-200 uppercase tracking-wide">
                  {activeAlertNotification.title}
                </h3>
                <span className="text-[10px] text-red-300 font-mono">
                  {activeAlertNotification.timestamp}
                </span>
              </div>
            </div>
            <p className="text-sm text-black dark:text-slate-100 bg-red-900/50 p-3 rounded-xl border border-red-700 font-medium">
              {activeAlertNotification.message}
            </p>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveAlertNotification(null)}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer shadow-lg transition"
              >
                Zur Kenntnis genommen & Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {isLogoutConfirmOpen && currentUser && (
        <div className="fixed inset-0 z-[3500] flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1E293B] border-2 border-amber-500 rounded-2xl max-w-md w-full p-6 shadow-2xl text-white space-y-4 animate-in zoom-in-95 duration-200 font-mono">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-[#0F172A]mber-500 text-slate-950 flex items-center justify-center font-bold text-xl shrink-0 shadow">
                ⚠️
              </div>
              <div>
                <h3 className="font-bold text-base text-amber-300 uppercase tracking-wide">
                  Abmeldung bestätigen
                </h3>
                <span className="text-[10px] text-slate-400">
                  Sicherheitsabfrage für Einsatzkraft
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-700 font-sans leading-relaxed">
              Möchten Sie sich wirklich von Ihrem aktuellen Account abmelden?
              <br />
              <strong className="text-white font-mono mt-1 block">
                {currentUser.name} ({currentUser.callSign || currentUser.role})
              </strong>
              <span className="text-xs text-slate-400 block mt-1">
                Dieser Logout wird im Einsatzprotokoll dokumentiert und ändert Ihren Status auf offline.
              </span>
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={cancelLogout}
                className="px-4 py-2.5 bg-[#1E293B] hover:bg-slate-100 dark:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs uppercase cursor-pointer transition border border-slate-600"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer shadow-lg transition flex items-center gap-2"
              >
                <span>Ja, abmelden</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth / Login Success Notification Toast */}
      {authNotification && (
        <div className="fixed top-20 right-4 z-[3200] max-w-md bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-2xl p-4 shadow-2xl text-white flex items-center justify-between gap-4 animate-in slide-in-from-top-5 duration-200 font-mono">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400 text-blue-300 flex items-center justify-center shrink-0">
              {authNotification.type === 'login' ? '🟢' : '⚠️'}
            </div>
            <div>
              <div className="text-xs font-bold text-blue-200 uppercase">
                {authNotification.type === 'login' ? 'Anmeldung erfolgreich' : 'Abgemeldet'}
              </div>
              <div className="text-xs text-black dark:text-slate-100 font-sans mt-0.5">{authNotification.message}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{authNotification.timestamp}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={clearAuthNotification}
            className="p-1.5 rounded-lg bg-[#1E293B] hover:bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Quota Exhaustion Fallback Banner */}
      <QuotaNotificationBanner />

      {/* PWA Install Banner */}
      {(!isInstalled && (isInstallable || isIOS)) && (
        <div className="fixed bottom-20 left-4 right-4 z-[2500] bg-blue-900/90 border-2 border-blue-400 rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-lg">
              <Plus className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                App installieren für Hintergrund-Tracking
              </h3>
              <p className="text-xs text-blue-100 mt-1 leading-relaxed">
                {isIOS 
                  ? 'Tippe auf das Teilen-Icon und "Zum Home-Bildschirm", damit die Synchronisierung auch im Hintergrund zuverlässig funktioniert.'
                  : 'Installiere die App als Web-App, um eine stabile Echtzeit-Synchronisierung im Hintergrund zu gewährleisten.'}
              </p>
              {isInstallable && (
                <button
                  onClick={install}
                  className="mt-3 px-4 py-2 bg-white text-blue-900 rounded-lg font-bold text-xs uppercase tracking-wide transition active:scale-95 shadow-lg"
                >
                  Jetzt Installieren
                </button>
              )}
            </div>
            <button 
              onClick={() => { /* Could add a "dismiss" state if needed */ }}
              className="text-blue-300 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* UI Zoom Controls - Slim Sleek Floating Control */}
      <div className="fixed top-16 md:top-[76px] left-3 md:left-[320px] z-[900] pointer-events-auto flex items-center gap-1.5 bg-white dark:bg-slate-900/90 border border-[#1E293B] rounded-full px-2.5 py-1 shadow-lg backdrop-blur-md text-xs font-mono select-none ring-1 ring-white/10">
        <button
          onClick={() => setUiScale(Math.max(0.7, Number((uiScale - 0.05).toFixed(2))))}
          className="w-6 h-6 flex items-center justify-center rounded-full bg-[#1E293B] hover:bg-slate-100 dark:bg-slate-700 active:bg-blue-600 text-blue-400 active:text-white transition active:scale-90 cursor-pointer"
          title="UI Verkleinern"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] font-bold text-blue-400 px-0.5 min-w-[34px] text-center">
          {Math.round(uiScale * 100)}%
        </span>
        <button
          onClick={() => setUiScale(Math.min(1.4, Number((uiScale + 0.05).toFixed(2))))}
          className="w-6 h-6 flex items-center justify-center rounded-full bg-[#1E293B] hover:bg-slate-100 dark:bg-slate-700 active:bg-blue-600 text-blue-400 active:text-white transition active:scale-90 cursor-pointer"
          title="UI Vergrößern"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        {Math.abs(uiScale - 1.0) > 0.01 && (
          <button
            onClick={() => setUiScale(1.0)}
            className="text-[9px] font-bold text-slate-400 hover:text-slate-900 dark:hover:text-white px-1 hover:underline cursor-pointer transition border-l border-[#1E293B] ml-0.5 pl-1.5"
            title="UI Reset"
          >
            Reset
          </button>
        )}
        <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700/80 mx-1"></div>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="w-6 h-6 flex items-center justify-center rounded-full bg-[#1E293B] hover:bg-slate-100 dark:bg-slate-700 active:bg-blue-600 text-blue-400 active:text-white transition active:scale-90 cursor-pointer"
          title={isDarkMode ? "Light Mode aktivieren" : "Dark Mode aktivieren"}
        >
          {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
        {currentUser?.role === 'admin' && (
          <>
            <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700/80 mx-1"></div>
            <button
              onClick={() => setShowDroneFeed(!showDroneFeed)}
              className={`w-6 h-6 flex items-center justify-center rounded-full transition active:scale-90 cursor-pointer ${showDroneFeed ? 'bg-red-500 text-white' : 'bg-[#1E293B] text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              title="Drohnen-Feed ein/ausschalten"
            >
              <RadioTower className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Top Tactical Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSelectArchiveOp={(opId) => {
          setSelectedArchiveOpId(opId);
          setActiveTab('archive');
        }}
        onOpenFindingModal={() => setIsFindingModalOpen(true)}
        onOpenProfileModal={() => setIsProfileOpen(true)}
        onOpenLoginModal={() => {}}
        onOpenEndOperationModal={() => setIsOperationEndModalOpen(true)}
        onOpenPauseOperationModal={() => setIsOperationPauseModalOpen(true)}
        onOpenCreateOperationModal={() => {
          setOperationCreatorMode('create');
          setIsOperationCreatorOpen(true);
        }}
        onOpenEditOperationModal={() => {
          setOperationCreatorMode('edit');
          setIsOperationCreatorOpen(true);
        }}
        onOpenOperationDetailModal={() => {
          setIsOperationDetailModalOpen(true);
        }}
        onStartDrawingSector={() => {
          setActiveTab('map');
          setSectorToEdit(null);
          setPendingPolygon(undefined);
          setIsDrawingSector(true);
        }}
        onOpenCreateUserModal={() => {
          setUserToEdit(null);
          setIsUserManagementOpen(true);
        }}
        onOpenEditUser={(user) => {
          setUserToEdit(user);
          setIsUserManagementOpen(true);
        }}
        onOpenShareAppModal={() => setIsShareAppModalOpen(true)}
        isAnyModalOpen={isAnyModalOpen}
      />

      {/* Main Tab Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#0F172A]">
        <Suspense fallback={
          <div className="flex-1 flex flex-col items-center justify-center bg-[#0F172A] text-blue-400 font-mono animate-pulse">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <div className="text-xs uppercase tracking-widest">Initialisierung...</div>
          </div>
        }>
          {activeTab === 'map' && (
            <div className="flex-1 relative flex flex-col h-full w-full">
              <TacticalMap
                onSelectArchiveOp={(opId) => {
                  setSelectedArchiveOpId(opId);
                  setActiveTab('archive');
                }}
                onOpenFindingDetail={(f) => setSelectedFinding(f)}
                onOpenSectorEditor={(s) => {
                  setSectorToEdit(s);
                  setIsSectorEditorOpen(true);
                }}
                onStartFreehandDrawing={() => {
                  setSectorToEdit(null);
                  setPendingPolygon(undefined);
                  setIsDrawingSector(true);
                }}
                isDrawingSector={isDrawingSector}
                onFinishDrawing={(coords) => {
                  setPendingPolygon(coords);
                  setIsDrawingSector(false);
                  setIsSectorEditorOpen(true);
                }}
                onCancelDrawing={() => {
                  setIsDrawingSector(false);
                }}
                onOpenDirectChat={(user) => {
                  setDirectChatTarget(user);
                  setActiveTab('chat');
                }}
              />

            {/* Geometric Floating Action & Tab Dock */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 sm:py-2.5 bg-[#0F172A]/95 border border-slate-700 rounded-2xl shadow-2xl backdrop-blur-md z-[850] max-w-[95vw]">
              <button
                onClick={() => setActiveTab('responders')}
                className="flex flex-col items-center gap-1 w-14 sm:w-20 group cursor-pointer"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#1E293B] border border-slate-600 flex items-center justify-center group-hover:bg-slate-700 transition">
                  <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                </div>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tighter text-slate-300">Kräfte</span>
              </button>

              <div className="h-8 sm:h-10 w-px bg-slate-100 dark:bg-slate-700"></div>

              {/* Central Prominent FUND! Action */}
              <button
                onClick={() => {
                  if (currentUser?.role !== 'observer' && currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused')) {
                    setIsFindingModalOpen(true);
                  }
                }}
                disabled={currentUser?.role === 'observer' || !currentOperation || (currentOperation.status !== 'active' && currentOperation.status !== 'paused')}
                className={`flex flex-col items-center gap-1 w-16 sm:w-20 group transition ${(currentUser?.role === 'observer' || !currentOperation || (currentOperation.status !== 'active' && currentOperation.status !== 'paused')) ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}`}
              >
                <div className={`w-11 h-11 sm:w-14 sm:h-14 -mt-2.5 sm:-mt-3 rounded-full border-4 border-slate-900 flex items-center justify-center transition active:scale-95 ${(currentUser?.role === 'observer' || !currentOperation || (currentOperation.status !== 'active' && currentOperation.status !== 'paused')) ? 'bg-slate-100 dark:bg-slate-700' : 'bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.5)] group-hover:bg-red-500 animate-pulse'}`}>
                  <AlertTriangle className={`w-5 h-5 sm:w-6 sm:h-6 ${(currentUser?.role === 'observer' || !currentOperation || (currentOperation.status !== 'active' && currentOperation.status !== 'paused')) ? 'text-slate-400' : 'text-white'}`} />
                </div>
                <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${(currentUser?.role === 'observer' || !currentOperation || (currentOperation.status !== 'active' && currentOperation.status !== 'paused')) ? 'text-slate-500' : 'text-red-500'}`}>FUND!</span>
              </button>

              <div className="h-8 sm:h-10 w-px bg-slate-100 dark:bg-slate-700"></div>

              <button
                onClick={() => setActiveTab('chat')}
                className="flex flex-col items-center gap-1 w-14 sm:w-20 group cursor-pointer relative"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#1E293B] border border-slate-600 flex items-center justify-center group-hover:bg-slate-700 transition">
                  <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                </div>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tighter text-slate-300">Funk</span>
                {unreadChatCount > 0 && (
                  <span className="absolute top-0 right-2 w-4 h-4 rounded-full bg-emerald-500 text-slate-950 font-bold text-[9px] flex items-center justify-center animate-pulse">
                    {unreadChatCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'sectors' && (
          <div className="flex-1 overflow-y-auto pb-16 bg-[#0F172A]">
            <SectorOverview
              onOpenSectorEditor={(sec) => {
                setSectorToEdit(sec || null);
                setIsSectorEditorOpen(true);
              }}
              onFocusSectorOnMap={() => {
                setActiveTab('map');
              }}
              onOpenSearchTeams={() => setIsSearchTeamsModalOpen(true)}
            />
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden bg-[#0F172A]">
            <ChatPanel initialDirectUser={directChatTarget} />
          </div>
        )}

        {activeTab === 'responders' && (
          <div className="flex-1 overflow-y-auto pb-16 bg-[#0F172A]">
            <ResponderList
              onOpenCreateUser={() => {
                setUserToEdit(null);
                setIsUserManagementOpen(true);
              }}
              onOpenDirectChat={(user) => {
                setDirectChatTarget(user);
                setActiveTab('chat');
              }}
              onOpenSearchTeams={() => setIsSearchTeamsModalOpen(true)}
              onFocusUserOnMap={() => setActiveTab('map')}
            />
          </div>
        )}

        {activeTab === 'log' && (
          <div className="flex-1 overflow-y-auto pb-16 bg-[#0F172A]">
            <MissionLog />
          </div>
        )}

        {activeTab === 'archive' && (
          <div className="flex-1 overflow-y-auto pb-16 bg-[#0F172A]">
            <OperationsArchive
              onNavigateToMap={() => setActiveTab('map')}
              initialSelectedOpId={selectedArchiveOpId}
              onSelectOpId={setSelectedArchiveOpId}
            />
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="flex-1 overflow-y-auto pb-16 bg-[#0F172A]">
            <OperationsArchive
              onNavigateToMap={() => setActiveTab('map')}
              initialSelectedOpId={selectedArchiveOpId}
              onSelectOpId={setSelectedArchiveOpId}
              initialSubTab="report"
            />
          </div>
        )}
        </Suspense>
      </main>

      {/* Permanent Bottom Navigation Bar (Visible in all orientations including Landscape) */}
      <nav className="h-14 bg-[#0F172A]/95 border-t border-[#1E293B] flex items-center justify-around px-2 sm:px-6 z-[900] shrink-0 font-mono text-[10px] select-none">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex flex-col items-center justify-center min-w-[50px] sm:min-w-[64px] py-1 px-2 rounded-xl transition cursor-pointer ${
            activeTab === 'map' ? 'text-blue-400 bg-[#1E293B] font-bold border border-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span className="mt-0.5">Karte</span>
        </button>

        <button
          onClick={() => setActiveTab('sectors')}
          className={`flex flex-col items-center justify-center min-w-[50px] sm:min-w-[64px] py-1 px-2 rounded-xl transition cursor-pointer ${
            activeTab === 'sectors' ? 'text-blue-400 bg-[#1E293B] font-bold border border-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span className="mt-0.5">Sektoren</span>
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center justify-center min-w-[50px] sm:min-w-[64px] py-1 px-2 rounded-xl transition cursor-pointer relative ${
            activeTab === 'chat' ? 'text-blue-400 bg-[#1E293B] font-bold border border-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span className="mt-0.5">Funk</span>
          {unreadChatCount > 0 && (
            <span className="absolute top-0.5 right-1 sm:right-2 w-3.5 h-3.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[8px] flex items-center justify-center animate-pulse">
              {unreadChatCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('responders')}
          className={`flex flex-col items-center justify-center min-w-[50px] sm:min-w-[64px] py-1 px-2 rounded-xl transition cursor-pointer ${
            activeTab === 'responders' ? 'text-blue-400 bg-[#1E293B] font-bold border border-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="mt-0.5">Kräfte</span>
        </button>

        <button
          onClick={() => setActiveTab('log')}
          className={`flex flex-col items-center justify-center min-w-[50px] sm:min-w-[64px] py-1 px-2 rounded-xl transition cursor-pointer ${
            activeTab === 'log' ? 'text-blue-400 bg-[#1E293B] font-bold border border-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span className="mt-0.5">Protokoll</span>
        </button>

        <button
          onClick={() => setActiveTab('archive')}
          className={`flex flex-col items-center justify-center min-w-[50px] sm:min-w-[64px] py-1 px-2 rounded-xl transition cursor-pointer ${
            activeTab === 'archive' ? 'text-blue-400 bg-[#1E293B] font-bold border border-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span className="mt-0.5">Archiv</span>
        </button>
      </nav>

      {/* Modals */}
      <Suspense fallback={null}>
        <FindingModal
          isOpen={isFindingModalOpen}
          onClose={() => setIsFindingModalOpen(false)}
        />

      <FindingDetailModal
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
      />

      <SectorEditorModal
        sector={sectorToEdit}
        isOpen={isSectorEditorOpen}
        pendingPolygon={pendingPolygon}
        onStartDrawing={() => {
          setIsSectorEditorOpen(false);
          setActiveTab('map');
          setIsDrawingSector(true);
        }}
        onClose={() => {
          setIsSectorEditorOpen(false);
          setSectorToEdit(null);
          setPendingPolygon(undefined);
        }}
      />

      <UserManagementModal
        userToEdit={userToEdit}
        isOpen={isUserManagementOpen}
        onClose={() => {
          setIsUserManagementOpen(false);
          setUserToEdit(null);
        }}
      />

      <OperationCreatorModal
        isOpen={isOperationCreatorOpen}
        mode={operationCreatorMode}
        onClose={() => setIsOperationCreatorOpen(false)}
        onStartDrawingSector={() => {
          setActiveTab('map');
          setSectorToEdit(null);
          setPendingPolygon(undefined);
          setIsDrawingSector(true);
        }}
      />

      <OperationDetailModal
        isOpen={isOperationDetailModalOpen}
        onClose={() => setIsOperationDetailModalOpen(false)}
        onOpenEditOperation={() => {
          setIsOperationDetailModalOpen(false);
          setOperationCreatorMode('edit');
          setIsOperationCreatorOpen(true);
        }}
        onNavigateToMapPoint={() => {
          setIsOperationDetailModalOpen(false);
          setActiveTab('map');
        }}
      />

      <OperationEndModal
        isOpen={isOperationEndModalOpen}
        onClose={() => setIsOperationEndModalOpen(false)}
        onSuccessNavigateToMap={() => {
          setIsOperationEndModalOpen(false);
          setActiveTab('map');
        }}
      />

      <OperationPauseModal
        isOpen={isOperationPauseModalOpen}
        onClose={() => setIsOperationPauseModalOpen(false)}
        onSuccessNavigateToMap={() => {
          setIsOperationPauseModalOpen(false);
          setActiveTab('map');
        }}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <ShareAppModal
        isOpen={isShareAppModalOpen}
        onClose={() => setIsShareAppModalOpen(false)}
      />

      <SearchTeamsModal
        isOpen={isSearchTeamsModalOpen}
        onClose={() => setIsSearchTeamsModalOpen(false)}
      />
      {showDroneFeed && currentUser?.role === 'admin' && (
        <DroneFeedWidget onClose={() => setShowDroneFeed(false)} />
      )}
      </Suspense>
    </div>
  );
};

export default function App() {
  return (
    <RescueProvider>
      <MainApp />
    </RescueProvider>
  );
}
