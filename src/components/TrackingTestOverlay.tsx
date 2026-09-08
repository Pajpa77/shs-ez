import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, LogOut, CheckCircle2, Loader2, FileText } from 'lucide-react';
import { useRescue } from '../context/RescueContext';
import { generateTrackingTestSnapshotWithMap } from '../lib/mapSnapshotHelper';
import { calculateTotalDistance } from '../lib/distanceCalc';
import { jsPDF } from 'jspdf';

export const TrackingTestOverlay: React.FC = () => {
  const {
    activeTrackingTest,
    saveTrackingTestResult,
    stopTrackingTest,
  } = useRescue();

  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading-map' | 'generating-pdf' | 'done' | 'error'>('idle');
  const didAutoRun = useRef(false);

  // ── Live countdown ───────────────────────────────────────────────────────
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

  // ── Auto-run on completion ───────────────────────────────────────────────
  useEffect(() => {
    if (activeTrackingTest?.isCompleted && !didAutoRun.current) {
      didAutoRun.current = true;
      handleAutoComplete();
    }
  }, [activeTrackingTest?.isCompleted]);

  const handleAutoComplete = async () => {
    if (!activeTrackingTest) return;
    try {
      setStatus('loading-map');

      // 1. Generate map snapshot with real OSM tiles
      const dataUrl = await generateTrackingTestSnapshotWithMap(activeTrackingTest);
      if (dataUrl) {
        setSnapshotUrl(dataUrl);
      }

      setStatus('generating-pdf');

      // 2. Generate and download PDF
      if (dataUrl) {
        await generateAndDownloadPDF(dataUrl);
      }

      setStatus('done');

      // 3. Save result + logout (after short delay so user sees the "done" state)
      await new Promise((resolve) => setTimeout(resolve, 1800));
      saveTrackingTestResult(true);

    } catch (err) {
      console.error('TrackingTest auto-complete failed:', err);
      setStatus('error');
      // Still save & logout even if PDF failed
      await new Promise((resolve) => setTimeout(resolve, 2000));
      saveTrackingTestResult(true);
    }
  };

  const generateAndDownloadPDF = async (dataUrl: string) => {
    if (!activeTrackingTest) return;
    const pdf = new jsPDF('p', 'mm', 'a4');

    // ── Page 1: Text summary ────────────────────────────────────────────────
    pdf.setFontSize(22);
    pdf.text('Tracking-Test Prüfprotokoll', 105, 20, { align: 'center' });

    pdf.setFontSize(12);
    pdf.text(`Tester: ${activeTrackingTest.userName || 'Unbekannt'}`, 20, 40);
    pdf.text(`Datum: ${new Date(activeTrackingTest.startTime).toLocaleDateString('de-DE')}`, 20, 48);
    pdf.text(`Start: ${new Date(activeTrackingTest.startTime).toLocaleTimeString('de-DE')}`, 20, 56);
    pdf.text(`Ende:  ${new Date(activeTrackingTest.endTime).toLocaleTimeString('de-DE')}`, 20, 64);
    pdf.text(`Dauer: ${activeTrackingTest.durationMinutes} Minuten`, 20, 72);

    const distanceMeters = calculateTotalDistance(activeTrackingTest.trackPoints);
    const distanceKm = (distanceMeters / 1000).toFixed(2);
    pdf.text(
      `Zurückgelegte Distanz: ${distanceMeters > 1000 ? distanceKm + ' km' : Math.round(distanceMeters) + ' m'}`,
      20, 80
    );
    pdf.text(`Wegpunkte erfasst: ${activeTrackingTest.trackPoints.length}`, 20, 88);

    const passed = activeTrackingTest.trackPoints.length >= 5;
    pdf.setFontSize(14);
    pdf.setTextColor(passed ? 0 : 200, passed ? 150 : 0, 0);
    pdf.text(`Ergebnis: ${passed ? 'BESTANDEN ✓' : 'NICHT BESTANDEN ✗'}`, 20, 102);
    pdf.setTextColor(0, 0, 0);

    // ── Page 2: Map image ───────────────────────────────────────────────────
    pdf.addPage();
    pdf.setFontSize(16);
    pdf.text('GPS Spur (Lagekarte)', 105, 15, { align: 'center' });

    // A4 portrait usable width = 190mm, height of image (1200×750 ratio)
    const pdfWidth = 190;
    const pdfHeight = (750 * pdfWidth) / 1200; // ≈ 118.75 mm
    pdf.addImage(dataUrl, 'JPEG', 10, 22, pdfWidth, pdfHeight);

    // Attribution note below map
    pdf.setFontSize(7);
    pdf.setTextColor(120, 120, 120);
    pdf.text('Kartenmaterial: © OpenStreetMap contributors (openstreetmap.org/copyright)', 10, 22 + pdfHeight + 4);
    pdf.setTextColor(0, 0, 0);

    pdf.save(`TrackingTest_${activeTrackingTest.userName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
  };

  if (!activeTrackingTest) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const distanceMeters = calculateTotalDistance(activeTrackingTest.trackPoints);

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none flex flex-col items-center">

      {/* ── Live Timer Banner ─────────────────────────────────────────────── */}
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

      {/* ── Completion Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeTrackingTest.isCompleted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-slate-950/95 pointer-events-auto flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#1E293B] border border-slate-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-700 flex items-center gap-3 bg-blue-900/20">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">Test abgeschlossen</h2>
                  <p className="text-xs text-slate-400 font-mono">
                    GPS-Aufzeichnung beendet ({activeTrackingTest.durationMinutes} Min.)
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 p-6 space-y-5">

                {/* Map preview */}
                <div className="aspect-video bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden flex items-center justify-center relative">
                  {snapshotUrl ? (
                    <img src={snapshotUrl} alt="Lagekarte mit GPS-Spur" className="w-full h-full object-contain" />
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                      <span className="text-sm font-mono uppercase">Karte wird geladen…</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700">
                    <span className="block text-slate-400 uppercase text-[10px] mb-1">Startzeit</span>
                    <span className="text-slate-200 font-bold">
                      {new Date(activeTrackingTest.startTime).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700">
                    <span className="block text-slate-400 uppercase text-[10px] mb-1">Wegpunkte</span>
                    <span className="text-slate-200 font-bold">{activeTrackingTest.trackPoints.length}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700">
                    <span className="block text-slate-400 uppercase text-[10px] mb-1">Distanz</span>
                    <span className="text-slate-200 font-bold">
                      {distanceMeters > 1000
                        ? (distanceMeters / 1000).toFixed(2) + ' km'
                        : Math.round(distanceMeters) + ' m'}
                    </span>
                  </div>
                </div>

                {/* Status message */}
                <div className="flex items-center justify-center gap-3 py-3">
                  {status === 'loading-map' && (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                      <span className="text-sm text-slate-300 font-mono">Lagekarte wird erstellt…</span>
                    </>
                  )}
                  {status === 'generating-pdf' && (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                      <span className="text-sm text-slate-300 font-mono">Protokoll (PDF) wird gespeichert…</span>
                    </>
                  )}
                  {status === 'done' && (
                    <>
                      <FileText className="w-5 h-5 text-emerald-400" />
                      <span className="text-sm text-emerald-300 font-mono font-bold">
                        Protokoll gespeichert — Abmeldung…
                      </span>
                    </>
                  )}
                  {status === 'error' && (
                    <span className="text-sm text-amber-400 font-mono">
                      PDF konnte nicht erstellt werden — Abmeldung trotzdem…
                    </span>
                  )}
                  {status === 'idle' && (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                      <span className="text-sm text-slate-400 font-mono">Wird vorbereitet…</span>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
