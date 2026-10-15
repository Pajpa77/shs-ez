import React, { useState, useEffect, useRef, useCallback } from 'react';
import mpegts from 'mpegts.js';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Video, X, Maximize2, Minimize2, RadioTower, GripVertical, Settings2, RefreshCw } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';
import { db, isFirebaseConfigured } from '../lib/firebase';

interface DroneFeedWidgetProps {
  onClose: () => void;
}

type FeedStatus = 'connecting' | 'live' | 'reconnecting' | 'error';

// Shared config document (uses the existing /settings rule, no rule change required)
const DRONE_SETTINGS_DOC = 'drone_stream';
const DEFAULT_STREAM_PATH = '/live/drone.flv';
const RECONNECT_DELAY_MS = 3000;
const STALL_TIMEOUT_MS = 8000;

/** Legacy behaviour: Node-Media-Server on the same host, port 8000. */
const getDefaultStreamUrl = () => {
  const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${wsProto}://${window.location.hostname}:8000${DEFAULT_STREAM_PATH}`;
};

/**
 * Accepts e.g. "https://laptop.tailnet.ts.net", "xyz.trycloudflare.com",
 * "wss://host/live/drone.flv" and returns a WS-FLV URL usable by mpegts.js.
 */
export const normalizeStreamUrl = (raw: string): string => {
  let url = (raw || '').trim();
  if (!url) return getDefaultStreamUrl();
  if (!/^[a-z]+:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
  if (!/\.flv(\?.*)?$/i.test(url)) url = `${url.replace(/\/+$/, '')}${DEFAULT_STREAM_PATH}`;
  return url;
};

export const DroneFeedWidget: React.FC<DroneFeedWidgetProps> = ({ onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { dragRef, position, dragProps } = useDraggable({ storageKey: 'drone_feed_widget' });
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null); // mpegts.Player types might be missing
  const reconnectTimerRef = useRef<number | null>(null);

  const [configuredUrl, setConfiguredUrl] = useState<string>('');
  const [configLoaded, setConfigLoaded] = useState(!isFirebaseConfigured);
  const [status, setStatus] = useState<FeedStatus>('connecting');
  const [errorText, setErrorText] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const streamUrl = normalizeStreamUrl(configuredUrl);
  const isMixedContent = window.location.protocol === 'https:' && streamUrl.startsWith('ws://');

  // Load the shared stream URL (only while the widget is open -> minimal Firestore reads)
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsub = onSnapshot(
      doc(db, 'settings', DRONE_SETTINGS_DOC),
      (snap) => {
        const url = snap.exists() ? String(snap.data()?.url || '') : '';
        setConfiguredUrl(url);
        setConfigLoaded(true);
      },
      () => setConfigLoaded(true)
    );
    return () => unsub();
  }, []);

  const destroyPlayer = useCallback(() => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.unload();
        playerRef.current.detachMediaElement();
        playerRef.current.destroy();
      } catch {
        // ignore teardown errors
      }
      playerRef.current = null;
    }
  }, []);

  // Player lifecycle with automatic reconnect (stream may start later or drop on weak LTE)
  useEffect(() => {
    if (!configLoaded) return;
    if (!mpegts.getFeatureList().mseLivePlayback) {
      setStatus('error');
      setErrorText('Dieser Browser unterstützt keine Live-Wiedergabe (MSE).');
      return;
    }
    if (isMixedContent) {
      setStatus('error');
      setErrorText('Unverschlüsselte ws://-Adresse wird auf HTTPS blockiert. Bitte HTTPS-Tunnel-Adresse eintragen.');
      return;
    }

    let disposed = false;

    const scheduleReconnect = (reason: string) => {
      if (disposed) return;
      setStatus('reconnecting');
      setErrorText(reason);
      destroyPlayer();
      reconnectTimerRef.current = window.setTimeout(start, RECONNECT_DELAY_MS);
    };

    function start() {
      if (disposed || !videoRef.current) return;
      setStatus((s) => (s === 'live' ? s : 'connecting'));
      const player = mpegts.createPlayer(
        { type: 'flv', isLive: true, url: streamUrl, hasAudio: false },
        {
          enableStashBuffer: false,
          liveBufferLatencyChasing: true,
          liveBufferLatencyMaxLatency: 2.0,
          liveBufferLatencyMinRemain: 0.5,
          autoCleanupSourceBuffer: true,
        } as any
      );
      player.on(mpegts.Events.ERROR, (type: string, detail: string) => {
        scheduleReconnect(`Kein Signal (${type}${detail ? `: ${detail}` : ''})`);
      });
      player.on(mpegts.Events.LOADING_COMPLETE, () => {
        scheduleReconnect('Stream beendet – warte auf Drohne…');
      });
      player.attachMediaElement(videoRef.current);
      player.load();
      const p = player.play() as unknown as Promise<void> | undefined;
      p?.catch?.(() => { /* autoplay blocked – video is muted, usually fine */ });
      playerRef.current = player;
    }

    start();

    // Stall watchdog: if the picture freezes, rebuild the connection
    let lastTime = -1;
    let lastProgressAt = Date.now();
    const watchdog = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || !playerRef.current) return;
      if (v.currentTime !== lastTime) {
        lastTime = v.currentTime;
        lastProgressAt = Date.now();
      } else if (Date.now() - lastProgressAt > STALL_TIMEOUT_MS) {
        lastProgressAt = Date.now();
        scheduleReconnect('Bild eingefroren – verbinde neu…');
      }
    }, 2000);

    return () => {
      disposed = true;
      window.clearInterval(watchdog);
      destroyPlayer();
    };
  }, [streamUrl, configLoaded, isMixedContent, reloadKey, destroyPlayer]);

  const handleSaveUrl = async () => {
    const value = urlDraft.trim();
    setIsSaving(true);
    try {
      if (isFirebaseConfigured) {
        await setDoc(
          doc(db, 'settings', DRONE_SETTINGS_DOC),
          { url: value, updatedAt: new Date().toISOString() },
          { merge: true }
        );
      } else {
        setConfiguredUrl(value);
      }
      setShowSettings(false);
    } catch (e: any) {
      setErrorText(`Speichern fehlgeschlagen: ${e?.message || e}`);
    } finally {
      setIsSaving(false);
    }
  };

  const statusBadge = {
    live: { text: 'LIVE ◉', cls: 'text-red-500 border-red-500/40' },
    connecting: { text: 'VERBINDE…', cls: 'text-amber-400 border-amber-400/40' },
    reconnecting: { text: 'WARTE AUF SIGNAL', cls: 'text-amber-400 border-amber-400/40' },
    error: { text: 'FEHLER', cls: 'text-red-400 border-red-400/40' },
  }[status];

  return (
    <div 
      ref={dragRef}
      style={position ? { position: 'fixed', left: `${position.x}px`, top: `${position.y}px`, zIndex: 1000 } : undefined}
      className={`${
        position ? '' : 'fixed z-[1000] bottom-20 right-4 md:right-6 md:bottom-24'
      } bg-slate-900 border-2 border-slate-700 shadow-2xl rounded-xl overflow-hidden flex flex-col transition-all duration-300 max-w-[calc(100vw-1rem)] ${
        isExpanded ? 'w-[85vw] h-[60vh] md:w-[640px] md:h-[480px]' : 'w-[280px] h-[200px] md:w-[320px] md:h-[240px]'
      }`}
    >
      {/* Header Bar */}
      <div 
        {...dragProps}
        className="bg-slate-800 px-3 py-2 flex items-center justify-between border-b border-slate-700 select-none touch-none cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-3.5 h-3.5 text-slate-400" />
          <RadioTower className={`w-4 h-4 ${status === 'live' ? 'text-red-500 animate-pulse' : 'text-slate-500'}`} />
          <span className="text-xs font-bold font-mono text-slate-200 tracking-wider">DROHNEN-UPLINK</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="text-slate-400 hover:text-white transition cursor-pointer"
            title="Neu verbinden"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setUrlDraft(configuredUrl); setShowSettings((s) => !s); }}
            className={`transition cursor-pointer ${showSettings ? 'text-white' : 'text-slate-400 hover:text-white'}`}
            title="Stream-Adresse einstellen"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-white transition cursor-pointer"
            title="Vergrößern/Verkleinern"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-red-400 transition cursor-pointer"
            title="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video Container */}
      <div className="flex-1 bg-black relative flex items-center justify-center">
        <video 
          ref={videoRef}
          autoPlay 
          muted 
          playsInline
          onPlaying={() => { setStatus('live'); setErrorText(''); }}
          className="w-full h-full object-contain relative z-10"
        ></video>

        {/* Status badge */}
        <div className={`absolute top-2 left-2 z-30 text-[10px] font-mono bg-black/60 px-2 py-0.5 rounded border pointer-events-none ${statusBadge.cls}`}>
          {statusBadge.text}
        </div>

        {/* Waiting / error overlay */}
        {status !== 'live' && !showSettings && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none bg-black/60 px-3 text-center">
            {status === 'error' ? (
              <Video className="w-10 h-10 text-red-400 mb-3" />
            ) : (
              <div className="w-10 h-10 border-2 border-slate-600 border-t-white rounded-full animate-spin mb-3"></div>
            )}
            <span className="text-xs font-mono text-slate-300">
              {status === 'error' ? 'Wiedergabe nicht möglich' : 'Warte auf Videosignal…'}
            </span>
            {errorText && <span className="text-[9px] font-mono text-amber-400/80 mt-1 break-all">{errorText}</span>}
            <span className="text-[9px] font-mono text-slate-500 mt-1 break-all">Quelle: {streamUrl}</span>
          </div>
        )}

        {/* Stream address settings */}
        {showSettings && (
          <div className="absolute inset-0 z-40 bg-slate-900/95 p-3 flex flex-col gap-2 overflow-y-auto">
            <label className="text-[10px] font-bold font-mono text-slate-300 uppercase tracking-wider">
              Stream-Adresse (HTTPS-Tunnel)
            </label>
            <input
              type="text"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://einsatz-laptop.tailXXXX.ts.net"
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
            />
            <span className="text-[9px] font-mono text-slate-500 break-all">
              Ergibt: {normalizeStreamUrl(urlDraft)}
            </span>
            <span className="text-[9px] font-mono text-slate-500">
              Leer lassen = lokaler Server (Port 8000). Gilt für alle Admins.
            </span>
            <div className="flex gap-2 mt-1">
              <button
                onClick={handleSaveUrl}
                disabled={isSaving}
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold rounded px-2 py-1.5 cursor-pointer"
              >
                {isSaving ? 'Speichere…' : 'Speichern'}
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded px-2 py-1.5 cursor-pointer"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
        
        {/* Tactical Crosshair Overlay */}
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center opacity-30">
          <div className="w-0.5 h-10 bg-green-500"></div>
          <div className="absolute h-0.5 w-10 bg-green-500"></div>
          <div className="absolute border border-green-500 w-32 h-32 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};
