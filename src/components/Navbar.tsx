import React, { useState, useEffect } from 'react';
import { useRescue } from '../context/RescueContext';
import { User, isFirstAdmin } from '../types';
import {
  Shield,
  Radio,
  MapPin,
  Flame,
  Activity,
  AlertCircle,
  Users,
  MessageSquare,
  FileText,
  Archive,
  Layers,
  Sparkles,
  Zap,
  LogOut,
  UserCheck,
  ChevronDown,
  Navigation,
  CheckCircle,
  Cloud,
  CloudOff,
  Wifi,
  WifiOff,
  PenTool,
  PlusCircle,
  Edit3,
  StopCircle,
  UserPlus,
  AlertTriangle,
  Menu,
  Trash2,
  RotateCcw,
  Share2,
  QrCode,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'map' | 'sectors' | 'chat' | 'responders' | 'log' | 'archive' | 'admin' | 'reports';
  setActiveTab: (tab: 'map' | 'sectors' | 'chat' | 'responders' | 'log' | 'archive' | 'admin' | 'reports') => void;
  onOpenFindingModal: () => void;
  onOpenProfileModal: () => void;
  onOpenLoginModal: () => void;
  onOpenEndOperationModal?: () => void;
  onOpenPauseOperationModal?: () => void;
  onOpenCreateOperationModal?: () => void;
  onOpenEditOperationModal?: () => void;
  onOpenOperationDetailModal?: () => void;
  onOpenCreateUserModal?: () => void;
  onOpenEditUser?: (user: User) => void;
  onStartDrawingSector?: () => void;
  onOpenShareAppModal?: () => void;
  isAnyModalOpen?: boolean;
  onSelectArchiveOp?: (opId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenFindingModal,
  onOpenProfileModal,
  onOpenLoginModal,
  onOpenEndOperationModal,
  onOpenPauseOperationModal,
  onOpenCreateOperationModal,
  onOpenEditOperationModal,
  onOpenOperationDetailModal,
  onOpenCreateUserModal,
  onOpenEditUser,
  onStartDrawingSector,
  onOpenShareAppModal,
  isAnyModalOpen = false,
  onSelectArchiveOp,
}) => {
  const {
    currentUser,
    allUsers,
    switchUser,
    logout,
    requestLogout,
    currentOperation,
    allOperations,
    setCurrentOperationId,
    reactivateOperation,
    deleteOperation,
    pauseOperation,
    resumeOperation,
    isRealGpsActive,
    toggleRealGps,
    sendEmergencyAlert,
    isSimulatorRunning,
    toggleSimulator,
    findings,
    chatMessages,
    unreadChatCount,
    cloudSyncStatus,
    userLocations,
    getUserArrivalStatus,
    calculateDistanceToEzMeters,
    confirmUserReady,
  } = useRescue();

  const [showSarAdminMenu, setShowSarAdminMenu] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showOpDropdown, setShowOpDropdown] = useState(false);
  const [showResponderListDropdown, setShowResponderListDropdown] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const closeAllDropdowns = () => {
    setShowSarAdminMenu(false);
    setShowUserDropdown(false);
    setShowOpDropdown(false);
    setShowResponderListDropdown(false);
  };

  useEffect(() => {
    if (isAnyModalOpen) {
      closeAllDropdowns();
    }
  }, [isAnyModalOpen]);

  useEffect(() => {
    closeAllDropdowns();
  }, [activeTab]);

  const isExercise = currentOperation?.type === 'exercise';
  const isRealAdmin = currentUser?.role === 'admin' || Boolean(currentUser?.isAdmin);
  const canLead = currentUser?.role === 'einsatzleitung' || Boolean(currentUser?.canLeadOperations) || isRealAdmin;
  const isAdmin = isRealAdmin || canLead;
  const isEL = currentUser?.role === 'einsatzleitung' || Boolean(currentUser?.canLeadOperations);
  const canManageOps = true;

  return (
    <header className="h-14 sm:h-16 flex items-center justify-between px-3 sm:px-5 bg-[#1E293B] border-b border-slate-700 shadow-lg shrink-0 sticky top-0 z-[1000] text-slate-200">
      {/* Brand & Central SHS Leitstellen Menu Button */}
      <div className="flex items-center gap-1.5 sm:gap-4 min-w-0">
        {/* Interactive White SHS Button / Admin Hub */}
        <div className="relative">
          <button
            onClick={() => {
              setShowSarAdminMenu((prev) => {
                const next = !prev;
                if (next) {
                  setShowOpDropdown(false);
                  setShowUserDropdown(false);
                  setShowResponderListDropdown(false);
                }
                return next;
              });
            }}
            className="w-9 h-9 sm:w-11 sm:h-11 bg-white hover:bg-slate-100 active:scale-95 rounded-xl flex items-center justify-center font-black text-slate-950 shadow-md border border-slate-300 tracking-wider text-xs sm:text-sm shrink-0 cursor-pointer transition-all duration-150 relative group"
            title="SHS EZ (Klicken für Einsatz- und Admin-Steuerung)"
          >
            <span className="font-black tracking-widest text-slate-950">SHS</span>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 border-2 border-slate-900 rounded-full animate-ping"></span>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 border-2 border-slate-900 rounded-full"></span>
          </button>

          {/* Central SHS EZ & Admin Dropdown Popover */}
          {showSarAdminMenu && (
            <>
              {/* Click-away transparent overlay */}
              <div
                className="fixed inset-0 z-[2100]"
                onClick={() => setShowSarAdminMenu(false)}
              />
              <div className="fixed sm:absolute top-14 sm:top-full left-2 sm:left-0 right-2 sm:right-auto sm:w-96 max-w-[calc(100vw-1rem)] max-h-[calc(100vh-4.5rem)] overflow-y-auto overscroll-contain bg-[#1E293B] border border-slate-600 rounded-2xl shadow-2xl p-3 z-[2200] text-xs animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md">
                {/* Menu Header */}
                <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-700/80 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-white text-slate-950 flex items-center justify-center font-black text-xs shadow border border-slate-300">
                      SHS
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs uppercase tracking-wider">
                        SHS EZ
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        EZ & Admin-Steuerung
                      </div>
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-blue-950/70 border border-blue-800 text-blue-300 font-mono text-[9px] uppercase font-bold">
                    {currentUser?.role === 'admin' ? 'EL / Admin' : 'Helfer'}
                  </span>
                </div>

                {/* Admin Actions Group (Logically Ordered) */}
                <div className="space-y-1.5 font-sans">
                  {/* 1. Neuen Einsatz anlegen */}
                  {onOpenCreateOperationModal && currentUser?.role !== 'observer' && (
                    <button
                      onClick={() => {
                        setShowSarAdminMenu(false);
                        onOpenCreateOperationModal();
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-100 hover:text-white border border-slate-700/80 hover:border-blue-500/50 transition cursor-pointer text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center text-sm shrink-0 group-hover:scale-105 transition">
                        ➕
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-xs flex items-center gap-1.5">
                          <span>Neuen Einsatz anlegen</span>
                          <span className="text-[9px] px-1.5 py-0.2 bg-blue-900/50 text-blue-300 rounded font-mono">Neu</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Wohnadresse, Sichtungsort (PLS) & Vermisstenprofil
                        </div>
                      </div>
                    </button>
                  )}

                  {/* 2. Aktuellen Einsatz editieren */}
                  {onOpenEditOperationModal && currentOperation && currentOperation.status === 'active' && currentUser?.role !== 'observer' && (
                    <button
                      onClick={() => {
                        setShowSarAdminMenu(false);
                        onOpenEditOperationModal();
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-100 hover:text-white border border-slate-700/80 hover:border-amber-500/50 transition cursor-pointer text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-sm shrink-0 group-hover:scale-105 transition">
                        ✏️
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-xs">Aktuellen Einsatz editieren (inkl. Sektoren & Suchgebiet)</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          #{currentOperation.id.slice(-4).toUpperCase()} • {currentOperation.title}
                        </div>
                      </div>
                    </button>
                  )}

                  {/* 3. Einsatzdetails & Vermisstenprofil */}
                  {currentOperation && onOpenOperationDetailModal && (
                    <button
                      onClick={() => {
                        setShowSarAdminMenu(false);
                        onOpenOperationDetailModal();
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-xl bg-blue-950/40 hover:bg-blue-900/60 text-blue-200 hover:text-white border border-blue-800/60 hover:border-blue-400 transition cursor-pointer text-left group shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/50 text-blue-300 flex items-center justify-center text-sm shrink-0 group-hover:scale-105 transition">
                        📋
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs flex items-center justify-between">
                          <span>Einsatzdetails & Dossier</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-900 text-blue-200 border border-blue-700">Info</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {currentOperation.missingPerson?.name ? `Vermisst: ${currentOperation.missingPerson.name}` : currentOperation.title}
                        </div>
                      </div>
                    </button>
                  )}

                  {/* 4. Einsatz-Steuerung: Pausieren / Fortsetzen / Beenden (Zusammengeführt) */}
                  {isAdmin && currentOperation && (
                    <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-2 space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-400 uppercase font-mono px-1 flex items-center justify-between">
                        <span>Einsatz-Steuerung (ELZ)</span>
                        <span className="text-[9px] text-blue-400">Pausieren / Beenden</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {currentOperation.status === 'active' ? (
                          <button
                            onClick={() => {
                              setShowSarAdminMenu(false);
                              if (onOpenPauseOperationModal) {
                                onOpenPauseOperationModal();
                              } else {
                                pauseOperation(currentOperation.id, 'Einsatz pausiert');
                              }
                            }}
                            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-amber-950/50 hover:bg-amber-900/70 text-amber-200 border border-amber-800/60 transition cursor-pointer font-bold text-xs"
                          >
                            <span>⏸️</span>
                            <span>Pausieren</span>
                          </button>
                        ) : currentOperation.status === 'paused' ? (
                          <button
                            onClick={() => {
                              resumeOperation(currentOperation.id);
                              setShowSarAdminMenu(false);
                            }}
                            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/70 text-emerald-200 border border-emerald-800/60 transition cursor-pointer font-bold text-xs"
                          >
                            <span>▶️</span>
                            <span>Fortsetzen</span>
                          </button>
                        ) : (
                          <div />
                        )}

                        {onOpenEndOperationModal && currentOperation?.status !== 'completed' && (
                          <button
                            onClick={() => {
                              setShowSarAdminMenu(false);
                              onOpenEndOperationModal();
                            }}
                            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-red-950/50 hover:bg-red-900/70 text-red-200 border border-red-800/60 transition cursor-pointer font-bold text-xs"
                          >
                            <span>🛑</span>
                            <span>Beenden</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 5. Einsatzkräfte & Accounts verwalten */}
                  {onOpenCreateUserModal && currentUser?.role !== 'observer' && (
                    <button
                      onClick={() => {
                        setShowSarAdminMenu(false);
                        onOpenCreateUserModal();
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-100 hover:text-white border border-slate-700/80 hover:border-emerald-500/50 transition cursor-pointer text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-sm shrink-0 group-hover:scale-105 transition">
                        👥
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-xs">Accountverwaltung</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Helfer anlegen, bearbeiten, Rollen & Funkrufnamen
                        </div>
                      </div>
                    </button>
                  )}

                  {/* 6. App teilen & Kräfte einladen (QR-Code) */}
                  {onOpenShareAppModal && currentUser?.role !== 'observer' && (
                    <button
                      onClick={() => {
                        setShowSarAdminMenu(false);
                        onOpenShareAppModal();
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-xl bg-blue-950/50 hover:bg-blue-900/70 text-blue-100 hover:text-white border border-blue-800/70 hover:border-blue-400 transition cursor-pointer text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/50 text-blue-300 flex items-center justify-center text-sm shrink-0 group-hover:scale-105 transition">
                        📱
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs flex items-center justify-between">
                          <span>App teilen & Kräfte einladen</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-900 text-blue-200 border border-blue-700">QR-Code</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          Direktlink & QR-Code für Helfer vor Ort (ohne Google-Login)
                        </div>
                      </div>
                    </button>
                  )}


                </div>

                {/* Quick links footer */}
                <div className="mt-2.5 pt-2 border-t border-slate-700/80 grid grid-cols-3 gap-1.5 text-center font-mono text-[10px]">
                  <button
                    onClick={() => {
                      setActiveTab('reports');
                      setShowSarAdminMenu(false);
                    }}
                    className="p-1.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 border border-blue-800/60 cursor-pointer font-bold"
                  >
                    📊 Berichte
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('log');
                      setShowSarAdminMenu(false);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                  >
                    📜 Tagebuch
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('archive');
                      setShowSarAdminMenu(false);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                  >
                    📦 Archiv
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col justify-center min-w-0">
          <div className="flex items-center gap-1 sm:gap-2">
            <h1 className="text-xs sm:text-sm md:text-base font-bold leading-tight uppercase tracking-wider text-white truncate">
              SHS EZ
            </h1>
            {/* Quick Operation Selector Button - styled like the Share button */}
            <div className="relative inline-block shrink-0">
              <button
                onClick={() => {
                  setShowOpDropdown(!showOpDropdown);
                  setShowSarAdminMenu(false);
                  setShowUserDropdown(false);
                  setShowResponderListDropdown(false);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-950/70 hover:bg-blue-900 text-blue-300 hover:text-white border border-blue-700/60 transition cursor-pointer text-[10px] font-mono font-bold shadow-sm shrink-0"
                title="Einsatz wechseln oder archivierte Einsätze ansehen"
              >
                <span>
                  {currentOperation ? `#${currentOperation.id.slice(-4).toUpperCase()}` : 'EINSÄTZE'}
                </span>
                <ChevronDown className="w-3 h-3 text-blue-400 shrink-0" />
              </button>

              {/* Operation Dropdown Menu */}
              {showOpDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-[2100]"
                    onClick={() => setShowOpDropdown(false)}
                  />
                  <div className="fixed sm:absolute top-14 sm:top-full left-2 sm:left-0 right-2 sm:right-auto sm:w-96 max-w-[calc(100vw-1rem)] max-h-[calc(100vh-4.5rem)] overflow-y-auto overscroll-contain bg-[#1E293B] border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl p-3 z-[2200] text-xs animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between font-bold text-slate-700 dark:text-slate-300 px-2 py-1 border-b border-slate-300 dark:border-slate-700 uppercase tracking-wider text-[10px] font-mono">
                      <span>Einsatz-Auswahl & Status</span>
                      {isAdmin && onOpenCreateOperationModal && (
                        <button
                          onClick={() => {
                            setShowOpDropdown(false);
                            onOpenCreateOperationModal();
                          }}
                          className="text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer font-bold"
                        >
                          + Neuer Einsatz
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 my-1.5 pr-1">
                      {/* Section 1: Aktive Einsätze */}
                      <div>
                        <div className="text-[10px] font-bold text-emerald-400 uppercase font-mono px-2 py-1 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span>Aktive Einsätze ({allOperations.filter((o) => o.status === 'active').length})</span>
                        </div>
                        {allOperations.filter((o) => o.status === 'active').length === 0 ? (
                          <div className="px-3 py-2 bg-white dark:bg-slate-900/60 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 font-mono text-center">
                            Kein aktiver Einsatz läuft.
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {allOperations
                              .filter((o) => o.status === 'active')
                              .map((op) => (
                                <div
                                  key={op.id}
                                  onClick={() => {
                                    setCurrentOperationId(op.id);
                                    setActiveTab('map');
                                    setShowOpDropdown(false);
                                  }}
                                  className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition cursor-pointer group ${
                                    op.id === currentOperation?.id
                                      ? 'bg-blue-600/30 text-blue-200 border border-blue-400'
                                      : 'hover:bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700/60'
                                  }`}
                                >
                                  <div className="truncate flex-1 mr-2">
                                    <div className="font-semibold flex items-center gap-1.5">
                                      <span>{op.type === 'operation' ? '🔴' : '🟠'}</span>
                                      <span className="truncate">{op.title}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono truncate">
                                      Vermisst: {op.missingPerson?.name || 'Unbekannt'} • #{op.id.slice(-4).toUpperCase()}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                                      Aktiv
                                    </span>
                                    {onOpenOperationDetailModal && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCurrentOperationId(op.id);
                                          setShowOpDropdown(false);
                                          onOpenOperationDetailModal();
                                        }}
                                        className="p-1 text-slate-500 dark:text-slate-400 hover:text-blue-300 hover:bg-blue-950/60 rounded border border-transparent hover:border-blue-700 transition cursor-pointer"
                                        title="Vermisstendossier & Einsatzdetails anzeigen"
                                      >
                                        <FileText className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {isAdmin && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const confirmed = window.confirm(
                                            `🚨 Einsatz "${op.title}" wirklich endgültig löschen?\n\nAlle Sektoren, Funde und Protokolle werden gelöscht.`
                                          );
                                          if (confirmed) {
                                            deleteOperation(op.id);
                                          }
                                        }}
                                        className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/60 rounded border border-transparent hover:border-red-800 transition cursor-pointer"
                                        title="Einsatz löschen"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Section 2: Beendete Einsätze im Archiv */}
                      {allOperations.filter((o) => o.status === 'completed').length > 0 && (
                        <div className="pt-2 border-t border-slate-300 dark:border-slate-700/80">
                          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono px-2 py-1 flex items-center justify-between">
                            <span>📦 Archivierte Einsätze ({allOperations.filter((o) => o.status === 'completed').length})</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setActiveTab('reports');
                                  setShowOpDropdown(false);
                                }}
                                className="text-emerald-400 hover:underline text-[9px] font-bold"
                              >
                                📊 Berichte
                              </button>
                              <button
                                onClick={() => {
                                  setActiveTab('archive');
                                  setShowOpDropdown(false);
                                }}
                                className="text-blue-400 hover:underline text-[9px]"
                              >
                                Alle öffnen
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            {allOperations
                              .filter((o) => o.status === 'completed')
                              .slice(0, 3)
                              .map((op) => (
                                <div
                                  key={op.id}
                                  onClick={() => {
                                    if (onSelectArchiveOp) {
                                      onSelectArchiveOp(op.id);
                                    } else {
                                      setActiveTab('archive');
                                    }
                                    setShowOpDropdown(false);
                                  }}
                                  className="w-full text-left p-2 rounded-xl flex items-center justify-between transition cursor-pointer bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 group"
                                >
                                  <div className="truncate flex-1 mr-2">
                                    <div className="font-medium text-xs text-slate-700 dark:text-slate-300 truncate">
                                      {op.title}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono truncate">
                                      Beendet: {op.completedAt ? new Date(op.completedAt).toLocaleDateString() : 'Archiv'}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                                      Archiv
                                    </span>
                                    {canManageOps && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const confirmed = window.confirm(
                                              `🔄 Einsatz "${op.title}" reaktivieren und neue Suchphase starten?\n\nBisherige Sektoren & GPS-Suchspuren bleiben erhalten.`
                                            );
                                            if (confirmed) {
                                              reactivateOperation(op.id, {
                                                phaseTitle: 'Suchphase 2 (Reaktiviert)',
                                              });
                                              setActiveTab('map');
                                              setShowOpDropdown(false);
                                            }
                                          }}
                                          className="p-1 text-slate-500 dark:text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/60 rounded border border-transparent hover:border-emerald-800 transition cursor-pointer"
                                          title="Einsatz reaktivieren & neue Suchphase starten"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const confirmed = window.confirm(
                                              `🚨 Archivierten Einsatz "${op.title}" wirklich endgültig löschen?`
                                            );
                                            if (confirmed) {
                                              deleteOperation(op.id);
                                            }
                                          }}
                                          className="p-1 text-slate-500 dark:text-slate-400 hover:text-red-400 hover:bg-red-950/60 rounded border border-transparent hover:border-red-800 transition cursor-pointer"
                                          title="Einsatz löschen"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {isAdmin && currentOperation && (
                      <div className="pt-2 border-t border-slate-300 dark:border-slate-700 space-y-1.5">
                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono px-1">
                          Einsatz-Steuerung (Beenden / Pausieren / Reaktivieren)
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {currentOperation.status === 'active' ? (
                            <button
                              onClick={() => {
                                setShowOpDropdown(false);
                                if (onOpenPauseOperationModal) {
                                  onOpenPauseOperationModal();
                                } else {
                                  pauseOperation(currentOperation.id, 'Einsatz pausiert');
                                }
                              }}
                              className="py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-amber-600/30 hover:bg-slate-50 dark:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 text-[10px] font-bold transition flex items-center justify-center gap-1 font-mono cursor-pointer"
                              title="Laufenden Einsatz pausieren"
                            >
                              ⏸️ Pausieren
                            </button>
                          ) : currentOperation.status === 'paused' ? (
                            <button
                              onClick={() => {
                                setShowOpDropdown(false);
                                resumeOperation(currentOperation.id);
                              }}
                              className="py-1.5 px-2 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-[10px] font-bold transition flex items-center justify-center gap-1 font-mono cursor-pointer"
                              title="Pausierten Einsatz fortsetzen"
                            >
                              ▶️ Fortsetzen
                            </button>
                          ) : null}

                          {onOpenEndOperationModal && currentOperation.status === 'active' && (
                            <button
                              onClick={() => {
                                setShowOpDropdown(false);
                                onOpenEndOperationModal();
                              }}
                              className="py-1.5 px-2 rounded-lg bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-[10px] font-bold transition flex items-center justify-center gap-1 font-mono cursor-pointer"
                              title="Einsatz beenden"
                            >
                              🛑 Beenden
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Responder List & Readiness Dropdown Button next to Operation selector */}
            <div className="relative inline-block shrink-0">
              <button
                onClick={() => {
                  setShowResponderListDropdown(!showResponderListDropdown);
                  setShowOpDropdown(false);
                  setShowSarAdminMenu(false);
                  setShowUserDropdown(false);
                }}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-950/70 hover:bg-blue-900 text-blue-300 hover:text-white border border-blue-700/60 transition cursor-pointer text-[10px] font-mono font-bold shadow-sm shrink-0"
                title="Einsatzkräfte & Bereitschaftsliste öffnen"
              >
                <span className="hidden sm:inline">👥 Einsatzkräfte ({allUsers.filter(u => u.isActive).length})</span>
                <span className="sm:hidden">👥 {allUsers.filter(u => u.isActive).length}</span>
                <ChevronDown className="w-3 h-3 text-blue-400 shrink-0" />
              </button>

              {showResponderListDropdown && (
                <>
                  <div className="fixed inset-0 z-[2100]" onClick={() => setShowResponderListDropdown(false)} />
                  <div className="fixed sm:absolute top-14 sm:top-full left-2 sm:left-0 right-2 sm:right-auto sm:w-96 max-w-[calc(100vw-1rem)] max-h-[calc(100vh-4.5rem)] overflow-y-auto overscroll-contain bg-[#1E293B] border border-slate-700 rounded-2xl shadow-2xl p-3 z-[2200] text-xs animate-in fade-in zoom-in-95 duration-150 space-y-2">
                    <div className="flex items-center justify-between font-bold text-slate-300 px-1 border-b border-slate-700 uppercase tracking-wider text-[10px] font-mono pb-1">
                      <span>Einsatzkräfte & Bereitschaft</span>
                      <span className="text-blue-400">{allUsers.filter(u => u.isActive).length} aktiv</span>
                    </div>

                    {/* EZ Target & Navigation link */}
                    <div className="bg-indigo-950/60 border border-indigo-500/40 rounded-xl p-2 flex items-center justify-between text-[11px] font-mono">
                      <div className="min-w-0 mr-2">
                        <div className="text-[9px] text-indigo-300 font-bold uppercase">
                          {currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused') ? '🚨 Aktive Einsatz-EZ' : '🏢 Vereinsbüro Aschersleben'}
                        </div>
                        <div className="text-slate-200 truncate font-semibold text-[10px]">
                          {(currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused') && currentOperation.headquartersLocation?.address) ? currentOperation.headquartersLocation.address : 'Hohe Straße 15, Aschersleben'}
                        </div>
                      </div>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${
                          (currentOperation && (currentOperation.status === 'active' || currentOperation.status === 'paused') && currentOperation.headquartersLocation?.lat)
                            ? `${currentOperation.headquartersLocation.lat},${currentOperation.headquartersLocation.lng}`
                            : '51.7587,11.4589'
                        }`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-[10px] shrink-0 no-underline flex items-center gap-1"
                        title="Route zur EZ in Google Maps / Navi starten"
                      >
                        🧭 Navi
                      </a>
                    </div>

                    <div className="space-y-1.5 pr-1">
                      {[...allUsers].sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0)).map((user) => {
                        const isOnline = user.isActive;
                        const status = getUserArrivalStatus(user.id);
                        let statusBadge = { label: 'In Bereitschaft', color: 'bg-slate-800 text-slate-400 border-slate-700', icon: '⚪' };

                        if (isOnline) {
                          if (status === 'on_site') {
                            statusBadge = { label: 'Vor Ort / Im Einsatz', color: 'bg-emerald-950 text-emerald-300 border-emerald-700', icon: '🟢' };
                          } else if (status === 'arrived_ez') {
                            statusBadge = { label: 'EZ erreicht', color: 'bg-amber-500/20 text-amber-300 border-amber-500/50', icon: '🟡' };
                          } else if (status === 'en_route') {
                            statusBadge = { label: 'Auf Anfahrt', color: 'bg-blue-950 text-blue-300 border-blue-700', icon: '🚙' };
                          } else {
                            statusBadge = { label: 'Bereit', color: 'bg-emerald-950/60 text-emerald-400 border-emerald-800', icon: '🟢' };
                          }
                        }

                        return (
                          <div
                            key={user.id}
                            className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/80 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: isOnline ? '#10b981' : '#64748b' }}></span>
                              <div className="min-w-0">
                                <div className="font-bold text-white text-xs truncate flex items-center gap-1">
                                  <span>{user.name}</span>
                                  {user.callSign && (
                                    <span className="text-blue-400 font-mono text-[10px]">({user.callSign})</span>
                                  )}
                                </div>
                                <div className="text-[9px] text-slate-400 font-mono truncate">
                                  KFZ: {user.licensePlate || 'k.A.'} • Akku: {user.batteryLevel ?? 100}%
                                </div>
                              </div>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border shrink-0 ${statusBadge.color}`}>
                              {statusBadge.icon} {statusBadge.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 min-w-0">
            {currentOperation && currentOperation.status === 'active' ? (
              <button
                type="button"
                onClick={() => {
                  if (onOpenOperationDetailModal) {
                    onOpenOperationDetailModal();
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-950/70 hover:bg-blue-900 text-blue-300 hover:text-white border border-blue-700/60 transition cursor-pointer group shadow-sm text-left max-w-[210px] sm:max-w-[340px] text-[10px] font-mono font-bold shrink-0"
                title="📋 Einsatzdetails & Vermisstensteckbrief anzeigen (Klicken für Foto, Details & Bearbeitung)"
              >
                <span className="flex items-center gap-1 shrink-0">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isExercise ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'
                    }`}
                  />
                  <span className="font-bold tracking-tight font-mono text-[9px] text-blue-400 group-hover:text-blue-200 hidden sm:inline">
                    {isExercise ? 'ÜBUNG:' : 'AKTIV:'}
                  </span>
                </span>

                {currentOperation.missingPerson?.photoUrl ? (
                  <img
                    src={currentOperation.missingPerson.photoUrl}
                    alt="Vermisst"
                    className="w-4 h-4 rounded-full object-cover border border-blue-500/60 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700/60 flex items-center justify-center text-[9px] shrink-0">
                    👤
                  </span>
                )}

                <span className="font-semibold truncate text-[10px] sm:text-xs text-white group-hover:text-blue-100">
                  {currentOperation.title}
                </span>

                {currentOperation.missingPerson?.name && (
                  <span className="text-[10px] text-blue-300/80 font-normal truncate hidden md:inline">
                    ({currentOperation.missingPerson.name})
                  </span>
                )}

                <span className="text-[9px] font-mono text-blue-400 opacity-80 group-hover:opacity-100 shrink-0 ml-0.5">
                  ℹ️ Details
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowOpDropdown(true);
                  setShowSarAdminMenu(false);
                  setShowUserDropdown(false);
                  setShowResponderListDropdown(false);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-950/70 hover:bg-blue-900 text-blue-300 hover:text-white border border-blue-700/60 transition cursor-pointer text-left shadow-sm group font-mono text-[10px] sm:text-xs font-bold shrink-0"
                title="Bereitschaftsmodus - Klicken zum Wählen oder Starten eines Einsatzes"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <span className="font-bold text-amber-300">Bereitschaft</span>
                <span className="text-blue-300/70 text-[10px] hidden sm:inline">(Kein aktiver Einsatz)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right Controls: Actions, Telemetry & User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">

        {/* Network Status Indicator */}
        <div
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition shadow-sm ${
            isOnline
              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-600/60'
              : 'bg-red-950/70 text-red-300 border-red-600/60'
          }`}
          title={
            isOnline
              ? 'Internetverbindung steht'
              : 'Keine Internetverbindung. Daten werden lokal zwischengespeichert.'
          }
        >
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>ONLINE</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>OFFLINE</span>
            </>
          )}
        </div>

        {/* Cloud Sync Status Indicator */}
        <div
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition shadow-sm ${
            cloudSyncStatus === 'connected'
              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-600/60'
              : cloudSyncStatus === 'quota_exceeded'
              ? 'bg-amber-950/70 text-amber-300 border-amber-600/60'
              : 'bg-blue-950/70 text-blue-300 border-blue-700/60'
          }`}
          title={
            cloudSyncStatus === 'connected'
              ? 'Firebase Firestore Cloud-Sync ist aktiv'
              : cloudSyncStatus === 'quota_exceeded'
              ? 'Tägliches Firestore Free-Tier Schreiblimit erreicht. Lokaler Multi-Tab-Funk & Speicherung aktiv.'
              : 'Offline-Modus aktiv'
          }
        >
          {cloudSyncStatus === 'connected' ? (
            <>
              <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>CLOUD: AKTIV</span>
            </>
          ) : cloudSyncStatus === 'quota_exceeded' ? (
            <>
              <CloudOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>CLOUD: LIMIT</span>
            </>
          ) : (
            <>
              <CloudOff className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>OFFLINE</span>
            </>
          )}
        </div>

        {/* GPS Mode toggle */}
        <button
          onClick={toggleRealGps}
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition cursor-pointer shadow-sm ${
            isRealGpsActive
              ? 'bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 hover:text-white border-emerald-600/60'
              : 'bg-blue-950/70 hover:bg-blue-900 text-blue-300 hover:text-white border border-blue-700/60'
          }`}
          title="Echtes Smartphone/Browser GPS aktivieren"
        >
          <Navigation className={`w-3.5 h-3.5 shrink-0 ${isRealGpsActive ? 'text-emerald-400' : 'text-blue-400'}`} />
          <span>GPS: {isRealGpsActive ? 'ECHT' : 'SIM'}</span>
        </button>

        {/* Share App / QR Code Button */}
        {onOpenShareAppModal && (
          <button
            onClick={onOpenShareAppModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-950/70 hover:bg-blue-900 text-blue-300 hover:text-white border border-blue-700/60 transition cursor-pointer text-[10px] font-mono font-bold shadow-sm shrink-0"
            title="App per QR-Code oder Direktlink an andere Einsatzkräfte teilen"
          >
            <Share2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="hidden md:inline whitespace-nowrap">TEILEN / QR</span>
          </button>
        )}

        {/* User Profile Lockup & Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserDropdown((prev) => {
                const next = !prev;
                if (next) {
                  setShowSarAdminMenu(false);
                  setShowOpDropdown(false);
                  setShowResponderListDropdown(false);
                }
                return next;
              });
            }}
            className="flex items-center gap-2 sm:gap-2.5 px-2.5 py-1 rounded-lg bg-blue-950/70 hover:bg-blue-900 text-blue-300 hover:text-white border border-blue-700/60 transition cursor-pointer text-left shadow-sm shrink-0"
          >
            <div className="text-right hidden sm:block">
              <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-1 justify-end">
                <span>{currentUser?.name || 'Benutzer'}</span>
                {isFirstAdmin(currentUser) && <span title="First Admin & App-Owner (unantastbar)">👑</span>}
              </p>
              <p className="text-[10px] text-emerald-400 font-medium uppercase font-mono tracking-wide">
                {isFirstAdmin(currentUser)
                  ? 'FIRST ADMIN (OWNER)'
                  : currentUser?.role === 'admin'
                  ? 'ADMINISTRATOR'
                  : currentUser?.isAdmin
                  ? 'EL & ADMIN'
                  : currentUser?.role === 'einsatzleitung'
                  ? 'EINSATZLEITUNG'
                  : (currentUser?.callSign || 'EINSATZKRAFT')}
              </p>
            </div>

            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-900/60 border-2 flex items-center justify-center overflow-hidden shadow shrink-0 ${
              isFirstAdmin(currentUser) ? 'border-amber-400 ring-2 ring-amber-400/40' : 'border-blue-500/60'
            }`}>
              {currentUser?.photoUrl ? (
                <img src={currentUser.photoUrl} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold text-xs text-white uppercase">{currentUser?.name.charAt(0) || 'U'}</span>
              )}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          </button>

          {/* User Profile Dropdown Menu */}
          {showUserDropdown && (
            <>
              <div
                className="fixed inset-0 z-[2100]"
                onClick={() => setShowUserDropdown(false)}
              />
              <div className="fixed sm:absolute top-14 sm:top-full right-2 sm:right-0 left-2 sm:left-auto sm:w-80 max-w-[calc(100vw-1rem)] max-h-[calc(100vh-4.5rem)] overflow-y-auto overscroll-contain bg-[#1E293B] border border-slate-700 rounded-2xl shadow-2xl p-3 z-[2200] text-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-1.5 border-b border-slate-700 mb-2">
                  <div className="font-bold text-white text-sm flex items-center gap-1.5">
                    <span>{currentUser?.name}</span>
                    {isFirstAdmin(currentUser) && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-mono font-bold">
                        👑 OWNER
                      </span>
                    )}
                  </div>
                  <div className="text-blue-400 font-mono text-[11px]">{currentUser?.callSign}</div>
                  <div className="text-slate-400 text-[10px] mt-0.5 font-mono">
                    KFZ: {currentUser?.licensePlate || 'k.A.'} • {isFirstAdmin(currentUser) ? 'First Admin & App-Owner (unantastbar)' : currentUser?.role === 'admin' ? 'ELZ (Admin)' : 'Einsatzkraft'}
                  </div>
                </div>

                <div className="space-y-1 mb-2 font-mono">
                  <button
                    onClick={() => {
                      onOpenProfileModal();
                      setShowUserDropdown(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-slate-100 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 transition cursor-pointer text-left font-bold"
                  >
                    <span>⚙️</span> Mein Profil, Ausrüstung & KFZ
                  </button>

                  <button
                    onClick={() => {
                      requestLogout();
                      setShowUserDropdown(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-red-400 hover:bg-red-900/30 font-bold transition cursor-pointer text-left border border-transparent hover:border-red-500/30"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span>Abmelden (Logout)</span>
                  </button>
                </div>
            </div>
          </>
        )}
        </div>
      </div>
    </header>
  );
};
