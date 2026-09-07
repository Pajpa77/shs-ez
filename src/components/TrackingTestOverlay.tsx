import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, Camera, Save, Trash2, LogOut, CheckCircle2 } from 'lucide-react';
import { useRescue } from '../context/RescueContext';
import { captureTacticalMapScreenshot } from '../lib/mapSnapshotHelper';

export const TrackingTestOverlay: React.FC = () => {
  const { activeTrackingTest, saveTrackingTestResult } = useRescue();
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeTrackingTest || !activeTrackingTest.isActive) return;

    const interval = setInterval(() => {
      const now = new Date();
      const endTime = new Date(activeTrackingTest.endTime);
      const diff = Math.max(0, endTime.getTime() - now.getTime());
      setTimeLeft(Math.floor(diff / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTrackingTest]);

  // Handle completion and screenshot
  useEffect(() => {
    if (activeTrackingTest?.isCompleted && !snapshotUrl && !isCapturing) {
      handleAutoCapture();
    }
  }, [activeTrackingTest?.isCompleted, snapshotUrl, isCapturing]);

  const handleAutoCapture = async () => {
    setIsCapturing(true);
    // Give the map a moment to render final points
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      // Create a dummy operation for the fallback renderer if DOM capture fails
      const dummyOp = {
        id: 'tracking-test',
        title: 'Tracking Test',
        status: 'active',
        type: 'operation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        commander: 'System',
        participants: [],
        participantIds: [],
        sectors: [],
        findings: [],
        logs: [],
        missingPerson: {
          name: 'N/A',
          age: 0,
          description: '',
          lastSeen: ''
        },
        archivedTracks: [{
          id: 'test-track',
          userId: activeTrackingTest.userId,
          userName: 'Tester',
          callSign: 'Test',
          color: '#38bdf8',
          phaseLabel: 'Test',
          recordedAt: new Date().toISOString(),
          points: activeTrackingTest.trackPoints
        }]
      } as any;
      
      const dataUrl = await captureTacticalMapScreenshot(dummyOp as import('../types').SearchOperation);
      if (dataUrl) {
        setSnapshotUrl(dataUrl);
      }
    } catch (err) {
      console.error('Failed to capture tracking test screenshot:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  if (!activeTrackingTest) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none flex flex-col items-center">
      {/* Live Timer Banner */}
      {!activeTrackingTest.isCompleted && (
        <motion.div
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          className="mt-4 pointer-events-auto bg-blue-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border-2 border-white/20"
        >
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
            <Timer className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Trackingtest Aktiv</span>
            <span className="text-xl font-mono font-black">{formatTime(timeLeft)}</span>
          </div>
        </motion.div>
      )}

      {/* Completion Modal */}
      <AnimatePresence>
        {activeTrackingTest.isCompleted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-slate-950/90 pointer-events-auto flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#1E293B] border border-slate-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-slate-700 flex items-center justify-between bg-blue-900/20">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Test abgeschlossen</h2>
                    <p className="text-xs text-slate-400 font-mono">GPS-Aufzeichnung beendet ({activeTrackingTest.durationMinutes} Min.)</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="aspect-video bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden relative group">
                  {snapshotUrl ? (
                    <img src={snapshotUrl} alt="Map Snapshot" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
                      <Camera className="w-12 h-12 animate-pulse" />
                      <span className="text-sm font-mono uppercase animate-pulse">Erstelle Snapshot...</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-700">
                    <span className="block text-slate-500 uppercase text-[10px] mb-1">Startzeit</span>
                    <span className="text-slate-200">{new Date(activeTrackingTest.startTime).toLocaleTimeString()}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-700">
                    <span className="block text-slate-500 uppercase text-[10px] mb-1">Wegpunkte</span>
                    <span className="text-slate-200">{activeTrackingTest.trackPoints.length} Punkte</span>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed text-center italic">
                  Möchten Sie dieses Ergebnis speichern oder verwerfen? Nach der Auswahl erfolgt ein automatischer Logout.
                </p>
              </div>

              <div className="p-6 bg-slate-900/50 border-t border-slate-700 grid grid-cols-2 gap-4">
                <button
                  onClick={() => saveTrackingTestResult(false)}
                  className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase text-xs transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Verwerfen</span>
                </button>
                <button
                  onClick={() => {
                    if (snapshotUrl) {
                      const link = document.createElement('a');
                      link.href = snapshotUrl;
                      link.download = `tracking-test-${new Date().getTime()}.jpg`;
                      link.click();
                    }
                    saveTrackingTestResult(true);
                  }}
                  disabled={!snapshotUrl}
                  className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold uppercase text-xs transition shadow-lg shadow-blue-900/20 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Speichern & Logout</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
