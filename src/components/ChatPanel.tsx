import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRescue } from '../context/RescueContext';
import { User, ChatMessage } from '../types';
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
  MicOff,
  Square,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Compass,
  Filter,
  Paperclip,
  X,
  Check,
  Clock,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Menu,
  ChevronDown,
} from 'lucide-react';

interface ChatPanelProps {
  initialDirectUser?: User | null;
}

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
      audioRef.current.play().catch(() => {});
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

  const formatSec = (sec: number) => {
    if (isNaN(sec)) return '0:00';
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div
      className={`mt-2 p-2.5 rounded-xl border flex flex-col gap-2 ${
        isMe
          ? 'bg-blue-700/60 border-blue-400/40 text-white'
          : 'bg-white dark:bg-slate-900/90 border-amber-500/30 text-black dark:text-slate-100'
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
              : 'bg-slate-50 dark:bg-[#0F172A]mber-500 text-slate-950 hover:bg-slate-50 dark:bg-[#0F172A]mber-400 shadow'
          }`}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] font-mono opacity-80">
            <span className="flex items-center gap-1 font-bold">
              <Radio className="w-3 h-3 text-amber-400" />
              CB-Funk Audio
            </span>
            <span>
              {formatSec(currentTime)} / {formatSec(duration || audioRef.current?.duration || 0)}
            </span>
          </div>

          {/* Animated Waveform Visualizer */}
          <div className="h-4 flex items-center gap-0.5">
            {[40, 70, 30, 90, 60, 100, 50, 80, 40, 90, 60, 30, 70, 50, 80, 40].map((h, i) => (
              <div
                key={i}
                className={`flex-1 rounded-full transition-all duration-150 ${
                  isPlaying ? 'bg-slate-50 dark:bg-[#0F172A]mber-400 animate-pulse' : isMe ? 'bg-blue-200/60' : 'bg-slate-600'
                }`}
                style={{
                  height: isPlaying ? `${Math.max(25, (h * Math.sin(i + currentTime * 6) + 100) / 2)}%` : `${h}%`,
                }}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSpeedChange}
          className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/30 hover:bg-black/50 border border-white/10 shrink-0 text-slate-900 dark:text-slate-200"
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
    sendEmergencyAlert,
    userLocations,
    playAlertSound,
  } = useRescue();

  const [activeScope, setActiveScope] = useState<'operation' | 'general'>(() => {
    return currentOperation ? 'operation' : 'general';
  });
  const [selectedOpId, setSelectedOpId] = useState<string>(() => {
    return currentOperation?.id || allOperations.find(o => o.status === 'active')?.id || allOperations[0]?.id || '';
  });

  const [activeChannel, setActiveChannel] = useState<string>('all'); // 'all', 'admins', 'general', sectorId, or userId
  const [inputText, setInputText] = useState('');
  const [isEmergencyAlert, setIsEmergencyAlert] = useState(false);
  const [includeLocation, setIncludeLocation] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'voice' | 'alert' | 'location'>('all');
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);

  // Responsive & View Size States
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<'chat' | 'channels'>('chat');
  const [isMaximized, setIsMaximized] = useState(false);

  // CB-Funk Push-to-Talk Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef<number>(chatMessages.length);

  // Sync selectedOpId when currentOperation changes
  useEffect(() => {
    if (currentOperation) {
      setSelectedOpId(currentOperation.id);
    }
  }, [currentOperation?.id]);

  useEffect(() => {
    if (initialDirectUser) {
      setActiveChannel(initialDirectUser.id);
    } else if (currentUser?.role === 'observer') {
      setActiveChannel('admins');
    }
  }, [initialDirectUser, currentUser]);

  // Auto-scroll on new message and mark as read
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    // Mark as read if new messages arrive and we are in the chat view
    if (chatMessages.length > prevMessagesLengthRef.current) {
      markChatAsRead();
      
      // Auto play CB voice message if autoPlayAudio is active and new message arrives
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
          audio.play().catch(() => {});
        }
      }
    }
    prevMessagesLengthRef.current = chatMessages.length;
  }, [chatMessages, activeChannel, autoPlayAudio, currentUser?.id, playAlertSound, markChatAsRead]);

  if (!currentUser) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-mono">
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
      audioChunksRef.current = [];
      let options: MediaRecorderOptions = {};
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 16000 };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4', audioBitsPerSecond: 16000 };
        } else {
          options = { audioBitsPerSecond: 16000 };
        }
      } else {
        options = { audioBitsPerSecond: 16000 };
      }
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
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
    }
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    playAlertSound('cb_tx_end');

    const recorder = mediaRecorderRef.current;
    const finalDuration = recordingTime || 1;

    recorder.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = () => {
        const base64Audio = reader.result as string;
        const isDirect =
          activeChannel !== 'all' &&
          activeChannel !== 'admins' &&
          !activeChannel.startsWith('sec-');

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
      };
    };

    recorder.stop();
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
  };

  // Resolved effective operation for operation chat
  const effectiveOperation = allOperations.find((o) => o.id === selectedOpId) || currentOperation || null;

  // --- Filter messages based on active channel and search query ---
  const filteredMessages = chatMessages.filter((msg) => {
    if (activeScope === 'general') {
      if (msg.operationId !== 'general') return false;
    } else {
      if (!effectiveOperation || msg.operationId !== effectiveOperation.id) return false;
    }

    // Filter by channel type
    let matchesChannel = false;
    if (activeChannel === 'all' || activeChannel === 'general') {
      matchesChannel = msg.channel === 'all' || msg.channel === 'general';
    } else if (activeChannel === 'admins') {
      matchesChannel = msg.channel === 'admins';
    } else if (activeChannel === 'system') {
      matchesChannel = msg.channel === 'system' || msg.channel === 'logs';
    } else if (activeChannel.startsWith('sec-')) {
      matchesChannel = msg.channel === activeChannel;
    } else {
      // Direct 1-on-1 chat with specific user
      matchesChannel =
        (msg.senderId === currentUser.id && msg.recipientId === activeChannel) ||
        (msg.senderId === activeChannel && msg.recipientId === currentUser.id) ||
        msg.channel === activeChannel;
    }

    if (!matchesChannel) return false;

    // Filter by quick filter tab
    if (activeFilter === 'voice' && !msg.isVoiceMessage) return false;
    if (activeFilter === 'alert' && !msg.isAlert) return false;
    if (activeFilter === 'location' && !msg.location) return false;

    // Filter by search query inside feed
    if (messageSearchQuery.trim()) {
      const q = messageSearchQuery.toLowerCase();
      const textMatch = msg.text.toLowerCase().includes(q);
      const senderMatch =
        msg.senderName.toLowerCase().includes(q) || msg.senderCallSign.toLowerCase().includes(q);
      if (!textMatch && !senderMatch) return false;
    }

    return true;
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !includeLocation) return;

    const isDirect =
      activeChannel !== 'all' &&
      activeChannel !== 'admins' &&
      activeChannel !== 'general' &&
      !activeChannel.startsWith('sec-');

    const targetOpId = activeScope === 'general' ? 'general' : (effectiveOperation?.id || 'general');

    sendChatMessage({
      text: inputText.trim() || (includeLocation ? '📍 GPS-Standort übermittelt' : ''),
      channel: activeChannel,
      operationId: targetOpId,
      isDirect,
      recipientId: isDirect ? activeChannel : undefined,
      isAlert: isEmergencyAlert,
      includeLocation,
    });

    setInputText('');
    setIsEmergencyAlert(false);
    setIncludeLocation(false);
  };

  // Filter users based on scope
  const scopedUsers = useMemo(() => {
    if (activeScope === 'operation' && effectiveOperation && (effectiveOperation.status === 'active' || effectiveOperation.status === 'paused')) {
      const participantIds = effectiveOperation.participantIds || [];
      return allUsers.filter((u) => participantIds.includes(u.id));
    }
    return allUsers;
  }, [allUsers, activeScope, effectiveOperation]);

  // Target data objects
  const activeTargetUser = allUsers.find((u) => u.id === activeChannel);
  const activeSector = effectiveOperation?.sectors?.find((s) => s.id === activeChannel);
  const admins = scopedUsers.filter((u) => u.role === 'admin' && u.isActive);
  const responders = scopedUsers.filter((u) => u.id !== currentUser.id && u.role !== 'admin' && u.isActive);
  const activeUsersCount = scopedUsers.filter((u) => u.isActive).length;

  // Filter and sort responders in sidebar by search query and online status
  const filteredResponders = responders
    .filter((u) => {
      if (!userSearchQuery.trim()) return true;
      const q = userSearchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.callSign.toLowerCase().includes(q) ||
        (u.licensePlate && u.licensePlate.toLowerCase().includes(q)) ||
        (u.organization && u.organization.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return a.name.localeCompare(b.name);
    });

  // Calculate unread counts per channel
  const getUnreadForChannel = (channelId: string) => {
    const targetOpId = activeScope === 'general' ? 'general' : effectiveOperation?.id;
    if (!targetOpId) return 0;
    return chatMessages.filter((m) => {
      if (m.operationId !== targetOpId) return false;
      if (m.senderId === currentUser.id) return false;
      
      const msgTime = new Date(m.timestamp).getTime();
      if (msgTime <= lastReadChatTimestamp) return false;

      if (channelId === 'all' || channelId === 'general') return m.channel === 'all' || m.channel === 'general';
      if (channelId === 'admins') return m.channel === 'admins';
      if (channelId === 'system') return m.channel === 'system' || m.channel === 'logs';
      if (channelId.startsWith('sec-')) return m.channel === channelId;
      return (
        (m.senderId === channelId && m.recipientId === currentUser.id) ||
        m.channel === channelId
      );
    }).length;
  };

  const handleSelectChannel = (channelId: string) => {
    setActiveChannel(channelId);
    setMobileViewMode('chat');
  };

  return (
    <div
      className={`w-full text-black dark:text-slate-100 font-sans flex flex-col ${
        isMaximized
          ? 'fixed inset-0 z-[9999] bg-[#0F172A] p-2 sm:p-4 h-full w-full overflow-hidden'
          : 'max-w-7xl mx-auto p-1.5 sm:p-3 flex-1 h-full min-h-0 overflow-hidden'
      }`}
    >
      {/* Mobile Tab Switcher: Chatverlauf vs Kanäle & Kräfte */}
      <div className="md:hidden flex items-center justify-between p-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-xl mb-2 shrink-0 font-mono">
        <button
          type="button"
          onClick={() => setMobileViewMode('chat')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileViewMode === 'chat'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chatverlauf ({filteredMessages.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileViewMode('channels')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileViewMode === 'channels'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Kanäle & Kräfte ({activeUsersCount} online)</span>
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3 h-full overflow-hidden">
        {/* Sidebar: Channels & Personnel List */}
        <div
          className={`w-full md:w-80 bg-[#1E293B] border border-slate-300 dark:border-slate-700/80 rounded-2xl p-3 flex-col justify-between shadow-xl shrink-0 overflow-hidden h-full min-h-0 ${
            mobileViewMode === 'channels' ? 'flex flex-1' : 'hidden'
          } ${isSidebarCollapsed ? 'md:hidden' : 'md:flex'}`}
        >
          <div className="space-y-3 overflow-y-auto pr-1 flex-1 min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-300 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <Radio className="w-4 h-4 animate-pulse" />
                </div>
                <h2 className="font-extrabold text-xs uppercase tracking-wider text-white">Einsatzfunk & Chat</h2>
              </div>
              <button
                type="button"
                onClick={() => setAutoPlayAudio(!autoPlayAudio)}
                title={autoPlayAudio ? 'CB-Lautsprecher aktiv (Auto-Play)' : 'CB-Lautsprecher stumm'}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1 border transition cursor-pointer ${
                  autoPlayAudio
                    ? 'bg-slate-50 dark:bg-[#0F172A]mber-500/20 border-amber-500/50 text-amber-300 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {autoPlayAudio ? <Volume2 className="w-3 h-3 text-amber-400" /> : <VolumeX className="w-3 h-3" />}
                <span>{autoPlayAudio ? '📻 CB-ON' : '🔇 OFF'}</span>
              </button>
            </div>

            {/* Scope Switcher: Einsatzfunk vs Vereinsfunk (Allgemein) */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-xl font-mono text-[10px]">
              <button
                type="button"
                onClick={() => {
                  setActiveScope('operation');
                  setActiveChannel('all');
                }}
                className={`py-1.5 px-2 rounded-lg font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                  activeScope === 'operation'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🚨 Einsatzfunk</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveScope('general');
                  setActiveChannel('all');
                }}
                className={`py-1.5 px-2 rounded-lg font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                  activeScope === 'general'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🌐 Vereinsfunk</span>
              </button>
            </div>

            {/* Operation Selector (when in Einsatzfunk and operations exist) */}
            {activeScope === 'operation' && (
              <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-2 space-y-1 font-mono text-xs">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="uppercase font-bold">Einsatz wählen:</span>
                  {effectiveOperation && (
                    <span className="text-emerald-400 font-bold">
                      {effectiveOperation.status === 'active' ? '● Aktiv' : '⏸ Pausiert'}
                    </span>
                  )}
                </div>
                <select
                  value={selectedOpId}
                  onChange={(e) => {
                    const newOpId = e.target.value;
                    setSelectedOpId(newOpId);
                    setCurrentOperationId(newOpId);
                    setActiveChannel('all');
                  }}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                >
                  {allOperations
                    .filter((o) => o.status === 'active' || o.status === 'paused')
                    .map((op) => (
                      <option key={op.id} value={op.id}>
                        #{op.id.slice(-4).toUpperCase()} {op.title}
                      </option>
                    ))}
                  {allOperations.filter((o) => o.status === 'active' || o.status === 'paused').length === 0 && (
                    <option value="">Kein laufender Einsatz</option>
                  )}
                </select>
              </div>
            )}

            {/* Global Group Channels */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1 block font-mono">
                {activeScope === 'general' ? 'VEREINSFUNK-KANÄLE:' : 'EINSATZFUNK-KANÄLE:'}
              </span>

              {currentUser?.role !== 'observer' && (
                <button
                  type="button"
                  onClick={() => handleSelectChannel('all')}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer text-left ${
                    activeChannel === 'all'
                      ? 'bg-blue-600 text-white font-bold shadow-md ring-1 ring-blue-400/50'
                      : 'hover:bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="h-8 w-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
                      📢
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold leading-tight uppercase tracking-tight">Gesamter Funkverkehr</div>
                      <div className="text-[10px] opacity-80 font-mono">{activeUsersCount} Online • {allUsers.length} Registriert</div>
                    </div>
                  </div>
                  {getUnreadForChannel('all') > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-bold">
                      {getUnreadForChannel('all')}
                    </span>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSelectChannel('admins')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer text-left ${
                  activeChannel === 'admins'
                    ? 'bg-blue-600 text-white font-bold shadow-md ring-1 ring-blue-400/50'
                    : 'hover:bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className="h-8 w-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
                    🛡️
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold leading-tight uppercase tracking-tight">Einsatzleitung (EL)</div>
                    <div className="text-[10px] opacity-80 font-mono">Führungskanal (Geschützt)</div>
                  </div>
                </div>
                {getUnreadForChannel('admins') > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold">
                    {getUnreadForChannel('admins')}
                  </span>
                )}
              </button>

              {currentUser?.role !== 'observer' && (
                <button
                  type="button"
                  onClick={() => handleSelectChannel('system')}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer text-left ${
                    activeChannel === 'system'
                      ? 'bg-blue-600 text-white font-bold shadow-md ring-1 ring-blue-400/50'
                      : 'hover:bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="h-8 w-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
                      📋
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold leading-tight uppercase tracking-tight">System & Logbuch</div>
                      <div className="text-[10px] opacity-80 font-mono">Logins, Logouts & Meldungen</div>
                    </div>
                  </div>
                  {getUnreadForChannel('system') > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[9px] font-bold">
                      {getUnreadForChannel('system')}
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Sector Channels (if in operation scope and sectors exist) */}
            {activeScope === 'operation' && currentUser?.role !== 'observer' && effectiveOperation?.sectors && effectiveOperation.sectors.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-slate-300 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1 block font-mono">
                  SEKTOR-FUNKKANÄLE:
                </span>

                {effectiveOperation.sectors.map((sec) => (
                  <button
                    type="button"
                    key={sec.id}
                    onClick={() => handleSelectChannel(sec.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl transition cursor-pointer text-left ${
                      activeChannel === sec.id
                        ? 'bg-slate-50 dark:bg-[#0F172A]mber-500/20 border border-amber-500 text-amber-100 font-bold'
                        : 'hover:bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className="w-3 h-3 rounded-full shrink-0 border border-white/20"
                        style={{
                          backgroundColor:
                            sec.status === 'searched'
                              ? '#22c55e'
                              : sec.status === 'in_progress'
                              ? '#f59e0b'
                              : sec.status === 'suspicious'
                              ? '#ef4444'
                              : '#3b82f6',
                        }}
                      />
                      <div className="truncate">
                        <div className="text-xs font-bold leading-tight truncate">{sec.name}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {allUsers.filter((u) => sec.assignedUserIds?.includes(u.id) && u.isActive).length} online ({sec.assignedUserIds?.length || 0} zugeteilt)
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Direct 1-on-1 Chats with Personnel */}
            {currentUser?.role !== 'observer' && (
            <div className="space-y-1 pt-2 border-t border-slate-300 dark:border-slate-700">
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                  DIREKTCHAT & KRÄFTE ({activeUsersCount} ONLINE):
                </span>
              </div>

              {/* Personnel search bar */}
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Sucher / Funkname suchen..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono placeholder-slate-500"
                />
              </div>

              {/* Admins list */}
              {admins
                .filter((a) => a.id !== currentUser.id)
                .map((admin) => (
                  <button
                    type="button"
                    key={admin.id}
                    onClick={() => handleSelectChannel(admin.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl transition cursor-pointer text-left ${
                      activeChannel === admin.id
                        ? 'bg-red-500/20 border border-red-500 text-red-100 font-bold'
                        : 'hover:bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="relative h-7 w-7 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800 shrink-0 border border-slate-300 dark:border-slate-700">
                        {admin.photoUrl ? (
                          <img src={admin.photoUrl} alt={admin.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center font-bold text-white text-xs bg-red-950">
                            {admin.name.charAt(0)}
                          </div>
                        )}
                        <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-slate-900" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold leading-tight flex items-center gap-1">
                          <span className="truncate">{admin.name}</span>
                          <span className="text-[8px] px-1 rounded bg-red-900 text-red-200 font-mono shrink-0">EL</span>
                        </div>
                        <div className="text-[10px] text-blue-400 font-mono">{admin.callSign}</div>
                      </div>
                    </div>
                  </button>
                ))}

              {/* Responders list */}
              {filteredResponders.map((user) => {
                const userLoc = userLocations[user.id];
                const isLive = userLoc?.isLive ?? user.isActive;

                return (
                  <button
                    type="button"
                    key={user.id}
                    onClick={() => handleSelectChannel(user.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl transition cursor-pointer text-left ${
                      activeChannel === user.id
                        ? 'bg-blue-500/20 border border-blue-500 text-blue-100 font-bold'
                        : 'hover:bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="relative h-7 w-7 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800 shrink-0 border border-slate-300 dark:border-slate-700">
                        {user.photoUrl ? (
                          <img src={user.photoUrl} alt={user.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center font-bold text-white text-xs">
                            {user.name.charAt(0)}
                          </div>
                        )}
                        <span
                          className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-slate-900 ${
                            isLive ? 'bg-emerald-500' : 'bg-slate-500'
                          }`}
                        />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold leading-tight truncate">{user.name}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                          {user.callSign} {user.licensePlate ? `• ${user.licensePlate}` : ''}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            )}
          </div>
        </div>

        {/* Main Active Chat Area */}
        <div
          className={`flex-1 bg-[#1E293B] border border-slate-300 dark:border-slate-700/80 rounded-2xl flex-col justify-between shadow-xl overflow-hidden h-full min-h-0 ${
            mobileViewMode === 'chat' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {/* Active Channel Top Header */}
          <div className="bg-white dark:bg-slate-900/90 p-2.5 sm:p-4 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 truncate">
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-blue-400 flex items-center justify-center font-bold text-base sm:text-lg shrink-0 shadow-inner">
                {activeChannel === 'all'
                  ? '📢'
                  : activeChannel === 'admins'
                  ? '🛡️'
                  : activeChannel.startsWith('sec-')
                  ? '🧭'
                  : '💬'}
              </div>
              <div className="truncate">
                <h3 className="font-extrabold text-xs sm:text-sm text-white flex items-center gap-1.5 uppercase tracking-wide truncate">
                  <span className="truncate">
                    {activeChannel === 'all'
                      ? activeScope === 'general'
                        ? 'Allgemeiner Vereinsfunk'
                        : 'Gesamter Einsatzfunk'
                      : activeChannel === 'admins'
                      ? 'Führungskanal EL'
                      : activeSector
                      ? `Funk Sektor: ${activeSector.name}`
                      : `Direktfunk mit: ${activeTargetUser?.name || 'Sucher'}`}
                  </span>
                  {activeTargetUser && (
                    <span className="text-xs text-blue-400 font-mono font-semibold shrink-0">
                      ({activeTargetUser.callSign})
                    </span>
                  )}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                  {activeChannel === 'all'
                    ? activeScope === 'general'
                      ? `Offener Kanal für alle Vereinsmitglieder • ${activeUsersCount} online`
                      : `Offener Funkkanal • ${activeUsersCount} Einsatzkräfte online`
                    : activeChannel === 'admins'
                    ? 'Sicherer Führungskanal'
                    : activeSector
                    ? `Sektor-Funk (${allUsers.filter((u) => activeSector.assignedUserIds?.includes(u.id) && u.isActive).length} online)`
                    : `Direkte 1:1 Verbindung • KFZ: ${activeTargetUser?.licensePlate || 'k.A.'}`}
                </p>
              </div>
            </div>

            {/* Header Right Tools: Search, Sidebar Toggle & Maximize */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Search inside active chat */}
              <div className="relative hidden lg:block w-36 xl:w-44">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={messageSearchQuery}
                  onChange={(e) => setMessageSearchQuery(e.target.value)}
                  placeholder="Suchen..."
                  className="w-full pl-8 pr-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono placeholder-slate-500"
                />
              </div>

              {/* Desktop Sidebar Collapse Toggle */}
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                title={isSidebarCollapsed ? 'Kanäle & Kräfte einblenden' : 'Kanäle & Kräfte ausblenden'}
                className="hidden md:flex p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-white transition cursor-pointer"
              >
                {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4 text-blue-400" /> : <PanelLeftClose className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
              </button>

              {/* Maximize / Fullscreen Toggle Button */}
              <button
                type="button"
                onClick={() => setIsMaximized(!isMaximized)}
                title={isMaximized ? 'Normale Ansicht' : 'Großansicht / Vollbild aktivieren'}
                className={`p-2 rounded-xl border transition cursor-pointer flex items-center gap-1.5 font-mono text-xs font-bold ${
                  isMaximized
                    ? 'bg-slate-50 dark:bg-[#0F172A]mber-500 text-slate-950 border-amber-400 shadow-md'
                    : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-white'
                }`}
              >
                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4 text-amber-400" />}
                <span className="hidden sm:inline">{isMaximized ? 'Verkleinern' : 'Großansicht'}</span>
              </button>
            </div>
          </div>

        {/* Quick Filter Bar */}
        <div className="bg-white dark:bg-slate-900/40 px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px] font-mono">
          <span className="text-slate-500 mr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer shrink-0 ${
              activeFilter === 'all'
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200'
            }`}
          >
            Alle ({filteredMessages.length})
          </button>
          <button
            onClick={() => setActiveFilter('voice')}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer shrink-0 flex items-center gap-1 ${
              activeFilter === 'voice'
                ? 'bg-slate-50 dark:bg-[#0F172A]mber-500 text-slate-950 font-bold'
                : 'bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200'
            }`}
          >
            🎙️ CB-Funk ({chatMessages.filter((m) => m.isVoiceMessage && m.operationId === currentOperation.id).length})
          </button>
          <button
            onClick={() => setActiveFilter('alert')}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer shrink-0 flex items-center gap-1 ${
              activeFilter === 'alert'
                ? 'bg-red-600 text-white font-bold'
                : 'bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200'
            }`}
          >
            🚨 Alarme
          </button>
          <button
            onClick={() => setActiveFilter('location')}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer shrink-0 flex items-center gap-1 ${
              activeFilter === 'location'
                ? 'bg-emerald-600 text-white font-bold'
                : 'bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200'
            }`}
          >
            📍 Standorte
          </button>
        </div>

        {/* Messages Feed */}
        <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 bg-[#0F172A]/40">
          {filteredMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs space-y-2 font-mono">
              <Radio className="w-10 h-10 opacity-30 text-blue-400 animate-pulse" />
              <span>Keine Funksprüche im aktuellen Filter/Kanal vorhanden.</span>
            </div>
          ) : (
            filteredMessages.map((msg, index) => {
              const isMe = msg.senderId === currentUser.id;
              const isAlert = msg.isAlert;

              // Check if previous message was from same sender to group messages cleanly
              const prevMsg = filteredMessages[index - 1];
              const isSameSender = prevMsg && prevMsg.senderId === msg.senderId;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${
                    isSameSender ? 'mt-1' : 'mt-3'
                  }`}
                >
                  {/* Sender Header (Only if first in stack) */}
                  {!isSameSender && (
                    <div className="flex items-center gap-1.5 px-2 mb-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-bold text-slate-900 dark:text-slate-200">{isMe ? 'Du' : msg.senderName}</span>
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

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[88%] sm:max-w-[75%] p-3 rounded-2xl text-xs space-y-1 shadow-md transition ${
                      isAlert
                        ? 'bg-red-950/90 border border-red-500 text-red-100 ring-2 ring-red-500/40 animate-pulse font-semibold'
                        : isMe
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-slate-50 dark:bg-slate-800 text-black dark:text-slate-100 rounded-bl-none border border-slate-300 dark:border-slate-700/80'
                    }`}
                  >
                    {/* Text content */}
                    {msg.text && <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>}

                    {/* CB-Funk Voice Message Audio Player */}
                    {msg.isVoiceMessage && msg.audioUrl && (
                      <VoiceMessagePlayer
                        audioUrl={msg.audioUrl}
                        duration={msg.audioDuration}
                        isMe={isMe}
                      />
                    )}

                    {/* Location attachment card */}
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
                          className="px-2 py-0.5 rounded bg-black/30 hover:bg-black/50 text-white font-mono text-[10px] underline"
                        >
                          In Google Maps
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

        {/* Recording Overlay / Live Push-to-Talk Indicator */}
        {isRecording && (
          <div className="bg-slate-50 dark:bg-[#0F172A]mber-950/90 border-t border-amber-500/50 p-3 flex items-center justify-between animate-pulse text-amber-200 text-xs font-mono">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-red-600 animate-ping" />
              <span className="font-bold uppercase tracking-wider">🎙️ CB-Funk Übertragung läuft...</span>
              <span className="px-2 py-0.5 rounded bg-slate-50 dark:bg-[#0F172A]mber-900 border border-amber-600 text-amber-100 font-mono font-bold">
                0:{recordingTime < 10 ? `0${recordingTime}` : recordingTime} / 0:30s
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Abbrechen
              </button>
              <button
                type="button"
                onClick={stopAndSendRecording}
                className="px-4 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg cursor-pointer flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" /> Senden (Roger!)
              </button>
            </div>
          </div>
        )}

        {/* Input Bar */}
        <form onSubmit={handleSend} className="bg-white dark:bg-slate-900/95 p-2.5 sm:p-3 border-t border-slate-300 dark:border-slate-700/80 space-y-2">
          {/* Quick options toggles */}
          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIncludeLocation(!includeLocation)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer font-mono ${
                  includeLocation
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:text-slate-200'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>GPS-Standort</span>
              </button>

            </div>

            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono hidden sm:block">
              Sprechtaste halten zum Senden einer Sprachnachricht
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* CB Funk Push-to-Talk Microphone Button */}
            <button
              type="button"
              onClick={isRecording ? stopAndSendRecording : startRecording}
              title="CB-Funk Sprachnachricht aufnehmen"
              className={`h-10 px-3.5 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs transition cursor-pointer shrink-0 border ${
                isRecording
                  ? 'bg-red-600 text-white border-red-400 animate-pulse shadow-lg'
                  : 'bg-slate-50 dark:bg-[#0F172A]mber-500 hover:bg-slate-50 dark:bg-[#0F172A]mber-400 text-slate-950 border-amber-400/80 shadow'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span className="hidden sm:inline font-mono uppercase tracking-tight">
                {isRecording ? 'Senden' : 'CB-Funk'}
              </span>
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Funkspruch an ${
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
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-black dark:text-slate-100 text-xs focus:outline-none focus:border-blue-500 placeholder-slate-500 font-mono"
            />

            {/* Send Button */}
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
  </div>
);
};
