import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, Trash2, LogOut, CheckCircle2, Download } from 'lucide-react';
import { useRescue } from '../context/RescueContext';
import { generateTrackingTestSnapshot } from '../lib/mapSnapshotHelper';
import { calculateTotalDistance } from '../lib/distanceCalc';
import { jsPDF } from 'jspdf';

export const TrackingTestOverlay: React.FC = () => {
  const { activeTrackingTest, saveTrackingTestResult, stopTrackingTest } = useRescue();
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);


  const generateTrackingPDF = (dataUrl: string, distanceMeters: number) => {
    if (!activeTrackingTest) return;
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.setFontSize(22);
    pdf.text('Tracking-Test Pr\u00FCfprotokoll', 105, 20, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.text(`Tester: ${activeTrackingTest.userName || 'Unbekannt'}`, 20, 40);
    pdf.text(`Datum: ${new Date(activeTrackingTest.startTime).toLocaleDateString('de-DE')}`, 20, 48);
    pdf.text(`Start: ${new Date(activeTrackingTest.startTime).toLocaleTimeString('de-DE')}`, 20, 56);
    pdf.text(`Dauer: ${activeTrackingTest.durationMinutes} Minuten`, 20, 64);
    
    const distanceKm = (distanceMeters / 1000).toFixed(2);
    pdf.text(`Zur\u00FCckgelegte Distanz: ${distanceMeters > 1000 ? distanceKm + ' km' : Math.round(distanceMeters) + ' m'}`, 20, 72);
    pdf.text(`Wegpunkte erfasst: ${activeTrackingTest.trackPoints.length}`, 20, 80);

    pdf.setFontSize(16);
    pdf.text('GPS Spur (Lagekarte)', 105, 100, { align: 'center' });
    const pdfWidth = 190;
    const pdfHeight = (750 * pdfWidth) / 1200;
    pdf.addImage(dataUrl, 'JPEG', 10, 110, pdfWidth, pdfHeight);

    pdf.save(`TrackingTest_${new Date().getTime()}.pdf`);
  };

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

  // Handle completion and auto-generate snapshot
  useEffect(() => {
    if (activeTrackingTest?.isCompleted && !snapshotUrl) {
      handleAutoCapture();
    }
  }, [activeTrackingTest?.isCompleted, snapshotUrl]);

  const handleAutoCapture = () => {
    if (!activeTrackingTest) return;
    try {
      // Directly render the GPS track as a canvas image — no html2canvas / CORS issues
      const dataUrl = generateTrackingTestSnapshot(activeTrackingTest);
      if (dataUrl) {
        setSnapshotUrl(dataUrl);
      }
    } catch (err) {
      console.error('Failed to generate tracking test snapshot:', err);
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
          <button
            onClick={() => stopTrackingTest()}
            className="ml-3 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-full text-[10px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 border border-white/10 active:scale-95 shadow-sm"
            title="Tracking-Test vorzeitig beenden"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Beenden</span>
          </button>
        </motion.div>
      )}

      {/* Completion Modal */}
      <AnimatePresence>
        {activeTrackingTest.isCompleted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-slate-100 dark:bg-slate-950/90 pointer-events-auto flex items-center justify-center p-4"
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
                <div className="aspect-video bg-slate-950 rounded-2xl border border-slate-700 overflow-hidden relative group flex items-center justify-center">
                  {snapshotUrl ? (
                    <img src={snapshotUrl} alt="Map Snapshot" className="w-full h-full object-contain" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
                      <span className="text-sm font-mono uppercase">Keine GPS-Daten vorhanden</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700">
                    <span className="block text-slate-400 uppercase text-[10px] mb-1">Startzeit</span>
                    <span className="text-slate-200 font-bold">{new Date(activeTrackingTest.startTime).toLocaleTimeString()}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700">
                    <span className="block text-slate-400 uppercase text-[10px] mb-1">Wegpunkte</span>
                    <span className="text-slate-200 font-bold">{activeTrackingTest.trackPoints.length}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700">
                    <span className="block text-slate-400 uppercase text-[10px] mb-1">Distanz</span>
                    <span className="text-slate-200 font-bold">
                      {calculateTotalDistance(activeTrackingTest.trackPoints) > 1000 
                        ? (calculateTotalDistance(activeTrackingTest.trackPoints) / 1000).toFixed(2) + ' km' 
                        : Math.round(calculateTotalDistance(activeTrackingTest.trackPoints)) + ' m'}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed text-center italic">
                  Prüfprotokoll herunterladen und Test beenden? (Du wirst anschließend automatisch abgemeldet)
                </p>
              </div>

              <div className="p-6 bg-slate-900/80 border-t border-slate-700 flex flex-col gap-3">
                <button
                  onClick={async () => {
                    if (snapshotUrl) {
                      generateTrackingPDF(snapshotUrl, calculateTotalDistance(activeTrackingTest.trackPoints));
                      await new Promise((resolve) => setTimeout(resolve, 800));
                    }
                    saveTrackingTestResult(true);
                  }}
                  disabled={!snapshotUrl}
                  className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold uppercase text-xs transition shadow-lg shadow-blue-900/20 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Protokoll (PDF) laden & Logout</span>
                </button>
                <button
                  onClick={() => saveTrackingTestResult(false)}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase text-xs transition cursor-pointer border border-slate-700"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Verwerfen (Ohne Speichern)</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
