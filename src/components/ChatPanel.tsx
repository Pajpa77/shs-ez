import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRescue } from '../context/RescueContext';
import { User, ChatMessage, SearchTeam, SearchOperation, isFirstAdmin, isUserAdmin, isUserEL } from '../types';
import {
  Send,
  Radio,
  Shield,
  MapPin,
  AlertTriangle,
  User as UserIcon,
  Users,
  Search,
  Mic,
  Volume2,
  VolumeX,
  X,
  Maximize2,
  Minimize2,
  MessageSquare,
  FileText,
  Clock,
  Layers,
  ChevronRight,
  ExternalLink,
  Phone,
  Car,
  Award,
  Wifi,
  ChevronDown,
  ChevronLeft,
  Hash,
} from 'lucide-react';

interface ChatPanelProps {
  initialDirectUser?: User | null;
}

function getTeamLeaderName(team: SearchTeam, allUsers: User[]): string {
  if (!team || !team.leaderUserId) return 'K.A.';
  const u = allUsers.find((user) => user.id === team.leaderUserId);
  return u ? (u.callSign || u.name) : 'K.A.';
}

function getTeamSectorsText(team: SearchTeam, operation: SearchOperation | null): string {
  if (!team || !team.sectorIds || team.sectorIds.length === 0) return 'Keine Sektoren';
  if (!operation || !operation.sectors) return `${team.sectorIds.length} Sektoren`;
  const names = operation.sectors
    .filter((s) => team.sectorIds.includes(s.id))
    .map((s) => s.name);
  return names.length > 0 ? names.join(', ') : 'Keine Sektoren';
}

// Audio player component for CB Voice Messages
const VoiceMessagePlayer: React.FC<{ audioUrl: string; duration?: number; isMe?: boolean }> = ({
  audioUrl,
  duration = 0,
  isMe,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.warn('Audio play failed:', err);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSpeedChange = () => {
    const nextSpeed = playbackSpeed === 1 ? 1.25 : playbackSpeed === 1.25 ? 1.5 : 1;
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const effectiveDuration = duration || audioRef.current?.duration || 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = fraction * (effectiveDuration || 1);
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const formatSec = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return '0:00';
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progress = effectiveDuration > 0 ? Math.min(1, currentTime / effectiveDuration) : 0;
  const waveformBars = [40, 70, 30, 90, 60, 100, 50, 80, 40, 90, 60, 30, 70, 50, 80, 40];

  return (
    <div
      className={`mt-2 p-2.5 rounded-xl border flex flex-col gap-2 select-none ${
        isMe
          ? 'bg-blue-700/80 border-blue-400/40 text-white'
          : 'bg-slate-900/90 border-amber-500/40 text-slate-100'
      }`}
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition cursor-pointer ${
            isMe
              ? 'bg-white text-blue-700 hover:bg-slate-100 shadow'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow'
          }`}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono opacity-80">
            <span className="flex items-center gap-1 font-bold">
              <Radio className="w-3 h-3 text-amber-400 animate-pulse" />
              Funkspruch (PTT)
            </span>
            <span>
              {formatSec(currentTime)} / {formatSec(effectiveDuration)}
            </span>
          </div>

          <div
            onClick={handleSeek}
            title="Klicken zum Vor- oder Zurückspulen"
            className="h-5 flex items-center gap-0.5 cursor-pointer group py-0.5"
          >
            {waveformBars.map((h, i) => {
              const barFraction = (i + 1) / waveformBars.length;
              const isPast = progress >= barFraction;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-all duration-150 ${
                    isPast
                      ? isMe
                        ? 'bg-white'
                        : 'bg-amber-400'
                      : isMe
                      ? 'bg-blue-300/40'
                      : 'bg-slate-700'
                  } ${isPlaying && isPast ? 'animate-pulse' : ''}`}
                  style={{
                    height: isPlaying
                      ? `${Math.max(25, (h * Math.sin(i + currentTime * 6) + 100) / 2)}%`
                      : `${h}%`,
                  }}
                />
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSpeedChange}
          className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/40 border border-white/20 shrink-0 text-slate-200"
        >
          {playbackSpeed}x
        </button>
      </div>
    </div>
  );
};

