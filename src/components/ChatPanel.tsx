import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRescue } from '../context/RescueContext';
import { User, ChatMessage, SearchTeam, SearchOperation } from '../types';
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
              CB-Funk Audio
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
    lastReadChatTimestamp,
    userLocations,
    playAlertSound,
    findings,
  } = useRescue();

  // Primary navigation tab: 'channels' (Kanäle & Gruppen) vs 'findings' (Fundmeldungen mit Infos)
  const [mainTab, setMainTab] = useState<'channels' | 'findings'>('channels');

  // Active channel/user ID
  const [activeChannel, setActiveChannel] = useState<string>('all'); // 'all', 'admins', sectorId, or userId
  const [activeScope, setActiveScope] = useState<'operation' | 'responders' | 'general'>(() =>
    currentOperation ? 'operation' : 'general'
  );
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

  useEffect(() => {
    if (initialDirectUser) {
      setMainTab('channels');
      setActiveScope('responders');
      setActiveChannel(initialDirectUser.id);
    } else if (currentUser?.role === 'observer') {
      setActiveChannel('admins');
    }
  }, [initialDirectUser, currentUser]);

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

  if (!currentUser) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono">
        Bitte melden Sie sich an, um den Funkchat zu nutzen.
      </div>
    );
  }

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

  const effectiveOperation = allOperations.find((o) => o.id === selectedOpId) || currentOperation || null;

  // Split messages by type according to user requirements:
  // 1. Logbuch messages: Login / Logout logs
  const logbookMessages = useMemo(() => {
    return chatMessages.filter(
      (m) =>
        m.channel === 'system' ||
        m.channel === 'logs' ||
        m.text.includes('hat sich soeben eingeloggt') ||
        m.text.includes('hat das System verlassen')
    );
  }, [chatMessages]);

  // 2. Alert messages: Status changes & emergency alerts
  const alertMessages = useMemo(() => {
    return chatMessages.filter(
      (m) =>
        m.isAlert ||
        m.text.includes('EINSATZ REAKTIVIERT') ||
        m.text.includes('EINSATZ BEENDET') ||
        m.text.includes('EINSATZ PAUSIERT') ||
        m.text.includes('EINSATZ WIEDERAUFGENOMMEN') ||
        m.text.includes('REALEINSATZ')
    );
  }, [chatMessages]);

  // 3. Radio & Chat Feed for the active channel (clean radio talk only, excluding system logouts/logins)
  const activeChannelMessages = useMemo(() => {
    return chatMessages.filter((msg) => {
      // Filter out pure system login/logout messages from channel feed (user requested them in logbook)
      if (
        msg.channel === 'system' ||
        msg.channel === 'logs' ||
        msg.text.includes('hat sich soeben eingeloggt') ||
        msg.text.includes('hat das System verlassen')
      ) {
        return false;
      }

      // Filter by operation scope
      if (activeScope === 'general') {
        if (msg.operationId !== 'general') return false;
      } else {
        if (!effectiveOperation || msg.operationId !== effectiveOperation.id) return false;
      }

      // Filter by active channel / direct user
      if (activeChannel === 'all' || activeChannel === 'general') {
        return msg.channel === 'all' || msg.channel === 'general';
      } else if (activeChannel === 'admins') {
        return msg.channel === 'admins';
      } else if (activeChannel.startsWith('sec-') || activeChannel.startsWith('team-')) {
        return msg.channel === activeChannel;
      } else {
        // Direct 1:1 chat
        return (
          (msg.senderId === currentUser.id && msg.recipientId === activeChannel) ||
          (msg.senderId === activeChannel && msg.recipientId === currentUser.id) ||
          msg.channel === activeChannel
        );
      }
    });
  }, [chatMessages, activeScope, effectiveOperation, activeChannel, currentUser.id]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !includeLocation) return;

    const isDirect =
      activeChannel !== 'all' &&
      activeChannel !== 'admins' &&
      activeChannel !== 'general' &&
      !activeChannel.startsWith('sec-') &&
      !activeChannel.startsWith('team-');

    const targetOpId = activeScope === 'general' ? 'general' : effectiveOperation?.id || 'general';

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
    .filter((u) => u.id !== currentUser.id)
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

  return (
    <div
      className={`w-full text-slate-100 font-sans flex flex-col ${
        isMaximized
          ? 'fixed inset-0 z-[9999] bg-[#0F172A] p-2 sm:p-4 h-full w-full overflow-hidden'
          : 'max-w-7xl mx-auto p-1.5 sm:p-3 flex-1 h-full min-h-0 overflow-hidden'
      }`}
    >
      {/* Top Action & Navigation Header Bar */}
      <div className="bg-[#1E293B] border border-slate-700/80 rounded-2xl p-2.5 sm:p-3 mb-3 flex flex-wrap items-center justify-between gap-2 shadow-xl shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-white flex items-center gap-1.5">
              <span>Einsatzfunk & Communication Hub</span>
            </h2>
            <p className="text-[10px] text-slate-400 font-mono">
              {activeScope === 'operation' && effectiveOperation
                ? `Einsatz: #${effectiveOperation.id.slice(-4).toUpperCase()} ${effectiveOperation.title}`
                : 'Allgemeiner Vereinsfunk'}
            </p>
          </div>
        </div>

        {/* Action Buttons to open Modals (Chatverlauf, Logbuch, Alarme & Funde) as requested by user */}
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
          {/* Button: 📜 Chatverlauf */}
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-blue-300 font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Vollständigen Chatverlauf durchsuchen & einsehen"
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
            <span>📜 Chatverlauf</span>
          </button>

          {/* Button: 📋 Logbuch */}
          <button
            type="button"
            onClick={() => setShowLogbookModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold flex items-center gap-1.5 transition cursor-pointer relative"
            title="System-Logbuch (Ein- und Ausloggen der Einsatzkräfte)"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>📋 Logbuch</span>
            {logbookMessages.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[9px] font-bold">
                {logbookMessages.length}
              </span>
            )}
          </button>

          {/* Button: 🚨 Alarme */}
          <button
            type="button"
            onClick={() => setShowAlertsModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-700/80 text-red-200 font-bold flex items-center gap-1.5 transition cursor-pointer relative"
            title="Alarme & Statusänderungen"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            <span>🚨 Alarme</span>
            {alertMessages.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[9px] font-bold">
                {alertMessages.length}
              </span>
            )}
          </button>

          {/* Button: CB-Funk AutoPlay */}
          <button
            type="button"
            onClick={() => {
              playAlertSound('notification');
              setAutoPlayAudio(!autoPlayAudio);
            }}
            title={autoPlayAudio ? 'CB-Lautsprecher aktiv (Auto-Play)' : 'CB-Lautsprecher stumm'}
            className={`px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1 border transition cursor-pointer ${
              autoPlayAudio
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {autoPlayAudio ? <Volume2 className="w-3.5 h-3.5 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{autoPlayAudio ? '📻 CB-ON' : '🔇 OFF'}</span>
          </button>

          {/* Button: Vollbild / Großansicht */}
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-400 transition cursor-pointer"
            title={isMaximized ? 'Normalfenster' : 'Großansicht / Vollbild'}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main 2-Tab Navigation Bar: Funkkanäle & Kommunikation vs Fundmeldungen mit Infos */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-[#1E293B] border border-slate-700/80 rounded-xl mb-3 shrink-0 font-mono text-xs">
        <button
          type="button"
          onClick={() => {
            setMainTab('channels');
          }}
          className={`py-2 px-3 rounded-lg font-extrabold transition flex items-center justify-center gap-2 cursor-pointer ${
            mainTab === 'channels'
              ? 'bg-blue-600 text-white shadow-lg ring-1 ring-blue-400/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>📻 Funkkanäle &amp; Kommunikation</span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('findings')}
          className={`py-2 px-3 rounded-lg font-extrabold transition flex items-center justify-center gap-2 cursor-pointer relative ${
            mainTab === 'findings'
              ? 'bg-amber-600 text-white shadow-lg ring-1 ring-amber-400/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-300" />
          <span>🔍 Fundmeldungen mit Infos</span>
          {findings && findings.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
              {findings.length}
            </span>
          )}
        </button>
      </div>

      {/* Body Area */}
      {mainTab === 'findings' ? (
        /* Dedicated Fundmeldungen mit Infos View */
        <div className="flex-1 bg-[#1E293B] border border-slate-700/80 rounded-2xl p-4 sm:p-6 shadow-xl overflow-y-auto space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Dokumentierte Fundmeldungen &amp; Fundstücke ({findings?.length || 0})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Chronologische Aufzeichnung mit GPS &amp; Fotos</span>
          </div>

          {(!findings || findings.length === 0) ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <div className="text-3xl">🔍</div>
              <div className="font-bold text-white">Bisher keine Fundmeldungen dokumentiert</div>
              <p className="text-slate-400 text-[11px]">
                Nutzen Sie die rote Schaltfläche "FUND!" auf der Lagekarte, um relevante Funde mit GPS-Koordinaten zu melden.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {findings.map((f) => (
                <div key={f.id} className="bg-slate-900/90 border border-slate-700 p-4 rounded-xl space-y-3 shadow-lg">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
                    <div>
                      <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 text-[10px] font-bold uppercase border border-amber-600/50">
                        {f.category || 'Fundstück'}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-1">{f.title}</h4>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(f.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {f.mediaUrl && (
                    <div className="h-40 rounded-lg overflow-hidden bg-slate-950 border border-slate-800">
                      <img src={f.mediaUrl} alt={f.title} className="w-full h-full object-cover" />
                    </div>
                  )}

                  <p className="text-slate-200 text-xs font-sans leading-relaxed">{f.description || 'Keine nähere Beschreibung angegeben.'}</p>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                    <div>
                      Gemeldet von: <strong className="text-white">{f.userName}</strong>
                    </div>
                    {f.location && (
                      <a
                        href={`https://www.google.com/maps?q=${f.location.lat},${f.location.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 font-bold flex items-center gap-1 transition"
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
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 h-full overflow-hidden">
          {/* Left Selector Drawer: 3-Way Scope Switcher (Einsatzfunk, Einsatzkräfte, Vereinsfunk) */}
          <div className="w-full lg:w-80 bg-[#1E293B] border border-slate-700/80 rounded-2xl p-3 flex flex-col justify-between shadow-xl shrink-0 overflow-hidden max-h-[240px] sm:max-h-[280px] lg:max-h-none min-h-0">
            <div className="space-y-3 overflow-y-auto pr-1 flex-1 min-h-0 font-mono text-xs" style={{ WebkitOverflowScrolling: 'touch' }}>
              {/* Scope Switcher: 3 Options */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 border border-slate-700 rounded-xl text-[9px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setActiveScope('operation');
                    setActiveChannel('all');
                  }}
                  className={`py-1.5 px-1 rounded-lg transition flex items-center justify-center gap-0.5 cursor-pointer truncate ${
                    activeScope === 'operation' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Einsatzbezogene Funkkanäle & Gruppen"
                >
                  <span>🚨 Einsatz</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveScope('responders');
                  }}
                  className={`py-1.5 px-1 rounded-lg transition flex items-center justify-center gap-0.5 cursor-pointer truncate ${
                    activeScope === 'responders' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Liste aller Suchkräfte & 1:1 Direktchat"
                >
                  <span>👥 Kräfte</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveScope('general');
                    setActiveChannel('all');
                  }}
                  className={`py-1.5 px-1 rounded-lg transition flex items-center justify-center gap-0.5 cursor-pointer truncate ${
                    activeScope === 'general' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Allgemeiner Vereinsfunk & Vorstand"
                >
                  <span>🌐 Verein</span>
                </button>
              </div>

                {activeScope === 'operation' ? (
                  <div className="space-y-3">
                    {/* Primary Operation Channels */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 block">
                        HAUPTKANÄLE EINSATZ:
                      </span>

                      {/* Channel: Gesamter Einsatzfunk */}
                      <button
                        type="button"
                        onClick={() => setActiveChannel('all')}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer text-left ${
                          activeChannel === 'all'
                            ? 'bg-blue-600 text-white font-bold shadow ring-1 ring-blue-400'
                            : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-base">📢</span>
                          <div className="truncate">
                            <div className="font-bold leading-tight uppercase">Gesamter Einsatzfunk</div>
                            <div className="text-[10px] opacity-75">{activeUsersCount} Einheiten online</div>
                          </div>
                        </div>
                      </button>

                      {/* Channel: Führungskanal EL */}
                      <button
                        type="button"
                        onClick={() => setActiveChannel('admins')}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer text-left ${
                          activeChannel === 'admins'
                            ? 'bg-red-700 text-white font-bold shadow ring-1 ring-red-400'
                            : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-base">🛡️</span>
                          <div className="truncate">
                            <div className="font-bold leading-tight uppercase">Führungskanal EL</div>
                            <div className="text-[10px] opacity-75">Geschützter Chat Einsatzleitung</div>
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Suchtrupps / Gruppen-Funkkanäle */}
                    <div className="space-y-1 pt-2 border-t border-slate-700">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">
                          👥 SUCHTRUPPS &amp; GRUPPEN ({effectiveOperation?.teams?.length || 0}):
                        </span>
                      </div>

                      {effectiveOperation?.teams && effectiveOperation.teams.length > 0 ? (
                        effectiveOperation.teams.map((team) => {
                          const isSelected = activeChannel === team.id;
                          const totalMembers = (team.memberUserIds?.length || 0) + (team.externalVolunteersCount || 0);
                          return (
                            <button
                              type="button"
                              key={team.id}
                              onClick={() => setActiveChannel(team.id)}
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer text-left ${
                                isSelected
                                  ? 'bg-blue-700 border border-blue-400 text-white font-bold shadow'
                                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="text-base shrink-0">👥</span>
                                <div className="truncate">
                                  <div className="font-bold truncate leading-tight text-amber-300">{team.name}</div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    {totalMembers} Helfer • Sektoren: {getTeamSectorsText(team, effectiveOperation)}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="text-[10px] text-slate-500 italic px-2 py-1">
                          Keine Suchtrupps / Gruppen gebildet.
                        </div>
                      )}
                    </div>

                    {/* Sektor Funkkanäle */}
                    {effectiveOperation?.sectors && effectiveOperation.sectors.length > 0 && (
                      <div className="space-y-1 pt-2 border-t border-slate-700">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider px-1 block">
                          🧭 SEKTOR-FUNKKANÄLE:
                        </span>

                        {effectiveOperation.sectors.map((sec) => (
                          <button
                            type="button"
                            key={sec.id}
                            onClick={() => setActiveChannel(sec.id)}
                            className={`w-full flex items-center justify-between p-2 rounded-xl transition cursor-pointer text-left ${
                              activeChannel === sec.id
                                ? 'bg-amber-500/20 border border-amber-500 text-amber-200 font-bold'
                                : 'bg-slate-800/60 hover:bg-slate-700/60 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                              <div className="truncate">
                                <div className="font-bold truncate">{sec.name}</div>
                                <div className="text-[10px] text-slate-400">
                                  {sec.assignedUserIds?.length || 0} Kräfte zugeteilt
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : activeScope === 'responders' ? (
                  /* Einsatzkräfte & Direktchat Scope */
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        placeholder="Sucher / Funkname suchen..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider px-1 block">
                        DIREKTCHAT MIT EINSATZKRAFT ({filteredResponders.length}):
                      </span>

                      {filteredResponders.map((user) => {
                        const isLive = userLocations[user.id]?.isLive ?? user.isActive;
                        const isSelected = activeChannel === user.id;

                        return (
                          <button
                            type="button"
                            key={user.id}
                            onClick={() => setActiveChannel(user.id)}
                            className={`w-full flex items-center justify-between p-2 rounded-xl transition cursor-pointer text-left ${
                              isSelected
                                ? 'bg-blue-600 text-white font-bold shadow'
                                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <div className="relative h-7 w-7 rounded-lg overflow-hidden bg-slate-900 shrink-0 border border-slate-700 flex items-center justify-center font-bold text-white text-xs">
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
                              </div>
                              <div className="truncate">
                                <div className="font-bold truncate leading-tight flex items-center gap-1">
                                  <span className="truncate">{user.name}</span>
                                  {user.role === 'admin' && (
                                    <span className="text-[8px] px-1 rounded bg-red-950 text-red-300 font-mono">EL</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-blue-300 font-mono truncate">
                                  {user.callSign} {user.licensePlate ? `• ${user.licensePlate}` : ''}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Vereinsfunk Scope */
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider px-1 block">
                      VEREINSFUNK (ALLGEMEIN):
                    </span>

                    <button
                      type="button"
                      onClick={() => setActiveChannel('all')}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer text-left ${
                        activeChannel === 'all'
                          ? 'bg-emerald-600 text-white font-bold shadow ring-1 ring-emerald-400'
                          : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-base">💬</span>
                        <div className="truncate">
                          <div className="font-bold leading-tight uppercase">Allgemeiner Vereinsfunk</div>
                          <div className="text-[10px] opacity-75">Spürhunde-Salzlandkreis e.V. Hauptchat</div>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveChannel('admins')}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer text-left ${
                        activeChannel === 'admins'
                          ? 'bg-red-700 text-white font-bold shadow ring-1 ring-red-400'
                          : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-base">🛡️</span>
                        <div className="truncate">
                          <div className="font-bold leading-tight uppercase">Vorstand &amp; Admins</div>
                          <div className="text-[10px] opacity-75">Geschützter Vereinskanal</div>
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>

        {/* Main Active Radio & Chat Area */}
        <div className="flex-1 bg-[#1E293B] border border-slate-700/80 rounded-2xl flex flex-col justify-between shadow-xl overflow-hidden min-h-0">
          {/* Active Target Header */}
          <div className="bg-slate-900/90 p-3 border-b border-slate-700 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 truncate">
              <div className="h-8 w-8 rounded-xl bg-slate-800 border border-slate-700 text-blue-400 flex items-center justify-center font-bold text-base shrink-0">
                {activeChannel === 'all'
                  ? '📢'
                  : activeChannel === 'admins'
                  ? '🛡️'
                  : activeTeam
                  ? '👥'
                  : activeSector
                  ? '🧭'
                  : '💬'}
              </div>
              <div className="truncate">
                <h3 className="font-extrabold text-xs sm:text-sm text-white uppercase tracking-wide truncate flex items-center gap-1.5">
                  <span className="truncate">
                    {activeChannel === 'all'
                      ? activeScope === 'general'
                        ? 'Allgemeiner Vereinsfunk'
                        : 'Gesamter Einsatzfunk'
                      : activeChannel === 'admins'
                      ? 'Führungskanal EL'
                      : activeTeam
                      ? `Gruppenfunk: ${activeTeam.name}`
                      : activeSector
                      ? `Funk Sektor: ${activeSector.name}`
                      : `Direktfunk mit: ${activeTargetUser?.name || 'Suchkraft'}`}
                  </span>
                  {activeTargetUser && (
                    <span className="text-xs text-blue-400 font-mono font-semibold shrink-0">
                      ({activeTargetUser.callSign})
                    </span>
                  )}
                </h3>
                <p className="text-[10px] text-slate-400 font-mono truncate">
                  {activeChannel === 'all'
                    ? `${activeUsersCount} Einsatzkräfte online`
                    : activeChannel === 'admins'
                    ? 'Geschützter Führungskanal der Einsatzleitung'
                    : activeTeam
                    ? `Gruppen-Funkkanal (${(activeTeam.memberUserIds?.length || 0) + (activeTeam.externalVolunteersCount || 0)} Kräfte • Sektoren: ${getTeamSectorsText(activeTeam, effectiveOperation)})`
                    : activeSector
                    ? `Sektor-Funk (${secAssignedCount(activeSector, allUsers)} online)`
                    : `Direkte 1:1 Verbindung • KFZ: ${activeTargetUser?.licensePlate || 'k.A.'}`}
                </p>
              </div>
            </div>
          </div>

          {/* Active Radio Feed Messages */}
          <div
            className="flex-1 p-2 sm:p-4 pb-12 sm:pb-8 overflow-y-auto space-y-3 bg-[#0F172A]/50 touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {activeChannelMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs space-y-2 font-mono">
                <Radio className="w-8 h-8 opacity-30 text-blue-400 animate-pulse" />
                <span>Keine Funksprüche im aktiven Kanal vorhanden.</span>
              </div>
            ) : (
              activeChannelMessages.map((msg, index) => {
                const isMe = msg.senderId === currentUser.id;
                const prevMsg = activeChannelMessages[index - 1];
                const isSameSender = prevMsg && prevMsg.senderId === msg.senderId;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${
                      isSameSender ? 'mt-1' : 'mt-3'
                    }`}
                  >
                    {!isSameSender && (
                      <div className="flex items-center gap-1.5 px-2 mb-1 text-[11px] text-slate-400">
                        <span className="font-bold text-slate-200">{isMe ? 'Du' : msg.senderName}</span>
                        <span className="text-[10px] text-blue-400 font-mono">({msg.senderCallSign})</span>
                        {msg.senderRole === 'admin' && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-red-950 text-red-300 font-mono font-bold">
                            EL
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 font-mono">
                          • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}

                    <div
                      className={`max-w-[88%] sm:max-w-[75%] p-3 rounded-2xl text-xs space-y-1 shadow-md transition ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'
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
                            Google Maps
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

          {/* Recording Overlay / Indicator */}
          {isRecording && (
            <div className="bg-amber-950/90 border-t border-amber-500/50 p-3 flex items-center justify-between animate-pulse text-amber-200 text-xs font-mono">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-red-600 animate-ping" />
                <span className="font-bold uppercase tracking-wider">🎙️ CB-Funk Übertragung läuft...</span>
                <span className="px-2 py-0.5 rounded bg-amber-900 border border-amber-600 font-bold">
                  0:{recordingTime < 10 ? `0${recordingTime}` : recordingTime} / 0:30s
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={stopAndSendRecording}
                  className="px-4 py-1 rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-lg cursor-pointer"
                >
                  Senden (Roger!)
                </button>
              </div>
            </div>
          )}

          {/* Input Bar */}
          <form onSubmit={handleSend} className="bg-slate-900/95 p-2.5 sm:p-3 border-t border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between text-xs px-1">
              <button
                type="button"
                onClick={() => setIncludeLocation(!includeLocation)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer font-mono ${
                  includeLocation
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>GPS-Standort anhängen</span>
              </button>
              <div className="text-[10px] text-slate-400 font-mono hidden sm:block">
                Sprechtaste halten zum Senden (oder tippen)
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onPointerDown={handlePttPointerDown}
                onPointerUp={handlePttPointerUp}
                onPointerCancel={handlePttPointerCancel}
                onClick={handlePttButtonClick}
                onContextMenu={(e) => e.preventDefault()}
                title={isRecording ? 'Klicken zum Beenden und Senden' : 'Gedrückt halten zum Sprechen'}
                className={`h-10 px-3.5 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs transition cursor-pointer shrink-0 border select-none touch-none ${
                  isRecording
                    ? 'bg-red-600 text-white border-red-400 animate-pulse shadow-lg'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow active:scale-95'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span className="hidden sm:inline font-mono uppercase tracking-tight">
                  {isRecording ? 'Senden' : 'CB-Funk'}
                </span>
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Funkspruch senden an ${
                  activeChannel === 'all'
                    ? activeScope === 'general'
                      ? 'alle Vereinsmitglieder'
                      : 'alle Einheiten'
                    : activeChannel === 'admins'
                    ? 'Einsatzleitung'
                    : activeSector
                    ? `Sektor ${activeSector.name}`
                    : activeTargetUser?.callSign || 'Kanal'
                }...`}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 placeholder-slate-500 font-mono"
              />

              <button
                type="submit"
                disabled={!inputText.trim() && !includeLocation}
                className="h-10 px-4 sm:px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg disabled:opacity-40 transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Senden</span>
              </button>
            </div>
          </form>
        </div>
      </div>
      )}

      {/* --- MODAL 1: 📜 Chatverlauf --- */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md font-sans">
          <div className="bg-[#1E293B] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl text-slate-100 flex flex-col h-[85vh] overflow-hidden">
            <div className="bg-slate-900 p-4 border-b border-slate-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Vollständiger Chatverlauf & Nachrichten-Historie
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Archivierte Funksprüche und Textnachrichten durchsuchen
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-900/50 border-b border-slate-700 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  placeholder="Chatverlauf nach Wort, Sender oder Funkrufname durchsuchen..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#0F172A]/40 font-mono">
              {chatMessages
                .filter((m) => {
                  if (!historySearchQuery.trim()) return true;
                  const q = historySearchQuery.toLowerCase();
                  return (
                    m.text.toLowerCase().includes(q) ||
                    m.senderName.toLowerCase().includes(q) ||
                    m.senderCallSign.toLowerCase().includes(q)
                  );
                })
                .map((msg) => (
                  <div key={msg.id} className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span className="font-bold text-blue-300">
                        {msg.senderName} ({msg.senderCallSign}) • Kanal: {msg.channel}
                      </span>
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

      {/* --- MODAL 2: 📋 Logbuch (Ein- und Ausloggen) --- */}
      {showLogbookModal && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md font-sans">
          <div className="bg-[#1E293B] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl text-slate-100 flex flex-col h-[80vh] overflow-hidden">
            <div className="bg-slate-900 p-4 border-b border-slate-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-400" />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    System-Logbuch (Ein- & Ausloggen)
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Chronologische Erfassung aller Systemzugriffe und Anmeldungen
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLogbookModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-2 bg-[#0F172A]/40 font-mono">
              {logbookMessages.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">Keine Logbuch-Einträge vorhanden.</div>
              ) : (
                logbookMessages.map((msg) => (
                  <div key={msg.id} className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-start gap-3 text-xs">
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

      {/* --- MODAL 3: 🚨 Alarme & Funde --- */}
      {showAlertsModal && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md font-sans">
          <div className="bg-[#1E293B] border border-red-900/80 rounded-2xl shadow-2xl w-full max-w-4xl text-slate-100 flex flex-col h-[85vh] overflow-hidden">
            <div className="bg-red-950/90 p-4 border-b border-red-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Einsatz-Alarme, Statusänderungen & Fundmeldungen
                  </h3>
                  <p className="text-xs text-red-200 font-mono">
                    Wichtige Ereignisse, Eilmeldungen und Fundstücke mit GPS
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAlertsModal(false)}
                className="p-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#0F172A]/40 font-mono">
              {/* Findings section */}
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
                          📍 GPS: {f.location.lat.toFixed(5)}, {f.location.lng.toFixed(5)} • Kraft: {f.userName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Status Alert Messages */}
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider block">
                STATUS- &amp; EILMELDUNGEN ({alertMessages.length}):
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