export const ChatPanel: React.FC<ChatPanelProps> = ({ initialDirectUser }) => {
  const {
    currentUser,
    allUsers,
    currentOperation,
    allOperations,
    setCurrentOperationId,
    chatMessages,
    sendChatMessage,
    markChatAsRead,
    markDmAsRead,
    unreadDmCounts,
    lastReadChatTimestamp,
    userLocations,
    playAlertSound,
    findings,
    clearChatHistory,
    clearLogbook,
    clearAlerts,
    activeChatTarget,
  } = useRescue();

  // Primary navigation tab: 'channels' (Kanäle & Gruppen) vs 'findings' (Fundmeldungen mit Infos)
  const [mainTab, setMainTab] = useState<'channels' | 'findings'>('channels');

  // Mobile view: 'chat' shows chat, 'channels' shows channel list
  const [mobileView, setMobileView] = useState<'chat' | 'channels'>('chat');

  // Active channel/user ID
  const [activeChannel, setActiveChannel] = useState<string>('all'); // 'all', 'admins', sectorId, or userId
  const [activeScope, setActiveScope] = useState<'operation' | 'responders'>('operation');
  const [selectedOpId, setSelectedOpId] = useState<string>(
    currentOperation?.id || allOperations.find((o) => o.status === 'active')?.id || allOperations[0]?.id || ''
  );

  // Modals for popover views requested by user (Chatverlauf, Logbuch, Alarme & Funde)
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showLogbookModal, setShowLogbookModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);

  // Input & state controls
  const [inputText, setInputText] = useState('');
  const [includeLocation, setIncludeLocation] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);

  // Push-To-Talk Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaRecorderMimeTypeRef = useRef<string>('audio/webm');
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pttPressStartTimeRef = useRef<number>(0);
  const isHoldModeRef = useRef<boolean>(false);
  const suppressNextClickRef = useRef<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef<number>(chatMessages.length);

  useEffect(() => {
    if (currentOperation) {
      setSelectedOpId(currentOperation.id);
    }
  }, [currentOperation?.id]);

  const isAdmin = currentUser ? (isUserAdmin(currentUser) || isUserEL(currentUser)) : false;

  useEffect(() => {
    if (activeChatTarget) {
      setMainTab('channels');
      if (activeChatTarget.targetUser || activeChatTarget.channel === 'direct') {
        setActiveScope('responders');
        if (activeChatTarget.targetUser) {
          setActiveChannel(activeChatTarget.targetUser.id);
        }
      } else {
        setActiveScope('operation');
        setActiveChannel(activeChatTarget.channel);
      }
      setMobileView('chat');
    } else if (initialDirectUser) {
      setMainTab('channels');
      setActiveScope('responders');
      setActiveChannel(initialDirectUser.id);
    } else if (currentUser?.role === 'observer') {
      setActiveChannel('admins');
    }
  }, [activeChatTarget, initialDirectUser, currentUser]);

  // Auto scroll and mark as read
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    if (chatMessages.length > prevMessagesLengthRef.current) {
      markChatAsRead();

      if (autoPlayAudio) {
        const newestMsg = chatMessages[chatMessages.length - 1];
        if (
          newestMsg &&
          newestMsg.isVoiceMessage &&
          newestMsg.audioUrl &&
          newestMsg.senderId !== currentUser?.id
        ) {
          playAlertSound('cb_tx_start');
          const audio = new Audio(newestMsg.audioUrl);
          audio.play().catch((err) => {
            console.warn('CB-Funk AutoPlay durch Browser-Richtlinie blockiert:', err);
          });
        }
      }
    }
    prevMessagesLengthRef.current = chatMessages.length;
  }, [chatMessages, activeChannel, autoPlayAudio, currentUser?.id, playAlertSound, markChatAsRead]);

  // --- Voice / CB Funk Recording logic ---
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Mikrofonzugriff wird von diesem Browser nicht unterstützt.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      let chosenMimeType = '';
      let options: MediaRecorderOptions = { audioBitsPerSecond: 16000 };
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          chosenMimeType = 'audio/webm;codecs=opus';
          options.mimeType = chosenMimeType;
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          chosenMimeType = 'audio/mp4';
          options.mimeType = chosenMimeType;
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          chosenMimeType = 'audio/webm';
          options.mimeType = chosenMimeType;
        }
      }

      mediaRecorderMimeTypeRef.current = chosenMimeType || 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      playAlertSound('cb_tx_start');
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 30) {
            stopAndSendRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Mikrofon Fehler:', err);
      alert('Mikrofonzugriff nicht gewährt. Bitte erlauben Sie den Zugriff auf Ihr Mikrofon.');
      setIsRecording(false);
      isHoldModeRef.current = false;
    }
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) {
      isHoldModeRef.current = false;
      return;
    }

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    playAlertSound('cb_tx_end');

    const recorder = mediaRecorderRef.current;
    const finalDuration = recordingTime || 1;
    const effectiveMimeType = recorder.mimeType || mediaRecorderMimeTypeRef.current || 'audio/webm';

    recorder.onstop = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      const audioBlob = new Blob(audioChunksRef.current, { type: effectiveMimeType });
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = () => {
        const base64Audio = reader.result as string;
        const isDirect =
          activeChannel !== 'all' &&
          activeChannel !== 'ez_contact' &&
          activeChannel !== 'admins' &&
          activeChannel !== 'general' &&
          !activeChannel.startsWith('sec-') &&
          !activeChannel.startsWith('team-');

        sendChatMessage({
          text: '🎙️ CB-Funk Sprachübertragung',
          channel: activeChannel,
          isDirect,
          recipientId: isDirect ? activeChannel : undefined,
          audioUrl: base64Audio,
          audioDuration: finalDuration,
          isVoiceMessage: true,
          includeLocation,
        });

        setIsRecording(false);
        setRecordingTime(0);
        setIncludeLocation(false);
        isHoldModeRef.current = false;
      };
    };

    recorder.stop();
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingTime(0);
    isHoldModeRef.current = false;
  };

  const handlePttPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pttPressStartTimeRef.current = Date.now();
    if (!isRecording) {
      isHoldModeRef.current = true;
      startRecording();
    }
  };

  const handlePttPointerUp = () => {
    const pressDuration = Date.now() - pttPressStartTimeRef.current;
    if (isRecording && isHoldModeRef.current) {
      if (pressDuration > 400) {
        stopAndSendRecording();
        suppressNextClickRef.current = true;
      } else {
        isHoldModeRef.current = false;
      }
    }
  };

  const handlePttPointerCancel = () => {
    if (isRecording && isHoldModeRef.current) {
      cancelRecording();
    }
    isHoldModeRef.current = false;
  };

  const handlePttButtonClick = () => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    if (isRecording) {
      stopAndSendRecording();
    } else {
      startRecording();
    }
  };

  // Keyboard Push-To-Talk shortcut for laptops/dispatchers (Press & hold Spacebar when not typing)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || (activeEl as HTMLElement)?.isContentEditable;
      if (isInput) return;

      if (e.code === 'Space' && !e.repeat && !isRecording) {
        e.preventDefault();
        pttPressStartTimeRef.current = Date.now();
        isHoldModeRef.current = true;
        startRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || (activeEl as HTMLElement)?.isContentEditable;
      if (isInput) return;

      if (e.code === 'Space' && isRecording) {
        e.preventDefault();
        stopAndSendRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRecording]);

  const effectiveOperation = allOperations.find((o) => o.id === selectedOpId) || currentOperation || null;

  const currentUserId = currentUser?.id || '';

  // Split messages by type according to user requirements:
  // 1. Logbuch messages: Login / Logout logs
  const logbookMessages = useMemo(() => {
    return chatMessages.filter(
      (m) =>
        m.channel === 'system' ||
        m.channel === 'logs' ||
        (typeof m.text === 'string' && (
          m.text.includes('hat sich soeben eingeloggt') ||
          m.text.includes('hat das System verlassen')
        ))
    );
  }, [chatMessages]);

  // 2. Alert messages: Status changes & emergency alerts
  const alertMessages = useMemo(() => {
    return chatMessages.filter(
      (m) =>
        m.isAlert ||
        (typeof m.text === 'string' && (
          m.text.includes('EINSATZ REAKTIVIERT') ||
          m.text.includes('EINSATZ BEENDET') ||
          m.text.includes('EINSATZ PAUSIERT') ||
          m.text.includes('EINSATZ WIEDERAUFGENOMMEN') ||
          m.text.includes('REALEINSATZ')
        ))
    );
  }, [chatMessages]);

  // 3. Radio & Chat Feed for the active channel (clean radio talk only, excluding system logouts/logins)
  const activeChannelMessages = useMemo(() => {
    return chatMessages.filter((msg) => {
      // Filter out pure system login/logout messages from channel feed (user requested them in logbook)
      if (
        msg.channel === 'system' ||
        msg.channel === 'logs' ||
        (typeof msg.text === 'string' && (
          msg.text.includes('hat sich soeben eingeloggt') ||
          msg.text.includes('hat das System verlassen')
        ))
      ) {
        return false;
      }

      // Filter by operation scope
      if (effectiveOperation && msg.operationId !== effectiveOperation.id) return false;

      // Filter by active channel / direct user
      if (activeChannel === 'all') {
        return msg.channel === 'all';
      } else if (activeChannel === 'admins') {
        return isAdmin ? msg.channel === 'admins' : false;
      } else if (activeChannel === 'ez_contact') {
        if (msg.channel !== 'ez_contact') return false;
        if (isAdmin) return true;
        const sender = allUsers.find(u => u.id === msg.senderId);
        const senderIsAdmin = sender ? (sender.role === 'admin' || sender.role === 'einsatzleitung' || sender.isAdmin) : false;
        return msg.senderId === currentUserId || senderIsAdmin;
      } else if (activeChannel.startsWith('sec-') || activeChannel.startsWith('team-')) {
        return msg.channel === activeChannel;
      } else {
        // Direct 1:1 chat
        return (
          (msg.senderId === currentUserId && msg.recipientId === activeChannel) ||
          (msg.senderId === activeChannel && msg.recipientId === currentUserId) ||
          msg.channel === activeChannel
        );
      }
    });
  }, [chatMessages, activeScope, effectiveOperation, activeChannel, currentUserId, isAdmin, allUsers]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !includeLocation) return;

    const isDirect =
      activeChannel !== 'all' &&
      activeChannel !== 'ez_contact' &&
      activeChannel !== 'admins' &&
      activeChannel !== 'general' &&
      !activeChannel.startsWith('sec-') &&
      !activeChannel.startsWith('team-');

    const targetOpId = effectiveOperation?.id || 'general';

    sendChatMessage({
      text: inputText.trim() || (includeLocation ? '📍 GPS-Standort übermittelt' : ''),
      channel: activeChannel,
      operationId: targetOpId,
      isDirect,
      recipientId: isDirect ? activeChannel : undefined,
      includeLocation,
    });

    setInputText('');
    setIncludeLocation(false);
  };

  // Scoped responders
  const scopedUsers = useMemo(() => {
    if (activeScope === 'operation' && effectiveOperation && (effectiveOperation.status === 'active' || effectiveOperation.status === 'paused')) {
      const participantIds = effectiveOperation.participantIds || [];
      return allUsers.filter((u) => participantIds.includes(u.id));
    }
    return allUsers;
  }, [allUsers, activeScope, effectiveOperation]);

  const activeTargetUser = allUsers.find((u) => u.id === activeChannel);
  const activeSector = effectiveOperation?.sectors?.find((s) => s.id === activeChannel);
  const activeTeam = effectiveOperation?.teams?.find((t) => t.id === activeChannel);
  const activeUsersCount = scopedUsers.filter((u) => u.isActive).length;

  const filteredResponders = scopedUsers
    .filter((u) => u.id !== currentUserId)
    .filter((u) => {
      if (!userSearchQuery.trim()) return true;
      const q = userSearchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.callSign.toLowerCase().includes(q) ||
        (u.licensePlate && u.licensePlate.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return a.name.localeCompare(b.name);
    });

  // Get a label for the active channel (used in mobile header)
  const activeChannelLabel =
    activeChannel === 'all'
      ? '📢 Einsatzfunk'
      : activeChannel === 'ez_contact'
      ? '📞 Kontakt zur EZ'
      : activeChannel === 'admins'
      ? '🛡️ Führungskanal'
      : activeTeam
      ? `👥 ${activeTeam.name}`
      : activeSector
      ? `🧭 ${activeSector.name}`
      : activeTargetUser
      ? `👤 ${activeTargetUser.callSign || activeTargetUser.name}`
      : '💬 Kanal';

  // Helper: switch channel and go to chat view on mobile
  const selectChannel = (channelId: string) => {
    setActiveChannel(channelId);
    setMobileView('chat');
    // Wenn ein User-Direktkanal geöffnet wird: DMs von diesem User als gelesen markieren
    const isUserChannel = allUsers.some((u) => u.id === channelId);
    if (isUserChannel) {
      markDmAsRead(channelId);
    }
  };

  // ─── Channel Sidebar Content ──────────────────────────────────────────────
  const ChannelSidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scope Toggle */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900 border border-slate-700/80 rounded-xl text-xs font-semibold mb-3 shrink-0">
        <button
          type="button"
          onClick={() => { setActiveScope('operation'); setActiveChannel('all'); }}
          className={`py-2 px-1 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeScope === 'operation' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Einsatzbezogene Funkkanäle & Gruppen"
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Funkkanäle</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveScope('responders')}
          className={`py-2 px-1 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeScope === 'responders' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Liste aller Suchkräfte & 1:1 Direktchat"
        >
          <Users className="w-3.5 h-3.5" />
          <span>Einsatzkräfte</span>
        </button>
      </div>

      {/* Channel List (scrollable) */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
        {activeScope === 'operation' ? (
          <div className="space-y-3 font-mono text-xs">
            {/* Main Channels */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 block">
                HAUPTKANÄLE:
              </span>
              <button
                type="button"
                onClick={() => selectChannel('all')}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition cursor-pointer text-left ${
                  activeChannel === 'all'
                    ? 'bg-blue-600 text-white font-bold shadow ring-1 ring-blue-400'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="text-lg shrink-0">📢</span>
                  <div className="truncate">
                    <div className="font-bold leading-tight uppercase text-sm">Gesamter Einsatzfunk</div>
                    <div className="text-[10px] opacity-75 mt-0.5">{activeUsersCount} Einheiten online</div>
                  </div>
                </div>
                {activeChannel === 'all' && <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />}
              </button>

              <button
                type="button"
                onClick={() => selectChannel('ez_contact')}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition cursor-pointer text-left ${
                  activeChannel === 'ez_contact'
                    ? 'bg-amber-600 text-white font-bold shadow ring-1 ring-amber-400'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="text-lg shrink-0">📞</span>
                  <div className="truncate">
                    <div className="font-bold leading-tight uppercase text-sm">Kontakt zur EZ</div>
                    <div className="text-[10px] opacity-75 mt-0.5">Direkter Draht zur Einsatzleitung</div>
                  </div>
                </div>
                {activeChannel === 'ez_contact' && <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />}
              </button>

              {isAdmin && (
              <button
                type="button"
                onClick={() => selectChannel('admins')}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition cursor-pointer text-left ${
                  activeChannel === 'admins'
                    ? 'bg-red-700 text-white font-bold shadow ring-1 ring-red-400'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="text-lg shrink-0">🛡️</span>
                  <div className="truncate">
                    <div className="font-bold leading-tight uppercase text-sm">Führungskanal EL</div>
                    <div className="text-[10px] opacity-75 mt-0.5">Geschützter Chat Einsatzleitung</div>
                  </div>
                </div>
                {activeChannel === 'admins' && <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />}
              </button>
              )}
            </div>

            {/* Sector & Team Channels */}
            <div className="space-y-1 pt-2 border-t border-slate-700">
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  🧭 SEKTOR- & SUCHTRUPPFUNK ({effectiveOperation?.sectors?.length || 0})
                </span>
              </div>

              {effectiveOperation?.sectors && effectiveOperation.sectors.length > 0 ? (
                effectiveOperation.sectors.map((sec) => {
                  const isSelected = activeChannel === sec.id;
                  const isSearched = sec.status === 'searched';
                  const isInProgress = sec.status === 'in_progress';
                  const isSuspicious = sec.status === 'suspicious';

                  const statusBadge = isSearched
                    ? '✅'
                    : isInProgress
                    ? '⏳'
                    : isSuspicious
                    ? '⚠️'
                    : '🎯';

                  const assignedUsers = allUsers.filter(
                    (u) => sec.assignedUserIds?.includes(u.id) || u.assignedSectorId === sec.id
                  );
                  const assignedTeams = effectiveOperation.teams?.filter(
                    (t) => t.sectorIds?.includes(sec.id)
                  ) || [];

                  const teamNames = assignedTeams.map((t) => t.name).join(', ');

                  return (
                    <button
                      type="button"
                      key={sec.id}
                      onClick={() => selectChannel(sec.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition cursor-pointer text-left ${
                        isSelected
                          ? 'bg-amber-600 border border-amber-400 text-white font-bold shadow ring-1 ring-amber-300'
                          : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate min-w-0">
                        <span className="text-base shrink-0">{statusBadge}</span>
                        <div className="truncate min-w-0">
                          <div className="font-bold truncate leading-tight text-sm">{sec.name}</div>
                          <div className="text-[10px] opacity-75 truncate mt-0.5">
                            {teamNames || `${assignedUsers.length} Kräfte`}
                          </div>
                        </div>
                      </div>
                      {isSelected && <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />}
                    </button>
                  );
                })
              ) : (
                <div className="text-[10px] text-slate-500 italic px-2 py-2">
                  Keine Sektoren im aktuellen Einsatz angelegt.
                </div>
              )}

              {/* Teams without sectors */}
              {effectiveOperation?.teams &&
                effectiveOperation.teams.filter((t) => !t.sectorIds || t.sectorIds.length === 0).length > 0 && (
                  <div className="pt-2 border-t border-slate-700/60 space-y-1">
                    <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider px-1 block">
                      👥 WEITERE GRUPPEN:
                    </span>
                    {effectiveOperation.teams
                      .filter((t) => !t.sectorIds || t.sectorIds.length === 0)
                      .map((team) => (
                        <button
                          type="button"
                          key={team.id}
                          onClick={() => selectChannel(team.id)}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer text-left ${
                            activeChannel === team.id
                              ? 'bg-blue-700 border border-blue-400 text-white font-bold'
                              : 'bg-slate-800/60 hover:bg-slate-700/60 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-sm shrink-0">👥</span>
                            <div className="truncate">
                              <div className="font-bold truncate text-amber-300 text-xs">{team.name}</div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {(team.memberUserIds?.length || 0)} Mitglieder
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
            </div>
          </div>
        ) : (
          /* Responders / Direktchat */
          <div className="space-y-3 font-mono text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Sucher / Funkname suchen..."
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider px-1 block">
                DIREKTCHAT ({filteredResponders.length}):
              </span>

              {filteredResponders.map((user) => {
                const isLive = userLocations[user.id]?.isLive ?? user.isActive;
                const isSelected = activeChannel === user.id;
                const dmCount = unreadDmCounts[user.id] || 0;

                return (
                  <button
                    type="button"
                    key={user.id}
                    onClick={() => selectChannel(user.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer text-left ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold shadow'
                        : dmCount > 0
                        ? 'bg-blue-950/60 hover:bg-blue-900/60 text-slate-100 ring-1 ring-blue-500/60'
                        : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="relative h-8 w-8 rounded-lg overflow-hidden bg-slate-900 shrink-0 border border-slate-700 flex items-center justify-center font-bold text-white text-xs">
                        {user.photoUrl ? (
                          <img src={user.photoUrl} alt={user.name} className="h-full w-full object-cover" />
                        ) : (
                          user.name.charAt(0)
                        )}
                        <span
                          className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-slate-900 ${
                            isLive ? 'bg-emerald-500' : 'bg-slate-500'
                          }`}
                        />
                        {/* DM-Unread-Badge */}
                        {dmCount > 0 && !isSelected && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border border-slate-900 animate-pulse z-10">
                            {dmCount > 9 ? '9+' : dmCount}
                          </span>
                        )}
                      </div>
                      <div className="truncate">
                        <div className="font-bold truncate leading-tight flex items-center gap-1 text-sm">
                          <span className="truncate">{user.name}</span>
                          {user.role === 'admin' && (
                            <span className="text-[8px] px-1 rounded bg-red-950 text-red-300 font-mono shrink-0">EL</span>
                          )}
                        </div>
                        <div className="text-[10px] text-blue-300 font-mono truncate">
                          {user.callSign} {user.licensePlate ? `• ${user.licensePlate}` : ''}
                        </div>
                      </div>
                    </div>
                    {dmCount > 0 && !isSelected ? (
                      <span className="text-[10px] font-bold text-blue-300 shrink-0">💬 Neu</span>
                    ) : isSelected ? (
                      <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />
                    ) : null}
                  </button>
                );
              })}

            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ─── Chat Area Content ────────────────────────────────────────────────────
  const ChatAreaContent = () => (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Channel Header */}
      <div className="bg-slate-800/90 px-4 py-3 border-b border-slate-700/80 flex items-center gap-3 shrink-0 shadow-sm">
        {/* Mobile back button */}
        <button
          type="button"
          onClick={() => setMobileView('channels')}
          className="lg:hidden p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 active:scale-95 transition shrink-0"
          title="Kanalauswahl"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Channel icon */}
        {activeTargetUser ? (
          <div className="relative h-9 w-9 rounded-full overflow-hidden bg-slate-700 border border-slate-500 shadow-inner flex items-center justify-center font-bold text-white shrink-0">
            {activeTargetUser.photoUrl ? (
              <img src={activeTargetUser.photoUrl} alt={activeTargetUser.name} className="h-full w-full object-cover" />
            ) : (
              activeTargetUser.name.charAt(0)
            )}
          </div>
        ) : (
          <div className="h-9 w-9 rounded-xl bg-slate-900 border border-slate-600 text-blue-400 flex items-center justify-center text-lg shrink-0">
            {activeChannel === 'all' ? '📢' : activeChannel === 'ez_contact' ? '📞' : activeChannel === 'admins' ? '🛡️' : activeTeam ? '👥' : activeSector ? '🧭' : '💬'}
          </div>
        )}

        {/* Channel info */}
        <div className="truncate flex-1 min-w-0">
          <h3 className="font-extrabold text-sm text-white truncate uppercase">
            {activeChannel === 'all'
              ? 'Gesamter Einsatzfunk'
              : activeChannel === 'ez_contact'
              ? 'Kontakt zur Einsatzleitung'
              : activeChannel === 'admins'
              ? 'Führungskanal EL'
              : activeTeam
              ? `Gruppenfunk: ${activeTeam.name}`
              : activeSector
              ? `Sektor: ${activeSector.name}`
              : activeTargetUser
              ? activeTargetUser.name
              : ''}
          </h3>
          <p className="text-[11px] text-slate-400 truncate">
            {activeTargetUser ? (
              <span className={userLocations[activeTargetUser.id]?.isLive || activeTargetUser.isActive ? 'text-emerald-400' : 'text-slate-400'}>
                {userLocations[activeTargetUser.id]?.isLive || activeTargetUser.isActive ? '● Online' : '● Offline'}
                {activeTargetUser.licensePlate && ` • KFZ: ${activeTargetUser.licensePlate}`}
              </span>
            ) : (
              activeChannel === 'all'
                ? `${activeUsersCount} Einsatzkräfte online`
                : activeChannel === 'ez_contact'
                ? 'Nachrichten sind nur für die Einsatzleitung sichtbar'
                : activeChannel === 'admins'
                ? 'Geschützter Führungskanal der Einsatzleitung'
                : activeTeam
                ? `${(activeTeam.memberUserIds?.length || 0) + (activeTeam.externalVolunteersCount || 0)} Kräfte`
                : activeSector
                ? `${secAssignedCount(activeSector, allUsers)} online`
                : ''
            )}
          </p>
        </div>

        {activeTargetUser && (
          <span className="text-[10px] text-blue-300 font-mono font-semibold shrink-0 bg-blue-900/40 px-2 py-0.5 rounded-full border border-blue-700/50 hidden sm:inline">
            {activeTargetUser.callSign}
          </span>
        )}
      </div>

      {/* Messages Feed */}
      <div
        className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 bg-slate-950/40 touch-pan-y"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {activeChannelMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm space-y-3 font-sans py-12">
            <Radio className="w-10 h-10 opacity-30 text-blue-400 animate-pulse" />
            <span className="text-center">Keine Funksprüche im aktiven Kanal</span>
          </div>
        ) : (
          activeChannelMessages.map((msg, index) => {
            const isMe = msg.senderId === currentUserId;
            const prevMsg = activeChannelMessages[index - 1];
            const isSameSender = prevMsg && prevMsg.senderId === msg.senderId;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${isSameSender ? 'mt-1' : 'mt-4'}`}
              >
                {!isSameSender && (
                  <div className={`flex items-center gap-2 px-1 mb-1.5 text-xs text-slate-400 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="font-bold text-slate-200">{isMe ? 'Du' : msg.senderName}</span>
                    <span className="text-[10px] text-blue-300 font-mono font-semibold">({msg.senderCallSign})</span>
                    {msg.senderRole === 'admin' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600 text-white font-mono font-bold shadow-sm">
                        EL
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}

                <div
                  className={`max-w-[88%] sm:max-w-[72%] px-4 py-3 rounded-2xl text-sm space-y-2 shadow-md transition ${
                    isMe
                      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-sm border border-blue-500/50'
                      : 'bg-[#1E293B] text-slate-100 rounded-bl-sm border border-slate-700/80'
                  }`}
                >
                  {msg.text && <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>}

                  {msg.isVoiceMessage && msg.audioUrl && (
                    <VoiceMessagePlayer audioUrl={msg.audioUrl} duration={msg.audioDuration} isMe={isMe} />
                  )}

                  {msg.location && (
                    <div className="mt-2 pt-2 border-t border-white/20 flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 font-mono font-medium">
                        <MapPin className="w-3.5 h-3.5 text-amber-400" />
                        GPS: {msg.location.lat.toFixed(5)}, {msg.location.lng.toFixed(5)}
                      </span>
                      <a
                        href={`https://www.google.com/maps?q=${msg.location.lat},${msg.location.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-0.5 rounded bg-black/30 text-white font-mono text-[10px] underline"
                      >
                        Maps
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Recording Overlay */}
      {isRecording && (
        <div className="bg-amber-950/95 border-t border-amber-500/50 px-4 py-3 flex items-center justify-between text-amber-200 text-xs font-mono shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 rounded-full bg-red-500 animate-ping shrink-0" />
            <span className="font-bold tracking-wider">🎙️ CB-Funk überträgt...</span>
            <span className="px-2 py-0.5 rounded bg-amber-900 border border-amber-600 font-bold tabular-nums">
              0:{recordingTime < 10 ? `0${recordingTime}` : recordingTime} / 0:30s
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer active:scale-95"
            >
              ✕
            </button>
            <button
              type="button"
              onClick={stopAndSendRecording}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-lg cursor-pointer active:scale-95"
            >
              Roger! ✓
            </button>
          </div>
        </div>
      )}

      {/* Input Bar */}
      <form onSubmit={handleSend} className="bg-slate-900 border-t border-slate-700/80 p-3 space-y-2.5 shrink-0">
        {/* GPS toggle row */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIncludeLocation(!includeLocation)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
              includeLocation
                ? 'bg-blue-500/20 text-blue-300 border-blue-500'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>GPS</span>
          </button>

          <div className="text-[10px] text-slate-500 font-mono hidden sm:flex items-center gap-1 bg-slate-800/60 px-2 py-1 rounded border border-slate-700/60">
            <span>🎙️ Halten = Funk</span>
            <span className="text-slate-600">•</span>
            <kbd className="px-1 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 font-mono">Leertaste</kbd>
          </div>
        </div>

        {/* Text + PTT + Send */}
        <div className="flex items-center gap-2">
          {/* PTT Button */}
          <button
            type="button"
            onPointerDown={handlePttPointerDown}
            onPointerUp={handlePttPointerUp}
            onPointerCancel={handlePttPointerCancel}
            onClick={handlePttButtonClick}
            onContextMenu={(e) => e.preventDefault()}
            title={isRecording ? 'Klicken zum Beenden und Senden' : 'Gedrückt halten zum Sprechen'}
            className={`h-12 w-14 rounded-xl flex flex-col items-center justify-center gap-0.5 font-bold transition cursor-pointer shrink-0 border select-none touch-none ${
              isRecording
                ? 'bg-red-600 text-white border-red-500 animate-pulse shadow-lg ring-2 ring-red-400/60'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-900 border-amber-400 shadow active:scale-95'
            }`}
          >
            <Mic className="w-5 h-5" />
            <span className="text-[9px] font-bold tracking-wide">{isRecording ? 'SENDEN' : 'PTT'}</span>
          </button>

          {/* Text input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`An ${
              activeChannel === 'all'
                ? 'alle Einheiten'
                : activeChannel === 'ez_contact'
                ? 'Einsatzzentrale'
                : activeChannel === 'admins'
                ? 'Einsatzleitung'
                : activeSector
                ? `Sektor ${activeSector.name}`
                : activeTargetUser?.callSign || 'Kanal'
            }...`}
            className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-slate-50 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50 placeholder-slate-500 shadow-inner"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() && !includeLocation}
            className="h-12 w-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg disabled:opacity-40 transition cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );

  if (!currentUser) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono">
        Bitte melden Sie sich an, um den Funkchat zu nutzen.
      </div>
    );
  }

  return (
    <div
      className={`w-full text-slate-100 font-sans flex flex-col ${
        isMaximized
          ? 'fixed inset-0 z-[9999] bg-[#0A1628] h-full w-full overflow-hidden'
          : 'max-w-7xl mx-auto flex-1 h-full min-h-0 overflow-hidden'
      }`}
    >
      {/* ── TOP HEADER BAR ───────────────────────────────────────────────── */}
      <div className="bg-[#1E293B] border-b border-slate-700/80 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 shrink-0 shadow-lg">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-sm tracking-wide text-white whitespace-nowrap">Einsatzfunk</h2>
              <span className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate max-w-[160px] sm:max-w-xs">
              {effectiveOperation ? effectiveOperation.title : 'Allgemeiner Funk'}
            </p>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Verlauf */}
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-blue-300 transition cursor-pointer flex items-center gap-1.5"
            title="Vollständigen Chatverlauf einsehen"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-semibold">Verlauf</span>
          </button>

          {/* Logbuch */}
          <button
            type="button"
            onClick={() => setShowLogbookModal(true)}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition cursor-pointer flex items-center gap-1.5 relative"
            title="System-Logbuch"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-semibold">Logbuch</span>
            {logbookMessages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[8px] font-bold flex items-center justify-center">
                {logbookMessages.length > 9 ? '9+' : logbookMessages.length}
              </span>
            )}
          </button>

          {/* Alarme */}
          <button
            type="button"
            onClick={() => setShowAlertsModal(true)}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-800/60 text-red-200 transition cursor-pointer flex items-center gap-1.5 relative"
            title="Alarme & Statusänderungen"
          >
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="hidden sm:inline text-xs font-semibold">Alarme</span>
            {alertMessages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[8px] font-bold flex items-center justify-center">
                {alertMessages.length > 9 ? '9+' : alertMessages.length}
              </span>
            )}
          </button>

          {/* CB AutoPlay */}
          <button
            type="button"
            onClick={() => { playAlertSound('notification'); setAutoPlayAudio(!autoPlayAudio); }}
            title={autoPlayAudio ? 'CB-Lautsprecher aktiv' : 'CB-Lautsprecher stumm'}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              autoPlayAudio
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {autoPlayAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Vollbild */}
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-400 transition cursor-pointer hidden sm:flex"
            title={isMaximized ? 'Normalfenster' : 'Vollbild'}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── MAIN TAB BAR (Funkkanäle / Fundmeldungen) ───────────────────── */}
      <div className="grid grid-cols-2 gap-1 p-1.5 bg-[#1E293B] border-b border-slate-700/80 shrink-0">
        <button
          type="button"
          onClick={() => setMainTab('channels')}
          className={`py-2.5 px-3 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer text-sm font-semibold ${
            mainTab === 'channels'
              ? 'bg-blue-600 text-white shadow ring-1 ring-blue-400/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Radio className="w-4 h-4 text-amber-400" />
          <span>Funkkanäle</span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('findings')}
          className={`py-2.5 px-3 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer relative text-sm font-semibold ${
            mainTab === 'findings'
              ? 'bg-amber-600 text-white shadow ring-1 ring-amber-400/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-300" />
          <span>Fundmeldungen</span>
          {findings && findings.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
              {findings.length}
            </span>
          )}
        </button>
      </div>

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      {mainTab === 'findings' ? (
        /* Fundmeldungen View */
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#0F172A]">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Fundmeldungen ({findings?.length || 0})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 hidden sm:block">Chronologisch mit GPS</span>
          </div>

          {(!findings || findings.length === 0) ? (
            <div className="py-16 text-center text-slate-500 space-y-3">
              <div className="text-4xl">🔍</div>
              <div className="font-bold text-white text-sm">Keine Fundmeldungen dokumentiert</div>
              <p className="text-slate-400 text-xs max-w-xs mx-auto">
                Nutzen Sie die rote «FUND!»-Schaltfläche auf der Lagekarte.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {findings.map((f) => (
                <div key={f.id} className="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl space-y-3 shadow-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 text-[10px] font-bold uppercase border border-amber-600/50">
                        {f.category || 'Fundstück'}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-1">{f.title}</h4>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                      {new Date(f.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {f.mediaUrl && (
                    <div className="h-40 rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                      <img src={f.mediaUrl} alt={f.title} className="w-full h-full object-cover" />
                    </div>
                  )}

                  <p className="text-slate-200 text-xs leading-relaxed">{f.description || 'Keine Beschreibung.'}</p>

                  <div className="pt-2 border-t border-slate-700 flex items-center justify-between text-[10px] text-slate-400">
                    <div>Gemeldet von: <strong className="text-white">{f.userName}</strong></div>
                    {f.location && (
                      <a
                        href={`https://www.google.com/maps?q=${f.location.lat},${f.location.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 font-bold flex items-center gap-1 transition"
                      >
                        <MapPin className="w-3 h-3 text-amber-400" />
                        <span>GPS Karte</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Channels View */
        <div className="flex-1 min-h-0 flex overflow-hidden">

          {/* ── DESKTOP: Left Sidebar ─────────────────────────────────────── */}
          <div className="hidden lg:flex w-72 xl:w-80 flex-col bg-[#1E293B] border-r border-slate-700/80 p-3 shrink-0 overflow-hidden">
            <ChannelSidebarContent />
          </div>

          {/* ── MOBILE: Channel List View ─────────────────────────────────── */}
          {mobileView === 'channels' && (
            <div className="lg:hidden flex-1 flex flex-col bg-[#1E293B] p-3 overflow-hidden">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Kanalauswahl</h3>
                <button
                  type="button"
                  onClick={() => setMobileView('chat')}
                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ChannelSidebarContent />
            </div>
          )}

          {/* ── MOBILE: Chat View ─────────────────────────────────────────── */}
          {mobileView === 'chat' && (
            <div className="lg:hidden flex-1 flex flex-col bg-[#0F172A] overflow-hidden min-w-0">
              <ChatAreaContent />
            </div>
          )}

          {/* ── DESKTOP: Chat Area ────────────────────────────────────────── */}
          <div className="hidden lg:flex flex-1 flex-col bg-[#0F172A] overflow-hidden min-w-0">
            <ChatAreaContent />
          </div>
        </div>
      )}

      {/* ── MODAL 1: Chatverlauf ─────────────────────────────────────────── */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[6000] flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-md font-sans">
          <div className="bg-[#1E293B] border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl text-slate-100 flex flex-col h-[92vh] sm:h-[85vh] overflow-hidden printable-chat-modal">
            <div className="bg-slate-900 px-4 py-3.5 border-b border-slate-700 flex items-center justify-between shrink-0 hide-on-print">
              {/* Drag handle (mobile) */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-600 sm:hidden" />
              <div className="flex items-center gap-2.5 mt-1 sm:mt-0">
                <MessageSquare className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-white">Chatverlauf</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Archivierte Funksprüche durchsuchen</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isFirstAdmin(currentUser) && (
                  <button
                    onClick={() => { window.print(); setTimeout(() => clearChatHistory(), 1000); }}
                    className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 border border-red-500 text-red-300 font-bold text-xs transition cursor-pointer hidden sm:flex"
                    title="Als PDF speichern und Verlauf leeren"
                  >
                    PDF & Leeren
                  </button>
                )}
                <button onClick={() => setShowHistoryModal(false)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-700 shrink-0 hide-on-print">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  placeholder="Suchen nach Sender, Funkname, Text..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#0F172A]/40 font-mono printable-area">
              {chatMessages
                .filter((m) => {
                  if (m.channel === 'system' || m.channel === 'logs' || m.text.includes('hat sich soeben eingeloggt') || m.text.includes('hat das System verlassen')) return false;
                  if (!historySearchQuery.trim()) return true;
                  const q = historySearchQuery.toLowerCase();
                  return m.text.toLowerCase().includes(q) || m.senderName.toLowerCase().includes(q) || m.senderCallSign.toLowerCase().includes(q);
                })
                .map((msg) => (
                  <div key={msg.id} className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span className="font-bold text-blue-300">{msg.senderName} ({msg.senderCallSign}) • {msg.channel}</span>
                      <span>{new Date(msg.timestamp).toLocaleString('de-DE')}</span>
                    </div>
                    <p className="text-slate-100 whitespace-pre-wrap">{msg.text}</p>
                    {msg.isVoiceMessage && msg.audioUrl && (
                      <VoiceMessagePlayer audioUrl={msg.audioUrl} duration={msg.audioDuration} />
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Logbuch ─────────────────────────────────────────────── */}
      {showLogbookModal && (
        <div className="fixed inset-0 z-[6000] flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-md font-sans">
          <div className="bg-[#1E293B] border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl text-slate-100 flex flex-col h-[85vh] sm:h-[80vh] overflow-hidden printable-chat-modal">
            <div className="bg-slate-900 px-4 py-3.5 border-b border-slate-700 flex items-center justify-between shrink-0 hide-on-print">
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-600 sm:hidden" />
              <div className="flex items-center gap-2.5 mt-1 sm:mt-0">
                <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-white">System-Logbuch</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Ein- & Ausloggen</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isFirstAdmin(currentUser) && (
                  <button
                    onClick={() => { window.print(); setTimeout(() => clearLogbook(), 1000); }}
                    className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 border border-red-500 text-red-300 font-bold text-xs transition cursor-pointer hidden sm:flex"
                  >
                    PDF & Leeren
                  </button>
                )}
                <button onClick={() => setShowLogbookModal(false)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-2 bg-[#0F172A]/40 font-mono printable-area">
              {logbookMessages.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">Keine Logbuch-Einträge vorhanden.</div>
              ) : (
                logbookMessages.map((msg) => (
                  <div key={msg.id} className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-start gap-3 text-xs">
                    <span className="text-base">📋</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-bold text-slate-300">{msg.senderName}</span>
                        <span>{new Date(msg.timestamp).toLocaleString('de-DE')}</span>
                      </div>
                      <p className="text-slate-200 mt-0.5">{msg.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: Alarme & Funde ──────────────────────────────────────── */}
      {showAlertsModal && (
        <div className="fixed inset-0 z-[6000] flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-md font-sans">
          <div className="bg-[#1E293B] border border-red-900/80 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl text-slate-100 flex flex-col h-[90vh] sm:h-[85vh] overflow-hidden printable-chat-modal">
            <div className="bg-red-950/90 px-4 py-3.5 border-b border-red-800 flex items-center justify-between shrink-0 hide-on-print">
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-red-800 sm:hidden" />
              <div className="flex items-center gap-2.5 mt-1 sm:mt-0">
                <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-white">Alarme & Fundmeldungen</h3>
                  <p className="text-[11px] text-red-200 font-mono">Statusänderungen, Eilmeldungen & Funde</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isFirstAdmin(currentUser) && (
                  <button
                    onClick={() => { window.print(); setTimeout(() => clearAlerts(), 1000); }}
                    className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 border border-red-500 text-red-300 font-bold text-xs transition cursor-pointer hidden sm:flex"
                  >
                    PDF & Leeren
                  </button>
                )}
                <button onClick={() => setShowAlertsModal(false)} className="p-2 rounded-lg bg-black/30 hover:bg-black/50 text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#0F172A]/40 font-mono printable-area">
              {findings && findings.length > 0 && (
                <div className="space-y-2 mb-4">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                    DOKUMENTIERTE FUNDE ({findings.length}):
                  </span>
                  {findings.map((f) => (
                    <div key={f.id} className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/50 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300">🚨 {f.title} ({f.category})</span>
                        <span className="text-[10px] text-slate-400">{new Date(f.timestamp).toLocaleString('de-DE')}</span>
                      </div>
                      <p className="text-slate-200">{f.description}</p>
                      {f.location && (
                        <div className="text-[10px] text-amber-400">
                          📍 GPS: {f.location.lat.toFixed(5)}, {f.location.lng.toFixed(5)} • {f.userName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <span className="text-xs font-bold text-red-400 uppercase tracking-wider block">
                STATUS- & EILMELDUNGEN ({alertMessages.length}):
              </span>
              {alertMessages.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">Keine besonderen Alarme vorhanden.</div>
              ) : (
                alertMessages.map((msg) => (
                  <div key={msg.id} className="p-3 rounded-xl bg-red-950/40 border border-red-700/60 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[10px] text-red-300">
                      <span className="font-bold">{msg.senderName} ({msg.senderCallSign})</span>
                      <span>{new Date(msg.timestamp).toLocaleString('de-DE')}</span>
                    </div>
                    <p className="text-red-100 font-bold whitespace-pre-wrap">{msg.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function secAssignedCount(sec: any, allUsers: User[]): number {
  if (!sec || !sec.assignedUserIds) return 0;
  return allUsers.filter((u) => sec.assignedUserIds.includes(u.id) && u.isActive).length;
}
